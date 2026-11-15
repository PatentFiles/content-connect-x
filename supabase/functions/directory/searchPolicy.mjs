/**
 * Privacy-preserving directory filters shared by Supabase Edge and Node tests.
 * Free directory previews have a fixed limit and cannot request later pages.
 * Never accept raw SQL, PostgREST filter expressions or unrestricted columns.
 */
export const DIRECTORY_ROLES=Object.freeze([
 'creator','photographer','videographer','video_editor','agent','studio'
]);
const clean=(value,max=80)=>typeof value==='string'
 ?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' ').slice(0,max)
 :'';
/** Escape Postgres LIKE wildcards. Search text is always a literal substring. */
export const escapeLikeLiteral=value=>String(value).replace(/[\\%_]/g,c=>'\\'+c);
export function directoryFilters(raw={},premium=false){
 const input=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const role=clean(input.role,32).toLowerCase();
 if(role&&!DIRECTORY_ROLES.includes(role))throw new Error('Unsupported creator type.');
 const limit=premium?24:12;
 const offset=premium&&Number.isInteger(input.offset)
  ?Math.max(0,Math.min(480,input.offset)):0;
 return {
  query:clean(input.query),
  role,
  city:clean(input.city,80),
  country:clean(input.country,80),
  limit,offset
 };
}
