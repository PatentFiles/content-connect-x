/**
 * Fail-closed static frontend → Supabase Edge Function action contract check.
 * This validates literal action names and retired routes, not actual permissions
 * or provider availability. Real verified accounts remain essential to E2E QA.
 */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,basename} from 'node:path';

const get=path=>readFileSync(path,'utf8');
const root='src/supabase';
const clients=readdirSync(root).filter(x=>/\.(jsx|js)$/.test(x));
const backend={
 hostingAction:'hosting-marketplace',
 hostingBusiness:'hosting-operations',
 hostingAgreement:'hosting-docusign',
 hostingCheckout:'hosting-ccbill',
 hostingAdvanced:'hosting-advanced',
 hostingProduction:'hosting-production',
 hostingCalendar:'hosting-calendar',
 platformAction:'platform-extras',
 productionAction:'production-manager'
};
const src=new Map();
for(const name of new Set([...Object.values(backend),'member-workflows','agreement-packets'])){
 const file='supabase/functions/'+name+'/index.ts';
 assert.ok(existsSync(file),'Missing backend function: '+name);
 src.set(name,get(file));
}
const allowed=new Map();
for(const [name,code] of src){
 const actions=new Set();
 for(const match of code.matchAll(/\bcase\s*['"]([^'"]+)['"]\s*:/g))actions.add(match[1]);
 for(const match of code.matchAll(/\b(?:payload\.)?action\s*(?:===|!==)\s*['"]([^'"]+)['"]/g))actions.add(match[1]);
 allowed.set(name,actions);
}
const errors=[];
let compared=0;
function check(path,fn,action){
 compared++;
 if(!allowed.get(fn)?.has(action))errors.push(path+': "'+action+'" not defined by '+fn);
}
for(const file of clients){
 const path=join(root,file),source=get(path);
 for(const [client,endpoint] of Object.entries(backend)){
  const pattern=new RegExp('\\b'+client+'\\s*\\(\\s*[\\x27\\x22]([^\\x27\\x22]+)[\\x27\\x22]','g');
  for(const hit of source.matchAll(pattern))check(file,endpoint,hit[1]);
 }
 if(file==='MemberWorkspace.jsx'){
  for(const hit of source.matchAll(/(?<!\.)\binvoke\s*\(\s*['"]([^'"]+)['"]/g))
   check(file,'member-workflows',hit[1]);
 }
 if(file==='AgreementPackets.jsx'){
  for(const hit of source.matchAll(/\bcall\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g)){
   if(allowed.has(hit[1]))check(file,hit[1],hit[2]);
  }
 }
 for(const hit of source.matchAll(/\.functions\.invoke\(\s*['"]([^'"]+)['"]/g)){
  const endpoint=hit[1];
  if(!existsSync('supabase/functions/'+endpoint+'/index.ts'))errors.push(file+': missing Edge Function '+endpoint);
 }
}
const app=get(root+'/SupabaseApp.jsx');
const member=get(root+'/MemberWorkspace.jsx');
const bootstrap=get(root+'/bootstrap.jsx');
assert.match(app,/DashboardHome/,'Dashboard module must be mounted in app');
assert.match(bootstrap,/brand-theme\.css/,'Production theme CSS must be loaded');
assert.doesNotMatch(app,/Supabase Preview|checkout\.stripe\.com|create-checkout/,'Outdated preview or Stripe frontend route still present');
assert.doesNotMatch(member,/book_property|create_property|respond_booking/,'Obsolete direct property flow still visible in premium workspace');
const gateway=get('supabase/functions/member-workflows/index.ts');
assert.ok((gateway.match(/This booking action moved to Hosting Marketplace/g)||[]).length===3,
 'Obsolete property write actions need server-side rejection');
if(errors.length)throw Error('Frontend/Edge action mismatch:\n'+errors.join('\n'));
process.stdout.write('PASS '+compared+' literal frontend/Edge actions and '+clients.length+' Supabase components\n');
