/** Privacy-first travel and collaboration tools, using only trusted JWT-derived actors.
 * Exact travel addresses and medical test results are never read or returned.
 */
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const actions=new Set(['travel_list','travel_save','travel_remove','notes_list','notes_add','testing_get','testing_save','testing_check']);
const dateValue=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'));
const errorMessage=e=>e?.message||'Unknown database problem';
async function bounded(req){
 if(Number(req.headers.get('content-length')||0)>12000)throw Error('too_large');
 if(!req.body)return null;
 const reader=req.body.getReader(),chunks=[];let n=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>12000)throw Error('too_large');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}
async function get(q){const {data,error}=await q;if(error)throw Error(error.message);return data;}
export function createCreatorExtensionsHandler({authenticate,db}){
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  try{
   const user=await authenticate(req);
   if(!user?.id||user.is_anonymous)return reply({error:'Sign in required'},401);
   const body=await bounded(req);
   if(!body||typeof body!=='object'||Array.isArray(body)||!actions.has(body.action))
    return reply({error:'Invalid tool action'},400);
   const actor=user.id;
   const [security,admissions]=await Promise.all([
    get(db.from('account_security').select('banned,suspended').eq('user_id',actor).maybeSingle()),
    get(db.from('member_admissions').select('admitted_at').eq('user_id',actor).not('admitted_at','is',null).limit(1))
   ]);
   if(!admissions?.length||!security||security.banned||security.suspended)
    return reply({error:'Verified active membership required'},403);
   const action=body.action;
   if(action.startsWith('travel_')){
    const target=action==='travel_list'&&uuid(body.user_id)?body.user_id:actor;
    if(action==='travel_list'){
     if(target!==actor){
      const [other,blocked,otherSecurity]=await Promise.all([
       get(db.from('member_admissions').select('admitted_at').eq('user_id',target).not('admitted_at','is',null).limit(1)),
       get(db.from('member_blocks').select('blocker_id').or('and(blocker_id.eq.'+actor+',blocked_id.eq.'+target+'),and(blocker_id.eq.'+target+',blocked_id.eq.'+actor+')').limit(1)),
       get(db.from('account_security').select('banned,suspended').eq('user_id',target).maybeSingle())
      ]);
      if(!other?.length||blocked?.length||!otherSecurity||otherSecurity.banned||otherSecurity.suspended)return reply({items:[]});
     }
     const records=await get(db.from('ccx_profile_travel')
      .select('id,user_id,entry_type,city,state,country,starts_on,ends_on,visibility,note')
      .eq('user_id',target).gte('ends_on',new Date(Date.now()-86400000).toISOString().slice(0,10))
      .order('starts_on',{ascending:true}).limit(60));
     if(target===actor)return reply({items:records||[]});
     const friends=await get(db.from('member_connection_requests').select('id').eq('status','accepted')
      .or('and(requester_id.eq.'+actor+',recipient_id.eq.'+target+'),and(requester_id.eq.'+target+',recipient_id.eq.'+actor+')').limit(1));
     const allowed=(records||[]).filter(v=>v.visibility==='verified'||(v.visibility==='friends'&&friends?.length));
     return reply({items:allowed.map(({id,entry_type,city,state,country,starts_on,ends_on})=>({id,entry_type,city,state,country,starts_on,ends_on}))});
    }
    if(action==='travel_remove'){
     if(!uuid(body.id))return reply({error:'Select a travel entry'},400);
     const row=await get(db.from('ccx_profile_travel').delete().eq('id',body.id).eq('user_id',actor).select('id').maybeSingle());
     return reply({removed:Boolean(row)});
    }
    const v=body.item;
    if(!v||typeof v!=='object'||!['travel','available','unavailable'].includes(v.entry_type)
      ||!['only_me','friends','verified'].includes(v.visibility)||!dateValue(v.starts_on)||!dateValue(v.ends_on)
      ||Date.parse(v.ends_on)<Date.parse(v.starts_on)||
      (Date.parse(v.ends_on)-Date.parse(v.starts_on))>365*86400000
      ||typeof v.city!=='string'||v.city.trim().length<2||v.city.length>120
      ||typeof v.country!=='string'||v.country.trim().length<2||v.country.length>100
      ||typeof v.state!=='string'||v.state.length>100||typeof v.note!=='string'||v.note.length>250)
     return reply({error:'Enter a valid city, country, date range and privacy option'},400);
    const payload={user_id:actor,entry_type:v.entry_type,city:v.city.trim(),state:v.state.trim(),
     country:v.country.trim(),starts_on:v.starts_on,ends_on:v.ends_on,visibility:v.visibility,note:v.note.trim(),updated_at:new Date().toISOString()};
    if(v.id&&!uuid(v.id))return reply({error:'Invalid travel entry'},400);
    if(!v.id){
     const {count,error:countError}=await db.from('ccx_profile_travel').select('id',{count:'exact',head:true}).eq('user_id',actor);
     if(countError)return reply({error:'Travel entry limit unavailable'},503);
     if((count||0)>=100)return reply({error:'Travel entry limit reached'},429);
    }
    const result=v.id
     ?await get(db.from('ccx_profile_travel').update(payload).eq('id',v.id).eq('user_id',actor).select('id').maybeSingle())
     :await get(db.from('ccx_profile_travel').insert(payload).select('id').single());
    return reply({item:{id:result?.id}},v.id?200:201);
   }
   const cid=body.collaboration_id;
   if(!uuid(cid))return reply({error:'Select an authorized collaboration'},400);
   const member=await get(db.from('collaboration_members').select('user_id').eq('collaboration_id',cid).eq('user_id',actor).maybeSingle());
   if(!member)return reply({error:'Collaboration unavailable'},403);
   if(action==='notes_list'){
    const rows=await get(db.from('ccx_collaboration_notes')
     .select('id,collaboration_id,author_id,note_kind,note_text,created_at')
     .eq('collaboration_id',cid).order('created_at',{ascending:true}).limit(200));
    return reply({items:rows||[]});
   }
   if(action==='notes_add'){
    if(typeof body.note_text!=='string'||body.note_text.trim().length<2||body.note_text.length>5000)
     return reply({error:'Enter a project note between 2 and 5000 characters'},400);
    const row=await get(db.from('ccx_collaboration_notes').insert({
     collaboration_id:cid,author_id:actor,note_kind:'manual',note_text:body.note_text.trim()
    }).select('id,author_id,note_kind,note_text,created_at').single());
    return reply({item:row,note:'Saved to the private project history. Notes do not amend signed contracts.'},201);
   }
   const collaboration=await get(db.from('collaborations')
    .select('id,creator_id,status,requires_work_clearance').eq('id',cid).maybeSingle());
   if(!collaboration)return reply({error:'Collaboration unavailable'},403);
   if(action==='testing_save'){
    if(collaboration.creator_id!==actor||['completed','cancelled','archived'].includes(collaboration.status))
     return reply({error:'Only the active project organizer may edit testing requirements'},403);
    if(typeof body.required!=='boolean'||!Number.isInteger(body.freshness_days)||body.freshness_days<1||body.freshness_days>60
      ||(body.deadline&&(!Number.isFinite(Date.parse(body.deadline))||Math.abs(Date.parse(body.deadline)-Date.now())>366*86400000)))
     return reply({error:'Invalid testing policy'},400);
    const signed=await get(db.from('contracts').select('id').eq('collaboration_id',cid).in('status',['signed','executed','completed']).limit(1));
    if(signed?.length)return reply({error:'A signed agreement cannot have its testing policy changed without a new amended agreement'},409);
    const payload={collaboration_id:cid,required:body.required,
     freshness_days:body.freshness_days,verification_deadline:body.deadline||null,updated_by:actor,updated_at:new Date().toISOString()};
    await get(db.from('ccx_collaboration_testing_policy').upsert(payload,{onConflict:'collaboration_id'}));
    await get(db.from('collaborations').update({requires_work_clearance:body.required}).eq('id',cid).eq('creator_id',actor));
    return reply({policy:payload,note:'Requirement saved. Contract preparation still requires current independently verified status for every participant.'});
   }
   const policy=await get(db.from('ccx_collaboration_testing_policy')
    .select('required,verification_deadline,freshness_days,updated_at').eq('collaboration_id',cid).maybeSingle());
   const required=policy?.required??collaboration.requires_work_clearance===true;
   if(action==='testing_get')return reply({policy:{required,verification_deadline:policy?.verification_deadline||null,freshness_days:policy?.freshness_days||14},
    organizer:collaboration.creator_id===actor});
   if(action==='testing_check'){
    const members=await get(db.from('collaboration_members').select('user_id').eq('collaboration_id',cid).limit(30));
    if(!required)return reply({required:false,ready:true,participants:members?.length||0});
    const ids=(members||[]).map(v=>v.user_id);
    if(!ids.length)return reply({required:true,ready:false,participants:0});
    const [clearances,consents]=await Promise.all([
     get(db.from('performer_work_clearances').select('user_id,clearance_confirmed,expires_at').in('user_id',ids)),
     get(db.from('ccx_clearance_share_consents').select('user_id,revoked_at').eq('collaboration_id',cid).in('user_id',ids))
    ]);
    const opted=new Set((consents||[]).filter(v=>!v.revoked_at).map(v=>v.user_id));
    const ready=ids.every(id=>{const row=(clearances||[]).find(x=>x.user_id===id);
     return opted.has(id)&&row?.clearance_confirmed===true&&row.expires_at&&Date.parse(row.expires_at)>Date.now()
 ;});
    return reply({required:true,ready,participants:ids.length,
      deadline:policy?.verification_deadline||null,
      deadline_passed:Boolean(policy?.verification_deadline&&Date.parse(policy.verification_deadline)<Date.now()&&!ready)});
   }
   return reply({error:'Unknown action'},400);
  }catch(error){
   if(error?.message==='too_large')return reply({error:'Request too large'},413);
   return reply({error:'Private collaboration tools are unavailable. No changes were confirmed.'},503);
  }
 };
}
