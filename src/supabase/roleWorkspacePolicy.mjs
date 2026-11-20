/** Role presentation only. All mutations are authorized again by Supabase. */
import {countryAliases,displayRegion} from '../../supabase/functions/directory/locationPolicy.mjs';
export const CREATIVE_ROLES=Object.freeze(['creator','agent','studio','photographer','videographer','video_editor']);
export const PORTFOLIO_ROLES=Object.freeze(['photographer','videographer','video_editor']);
export const ROSTER_ROLES=Object.freeze(['agent','studio']);
/** A friendly greeting uses the member's chosen public/stage name first.
 * Real/legal names are only a fallback on their own authenticated dashboard.
 * Never substitute an email or expose identity/verification documents.
 */
export function dashboardGreetingName(profile={}){
 for(const value of [
  profile?.display_name,profile?.stage_name,profile?.company_name,
  profile?.real_name,profile?.representative_name
 ]){
  if(typeof value==='string'&&value.trim())return value.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,100);
 }
 return 'there';
}
export const roleTitle=role=>({creator:'Creator',agent:'Agent',studio:'Studio',photographer:'Photographer',videographer:'Videographer',video_editor:'Video Editor'}[role]||'Member');
export function effectiveWorkspaceRole(profileRole,previewRole,isAdmin=false){return isAdmin&&CREATIVE_ROLES.includes(previewRole)?previewRole:profileRole||'creator';}
export function professionalSections(role){const base=[['basic','Basic information'],['location','Location']];if(role==='agent')return [...base,['agency','Agency details'],['roster','Roster'],['privacy','Discoverability']];if(role==='studio')return [...base,['studio','Studio details'],['roster','Roster'],['privacy','Discoverability']];if(PORTFOLIO_ROLES.includes(role))return [...base,['services',role==='video_editor'?'Editing services':'Services & rates'],['portfolio','Portfolio'],['privacy','Discoverability']];return base;}
export function localDiscoveryFilters(profile={}){const country=countryAliases(profile.country)[0]||'';return {query:'',role:'',country,state:displayRegion(profile.state,country),city:profile.city||'',category:'',gender:''};}
export const profileWithDisplayRegion=profile=>({...profile,state:displayRegion(profile?.state,profile?.country)});
export function validateWorkLink(value){try{const u=new URL(String(value||'').trim());return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&u.hostname!=='localhost'?u.href:null;}catch{return null;}}
