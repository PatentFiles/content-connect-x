/**
 * OnlyHost public, anonymous, explicitly approved listing discovery.
 * Frontend brands are different entrypoints over ONE Supabase properties table.
 * This function NEVER returns private addresses, host identities, guest details,
 * health records, unpublished media or service credentials.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'content-type,apikey','Cache-Control':'public,max-age=30'};
const respond=(v:unknown,s=200)=>Response.json(v,{status:s,headers:cors});
const allowedCategories=new Set(['film_studio','photo_studio','house','villa','loft','set','outdoor','equipment','other']);
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors,status:204});
 if(req.method!=='GET')return respond({error:'GET required'},405);
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!secret)return respond({error:'Unavailable'},503);
 const db=createClient(url,secret);
 const args=new URL(req.url).searchParams;
 const city=(args.get('city')||'').trim().slice(0,80).replace(/[%*,().]/g,'');
 const category=args.get('category')||'';
 const page=Math.min(30,Math.max(0,Number(args.get('page'))||0));
 const pageSize=24;
 try{
  let q=db.from('properties').select('id,owner_id,title,description,category,city,state,country,capacity,minimum_hours,hourly_rate,amenities,public_area_id,created_at')
    .eq('status','active').not('approved_at','is',null)
    .order('created_at',{ascending:false}).range(page*pageSize,(page+1)*pageSize-1);
  if(city)q=q.ilike('city','%'+city+'%');
  if(allowedCategories.has(category))q=q.eq('category',category);
  const {data:listings,error}=await q;if(error)throw error;
  if(!listings?.length)return respond({items:[],next_page:null});
  const ownerIds=[...new Set(listings.map(x=>x.owner_id))];
  const venueIds=listings.map(x=>x.id);
  const [verifiedHosts,ageRows,hostAccounts,bannedRows,photos,areas]=await Promise.all([
   db.from('host_verification_requests').select('property_id,owner_id,expires_at').in('property_id',venueIds).eq('status','approved'),
   db.from('age_verification_requests').select('user_id,status,expires_at,created_at').in('user_id',ownerIds).order('created_at',{ascending:false}).limit(500),
   db.from('onlyhost_accounts').select('user_id,status,terms_version').in('user_id',ownerIds),
   db.from('account_security').select('user_id,banned,suspended').in('user_id',ownerIds),
   db.from('property_images').select('id,property_id,storage_path,caption,position').in('property_id',venueIds).eq('status','approved').order('position').limit(200),
   db.from('hosting_public_areas').select('id,latitude,longitude,city,region').eq('approved',true).limit(500)
  ]);
  for(const r of [verifiedHosts,ageRows,hostAccounts,bannedRows,photos,areas])if(r.error)throw r.error;
  const now=Date.now(),bad=new Set((bannedRows.data||[]).filter(v=>v.banned||v.suspended).map(v=>v.user_id));
  const ages=new Map();
  for(const v of ageRows.data||[])if(!ages.has(v.user_id))ages.set(v.user_id,v);
  const acceptedHosts=new Set((hostAccounts.data||[]).filter(v=>v.status==='active'&&v.terms_version==='host-2026-11-17').map(v=>v.user_id));
  const hostVenues=new Set((verifiedHosts.data||[]).filter(v=>!v.expires_at||Date.parse(v.expires_at)>now).map(v=>v.property_id));
  const areaById=new Map((areas.data||[]).map(v=>[v.id,v]));
  const approved=listings.filter(v=>{
   const age=ages.get(v.owner_id);
   return hostVenues.has(v.id)&&!bad.has(v.owner_id)&&(acceptedHosts.has(v.owner_id)||age?.status==='approved'&&
    (!age.expires_at||Date.parse(age.expires_at)>now));
  });
  const images=(photos.data||[]);
  const items=await Promise.all(approved.map(async v=>{
   const raw=images.filter(p=>p.property_id===v.id).slice(0,3),photosPublic=[];
   for(const pic of raw){
    const {data,error}=await db.storage.from('property-images').createSignedUrl(pic.storage_path,300);
    if(!error&&data?.signedUrl)photosPublic.push({url:data.signedUrl,caption:pic.caption||'Property image'});
   }
   const area=areaById.get(v.public_area_id);
   return {
    id:v.id,title:v.title,description:v.description,category:v.category,
    city:v.city,state:v.state,country:v.country,capacity:v.capacity,
    minimum_hours:v.minimum_hours,hourly_rate:v.hourly_rate,amenities:v.amenities,
    photos:photosPublic,public_area:area?{
     city:area.city,region:area.region,latitude:area.latitude,longitude:area.longitude
    }:null
   };
  }));
  return respond({items,next_page:listings.length===pageSize?page+1:null,
   disclaimer:'Only independently approved listings are displayed; location pins represent public areas, not property addresses.'});
 }catch(e){console.error('onlyhost-public',String(e).slice(0,160));return respond({error:'Listings currently unavailable'},503);}
});
