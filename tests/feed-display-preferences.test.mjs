import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 DEFAULT_FEED_PREFERENCES,normalizeFeedPreferences,
 loadFeedPreferences,saveFeedPreferences
} from '../src/supabase/feedDisplayPreferences.mjs';

const alice='10000000-0000-4000-8000-000000000001';
function fakeClient({found=null,failRead=false,failSave=false}={}){
 const calls=[];
 const client={from(table){
  calls.push(['table',table]);
  return {
   select(fields){calls.push(['select',fields]);return this;},
   eq(field,value){calls.push(['eq',field,value]);return this;},
   maybeSingle:async()=>({data:found,error:failRead?{message:'privacy read denied'}:null}),
   upsert(value,opts){calls.push(['upsert',value,opts]);return this;},
   single:async()=>({data:found||{default_audience:'friends',feed_view:'following'},error:failSave?{message:'write denied'}:null})
  };
 }};
 return {client,calls};
}
test('defaults are discover and community, never changed by unknown values',()=>{
 assert.deepEqual(normalizeFeedPreferences(null),DEFAULT_FEED_PREFERENCES);
 assert.deepEqual(normalizeFeedPreferences({default_audience:'invalid',feed_view:'invalid'}),DEFAULT_FEED_PREFERENCES);
 assert.deepEqual(normalizeFeedPreferences({default_audience:'friends',feed_view:'following'}),{default_audience:'friends',feed_view:'following'});
});
test('first visit without stored preference defaults to verified community and Discover',async()=>{
 const {client,calls}=fakeClient();
 assert.deepEqual(await loadFeedPreferences(client,alice),DEFAULT_FEED_PREFERENCES);
 assert.deepEqual(calls,[['table','ccx_feed_display_preferences'],['select','default_audience,feed_view'],['eq','user_id',alice]]);
});
test('saved preferences load from the signed-in member row',async()=>{
 const {client}=fakeClient({found:{default_audience:'only_me',feed_view:'friends'}});
 assert.deepEqual(await loadFeedPreferences(client,alice),{default_audience:'only_me',feed_view:'friends'});
});
test('writes use verified account ID, validate values and preserve other settings',async()=>{
 const {client,calls}=fakeClient({found:{default_audience:'friends',feed_view:'following'}});
 const saved=await saveFeedPreferences(client,alice,{default_audience:'friends',feed_view:'following'});
 assert.deepEqual(saved,{default_audience:'friends',feed_view:'following'});
 const event=calls.find(([key])=>key==='upsert');
 assert.equal(event[1].user_id,alice);
 assert.equal(event[1].default_audience,'friends');
 assert.equal(event[1].feed_view,'following');
 assert.deepEqual(event[2],{onConflict:'user_id'});
});
test('does not accept arbitrary feed views or audiences, and reports storage failures',async()=>{
 const f=fakeClient({failRead:true,failSave:true});
 await assert.rejects(loadFeedPreferences(f.client,alice),/could not be loaded/);
 await assert.rejects(saveFeedPreferences(f.client,alice,{default_audience:'everyone',feed_view:'discover'}),/supported/);
 await assert.rejects(saveFeedPreferences(f.client,alice,{default_audience:'verified',feed_view:'discover'}),/could not be saved/);
 await assert.rejects(loadFeedPreferences(f.client,''),/Sign in/);
});
test('only icon buttons remain in composer, and audience/view selectors live in Settings',()=>{
 const feed=fs.readFileSync('src/supabase/ConnectFeed.jsx','utf8');
 const settings=fs.readFileSync('src/supabase/FeedPreferencesSettings.jsx','utf8');
 const member=fs.readFileSync('src/supabase/MemberSettings.jsx','utf8');
 const app=fs.readFileSync('src/supabase/SupabaseApp.jsx','utf8');
 assert.match(feed,/data-feed-composer="true"/);
 assert.match(feed,/aria-label="Attach a photo"/);
 assert.match(feed,/title=\{groupId\?'Submit group post for moderation':'Publish update'\}/);
 assert.match(feed,/<Send size=\{19\}/);
 assert.match(feed,/loadFeedPreferences\(supabase,userId\)/);
 assert.match(feed,/onNavigate\('settings'\)/);
 assert.doesNotMatch(feed,/<select[^>]*value=\{audience\}/);
 assert.doesNotMatch(feed,/role="tablist" aria-label="Connect Feed filter"/);
 assert.match(settings,/Default Feed view/);
 assert.match(settings,/Default post audience/);
 assert.match(settings,/saveFeedPreferences\(supabase,userId,value\)/);
 assert.match(member,/<FeedPreferencesSettings userId=\{user\?\.id\}/);
 assert.match(app,/<FeedPreferencesSettings userId=\{user\.id\}/);
});
test('Discovery filters start collapsed on desktop and mobile and remain user expandable',()=>{
 const file=fs.readFileSync('src/supabase/CreatorDiscovery.jsx','utf8');
 assert.match(file,/const \[filtersOpen,setFiltersOpen\]=useState\(false\)/);
 assert.match(file,/aria-expanded=\{filtersOpen\}/);
 assert.match(file,/setFiltersOpen\(v=>!v\)/);
 assert.match(file,/filtersOpen&&<div id="ccx-discovery-filter-fields"/);
 assert.match(file,/data-discovery-filters="true"/);
});
test('both public footers center at desktop and mobile; Host Connect banner switches without losing original',()=>{
 const host=fs.readFileSync('src/supabase/OnlyHostApp.jsx','utf8');
 const publicTheme=fs.readFileSync('src/supabase/public-brand-theme.css','utf8');
 const privateHost=fs.readFileSync('src/supabase/onlyhost-theme.css','utf8');
 const publicLanding=fs.readFileSync('src/supabase/public-landing.css','utf8');
 assert.match(host,/<source media="\(max-width: 640px\)" srcSet="\/Host_Connect_Banner_Mobile\.png"\/>/);
 assert.match(host,/<img src="\/Host_Connect_Banner\.png"/);
 assert.match(host,/aria-label="Log out of Host Connect"/);
 assert.match(host,/Log out<\/button>/);
 assert.ok(fs.statSync('public/Host_Connect_Banner_Mobile.png').size>1000);
 assert.ok(fs.statSync('public/Host_Connect_Banner.png').size>1000);
 for(const css of [publicTheme,privateHost,publicLanding]){
  assert.match(css,/footer-inner\{display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center/);
 }
});
test('feed preference migration denies anonymous read and cross-user updates with RLS',()=>{
 const sql=fs.readFileSync('supabase/migrations/20261120035500_feed_member_display_preferences.sql','utf8');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/for update to authenticated/);
 assert.match(sql,/with check \(\(select auth\.uid\(\)\) is not null and user_id=\(select auth\.uid\(\)\)\)/);
 assert.match(sql,/revoke all on public\.ccx_feed_display_preferences from PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/security definer/i);
});
