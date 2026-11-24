/**
 * Privacy-preserving directory filters shared by Supabase Edge and Node tests.
 * Free members can browse distant profiles but cannot contact them unless locally eligible.
 * Never accept raw SQL, PostgREST filter expressions or unrestricted columns.
 */
export const DIRECTORY_ROLES=Object.freeze([
 'creator','photographer','videographer','video_editor','agent','studio','host',
 'director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental'
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
 const orientation=clean(input.orientation,32).toLowerCase();
 if(orientation&&!['straight','gay','lesbian','bisexual','pansexual','queer','asexual','questioning'].includes(orientation))throw Error('Unsupported orientation.');
 const ethnicity=clean(input.ethnicity,32).toLowerCase();
 if(ethnicity&&!['black','white','asian','hispanic_latino','middle_eastern','native_indigenous','mixed','other'].includes(ethnicity))throw Error('Unsupported ethnicity.');
 const circumcision=clean(input.circumcision,20).toLowerCase();
 if(circumcision&&!['circumcised','uncircumcised'].includes(circumcision))throw Error('Unsupported circumcision value.');
 const breast_size=clean(input.breast_size,8).toUpperCase();
 if(breast_size&&!['AA','A','B','C','D','DD','DDD','E','F','G','H','I','J','K+'].includes(breast_size))throw Error('Unsupported breast size.');
 const bounded=(key,min,max)=>{
  const value=input[key];if(value===undefined||value===null||value==='')return null;
  const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)throw Error('Invalid '+key);
  return number;
 };
 const min_age=bounded('min_age',18,100),max_age=bounded('max_age',18,100);
 const min_height_cm=bounded('min_height_cm',100,250),max_height_cm=bounded('max_height_cm',100,250);
 const min_weight_kg=bounded('min_weight_kg',25,350),max_weight_kg=bounded('max_weight_kg',25,350);
 const min_penis_inches=bounded('min_penis_inches',1,16),max_penis_inches=bounded('max_penis_inches',1,16);
 for(const [a,b] of [[min_age,max_age],[min_height_cm,max_height_cm],[min_weight_kg,max_weight_kg],[min_penis_inches,max_penis_inches]])
  if(a!==null&&b!==null&&a>b)throw Error('Minimum cannot exceed maximum.');
 if((min_penis_inches!==null||max_penis_inches!==null||circumcision)&&!['man','trans_woman'].includes(gender))throw Error('Choose a compatible gender for anatomy filters.');
 if(breast_size&&gender!=='woman')throw Error('Choose woman for the breast size filter.');
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
  state:clean(input.state,80),category,gender,orientation,ethnicity,circumcision,breast_size,
  min_age,max_age,min_height_cm,max_height_cm,min_weight_kg,max_weight_kg,min_penis_inches,max_penis_inches,
  ids,limit,offset
 };
}
