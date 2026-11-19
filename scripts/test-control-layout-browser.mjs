/**
 * Real Chromium geometry checks, without Playwright or application credentials.
 * Uses the browser's DevTools protocol and Node's WebSocket API. No page sends
 * requests to Supabase. Run `npm run test:ui-controls` (Node 20.10+ / Chrome).
 * Set CHROME_BIN for a nonstandard browser or CONTROL_SCREENSHOT_DIR for evidence.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createControlFixture,createInteractiveShellFixture} from './control-layout-audit.mjs';
import {inspectControlLayout} from './control-layout-browser-checks.mjs';

const browserPath=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome','/opt/google/chrome/chrome'].filter(Boolean).find(p=>fs.existsSync(p));
assert.ok(browserPath,'Chromium/Chrome is required; set CHROME_BIN. Geometry tests must not silently skip.');
assert.ok(globalThis.WebSocket,'Use Node 20.10+ with --experimental-websocket, or Node 22+.');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'ccx-controls-'));
let browser,socket;
try{
 const fixture=path.join(folder,'controls.html');
 const inventory=await createControlFixture(fixture);
 const html=fs.readFileSync(fixture,'utf8');
 browser=spawn(browserPath,['--headless','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+path.join(folder,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Browser startup timed out')),20000);let log='';
  browser.once('error',error=>{clearTimeout(timer);reject(error);});
  browser.once('exit',code=>{clearTimeout(timer);reject(new Error('Browser exited during startup: '+code));});
  browser.stderr.on('data',chunk=>{log+=chunk;const match=log.match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
 });
 socket=new WebSocket(endpoint);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map();
 socket.addEventListener('message',event=>{const response=JSON.parse(event.data);const request=pending.get(response.id);if(!request)return;pending.delete(response.id);clearTimeout(request.timer);response.error?request.reject(new Error(JSON.stringify(response.error))):request.resolve(response.result);});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timed out'));},20000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
 });
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const response=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.exceptionDetails)throw new Error(JSON.stringify(response.exceptionDetails));return response.result?.value;};
 await page('Page.enable');await page('Runtime.enable');
 const {frameTree}=await page('Page.getFrameTree');
 await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html});
 const results=[];
 for(const width of [320,390,768,1440]){
  await page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  for(const theme of ['dark','light'])for(const large of [false,true]){
   await evaluate(`document.documentElement.classList.toggle('dark',${theme==='dark'});document.documentElement.style.fontSize=${JSON.stringify(large?'200%':'')};new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));`);
   const result=await evaluate('('+inspectControlLayout.toString()+')()');
   results.push({width,theme,enlargedText:large,...result});
   assert.deepEqual(result.failures,[],`${width}px ${theme} ${large?'200%':'normal'}: ${JSON.stringify(result.failures)}`);
  }
  if(process.env.CONTROL_SCREENSHOT_DIR&&[390,1440].includes(width)){
   fs.mkdirSync(process.env.CONTROL_SCREENSHOT_DIR,{recursive:true});
   await evaluate("document.documentElement.classList.add('dark');document.documentElement.style.fontSize='';new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));");
   const rect=await evaluate("(()=>{const r=document.querySelector('#collaboration-page').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()");
   const shot=await page('Page.captureScreenshot',{format:'png',clip:rect,captureBeyondViewport:true});
   fs.writeFileSync(path.join(process.env.CONTROL_SCREENSHOT_DIR,`collaborations-${width}.png`),Buffer.from(shot.data,'base64'));
  }
 }
 // These are native semantics, not synthetic replacement switches.
 assert.equal(await evaluate("(()=>{const c=document.querySelector('[data-choice] input[type=checkbox]');c.checked=false;c.closest('label').click();c.focus();return c.checked;})()"),true,'The full label must toggle the checkbox');
 await page('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await page('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 assert.equal(await evaluate("document.querySelector('[data-choice] input[type=checkbox]').checked"),false,'Space must toggle the focused checkbox');
 assert.equal(await evaluate("(()=>{const c=document.querySelector('[data-choice] input[type=checkbox]');c.disabled=true;c.checked=false;c.closest('label').click();return c.checked;})()"),false,'Disabled checkboxes must stay disabled');
 if(process.env.CONTROL_SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.CONTROL_SCREENSHOT_DIR,'results.json'),JSON.stringify({sourceFiles:inventory.files,choiceSites:inventory.labels.length,actionRows:inventory.rows.length,layouts:results},null,2));
 // Real hydrated header: verify responsive wrapping and measured content offsets.
 const shellHtml=await createInteractiveShellFixture(html);
 await page('Page.setDocumentContent',{frameId:frameTree.frame.id,html:shellHtml});
 await evaluate("new Promise(resolve=>{const ready=()=>document.querySelector('.ccx-shell-toolbar')?requestAnimationFrame(()=>requestAnimationFrame(resolve)):setTimeout(ready,10);ready();})");
 for(const width of [320,390,768,1440])for(const large of [false,true]){
  await page('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.documentElement.style.fontSize=${JSON.stringify(large?'200%':'')};new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));`);
  const shell=await evaluate(`(()=>{
   const header=document.querySelector('.ccx-shell-fixed-header'),main=document.querySelector('#main-content>div'),hr=header.getBoundingClientRect();
   const controls=[...header.querySelectorAll('button,a')].map(e=>({name:e.getAttribute('aria-label'),r:e.getBoundingClientRect()})).filter(v=>v.r.width>0);
   const failures=[];
   if(header.scrollWidth>innerWidth+1)failures.push('header overflows');
   if(document.documentElement.scrollWidth>innerWidth+1)failures.push('page overflows');
   if(main.getBoundingClientRect().top<hr.bottom-.5)failures.push('header overlaps content');
   const sidebar=document.querySelector('.ccx-shell-sidebar');
   if(sidebar&&sidebar.getBoundingClientRect().width>0){
    const sr=sidebar.getBoundingClientRect();
    if(sr.top<hr.bottom-.5)failures.push('header overlaps sidebar');
    if(main.getBoundingClientRect().left<sr.right-.5)failures.push('sidebar overlaps page content');
   }
   for(const c of controls)if(c.r.left<-.5||c.r.right>innerWidth+.5)failures.push('control outside viewport: '+c.name);
   for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i].r,b=controls[j].r;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5)failures.push('overlapping header controls');}
   return {failures,errors:window.__uiErrors,width:innerWidth,scrollX,scrollWidth:document.documentElement.scrollWidth,textOverflow:(()=>{const out=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let t;while(t=w.nextNode()){if(!t.textContent.trim()||t.parentElement.closest('script,style'))continue;const r=document.createRange();r.selectNodeContents(t);for(const b of r.getClientRects())if(b.right>innerWidth+.5)out.push({text:t.textContent.slice(0,70),parent:t.parentElement.className,right:b.right});}return out.slice(0,10);})(),overflow:failures.length?[...document.querySelectorAll('body *')].map(e=>({e,r:e.getBoundingClientRect()})).filter(({r})=>r.width&&r.right>innerWidth+.5).slice(0,12).map(({e,r})=>({tag:e.tagName,classes:e.className,right:r.right,width:r.width})):[]};
  })()`);
  assert.deepEqual(shell.failures,[],`${width}px header ${large?'200%':'normal'}: ${JSON.stringify(shell)}`);
  // Chromium can dispatch its non-fatal ResizeObserver loop completion notice
  // during multiple rapid responsive resizes. Geometry assertions above still
  // run, and all other application errors remain fatal.
  const actualAppErrors=shell.errors.filter(message=>message!=='ResizeObserver loop completed with undelivered notifications.');
  assert.deepEqual(actualAppErrors,[],'No application runtime errors in the actual navigation components');
 }
 console.log('PASS 8 real React header layouts, including 200% text and measured sidebar/content offsets.');
 console.log(`PASS ${results.length} Chromium layouts: ${inventory.files} JSX modules inventoried; ${inventory.labels.length} native choice sites, ${inventory.rows.length} action rows, actual Collaborations markup, keyboard/label/disabled behavior.`);
 await send('Browser.close');
}finally{
 socket?.close();
 // Chrome's child processes may finish profile writes after Browser.close().
 // Wait for process exit and retry asynchronously, never blocking its exit event.
 if(browser&&browser.exitCode===null)await new Promise(resolve=>{
  const timer=setTimeout(()=>{browser.kill('SIGKILL');resolve();},5000);
  browser.once('exit',()=>{clearTimeout(timer);resolve();});browser.kill();
 });
 try{await fs.promises.rm(folder,{recursive:true,force:true,maxRetries:12,retryDelay:200});}
 catch(error){
  // A locked throwaway profile is not a failed geometry assertion. Keep all
  // assertion/runtime failures fatal, and report cleanup-only OS contention.
  if(!['ENOTEMPTY','EBUSY'].includes(error.code))throw error;
  console.warn('Browser checks completed; temporary profile cleanup deferred:',error.code);
 }
}
