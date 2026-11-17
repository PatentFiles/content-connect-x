/** Fixed widget catalog: arbitrary code/SQL/HTML can never be saved as a widget. */
export const DASHBOARD_WIDGETS=Object.freeze([
 {id:'profile_views',title:'Profile views',description:'Recorded opens in the last 30 days',tab:'profile'},
 {id:'connections',title:'Friends',description:'Accepted professional connections',tab:'connections'},
 {id:'connection_requests',title:'Friend requests',description:'Incoming requests awaiting a response',tab:'connections'},
 {id:'favorites',title:'Favorites',description:'Profiles you have saved',tab:'favorites'},
 {id:'unread_messages',title:'Unread messages',description:'Messages in your accessible conversations',tab:'messages'},
 {id:'collaborations',title:'Active collaborations',description:'Your open production projects',tab:'collaborations'},
 {id:'invitations',title:'Collaboration invitations',description:'Invitations awaiting your response',tab:'collaborations'},
 {id:'contracts',title:'Pending contracts',description:'Your draft and pending agreements',tab:'contracts'},
 {id:'properties',title:'Upcoming property requests',description:'Your requested or accepted future bookings',tab:'hosting'},
 {id:'testing',title:'Testing submissions',description:'Your private documents awaiting review',tab:'testing'},
 {id:'roster',title:'Active roster',description:'Accepted creators and pending invitations',tab:'roster',roles:['agent','studio']},
 {id:'portfolio',title:'Portfolio items',description:'Your uploaded photos and work links',tab:'portfolio',roles:['photographer','videographer','video_editor']},
 {id:'upcoming',title:'Upcoming schedule',description:'Your next 30 days of availability and travel',tab:'schedule'},
 {id:'recent_activity',title:'Recent activity',description:'Your latest notifications',tab:'notifications'},
 {id:'account',title:'Account status',description:'Your actual verification and membership status',tab:'verification'}
]);
export const widgetsForRole=role=>DASHBOARD_WIDGETS.filter(w=>!w.roles||w.roles.includes(role));
export function defaultDashboardLayout(role){
 const core=['profile_views','unread_messages','connection_requests','favorites'];
 const specific=['agent','studio'].includes(role)?['roster','collaborations']:
  ['photographer','videographer','video_editor'].includes(role)?['portfolio','collaborations']:['collaborations','testing'];
 return [...core,...specific,'upcoming','recent_activity'].map(id=>({id,width:['upcoming','recent_activity'].includes(id)?'wide':'normal'}));
}
export function normalizeDashboardLayout(layout,role){
 if(!Array.isArray(layout))return defaultDashboardLayout(role);
 const allowed=new Set(widgetsForRole(role).map(w=>w.id)),seen=new Set();
 return layout.filter(w=>w&&allowed.has(w.id)&&!seen.has(w.id)&&Boolean(seen.add(w.id)))
  .slice(0,15).map(w=>({id:w.id,width:w.width==='wide'?'wide':'normal'}));
}
export function moveDashboardWidget(layout,id,direction){
 const index=layout.findIndex(w=>w.id===id),next=index+direction;
 if(index<0||next<0||next>=layout.length)return layout;
 const copy=layout.slice();[copy[index],copy[next]]=[copy[next],copy[index]];return copy;
}
