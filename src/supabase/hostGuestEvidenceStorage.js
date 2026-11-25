import {isDemoActive} from '../demo/demoRuntime.mjs';
/** Separate public Host Storage client ONLY for signed evidence upload.
 * Never caches Host credentials or signs into Host Auth for a CCX member.
 * A fresh short-lived upload token is issued by Host Marketplace only after
 * verifying the guest's genuine CCX JWT and confirmed booking.
 */
import {createClient} from '@supabase/supabase-js';
const storage=createClient('https://szfdoqkfewwpdkapqptp.supabase.co',"sb_publishable_QTazzjv_XMv4AWBIcpamCQ_NPOj66_P",{
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
export async function uploadHostGuestEvidence({path,token,file}){
 if(isDemoActive())throw Error('Live property evidence uploads are disabled in demo mode.');
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10485760)
  throw Error('Choose a JPEG, PNG or WebP image under 10 MB.');
 const {error}=await storage.storage.from('hc-guest-issues').uploadToSignedUrl(
  path,token,file,{contentType:file.type,upsert:false}
 );
 if(error)throw Error(error.message||'Host property evidence upload failed.');
}
