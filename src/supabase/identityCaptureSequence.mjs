/** Guided capture timing only; the server still validates every frame and direction. */
export function headTurnPlan(directions){
 if(!Array.isArray(directions)||directions.length!==2||directions.some(d=>!['left','right'].includes(d)))throw Error('The camera challenge is unavailable. Start a new attempt.');
 return directions.map((direction,index)=>({step:index+1,direction,instruction:`Turn your head gently to your ${direction}, hold for three seconds, then look straight back at the camera.`}));
}
/** @param {{directions:string[],signal:AbortSignal,frame:(phase:string)=>any,onCue:(cue:any)=>void,delay:(ms:number,signal:AbortSignal)=>Promise<void>,clock?:()=>number}} options */
export async function runHeadTurnSequence({directions,signal,frame,onCue,delay,clock=()=>performance.now()}){
 const plan=headTurnPlan(directions),frames=[];
 const check=()=>{if(signal.aborted)throw new DOMException('Camera capture cancelled.','AbortError');};
 const count=async(text,step,stage)=>{
  for(let remaining=3;remaining>0;remaining--){check();onCue({text,step,stage,countdown:remaining});await delay(1000,signal);}
  check();onCue({text,step,stage,countdown:null});
 };
 // Explain both movements before the user starts. These countdowns provide time
 // to position the face; none of them represent an upload or approval percentage.
 await count('Look straight at the camera. First picture in…',1,'center');
 const start_timestamp=clock();
 for(const {step,direction} of plan){
  const prefix=step===1?'turn1':'turn';
  if(step===2)await count('Second turn next. Look straight at the camera. Picture in…',step,'center');
  check();frames.push(frame(prefix+'_start'));
  onCue({text:`Turn your head gently to your ${direction} now. Keep both eyes in view and the phone still.`,step,stage:'turn',countdown:null});
  await delay(2000,signal);
  await count(`Hold your head to your ${direction}. Keep still for three seconds.`,step,'hold');
  frames.push(frame(prefix+'_peak'));
  await count('Now look straight back at the camera and hold still.',step,'return');
  frames.push(frame(prefix+'_return'));
 }
 check();return {start_timestamp,end_timestamp:clock(),frames};
}
