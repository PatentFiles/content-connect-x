import { 
  Home, 
  Search, 
  Compass, 
  MessageCircle, 
  Briefcase, 
  FileText, 
  Heart,
  Shield,
  Users,
  Camera,
  Video,
  User,
  Settings,
  Bot,
  UserPlus,
  Cross
} from 'lucide-react';

export const roleNavigation = {
  creator: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Testing', label: 'Testing', icon: Cross },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Connections', label: 'Friends', icon: UserPlus },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Collaborations', label: 'Collaborations', icon: Briefcase },
    { path: 'Contracts', label: 'Contracts', icon: FileText },
    { path: 'Verification', label: 'Verification', icon: Shield },
  ],
  agent: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Testing', label: 'Testing', icon: Cross },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Connections', label: 'Friends', icon: UserPlus },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Collaborations', label: 'Collaborations', icon: Briefcase },
    { path: 'Representations', label: 'Representations', icon: Users },
    { path: 'Contracts', label: 'Contracts', icon: FileText },
  ],
  studio: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Testing', label: 'Testing', icon: Cross },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Connections', label: 'Friends', icon: UserPlus },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'RosterPortfolio', label: 'Roster & Portfolio', icon: Users },
    { path: 'Collaborations', label: 'Collaborations', icon: Briefcase },
    { path: 'Contracts', label: 'Contracts', icon: FileText },
  ],
  photographer: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Testing', label: 'Testing', icon: Cross },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Connections', label: 'Friends', icon: UserPlus },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Portfolio', label: 'Portfolio', icon: Camera },
    { path: 'Collaborations', label: 'Collaborations', icon: Briefcase },
    { path: 'Contracts', label: 'Contracts', icon: FileText },
    { path: 'Verification', label: 'Verification', icon: Shield },
  ],
  videographer: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Testing', label: 'Testing', icon: Cross },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Connections', label: 'Friends', icon: UserPlus },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Portfolio', label: 'Reels/Portfolio', icon: Video },
    { path: 'Collaborations', label: 'Collaborations', icon: Briefcase },
    { path: 'Contracts', label: 'Contracts', icon: FileText },
    { path: 'Verification', label: 'Verification', icon: Shield },
  ],
};

export const commonNavItems = [
  { path: 'Profile', label: 'My Profile', icon: User },
  { path: 'Settings', label: 'Settings', icon: Settings },
];

export function getNavigationForRole(roleType) {
  const roleNav = roleNavigation[roleType] || roleNavigation.creator;
  return [...roleNav, ...commonNavItems];
}

export function canAccessRoute(roleType, routePath) {
  const allowedRoutes = getNavigationForRole(roleType).map(item => item.path);
  return allowedRoutes.includes(routePath);
}