import {PDFDocument,StandardFonts,rgb} from 'npm:pdf-lib@1.17.1';
import {reportRows} from './disclosurePolicy.mjs';
export async function makeCasePdf(report,caseNumber){
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const pageWidth=612,pageHeight=792;
 let page=doc.addPage([pageWidth,pageHeight]),y=752,count=1;
 const row=(value,header=false)=>{
  if(y<56){page=doc.addPage([pageWidth,pageHeight]);y=752;count++;}
  const line=String(value||'').replace(/[\x00-\x1f]/g,' ').replace(/[^\x20-\x7e]/g,'?');
  const face=header?bold:font,size=header?11:9,max=header?80:110;
  for(let i=0;i<Math.min(900,line.length);i+=max){
   if(y<56){page=doc.addPage([pageWidth,pageHeight]);y=752;count++;}
   page.drawText(line.slice(i,i+max),{x:42,y,size,font:face,color:rgb(.16,.22,.30)});
   y-=header?20:14;
  }
 };
 row('CONTENT CONNECT X - CASE DISCLOSURE',true);
 row('Agency case: '+caseNumber);
 row('Prepared: '+new Date().toISOString());
 row('Case-scoped disclosure; authorized evidence may be incomplete',true);
 y-=12;
 for(const [type,timestamp,field,value] of reportRows(report).slice(1,2800)){
  row([type,timestamp,field,value].join(' | '));
 }
 for(let i=0;i<doc.getPageCount();i++){
  const p=doc.getPages()[i];
  p.drawText('Case-scoped record - page '+(i+1)+' of '+doc.getPageCount(),{x:42,y:25,size:9,font});
 }
 doc.setTitle('Case-scoped lawful disclosure '+caseNumber);
 doc.setAuthor('Content Connect X');
 return await doc.save();
}
