import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
const change=(p,a,b)=>{const s=read(p);if(!s.includes(a))throw Error('Missing repair anchor: '+p+' '+a.slice(0,70));write(p,s.replace(a,b));};
const camera='src/supabase/LiveIdentityCamera.jsx';
change(camera,"import {flushSync} from 'react-dom';","import {flushSync} from 'react-dom';\nimport {headTurnPlan,runHeadTurnSequence} from './identityCaptureSequence.mjs';");
change(camera,"const video=useRef(null)","const [countdown,setCountdown]=useState(null);\n const video=useRef(null)");
change(camera,"setPhase('idle');setInstruction('');}};","setPhase('idle');setInstruction('');setCountdown(null);}};");
let c=read(camera),first=c.indexOf("   const frames=[];setInstruction('Look straight"),last=c.indexOf('   // Release the hardware immediately after capture',first);
if(first<0||last<0)throw Error('Capture sequence anchor missing');
c=c.slice(0,first)+`   const sequence=await runHeadTurnSequence({directions:session.directions,signal,frame,delay:cameraDelay,onCue:cue=>{if(current(run)){setInstruction(cue.text);setCountdown(cue.countdown);}}});
   const payload={challenge_id:session.challenge_id,challenge_type:'head_turn',directions:session.directions,...sequence};
   setCountdown(null);
`+c.slice(last);write(camera,c);
change(camera,'  <div hidden={!showPreview}',`  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-900" data-capture-instructions="true">
   <p className="font-semibold">Before you start</p>
   <p>Keep the phone still, your whole face in view, and both eyes visible. A 3–2–1 countdown comes before the first picture. Follow these two movements:</p>
   <ol className="mt-2 list-decimal space-y-1 pl-5">{headTurnPlan(session.directions).map(item=><li key={item.step}>{item.instruction}</li>)}</ol>
   <p className="mt-2">Turn gently, not to a full side profile. Wait for the on-screen instruction before looking back.</p>
  </div>
  <div hidden={!showPreview}`);
change(camera,'  {instruction&&<p',`  {phase==='capturing'&&countdown!==null&&<div data-identity-countdown="true" className="mt-3 text-center text-5xl font-bold tabular-nums" aria-label={String(countdown)+' seconds remaining'}>{countdown}</div>}
  {instruction&&<p`);
// Shared result state prevents the parent diagnostic panel and capture view from
// displaying contradictory snapshots after out-of-order network responses.
const view='src/supabase/IdentityVerification.jsx';
change(view,"import IdentityUploadProgress from './IdentityUploadProgress';","import IdentityUploadProgress from './IdentityUploadProgress';\nimport {mergeIdentitySnapshot,identityFinished,identityResultTitle} from './identityResultState.mjs';");
change(view,"const alive=useRef(true)","const [refreshing,setRefreshing]=useState(false),[lastChecked,setLastChecked]=useState(null);\n const refreshInFlight=useRef(null);\n const alive=useRef(true)");
change(view,"setState(old=>({...old,...result}))","setState(old=>mergeIdentitySnapshot(old,result))");
change(view,"const refresh=async()=>{\n  const result=await action('status');await accept(result);\n  if(alive.current)setName(previous=>previous||result.legal_name||'');\n };",`const refresh=()=>{
  if(refreshInFlight.current)return refreshInFlight.current;
  if(alive.current)setRefreshing(true);
  const task=(async()=>{
   try{const result=await action('status');await accept(result);if(alive.current){setName(previous=>previous||result.legal_name||'');setLastChecked(new Date().toLocaleTimeString());}}
   finally{refreshInFlight.current=null;if(alive.current)setRefreshing(false);}
  })();refreshInFlight.current=task;return task;
 };`);
change(view,"  const timer=window.setInterval(()=>{void refresh().catch(()=>{});},5000);\n  return()=>window.clearInterval(timer);\n },[state?.session?.status]);",`  let active=true,timer;
  const poll=async()=>{
   try{await refresh();}catch(e){if(active&&alive.current)setError('The latest result could not be loaded. '+e.message);}
   if(active)timer=window.setTimeout(poll,1000);
  };
  timer=window.setTimeout(poll,1000);
  return()=>{active=false;window.clearTimeout(timer);};
 },[state?.session?.id,state?.session?.status]);`);
