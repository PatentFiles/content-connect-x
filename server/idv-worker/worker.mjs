/** Private-data worker. No Supabase service key or standing API secret is held here.
 * A short-lived, single-use capability is issued by the Edge Function for each job.
 * Public callers cannot choose file URLs, identities, or verification decisions.
 */
import http from 'node:http';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import faceapi from '@vladmandic/face-api/dist/face-api.node-wasm.js';
import {FaceRecognitionService} from '/app/engine/dist/services/faceRecognition.js';
import {verifyHeadTurnLiveness} from '/app/shared/dist/index.js';
import {extractMRZFromText} from '/app/engine/dist/services/mrz.js';
import {ENGINE_REVISION,SCHEMA,validateCapture,nameKey,isoDate,imageMime,MAX_IMAGE} from './policy.mjs';

const PROJECT_ORIGIN=process.env.SUPABASE_URL;
if (!PROJECT_ORIGIN || !/^https:\/\/[a-z]{20}\.supabase\.co$/.test(PROJECT_ORIGIN)) throw Error('SUPABASE_URL must be the trusted project origin');
const CALLBACK=`${PROJECT_ORIGIN}/functions/v1/identity-verification`;
const engine=spawn(process.execPath,['dist/server.js'],{cwd:'/app/engine',env:{...process.env,PORT:'3002',LOG_LEVEL:'error'},stdio:['ignore','ignore','ignore']});
engine.on('exit',()=>process.exit(1));
const faces=new FaceRecognitionService();
const HASH=b=>createHash('sha256').update(b).digest('hex');
const distance=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===128&&b.length===128&&a.every(Number.isFinite)&&b.every(Number.isFinite)?Math.sqrt(a.reduce((s,n,i)=>s+(n-b[i])**2,0)):Infinity;
const safeName=(s)=>{try{return nameKey(s);}catch{return null;}};
let active=0;
let ready=false;
let modelManifest;
try{modelManifest=JSON.parse(readFileSync('/app/ccx/model-manifest.json','utf8'));}catch{modelManifest={};}
async function bounded(response,max) {
 if (!response.ok || !response.body) throw Error('DEPENDENCY_UNAVAILABLE');
 const out=[];let length=0;const reader=response.body.getReader();
 try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max)throw Error('SIZE_LIMIT');out.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(out,length);
}
async function claim(id,token) {
 const r=await fetch(CALLBACK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'worker_claim',session_id:id,token}),redirect:'error',signal:AbortSignal.timeout(15000)});
 return JSON.parse((await bounded(r,32*1024)).toString());
}
async function artifact(item) {
 const url=new URL(item.url);
 if(url.origin!==PROJECT_ORIGIN || !url.pathname.startsWith('/storage/v1/object/sign/ccx-identity-evidence/'))throw Error('UNTRUSTED_ARTIFACT');
 const bytes=await bounded(await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)}),MAX_IMAGE);
 if(HASH(bytes)!==item.sha256)throw Error('EVIDENCE_HASH_MISMATCH');
 return bytes;
}
async function checkImage(bytes) {
 imageMime(bytes);
 // Decode with a pixel bound before the upstream engine sees the file.
 const meta=await sharp(bytes,{limitInputPixels:25000000,failOn:'error'}).metadata();
 if(!meta.width||!meta.height||meta.width<200||meta.height<200||!['jpeg','png'].includes(meta.format))throw Error('IMAGE_QUALITY');
 await sharp(bytes,{limitInputPixels:25000000,failOn:'error'}).stats();
}
async function extract(kind,bytes,job) {
 const f=new FormData();f.append('file',new Blob([bytes],{type:imageMime(bytes)}),'evidence.jpg');
 f.append('document_type',job.document_type);f.append('issuing_country',job.issuing_country);
 f.append('verification_id',job.id);f.append('document_id',`${job.id}-${kind}`);
 // No LLM config, cloud credentials, sandbox flags or arbitrary URLs are accepted.
 const r=await fetch(`http://127.0.0.1:3002/extract/${kind}`,{method:'POST',body:f,redirect:'error',signal:AbortSignal.timeout(65000)});
 const data=JSON.parse((await bounded(r,512*1024)).toString());
 if(data.success!==true||!data.result)throw Error('EXTRACTION_FAILED');
 return data.result;
}
/** A live frame must contain exactly one face. Reuse these measurements for
 * both identity and motion checks to avoid duplicate model inference. */
