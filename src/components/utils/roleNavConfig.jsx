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
  Bot
} from 'lucide-react';

export const roleNavigation = {
  creator: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Collaborations', label: 'Collaborations', icon: Briefcase },
    { path: 'Contracts', label: 'Contracts', icon: FileText },
    { path: 'Testing', label: 'Testing', icon: Shield },
    { path: 'Verification', label: 'Verification', icon: Shield },
  ],
  agent: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Collaborations', label: 'Collaborations', icon: Briefcase },
    { path: 'Representations', label: 'Representations', icon: Users },
    { path: 'Contracts', label: 'Contracts', icon: FileText },
    { path: 'Testing', label: 'Testing', icon: Shield },
  ],
  studio: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'RosterPortfolio', label: 'Roster & Portfolio', icon: Users },
    { path: 'Collaborations', label: 'Collaborations', icon: Briefcase },
    { path: 'Contracts', label: 'Contracts', icon: FileText },
    { path: 'Testing', label: 'Testing', icon: Shield },
  ],
  photographer: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Portfolio', label: 'Portfolio', icon: Camera },
    { path: 'Testing', label: 'Testing', icon: Shield },
  ],
  videographer: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Portfolio', label: 'Reels/Portfolio', icon: Video },
    { path: 'Testing', label: 'Testing', icon: Shield },
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