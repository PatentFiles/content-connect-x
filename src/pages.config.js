import AdminDashboard from './pages/AdminDashboard';
import AgentManagement from './pages/AgentManagement';
import AvailabilitySchedule from './pages/AvailabilitySchedule';
import CollaborationDetail from './pages/CollaborationDetail';
import Collaborations from './pages/Collaborations';
import CompliancePortal from './pages/CompliancePortal';
import Connections from './pages/Connections';
import Contracts from './pages/Contracts';
import CreateCollaboration from './pages/CreateCollaboration';
import Dashboard from './pages/Dashboard';
import Discovery from './pages/Discovery';
import FAQ from './pages/FAQ';
import Favorites from './pages/Favorites';
import HowItWorks from './pages/HowItWorks';
import Landing from './pages/Landing';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Portfolio from './pages/Portfolio';
import Pricing from './pages/Pricing';
import Privacy from './pages/Privacy';
import Profile from './pages/Profile';
import Representations from './pages/Representations';
import RosterPortfolio from './pages/RosterPortfolio';
import Search from './pages/Search';
import Settings from './pages/Settings';
import Terms from './pages/Terms';
import Testing from './pages/Testing';
import TravelSchedule from './pages/TravelSchedule';
import Verification from './pages/Verification';
import ViewContract from './pages/ViewContract';
import ViewProfile from './pages/ViewProfile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "AgentManagement": AgentManagement,
    "AvailabilitySchedule": AvailabilitySchedule,
    "CollaborationDetail": CollaborationDetail,
    "Collaborations": Collaborations,
    "CompliancePortal": CompliancePortal,
    "Connections": Connections,
    "Contracts": Contracts,
    "CreateCollaboration": CreateCollaboration,
    "Dashboard": Dashboard,
    "Discovery": Discovery,
    "FAQ": FAQ,
    "Favorites": Favorites,
    "HowItWorks": HowItWorks,
    "Landing": Landing,
    "Messages": Messages,
    "Notifications": Notifications,
    "Portfolio": Portfolio,
    "Pricing": Pricing,
    "Privacy": Privacy,
    "Profile": Profile,
    "Representations": Representations,
    "RosterPortfolio": RosterPortfolio,
    "Search": Search,
    "Settings": Settings,
    "Terms": Terms,
    "Testing": Testing,
    "TravelSchedule": TravelSchedule,
    "Verification": Verification,
    "ViewContract": ViewContract,
    "ViewProfile": ViewProfile,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};