async function liveFace(bytes) {
 const {data,info}=await sharp(bytes).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
 const tensor=faceapi.tf.tensor3d(new Uint8Array(data),[info.height,info.width,3]);
 try{
  const detections=await faceapi.detectAllFaces(tensor,new faceapi.SsdMobilenetv1Options({minConfidence:0.3})).withFaceLandmarks().withFaceDescriptors();
  if(detections.length!==1)return null;
  const d=detections[0],box=d.detection.box;
  return {embedding:d.descriptor,confidence:d.detection.score,landmarks:d.landmarks.positions.map(p=>({x:p.x,y:p.y})),boundingBox:{x:box.x,y:box.y,width:box.width,height:box.height}};
 }finally{tensor.dispose();}
}
async function processJob(job) {
 const hashes=Object.fromEntries(Object.entries(job.evidence).map(([k,v])=>[k,v.sha256]));
 const frontBytes=await artifact(job.evidence.front),captureBytes=await artifact(job.evidence.capture);
 await checkImage(frontBytes);
 const capture=validateCapture(JSON.parse(captureBytes.toString()),job);
 const frameBytes=capture.frames.map(f=>Buffer.from(f.frame_base64,'base64'));
 for(const b of frameBytes)await checkImage(b);
 if(new Set(frameBytes.map(HASH)).size!==frameBytes.length)throw Error('REPLAYED_IDENTICAL_FRAMES');
 if(HASH(frameBytes[0])!==job.evidence.selfie.sha256)throw Error('SELFIE_NOT_BOUND_TO_CAPTURE');
 const front=await extract('front',frontBytes,job);
 let back=null;
 if(job.document_type!=='passport') {const bytes=await artifact(job.evidence.back);await checkImage(bytes);back=await extract('back',bytes,job);}
 const ocr=front.ocr||{};
 const name=ocr.name||ocr.full_name||'',dob=ocr.date_of_birth||'',expiry=ocr.expiration_date||ocr.expiry_date||'',number=ocr.document_number||ocr.id_number||'';
 const confidence=ocr.confidence_scores||{};
 const required=[confidence.name??confidence.full_name,confidence.date_of_birth,confidence.expiration_date??confidence.expiry_date,confidence.document_number??confidence.id_number];
 const fieldsConfident=required.every(x=>Number.isFinite(x)&&x>=0.90&&x<=1);
 let crossChecked=false;
 if(job.document_type==='passport') {
  const mrz=extractMRZFromText(ocr.raw_text||'');
  crossChecked=!!mrz&&mrz.check_digits_valid===true&&mrz.fields.date_of_birth===dob
    &&mrz.fields.document_number===number&&mrz.fields.expiry_date===expiry
    &&safeName(mrz.fields.full_name)===safeName(name);
 } else {
  const p=back?.qr_payload;
  crossChecked=!!p&&isoDate(p.date_of_birth)===isoDate(dob)&&!!isoDate(dob)
   &&p.id_number===number&&isoDate(p.expiry_date)===isoDate(expiry)&&!!isoDate(expiry)
   &&safeName(p.full_name)!==null&&safeName(p.full_name)===safeName(name)
   &&(['PDF417','QR_CODE','DATA_MATRIX'].includes(back.barcode_format)||(back.mrz_result?.checksums_valid===true&&!!back.mrz_result?.fields));
 }
 // A missing detector is not an authenticity pass. EXIF absence alone is not
 // treated as forgery (camera canvases routinely remove EXIF).
 const a=front.authenticity;
 const authenticityPassed=a?.isAuthentic===true&&Number.isFinite(a.score)&&a.score>=0.80
  &&Array.isArray(a.flags)&&a.flags.every(x=>x==='MISSING_EXIF_JPEG');
 const embedding=front.face_embedding;
 let frameIdentity=true,faceDistance=Infinity;
 const detections=new Map();
 for(let i=0;i<frameBytes.length;i++) {
  const face=await liveFace(frameBytes[i]);detections.set(HASH(frameBytes[i]),face);
  const d=distance(embedding,face?Array.from(face.embedding):null);
  if(i===0)faceDistance=d;
  if(!face||face.confidence<0.9||d>0.5)frameIdentity=false;
 }
 let live=true;
 const requiredChecks=['face_present_all_frames','head_turn_detected','correct_direction','return_to_center','temporal_plausibility','face_bbox_consistency'];
 for(let turn=0;turn<2;turn++) {
  const frames=capture.frames.slice(turn*3,turn*3+3).map(f=>({...f,phase:f.phase.replace('turn1_','turn_')}));
  // The shared verifier accepts the three required motion phases. We independently
  // require six distinct images, two challenges, and same-person matches above.
  const verdict=await verifyHeadTurnLiveness({...capture,challenge_direction:capture.directions[turn],frames},{detectFaceLandmarksFromBuffer:async b=>detections.get(HASH(b))||null});
  if(verdict.passed!==true||!requiredChecks.every(k=>verdict.checks?.[k]?.passed===true))live=false;
 }
 return {schema:SCHEMA,engine_revision:ENGINE_REVISION,session_id:job.id,evidence_hashes:hashes,model_manifest:modelManifest,
  document:{type:job.document_type,country:job.issuing_country,name,dob,expiry,number,fields_confident:fieldsConfident,cross_checked:crossChecked,authenticity_passed:authenticityPassed},
  face:{matched:front.face_confidence>=0.9&&faceDistance<=0.5,distance:Number.isFinite(faceDistance)?faceDistance:null,liveness_passed:live,frame_identity_passed:frameIdentity}};
}
const respond=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
const server=http.createServer(async(req,res)=>{
 if(req.method==='GET'&&req.url==='/health') {
  try{if(!ready)throw Error();const r=await fetch('http://127.0.0.1:3002/health',{signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error();respond(res,200,{status:'ok',schema:SCHEMA,engine_revision:ENGINE_REVISION,model_files:Object.keys(modelManifest).length});}catch{respond(res,503,{status:'starting'});}return;
 }
 if(req.method!=='POST'||req.url!=='/process')return respond(res,404,{error:'Not found'});
 if(!ready)return respond(res,503,{error:'Worker is starting'});
 if(active>=1)return respond(res,429,{error:'Worker busy; retry later'});
 active++;
 try{
  let bytes=0;const chunks=[];
  for await(const chunk of req){bytes+=chunk.length;if(bytes>1024)throw Error('REQUEST_LIMIT');chunks.push(chunk);}
  const {session_id,token}=JSON.parse(Buffer.concat(chunks).toString());
  if(!/^[a-f0-9-]{36}$/.test(session_id)||!/^[a-f0-9]{64}$/.test(token))throw Error('INVALID_REQUEST');
  const job=await claim(session_id,token);
  if(job.id!==session_id||job.engine_revision!==ENGINE_REVISION)throw Error('INVALID_CAPABILITY');
  respond(res,200,await processJob(job));
 }catch{respond(res,422,{error:'Verification could not be completed'});}finally{active--;}
});
server.requestTimeout=150000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0');
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{engine.kill(sig);server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),5000).unref();});

// Readiness proves the face weights load and the OCR extraction route executes;
// a successful health check is still NOT an accuracy or spoof-resistance test.
(async()=>{
 try{
  if(Object.keys(modelManifest).length<6)throw Error('Required model manifest missing');
  await faces.initialize();
  let listening=false;
  for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:3002/health',{signal:AbortSignal.timeout(1000)});if(r.ok){listening=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}
  if(!listening)throw Error('Engine failed to start');
  const blank=await sharp({create:{width:640,height:400,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
  await extract('front',blank,{document_type:'passport',issuing_country:'US',id:'startup-healthcheck'});
  ready=true;
 }catch{console.error('Identity worker startup validation failed. No verification requests will be accepted.');}
})();