change(view,"  {session?.message&&status!=='approved'",`  {identityFinished(status)&&<div role="status" aria-live="polite" data-identity-result={status} className="mt-5 rounded-xl border p-4"><h2 className="text-lg font-semibold">{identityResultTitle(status,testing)}</h2>{testing&&<p className="mt-1 text-sm">This is the completed test result. Your existing account access is unchanged.</p>}</div>}
  {session?.message&&status!=='approved'`);
change(view,"Checking your saved evidence. You can return to this screen to check the result.","Checking your saved evidence now. The result will appear here automatically—no refresh is needed.");
change(view,'disabled={locked} onClick={()=>perform(refresh)}','disabled={refreshing} onClick={()=>{setError(\'\');void refresh().catch(e=>{if(alive.current)setError(e.message);});}}');
change(view,'<RefreshCw size={16}/>Check status','<RefreshCw size={16} className={refreshing?\'animate-spin\':\'\'}/>{refreshing?\'Refreshing result…\':\'Check status\'}');
change(view,'  {onboarding&&<p',`  {lastChecked&&<p role="status" className="mt-1 text-center text-xs text-[var(--cc-text-secondary)]">Last result check: {lastChecked}</p>}
  {testing&&['review_required','approved','age_restricted'].includes(status)&&<button type="button" disabled={locked} onClick={restart} className="ccx-secondary mt-3 min-h-11 w-full rounded-xl px-4 py-3">Start a new private test</button>}
  {onboarding&&<p`);
const pilot='src/supabase/IdentityPilot.jsx';
change(pilot,"import {identityUploadTo} from './identityApi';","import {identityUploadTo} from './identityApi';\nimport {mergeIdentitySnapshot,identityDiagnosticHelp} from './identityResultState.mjs';");
change(pilot,"['name_matches','Entered legal name matches']","['document_current','ID expiry read as current'],['name_matches','Entered legal name matches']");
write(pilot,read(pilot).replaceAll('setSnapshot(previous=>({...previous,...data}))','setSnapshot(previous=>mergeIdentitySnapshot(previous,data))'));
change(pilot,"const session=snapshot?.session,diagnostics=session?.diagnostics||{};","const session=snapshot?.session,diagnostics={...session?.diagnostics};\n if(diagnostics.engine_revision&&diagnostics.document_current===undefined)diagnostics.document_current=diagnostics.extracted_expiry?diagnostics.extracted_expiry>=new Date().toISOString().slice(0,10):null;");
change(pilot,'{diagnostics.engine_revision&&<section',"{diagnostics.engine_revision&&session?.status!=='processing'&&<section");
change(pilot,'<span>{label}</span><strong',`<div className="min-w-0 flex-1"><span>{label}</span>{diagnostics[key]!==true&&<p className="mt-1 text-xs leading-5 text-slate-600">{identityDiagnosticHelp(key,diagnostics)}</p>}</div><strong`);
// Keep meaningful per-field explanations, including unsupported/missing values.
change('src/supabase/identityResultState.mjs','export function identityDiagnosticHelp','/** @param {string} key\n * @param {any} diagnostics\n * @param {string} today */\nexport function identityDiagnosticHelp');
// Fix the adapter, not the match thresholds. The pinned upstream emits US
// barcode dates with slashes and omits middle names in its convenience payload.
const worker='server/idv-worker/worker.mjs';
change(worker,"import http from 'node:http';","import http from 'node:http';\nimport {decodedUSDocument,compareDocumentFields,WORKER_REVISION} from './document-contract.mjs';");
change(worker,'async function processJob(job){','async function processJob(job){\n const began=performance.now();');
change(worker,' let crossChecked=false;',' let crossChecked=false,fieldComparison={passed:false,mismatches:[]};');
let w=read(worker),a=w.indexOf('  const p=back?.qr_payload;'),b=w.indexOf('\n }\n const a=front.authenticity;',a);
if(a<0||b<0)throw Error('Document comparison block missing');
w=w.slice(0,a)+`  const decoded=decodedUSDocument(back?.ccx_decoded_pdf417);
  // OCR fallback is never represented as an independently decoded barcode.
  const p=decoded||(back?.barcode_format==='PDF417'?null:back?.qr_payload);
  fieldComparison=compareDocumentFields({name,dob,expiry,number},p,safeName);
  crossChecked=fieldComparison.passed&&(!!decoded||['QR_CODE','DATA_MATRIX'].includes(back?.barcode_format)||(back?.mrz_result?.checksums_valid===true&&!!back?.mrz_result?.fields));`+w.slice(b);write(worker,w);
