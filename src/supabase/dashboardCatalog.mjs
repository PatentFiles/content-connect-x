/** Dashboard definitions contain presentation only. Counts and permissions come from Supabase. */
export const DASHBOARD_ROLES=Object.freeze(['creator','agent','studio','photographer','videographer','video_editor']);
const all=DASHBOARD_ROLES;
export const DASHBOARD_WIDGETS=Object.freeze([
 {id:'profile_views',title:'Profile views',description:'Actual profile opens in the last 30 days.',icon:'Eye',tab:'profile',roles:all},
 {id:'connections',title:'Friends',description:'Accepted professional connections.',icon:'Users',tab:'connections',roles:all},
 {id:'connection_requests',title:'Friend requests',description:'Incoming requests awaiting your response.',icon:'UserPlus',tab:'connections',roles:all},
 {id:'favorites',title:'Saved profiles',description:'People you have added to Favorites.',icon:'Heart',tab:'favorites',roles:all},
 {id:'unread_messages',title:'Unread messages',description:'Unread messages in your accessible conversations.',icon:'MessageCircle',tab:'messages',roles:all},
 {id:'collaborations',title:'Active collaborations',description:'Your projects that have not been completed or closed.',icon:'Briefcase',tab:'collaborations',roles:all},
 {id:'invitations',title:'Collaboration invitations',description:'Invitations waiting for you to respond.',icon:'Mail',tab:'collaborations',roles:all},
 {id:'contracts',title:'Agreements to finish',description:'Draft and pending agreements in your collaborations.',icon:'FileText',tab:'contracts',roles:all},
 {id:'properties',title:'Upcoming property bookings',description:'Your requested or accepted future reservations.',icon:'Building2',tab:'hosting',roles:all},
 {id:'testing',title:'Testing reviews pending',description:'Your own private submissions awaiting review; never a medical result.',icon:'ShieldCheck',tab:'testing',roles:all},
 {id:'roster',title:'Active roster',description:'Accepted creators you represent, with pending invitation count.',icon:'Users',tab:'roster',roles:['agent','studio']},
 {id:'portfolio',title:'Portfolio work',description:'Your saved photographs and work links.',icon:'Camera',tab:'portfolio',roles:['photographer','videographer','video_editor']},
 {id:'upcoming',title:'Upcoming availability',description:'Your next availability and travel entries.',icon:'CalendarDays',tab:'schedule',roles:all},
 {id:'recent_activity',title:'Recent activity',description:'Recent notifications addressed to you.',icon:'Bell',tab:'notifications',roles:all},
 {id:'account',title:'Account status',description:'Actual verification and membership status.',icon:'UserRound',tab:'verification',roles:all}
]);
export const widgetsForRole=role=>DASHBOARD_WIDGETS.filter(widget=>widget.roles.includes(role));
export function defaultDashboardLayout(role='creator'){
 const ids=['profile_views','unread_messages','connection_requests',
  ...(['agent','studio'].includes(role)?['roster']:['photographer','videographer','video_editor'].includes(role)?['portfolio']:['collaborations']),
  'favorites','recent_activity'];
 return ids.map(id=>({id,width:id==='recent_activity'?'wide':'normal'}));
}
/** Empty is an intentional saved layout, not a reason to restore defaults. */
export function normalizeDashboardLayout(layout,role='creator'){
 if(!Array.isArray(layout))return defaultDashboardLayout(role);
 const allowed=new Set(widgetsForRole(role).map(widget=>widget.id)),seen=new Set();
 return layout.filter(item=>item&&typeof item==='object'&&allowed.has(item.id)&&!seen.has(item.id)&&(seen.add(item.id),true))
  .slice(0,DASHBOARD_WIDGETS.length).map(item=>({id:item.id,width:item.width==='wide'?'wide':'normal'}));
}
export function moveDashboardWidget(layout,id,delta){
 const items=layout.map(item=>({...item})),index=items.findIndex(item=>item.id===id),next=index+delta;
 if(index<0||next<0||next>=items.length)return items;
 [items[index],items[next]]=[items[next],items[index]];return items;
}
export const ACCESS_LABELS=Object.freeze({
 verification_required:'Age verification required',membership_required:'Premium membership required',
 role_required:'Available in the matching professional role',disabled:'Turned off by an administrator',
 rollout_excluded:'Not included in the current rollout',restricted:'Account restricted',
 unavailable:'Data temporarily unavailable',preview:'Role preview — no private account data'
});
