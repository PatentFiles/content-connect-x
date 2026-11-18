/** One-time, branch-bound repair. Restores presentation only; never deploys or touches backend data. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import postcss from 'postcss';
const branch='fix/restore-public-homepage-branding';
const historical='21b95435a02e9e1e6ddc10e8805f377bf4b9a67d';
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),branch);
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
const old=p=>execFileSync('git',['show',historical+':'+p],{encoding:'utf8',maxBuffer:4*1024*1024});
function replaceOnce(text,from,to,label){assert.equal(text.split(from).length,2,'Expected one '+label);return text.replace(from,to);}
function block(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return text.slice(a,b);}
const themes=['src/globals.css',...['brand-theme.css','onlyhost-theme.css','host-workspace.css','public-landing.css','professional-theme.css'].map(p=>'src/supabase/'+p)];
function scoped(css,publicSkin){
 const root=postcss.parse(css),gate=publicSkin?'[data-ccx-appearance="public"]':':not([data-ccx-appearance="public"])';
 if(publicSkin){
  const names=new Map();root.walkAtRules(/keyframes$/i,a=>names.set(a.params,'ccx-public-'+a.params));
  root.walkAtRules(/keyframes$/i,a=>{a.params=names.get(a.params);});
  root.walkDecls(/^(-webkit-)?animation(-name)?$/,d=>{for(const [from,to] of names)d.value=d.value.replace(new RegExp('\\b'+from+'\\b','g'),to);});
 }
 root.walkRules(rule=>{
  let p=rule.parent;while(p){if(p.type==='atrule'&&/keyframes$/i.test(p.name))return;p=p.parent;}
  rule.selectors=rule.selectors.map(s=>{
   if(/^:root\b/.test(s))return s.replace(/^:root/,':root:where('+gate+')');
   if(/^html\b/.test(s))return s.replace(/^html/,'html:where('+gate+')');
   return ':where(html'+gate+') '+s;
  });
 });
 return root.toString();
}
// Two mutually exclusive skins. :where() keeps the original selector specificity.
// In particular, no white-theme rule can flatten gradients or hide public artwork.
for(const p of themes)write(p,'/* Signed-in appearance only. Public branding is isolated in public-brand-theme.css. */\n'+scoped(read(p),false));
const originals=['src/globals.css',...['brand-theme.css','onlyhost-theme.css','host-workspace.css','public-landing.css'].map(p=>'src/supabase/'+p)];
let publicCss='/* Original public branding restored from '+historical+'.\n * Scoped to signed-out rendering; never affects member/admin/host workspaces.\n * Original image assets are retained byte-for-byte. */\n';
for(const p of originals)publicCss+='\n/* Historical source: '+p+' */\n'+scoped(old(p),true)+'\n';
// Compatibility for semantic tokens introduced in the member-only refresh.
publicCss+='\n:root:where([data-ccx-appearance="public"]) { --cc-surface-subtle: #11182B; --cc-input-border: var(--cc-border); --cc-link: #FF87D8; --cc-focus: #09D3F7; --cc-action: #E900C5; --cc-action-hover: #C4008D; --cc-on-action: #FFFFFF; }\n';
write('src/supabase/public-brand-theme.css',publicCss);
write('src/supabase/authAppearance.js',`/** Presentation follows the actual Auth session, never a URL, OS mode or saved theme.\n * This changes CSS/chrome only; it never grants membership or verification. */\nimport {useLayoutEffect} from 'react';\nexport function applyAuthAppearance(signedIn,root=document.documentElement){\n const appearance=signedIn?'workspace':'public';\n root.dataset.ccxAppearance=appearance;\n root.classList.toggle('dark',!signedIn);\n const doc=root.ownerDocument;\n for(const [name,value] of [['color-scheme',signedIn?'light':'dark'],['theme-color',signedIn?'#FFFFFF':'#080A15'],['apple-mobile-web-app-status-bar-style',signedIn?'default':'black-translucent']]){\n  doc?.querySelector('meta[name="'+name+'"]')?.setAttribute('content',value);\n }\n return appearance;\n}\nexport function useAuthAppearance(user){\n useLayoutEffect(()=>{applyAuthAppearance(Boolean(user?.id));},[user?.id]);\n}\n`);
let app=read('src/supabase/SupabaseApp.jsx');
let home=block(old('src/supabase/SupabaseApp.jsx'),'  if(!user&&!authPage)return','  if(!user&&authPage)return');
home=replaceOnce(home,'    <section className="ccx-hero-image','    <main id="main-content">\n    <h1 className="sr-only">Content Connect X — Create. Collaborate. Connect.</h1>\n    <section className="ccx-hero-image','home semantic heading');
home=replaceOnce(home,'    <PublicLandingSections/>','    <PublicLandingSections/>\n    </main>','home main close');
app=app.replace(block(app,'  if(!user&&!authPage)return','  if(!user&&authPage)return'),home);
app=replaceOnce(app,"import ProfessionalLandingHero,{PublicBrand} from './ProfessionalLandingHero';","import {useAuthAppearance} from './authAppearance';",'app appearance import');
app=replaceOnce(app,'  const user = session?.user;','  const user = session?.user;\n  useAuthAppearance(user);','app session appearance');
app=replaceOnce(app,'<span className="ccx-monogram ccx-monogram-auth" aria-hidden="true">CX</span>','<img src="/content_connect_logo.png" alt="Content Connect X" className="ccx-brand-mark h-16 w-16 shrink-0 rounded-2xl object-cover"/>','public login logo');
assert.ok(!app.includes('PublicBrand')&&!app.includes('ProfessionalLandingHero'));
write('src/supabase/SupabaseApp.jsx',app);
let host=read('src/supabase/OnlyHostApp.jsx');
host=replaceOnce(host,"import ProfessionalLandingHero from './ProfessionalLandingHero';","import ProfessionalLandingHero from './ProfessionalLandingHero';\nimport {useAuthAppearance} from './authAppearance';",'host appearance import');
host=replaceOnce(host,' const user=session?.user;',' const user=session?.user;\n useAuthAppearance(user);','host session appearance');
const banner=block(old('src/supabase/OnlyHostApp.jsx'),'     <section className="oh-landing-banner"','     <section className="oh-landing-section oh-landing-intro"').trim();
host=replaceOnce(host,'     <ProfessionalLandingHero host onStart={openWorkspace}/>','     {user?<ProfessionalLandingHero host onStart={openWorkspace}/>:<>\n      <h1 className="sr-only">Host Connect — studios, locations and sets for professional productions</h1>\n      '+banner+'\n     </>}', 'original host banner');
// A signed-out Host must never keep the previous account workspace on screen.
host=replaceOnce(host,' const ready=Boolean(account?.registered&&account?.host_terms_current);',' const ready=Boolean(user&&account?.registered&&account?.host_terms_current);','host signed-out presentation');
host=replaceOnce(host,'   if(active)setSession(next);',"   if(active){setSession(next);if(!next?.user){setAccount(null);setView('account');setShowSettings(false);}}",'host sign-out cleanup');
write('src/supabase/OnlyHostApp.jsx',host);
let boot=read('src/supabase/bootstrap.jsx');
boot=replaceOnce(boot,"import './professional-theme.css';","import './professional-theme.css';\nimport './public-brand-theme.css';\nimport {applyAuthAppearance} from './authAppearance';",'bootstrap skins');
boot=replaceOnce(boot,"document.documentElement.classList.remove('dark');","// Public branding is the initial state; each app switches after Auth resolves.\napplyAuthAppearance(false);",'bootstrap initial skin');
write('src/supabase/bootstrap.jsx',boot);
let index=read('index.html');
index=replaceOnce(index,'<html lang="en">','<html lang="en" class="dark" data-ccx-appearance="public">','initial public html');
index=index.replace('Owner-selected white interface, including system dark mode','Original public branding before Auth resolves; signed-in chrome switches to white').replace('name="theme-color" content="#FFFFFF"','name="theme-color" content="#080A15"').replace('name="color-scheme" content="light"','name="color-scheme" content="dark"').replace('name="apple-mobile-web-app-status-bar-style" content="default"','name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
write('index.html',index);
let fixture=read('scripts/control-layout-audit.mjs');
fixture=replaceOnce(fixture,"'public-landing.css','professional-theme.css'","'public-landing.css','professional-theme.css','public-brand-theme.css'",'fixture skin import');
write('scripts/control-layout-audit.mjs',fixture);
let contract=read('scripts/frontend-backend-contract.mjs');
const start=contract.indexOf('// The professional refresh replaces text baked into neon artwork');
const end=contract.indexOf("assert.match(pricingView,/Free Membership/)",start);
assert.ok(start>=0&&end>start);
contract=contract.slice(0,start)+`// Public branding is preserved; the professional skin is member-only.\nassert.match(app,/content_conect_hero\\.png/,'Original desktop hero required');\nassert.match(app,/ContentConnectX__Create,_Collaborate,_Grow\\.png/,'Original mobile hero required');\nassert.match(app,/useAuthAppearance\\(user\\)/,'Theme follows Auth, not URL');\nassert.match(get(root+'/OnlyHostApp.jsx'),/Host_Connect_Banner\\.png/,'Original host banner required');\nassert.match(get(root+'/OnlyHostApp.jsx'),/useAuthAppearance\\(user\\)/);\n`+contract.slice(end);
write('scripts/frontend-backend-contract.mjs',contract);
let tests=read('tests/professional-theme.test.mjs');
tests=tests.replace("both brands deliberately default to white, independent of OS or old dark preference","signed-in brands retain white styling independently of OS preferences");
tests=tests.replace(" assert.match(read('index.html'),/name=\"color-scheme\" content=\"light\"/);\n assert.doesNotMatch(read('index.html'),/<html[^>]*class=\"dark\"/);\n assert.match(read('src/supabase/bootstrap.jsx'),/classList\\.remove\\('dark'\\)/);", " assert.match(read('index.html'),/data-ccx-appearance=\"public\"/);\n assert.match(read('src/supabase/authAppearance.js'),/signedIn\\?'workspace':'public'/);\n assert.match(read('src/supabase/authAppearance.js'),/useLayoutEffect/);");
tests=tests.replace("the professional layer is loaded globally after brand, host and marketing layouts","the professional layer is ordered after layouts but excludes public pages");
const last=tests.indexOf("test('new public hero uses real text and actions, not neon artwork with baked-in labels'");
assert.ok(last>=0);
tests=tests.slice(0,last)+`test('original public artwork and both session-driven appearance boundaries are preserved',()=>{\n const app=read('src/supabase/SupabaseApp.jsx'),host=read('src/supabase/OnlyHostApp.jsx');\n assert.match(app,/content_conect_hero\\.png/);\n assert.match(app,/ContentConnectX__Create,_Collaborate,_Grow\\.png/);\n assert.match(host,/Host_Connect_Banner\\.png/);\n assert.match(app,/useAuthAppearance\\(user\\)/);assert.match(host,/useAuthAppearance\\(user\\)/);\n assert.match(read('src/supabase/public-brand-theme.css'),/data-ccx-appearance=\"public\"/);\n assert.match(theme,/:not\\(\\[data-ccx-appearance=\"public\"\\]\\)/);\n});\n`;
write('tests/professional-theme.test.mjs',tests);
// Keep all existing responsive/member/modal coverage and add real original-asset
// decoding, public dark styling, and actual mocked Auth sign-in/sign-out tests.
let browser=read('scripts/test-professional-theme-browser.mjs');
browser=browser.replace("import {spawn} from 'node:child_process';","import {spawn} from 'node:child_process';\nimport http from 'node:http';");
browser=browser.replace('let browser,socket;','let browser,socket,assetServer;');
browser=browser.replace("const session=loggedIn?{user,access_token:'isolated-ui-fixture'}:null;","let session=loggedIn?{user,access_token:'isolated-ui-fixture'}:null;\nlet authListener;\nwindow.__styleAuth=signedIn=>{session=signedIn?{user,access_token:'isolated-ui-fixture'}:null;authListener?.(signedIn?'SIGNED_IN':'SIGNED_OUT',session);};");
browser=browser.replace("onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})","onAuthStateChange:callback=>{authListener=callback;return {data:{subscription:{unsubscribe(){authListener=null;}}}};},signOut:async()=>{window.__styleAuth(false);return {error:null};}");
browser=browser.replace('try {\n const base=',`try {\n const publicDir=path.resolve('public');\n assetServer=http.createServer((req,res)=>{\n  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);\n  const file=path.resolve(publicDir,'.'+pathname);\n  if(!file.startsWith(publicDir+path.sep)||! /\\.(png|jpe?g|webp|svg)$/i.test(file)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}\n  res.writeHead(200,{'Content-Type':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);\n });\n await new Promise(resolve=>assetServer.listen(0,'127.0.0.1',resolve));\n const assetOrigin='http://127.0.0.1:'+assetServer.address().port;\n const base=`);
browser=browser.replace("const template=fs.readFileSync(base,'utf8');","const template=fs.readFileSync(base,'utf8').replace('<head>','<head><base href=\"'+assetOrigin+'/\">');");
browser=browser.replace('return {background:getComputedStyle(document.body).backgroundColor,','return {appearance:document.documentElement.dataset.ccxAppearance||\'workspace\',background:getComputedStyle(document.body).backgroundColor,');
const from="  assert.equal(state.background,'rgb(255, 255, 255)',label+' background');\n  assert.equal(state.colorScheme,'light',label+' browser chrome');\n  assert.equal(state.overflow,false,label+' horizontal overflow');\n  assert.deepEqual(state.badButtons,[],label+' solid button styling');\n  assert.deepEqual(state.darkPanels,[],label+' light surfaces');";
const to=`  if(state.appearance==='public'){\n   assert.notEqual(state.background,'rgb(255, 255, 255)',label+' original dark background');\n   assert.equal(state.colorScheme,'dark',label+' public browser chrome');\n   const hero=await evaluate(\"(()=>{const img=document.querySelector('.ccx-hero-image img,.oh-landing-banner img');return img?{src:decodeURIComponent(new URL(img.currentSrc).pathname),loaded:img.complete&&img.naturalWidth>0,visible:img.getBoundingClientRect().height>0}:null;})()\");\n   if(['homepage','hostconnect','host-signed-out'].includes(label)){\n    assert.ok(hero?.loaded&&hero.visible,label+' original hero decoded and visible');\n    assert.equal(hero.src,label==='homepage'?(width<=640?'/ContentConnectX__Create,_Collaborate,_Grow.png':'/content_conect_hero.png'):'/Host_Connect_Banner.png',label+' exact original asset');\n   }\n  }else{\n   assert.equal(state.background,'rgb(255, 255, 255)',label+' background');\n   assert.equal(state.colorScheme,'light',label+' browser chrome');\n   assert.deepEqual(state.badButtons,[],label+' solid button styling');\n   assert.deepEqual(state.darkPanels,[],label+' light surfaces');\n  }\n  assert.equal(state.overflow,false,label+' horizontal overflow');`;
browser=replaceOnce(browser,from,to,'responsive public/workspace expectations');
browser=browser.replace("await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');","await evaluate(\"Promise.all([...document.querySelectorAll('.ccx-hero-image img,.oh-landing-banner img')].map(img=>img.decode()))\");\n  await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');");
const loopMarker=" for(const role of ['creator','agent','studio','photographer','videographer','video_editor']){";
browser=replaceOnce(browser,loopMarker,` // Drive the real Host component through its Auth subscription, not a CSS-only toggle.\n await navigate('/hostconnect',390);\n await evaluate('window.__styleAuth(true)');\n await evaluate(\"new Promise((resolve,reject)=>{let n=0;const tick=()=>{if(document.querySelector('.oh-new-space-action'))resolve();else if(++n>100)reject(Error('Sign-in did not mount workspace'));else setTimeout(tick,20);};tick();})\");\n await inspect('host-signed-in',390);\n await evaluate('window.__styleAuth(false)');\n await evaluate(\"new Promise((resolve,reject)=>{let n=0;const tick=()=>{if(document.querySelector('.oh-landing-banner img'))resolve();else if(++n>100)reject(Error('Sign-out did not restore homepage'));else setTimeout(tick,20);};tick();})\");\n await inspect('host-signed-out',390);\n`+loopMarker,'Auth transition coverage');
browser=browser.replace('real-screen light-theme checks: public pages, signup, pricing, collaborations, host dashboard/modals, six roles; mobile through desktop and OS dark preference.','real-screen appearance checks: original public artwork, responsive public pages, login/logout transitions, white member/host dashboards and modals.');
browser=browser.replace(' socket?.close();',' socket?.close();\n if(assetServer)await new Promise(resolve=>assetServer.close(resolve));');
write('scripts/test-professional-theme-browser.mjs',browser);
const assets=['content_conect_hero.png','ContentConnectX__Create,_Collaborate,_Grow.png','Host_Connect_Banner.png'];
const hashes=Object.fromEntries(assets.map(name=>{const bytes=fs.readFileSync('public/'+name);const original=execFileSync('git',['show',historical+':public/'+name],{maxBuffer:30*1024*1024});assert.ok(bytes.equals(original),'Original artwork changed: '+name);return [name,createHash('sha256').update(bytes).digest('hex')];}));
write('tests/public-brand-assets.json',JSON.stringify({source_commit:historical,sha256:hashes},null,2)+'\n');
write('tests/public-branding.test.mjs',`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport {createHash} from 'node:crypto';\nimport postcss from 'postcss';\nconst read=p=>fs.readFileSync(p,'utf8');\ntest('original desktop/mobile Content Connect and Host Connect artwork is unchanged',()=>{\n const manifest=JSON.parse(read('tests/public-brand-assets.json'));\n for(const [file,hash] of Object.entries(manifest.sha256))assert.equal(createHash('sha256').update(fs.readFileSync('public/'+file)).digest('hex'),hash,file);\n});\ntest('every refreshed CSS rule excludes public pages, while every restored rule requires them',()=>{\n const files=${JSON.stringify(themes)};\n for(const file of [...files,'src/supabase/public-brand-theme.css']){\n  const isPublic=file.endsWith('public-brand-theme.css');\n  postcss.parse(read(file)).walkRules(rule=>{\n   let p=rule.parent;while(p){if(p.type==='atrule'&&/keyframes$/i.test(p.name))return;p=p.parent;}\n   for(const selector of rule.selectors){assert.ok(selector.includes(isPublic?'[data-ccx-appearance="public"]':':not([data-ccx-appearance="public"])'),file+' '+selector);}\n  });\n }\n});\ntest('appearance helper switches dark/light and browser chrome without changing authorization',async()=>{\n const {applyAuthAppearance}=await import('../src/supabase/authAppearance.js');\n const classes=new Set(),metas=new Map();\n const root={dataset:{},classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)},ownerDocument:{querySelector:name=>({setAttribute:(key,value)=>metas.set(name,value)})}};\n assert.equal(applyAuthAppearance(false,root),'public');assert.ok(classes.has('dark'));\n assert.equal(applyAuthAppearance(true,root),'workspace');assert.ok(!classes.has('dark'));\n assert.equal(applyAuthAppearance(false,root),'public');assert.ok(classes.has('dark'));\n const source=read('src/supabase/authAppearance.js');assert.doesNotMatch(source,/localStorage|matchMedia|member_admissions|functions\\.invoke/);\n});\n`);
const note=`## Public homepage styling boundary — November 18, 2026\n\nThe logged-out Content Connect X and Host Connect pages retain their original dark/neon branding, original hero artwork, gradients and responsive layout. The professional white redesign applies **after sign-in**, including member, administrator, verification and host workspaces. Do not replace public artwork or apply workspace CSS globally.\n\nThe public skin is restored from commit \`${historical}\`. \`authAppearance.js\` follows the actual Auth session and changes presentation only. Every theme selector is scoped to either public or non-public appearance, with original specificity preserved via \`:where()\`. This cannot grant admission or bypass any backend rule. Signing out restores public styling and clears the Host workspace display.\n\nRegression tests verify all three original asset hashes, every CSS scope, real image decoding at mobile/desktop sizes, and real component sign-in/sign-out transitions using isolated Auth fixtures. Existing white-workspace/modal, identity and account-access tests remain in place. Bolt is still the website host; no Supabase or Railway deployment is needed for this presentation fix.\n\n`;
write('docs/PUBLIC_HOMEPAGE_RESTORATION.md','# Restore original public homepages\n\n'+note);
for(const doc of ['README.md','docs/FRONTEND_DESIGN_SYSTEM.md','docs/PROFESSIONAL_LIGHT_REFRESH.md']){const text=read(doc);write(doc,note+text);}
console.log('Restored original public markup and scoped both appearance systems. Asset hashes:',JSON.stringify(hashes));
// The repair runner is not a permanent workflow and never ships on main.
fs.unlinkSync('scripts/restore-public-branding-once.mjs');
fs.unlinkSync('.github/workflows/restore-public-branding-once.yml');
