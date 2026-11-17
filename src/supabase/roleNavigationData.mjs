/** Original role menus, with the explicitly requested Properties/Roster labels.
 * OnlyHost owns Host administration; it is not a CCX dashboard role.
 */
const items={Dashboard:['Dashboard','Home'],Testing:['Testing','Cross'],Discovery:['Discovery','Compass'],Search:['Search','Search'],Favorites:['Favorites','Heart'],Connections:['Friends','UserPlus'],Messages:['Messages','MessageCircle'],Collaborations:['Collaborations','Briefcase'],Contracts:['Contracts','FileText'],Verification:['Verification','Shield'],Properties:['Properties','Building2'],Roster:['Roster','Users'],Portfolio:['Portfolio','Camera'],Profile:['My Profile','User'],Settings:['Settings','Settings']};
export const ROLE_ROUTES=Object.freeze({
 creator:['Dashboard','Testing','Discovery','Search','Favorites','Connections','Messages','Collaborations','Contracts','Verification','Properties','Profile','Settings'],
 agent:['Dashboard','Testing','Discovery','Search','Favorites','Connections','Messages','Collaborations','Roster','Contracts','Properties','Profile','Settings'],
 studio:['Dashboard','Testing','Discovery','Search','Favorites','Connections','Messages','Roster','Collaborations','Contracts','Properties','Profile','Settings'],
 photographer:['Dashboard','Discovery','Search','Favorites','Connections','Messages','Portfolio','Verification','Properties','Profile','Settings'],
 videographer:['Dashboard','Discovery','Search','Favorites','Connections','Messages','Portfolio','Verification','Properties','Profile','Settings'],
 video_editor:['Dashboard','Discovery','Search','Favorites','Connections','Messages','Portfolio','Verification','Properties','Profile','Settings']
});
export const navigationForRole=role=>(ROLE_ROUTES[role]||['Profile','Settings']).map(path=>({path,label:items[path][0],iconName:path==='Portfolio'?(role==='video_editor'?'Film':role==='videographer'?'Video':'Camera'):items[path][1]}));
export const TAB_FOR_PAGE=Object.freeze({Dashboard:'dashboard',Testing:'testing',Discovery:'directory',Search:'search',Favorites:'favorites',Connections:'connections',Messages:'messages',Collaborations:'collaborations',Contracts:'contracts',Verification:'verification',Properties:'hosting',Roster:'roster',Portfolio:'portfolio',Profile:'profile',Settings:'settings'});
