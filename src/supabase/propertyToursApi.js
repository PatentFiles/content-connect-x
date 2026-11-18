import {supabase} from '@/api/supabaseClient';
import {normalizeMatterportUrl,matterportLinkFromText} from './propertyTourPolicy.mjs';
/** Store a hosted link or a raw source archive. A ZIP is never called a playable tour. */
export async function saveNewPropertyTour(propertyId,url,file){
 if(file&&!/\.(txt|url|webloc|json|zip)$/i.test(file.name))throw Error('Use a Matterport link file or ZIP source archive.');
 let link=url?normalizeMatterportUrl(url):null;
 if(url&&!link)throw Error('Enter a valid Matterport Showcase share link.');
 if(file&&/\.(txt|url|webloc|json)$/i.test(file.name)){
  if(file.size>100000)throw Error('A tour link file must be under 100KB.');
  link=matterportLinkFromText(await file.text());if(!link)throw Error('The uploaded file has no Matterport Showcase link.');
 }
 if(link){const {error}=await supabase.rpc('ccx_property_tour',{p_property:propertyId,p_action:'save',p_url:link});if(error)throw error;}
 if(file&&/\.zip$/i.test(file.name)){
  if(file.size>50*1024*1024)throw Error('The source ZIP must be under 50MB.');
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw Error('Sign in required.');
  const path=user.id+'/'+propertyId+'/'+crypto.randomUUID()+'.zip';
  const {error}=await supabase.storage.from('property-tour-sources').upload(path,file,{contentType:'application/zip',upsert:false});if(error)throw error;
  const {error:recordError}=await supabase.from('property_tour_sources').insert({property_id:propertyId,user_id:user.id,storage_path:path,original_name:file.name.slice(0,200)});
  if(recordError){await supabase.storage.from('property-tour-sources').remove([path]);throw recordError;}
 }
}
