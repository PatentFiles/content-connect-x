import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Host Connect public footer exposes all safety/legal destinations and current year',()=>{
 const source=read('src/supabase/OnlyHostApp.jsx');
 assert.match(source,/<nav aria-label="Host Connect legal and support links"/);
 for(const path of ['/trust/terms','/trust/privacy','/trust/cookies','/trust/billing','/trust/content-removal','/trust/accessibility'])
  assert.ok(source.includes('href="'+path+'"'),'Missing public host legal route '+path);
 assert.match(source,/\{new Date\(\)\.getFullYear\(\)\} Host Connect/);
 assert.doesNotMatch(source,/© 2027 Host Connect/);
 const trust=read('src/supabase/trustContent.mjs');
 for(const slug of ['terms','privacy','cookies','billing','content-removal','accessibility'])
  assert.ok(trust.includes(slug),'Missing configured trust copy: '+slug);
});
test('Host Connect public CTAs remain real authentication and navigation controls',()=>{
 const host=read('src/supabase/OnlyHostApp.jsx');
 assert.match(host,/aria-label="Host Connect navigation"/);
 assert.match(host,/aria-label="Open Host Connect navigation menu"/);
 assert.match(host,/aria-label="Host Connect mobile navigation"/);
 assert.match(host,/setShowLogin\(true\)/);
 assert.match(host,/href="https:\/\/contentconnectx\.com" className="oh-ccx-gradient"/);
});
