"""One-time, branch-scoped source repair. Every old anchor is asserted before editing."""
import os,re
from pathlib import Path
assert os.environ.get('GITHUB_REF_NAME')=='fix/custom-dashboard-workflow-access-20261117'
changed=[]
def edit(path,fn):
 p=Path(path);old=p.read_text();new=fn(old)
 if new!=old:p.write_text(new);changed.append(path)
def once(text,old,new):
 assert text.count(old)==1, f'Expected exactly one source anchor: {old[:120]}'
 return text.replace(old,new,1)
def app(s):
 s=once(s,"import React, { useCallback, useEffect, useState } from 'react';","import React, { useCallback, useEffect, useRef, useState } from 'react';")
 s=once(s,"import {isModuleEnabled} from './featureModules.mjs';","import ModuleAccessBoundary from './ModuleAccessBoundary';")
 old="""  const [visibleFeatures,setVisibleFeatures] = useState(null);
  const refreshFeatureFlags=useCallback(async()=>{
    const result=await platformAction('get_feature_flags');
    setVisibleFeatures(result.flags||{});
  },[]);"""
 new="""  const [visibleFeatures,setVisibleFeatures] = useState(null);
  const [featureAccess,setFeatureAccess] = useState({});
  const [featureStatus,setFeatureStatus] = useState('loading');
  const [featureError,setFeatureError] = useState('');
  const featureGeneration=useRef(0);
  const refreshFeatureFlags=useCallback(async()=>{
    const generation=++featureGeneration.current;
    setFeatureStatus('loading');setFeatureError('');
    try{
      const result=await platformAction('get_feature_flags');
      if(generation!==featureGeneration.current)return;
      setVisibleFeatures(result.flags);setFeatureAccess(result.access||{});setFeatureStatus('ready');
    }catch(failure){
      if(generation!==featureGeneration.current)return;
      setVisibleFeatures(null);setFeatureAccess({});setFeatureStatus('error');
      setFeatureError(failure.message||'Unable to check module access.');
    }
  },[]);"""
 s=once(s,old,new)
 s=once(s,"const approved = isAdmin || (verification?.status", "// Administrator shell access is not independent age verification.\n  const approved = (verification?.status")
 s=once(s,"if(user&&!approved)return <AgeGateOnboarding", "if(user&&!approved&&!isAdmin)return <AgeGateOnboarding")
 s=once(s,"if(!approved){setVisibleFeatures(null);return;}","if(!user?.id){featureGeneration.current++;setVisibleFeatures(null);setFeatureAccess({});setFeatureStatus('loading');return;}")
 s=once(s,"""    const load=()=>{void refreshFeatureFlags().catch(()=>{
      if(active)setVisibleFeatures({});
    });};""","""    const load=()=>{if(active)void refreshFeatureFlags();};""")
 s=once(s,"return()=>{active=false;window.removeEventListener('focus',load);window.clearInterval(interval);};\n  },[approved,paid,refreshFeatureFlags]);","return()=>{active=false;featureGeneration.current++;window.removeEventListener('focus',load);window.clearInterval(interval);};\n  },[user?.id,approved,paid,refreshFeatureFlags]);")
 pattern=r"</div>:approved&&!isModuleEnabled\(tab,visibleFeatures\)\?<section[\s\S]+?</section>:<>"
 replacement="</div>:<ModuleAccessBoundary tab={tab} flags={visibleFeatures} access={featureAccess} status={featureStatus} error={featureError} verified={approved} onRetry={refreshFeatureFlags} onNavigate={navigateInWorkspace}>"
 s,n=re.subn(pattern,lambda m:replacement,s,count=1);assert n==1,'Module boundary anchor missing'
 s=once(s,"</>}</OriginalShell>;","</ModuleAccessBoundary>}</OriginalShell>;")
 s=once(s,"<MemberWorkspace key={tab} user={user} paid={paid} flags={visibleFeatures||{}}","<MemberWorkspace key={tab} user={user} paid={paid} flags={visibleFeatures||{}} access={featureAccess} onNavigate={navigateInWorkspace} onAccessRefresh={refreshFeatureFlags}")
 return s
