import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resetPageScroll,scrollToNewPage} from '../src/supabase/navigationScroll.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Home and Discovery use one canonical category list without chef or spa tiles',()=>{
 const categories=read('src/supabase/CategoryArtwork.jsx');
 const home=read('src/supabase/PublicLandingSections.jsx');
 const member=read('src/supabase/CreatorDiscovery.jsx');
 const grid=read('src/supabase/DiscoveryCategoryGrid.jsx');
 assert.doesNotMatch(categories,/key:'(?:chef|spa)'/);
 assert.match(home,/DISCOVERY_CATEGORIES\.map/);
 assert.match(grid,/DISCOVERY_CATEGORIES\.map/);
 assert.match(grid,/PUBLIC_DISCOVERY_DETAILS\[item\.key\]/);
 assert.match(member,/<DiscoveryCategoryGrid/);
 assert.match(member,/key!=='host'/);
});
test('Discovery category cards collapse on mobile, remain visible on desktop',()=>{
 const grid=read('src/supabase/DiscoveryCategoryGrid.jsx');
 assert.match(grid,/aria-expanded=\{expanded\}/);
 assert.match(grid,/grid-cols-3/);
 assert.match(grid,/md:grid/);
 assert.match(grid,/md:hidden/);
 assert.match(grid,/aria-pressed=\{selected\}/);
});
test('navigation scroll reset handles viewport and nested main scrollers',()=>{
 let calls=0,rafCalls=0;
 const root={scrollTop:470},body={scrollTop:470},main={scrollTop:470};
 globalThis.window={scrollTo:()=>{calls++;},requestAnimationFrame:cb=>{rafCalls++;cb();}};
 globalThis.document={scrollingElement:root,documentElement:root,body,getElementById:id=>id==='main-content'?main:null};
 try{
  resetPageScroll();
  assert.equal(root.scrollTop,0);assert.equal(body.scrollTop,0);assert.equal(main.scrollTop,0);
  scrollToNewPage();
  assert.equal(calls,3);assert.equal(rafCalls,1);
 }finally{delete globalThis.window;delete globalThis.document;}
});
test('workspace navigation and browser history both invoke page-top reset',()=>{
 const app=read('src/supabase/SupabaseApp.jsx');
 assert.match(app,/useLayoutEffect\(\(\)=>\{scrollToNewPage\(\);\},\[tab\]\)/);
 assert.match(app,/onPopState=.*scrollToNewPage\(\)/);
 assert.match(app,/scrollRestoration='manual'/);
});

test('Hosts appear on the public homepage and authenticated Discovery without querying creator profiles',async()=>{
 const categories=read('src/supabase/CategoryArtwork.jsx');
 const member=read('src/supabase/CreatorDiscovery.jsx');
 const landing=read('src/supabase/PublicLandingSections.jsx');
 const {PUBLIC_DISCOVERY_DETAILS}=await import('../src/supabase/publicDiscoveryDetails.mjs');
 assert.match(categories,/key:'hosts',label:'Hosts',destination:'hosting',image:'\/house\.png'/);
 assert.match(member,/item\.destination==='hosting'/);
 assert.match(member,/onNavigate\?\.\('hosting'\)/);
 assert.match(landing,/href=\{story\.href\|\|'\/signup'\}/);
 const story=PUBLIC_DISCOVERY_DETAILS.hosts;
 assert.equal(story.href,'https://hostconnectx.com');
 assert.match(story.detail,/lighting, cameras, microphones/);
 assert.match(story.detail,/host permits this type of production/);
 assert.match(story.detail,/specifically designed or furnished/);
});
