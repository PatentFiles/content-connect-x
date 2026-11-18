/** Conservative allowlist. Never forward free-form event messages or request data. */
export function sanitizeMonitoringEvent(event){
 const safe={type:undefined};
 for(const key of ['event_id','timestamp','level','platform','release','environment']){
  if(typeof event?.[key]==='string'||typeof event?.[key]==='number')safe[key]=event[key];
 }
 if(event?.exception?.values)safe.exception={values:event.exception.values.map(item=>({
  type:/^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(item.type||'')?item.type:'ApplicationError',
  value:'Application error',
  stacktrace:{frames:(item.stacktrace?.frames||[]).map(frame=>({
   // Browser-bundle paths only; no query tokens, functions, locals, or arguments.
   filename:cleanFrameUrl(frame.filename||frame.abs_path),lineno:frame.lineno,colno:frame.colno,in_app:frame.in_app
  }))}
 }))};
 return safe;
}
function cleanFrameUrl(value){
 try{const url=new URL(value);return /^https?:$/.test(url.protocol)&&/^\/assets\/[A-Za-z0-9_.\/-]+$/.test(url.pathname)?url.pathname:undefined;}catch{return undefined;}
}
