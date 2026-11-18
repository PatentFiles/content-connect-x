/** Applied only to the exact pinned upstream source. Unexpected source fails build. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const revision='189226d63aabb48cb40776fd1c453ebc0fa722f1';
const base=`https://raw.githubusercontent.com/vladmandic/face-api/${revision}`;
const names=['ssd_mobilenetv1','face_landmark_68','face_recognition'];
await fs.mkdir('/app/engine/models',{recursive:true});
await fs.mkdir('/app/shared/models',{recursive:true});
await fs.mkdir('/app/ccx',{recursive:true});
const manifest={};
async function download(name,destination){
 const response=await fetch(`${base}/${name}`,{redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error(`Required model download failed: ${name}`);
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<20)throw Error('Empty model asset');
 await fs.writeFile(destination,bytes);manifest[name]=createHash('sha256').update(bytes).digest('hex');
}
for(const name of names){
 await download(`model/${name}_model-weights_manifest.json`,`/app/engine/models/${name}_model-weights_manifest.json`);
 await download(`model/${name}_model.bin`,`/app/engine/models/${name}_model.bin`);
}
await download('LICENSE','/app/ccx/LICENSE-FACE-MODELS');
await fs.writeFile('/app/ccx/model-manifest.json',JSON.stringify(manifest,null,2));
// Avoid inferring facial age/gender: only document DOB is an age input.
const file='/app/engine/src/services/faceRecognition.ts';let source=await fs.readFile(file,'utf8');
for(const [from,to] of [
 ["        await faceapi.nets.ageGenderNet.loadFromDisk(MODELS_DIR);",''],
 ['.withFaceDescriptor()\n          .withAgeAndGender();','.withFaceDescriptor();'],
 ['          age: result.age,\n          gender: result.gender,',''],
]){if(!source.includes(from))throw Error('Pinned upstream face service has changed');source=source.replace(from,to);}
await fs.writeFile(file,source);
