/** Private, on-demand PDF rendering from an immutable annual recap snapshot.
 * Vector-only layout: no remote tracking, source photos, user files or PII.
 */
import {PDFDocument,StandardFonts,rgb} from 'npm:pdf-lib@1.17.1';
import {normalizeRecap,recapAchievements,RECAP_METRICS,safePdfText} from './recapPolicy.mjs';
const W=612,H=792;
const navy=rgb(0.075,0.12,0.23),blue=rgb(0.15,0.37,0.73),
 aqua=rgb(0.12,0.78,0.73),muted=rgb(0.40,0.46,0.55),
 white=rgb(1,1,1),pale=rgb(0.945,0.965,0.985),line=rgb(0.84,0.88,0.93);
function block(page,x,y,w,h,color){
 page.drawRectangle({x,y,width:w,height:h,color});
}
function text(page,font,value,x,y,size,color=navy,max=100){
 page.drawText(safePdfText(value,max),{x,y,font,size,color});
}
export async function renderRecapPdf(record,displayName){
 const recap=normalizeRecap(record);
 const doc=await PDFDocument.create(),regular=await doc.embedFont(StandardFonts.Helvetica),
  bold=await doc.embedFont(StandardFonts.HelveticaBold);
 doc.setTitle('Content Connect X '+recap.year+' Year in Review');
 doc.setAuthor('Content Connect X');
 doc.setSubject('Private annual professional achievements - shared only by owner');
 doc.setCreationDate(new Date());
 const p1=doc.addPage([W,H]);block(p1,0,0,W,H,navy);
 block(p1,0,744,W,48,blue);
 text(p1,bold,'CONTENT CONNECT X',44,760,14,white);
 text(p1,regular,'YOUR PROFESSIONAL YEAR',44,675,16,aqua);
 text(p1,bold,String(recap.year),39,555,108,white);
 text(p1,bold,'YEAR IN REVIEW',44,512,26,white);
 block(p1,44,469,135,4,aqua);
 text(p1,regular,'CREATED FOR',44,421,12,aqua);
 text(p1,bold,safePdfText(displayName,42)||'Professional Member',44,383,24,white,42);
 text(p1,regular,recap.roleLabel,44,357,14,white);
 text(p1,regular,'COLLABORATIONS',44,282,12,aqua);
 text(p1,bold,String(recap.metrics.collaborations),44,183,84,white);
 text(p1,regular,'Projects created in '+recap.year+' that you participated in',44,150,12,white);
 block(p1,44,107,524,1,rgb(0.36,0.43,0.53));
 text(p1,regular,'Your story belongs to you. Sharing is always optional.',44,77,12,white);

 const p2=doc.addPage([W,H]);block(p2,0,0,W,H,white);
 block(p2,0,714,W,78,navy);
 text(p2,bold,recap.year+' BY THE NUMBERS',40,746,23,white);
 text(p2,regular,recap.roleLabel+' - your professional activity',40,721,11,aqua);
 const grid=RECAP_METRICS.slice(0,8);
 for(let i=0;i<grid.length;i++){
  const col=i%2,row=Math.floor(i/2),x=40+col*272,y=580-row*125;
  block(p2,x,y,260,112,pale);
  block(p2,x,y,4,112,blue);
  text(p2,bold,grid[i].label.toUpperCase(),x+18,y+82,10,muted,30);
  text(p2,bold,String(recap.metrics[grid[i].key]),x+18,y+28,40,navy);
 }
 text(p2,bold,'MILESTONES',40,99,13,navy);
 const a=recapAchievements(record);
 if(!a.length)text(p2,regular,'A fresh chapter - keep building your professional story.',40,77,10,muted);
 else{
  // A concise highlight fits next to the document footer without overflow.
  text(p2,regular,a.map(x=>x.title).slice(0,3).join('   /   '),40,77,10,muted,105);
 }
 block(p2,40,59,532,1,line);
 text(p2,regular,'Counts use recorded UTC-year activity; previously removed records may be excluded.',40,43,8,muted,120);
 text(p2,regular,'Private report. Posting or sharing requires your separate action.',40,29,8,muted,120);
 const bytes=await doc.save();
 if(bytes.length<2500)throw Error('The annual PDF could not be validated');
 return bytes;
}