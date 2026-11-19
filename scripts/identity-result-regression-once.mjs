import fs from 'node:fs';
const change=(p,a,b)=>{const s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error('Missing anchor '+p+' '+a.slice(0,80));fs.writeFileSync(p,s.replace(a,b));};
const view='src/supabase/IdentityVerification.jsx';
change(view,'disabled={refreshing} onClick=',"disabled={refreshing||(locked&&status!=='processing')} onClick=");
// Do not present two competing restart controls for the same failed pilot.
change(view,"{['collecting','review_required','name_mismatch','retryable_error'].includes(status)&&<button", "{['collecting','review_required','name_mismatch','retryable_error'].includes(status)&&!(testing&&status==='review_required')&&<button");
const p='scripts/test-identity-onboarding-browser.mjs';
change(p,"if(action==='status'){if(f.error)throw Error(f.error);return structuredClone(f.response);}",`if(action==='status'){
  if(f.error)throw Error(f.error);
  const snapshot=structuredClone(f.response);
  if(f.deferStatus){f.deferStatus=false;return new Promise(resolve=>{window.__releaseStatus=()=>{window.__releaseStatus=null;resolve(snapshot);};});}
  return snapshot;
 }
 if(action==='submit'&&f.deferSubmit){
  f.response.session={...f.response.session,status:'processing',message:'Checking your ID and live capture.'};
  return new Promise(resolve=>{window.__finishSubmit=()=>{
   f.response.session={...f.response.session,status:'review_required',reason:'document_checks_incomplete',message:'Check complete. Your existing access is unchanged.',diagnostics:{engine_revision:'synthetic',document_fields_confident:false,document_cross_checked:false,face_matched:true,age_eligible:true}};
   resolve({session:structuredClone(f.response.session)});
  };});
 }`);
change(p,"}`;\ntry{",`}
window.__identityAction=identityAction;
export const identityUploadTo=(endpoint,id,kind,file,options)=>identityUpload(id,kind,file,options);
\`;\ntry{`);
change(p,"import Gate from './src/supabase/AgeGateOnboarding.jsx';const root=", "import Gate from './src/supabase/AgeGateOnboarding.jsx';import Pilot from './src/supabase/IdentityPilot.jsx';const root=");
change(p,"root.render(<Gate onReload={()=>window.__approval++} onSignOut={()=>window.__signout++}/>);","root.render(window.__fixture.pilot?<Pilot/>:<Gate onReload={()=>window.__approval++} onSignOut={()=>window.__signout++}/>);");
change(p,"b.onLoad({filter:/.*/,namespace:'fixture'},args=>",`b.onResolve({filter:/api\\/supabaseClient/},()=>({path:'pilotClient',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>`);
change(p,"contents:args.path==='identity'?mock:","contents:args.path==='pilotClient'?`export const supabase={functions:{invoke:async(name,{body})=>({data:{...await window.__identityAction(body.action,body),test_only:true,admission_granted:false},error:null})}};`:args.path==='identity'?mock:");
change(p," console.log(`PASS ${results.length} real React scenarios",` // The actual administrator pilot parent and capture child must agree after
 // a pending status request arrives later than a completed submit request.
 await mount(state({session:session('collecting',{uploaded:{front:true,back:true,selfie:true,capture:true}})}),{pilot:true,deferSubmit:true});
 await click('Check my identity and age');
 await evaluate('window.__fixture.deferStatus=true');
 await wait("typeof window.__releaseStatus==='function'",'automatic pending poll');
 await evaluate('window.__finishSubmit()');
 await wait("document.querySelector('[data-identity-result=review_required]')&&document.querySelector('#pilot-results')",'automatic completed pilot result');
 await evaluate('window.__releaseStatus()');
 await wait("!document.querySelector('#root').textContent.includes('Refreshing result…')",'late status settled');
 assert.equal(await evaluate("Boolean(document.querySelector('[data-identity-result=review_required]'))"),true);
 assert.equal(await evaluate(textIncludes('Checking your saved evidence now')),false);
 assert.equal(await evaluate('window.__approval'),0);
 await record('actual pilot result survives a late pending response without account approval');
 await evaluate('window.__fixture.deferStatus=true');await click('Check status');
 await wait(textIncludes('Refreshing result…'),'visible manual refresh');
 await evaluate('window.__releaseStatus()');await wait(textIncludes('Last result check:'),'visible result refresh confirmation');
 await record('manual status refresh has immediate visible feedback');
 await mount(state({session:session('processing')}),{pilot:true});
 await evaluate("window.__fixture.response.session={...window.__fixture.response.session,status:'approved',message:'Private test complete.',diagnostics:{engine_revision:'synthetic',face_matched:true,age_eligible:true}}");
 await wait(textIncludes('Private test passed'),'automatic pass with no status click');
 assert.equal(await evaluate('window.__approval'),0);await record('passing pilot result appears automatically and never admits a member');

 console.log(\`PASS \${results.length} real React scenarios`);
fs.unlinkSync('scripts/identity-result-regression-once.mjs');fs.unlinkSync('.github/workflows/identity-result-regression-once.yml');
console.log('Added actual pilot result-race and refresh feedback regression checks.');
