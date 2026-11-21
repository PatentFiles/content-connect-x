/** Audio processing is always an explicit per-member, per-room consent gate.
 * New/removed participants require a fresh approval check before AI access.
 */
export const validId=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
export function canTranscribe(memberIds,meetingConsents,collaborationConsents=null){
 if(!Array.isArray(memberIds)||memberIds.length===0||memberIds.length>250)return false;
 const ids=new Set(memberIds);
 if(ids.size!==memberIds.length||memberIds.some(id=>!validId(id)))return false;
 const approved=new Set((meetingConsents||[]).filter(x=>x.approved===true).map(x=>x.user_id));
 if(!memberIds.every(id=>approved.has(id)))return false;
 if(collaborationConsents!==null&&!memberIds.every(id=>(collaborationConsents||[]).some(
  x=>x.user_id===id&&x.recording_consent===true&&!x.revoked_at
 )))return false;
 return true;
}
export function retryAfter(reads){
 return Math.min(21600,120*Math.pow(2,Math.max(0,Math.min(7,Number(reads)-1))));
}
