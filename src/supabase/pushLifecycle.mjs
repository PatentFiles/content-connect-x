/** Wait for the newly installed worker without hanging when installation fails. */
export async function waitForActiveWorker(registration,timeoutMs=10000){
 if(registration.active)return registration;
 const worker=registration.installing||registration.waiting;
 if(!worker)throw new Error('Notification worker is unavailable. Reload and try again.');
 await new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);};
  const changed=()=>{
   if(worker.state==='activated'){cleanup();resolve();}
   else if(worker.state==='redundant'){cleanup();reject(new Error('Notification worker installation failed.'));}
  };
  const timer=setTimeout(()=>{cleanup();reject(new Error('Notification worker took too long to activate.'));},timeoutMs);
  worker.addEventListener('statechange',changed);changed();
 });
 return registration;
}
