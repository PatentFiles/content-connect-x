/** Original role menus, with the explicitly requested Properties/Roster labels.
 * OnlyHost owns Host administration; it is not a CCX dashboard role.
 */
const items={Dashboard:['Dashboard','Home'],Testing:['Testing','Cross'],Discovery:['Discovery','Compass'],Favorites:['Favorites','Heart'],Connections:['Friends','UserPlus'],Groups:['Groups','Users'],Messages:['Messages','MessageCircle'],Collaborations:['Collaborations','Briefcase'],Contracts:['Contracts','FileText'],Verification:['Verification','Shield'],Properties:['Properties','Building2'],Shop:['Shop','ShoppingBag'],Roster:['Roster','Users'],Representations:['My Representation','Users'],Portfolio:['Portfolio','Camera'],Profile:['My Profile','User'],Settings:['Settings','Settings']};
export const ROLE_ROUTES=Object.freeze({
 creator:['Dashboard','Testing','Discovery','Favorites','Connections','Groups','Messages','Collaborations','Representations','Contracts','Verification','Properties','Shop','Profile','Settings'],
 agent:['Dashboard','Testing','Discovery','Favorites','Connections','Groups','Messages','Collaborations','Roster','Contracts','Properties','Shop','Profile','Settings'],
 studio:['Dashboard','Testing','Discovery','Favorites','Connections','Groups','Messages','Roster','Collaborations','Contracts','Properties','Shop','Profile','Settings'],
 photographer:['Dashboard','Discovery','Favorites','Connections','Groups','Messages','Collaborations','Representations','Contracts','Portfolio','Verification','Properties','Shop','Profile','Settings'],
 videographer:['Dashboard','Discovery','Favorites','Connections','Groups','Messages','Collaborations','Representations','Contracts','Portfolio','Verification','Properties','Shop','Profile','Settings'],
 video_editor:['Dashboard','Discovery','Favorites','Connections','Groups','Messages','Collaborations','Representations','Contracts','Portfolio','Verification','Properties','Shop','Profile','Settings']
});
export const navigationForRole=role=>(ROLE_ROUTES[role]||['Profile','Settings']).map(path=>({path,label:items[path][0],iconName:path==='Portfolio'?(role==='video_editor'?'Film':role==='videographer'?'Video':'Camera'):items[path][1]}));
export const TAB_FOR_PAGE=Object.freeze({Dashboard:'dashboard',Testing:'testing',Discovery:'directory',Search:'directory',Favorites:'favorites',Connections:'connections',Groups:'groups',Messages:'messages',Collaborations:'collaborations',Contracts:'contracts',Verification:'verification',Properties:'hosting',Shop:'shop',Roster:'roster',Representations:'roster',Portfolio:'portfolio',Profile:'profile',Settings:'settings'});
