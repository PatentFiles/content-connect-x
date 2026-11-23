/** Role presentation only. All mutations are authorized again by Supabase. */
import {countryAliases,displayRegion} from '../../supabase/functions/directory/locationPolicy.mjs';
export const CREATIVE_ROLES=Object.freeze(['creator','agent','studio','photographer','videographer','video_editor','director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental','chef','spa_provider']);
export const PORTFOLIO_ROLES=Object.freeze(['photographer','videographer','video_editor','director_producer','hair_stylist','makeup_artist','wardrobe_stylist','equipment_rental','chef','spa_provider']);
export const ROSTER_ROLES=Object.freeze(['agent','studio']);
/** Only the member's first chosen name belongs in the welcome heading.
 * Display/stage names take precedence over private/legal details; company
 * names and emails are never used as a person's first name.
 */
export function dashboardGreetingName(profile={}){
 const candidates=[profile?.first_name,profile?.display_name,profile?.stage_name,
  profile?.representative_name,profile?.real_name];
 for(const value of candidates){
  if(typeof value!=='string')continue;
  const clean=value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  if(!clean||clean.includes('@')||
    /^(?:host connect x member|content connect x member|member|guest|unknown)$/i.test(clean))continue;
  const first=clean.split(' ')[0].slice(0,60);
  if(first)return first;
 }
 return 'there';
}
export const roleTitle=role=>({creator:'Creator',agent:'Agent',studio:'Studio',photographer:'Photographer',videographer:'Videographer',video_editor:'Video Editor',director_producer:'Director / Producer',hair_stylist:'Hair Stylist',makeup_artist:'Makeup Artist',wardrobe_stylist:'Wardrobe Stylist',equipment_rental:'Equipment Rental',chef:'Chef / Catering',spa_provider:'Spa / Wellness'}[role]||'Member');
export function effectiveWorkspaceRole(profileRole,previewRole,isAdmin=false){return isAdmin&&CREATIVE_ROLES.includes(previewRole)?previewRole:profileRole||'creator';}
export function professionalSections(role){const base=[['basic','Basic information'],['location','Location']];if(role==='agent')return [...base,['agency','Agency details'],['roster','Roster'],['privacy','Discoverability']];if(role==='studio')return [...base,['studio','Studio details'],['roster','Roster'],['privacy','Discoverability']];if(PORTFOLIO_ROLES.includes(role))return [...base,['services',role==='video_editor'?'Editing services':'Services & rates'],['portfolio','Portfolio'],['privacy','Discoverability']];return base;}
export function localDiscoveryFilters(profile={}){const country=countryAliases(profile.country)[0]||'';return {query:'',role:'',country,state:displayRegion(profile.state,country),city:profile.city||'',category:'',gender:''};}
export const profileWithDisplayRegion=profile=>({...profile,state:displayRegion(profile?.state,profile?.country)});
export function validateWorkLink(value){try{const u=new URL(String(value||'').trim());return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&u.hostname!=='localhost'?u.href:null;}catch{return null;}}
