import AdminDashboard from './pages/AdminDashboard';
import Contracts from './pages/Contracts';
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
import CreateCollaboration from './pages/CreateCollaboration';
import Collaborations from './pages/Collaborations';
import ViewProfile from './pages/ViewProfile';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "Contracts": Contracts,
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
    "CreateCollaboration": CreateCollaboration,
    "Collaborations": Collaborations,
    "ViewProfile": ViewProfile,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};