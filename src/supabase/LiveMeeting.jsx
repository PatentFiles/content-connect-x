import React,{useEffect,useRef,useState} from 'react';
import {Mic,MicOff,Video,VideoOff,PhoneOff,Disc,Square} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {meetingAction} from './meetingSuiteApi';

const style='ccx-secondary min-h-10 rounded-xl px-3 py-2 text-sm disabled:opacity-60';
const SDK_URL='https://cdn.jsdelivr.net/npm/livekit-client@2.24.1/dist/livekit-client.umd.min.js';
let sdkPromise=null;
async function loadLiveKit(){
 if(window.LivekitClient?.Room)return window.LivekitClient;
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=SDK_URL;script.crossOrigin='anonymous';script.async=true;
  script.onload=()=>window.LivekitClient?.Room?resolve(window.LivekitClient):reject(Error('LiveKit SDK did not load'));
  script.onerror=()=>reject(Error('Could not load the LiveKit browser SDK; check your network or content-security policy'));
  document.head.appendChild(script);
 }).catch(error=>{sdkPromise=null;throw error;});
 return sdkPromise;
}
function mediaType(choices){return choices.find(type=>window.MediaRecorder?.isTypeSupported(type))||null;}

export default function LiveMeeting({scope,scopeId,userId,onNewRecordings}){
 const [connected,setConnected]=useState(false),[joining,setJoining]=useState(false),[recording,setRecording]=useState(false),[recordingBy,setRecordingBy]=useState(null);
 const [mic,setMic]=useState(true),[camera,setCamera]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [uploads,setUploads]=useState(0),[participants,setParticipants]=useState(0);
 const root=useRef(null),room=useRef(null),tiles=useRef(new Map()),audio=useRef(new Map()),alive=useRef(true);
 const recorder=useRef([]),recordingActive=useRef(false),recordedStream=useRef(null);
 const context=useRef(null),destination=useRef(null),audioSources=useRef(new Set());
 const drawInterval=useRef(null),segmentInterval=useRef(null),heartbeatInterval=useRef(null),statusInterval=useRef(null);
 const api=(action,data={})=>meetingAction(action,scope,scopeId,data);
 const refreshCount=()=>setParticipants((room.current?.remoteParticipants?.size||0)+(room.current?1:0));
 const appendTrack=(track,person)=>{
  if(!root.current||!track)return;
  const kind=track.kind,identity=person?.identity||'self',key=identity+':'+(track.sid||track.mediaStreamTrack?.id||kind);
  if(tiles.current.has(key))return;
  if(kind==='audio'){
   const media=track.attach();media.autoplay=true;media.setAttribute('aria-hidden','true');media.style.display='none';
   root.current.appendChild(media);tiles.current.set(key,{wrapper:media,track,kind});
   attachRecordingAudio(track);
  }else if(kind==='video'){
   const figure=document.createElement('figure');figure.className='overflow-hidden rounded-xl border border-[var(--cc-border)] bg-black';
   const video=track.attach();video.autoplay=true;video.playsInline=true;video.muted=identity==='self';
   video.className='aspect-video w-full object-cover';
   const label=document.createElement('figcaption');label.className='p-2 text-xs text-[var(--cc-text-primary)] bg-[var(--cc-surface)]';
   label.textContent=identity==='self'?'You':person?.name||'Member '+identity.slice(0,8);
   figure.append(video,label);root.current.appendChild(figure);
   tiles.current.set(key,{wrapper:figure,track,kind});
  }
 };
 const removeTrack=(track,person)=>{
  const identity=person?.identity||'self';
  for(const [key,item] of tiles.current){
   if(item.track!==track||!key.startsWith(identity+':'))continue;
   try{track.detach();}catch{/* track already stopped */}
   item.wrapper.remove();tiles.current.delete(key);
  }
 };
 const attachRecordingAudio=track=>{
  const ctx=context.current,output=destination.current;
  if(!ctx||!output||!track?.mediaStreamTrack)return;
  const id=track.mediaStreamTrack.id;
  if(audioSources.current.has(id))return;
  try{
   const source=ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
   source.connect(output);audio.current.set(id,source);audioSources.current.add(id);
  }catch{/* track may be muted or detached */}
 };
 const connect=async()=>{
  if(joining||connected)return;
  setJoining(true);setError('');setNotice('');
  try{
   const credentials=await api('room_ticket');
   const kit=await loadLiveKit();
   const meeting=new kit.Room({adaptiveStream:true,dynacast:true});
   room.current=meeting;
   meeting.on(kit.RoomEvent.TrackSubscribed,(track,_publication,person)=>appendTrack(track,person));
   meeting.on(kit.RoomEvent.TrackUnsubscribed,(track,_publication,person)=>removeTrack(track,person));
   meeting.on(kit.RoomEvent.ParticipantConnected,refreshCount);
   meeting.on(kit.RoomEvent.ParticipantDisconnected,refreshCount);
   meeting.on(kit.RoomEvent.Disconnected,()=>{setConnected(false);setParticipants(0);});
   await meeting.connect(credentials.server_url,credentials.participant_token,{autoSubscribe:true});
   await meeting.localParticipant.enableCameraAndMicrophone();
   for(const publication of meeting.localParticipant.videoTrackPublications.values())if(publication.track)appendTrack(publication.track,{identity:'self',name:'You'});
   for(const publication of meeting.localParticipant.audioTrackPublications.values())if(publication.track)appendTrack(publication.track,{identity:'self',name:'You'});
   for(const participant of meeting.remoteParticipants.values()){
    for(const publication of participant.trackPublications.values()){
     if(publication.track)appendTrack(publication.track,participant);
    }
   }
   setConnected(true);refreshCount();
   setNotice('Connected to the secure meeting. Only authorized members can join this room.');
  }catch(e){
   room.current?.disconnect().catch(()=>{});room.current=null;
   setError(e.message||'Could not connect to the meeting');
  }finally{setJoining(false);}
 };
 const stop=()=>{
  const wasRecording=recordingActive.current;
  recordingActive.current=false;
  clearInterval(heartbeatInterval.current);heartbeatInterval.current=null;
  clearInterval(drawInterval.current);drawInterval.current=null;
  clearInterval(segmentInterval.current);segmentInterval.current=null;
  for(const instance of recorder.current)if(instance.state!=='inactive')try{instance.stop();}catch{/* stopped */}
  recorder.current=[];
  recordedStream.current?.getTracks().forEach(t=>t.stop());recordedStream.current=null;
  void context.current?.close().catch(()=>{});context.current=null;destination.current=null;
  audio.current.clear();audioSources.current.clear();
  setRecording(false);
  if(wasRecording)void api('recording_stop').catch(()=>{});
 };
 const leave=()=>{
  stop();
  for(const item of tiles.current.values()){try{item.track.detach();}catch{/* detached */}item.wrapper.remove();}
  tiles.current.clear();room.current?.disconnect().catch(()=>{});
  room.current=null;setConnected(false);setParticipants(0);setMic(true);setCamera(true);
 };
 useEffect(()=>{
  alive.current=true;
  const check=async()=>{
   try{
    const status=await api('recording_state');
    if(alive.current)setRecordingBy(status.is_recording?status.recorded_by:null);
   }catch{/* state is also reconciled when recording heartbeat checks run */}
  };
  void check();statusInterval.current=window.setInterval(()=>void check(),5000);
  return()=>{
   alive.current=false;clearInterval(statusInterval.current);clearInterval(heartbeatInterval.current);
   clearInterval(drawInterval.current);clearInterval(segmentInterval.current);
   for(const instance of recorder.current)if(instance.state!=='inactive')try{instance.stop();}catch{/* finished */}
   void room.current?.disconnect().catch(()=>{});
   for(const item of tiles.current.values()){try{item.track.detach();}catch{/* finished */}item.wrapper.remove();}
   tiles.current.clear();recordedStream.current?.getTracks().forEach(t=>t.stop());
   void context.current?.close().catch(()=>{});
   if(recordingActive.current)void api('recording_stop').catch(()=>{});
  };
 },[scope,scopeId]);
 const upload=async(blob,type)=>{
  if(!blob.size)return;
  setUploads(v=>v+1);
  try{
   const ticket=await api('recording_ticket',{content_type:type});
   const {error}=await supabase.storage.from(ticket.bucket)
    .uploadToSignedUrl(ticket.path,ticket.token,blob,{contentType:type});
   if(error)throw error;
   const saved=await api('recording_finish',{path:ticket.path,content_type:type});
   if(type.startsWith('audio/')&&saved.item?.id){
    try{await api('transcribe',{recording_id:saved.item.id});
     setNotice('Meeting audio saved and transcribed for the project.');}
    catch(e){setNotice('Audio saved; transcription can be retried: '+e.message);}
   }
   onNewRecordings?.();
  }catch(e){setError('Recording could not be saved: '+e.message);}
  finally{setUploads(v=>v-1);}
 };
 const start=async()=>{
  setError('');setNotice('');
  if(!connected||!room.current)return;
  try{
   if(!window.MediaRecorder||!window.AudioContext)throw Error('Browser recording is unavailable');
   await api('recording_heartbeat');
   const videoType=mediaType(['video/webm;codecs=vp8,opus','video/webm','video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4']);
   const audioType=mediaType(['audio/webm;codecs=opus','audio/webm','audio/mp4;codecs=mp4a.40.2','audio/mp4']);
   if(!videoType||!audioType)throw Error('Your browser cannot record both audio and video in a supported format');
   const ctx=new AudioContext();context.current=ctx;
   const dest=ctx.createMediaStreamDestination();destination.current=dest;
   const all=[room.current.localParticipant,...room.current.remoteParticipants.values()];
   for(const person of all)for(const publication of person.audioTrackPublications.values())if(publication.track)attachRecordingAudio(publication.track);
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
   const draw=()=>{
    const paint=canvas.getContext('2d');if(!paint)return;
    paint.fillStyle='#151515';paint.fillRect(0,0,1280,720);
    const videos=[...tiles.current.values()].filter(x=>x.kind==='video').map(x=>x.wrapper.querySelector('video')).filter(v=>v?.readyState>=2).slice(0,16);
    const columns=videos.length>6?4:videos.length>2?3:Math.max(1,videos.length);
    const rows=Math.max(1,Math.ceil(videos.length/columns));
    videos.forEach((v,i)=>{
     const w=1280/columns,h=720/rows,x=(i%columns)*w,y=Math.floor(i/columns)*h;
     try{paint.drawImage(v,x,y,w,h);}catch{/* frame not ready */}
    });
   };
   const captured=canvas.captureStream(12);
   recordedStream.current=new MediaStream([...captured.getVideoTracks(),...dest.stream.getAudioTracks()]);
   const startSegments=()=>{
    if(!recordingActive.current)return;
    const create=(stream,mime,opts)=>{
     const pieces=[],instance=new MediaRecorder(stream,{mimeType:mime,...opts});
     instance.ondataavailable=e=>{if(e.data.size)pieces.push(e.data);};
     instance.onstop=()=>{
      const result=new Blob(pieces,{type:mime.split(';')[0]});
      if(result.size)void upload(result,mime.split(';')[0]);
     };
     instance.start();return instance;
    };
    recorder.current=[
     create(recordedStream.current,videoType,{videoBitsPerSecond:600000,audioBitsPerSecond:64000}),
     create(dest.stream,audioType,{audioBitsPerSecond:48000})
    ];
   };
   recordingActive.current=true;setRecording(true);setRecordingBy(userId);
   draw();drawInterval.current=setInterval(draw,100);
   startSegments();
   segmentInterval.current=setInterval(()=>{
    recorder.current.forEach(r=>{if(r.state!=='inactive')r.stop();});
    startSegments();
   },30000);
   heartbeatInterval.current=setInterval(()=>{
    void api('recording_heartbeat').catch(e=>{setError('Recording stopped: '+e.message);stop();});
   },7000);
   setNotice('Recording active. All members see the recording indicator, and audio is transcribed after upload.');
  }catch(e){setError(e.message);stop();}
 };
 const toggleMic=async()=>{try{await room.current?.localParticipant.setMicrophoneEnabled(!mic);setMic(v=>!v);}catch(e){setError(e.message);}};
 const toggleCamera=async()=>{try{await room.current?.localParticipant.setCameraEnabled(!camera);setCamera(v=>!v);}catch(e){setError(e.message);}};
 return <section className="space-y-4 rounded-xl border border-[var(--cc-border)] p-4" data-livekit-meeting="true">
  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold"><Video size={18} className="mr-2 inline"/>Video conference · {participants} connected</h3>
   <div className="flex flex-wrap gap-2">
    {!connected?<button type="button" disabled={joining} className="ccx-primary rounded-xl px-4 py-2 text-sm" onClick={()=>void connect()}>{joining?'Connecting…':'Join meeting'}</button>:<>
     <button type="button" className={style} onClick={()=>void toggleMic()} aria-label={mic?'Mute microphone':'Unmute microphone'}>{mic?<Mic size={17}/>:<MicOff size={17}/>}</button>
     <button type="button" className={style} onClick={()=>void toggleCamera()} aria-label={camera?'Turn off camera':'Turn on camera'}>{camera?<Video size={17}/>:<VideoOff size={17}/>}</button>
     {!recording?<button type="button" className={style} onClick={()=>void start()}><Disc size={16} className="mr-1 inline"/>Record with consent</button>
      :<button type="button" className={style} onClick={stop}><Square size={16} className="mr-1 inline"/>Stop recording</button>}
     <button type="button" className={style} onClick={leave}><PhoneOff size={16} className="mr-1 inline"/>Leave</button>
    </>}
   </div></div>
  {(recordingBy||recording)&&<p role="status" aria-live="assertive" className="flex gap-2 rounded-lg border border-red-500 p-3 text-sm font-semibold text-red-700"><Disc size={17}/>This meeting is being recorded{recordingBy===userId?' by you':''}.</p>}
  <div ref={root} className={connected?'grid gap-2 sm:grid-cols-2 lg:grid-cols-3':'hidden'} aria-hidden={!connected?'true':undefined}/>
  <p className="text-xs text-[var(--cc-text-secondary)]">Powered by LiveKit. Room access is limited to current members. Any recording requires the recorded consent of all invited participants. Each clip is stored privately.</p>
  {uploads>0&&<p role="status" className="text-sm">Uploading {uploads} recording clips…</p>}
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
 </section>;
}
