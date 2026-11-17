import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {optionalProviderSetting,OPTIONAL_PROVIDER_SETTINGS} from '../supabase/functions/_shared/providerConfig.mjs';
import {mergePhotoSelection} from '../src/supabase/propertyPhotoPolicy.mjs';
import {hostingEndpoint} from '../src/supabase/hostingEndpoints.mjs';
const read=path=>readFileSync(path,'utf8');
test('non-secret approval switches fail closed and reject unknown credential names',()=>{
 for(const key of Object.keys(OPTIONAL_PROVIDER_SETTINGS).filter(k=>/APPROVED|ENABLED|READY|RECONCILED|VERIFIED/.test(k)))
  assert.equal(optionalProviderSetting(key,()=>undefined),'false',key);
 assert.throws(()=>optionalProviderSetting('CCBILL_SALT',()=>undefined),/Unknown/);
 assert.equal(optionalProviderSetting('HOSTING_ROUTING_OSRM_URL',()=>undefined),'');
 assert.equal(optionalProviderSetting('HOSTING_ROUTING_APPROVED',()=> ' true '),'true');
});
test('retired membership endpoints do not read legacy provider credentials',()=>{
 for(const name of ['create-checkout','stripe-webhook']){
  const code=read('supabase/functions/'+name+'/index.ts');
  assert.match(code,/410/);assert.doesNotMatch(code,/Deno\.env\.get|api\.stripe\.com/);
 }
 const ops=read('supabase/functions/hosting-operations/index.ts');
 assert.doesNotMatch(ops,/ADULT_MERCHANT_APPROVED|ADULT_MERCHANT_PROVIDER/);
 assert.match(ops,/CCBILL_WEBHOOK_EVENT_CONTRACT_VERIFIED/);
});
test('shared optional config never embeds credentials and mirrors match',()=>{
 const canonical=read('supabase/functions/_shared/providerConfig.mjs');
 assert.doesNotMatch(canonical,/CCBILL_SALT:|DOCUSIGN_PRIVATE_KEY:|SUPABASE_SERVICE_ROLE_KEY:/);
 for(const entry of readdirSync('supabase/functions',{withFileTypes:true}).filter(v=>v.isDirectory())){
  const files=readdirSync(join('supabase/functions',entry.name));
  if(files.includes('providerConfig.mjs'))assert.equal(read(join('supabase/functions',entry.name,'providerConfig.mjs')),canonical);
 }
});
test('photo selection supports more than twenty files but rejects oversized/unsupported items',()=>{
 const photos=Array.from({length:50},(_,i)=>({name:`p${i}.jpg`,size:100,lastModified:1,type:'image/jpeg'}));
 const result=mergePhotoSelection([],photos);assert.equal(result.files.length,50);assert.equal(result.errors.length,0);
 const duplicated=mergePhotoSelection(result.files,[photos[0]]);assert.equal(duplicated.files.length,50);
 assert.equal(mergePhotoSelection([], [{name:'large.jpg',size:11*1024*1024,type:'image/jpeg'}]).files.length,0);
 assert.equal(mergePhotoSelection([], [{name:'wrong.svg',size:100,type:'image/svg+xml'}]).files.length,0);
});
test('media reads and host market API route to deployed discovery while booking remains protected',()=>{
 for(const action of ['host_market_overview','listing_thumbnails','host_media_page','property_media_page','host_photos_register'])assert.equal(hostingEndpoint(action),'hosting-discovery');
 for(const action of ['host_create','booking_cancel','host_video_register'])assert.equal(hostingEndpoint(action),'hosting-marketplace');
 const discovery=read('supabase/functions/hosting-discovery/index.ts');
 assert.match(discovery,/auth\.auth\.getUser/);assert.match(discovery,/hostCurrent/);
 assert.match(discovery,/host_verification_requests/);assert.match(discovery,/status','approved'/);
 assert.match(discovery,/body\.bounds/);assert.doesNotMatch(discovery,/select\([^\n]*exact_address/);
 assert.match(discovery,/10485760/);assert.doesNotMatch(discovery,/length\s*>=\s*20|Maximum of 20/);
});
test('host page opens dialogs, displays a shared photo carousel, and puts market map below bookings',()=>{
 const host=read('src/supabase/HostingHost.jsx');
 assert.match(host,/showDefaults&&<HostDialog/);assert.match(host,/editing&&<HostDialog/);
 assert.match(host,/<HostPortfolio/);assert.match(host,/<HostPhotoManager/);assert.match(host,/<HostPhotoPicker/);
 assert.ok(host.indexOf('<HostMarketExplorer')>host.indexOf('Booking requests from guests'));
 assert.doesNotMatch(host,/Create a New Space<\/button>/);
 assert.match(read('src/supabase/HostDialog.jsx'),/showModal\(\)/);
 assert.match(read('src/supabase/HostPortfolio.jsx'),/scroll-snap|oh-property-carousel/);
 assert.match(read('src/supabase/HostingMarketplace.jsx'),/PropertyPhotoGallery/);
});
