/** Measured upload progress, shared by signup and the isolated private pilot.
 * Uploading 100% means bytes reached the server, NOT that storage has confirmed
 * the save. The separate saving phase stays visible until the expected session
 * and evidence receipt return. Never log files, tokens, or response bodies.
 */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const abortError=()=>new DOMException('Upload cancelled. Check status before taking another photo.','AbortError');
/** @param {{projectUrl:string,publicKey:string,getSession:()=>Promise<any>,endpoint:string,sessionId:string,kind:string,file:Blob,onProgress?:(progress:{phase:string,percent:number|null})=>void,signal?:AbortSignal,timeoutMs?:number,xhrFactory?:()=>XMLHttpRequest}} options */
export function transferIdentityEvidence({projectUrl,publicKey,getSession,endpoint,sessionId,kind,file,onProgress=()=>{},signal,timeoutMs=180000,xhrFactory=()=>new XMLHttpRequest()}){
 return new Promise((resolve,reject)=>{
  let xhr,settled=false,timer,lastPercent=0;
  const emit=(phase,percent)=>{if(!settled)onProgress({phase,percent});};
  const finish=(error,result)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
   if(error){if(xhr){xhr.onload=xhr.onerror=xhr.ontimeout=xhr.onabort=null;xhr.abort();}reject(error);}else resolve(result);
  };
  const cancel=()=>finish(abortError());
  try{
   const origin=new URL(projectUrl);
   if(origin.protocol!=='https:'||! /^[a-z]{20}\.supabase\.co$/.test(origin.hostname)||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||origin.port)throw Error('Identity upload configuration is invalid.');
   if(!['identity-verification','identity-pilot'].includes(endpoint)||!UUID.test(sessionId)||!['front','back','capture'].includes(kind))throw Error('Invalid identity upload request.');
   if(!(file instanceof Blob)||!file.size||file.size>8*1024*1024)throw Error('Use a photo no larger than 8 MB.');
   if(typeof publicKey!=='string'||!publicKey||typeof getSession!=='function')throw Error('Identity upload configuration is missing.');
   if(signal?.aborted){finish(abortError());return;}
   signal?.addEventListener('abort',cancel,{once:true});
   timer=setTimeout(()=>finish(Error('The upload timed out before its save was confirmed. Check status, then retry the same photo if it is not saved.')),timeoutMs);
   emit('authorizing',0);
   // getSession also allows the configured Supabase client to refresh its token.
   Promise.resolve().then(()=>getSession()).then(({data,error})=>{
    if(settled)return;
    const token=data?.session?.access_token;
    if(error||!token)throw Error('Your sign-in expired. Sign in again before uploading.');
    const url=origin.origin+'/functions/v1/'+endpoint;
    const body=new FormData();body.append('session_id',sessionId);body.append('kind',kind);body.append('file',file);
    xhr=xhrFactory();
    // Install upload listeners BEFORE open/send for mobile-browser compatibility.
    xhr.upload.onprogress=event=>{
     if(settled)return;
     if(!event.lengthComputable||event.total<=0){emit('uploading',null);return;}
     lastPercent=Math.max(lastPercent,Math.min(100,Math.floor(event.loaded/event.total*100)));
     emit('uploading',lastPercent);
    };
    xhr.upload.onload=()=>emit('saving',100);
    xhr.onload=()=>{
     if(settled)return;
     try{
      if(xhr.responseURL&&xhr.responseURL!==url)throw Error('Unexpected upload response. Check status before retrying.');
      const text=xhr.responseText||'';
      if(text.length>131072)throw Error('The upload response could not be confirmed. Check status before retrying.');
      let result;try{result=JSON.parse(text);}catch{throw Error('The save could not be confirmed. Check status before retrying.');}
      if(xhr.status<200||xhr.status>=300||result?.error){
       const message=typeof result?.error==='string'?result.error.slice(0,500):'The private upload failed. Check status before retrying.';
       throw Error(message);
      }
      if(endpoint==='identity-pilot'&&(result.test_only!==true||result.admission_granted!==false))throw Error('Unexpected private-test response. No approval was accepted.');
      if(result?.session?.id!==sessionId||result.session.uploaded?.[kind]!==true||(kind==='capture'&&result.session.uploaded?.selfie!==true))throw Error('The server did not confirm this photo was saved. Check status before retrying.');
      emit('complete',100);finish(null,result);
     }catch(error){finish(error);}
    };
    xhr.onerror=()=>finish(Error('The connection was interrupted. Check status before retrying the same photo.'));
    xhr.ontimeout=()=>finish(Error('The save is taking too long to confirm. Check status before retrying.'));
    xhr.onabort=cancel;
    xhr.open('POST',url,true);xhr.timeout=timeoutMs;
    xhr.setRequestHeader('Authorization','Bearer '+token);
    xhr.setRequestHeader('apikey',publicKey);
    // Do not set Content-Type: the browser must supply the multipart boundary.
    emit('uploading',0);xhr.send(body);
   }).catch(error=>finish(error));
  }catch(error){finish(error);}
 });
}
