import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {HOST_VENUE_CATEGORIES,HOST_VENUE_QUICK_LINKS,HOST_VENUE_IDS,venueMatchesType,venueMatchesTypes,venueArtworkFor} from '../src/supabase/hostVenueCategories.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Properties quick links omit All spaces and Production set; deep dropdown includes every supported type',()=>{
 assert.deepEqual(HOST_VENUE_QUICK_LINKS.map(x=>x.id),[
  'house','condo','warehouse','film_studio','photo_studio','dungeon','outdoor','private_beach','pool'
 ]);
 assert.equal(new Set(HOST_VENUE_IDS).size,HOST_VENUE_IDS.length);
 assert.equal(HOST_VENUE_CATEGORIES.length,14);
 assert.ok(!HOST_VENUE_IDS.includes('set'));
 assert.deepEqual(HOST_VENUE_CATEGORIES.filter(x=>x.id==='dungeon').map(x=>x.label),['Dungeon']);
 assert.deepEqual(HOST_VENUE_CATEGORIES.filter(x=>x.id==='outdoor').map(x=>x.label),['Outdoor area']);
 assert.deepEqual(HOST_VENUE_CATEGORIES.filter(x=>x.id==='private_beach').map(x=>x.label),['Beach']);
 assert.deepEqual(HOST_VENUE_CATEGORIES.filter(x=>x.id==='pool').map(x=>x.label),['Swimming pool']);
 const rail=read('src/supabase/HostVenueCategoryRail.jsx');
 assert.match(rail,/grid-cols-3/);
 assert.match(rail,/sm:grid-cols-4/);
 assert.doesNotMatch(rail,/overflow-x-auto|w-max|min-w-max|overscroll-x-contain/);
 assert.match(rail,/HOST_VENUE_QUICK_LINKS\.map/);
 assert.match(rail,/HOST_VENUE_CATEGORIES\.map/);
 assert.match(rail,/ccx-venue-category-select/);
 assert.match(rail,/<option value="">All property types<\/option>/);
 assert.match(rail,/aria-pressed=\{active\}/);
});
test('all real artwork exists in the property quick-link grid and mobile picture slots are fixed',()=>{
 for(const item of HOST_VENUE_QUICK_LINKS){
  assert.match(item.image,/^\/[A-Za-z_]+\.png$/);
  assert.ok(existsSync(new URL('../public'+item.image,import.meta.url)),item.id+' image absent');
 }
 const rail=read('src/supabase/HostVenueCategoryRail.jsx');
 assert.match(rail,/onError=\{\(\)=>setMissing\(true\)\}/);
 assert.match(rail,/h-\[58px\]/);
});
test('backend filters support pool venue OR existing pool amenity, without leaking other properties',()=>{
 const props=[{category:'pool',amenities:[]},{category:'house',amenities:['pool','wifi']},{category:'house',amenities:['wifi']},{category:'private_beach',amenities:[]},{category:'outdoor',amenities:[]},{category:'dungeon',amenities:[]}];
 assert.deepEqual(props.filter(p=>venueMatchesType(p,'pool')),props.slice(0,2));
 assert.equal(venueMatchesType(props[2],'pool'),false);
 assert.equal(venueMatchesType(props[3],'private_beach'),true);
 assert.equal(venueMatchesType(props[4],'outdoor'),true);
 assert.equal(venueMatchesType(props[5],'dungeon'),true);
 assert.equal(venueMatchesTypes(props[3],[]),true);
 assert.equal(venueMatchesTypes(props[3],['pool','private_beach']),true);
 assert.equal(venueMatchesTypes(props[2],['pool','private_beach']),false);
});
test('Properties routes send real Host Supabase filter IDs and the filter modal matches categories',()=>{
 const app=read('src/supabase/SupabaseApp.jsx');
 const host=read('src/supabase/HostCrossMarketplace.jsx');
 const explore=read('src/supabase/MarketplaceExplore.jsx');
 const api=read('src/supabase/hostConnectApi.js');
 assert.match(app,/<HostCrossMarketplace key=\{tab\}/);
 assert.match(host,/<MarketplaceExplore items=\{items\}/);
 assert.match(explore,/<HostVenueCategoryRail selected=\{selectedCategory\}/);
 assert.match(explore,/types:id\?\[id\]:\[\]/);
 assert.match(explore,/venueMatchesTypes\(p,filters\.types\)/);
 assert.match(explore,/HOST_VENUE_CATEGORIES\.map/);
 assert.match(explore,/category:nextFilters\.types\[0\]/);
 assert.match(explore,/\.amenities\.length\?\{amenities:nextFilters\.amenities\}/);
 assert.match(api,/functions\/v1\/host-marketplace/);
 assert.doesNotMatch(explore,/Specialty set|Production set|All spaces/);
});

test('all recently uploaded category images are connected to actual Host category IDs',()=>{
 const expected={
  photo_studio:'/Studio.png',
  resort:'/resort_villa.png',
  villa:'/resort_villa.png',
  loft:'/loft.png',
  hotel:'/Hotel.png',
  private_beach:'/beach.png',
  pool:'/swimming_pool.png',
  outdoor:'/outdoor_area.png'
 };
 for(const [id,image] of Object.entries(expected)){
  const entry=HOST_VENUE_CATEGORIES.find(v=>v.id===id);
  assert.ok(entry,'No registered backend category '+id);
  assert.equal(entry.image,image,id+' must use exact image case and spelling');
  assert.equal(venueArtworkFor(id),image,'Images map to backend category IDs');
  const fullPath=new URL('../public'+image,import.meta.url);
  assert.ok(existsSync(fullPath),'Asset does not exist: '+image);
  const header=readFileSync(fullPath).subarray(0,8);
  assert.deepEqual([...header],[137,80,78,71,13,10,26,10],'Invalid PNG artwork: '+image);
 }
 assert.equal(venueArtworkFor('hotel',{listingPlaceholder:true}),'/boutique_hotel.png');
 assert.ok(existsSync(new URL('../public/boutique_hotel.png',import.meta.url)));
 assert.equal(venueArtworkFor('house',{listingPlaceholder:true}),'/house.png');
 assert.equal(venueArtworkFor('unrecognized'),null);
 assert.equal(venueArtworkFor('other'),null,'Missing artwork must not cause a broken request');
});
test('category icons are consistent in quick grid, full dropdown, advanced filters and blank-photo cards',()=>{
 const rail=read('src/supabase/HostVenueCategoryRail.jsx');
 const explore=read('src/supabase/MarketplaceExplore.jsx');
 assert.match(rail,/HOST_VENUE_QUICK_LINKS\.map/);
 assert.match(rail,/HOST_VENUE_CATEGORIES\.map/);
 assert.match(rail,/VenueArtwork item=\{HOST_VENUE_CATEGORIES\.find/);
 assert.match(explore,/HOST_VENUE_CATEGORIES\.map\(\(\{id,label,image\}\)/);
 assert.match(explore,/<img src=\{image\}/);
 assert.match(explore,/venueArtworkFor\(p\.category,\{listingPlaceholder:true\}\)/);
 assert.match(explore,/p\.cover_url\?<img/,'Real listing photos must be preferred');
 assert.match(explore,/types:id\?\[id\]:\[\]/);
 assert.match(explore,/category:nextFilters\.types\[0\]/);
 assert.match(explore,/venueMatchesTypes\(p,filters\.types\)/);
});