change(worker,' const detections=new Map();',' const detections=new Map(),frameChecks=[];\n let selfieReference=null;');
change(worker,"  if(i===0)faceDistance=d;\n  if(!face||face.confidence<0.9||d>0.5)frameIdentity=false;",`  if(i===0){faceDistance=d;selfieReference=face?Array.from(face.embedding):null;}
  // Document-to-selfie is checked separately. Temporal continuity must compare
  // each movement frame with the initial LIVE selfie, not the old ID portrait.
  const liveDistance=distance(selfieReference,face?Array.from(face.embedding):null);
  const passed=!!face&&face.confidence>=0.9&&liveDistance<=0.5;
  frameChecks.push({phase:capture.frames[i].phase,face_present:!!face,confidence_passed:!!face&&face.confidence>=0.9,identity_passed:passed});
  if(!passed)frameIdentity=false;`);
change(worker,' let live=true;',' let live=true;const turnChecks=[];');
change(worker,"  if(verdict.passed!==true||!requiredChecks.every(k=>verdict.checks?.[k]?.passed===true))live=false;","  const failed_checks=requiredChecks.filter(k=>verdict.checks?.[k]?.passed!==true);\n  turnChecks.push({direction:capture.directions[turn],failed_checks});\n  if(verdict.passed!==true||failed_checks.length)live=false;");
change(worker,'evidence_hashes:hashes,model_manifest:modelManifest,',`evidence_hashes:hashes,model_manifest:modelManifest,
  check_details:{worker_revision:WORKER_REVISION,processing_ms:Math.round(performance.now()-began),
   low_confidence_fields:['legal_name','date_of_birth','expiry_date','document_number'].filter((_,i)=>!Number.isFinite(required[i])||required[i]<0.90||required[i]>1),
   barcode_decoded:job.document_type==='passport'?null:!!back?.ccx_decoded_pdf417,
   front_back_mismatches:job.document_type==='passport'?[]:fieldComparison.mismatches,
   authenticity_available:!!a,authenticity_score:Number.isFinite(a?.score)?a.score:null,authenticity_flag_count:Array.isArray(a?.flags)?a.flags.length:null,
   frame_checks:frameChecks,turn_checks:turnChecks},`);
