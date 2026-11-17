/** Static frontend/Edge contract checks; runtime authorization is tested separately. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {ROLE_ROUTES} from '../src/supabase/roleNavigationData.mjs';
const get=path=>readFileSync(path,'utf8');
const root='src/supabase';
const clients=readdirSync(root).filter(x=>/\.(jsx|js)$/.test(x));
const backend={hostingAction:'hosting-marketplace',hostingBusiness:'hosting-operations',hostingAgreement:'hosting-docusign',hostingCheckout:'hosting-ccbill',hostingAdvanced:'hosting-advanced',hostingProduction:'hosting-production',hostingCalendar:'hosting-calendar',platformAction:'platform-extras',productionAction:'production-manager'};
const src=new Map();
for(const name of new Set([...Object.values(backend),'member-workflows','agreement-packets'])){const file='supabase/functions/'+name+'/index.ts';assert.ok(existsSync(file),'Missing backend function: '+name);src.set(name,get(file));}
const allowed=new Map();
for(const [name,code] of src){const actions=new Set();for(const match of code.matchAll(/\bcase\s*['"]([^'"]+)['"]\s*:/g))actions.add(match[1]);for(const match of code.matchAll(/\b(?:payload\.)?action\s*(?:===|!==)\s*['"]([^'"]+)['"]/g))actions.add(match[1]);allowed.set(name,actions);}
const errors=[];let compared=0;
function check(path,fn,action){compared++;if(!allowed.get(fn)?.has(action))errors.push(path+': "'+action+'" not defined by '+fn);}
for(const file of clients){const source=get(join(root,file));for(const [client,endpoint] of Object.entries(backend)){const pattern=new RegExp('\\b'+client+'\\s*\\(\\s*[\\x27\\x22]([^\\x27\\x22]+)[\\x27\\x22]','g');for(const hit of source.matchAll(pattern))check(file,endpoint,hit[1]);}if(file==='MemberWorkspace.jsx'){for(const hit of source.matchAll(/(?<!\.)\binvoke\s*\(\s*['"]([^'"]+)['"]/g))check(file,'member-workflows',hit[1]);}if(file==='AgreementPackets.jsx'){for(const hit of source.matchAll(/\bcall\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g)){if(allowed.has(hit[1]))check(file,hit[1],hit[2]);}}for(const hit of source.matchAll(/\.functions\.invoke\(\s*['"]([^'"]+)['"]/g)){if(!existsSync('supabase/functions/'+hit[1]+'/index.ts'))errors.push(file+': missing Edge Function '+hit[1]);}}
const app=get(root+'/SupabaseApp.jsx'),member=get(root+'/MemberWorkspace.jsx'),bootstrap=get(root+'/bootstrap.jsx');
assert.match(app,/OriginalRoleDashboard/,'Original dashboards must be mounted');assert.match(app,/OriginalShell/,'Original sidebar/mobile shell must be mounted');
const pricingView=get(root+'/PublicPricing.jsx'),originalShell=get(root+'/OriginalShell.jsx');
assert.match(app,/if\(!user&&pricingPage\)/,'Public pricing must remain independent');assert.match(app,/href="\/pricing"/,'Public pricing link missing');assert.match(app,/PublicPricing signedIn/,'Member pricing missing');
assert.match(app,/\/content_conect_hero\.png/,'Desktop hero must be preserved');assert.match(app,/ContentConnectX__Create,_Collaborate,_Grow\.png/,'Mobile hero must be preserved');
assert.match(pricingView,/Free Membership/);assert.match(pricingView,/membership_plan_catalog/);assert.match(pricingView,/checkout opens after approved billing is connected/);
assert.match(originalShell,/hidden w-64 flex-col border-r md:flex/,'Original fixed sidebar required');assert.match(originalShell,/aria-label="Open navigation menu"/);assert.match(originalShell,/aria-label="Mobile navigation"/);assert.match(originalShell,/aria-label="Sign out"/);assert.doesNotMatch(originalShell,/Sign Out<\/button>[\s\S]*<header/);
// The user explicitly moved Host management to OnlyHost. Assert the six CCX
// roles and the restored routes directly, rather than matching JSX formatting.
for(const role of ['creator','agent','studio','photographer','videographer','video_editor']){assert.ok(ROLE_ROUTES[role],'Missing role '+role);for(const path of ['Discovery','Search','Favorites','Properties','Profile','Settings'])assert.ok(ROLE_ROUTES[role].includes(path),role+' missing '+path);}
assert.equal(ROLE_ROUTES.host,undefined,'Host must not be a CCX dashboard role');
assert.ok(ROLE_ROUTES.agent.includes('Roster')&&ROLE_ROUTES.studio.includes('Roster'));
for(const role of ['photographer','videographer','video_editor'])assert.ok(ROLE_ROUTES[role].includes('Portfolio'));
assert.ok(!app.includes('@base44/sdk')&&!app.includes('base44.entities'),'No retired Base44 backend');assert.match(bootstrap,/brand-theme\.css/);assert.doesNotMatch(app,/Supabase Preview|checkout\.stripe\.com|create-checkout/);assert.doesNotMatch(member,/book_property|create_property|respond_booking/);
const gateway=get('supabase/functions/member-workflows/index.ts');assert.ok((gateway.match(/This booking action moved to Hosting Marketplace/g)||[]).length===3);
if(errors.length)throw Error('Frontend/Edge action mismatch:\n'+errors.join('\n'));
process.stdout.write('PASS '+compared+' literal frontend/Edge actions and '+clients.length+' Supabase components\n');
