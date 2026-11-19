/** Fixed catalog. Stored layouts contain only IDs and widths, never executable content. */
export const PEOPLE_WIDGETS=Object.freeze([
 {id:'featured_professionals',title:'Featured professionals',description:'Discover creators and production professionals',tab:'directory',kind:'people',role:''},
 {id:'featured_creators',title:'Featured creators',description:'Discover content creators with complete profiles',tab:'directory',kind:'people',role:'creator'},
 {id:'featured_videographers',title:'Featured videographers',description:'Find video-production professionals',tab:'directory',kind:'people',role:'videographer'},
 {id:'featured_photographers',title:'Featured photographers',description:'Find photography professionals',tab:'directory',kind:'people',role:'photographer'},
 {id:'featured_editors',title:'Featured video editors',description:'Find post-production professionals',tab:'directory',kind:'people',role:'video_editor'},
 {id:'creators_near_me',title:'Creators near me',description:'Creators matching your profile city and country; no GPS tracking',tab:'directory',kind:'people',role:'creator',local:true}
]);
export const DASHBOARD_WIDGETS=Object.freeze([
 {id:'profile_views',title:'Profile views',description:'Recorded opens in the last 30 days',tab:'profile'},
 {id:'connections',title:'Friends',description:'Accepted professional connections',tab:'connections'},
 {id:'connection_requests',title:'Friend requests',description:'Incoming requests awaiting a response',tab:'connections'},
 {id:'favorites',title:'Favorites',description:'Profiles you have saved',tab:'favorites'},
 {id:'unread_messages',title:'Unread messages',description:'Messages in your accessible conversations',tab:'messages'},
 {id:'collaborations',title:'Active collaborations',description:'Your open production projects',tab:'collaborations'},
 {id:'invitations',title:'Collaboration invitations',description:'Invitations awaiting your response',tab:'collaborations'},
 {id:'contracts',title:'Pending contracts',description:'Your draft and pending agreements',tab:'contracts'},
 {id:'properties',title:'Saved properties',description:'Full-width cards for approved marketplace locations you saved',tab:'hosting',kind:'properties'},
 {id:'testing',title:'Testing submissions',description:'Your private documents awaiting review',tab:'testing'},
 {id:'roster',title:'Active roster',description:'Accepted creators and pending invitations',tab:'roster',roles:['agent','studio']},
 {id:'portfolio',title:'Portfolio items',description:'Your uploaded photos and work links',tab:'portfolio',roles:['photographer','videographer','video_editor']},
 {id:'upcoming',title:'Upcoming schedule',description:'Your next 30 days of availability and travel',tab:'schedule'},
 {id:'recent_activity',title:'Recent activity',description:'Your latest notifications',tab:'notifications'},
 {id:'account',title:'Account status',description:'Your actual verification and membership status',tab:'verification'},
 ...PEOPLE_WIDGETS
]);
export const widgetsForRole=role=>DASHBOARD_WIDGETS.filter(w=>!w.roles||w.roles.includes(role));
// Retain the optional role argument for existing callers. Every role starts empty.
// Existing non-null layouts are normalized below, never reset during this release.
export function defaultDashboardLayout(_role=''){return [];}
export function normalizeDashboardLayout(layout,role){
 if(!Array.isArray(layout))return defaultDashboardLayout();
 const allowed=new Set(widgetsForRole(role).map(w=>w.id)),seen=new Set();
 return layout.filter(w=>w&&allowed.has(w.id)&&!seen.has(w.id)&&Boolean(seen.add(w.id)))
  .slice(0,32).map(w=>({id:w.id,width:w.width==='wide'?'wide':'normal'}));
}
export function moveDashboardWidget(layout,id,direction){
 const index=layout.findIndex(w=>w.id===id),next=index+direction;
 if(index<0||next<0||next>=layout.length||![-1,1].includes(direction))return layout;
 const copy=layout.slice();[copy[index],copy[next]]=[copy[next],copy[index]];return copy;
}
