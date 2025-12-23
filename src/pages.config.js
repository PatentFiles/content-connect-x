import AdminDashboard from './pages/AdminDashboard';
import Collaborations from './pages/Collaborations';
import Contracts from './pages/Contracts';
import CreateCollaboration from './pages/CreateCollaboration';
import Dashboard from './pages/Dashboard';
import Discovery from './pages/Discovery';
import FAQ from './pages/FAQ';
import HowItWorks from './pages/HowItWorks';
import Landing from './pages/Landing';
import Messages from './pages/Messages';
import Pricing from './pages/Pricing';
import Privacy from './pages/Privacy';
import Profile from './pages/Profile';
import Search from './pages/Search';
import Settings from './pages/Settings';
import Shortlists from './pages/Shortlists';
import Terms from './pages/Terms';
import Verification from './pages/Verification';
import ViewProfile from './pages/ViewProfile';
import Representations from './pages/Representations';
import RosterPortfolio from './pages/RosterPortfolio';
import Portfolio from './pages/Portfolio';
import Notifications from './pages/Notifications';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "Collaborations": Collaborations,
    "Contracts": Contracts,
    "CreateCollaboration": CreateCollaboration,
    "Dashboard": Dashboard,
    "Discovery": Discovery,
    "FAQ": FAQ,
    "HowItWorks": HowItWorks,
    "Landing": Landing,
    "Messages": Messages,
    "Pricing": Pricing,
    "Privacy": Privacy,
    "Profile": Profile,
    "Search": Search,
    "Settings": Settings,
    "Shortlists": Shortlists,
    "Terms": Terms,
    "Verification": Verification,
    "ViewProfile": ViewProfile,
    "Representations": Representations,
    "RosterPortfolio": RosterPortfolio,
    "Portfolio": Portfolio,
    "Notifications": Notifications,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};