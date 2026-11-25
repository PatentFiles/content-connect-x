/** Generate a truthful image handoff and verify canonical data parity.
 * Usage: node scripts/marketing-assets.mjs [--compare ../other-repository]
 *        node scripts/marketing-assets.mjs --require-complete
 * This script does NOT download imagery, invent licenses, or seed a database.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createMarketingFixtures,marketingAssetManifest,DEMO_VERSION,DEMO_CLOCK,CATEGORY_COUNTS} from '../src/demo/marketingFixtures.mjs';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const approved=JSON.parse(fs.readFileSync('src/demo/approvedAssets.json','utf8'));
const data=createMarketingFixtures(approved),manifest=marketingAssetManifest(data);
const invalid=[];
for(const [entity,asset]of Object.entries(approved)){
 if(!manifest.some(x=>x.entity_id===entity))invalid.push(entity+': unknown fixture ID');
 for(const url of [asset.cover_url,asset.avatar_url,asset.image_url,...(asset.gallery||[])].filter(Boolean)){
  if(!url.startsWith('/demo-assets/')||url.includes('..')||url.includes('?')||url.includes('#')){invalid.push(entity+': images must use safe local /demo-assets/ paths');continue;}
  const file=path.resolve('public','.'+url);if(!fs.existsSync(file)||fs.statSync(file).size<32)invalid.push(entity+': missing or empty asset '+url);
 }
 if(!asset.provenance?.kind||!asset.provenance?.rights_confirmed)invalid.push(entity+': generation/source provenance and rights confirmation are required');
}
const audit={version:DEMO_VERSION,clock:DEMO_CLOCK,property_count:data.properties.length,category_counts:CATEGORY_COUNTS,profile_count:data.profiles.length,group_count:data.groups.length,product_count:data.products.length,collaboration_count:data.collaborations.length,contract_count:data.contracts.length,conversation_count:data.conversations.length,notification_count:data.notifications.length,asset_count:manifest.length,approved_images:manifest.filter(a=>a.status==='approved').length,missing_images:manifest.filter(a=>a.status!=='approved').length,invalid_assets:invalid,catalog_sha256:hash(JSON.stringify(data.properties)),people_sha256:hash(JSON.stringify(data.profiles))};
fs.mkdirSync('docs/demo',{recursive:true});
fs.writeFileSync('docs/demo/asset-manifest.json',JSON.stringify({version:DEMO_VERSION,notice:'All described people, properties and products are fictional. No asset is approved until it is installed and its rights are recorded.',assets:manifest},null,2)+'\n');
fs.writeFileSync('docs/demo/catalog-lock.json',JSON.stringify(audit,null,2)+'\n');
const index=process.argv.indexOf('--compare');
if(index>=0){
 const other=process.argv[index+1];if(!other)throw Error('--compare needs the other repository path.');
 for(const file of ['src/demo/marketingFixtures.mjs','src/demo/demoRuntime.mjs','src/demo/approvedAssets.json','src/supabase/MarketplaceExplore.jsx','src/supabase/hostVenueCategories.mjs']){
  const current=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),peer=fs.readFileSync(path.join(other,file),'utf8').replace(/\r\n/g,'\n');
  if(hash(current)!==hash(peer))throw Error('Cross-site divergence: '+file);
 }
 console.log('Cross-site fixture, asset mapping, adapter, marketplace and taxonomy parity: PASS');
}
console.log(JSON.stringify(audit,null,2));
if(invalid.length||(process.argv.includes('--require-complete')&&audit.missing_images))process.exitCode=1;
