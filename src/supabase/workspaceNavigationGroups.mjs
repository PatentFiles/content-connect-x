/** Pure navigation presentation model.
 * Menus come from the existing role/feature access rules; grouping never grants
 * a page or changes a backend permission. Extras are existing account pages.
 */
export const WORKSPACE_NAV_GROUPS=Object.freeze([
 {id:'overview',label:'Overview',paths:['Dashboard']},
 {id:'explore',label:'Explore',paths:['Discovery','Search','Favorites','Shop','Properties']},
 {id:'community',label:'Community',paths:['Connections','Groups','Messages']},
 {id:'collaborate',label:'Collaborations',paths:['Collaborations','Contracts','Roster','Representations','Portfolio']},
 {id:'safety',label:'Safety & verification',paths:['Testing','Verification']},
 {id:'personal',label:'Personal',paths:['Profile','PublicProfile','YearInReview','Notifications']},
 {id:'account',label:'Account',paths:['Membership','Settings']},
 {id:'admin',label:'Admin',paths:['AdminDashboard','TestingReviews']},
 {id:'integrations',label:'Integrations',paths:['CompliancePortal']}
].map(group=>Object.freeze({...group,paths:Object.freeze(group.paths)})));

/** Render only existing role/admin links and explicitly supplied account links.
 * Retains each existing icon, label and destination and never duplicates an item.
 */
export function groupedWorkspaceNavigation(roleLinks=[],adminLinks=[],accountLinks=[]){
 const all=[...roleLinks,...adminLinks,...accountLinks];
 const byPath=new Map();
 for(const item of all){
  if(!item||typeof item.path!=='string'||byPath.has(item.path))continue;
  byPath.set(item.path,item);
 }
 const used=new Set();
 const groups=WORKSPACE_NAV_GROUPS.map(section=>{
  const items=section.paths.flatMap(path=>{
   const item=byPath.get(path);
   if(!item||used.has(path))return [];
   used.add(path);
   return [item];
  });
  return {...section,items};
 }).filter(group=>group.items.length>0);
 const other=[...byPath.values()].filter(item=>!used.has(item.path));
 if(other.length)groups.push({id:'other',label:'More',paths:[],items:other});
 return groups;
}

export function currentNavigationGroup(groups,tab,toTab){
 const group=(groups||[]).find(section=>section.items.some(item=>toTab(item.path)===tab));
 return group?.id||null;
}
