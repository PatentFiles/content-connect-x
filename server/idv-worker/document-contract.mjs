/** Compatibility adapter for REAL decoded US PDF417 data; never OCR fallback text.
 * No confidence, authenticity, age, or face threshold is relaxed here.
 */
const validISO=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:null;};
export function usDocumentDate(value){
 if(typeof value!=='string')return null;
 const text=value.trim();if(validISO(text))return text;
 const m=/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/.exec(text)||/^(\d{2})(\d{2})(\d{4})$/.exec(text);
 if(m)return validISO(`${m[3]}-${m[1]}-${m[2]}`);
 const iso=/^(\\d{4})[\\/\\-](\\d{2})[\\/\\-](\\d{2})$/.exec(text);\n return iso?validISO(`${iso[1]}-${iso[2]}-${iso[3]}`):null;
}
const clean=value=>typeof value==='string'?value.normalize('NFKC').trim().replace(/\s+/g,' '):'';
export function decodedUSDocument(raw){
 if(typeof raw!=='string'||raw.length>65536||!/^@[\r\n\x1e]*ANSI \d{12}/.test(raw))return null;
 const fields={};
 // Values end at field separators, NOT at any three capital letters in a name.
 const pattern=/(?:^|[\r\n\x1e]|DL|ID)(DCS|DAC|DAD|DCU|DAQ|DBB|DBA)([^\r\n\x1e]*)/g;
 for(const m of raw.matchAll(pattern)){
  const v=clean(m[2]);if(fields[m[1]]!==undefined&&fields[m[1]]!==v)return null;fields[m[1]]=v;
 }
 const middle=fields.DAD==='NONE'?'':fields.DAD;
 const name=[fields.DAC,middle,fields.DCS,fields.DCU].filter(Boolean).join(' ');
 if(!fields.DAC||!fields.DCS||name.length>160||!/^[\p{L}\p{M} .,'’\-]+$/u.test(name))return null;
 const dob=usDocumentDate(fields.DBB),expiry=usDocumentDate(fields.DBA),number=fields.DAQ;
 if(!dob||!expiry||!number||number.length>100||/[\x00-\x1f]/.test(number))return null;
 return {full_name:name,date_of_birth:dob,expiry_date:expiry,id_number:number};
}
/** A narrow documented OCR artifact: visual-zone OCR sometimes joins the
 * first name and a SINGLE-letter middle initial (e.g. "AdamT Staples").
 * The independently decoded barcode must include that precise middle initial.
 * Every DOB, expiry and document-number comparison remains mandatory; neither
 * client-typed names nor fuzzy Levenshtein matches are accepted.
 */
export function middleInitialJoinedByOCR(visual,barcode,nameKey){
 if(typeof visual!=='string'||typeof barcode!=='string')return false;
 const front=visual.normalize('NFKC').trim().split(/\s+/u);
 const back=barcode.normalize('NFKC').trim().split(/\s+/u);
 if(back.length<3||front.length!==back.length-1||!/^\p{L}$/u.test(back[1]))return false;
 return nameKey(front[0])===nameKey(back[0]+back[1])&&front.slice(1).every((piece,i)=>nameKey(piece)===nameKey(back[i+2]));
}
export function compareDocumentFields(front,back,nameKey){
 const mismatches=[];
 for(const [field,good] of [
  ['legal_name',Boolean(front.name&&back?.full_name&&(nameKey(front.name)===nameKey(back.full_name)||middleInitialJoinedByOCR(front.name,back.full_name,nameKey)))],
  ['date_of_birth',Boolean(usDocumentDate(front.dob)&&usDocumentDate(front.dob)===usDocumentDate(back?.date_of_birth))],
  ['expiry_date',Boolean(usDocumentDate(front.expiry)&&usDocumentDate(front.expiry)===usDocumentDate(back?.expiry_date))],
  ['document_number',Boolean(front.number&&front.number===back?.id_number)],
 ])if(!good)mismatches.push(field);
 return {passed:mismatches.length===0,mismatches};
}
export const WORKER_REVISION='ccx-document-date-normalization-2026-11-19-v4';
