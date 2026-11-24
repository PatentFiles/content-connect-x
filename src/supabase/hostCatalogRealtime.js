/** Public read-only invalidations from the same HCX project on both sites. */
import {createClient} from '@supabase/supabase-js';
const HCX_ORIGIN='https://szfdoqkfewwpdkapqptp.supabase.co';
// Public browser key only; no member session or service key crosses projects.
const HCX_PUBLIC='sb_publishable_QTazzjv_XMv4AWBIcpamCQ_NPOj66_P';
let client=null;
export function subscribeHostCatalog(refresh){
 if(typeof window==='undefined')return ()=>{};
 if(!client)client=createClient(HCX_ORIGIN,HCX_PUBLIC,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},realtime:{params:{eventsPerSecond:5}}});
 let timer=0,closed=false;
 const trigger=()=>{if(closed)return;window.clearTimeout(timer);timer=window.setTimeout(()=>{if(!closed&&document.visibilityState==='visible')refresh();},350);};
 const channel=client.channel('hcx-catalog-'+crypto.randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'hc_catalog_signal'},trigger).subscribe(status=>{if(status==='SUBSCRIBED')trigger();});
 return ()=>{closed=true;window.clearTimeout(timer);void client.removeChannel(channel);};
}
