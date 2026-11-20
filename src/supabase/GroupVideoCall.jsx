import React,{useEffect,useRef,useState} from 'react';
import {Video,VideoOff,Mic,MicOff,PhoneOff,Disc,Square,RefreshCw,FileAudio} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {suiteAction} from './collabSuiteApi';
const button='ccx-secondary rounded-xl px-3 py-2 text-sm disabled:opacity-50';
const iceServers=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
function VideoTile({stream,label,muted=false,onElement}){
 const ref=useRef(null);
 useEffect(()=>{if(ref.current)ref.current.srcObject=stream;onElement?.(ref.current);return()=>onElement?.(null);},[stream,onElement]);
 return <figure className="overflow-hidden rounded-xl border border-[var(--cc-border)] bg-black"><video ref={ref} autoPlay playsInline muted={muted} className="aspect-video w-full object-cover"/><figcaption className="bg-[var(--cc-surface)] p-2 text-xs">{label}</figcaption></figure>;
}
export default function GroupVideoCall({collaborationId,userId}){
 const [active,setActive]=useState(false),[joining,setJoining]=useState(false),[remote,setRemote]=useState({}),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [recording,setRecording]=useState(false),[uploads,setUploads]=useState(0),[records,setRecords]=useState([]);
 const [remoteRecorders,setRemoteRecorders]=useState({});
 const [micEnabled,setMicEnabled]=useState(true),[cameraEnabled,setCameraEnabled]=useState(true);
 const local=useRef(null),peers=useRef(new Map()),seen=useRef(new Set()),pollTimer=useRef(null),pulseTimer=useRef(null),recordingRef=useRef(false);
 const videos=useRef(new Map()),recorder=useRef([]),recStream=useRef(null),recordInterval=useRef(null),segmentInterval=useRef(null),audioContext=useRef(null),audioDest=useRef(null),sources=useRef(new Set()),pendingICE=useRef(new Map());
 const post=async(kind,recipient_id=null,payload={})=>suiteAction('call_signal',{collaboration_id:collaborationId,kind,recipient_id,payload});
 const closePeer=id=>{const pc=peers.current.get(id);if(pc){pc.close();peers.current.delete(id);}setRemote(prev=>{const next={...prev};delete next[id];return next;});videos.current.delete(id);};
 const attachAudio=stream=>{
  if(!audioDest.current||!audioContext.current||sources.current.has(stream.id)||!stream.getAudioTracks().length)return;
  try{const source=audioContext.current.createMediaStreamSource(stream);source.connect(audioDest.current);sources.current.add(stream.id);}catch{/* audio track may not yet be ready */}
 };
 const createPeer=peer=>{
  if(peers.current.has(peer))return peers.current.get(peer);
  if(peers.current.size>=5)throw Error('This peer-to-peer room supports six participants');
  const pc=new RTCPeerConnection({iceServers});
  peers.current.set(peer,pc);
  for(const track of local.current?.getTracks()||[])pc.addTrack(track,local.current);
  pc.onicecandidate=event=>{if(event.candidate)void post('ice',peer,{candidate:event.candidate.toJSON()}).catch(e=>setError(e.message));};
  pc.ontrack=event=>{const stream=event.streams[0]||new MediaStream([event.track]);setRemote(old=>({...old,[peer]:stream}));attachAudio(stream);};
  pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState))closePeer(peer);};
  return pc;
 };
 const flushIce=async(peer,pc)=>{
  const waiting=pendingICE.current.get(peer)||[];pendingICE.current.delete(peer);
  for(const item of waiting){try{await pc.addIceCandidate(item);}catch{/* peer may have renegotiated */}}
 };
 const offer=async peer=>{
  if(peer===userId||!local.current)return;
  const pc=createPeer(peer);
  if(pc.signalingState!=='stable')return;
  const description=await pc.createOffer();
  await pc.setLocalDescription(description);
  await post('offer',peer,{sdp:pc.localDescription.toJSON()});
 };
 const handle=async signal=>{
  const peer=signal.sender_id;if(peer===userId)return;
  if(signal.kind==='leave'){
   closePeer(peer);setRemoteRecorders(old=>{const next={...old};delete next[peer];return next;});return;
  }
  if(signal.kind==='recording_start'){
   setRemoteRecorders(old=>({...old,[peer]:Date.now()}));return;
  }
  if(signal.kind==='recording_stop'){
   setRemoteRecorders(old=>{const next={...old};delete next[peer];return next;});return;
  }
  if(signal.kind==='join'){if(userId<peer)await offer(peer);return;}
  if(!local.current)return;
  const pc=createPeer(peer);
  if(signal.kind==='offer'&&signal.payload?.sdp){
   if(pc.signalingState!=='stable')await pc.setLocalDescription({type:'rollback'});
   await pc.setRemoteDescription(signal.payload.sdp);await flushIce(peer,pc);
   const description=await pc.createAnswer();
   await pc.setLocalDescription(description);await post('answer',peer,{sdp:pc.localDescription.toJSON()});
  }else if(signal.kind==='answer'&&signal.payload?.sdp&&pc.signalingState==='have-local-offer'){
   await pc.setRemoteDescription(signal.payload.sdp);await flushIce(peer,pc);
  }else if(signal.kind==='ice'&&signal.payload?.candidate){
   if(pc.remoteDescription)await pc.addIceCandidate(signal.payload.candidate).catch(()=>{});
   else pendingICE.current.set(peer,[...(pendingICE.current.get(peer)||[]),signal.payload.candidate]);
  }
 };
 const poll=async()=>{
  if(!local.current)return;
  try{
   const data=await suiteAction('call_poll',{collaboration_id:collaborationId,since:new Date(Date.now()-90000).toISOString()});
   for(const signal of data.items||[]){
    if(seen.current.has(signal.id))continue;
    seen.current.add(signal.id);
    if(seen.current.size>2000)seen.current.clear();
    await handle(signal);
   }
   setRemoteRecorders(old=>Object.fromEntries(Object.entries(old).filter(([,last])=>Date.now()-last<25000)));
  }catch(e){setError(e.message);}
 };
 const join=async()=>{
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection) return setError('Secure HTTPS camera and WebRTC access are required');
  setJoining(true);setError('');setNotice('');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:{width:{ideal:960},height:{ideal:540}}});
   local.current=stream;setActive(true);await post('join');
   pollTimer.current=setInterval(()=>void poll(),1500);
   pulseTimer.current=setInterval(()=>{
    void post('join').catch(()=>{});
    if(recordingRef.current){
     void post('recording_start').catch(e=>{
      setError('Recording stopped because recording consent or signaling could not be confirmed: '+e.message);
      stopRecording();
     });
    }
   },8000);
   await poll();
  }catch(e){local.current?.getTracks().forEach(t=>t.stop());local.current=null;setError(e.message);}finally{setJoining(false);}
 };
 const stopRecording=()=>{
  const wasRecording=recordingRef.current;recordingRef.current=false;
  if(wasRecording)void post('recording_stop').catch(()=>{});
  clearInterval(segmentInterval.current);segmentInterval.current=null;
  recorder.current.forEach(r=>{if(r.state!=='inactive')r.stop();});
  recorder.current=[];setRecording(false);clearInterval(recordInterval.current);recordInterval.current=null;
  recStream.current?.getTracks().forEach(track=>track.stop());recStream.current=null;
  audioContext.current?.close().catch(()=>{});audioContext.current=null;audioDest.current=null;sources.current.clear();
 };
 const leave=()=>{
  stopRecording();clearInterval(pollTimer.current);clearInterval(pulseTimer.current);pollTimer.current=null;pulseTimer.current=null;
  void post('leave').catch(()=>{});
  for(const id of peers.current.keys())closePeer(id);
  local.current?.getTracks().forEach(track=>track.stop());local.current=null;seen.current.clear();setActive(false);setRemote({});setRemoteRecorders({});
 };
 useEffect(()=>()=>{clearInterval(pollTimer.current);clearInterval(pulseTimer.current);clearInterval(recordInterval.current);clearInterval(segmentInterval.current);local.current?.getTracks().forEach(t=>t.stop());for(const pc of peers.current.values())pc.close();recorder.current.forEach(r=>r.state!=='inactive'&&r.stop());audioContext.current?.close().catch(()=>{});},[]);
 const loadRecordings=async()=>{try{const r=await suiteAction('recordings_list',{collaboration_id:collaborationId});setRecords(r.items||[]);}catch(e){setError(e.message);}};
 useEffect(()=>{void loadRecordings();},[collaborationId]);
 const upload=async(blob,content_type)=>{
  if(!blob.size)return;
  setUploads(v=>v+1);
  try{
   const ticket=await suiteAction('recording_ticket',{collaboration_id:collaborationId,content_type});
   const {error}=await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path,ticket.token,blob,{contentType:content_type});
   if(error)throw error;
   const saved=await suiteAction('recording_finish',{collaboration_id:collaborationId,path:ticket.path,content_type,duration_seconds:30});
   // The audio track automatically becomes a searchable text transcript when
   // the shared OpenAI key is configured. Video chunks remain playable copies.
   if(content_type.startsWith('audio/')&&saved.item?.id){
    try{
     await suiteAction('transcribe_recording',{recording_id:saved.item.id});
     setNotice('Meeting audio saved and transcribed into the collaboration record.');
    }catch(error){
     setNotice('Meeting audio saved. Transcription can be retried from the recording list: '+error.message);
    }
   }
   await loadRecordings();
  }catch(e){setError('Recording upload: '+e.message);}finally{setUploads(v=>v-1);}
 };
 const startRecording=async()=>{
  setError('');setNotice('');
  try{
   if(!window.MediaRecorder||!window.AudioContext)throw Error('This browser does not support call recording');
   // Server verifies the explicit collaboration recording consent of every member.
   await suiteAction('recording_ticket',{collaboration_id:collaborationId,content_type:'video/webm'});
   const audio=new AudioContext();audioContext.current=audio;const destination=audio.createMediaStreamDestination();audioDest.current=destination;
   attachAudio(local.current);Object.values(remote).forEach(attachAudio);
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Canvas capture unavailable');
   const draw=()=>{
    if(!recStream.current)return;
    ctx.fillStyle='#151515';ctx.fillRect(0,0,1280,720);
    const sources=[...videos.current.entries()].filter(([,v])=>v&&v.readyState>=2);
    const cols=sources.length>2?3:Math.max(1,sources.length),rows=Math.max(1,Math.ceil(sources.length/cols));
    sources.forEach(([id,v],i)=>{const w=1280/cols,h=720/rows,x=i%cols*w,y=Math.floor(i/cols)*h;ctx.drawImage(v,x,y,w,h);ctx.font='24px sans-serif';ctx.fillStyle='#ffffff';ctx.fillText(id==='self'?'You':id.slice(0,8),x+20,y+36);});
   };
   const videoStream=canvas.captureStream(16);
   recStream.current=new MediaStream([...videoStream.getVideoTracks(),...destination.stream.getAudioTracks()]);
   const vType=MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')?'video/webm;codecs=vp8,opus':'video/webm';
   const aType=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
   if(!MediaRecorder.isTypeSupported(vType)||!MediaRecorder.isTypeSupported(aType))throw Error('WebM recording is not supported by this browser');
   // A MediaRecorder timeslice is not necessarily a standalone playable WebM file.
   // Stop and create each pair of recorders every 30s so each uploaded segment
   // carries its own container headers and can be played or transcribed alone.
   const recordSegment=()=>{
    if(!recStream.current)return;
    const create=(stream,mime,options)=>{
     const pieces=[];
     const instance=new MediaRecorder(stream,{mimeType:mime,...options});
     instance.ondataavailable=event=>{if(event.data.size)pieces.push(event.data);};
     instance.onstop=()=>{
      const file=new Blob(pieces,{type:mime.split(';')[0]});
      if(file.size)void upload(file,mime.split(';')[0]);
     };
     instance.start();
     return instance;
    };
    const video=create(recStream.current,vType,{videoBitsPerSecond:650000,audioBitsPerSecond:64000});
    const audioOnly=create(destination.stream,aType,{audioBitsPerSecond:48000});
    recorder.current=[video,audioOnly];
   };
   // Notify the entire call before the first video/audio segment starts.
   await post('recording_start');
   recordingRef.current=true;
   recordSegment();
   segmentInterval.current=setInterval(()=>{
    recorder.current.forEach(item=>{if(item.state!=='inactive')item.stop();});
    recordSegment();
   },30000);
   recordInterval.current=setInterval(draw,100);draw();setRecording(true);setNotice('Recording in 30-second private segments. Both video and audio are stored for this collaboration.');
  }catch(e){setError(e.message);stopRecording();}
 };
 const transcribe=async id=>{
  setJoining(true);setError('');try{await suiteAction('transcribe_recording',{recording_id:id});setNotice('Audio transcript saved to this collaboration.');await loadRecordings();}catch(e){setError(e.message);}finally{setJoining(false);}
 };
 return <section className="space-y-4 rounded-xl border border-[var(--cc-border)] p-4" data-group-call="true"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex gap-2 text-lg font-semibold"><Video size={20}/>Group video meeting</h3>
 <div className="flex flex-wrap gap-2">{!active?<button type="button" className="ccx-primary rounded-xl px-4 py-2 text-sm" onClick={()=>void join()} disabled={joining}><Video size={16} className="mr-1 inline"/>{joining?'Joining…':'Join video room'}</button>:<>
 <button type="button" className={button} onClick={()=>{local.current?.getAudioTracks().forEach(t=>t.enabled=!micEnabled);setMicEnabled(v=>!v);}}>{micEnabled?<Mic size={16}/>:<MicOff size={16}/>}</button>
 <button type="button" className={button} onClick={()=>{local.current?.getVideoTracks().forEach(t=>t.enabled=!cameraEnabled);setCameraEnabled(v=>!v);}}>{cameraEnabled?<Video size={16}/>:<VideoOff size={16}/>}</button>
 {!recording?<button type="button" className={button} onClick={()=>void startRecording()}><Disc size={16} className="mr-1 inline"/>Record with consent</button>:<button type="button" className={button} onClick={stopRecording}><Square size={16} className="mr-1 inline"/>Stop recording</button>}
 <button type="button" className={button} onClick={leave}><PhoneOff size={16} className="mr-1 inline"/>Leave</button>
 </>}</div></div>
 <p className="text-xs text-[var(--cc-text-secondary)]">Private peer-to-peer room for up to six participants. Recording requires every participant's collaboration recording consent. Only collaboration members can retrieve stored recordings.</p>
 {(recording||Object.keys(remoteRecorders).length>0)&&<p role="status" aria-live="assertive" className="flex items-center gap-2 rounded-xl border border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-800">
  <Disc size={16}/> Recording active: {recording?'You':Object.keys(remoteRecorders).map(id=>'Member '+id.slice(0,8)).join(', ')}
 </p>}
 {active&&<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><VideoTile label="You" stream={local.current} muted onElement={el=>{if(el)videos.current.set('self',el);else videos.current.delete('self');}}/>{Object.entries(remote).map(([id,stream])=><VideoTile key={id} label={'Member '+id.slice(0,8)} stream={stream} onElement={el=>{if(el)videos.current.set(id,el);else videos.current.delete(id);}}/>)}</div>}
 {uploads>0&&<p role="status" className="text-sm">Uploading {uploads} private recording segment(s)…</p>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm">{notice}</p>}
 <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Saved recordings and transcripts</h4><button type="button" className={button} onClick={()=>void loadRecordings()}><RefreshCw size={15} className="mr-1 inline"/>Refresh</button></div>
 {!records.length&&<p className="text-xs text-[var(--cc-text-secondary)]">No recording segments saved yet.</p>}
 <div className="max-h-80 space-y-3 overflow-y-auto">{records.map(r=><article key={r.id} className="rounded-xl bg-[var(--cc-surface-subtle)] p-3 text-sm"><div className="flex flex-wrap items-center gap-3"><FileAudio size={16}/><span>{r.content_type} · {new Date(r.created_at).toLocaleString()}</span>{r.url&&<a href={r.url} target="_blank" rel="noreferrer" className="text-[var(--cc-link)] underline">Open recording</a>}{r.content_type.startsWith('audio/')&&!r.transcript&&<button type="button" className={button} disabled={joining} onClick={()=>void transcribe(r.id)}>Transcribe with AI</button>}</div>{r.transcript&&<details className="mt-2"><summary className="cursor-pointer font-medium">Transcript</summary><p className="mt-2 whitespace-pre-wrap">{r.transcript}</p></details>}</article>)}</div>
 </section>;
}
