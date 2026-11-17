/** Original role navigation retained; page labels follow the requested restoration. */
import {Home,Search,Compass,MessageCircle,Briefcase,FileText,Heart,Shield,Users,Camera,Video,User,Settings,UserPlus,Cross,Film,Building2} from 'lucide-react';
import {navigationForRole,ROLE_ROUTES} from './roleNavigationData.mjs';
const icons={Home,Search,Compass,MessageCircle,Briefcase,FileText,Heart,Shield,Users,Camera,Video,User,Settings,UserPlus,Cross,Film,Building2};
export function getNavigationForRole(roleType){return navigationForRole(roleType).map(({iconName,...item})=>({...item,icon:icons[iconName]}));}
export const roleNavigation=Object.fromEntries(Object.keys(ROLE_ROUTES).map(role=>[role,getNavigationForRole(role).filter(item=>!['Profile','Settings'].includes(item.path))]));
export const hostingNavItem={path:'Properties',label:'Properties',icon:Building2};
export const commonNavItems=[{path:'Profile',label:'My Profile',icon:User},{path:'Settings',label:'Settings',icon:Settings}];
export function canAccessRoute(roleType,routePath){return getNavigationForRole(roleType).some(item=>item.path===routePath);}
