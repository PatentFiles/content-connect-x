/** Exercise the actual locally served MapLibre module/worker against
 * OpenFreeMap in Chromium, not a fake map renderer. Synthetic city pins only.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const chrome=[process.env.CHROME_BIN,'/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(fs.existsSync);
assert.ok(chrome,'Chromium required');
const origin='http://127.0.0.1:4193',temp=fs.mkdtempSync(path.join(os.tmpdir(),'real-map-'));
const html=path.resolve('map-render-ci.html'),jsx=path.resolve('map-render-ci.jsx');
assert.ok(!fs.existsSync(html)&&!fs.existsSync(jsx),'Temporary fixture collision');
fs.writeFileSync(html,'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/map-render-ci.jsx"></script></body></html>');
fs.writeFileSync(jsx,"import React from 'react';import {createRoot} from 'react-dom/client';import './src/index.css';import HostRoadMap from './src/supabase/HostRoadMap';const props=[{id:'fixture-one',title:'Synthetic house',category:'house',approx_lat:33.4484,approx_lng:-112.074,daily_rate_cents:48000},{id:'fixture-two',title:'Synthetic studio',category:'photo_studio',approx_lat:33.459,approx_lng:-112.081,daily_rate_cents:39000}];createRoot(document.getElementById('root')).render(<HostRoadMap properties={props} onOpen={id=>document.body.dataset.selected=id} onBounds={()=>document.body.dataset.moved='true'}/>);");
const server=spawn(process.execPath,[path.resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','4193','--strictPort'],{stdio:'ignore'});
let browser,socket;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let up=false;
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Vite exited');try{if((await fetch(origin,{redirect:'error'})).ok){up=true;break;}}catch{} await pause(200);}
 assert.ok(up,'Map fixture server unavailable');
 browser=spawn(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+path.join(temp,'chrome'),'about:blank'],{stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Chromium startup timed out')),30000);let logs='';browser.stderr.on('data',chunk=>{logs+=chunk;const m=logs.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(t);resolve(m[1]);}});browser.once('error',reject);});
 socket=new WebSocket(endpoint);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let serial=0;const pending=new Map(),tileResponses=[];
 socket.addEventListener('message',event=>{const d=JSON.parse(event.data);if(d.method==='Network.responseReceived'&&d.params.response.url.includes('tiles.openfreemap.org')&&d.params.response.status===200)tileResponses.push(d.params.response.url);const p=pending.get(d.id);if(p){pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result);}});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const page=(method,params={})=>send(method,params,sessionId);
 const evaluate=async(fn,...args)=>{const x=await page('Runtime.evaluate',{expression:'('+fn.toString()+')(...'+JSON.stringify(args)+')',awaitPromise:true,returnByValue:true});if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));return x.result?.value;};
 await page('Page.enable');await page('Runtime.enable');await page('Network.enable');
 for(const width of [1280,390]){
  await page('Emulation.setDeviceMetricsOverride',{width,height:850,deviceScaleFactor:1,mobile:width<600});
  await page('Page.navigate',{url:origin+'/map-render-ci.html'});
  let result;
  for(let i=0;i<140;i++){result=await evaluate(()=>{const root=document.querySelector('[data-host-road-map]'),canvas=root?.querySelector('canvas.maplibregl-canvas');return {renderer:root?.dataset.mapRenderer,status:root?.dataset.mapStatus,pins:root?.querySelectorAll('.host-map-price-pin').length||0,canvasWidth:canvas?.getBoundingClientRect().width||0,canvasHeight:canvas?.getBoundingClientRect().height||0};});if(result?.renderer==='vector'&&result.status==='ready'&&result.pins===2)break;await pause(250);}
  assert.equal(result?.renderer,'vector','Actual vector renderer did not initialize: '+JSON.stringify(result));assert.equal(result.status,'ready');assert.equal(result.pins,2);assert.ok(result.canvasWidth>0&&result.canvasHeight>0);
  assert.ok(tileResponses.some(url=>/\/planet(?:\/|$)/.test(url)),'No successful OpenFreeMap source response');
  assert.equal(await evaluate(()=>{document.querySelector('.host-map-price-pin')?.click();return document.body.dataset.selected;}),'fixture-one');
  console.log('PASS: real OpenFreeMap vector renderer, local worker and 2 clickable pins at '+width+'px');
 }
 // A blocked WebGL context must recover to a raster map with the same pins.
 await page('Page.addScriptToEvaluateOnNewDocument',{source:"const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).startsWith('webgl')?null:original.call(this,type,...args)};"});
 await page('Page.navigate',{url:origin+'/map-render-ci.html'});
 let fallback=false;
 for(let i=0;i<120;i++){fallback=await evaluate(()=>document.querySelector('[data-map-renderer="raster"]')?.querySelectorAll('.host-map-price-pin').length===2);if(fallback)break;await pause(250);}
 assert.ok(fallback,'WebGL-disabled renderer did not recover to visible raster markers');
 assert.equal(await evaluate(()=>{document.querySelector('.host-map-price-pin')?.click();return document.body.dataset.selected;}),'fixture-one');
 console.log('PASS: no-WebGL fallback retains both property markers and click behavior');
}finally{socket?.close();browser?.kill();server.kill();fs.rmSync(html,{force:true});fs.rmSync(jsx,{force:true});fs.rmSync(temp,{recursive:true,force:true});}
