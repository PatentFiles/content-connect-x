/** Role presentation only. All mutations are authorized again by Supabase. */
export const CREATIVE_ROLES=Object.freeze(['creator','agent','studio','photographer','videographer','video_editor']);
export const PORTFOLIO_ROLES=Object.freeze(['photographer','videographer','video_editor']);
export const ROSTER_ROLES=Object.freeze(['agent','studio']);
export const roleTitle=role=>({creator:'Creator',agent:'Agent',studio:'Studio',photographer:'Photographer',videographer:'Videographer',video_editor:'Video Editor'}[role]||'Member');
export function effectiveWorkspaceRole(profileRole,previewRole,isAdmin=false){return isAdmin&&CREATIVE_ROLES.includes(previewRole)?previewRole:profileRole||'creator';}
export function professionalSections(role){
 const base=[['basic','Basic information'],['location','Location']];
 if(role==='agent')return [...base,['agency','Agency details'],['roster','Roster'],['privacy','Discoverability']];
 if(role==='studio')return [...base,['studio','Studio details'],['roster','Roster'],['privacy','Discoverability']];
 if(PORTFOLIO_ROLES.includes(role))return [...base,['services',role==='video_editor'?'Editing services':'Services & rates'],['portfolio','Portfolio'],['privacy','Discoverability']];
 return base;
}
export function localDiscoveryFilters(profile={}){return {query:'',role:'',country:profile.country||'',state:profile.state||'',city:profile.city||'',category:'',gender:''};}
export function validateWorkLink(value){try{const u=new URL(String(value||'').trim());return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&u.hostname!=='localhost'?u.href:null;}catch{return null;}}
