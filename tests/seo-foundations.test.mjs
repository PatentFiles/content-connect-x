/** Public-only SEO contract checks: no credentials, no Supabase access.
 * Sites are independent; Google/Bing property ownership is NOT configured here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const ROOT='https://contentconnectx.com/';
const PAGES=["creator-collaboration","production-professionals","how-it-works"];
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const extract=(html,regex)=>{const m=html.match(regex);assert.ok(m,'Missing SEO element '+regex);return m[1];};

test('the homepage has correct canonical, social preview, crawlable copy and schema graph',()=>{
 const html=read('index.html');
 assert.match(html,/<html lang="en"/);
 assert.match(html,/<title>[^<]+<\/title>/);
 assert.match(html,/<meta name="description" content="[^"]{80,200}"/);
 assert.equal((html.match(/<meta name="description"/g)||[]).length,1);
 assert.ok(html.includes('<link rel="canonical" href="'+ROOT+'"'));
 assert.ok(html.includes('name="robots" content="index, follow'));
 assert.ok(html.includes('property="og:image" content="'+ROOT));
 assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
 const json=extract(html,/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 const graph=JSON.parse(json);
 assert.equal(graph['@context'],'https://schema.org');
 assert.ok(graph['@graph'].some(x=>x['@type']==='Organization'&&x.url===ROOT));
 assert.ok(graph['@graph'].some(x=>x['@type']==='WebSite'&&x.url===ROOT));
 assert.match(html,/<div id="root">/,'Static marketing fallback should exist without JavaScript');
 assert.match(html,/<main id="main-content"/,'Public fallback has readable HTML');
 assert.match(html,/if \(path !== '\/' && path !== '\/index\.html'\)/,'Private SPA route index directive');
 for(const slug of PAGES)assert.ok(html.includes('href="/'+slug+'/"'),'Home must link to guide '+slug);
 assert.ok(!html.includes('google-site-verification'),'No personal Search Console ownership token belongs in source');
 assert.ok(!html.includes('msvalidate.01'),'No Bing owner verification token before business account setup');
});
test('all public sitemap URLs have independent static HTML with unique metadata and schema',()=>{
 const sitemap=read('public/sitemap.xml');
 const xmlUrls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.equal(xmlUrls.length,PAGES.length+1);
 assert.deepEqual(xmlUrls,[ROOT,...PAGES.map(s=>ROOT+s+'/')]);
 assert.ok(xmlUrls.every(u=>u.startsWith(ROOT)));
 const pageTitles=new Set(),pageDescriptions=new Set();
 for(const slug of PAGES){
  const file='public/'+slug+'/index.html';
  assert.ok(existsSync(new URL('../'+file,import.meta.url)),'Missing guide '+file);
  const html=read(file),canonical=ROOT+slug+'/';
  assert.ok(html.includes('<link rel="canonical" href="'+canonical+'">'));
  assert.ok(html.includes('<meta name="robots" content="index, follow'));
  assert.ok(html.includes('<main id="main-content">'));
  assert.ok(html.includes('<h1>'));
  assert.ok(html.includes('href="/trust/privacy"'));
  assert.ok(html.includes('https://hostconnectx.com/'));
  const title=extract(html,/<title>([^<]+)<\/title>/);
  const description=extract(html,/<meta name="description" content="([^"]+)"/);
  assert.ok(description.length>100&&description.length<190,'Description should fit search snippets');
  assert.ok(!pageTitles.has(title),'Duplicate titles');
  assert.ok(!pageDescriptions.has(description),'Duplicate descriptions');
  pageTitles.add(title);pageDescriptions.add(description);
  const graph=JSON.parse(extract(html,/<script type="application\/ld\+json">([\s\S]*?)<\/script>/));
  assert.ok(graph['@graph'].some(x=>x['@type']==='WebPage'&&x.url===canonical));
  assert.ok(!html.includes('type="application/javascript"'),'Guides work without client-side JS');
 }
});
test('robots points only to own sitemap and excludes protected routes, not public marketing',()=>{
 const text=read('public/robots.txt');
 assert.ok(text.includes('User-agent: *'));
 assert.ok(text.includes('Allow: /'));
 assert.ok(text.includes('Sitemap: '+ROOT+'sitemap.xml'));
 for(const path of ['/login','/signup','/Dashboard','/Verification','/admin','/account','/auth/','/private/'])
  assert.ok(text.includes('Disallow: '+path),'Protected route absent from robots: '+path);
 for(const slug of PAGES)assert.ok(!text.includes('Disallow: /'+slug+'/'));
 assert.ok(!text.includes('hostconnectx.com/sitemap.xml'));
});
test('the React footer exposes real public guide links on every page',()=>{
 const footer=read('src/supabase/TrustSite.jsx');
 assert.ok(footer.includes('aria-label="Professional resources"'));
 for(const slug of PAGES)
  assert.ok(footer.includes('href="/'+slug+'/"'),'Missing footer guide '+slug);
});
