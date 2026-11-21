/** Pure safety policies for neutral member-account email delivery.
 * Freeform message details, medical/test records and identity data never appear.
 */
export const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export function optedIn(prefs,security,kind){
 if(!prefs||prefs.transactional_email!==true)return false;
 if(!security||security.banned===true||security.suspended===true)return false;
 const topic=String(kind||'');
 if(/message|conversation|introduction|connection|group_member/i.test(topic)&&prefs.message_alerts===false)return false;
 if(/booking|shoot|reminder|calendar/i.test(topic)&&prefs.booking_reminders===false)return false;
 return true;
}
export function safeSender(input){
 if(typeof input!=='string'||input.length>200||/[\r\n\x00-\x1f]/.test(input))return null;
 const match=input.match(/^(?:[\p{L}0-9 .'-]{1,70}\s*<)?([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})>?$/u);
 return match?input.trim():null;
}
export function retryAfter(attempt){
 return Math.min(21600,90*Math.pow(2,Math.max(0,Math.min(7,attempt-1))));
}
export function resendRequest(notificationId,sender,recipient,origin='https://contentconnectx.com'){
 if(!uuid(notificationId)||!safeSender(sender)||!recipient||typeof recipient!=='string'||!recipient.includes('@'))throw Error('Invalid email delivery context');
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('Invalid app origin');
 return {
  from:sender,to:[recipient],
  subject:'A private Content Connect X notification is available',
  text:'A private update is available in your Content Connect X account. Sign in to view your notifications: '+url.origin+'/Notifications'
 };
}
