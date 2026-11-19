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

// Compatibility repair of the exact pinned barcode extractor. No new models.
const barcodeFile='/app/engine/src/services/barcode.ts';
let barcode=await fs.readFile(barcodeFile,'utf8');
function replaceOnce(source,from,to){if(!source.includes(from))throw Error('Pinned barcode source changed');return source.replace(from,to);}
barcode=replaceOnce(barcode,'        ...ocrData,\n        pdf417_data:',"        ...ocrData,\n        ...({ccx_decoded_pdf417:pdf417RawData} as any),\n        pdf417_data:");
barcode=replaceOnce(barcode,'      } else {\n        pdf417Data = await this.detectPDF417WithOCRFromBuffer(imageBuffer);\n      }','      }');
barcode=replaceOnce(barcode,'// Also run OCR for additional data\n      const ocrData = await this.scanWithLocalOCRFromBuffer(imageBuffer);','// A decoded barcode needs no redundant text OCR; otherwise allow MRZ/text extraction.\n      const ocrData: BackOfIdData = pdf417RawData ? {parsed_data:{},verification_codes:[],security_features:[]} : await this.scanWithLocalOCRFromBuffer(imageBuffer);');
await fs.writeFile(barcodeFile,barcode);
const extractionFile='/app/engine/src/routes/extract.ts';let extraction=await fs.readFile(extractionFile,'utf8');
extraction=replaceOnce(extraction,"    logger.info('Back extraction complete', {","    (result as any).ccx_decoded_pdf417=(barcodeData as any)?.ccx_decoded_pdf417||null;\n\n    logger.info('Back extraction complete', {");
await fs.writeFile(extractionFile,extraction);
