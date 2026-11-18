import {validJobBearer} from './jobAuth.mjs';
import {parseEvents} from './calendarParser.mjs';
import {optionalProviderSetting} from './providerConfig.mjs';
/**
 * Secured two-way iCalendar interface:
 * - imports trusted provider URL feeds (no redirects, no guest PII persisted),
 * - exports anonymous privacy-safe "Busy" calendars with revocable 256-bit tokens,
 * - runs automatically when a protected scheduler calls cron_sync.
 * Do NOT configure provider URLs from untrusted domains.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const err=(s:string,status=400)=>reply({error:s},status);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const str=(v:unknown,n=160)=>typeof v==='string'?v.trim().slice(0,n):'';
const sha=async(input:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input))),
 x=>x.toString(16).padStart(2,'0')).join('');
const allowedUrl=(address:string,provider:string)=>{
 let u:URL;try{u=new URL(address);}catch{return false;}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hash||u.hostname.length>255)return false;
 if(u.hostname==='localhost'||u.hostname.endsWith('.local')||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))return false;
 const domains=provider==='airbnb'?['airbnb.com']:provider==='vrbo'?['vrbo.com','homeaway.com']:
  provider==='booking'?['booking.com']:(optionalProviderSetting('HOSTING_EXTRA_CALENDAR_HOSTS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 return domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d));
};
async function boundedFeed(url:string){
 const response=await fetch(url,{redirect:'error',headers:{accept:'text/calendar'},
  signal:AbortSignal.timeout(12000)});
 if(!response.ok||!response.body)throw Error('External calendar was unavailable');
 const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
 for(;;){
  const {done,value}=await reader.read();if(done)break;
  size+=value.length;
  if(size>256000){await reader.cancel();throw Error('Calendar exceeds 256KB limit');}
  chunks.push(value);
 }
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder().decode(bytes);
}
const icsTimestamp=(date:string)=>new Date(date).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!secret||!anon)return err('Service unavailable',503);
 const db=createClient(url,secret);
 if(req.method==='GET'){
  const raw=new URL(req.url).searchParams.get('token')||'';
  if(raw.length<40||raw.length>150)return new Response('Not found',{status:404});
  const digest=await sha(raw);
  const {data:token}=await db.from('hosting_calendar_export_tokens')
   .select('property_id,revoked_at').eq('token_hash',digest).maybeSingle();
  if(!token||token.revoked_at)return new Response('Not found',{status:404});
  const {data:venue,error:venueError}=await db.from('properties').select('id,status,owner_id').eq('id',token.property_id).maybeSingle();
  if(venueError||venue?.status!=='active')return new Response('Unavailable',{status:404});
  const {data:owner,error:ownerError}=await db.from('account_security').select('banned,suspended').eq('user_id',venue.owner_id).maybeSingle();
  if(ownerError||!owner||owner.banned||owner.suspended)return new Response('Unavailable',{status:404});
  const allBusy=async(table:string)=>{
    const rows:any[]=[];
    for(let offset=0;offset<20000;offset+=500){
      let q=db.from(table).select('id,starts_at,ends_at').eq('property_id',token.property_id)
       .gte('ends_at',new Date(Date.now()-30*86400000).toISOString()).order('id').range(offset,offset+499);
      if(table==='property_booking_requests')q=q.in('status',['requested','accepted']);
      const {data,error}=await q;if(error)throw error;
      rows.push(...data);if(data.length<500)return rows;
    }
    throw Error('Calendar export exceeds safe batch capacity');
  };
  let busy:any[];
  try{busy=(await Promise.all([allBusy('property_booking_requests'),allBusy('property_unavailable')])).flat();}
  catch{return new Response('Calendar temporarily unavailable',{status:503,headers:{'cache-control':'no-store'}});}
  const events=busy.map((b:any)=>[
   'BEGIN:VEVENT','UID:'+b.id+'@contentconnectx.invalid','DTSTAMP:'+icsTimestamp(new Date().toISOString()),
   'DTSTART:'+icsTimestamp(b.starts_at),'DTEND:'+icsTimestamp(b.ends_at),
   'SUMMARY:Unavailable','TRANSP:OPAQUE','END:VEVENT'
  ].join('\r\n')).join('\r\n');
  const payload='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Content Connect X//Busy Availability//EN\r\n'+events+'\r\nEND:VCALENDAR\r\n';
  return new Response(payload,{headers:{'content-type':'text/calendar; charset=utf-8',
   'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 }
 if(req.method!=='POST')return err('Method not allowed',405);
 const bearer=req.headers.get('Authorization')||'';
 const body=await req.json().catch(()=>({})),action=str(body.action,40);
 const jobSecret=Deno.env.get('HOSTING_CALENDAR_JOB_SECRET');
 const cron=action==='cron_sync'&&await validJobBearer(bearer,jobSecret);
 if(action==='cron_sync'&&!cron)return err('Unauthorized job',401);
 let uid:string|null=null;
 if(!cron){
  const auth=createClient(url,anon,{global:{headers:{Authorization:bearer}}});
  const {data:{user},error}=await auth.auth.getUser();
  if(error||!user)return err('Unauthorized',401);
  uid=user.id;
  const [age,security,sub,hostAccount]=await Promise.all([
   db.from('member_admissions').select('id,user_id,admitted_at,source,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(1),
   db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle(),
   db.from('member_subscriptions').select('status,period_end').eq('user_id',uid).maybeSingle(),
   db.from('onlyhost_accounts').select('status,terms_version,legal_capacity_confirmed,property_authority_confirmed,adult_production_understood').eq('user_id',uid).maybeSingle()
  ]);
  const adultVerified=Boolean(age.data?.[0]?.admitted_at);
  const hostEligible=hostAccount.data?.status==='active'&&hostAccount.data?.terms_version==='host-2026-11-17'&&
   hostAccount.data?.legal_capacity_confirmed===true&&hostAccount.data?.property_authority_confirmed===true&&
   hostAccount.data?.adult_production_understood===true;
  if(age.error||security.error||sub.error||hostAccount.error||
    !security.data||security.data.banned||security.data.suspended||!adultVerified&&!hostEligible)return err('Account unavailable',403);
  if(!hostEligible&&!security.data?.admin&&(!['active','trial'].includes(sub.data?.status)||(sub.data?.period_end&&Date.parse(sub.data.period_end)<=Date.now())))return err('Premium required',403);
 }
 const own=async(propertyId:unknown)=>{
  if(!uid||!uuid(propertyId))return null;
  const {data}=await db.from('properties').select('id,owner_id,timezone').eq('id',propertyId).eq('owner_id',uid).maybeSingle();
  return data;
 };
 const sync=async(connection:any)=>{
  if(!allowedUrl(connection.import_url,connection.provider))throw Error('Feed URL does not match an approved provider');
  const {data:venue}=await db.from('properties').select('timezone').eq('id',connection.property_id).maybeSingle();
  const bodyText=await boundedFeed(connection.import_url);
  const raw=parseEvents(bodyText,venue?.timezone||'UTC');
  const events=[];
  for(const entry of raw)events.push({uid_hash:await sha(connection.id+'|'+entry.uid),
   starts_at:entry.starts_at,ends_at:entry.ends_at});
  const {data,error}=await db.rpc('ccx_hosting_replace_calendar_blocks',{
   p_connection:connection.id,p_events:events
  });
  if(error)throw Error('Imported booking conflict or feed changed');
  await db.from('hosting_calendar_connections').update({
   status:'active',last_synced_at:new Date().toISOString(),last_error:null,
   last_successful_count:events.length,
   next_sync_at:new Date(Date.now()+connection.sync_interval_minutes*60000).toISOString(),
   last_feed_hash:await sha(bodyText)
  }).eq('id',connection.id);
  await db.from('hosting_calendar_job_audit').insert({
   connection_id:connection.id,status:'success',added_count:data?.synchronized||0,removed_count:data?.removed||0
  });
  return {success:true,count:events.length};
 };
 try{
 if(cron){
  const {data:due,error}=await db.from('hosting_calendar_connections')
   .select('id,property_id,provider,import_url,sync_interval_minutes').eq('sync_enabled',true)
   .lte('next_sync_at',new Date().toISOString()).limit(12);
  if(error)throw error;
  let success=0,failed=0;
  for(const connection of due||[]){
   const {data:claimed}=await db.from('hosting_calendar_connections')
    .update({next_sync_at:new Date(Date.now()+15*60000).toISOString()})
    .eq('id',connection.id).lte('next_sync_at',new Date().toISOString()).select('id').maybeSingle();
   if(!claimed)continue;
   try{await sync(connection);success++;}
   catch(e){
    failed++;
    await db.from('hosting_calendar_connections').update({
     status:'failed',last_error:'Calendar sync failed; verify feed or booking conflicts',
     next_sync_at:new Date(Date.now()+60*60000).toISOString()
    }).eq('id',connection.id);
    await db.from('hosting_calendar_job_audit').insert({
     connection_id:connection.id,status:'failure',error_kind:'Feed invalid or conflict'
    });
   }
  }
  return reply({success,failed});
 }
 if(action==='list'){
  const property=await own(body.property_id);if(!property)return err('Only host can manage calendars',403);
  const {data,error}=await db.from('hosting_calendar_connections')
   .select('id,provider,status,sync_enabled,last_synced_at,last_error,last_successful_count,next_sync_at')
   .eq('property_id',property.id).limit(30);
  if(error)throw error;
  return reply({items:data||[]});
 }
 if(action==='connect'){
  const property=await own(body.property_id);if(!property)return err('Only host can connect calendars',403);
  const provider=str(body.provider,30),source=str(body.import_url,1800);
  if(!['airbnb','vrbo','booking','other'].includes(provider)||!allowedUrl(source,provider))
   return err('External feed must use an approved HTTPS provider domain, without redirects');
  const {data,error}=await db.from('hosting_calendar_connections').upsert({
   property_id:property.id,provider,import_url:source,sync_enabled:true,status:'pending',
   next_sync_at:new Date().toISOString(),sync_interval_minutes:30
  },{onConflict:'property_id,provider'}).select('id,provider,status').single();
  if(error)throw error;
  return reply({item:data,note:'Connection saved. Feed sync requires scheduled job configuration.'});
 }
 if(action==='disconnect'){
  if(!uuid(body.id))return err('Connection ID required');
  const {data:existing}=await db.from('hosting_calendar_connections')
   .select('id,property_id').eq('id',body.id).maybeSingle();
  if(!existing||!await own(existing.property_id))return err('Connection unavailable',403);
  const {error}=await db.from('hosting_calendar_connections').delete().eq('id',existing.id);
  if(error)throw error;return reply({ok:true});
 }
 if(action==='sync_now'){
  if(!uuid(body.id))return err('Connection ID required');
  const {data:existing}=await db.from('hosting_calendar_connections')
   .select('id,property_id,provider,import_url,sync_enabled,sync_interval_minutes,last_synced_at')
   .eq('id',body.id).maybeSingle();
  if(!existing||!await own(existing.property_id))return err('Connection unavailable',403);
  if(!existing.sync_enabled)return err('Feed disabled',409);
  if(existing.last_synced_at&&Date.now()-Date.parse(existing.last_synced_at)<10*60000)return err('Wait ten minutes between manual imports',429);
  const result=await sync(existing);return reply(result);
 }
 if(action==='export_create'){
  const property=await own(body.property_id);if(!property)return err('Only host may export calendar',403);
  const value=new Uint8Array(32);crypto.getRandomValues(value);
  const token=btoa(String.fromCharCode(...value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const {data,error}=await db.from('hosting_calendar_export_tokens')
   .insert({property_id:property.id,token_hash:await sha(token)}).select('id').single();
  if(error)throw error;
  return reply({id:data.id,calendar_url:url+'/functions/v1/hosting-calendar?token='+token,
   warning:'Copy this private calendar URL now. Anybody with it can see busy times, not booking names or addresses.'});
 }
 if(action==='export_tokens'){
  const property=await own(body.property_id);if(!property)return err('Only host may manage export URLs',403);
  const {data,error}=await db.from('hosting_calendar_export_tokens')
   .select('id,created_at,revoked_at').eq('property_id',property.id).limit(30);
  if(error)throw error;return reply({items:data||[]});
 }
 if(action==='export_revoke'){
  if(!uuid(body.id))return err('Calendar token ID required');
  const {data:token}=await db.from('hosting_calendar_export_tokens')
   .select('id,property_id').eq('id',body.id).maybeSingle();
  if(!token||!await own(token.property_id))return err('Export token unavailable',403);
  const {error}=await db.from('hosting_calendar_export_tokens')
   .update({revoked_at:new Date().toISOString()}).eq('id',token.id);
  if(error)throw error;return reply({ok:true});
 }
 return err('Unknown calendar operation',404);
 }catch(e){console.error('hosting-calendar',action,String(e).slice(0,120));return err('Calendar operation failed',500);}
});
