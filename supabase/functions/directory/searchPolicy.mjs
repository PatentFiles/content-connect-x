/**
 * Privacy-preserving directory filters shared by Supabase Edge and Node tests.
 * Free members can browse distant profiles but cannot contact them unless locally eligible.
 * Never accept raw SQL, PostgREST filter expressions or unrestricted columns.
 */
export const DIRECTORY_ROLES=Object.freeze([
 'creator','photographer','videographer','video_editor','agent','studio','host'
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
 const category=clean(input.category,40).toLowerCase();
 if(category&&!['standard','fetish','kink_edge'].includes(category))throw Error('Unsupported content category.');
 const gender=clean(input.gender,40).toLowerCase();
 if(gender&&!['man','woman','trans_man','trans_woman','nonbinary','genderfluid'].includes(gender))throw Error('Unsupported gender identity.');
 // Favorites can only request profile UUIDs; the server still checks independent verification.
 const ids=Array.isArray(input.ids)?[...new Set(input.ids.filter(
  id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
 ))].slice(0,100):null;
 const limit=premium?24:12;
 const offset=Number.isInteger(input.offset)
  ?Math.max(0,Math.min(480,input.offset)):0;
 return {
  query:clean(input.query),
  role,
  city:clean(input.city,80),
  country:clean(input.country,80),
  state:clean(input.state,80),category,gender,ids,
  limit,offset
 };
}
