import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {HOST_VENUE_CATEGORIES,HOST_VENUE_IDS} from '../src/supabase/hostVenueCategories.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Content Connect Properties uses the canonical Host Connect venue categories and expected labels',()=>{
 assert.deepEqual(HOST_VENUE_IDS,[
  'house','condo','warehouse','film_studio','photo_studio','resort','villa','loft',
  'set','outdoor','private_beach','dungeon','other','hotel'
 ]);
 assert.deepEqual(HOST_VENUE_CATEGORIES.map(x=>x.label),[
  'All spaces','House','Condo','Warehouse','Film studio','Photo studio','Resort','Villa',
  'Loft','Production set','Outdoor estate','Private beach','Specialty set',
  'Other verified venue','Hotel'
 ]);
 assert.equal(new Set(HOST_VENUE_IDS).size,14);
});
test('all actual original artwork paths exist; future category images use stable public filenames',()=>{
 for(const item of HOST_VENUE_CATEGORIES){
  if(!item.image)continue;
  assert.match(item.image,/^\/[a-z_]+\.png$/);
  // Missing artwork is intentional: fixed-space blank slots permit future image uploads.
  const path='public/'+item.image.slice(1);
  if(['house','condo','warehouse','film_studio','outdoor','private_beach','dungeon'].includes(item.id)){
   assert.ok(existsSync(new URL('../'+path,import.meta.url)),'Existing icon absent: '+path);
  }
 }
 const rail=read('src/supabase/HostVenueCategoryRail.jsx');
 assert.match(rail,/onError=\{\(\)=>setMissing\(true\)\}/);
 assert.match(rail,/h-\[70px\]/);
 assert.doesNotMatch(rail,/Icon size=|<Home|<Camera|<Clapperboard/);
});
test('real Properties route uses venue artwork rail with backend and local category filtering, not Services',()=>{
 const app=read('src/supabase/SupabaseApp.jsx');
 const host=read('src/supabase/HostCrossMarketplace.jsx');
 const explore=read('src/supabase/MarketplaceExplore.jsx');
 assert.match(app,/<HostCrossMarketplace key=\{tab\}/);
 assert.match(host,/<MarketplaceExplore items=\{items\}/);
 assert.match(explore,/<HostVenueCategoryRail selected=\{selectedCategory\}/);
 assert.match(explore,/types:id\?\[id\]:\[\]/);
 assert.match(explore,/category:nextFilters\.types\[0\]/);
 assert.match(explore,/filters\.types\.includes\(p\.category\)/);
 assert.match(explore,/data\.map\(p=>/);
 assert.doesNotMatch(explore,/label:'Services'|tab==='services'|Professional services from Content Connect X|label:'Equipment'/);
});