edit('src/supabase/SupabaseApp.jsx',app)
def shell(s):
 s=once(s,".select('id',{count:'exact',head:true}).eq('user_id',user.id)",".select('id',{count:'exact',head:true}).eq('recipient_id',user.id)")
 s=once(s,"Notifications:'notifications',AvailabilitySchedule:'schedule',","AccountSecurity:'account-security',Notifications:'notifications',AvailabilitySchedule:'schedule',")
 s=once(s,"notifications:'Notifications',schedule:'AvailabilitySchedule',","'account-security':'AccountSecurity',notifications:'Notifications',schedule:'AvailabilitySchedule',")
 return s
edit('src/supabase/OriginalShell.jsx',shell)
def member(s):
 s=once(s,"import {isModuleEnabled} from './featureModules.mjs';","import {isModuleEnabled,featureForTab} from './featureModules.mjs';\nimport ModuleAccessBoundary from './ModuleAccessBoundary';\nimport MemberPicker from './MemberPicker';\nimport {functionErrorMessage} from './apiErrors.mjs';")
 s=once(s,"export default function MemberWorkspace({user,flags={},paid=false,initialSection='collaborations'})", "export default function MemberWorkspace({user,flags={},access={},paid=false,initialSection='collaborations',onNavigate=()=>{},onAccessRefresh=()=>{}})")
 s=once(s,"  const [content,setContent]=useState('');","  const [content,setContent]=useState('');\n  const threadSequence=useRef(0);\n  const selectedRef=useRef('');\n  selectedRef.current=selected;")
 s=once(s,"if(invokeError||data?.error)throw new Error(data?.error||invokeError?.message||'Operation failed');","if(invokeError||data?.error)throw new Error(await functionErrorMessage(invokeError,data,'Operation failed'));")
 s=once(s,"  const refresh=useCallback(async(currentSection=section)=>{\n    setWorking(true);setError('');", "  const refresh=useCallback(async(currentSection=section)=>{\n    const prerequisite=access[featureForTab(currentSection)]?.reason;\n    if(prerequisite&&prerequisite!=='ready'){setItems([]);setSecondary([]);setWorking(false);setError('');return;}\n    setWorking(true);setError('');")
 s=once(s,"setItems(primaryData.items||[]);setSecondary(secondData.items||[]);","setItems(primaryData.items||[]);if(currentSection==='contracts')setSecondary(secondData.items||[]);")
 s=once(s,"  },[invoke,section]);","  },[invoke,section,access]);")
 s=once(s,"  useEffect(()=>{refresh(section); if(section!=='contracts')setSelected('');},[section,refresh]);", """  useEffect(()=>{void refresh(section);if(section!=='contracts'){threadSequence.current++;setSelected('');setSecondary([]);}},[section,refresh]);
  useEffect(()=>{
    if(!['messages','connections','invitations','notifications'].includes(section))return;
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh(section);},20000);
    return()=>window.clearInterval(timer);
  },[section,refresh]);
  useEffect(()=>()=>{threadSequence.current++;if(stopTypingRef.current)clearTimeout(stopTypingRef.current);},[]);""")
 s=once(s,"""  const chooseConversation=async(id)=>{
    setSelected(id);setWorking(true);setError('');
    try{
      const result=await invoke('list_messages',{conversation_id:id});
      setSecondary(result.items||[]);
      await invoke('mark_conversation_read',{conversation_id:id});
    }catch(e){setError(e.message);}finally{setWorking(false);}
  };""", """  const chooseConversation=async(id)=>{
    const generation=++threadSequence.current;
    if(selectedRef.current!==id)setSecondary([]);
    selectedRef.current=id;setSelected(id);setWorking(true);setError('');
    try{
      const result=await invoke('list_messages',{conversation_id:id});
      if(generation!==threadSequence.current)return;
      setSecondary(result.items||[]);
      await invoke('mark_conversation_read',{conversation_id:id});
    }catch(e){if(generation===threadSequence.current)setError(e.message);}
    finally{if(generation===threadSequence.current)setWorking(false);}
  };""")
 s=once(s,'<input className={input} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Verified member UUID"/>','<MemberPicker userId={user.id} value={target} onChange={setTarget} disabled={working} label="Invite a member"/>')
 s=once(s,'<input className={input} value={target} onChange={e=>setTarget(e.target.value)} placeholder="Verified member ID"/>','<MemberPicker userId={user.id} value={target} onChange={setTarget} disabled={working} label="Find a person"/>')
 s=once(s,'<input className={input} placeholder="Verified member UUID" value={target} onChange={e=>setTarget(e.target.value)} required/>','<MemberPicker userId={user.id} value={target} onChange={setTarget} scope="connections" disabled={working} label="Choose a friend"/>')
 s=once(s,'<textarea className={input} placeholder="2–9 mutually connected member IDs, separated by commas" rows={2} required value={groupPeople} onChange={e=>setGroupPeople(e.target.value)}/>','<MemberPicker userId={user.id} value={groupPeople} onChange={setGroupPeople} scope="connections" multiple disabled={working} label="Choose 2–9 friends"/>')
 anchor="    {section==='collaborations'&&<div"
 s=once(s,anchor,"    <ModuleAccessBoundary tab={section} flags={flags} access={access} status=\"ready\" verified onRetry={onAccessRefresh} onNavigate={onNavigate}>\n"+anchor)
 tail="  </div>;\n}"
 assert s.endswith(tail+'\n') or s.endswith(tail)
 s=s.rsplit(tail,1)[0]+"    </ModuleAccessBoundary>\n"+tail+'\n'
 return s
