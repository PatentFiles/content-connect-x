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
  Cross,
  Film,
  Building2,
  BarChart3
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
    { path: 'HostingMarketplace', label: 'Host Properties', icon: Building2 },
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
    { path: 'HostingMarketplace', label: 'Host Properties', icon: Building2 },
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
    { path: 'HostingMarketplace', label: 'Host Properties', icon: Building2 },
  ],
  photographer: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Connections', label: 'Friends', icon: UserPlus },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Portfolio', label: 'Portfolio', icon: Camera },
    { path: 'Verification', label: 'Verification', icon: Shield },
    { path: 'HostingMarketplace', label: 'Host Properties', icon: Building2 },
  ],
  videographer: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Connections', label: 'Friends', icon: UserPlus },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Portfolio', label: 'Reels/Portfolio', icon: Video },
    { path: 'Verification', label: 'Verification', icon: Shield },
    { path: 'HostingMarketplace', label: 'Host Properties', icon: Building2 },
  ],
  video_editor: [
    { path: 'Dashboard', label: 'Dashboard', icon: Home },
    { path: 'Discovery', label: 'Discover', icon: Compass },
    { path: 'Search', label: 'Search', icon: Search },
    { path: 'Favorites', label: 'Favorites', icon: Heart },
    { path: 'Connections', label: 'Friends', icon: UserPlus },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'Portfolio', label: 'Portfolio', icon: Film },
    { path: 'Verification', label: 'Verification', icon: Shield },
    { path: 'HostingMarketplace', label: 'Host Properties', icon: Building2 },
  ],
  host: [
    { path: 'HostDashboard', label: 'Dashboard', icon: Home },
    { path: 'HostingMarketplace', label: 'Host Properties', icon: Building2 },
    { path: 'Messages', label: 'Messages', icon: MessageCircle },
    { path: 'HostProfile', label: 'My Profile', icon: User },
    { path: 'HostSettings', label: 'Settings', icon: Settings },
  ],
};

export const hostingNavItem = { path: 'HostingMarketplace', label: 'Hosting', icon: Building2 };

export const commonNavItems = [
  { path: 'Profile', label: 'My Profile', icon: User },
  { path: 'Settings', label: 'Settings', icon: Settings },
];

export function getNavigationForRole(roleType) {
  const roleNav = roleNavigation[roleType] || roleNavigation.creator;
  // Host has its own profile/settings links in its nav array — skip commonNavItems
  if (roleType === 'host') return roleNav;
  return [...roleNav, ...commonNavItems];
}

export function canAccessRoute(roleType, routePath) {
  const allowedRoutes = getNavigationForRole(roleType).map(item => item.path);
  return allowedRoutes.includes(routePath);
}