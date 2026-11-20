/** Central server-side OpenAI gateway for creator tools.
 * Browser supplies NO secret or trusted identity. Model output is advisory.
 * No automated sanctions, age approval, medical interpretations, signing or publication.
 */
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const interests=new Set(['behind_the_scenes','travel','photography','videography','editing','studio','outdoor','cosplay','fashion','boudoir','fetish','bdsm','kink','fitness','lifestyle','podcast','music','night_shoot','day_shoot','livestream']);
const actions=new Set(['status','bio','match_preferences','matches','ai_consent','scope_draft','contract_draft','scope_history','agent_scan','agent_flags','agent_review']);
const categories=new Set(['consent','safety','privacy','misrepresentation','content_rights','other']);
const severities=new Set(['low','medium','high','critical']);
const storedRoles=new Set(['creator','photographer','videographer','video_editor','studio','agent']);
async function dataOf(query){const {data,error}=await query;if(error)throw Error('Database temporarily unavailable');return data;}
async function bounded(req){
 if(Number(req.headers.get('content-length')||0)>15000)throw Error('TOO_LARGE');
 if(!req.body)return null;
 const reader=req.body.getReader(),parts=[];let n=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>15000)throw Error('TOO_LARGE');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(n);let i=0;for(const v of parts){bytes.set(v,i);i+=v.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{return null;}
}
function outputText(result){
 const parts=(result?.output||[]).flatMap(item=>item?.content||[])
  .filter(x=>x?.type==='output_text'&&typeof x.text==='string').map(x=>x.text);
 return parts.join('\n').trim().slice(0,10000)||String(result?.output_text||'').slice(0,10000).trim();
}
export function createCreatorAiHandler({authenticate,assurance=async()=>null,db,fetchImpl=fetch,env}){
 const callModel=async({instruction,input,jsonSchema=null})=>{
  const key=env.OPENAI_API_KEY;
  if(!key)return {error:'Set OPENAI_API_KEY in Supabase Edge Function secrets to enable AI tools.',status:503};
  const model=env.OPENAI_TEXT_MODEL||'gpt-6.2-astra';
  const request={model,instructions:instruction,input,
   max_output_tokens:1500,store:false,
   ...(jsonSchema?{text:{format:{type:'json_schema',name:'creator_safety_triage',schema:jsonSchema,strict:true}}}:{})};
  const response=await fetchImpl('https://api.openai.com/v1/responses',{
   method:'POST',headers:{'authorization':'Bearer '+key,'content-type':'application/json'},
   body:JSON.stringify(request),signal:AbortSignal.timeout(25000)
  });
  if(!response.ok)return {error:response.status===401?'OpenAI API key rejected. Verify the project secret.':
   'The AI service is temporarily unavailable.',status:503};
  const body=await response.json();
  if(body.status!=='completed'&&body.status!==undefined)return {error:'AI response incomplete. No draft or flag was saved.',status:503};
  const text=outputText(body);
  return text?{text,model}:{error:'No AI output returned.',status:503};
 };
 const logRun=async(actor,action,target=null)=>{
  const model=env.OPENAI_TEXT_MODEL||'gpt-6.2-astra';
  const {data,error}=await db.from('ccx_ai_agent_runs').insert({actor_id:actor,action,model,target_id:target,status:'started'})
   .select('id').single();
  if(error||!data)throw Error('AI audit unavailable');
  return data.id;
 };
 const finish=async(id,status,flags=0)=>{
  await dataOf(db.from('ccx_ai_agent_runs').update({status,completed_at:new Date().toISOString(),flag_count:flags}).eq('id',id));
 };
 const admitted=async uid=>{
  const [sec,ad]=await Promise.all([
   dataOf(db.from('account_security').select('admin,banned,suspended').eq('user_id',uid).maybeSingle()),
   dataOf(db.from('member_admissions').select('user_id').eq('user_id',uid).not('admitted_at','is',null).limit(1))
  ]);
  return sec&&!sec.banned&&!sec.suspended&&ad?.length?sec:null;
 };
 const projectMember=async(cid,uid)=>dataOf(db.from('collaboration_members').select('membership_role').eq('collaboration_id',cid).eq('user_id',uid).maybeSingle());
 const requireAllScopeConsent=async cid=>{
  const participants=await dataOf(db.from('collaboration_members').select('user_id,membership_role').eq('collaboration_id',cid).limit(30));
  if(!participants?.length)return null;
  const consents=await dataOf(db.from('ccx_ai_collaboration_consents').select('user_id,ai_scope_processing')
    .eq('collaboration_id',cid).in('user_id',participants.map(v=>v.user_id)));
  return participants.every(v=>consents?.some(c=>c.user_id===v.user_id&&c.ai_scope_processing===true))?participants:null;
 };
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return respond({error:'Method not allowed'},405);
  try{
   const user=await authenticate(req);
   if(!user?.id||user.is_anonymous)return respond({error:'Sign in required'},401);
   const body=await bounded(req);
   if(!body||typeof body!=='object'||Array.isArray(body)||!actions.has(body.action))return respond({error:'Invalid AI tool action'},400);
   const uid=user.id,security=await admitted(uid);
   if(!security)return respond({error:'Verified active account required'},403);
   const action=body.action;
   if(action==='status')return respond({configured:Boolean(env.OPENAI_API_KEY),model:env.OPENAI_TEXT_MODEL||'gpt-6.2-astra',
    capabilities:['bio','matches','scope_draft','contract_draft','agent_scan']});
   if(action==='match_preferences'){
    if(body.save!==true){
     const row=await dataOf(db.from('ccx_ai_match_preferences').select('opt_in,shared_interests').eq('user_id',uid).maybeSingle());
     return respond({item:{opt_in:row?.opt_in===true,shared_interests:row?.shared_interests||[]}});
    }
    if(typeof body.opt_in!=='boolean'||!Array.isArray(body.interests)||body.interests.length>20
       ||body.interests.some(v=>!interests.has(v))||new Set(body.interests).size!==body.interests.length)
     return respond({error:'Choose up to 20 approved optional interests'},400);
    const item={user_id:uid,opt_in:body.opt_in,shared_interests:body.opt_in?body.interests:[],updated_at:new Date().toISOString()};
    await dataOf(db.from('ccx_ai_match_preferences').upsert(item,{onConflict:'user_id'}));
    return respond({item:{opt_in:item.opt_in,shared_interests:item.shared_interests}});
   }
   if(action==='ai_consent'){
    if(!uuid(body.collaboration_id)||!await projectMember(body.collaboration_id,uid))return respond({error:'Project unavailable'},403);
    if(body.save===true){
     if(typeof body.opt_in!=='boolean')return respond({error:'Choose whether to share project scope with AI'},400);
     await dataOf(db.from('ccx_ai_collaboration_consents').upsert({
       collaboration_id:body.collaboration_id,user_id:uid,ai_scope_processing:body.opt_in,updated_at:new Date().toISOString()
      },{onConflict:'collaboration_id,user_id'}));
    }
    const row=await dataOf(db.from('ccx_ai_collaboration_consents').select('ai_scope_processing')
      .eq('collaboration_id',body.collaboration_id).eq('user_id',uid).maybeSingle());
    return respond({opt_in:row?.ai_scope_processing===true});
   }
   const adminOnly=['agent_scan','agent_flags','agent_review'].includes(action);
   if(adminOnly&&(security.admin!==true||await assurance(req)!=='aal2'))
    return respond({error:'Platform staff MFA authorization required'},403);
   if(action==='agent_flags'){
    const rows=await dataOf(db.from('ccx_ai_review_flags').select('id,run_id,subject_kind,subject_id,severity,category,redacted_summary,status,created_at')
      .eq('status','pending').order('created_at',{ascending:false}).limit(100));
    return respond({items:rows||[]});
   }
   if(action==='agent_review'){
    if(!uuid(body.id)||!['reviewed','dismissed'].includes(body.disposition))
     return respond({error:'Choose a review outcome'},400);
    const row=await dataOf(db.from('ccx_ai_review_flags').update({status:body.disposition,reviewed_by:uid,reviewed_at:new Date().toISOString()})
      .eq('id',body.id).eq('status','pending').select('id,status').maybeSingle());
    return row?respond({item:row}):respond({error:'Flag already handled'},409);
   }
   if(action==='scope_history'){
    if(!uuid(body.collaboration_id)||!await projectMember(body.collaboration_id,uid))
     return respond({error:'Project unavailable'},403);
    const records=await dataOf(db.from('ccx_ai_scope_drafts').select('id,collaboration_id,requested_by,suggested_scope,created_at,model')
      .eq('collaboration_id',body.collaboration_id).order('created_at',{ascending:false}).limit(30));
    return respond({items:records||[]});
   }
   const {count,error:countError}=await db.from('ccx_ai_agent_runs').select('id',{count:'exact',head:true})
    .eq('actor_id',uid).gte('created_at',new Date(Date.now()-86400000).toISOString());
   if(countError)return respond({error:'AI usage limit unavailable'},503);
   if((count||0)>=(adminOnly?30:12))return respond({error:'Daily AI request limit reached'},429);
   if(action==='bio'){
    if(typeof body.background!=='string'||body.background.trim().length<8||body.background.length>2000)
     return respond({error:'Describe your work and style in 8–2,000 characters'},400);
    const run=await logRun(uid,'bio');
    const result=await callModel({
     instruction:'You write concise professional adult-creator marketplace biographies. Write first person, confident and approachable, 100–170 words. Do not invent credentials, age, tested status, sexual orientation, consent, explicit acts, contact details or awards. This is an editable draft, not a verified identity statement.',
     input:body.background.trim()
    });
    await finish(run,result.error?'failed':'completed');
    return result.error?respond({error:result.error},result.status):respond({draft:result.text,run_id:run,note:'Review and edit before saving to your profile.'});
   }
   if(action==='matches'){
    const mine=await dataOf(db.from('ccx_ai_match_preferences').select('opt_in,shared_interests').eq('user_id',uid).maybeSingle());
    if(!mine?.opt_in||!mine.shared_interests?.length)return respond({items:[],note:'Opt in and select professional interests to receive recommendations.'});
    const candidates=await dataOf(db.from('ccx_ai_match_preferences').select('user_id,shared_interests').eq('opt_in',true).neq('user_id',uid).limit(200));
    const ids=(candidates||[]).map(v=>v.user_id);
    if(!ids.length)return respond({items:[]});
    const [profiles,blocks,admissions]=await Promise.all([
     dataOf(db.from('member_profiles').select('id,display_name,role_type,city,country').in('id',ids).limit(200)),
     dataOf(db.from('member_blocks').select('blocker_id,blocked_id').or('blocker_id.eq.'+uid+',blocked_id.eq.'+uid).limit(200)),
     dataOf(db.from('member_admissions').select('user_id').in('user_id',ids).not('admitted_at','is',null).limit(200))
    ]);
    const admittedIds=new Set((admissions||[]).map(v=>v.user_id));
    const blocked=new Set((blocks||[]).map(v=>v.blocker_id===uid?v.blocked_id:v.blocker_id));
    const items=(candidates||[]).filter(v=>admittedIds.has(v.user_id)&&!blocked.has(v.user_id)).flatMap(candidate=>{
     const shared=(candidate.shared_interests||[]).filter(v=>mine.shared_interests.includes(v));
     if(!shared.length)return [];
     const profile=(profiles||[]).find(p=>p.id===candidate.user_id);
     if(!profile)return [];
     return [{user_id:profile.id,display_name:profile.display_name,role_type:profile.role_type,city:profile.city,country:profile.country,shared_interests:shared}];
    }).sort((a,b)=>b.shared_interests.length-a.shared_interests.length).slice(0,8);
    if(!items.length)return respond({items:[],note:'No opt-in members share your selected interests yet.'});
    // Only opt-in shared tags and professional public fields reach OpenAI.
    const run=await logRun(uid,'matches');
    const context=items.map((v,i)=>({index:i+1,role:v.role_type,city:v.city,shared_tags:v.shared_interests}));
    const result=await callModel({
     instruction:'You write brief, neutral professional collaboration recommendation notes. Mention only user-selected shared interests, complementary professional role, logistics. Do not make assertions about intimate identity, sexual orientation, race, medical status, attractiveness, or suitability for consent. One short paragraph for the whole set, no rankings or claims of compatibility certainty.',
     input:JSON.stringify({viewer_interests:mine.shared_interests,candidates:context})
    });
    await finish(run,result.error?'failed':'completed');
    return result.error?respond({error:result.error},result.status):respond({items,note:result.text,run_id:run});
   }
   if(['scope_draft','contract_draft'].includes(action)){
    if(!uuid(body.collaboration_id)||!await projectMember(body.collaboration_id,uid))
     return respond({error:'Project unavailable'},403);
    const participants=await requireAllScopeConsent(body.collaboration_id);
    if(!participants)return respond({error:'Every participant must opt in before private project details are processed by AI.'},409);
    const plan=await dataOf(db.from('ccx_collaboration_plans').select('scope_of_work,deliverables,usage_rights,venue_label,starts_at,ends_at')
      .eq('collaboration_id',body.collaboration_id).maybeSingle());
    if(!plan)return respond({error:'Save a production plan first'},409);
    const collaboration=await dataOf(db.from('collaborations').select('id,title').eq('id',body.collaboration_id).maybeSingle());
    const notes=await dataOf(db.from('ccx_collaboration_notes').select('note_text')
      .eq('collaboration_id',body.collaboration_id).order('created_at',{ascending:false}).limit(15));
    let role=body.participant_role;
    if(action==='contract_draft'){
     if(!storedRoles.has(role))return respond({error:'Choose a participant role'},400);
     const matching=participants.some(p=>p.membership_role===role);
     if(!matching)return respond({error:'That role is not a current collaborator'},409);
    }
    const run=await logRun(uid,action==='contract_draft'?'scope_draft':'scope_draft',body.collaboration_id);
    const input=JSON.stringify({project:collaboration?.title,plan,notes:(notes||[]).map(x=>x.note_text.slice(0,1000)),participant_role:action==='contract_draft'?role:null});
    const result=await callModel({
     instruction:action==='contract_draft'
      ?'Create a role-specific professional agreement DRAFT with responsibilities, deliverables, schedule, payment placeholders, rights options, safety/consent, cancellation and revision process. Do not invent parties, age verification, medical results, signed consent or binding terms. Mark every unresolved term clearly for mutual discussion and independent legal review. No signatures.'
      :'Write a proposed project scope from the existing plan and notes. Identify open questions, agreed vs unconfirmed points, deliverables, usage rights choices and deadlines. Do not invent consent. This draft cannot alter the signed project.',
     input
    });
    await finish(run,result.error?'failed':'completed');
    if(result.error)return respond({error:result.error},result.status);
    const row=await dataOf(db.from('ccx_ai_scope_drafts').insert({
     collaboration_id:body.collaboration_id,requested_by:uid,suggested_scope:result.text,model:result.model
    }).select('id,created_at').single());
    return respond({draft:result.text,id:row.id,created_at:row.created_at,
      note:'AI draft only. All parties must review and explicitly approve their own terms before a provider can collect signatures.'});
   }
   if(action==='agent_scan'){
    if(!uuid(body.subject_id)||!['post','profile'].includes(body.subject_kind))return respond({error:'Select a public profile or approved public post'},400);
    let content='';
    if(body.subject_kind==='post'){
     const post=await dataOf(db.from('community_posts').select('body,status,audience').eq('id',body.subject_id).maybeSingle());
     if(post?.status!=='published'||post?.audience!=='verified')return respond({error:'Only approved community posts may be scanned'},403);
     content=post.body||'';
    }else{
     const p=await dataOf(db.from('member_profiles').select('display_name,bio').eq('id',body.subject_id).maybeSingle());
     if(!p)return respond({error:'Profile not found'},404);
     content=p.bio||'';
    }
    if(content.trim().length<3)return respond({error:'No text to review'},400);
    const run=await logRun(uid,'safety_scan',body.subject_id);
    const schema={type:'object',additionalProperties:false,properties:{
      issues:{type:'array',items:{type:'object',additionalProperties:false,properties:{
        category:{type:'string',enum:[...categories]},severity:{type:'string',enum:[...severities]},summary:{type:'string'}
      },required:['category','severity','summary']}},
      rationale:{type:'string'}
    },required:['issues','rationale']};
    const result=await callModel({
     instruction:'Safety triage of public professional marketplace TEXT only. Flag concrete policy concerns such as nonconsensual sharing, threats, privacy violations, misrepresentation or rights issues. No risk scoring of people or identity traits. Sexual orientation, consensual adult interests and kink terminology alone must NEVER be flagged. Do not infer wrongdoing from community membership. All findings are uncertain, for human review only.',
     input:content.slice(0,4000),jsonSchema:schema
    });
    if(result.error){await finish(run,'failed');return respond({error:result.error},result.status);}
    let parsed;try{parsed=JSON.parse(result.text);}catch{await finish(run,'failed');return respond({error:'Unable to interpret AI flag review'},503);}
    if(!Array.isArray(parsed.issues)){await finish(run,'failed');return respond({error:'Invalid AI review result'},503);}
    let count=0;
    for(const issue of parsed.issues.slice(0,5)){
     if(!categories.has(issue.category)||!severities.has(issue.severity))continue;
     await dataOf(db.from('ccx_ai_review_flags').insert({run_id:run,subject_kind:body.subject_kind,
      subject_id:body.subject_id,category:issue.category,severity:issue.severity,
      redacted_summary:String(issue.summary||'').slice(0,1000),status:'pending'}));
     count++;
    }
    await finish(run,'completed',count);
    return respond({run_id:run,flags_created:count,
      note:'Advisory flags entered the private human-review queue. No member was penalized or blocked.'});
   }
   return respond({error:'Unknown action'},400);
  }catch(error){
   if(error?.message==='TOO_LARGE')return respond({error:'AI request too large'},413);
   return respond({error:'Creator AI could not complete this request. No signed agreements or account decisions were changed.'},503);
  }
 };
}
