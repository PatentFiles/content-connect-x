import {supabase} from '@/api/supabaseClient';

/** All operations verify Supabase JWTs and server-side membership/role. */
async function invoke(fn,action,args={}){
 const {data,error}=await supabase.functions.invoke(fn,{body:{action,...args}});
 if(error||data?.error){
  let message=data?.error||error?.message||'Hosting operation unavailable';
  if(error?.context?.json){try{const body=await error.context.json();if(typeof body?.error==='string')message=body.error;}catch{}}
  throw new Error(message);
 }
 return data;
}
export const hostingBusiness=(action,args)=>invoke('hosting-operations',action,args);
export const hostingAgreement=(action,args)=>invoke('hosting-docusign',action,args);
export const hostingCheckout=(action,args)=>invoke('hosting-ccbill',action,args);
export const hostingAdvanced=(action,args)=>invoke('hosting-advanced',action,args);
export const hostingProduction=(action,args)=>invoke('hosting-production',action,args);
export const hostingCalendar=(action,args)=>invoke('hosting-calendar',action,args);

export async function uploadHostingCompliance({propertyId,type,file}){
 if(!file||file.size>10_485_760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))
  throw new Error('Select a PDF, JPEG, PNG or WebP file under 10 MB.');
 const {path,token}=await hostingBusiness('verification_upload_token',{
  property_id:propertyId,document_type:type,mime_type:file.type
 });
 const {error}=await supabase.storage.from('hosting-compliance').uploadToSignedUrl(path,token,file,{
  contentType:file.type,upsert:false
 });
 if(error)throw error;
 return path;
}
export async function uploadDamageEvidence({claimId,file}){
 if(!file||file.size>10_485_760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))
  throw new Error('Select a PDF, JPEG, PNG or WebP under 10 MB.');
 const {path,token}=await hostingBusiness('claim_evidence_token',{claim_id:claimId,mime_type:file.type});
 const {error}=await supabase.storage.from('hosting-claims')
  .uploadToSignedUrl(path,token,file,{contentType:file.type,upsert:false});
 if(error)throw error;
 return hostingBusiness('claim_evidence_register',{claim_id:claimId,path});
}
export function formatUSD(cents){
 return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(cents||0)/100);
}
export function formatDate(input){
 return input?new Date(input).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'—';
}