edit('src/supabase/MemberWorkspace.jsx',member)
def discovery(s):
 s=once(s,"import {supabase} from '@/api/supabaseClient';","import {supabase} from '@/api/supabaseClient';\nimport {functionErrorMessage} from './apiErrors.mjs';")
 old="if(directoryError||data?.error)throw Error(data?.error||directoryError?.message||'Directory unavailable');"
 s=once(s,old,"if(directoryError||data?.error)throw Error(await functionErrorMessage(directoryError,data,'Directory unavailable'));")
 return s
edit('src/supabase/CreatorDiscovery.jsx',discovery)
def tests(s):
 s=once(s,"test('unverified users see only non-dismissable onboarding and verified users are checked by Edge'", "test('unverified members see onboarding; admin shell preview is not age verification'")
 s=once(s,r"assert.match(app,/if\(user&&!approved\)return <AgeGateOnboarding/);",r"assert.match(app,/if\(user&&!approved&&!isAdmin\)return <AgeGateOnboarding/);"+"\n assert.doesNotMatch(app,/const approved = isAdmin/);\n assert.match(app,/ModuleAccessBoundary tab=\{tab\}/);")
 return s
edit('tests/membership-policy.test.mjs',tests)
def ci(s):
 anchor='      - name: Mobile keyboard selection tests\n'
 return once(s,anchor,"      - name: Saved dashboards and module access states\n        run: node --test tests/dashboard-access.test.mjs\n"+anchor)
edit('.github/workflows/frontend-quality.yml',ci)
# Restore the SDK CORS header contract on the existing authenticated gateway.
# No authorization checks, bodies, private records or provider gates are changed.
def cors(s):
 return once(s,"'Access-Control-Allow-Headers':'authorization, apikey, content-type',","'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',")
edit('supabase/functions/member-workflows/index.ts',cors)
print('Changed only these reviewed files:')
for path in changed:print(path)
