import Landing from './pages/Landing';
import HowItWorks from './pages/HowItWorks';
import Pricing from './pages/Pricing';
import FAQ from './pages/FAQ';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Discovery from './pages/Discovery';
import Search from './pages/Search';
import Messages from './pages/Messages';
import Profile from './pages/Profile';
import DealRooms from './pages/DealRooms';
import Contracts from './pages/Contracts';
import Verification from './pages/Verification';
import Shortlists from './pages/Shortlists';
import Settings from './pages/Settings';
import AdminDashboard from './pages/AdminDashboard';
import ViewProfile from './pages/ViewProfile';
import CreateDealRoom from './pages/CreateDealRoom';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Landing": Landing,
    "HowItWorks": HowItWorks,
    "Pricing": Pricing,
    "FAQ": FAQ,
    "Terms": Terms,
    "Privacy": Privacy,
    "Discovery": Discovery,
    "Search": Search,
    "Messages": Messages,
    "Profile": Profile,
    "DealRooms": DealRooms,
    "Contracts": Contracts,
    "Verification": Verification,
    "Shortlists": Shortlists,
    "Settings": Settings,
    "AdminDashboard": AdminDashboard,
    "ViewProfile": ViewProfile,
    "CreateDealRoom": CreateDealRoom,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};