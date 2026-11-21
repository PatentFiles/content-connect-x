/** Fixed legal-process scope and export safety policy.
 * Never allow "all records", freeform SQL, wildcard user searches or raw
 * medical/identity/evidence files in officer case access.
 */
export const SCOPES=Object.freeze(['profile','admission','platform_activity','safety_reports','collaboration_metadata']);
export const validUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function validScopes(value){
 return Array.isArray(value)&&value.length>0&&value.length<=SCOPES.length&&
  new Set(value).size===value.length&&value.every(x=>SCOPES.includes(x));
}
export function isCaseLive(row,officer,now=Date.now()){
 return !!row&&row.officer_id===officer&&row.status==='approved'&&
  validUuid(row.subject_user_id)&&Date.parse(row.expires_at)>now&&validScopes(row.approved_scopes);
}
export function csvEscape(value){
 const normalized=String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,500);
 // Leading formula sigils must be neutralized before spreadsheet import.
 const safe=/^\s*[=+@\-\t\r]/.test(normalized)?"'"+normalized:normalized;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function reportRows(report){
 const rows=[['type','timestamp','field','value']];
 for(const [group,records] of Object.entries(report||{})){
  if(!Array.isArray(records))continue;
  for(const item of records){
   const timestamp=typeof item.created_at==='string'?item.created_at:typeof item.admitted_at==='string'?item.admitted_at:'';
   for(const [field,value] of Object.entries(item)){
    if(field==='created_at'||field==='admitted_at')continue;
    rows.push([group,timestamp,field,typeof value==='string'||typeof value==='number'||typeof value==='boolean'?value:JSON.stringify(value)]);
   }
  }
 }
 return rows;
}
export function makeCsv(report){
 return '\ufeff'+reportRows(report).map(row=>row.map(csvEscape).join(',')).join('\r\n')+'\r\n';
}