change(worker,"ocr_self_test:true,modes:['signup','pilot']","ocr_self_test:true,worker_revision:WORKER_REVISION,modes:['signup','pilot']");
change('server/idv-worker/Dockerfile','COPY worker.mjs policy.mjs /app/ccx/','COPY worker.mjs policy.mjs document-contract.mjs /app/ccx/');
// Add a source marker ONLY on the real ZXing decode path. Retain raw fields
// transiently in the existing engine response; never send them to a browser.
const prep='server/idv-worker/prepare-build.mjs';
write(prep,read(prep)+`
// Compatibility repair of the exact pinned barcode extractor. No new models.
const barcodeFile='/app/engine/src/services/barcode.ts';
let barcode=await fs.readFile(barcodeFile,'utf8');
function replaceOnce(source,from,to){if(!source.includes(from))throw Error('Pinned barcode source changed');return source.replace(from,to);}
barcode=replaceOnce(barcode,'        ...ocrData,\\n        pdf417_data:',"        ...ocrData,\\n        ...({ccx_decoded_pdf417:pdf417RawData} as any),\\n        pdf417_data:");
barcode=replaceOnce(barcode,'      } else {\\n        pdf417Data = await this.detectPDF417WithOCRFromBuffer(imageBuffer);\\n      }','      }');
barcode=replaceOnce(barcode,'// Also run OCR for additional data\\n      const ocrData = await this.scanWithLocalOCRFromBuffer(imageBuffer);','// A decoded barcode needs no redundant text OCR; otherwise allow MRZ/text extraction.\\n      const ocrData: BackOfIdData = pdf417RawData ? {parsed_data:{},verification_codes:[],security_features:[]} : await this.scanWithLocalOCRFromBuffer(imageBuffer);');
await fs.writeFile(barcodeFile,barcode);
const extractionFile='/app/engine/src/routes/extract.ts';let extraction=await fs.readFile(extractionFile,'utf8');
extraction=replaceOnce(extraction,"    logger.info('Back extraction complete', {","    (result as any).ccx_decoded_pdf417=(barcodeData as any)?.ccx_decoded_pdf417||null;\\n\\n    logger.info('Back extraction complete', {");
await fs.writeFile(extractionFile,extraction);
`);
// Diagnostics are bounded and explicitly allowlisted, never raw OCR/ID numbers.
const pp='supabase/functions/identity-pilot/pilot-policy.mjs';
change(pp,"import {decide,legalName", "import {sanitizedCheckDetails} from './check-details.mjs';\nimport {decide,legalName");
change(pp,'  age_eligible:eligible&&dob<=today?today>=eligible:null,','  age_eligible:eligible&&dob<=today?today>=eligible:null,document_current:isoDate(doc.expiry)?isoDate(doc.expiry)>=today:null,\n  check_details:sanitizedCheckDetails(report.check_details),');
// Browser regression asserts directions are present BEFORE capture, countdown
// is visible, and a completed reply is not replaced by an older processing poll.
const test='scripts/test-identity-onboarding-browser.mjs';
change(test," await click('Start head-turn capture');\n await wait(\"window.__uploadKind==='capture'\"",` assert.equal(await evaluate("document.querySelector('[data-capture-instructions]').textContent.includes('hold for three seconds')"),true);
 await click('Start head-turn capture');
 await wait("document.querySelector('[data-identity-countdown]')?.textContent==='3'",'visible 3–2–1 countdown');
 await wait("document.querySelector('[data-identity-countdown]')?.textContent==='2'",'visible second countdown step');
 await wait("document.querySelector('[data-identity-countdown]')?.textContent==='1'",'visible final countdown step');
 await wait("window.__uploadKind==='capture'"`);
const doc=`# Guided identity capture and automatic results\n\nThe phone flow previews both server-assigned head turns before starting. A visible 3–2–1 countdown precedes the first center frame. Each turn has an explicit movement prompt, a three-second HOLD countdown, and a three-second return-to-center countdown. The original six phases, minimum timings and server-only verdict remain unchanged.\n\nStatus polling is single-flight and automatic during processing. Terminal responses cannot be overwritten by older pending polls. The finished result is prominent, manual status has visible feedback, and pilot diagnostics explain name, expiry, barcode, field confidence and capture failures. A passed face/DOB check never bypasses the other requirements.\n\nThe worker adapter now preserves middle names from a real decoded AAMVA payload and normalizes US barcode dates before exact front/back comparisons. Text OCR fallback cannot masquerade as a successful barcode decode. Successful barcode decoding avoids redundant back-side OCR. Movement-frame continuity compares against the initial live selfie, while the independent ID-to-selfie threshold remains unchanged. A bounded diagnostic allowlist records only check categories/booleans and processing duration; no raw OCR, document numbers, photos or reusable face embeddings are added to results or logs.\n\nThese fixes do not certify a document or liveness model. The original failed attempt stays unchanged. The owner should retest with the printed complete legal name, a current readable document, and the improved capture guidance. Public signup is not activated by a private test.\n\nHosting stays Bolt for the website, the existing Supabase project for accounts/evidence, and the dedicated identity-only Railway service for computation. Public homepage artwork/styles are untouched. Publish the matching frontend in Bolt after merging. Worker changes and the diagnostic policy require their own deployments.\n`;
write('docs/IDENTITY_GUIDANCE_RESULTS.md',doc);
write('README.md','## Guided identity capture and result repair — November 19, 2026\n\nSee `docs/IDENTITY_GUIDANCE_RESULTS.md`: advance directions and visible countdowns, automatic final results, strict barcode/date/name compatibility repairs, and live-selfie continuity. Required verification gates and private evidence retention remain enforced. Bolt remains the website host; public homepage styles are unchanged.\n\n'+read('README.md'));
fs.unlinkSync('scripts/identity-guidance-repair-once.mjs');fs.unlinkSync('.github/workflows/identity-guidance-repair-once.yml');
console.log('Applied guidance/result/adapter repair. No live identity evidence is included in source or tests.');
