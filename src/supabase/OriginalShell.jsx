/** Original header, sidebar, mobile drawer and bottom navigation. Supabase only. */
import React,{useEffect,useMemo,useState} from 'react';
import {Bell,ChevronRight,ExternalLink,LogOut,Menu,Settings,Shield,X,CreditCard} from 'lucide-react';
import {getNavigationForRole} from './originalRoleNav';
import {isModuleVisible} from './featureModules.mjs';
import {RoleWorkspaceContext} from './RoleWorkspaceContext';
import {effectiveWorkspaceRole} from './roleWorkspacePolicy.mjs';
import ModuleAccessBoundary from './ModuleAccessBoundary';
import SponsorshipSlot from './SponsorshipSlot';
import {supabase} from '@/api/supabaseClient';
const routeMap=Object.freeze({
 Dashboard:'dashboard',Discovery:'directory',Search:'directory',Favorites:'favorites',Connections:'connections',Groups:'groups',Messages:'messages',Collaborations:'collaborations',
 Contracts:'contracts',Testing:'testing',Verification:'verification',Properties:'hosting',HostingMarketplace:'hosting',HostDashboard:'host',HostProfile:'profile',
 HostSettings:'host-settings',Profile:'profile',Settings:'settings',Representations:'roster',Roster:'roster',RosterPortfolio:'roster',Portfolio:'portfolio',
 Invitations:'notifications',Notifications:'notifications',AccountSecurity:'account-security',Consent:'consent',ProductionManager:'production',AvailabilitySchedule:'schedule',TravelSchedule:'schedule',AdminDashboard:'controls',AgentManagement:'controls',
 DeveloperReadMe:'developer',CompliancePortal:'integrations',TestingReviews:'testing-reviews',Pricing:'membership',Membership:'membership',
 CreateCollaboration:'collaborations',CollaborationDetail:'collaborations',ViewProfile:'directory',ViewContract:'contracts',PropertyDetail:'hosting'
});
const keyFor=path=>routeMap[path]||'dashboard';
const reverseRoutes={dashboard:'Dashboard',directory:'Discovery',favorites:'Favorites',connections:'Connections',groups:'Groups',messages:'Messages',collaborations:'Collaborations',
 contracts:'Contracts',testing:'Testing',verification:'Verification',hosting:'Properties',host:'HostDashboard',profile:'Profile',settings:'Settings',portfolio:'Portfolio',
 invitations:'Notifications',notifications:'Notifications','account-security':'AccountSecurity',consent:'Consent',production:'ProductionManager',schedule:'AvailabilitySchedule',representations:'Roster',roster:'Roster','host-settings':'HostSettings',controls:'AdminDashboard',integrations:'CompliancePortal','testing-reviews':'TestingReviews',membership:'Pricing'};
export const tabFromLegacyPath=pathname=>{const part=decodeURIComponent(String(pathname||'').split('/').filter(Boolean)[0]||'');const matched=Object.keys(routeMap).find(key=>key.toLowerCase()===part.toLowerCase());return matched?routeMap[matched]:'dashboard';};
export const legacyPathForTab=tab=>'/'+(reverseRoutes[tab]||'Dashboard');
const tabMatches=(tab,path)=>tab===keyFor(path);
const roleLabel={creator:'Creator',agent:'Agent',studio:'Studio',photographer:'Photographer',videographer:'Videographer',video_editor:'Video Editor'};
const navBackground='var(--cc-surface-hover)';
const sideText='var(--cc-text-secondary)';
function RoleDashboardSwitcher({value,onChange,mobile=false}){
 return <section aria-label="Admin dashboard switcher" className={'border-b p-4 '+(mobile?'space-y-3':'space-y-2')} style={{borderColor:'var(--cc-border)'}}>
  <p className="text-xs font-semibold uppercase tracking-wider" style={{color:'var(--cc-text-muted)'}}>Switch dashboard</p>
  <p className="text-[11px] leading-4" style={{color:'var(--cc-text-secondary)'}}>Admin preview only. It does not change your account role or bypass protected permissions.</p>
  <div className="grid grid-cols-2 gap-1.5">{[['admin','My dashboard'],...Object.entries(roleLabel)].map(([key,label])=>
   <button key={key} type="button" aria-pressed={value===key} onClick={()=>onChange(key)} className="min-h-9 rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-colors"
    style={{borderColor:value===key?'var(--cc-blue)':'var(--cc-border)',backgroundColor:value===key?navBackground:'var(--cc-surface)',color:value===key?'var(--cc-blue)':'var(--cc-text-secondary)'}}>{label}</button>)}
  </div>
 </section>;
}
function MenuLink({item,tab,onNavigate,onClose=()=>{},mobile=false}){
 const Icon=item.icon,isActive=tabMatches(tab,item.path);
 return <button type="button" onClick={()=>{onNavigate(keyFor(item.path));onClose?.();}}
  className={'relative flex w-full items-center gap-3 rounded-lg text-left transition-colors duration-200 '+(mobile?'px-4 py-3':'px-3 py-2.5')}
  aria-current={isActive?'page':undefined} style={{backgroundColor:isActive?navBackground:'transparent',color:isActive?'var(--cc-blue)':sideText}}>
  {isActive&&<span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full" style={{backgroundColor:'var(--cc-blue)'}}/>}
  <Icon className="h-5 w-5 shrink-0" aria-hidden="true"/><span className="text-sm font-medium">{item.label}</span>
 </button>;
}
export default function OriginalShell({children,tab,onNavigate,user,profile,isAdmin=false,approved=false,onSignOut,onRolePreviewChange,featureFlags=null,isPremiumMember=false}){
 const [mobileOpen,setMobileOpen]=useState(false),[adminRole,setAdminRole]=useState('admin');
 const [unread,setUnread]=useState(0);
 const shellRef=React.useRef(null),headerRef=React.useRef(null);
 useEffect(()=>{
  const header=headerRef.current,shell=shellRef.current;
  if(!header||!shell)return;
  // Wrapped header actions must push the sidebar/content down by their REAL
  // height; a fixed 4rem offset overlaps content at small widths or large text.
  const measure=()=>shell.style.setProperty('--cc-shell-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  measure();
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
  observer?.observe(header);window.addEventListener('resize',measure);
  return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
 },[]);

 const role=profile?.role_type||'creator';
 const effectiveRole=effectiveWorkspaceRole(role,adminRole,isAdmin);
 const switchDashboard=next=>{setAdminRole(next);onRolePreviewChange?.(next==='admin'?null:next);onNavigate('dashboard');setMobileOpen(false);};
 const nav=useMemo(()=>getNavigationForRole(effectiveRole).filter(item=>isModuleVisible(keyFor(item.path),featureFlags)),[effectiveRole,featureFlags]);
 const adminNav=useMemo(()=>isAdmin?[
  {path:'AdminDashboard',label:'Platform Controls',icon:Shield},{path:'CompliancePortal',label:'API & Integrations',icon:Settings},{path:'TestingReviews',label:'Testing Reviews',icon:Shield}
 ]:[],[isAdmin]);
 const workspace=useMemo(()=>({role:effectiveRole,actualRole:role,preview:isAdmin&&effectiveRole!==role,tab,profile,user,isAdmin,onNavigate,account:featureFlags?.__ccxAccount,featureAccess:featureFlags?.__ccxAccess}),[effectiveRole,role,isAdmin,tab,profile,user,onNavigate,featureFlags]);
 useEffect(()=>{setMobileOpen(false);},[tab]);
 useEffect(()=>{
  let live=true;if(!user?.id)return;
  const update=async()=>{const {count,error}=await supabase.from('member_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).is('read_at',null);if(live&&!error)setUnread(count||0);};
  void update();
  const channel=supabase.channel('header-notifications-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'member_notifications',filter:'recipient_id=eq.'+user.id},()=>void update()).subscribe();
  const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void update();},30000);
  const refresh=()=>void update();window.addEventListener('ccx-data-changed',refresh);window.addEventListener('focus',refresh);
  return()=>{live=false;window.clearInterval(timer);window.removeEventListener('ccx-data-changed',refresh);window.removeEventListener('focus',refresh);void supabase.removeChannel(channel);};
 },[user?.id,tab]);
 useEffect(()=>{const handler=e=>{if(e.key==='Escape')setMobileOpen(false);};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
 return <RoleWorkspaceContext.Provider value={workspace}><div ref={shellRef} className="ccx-original-shell min-h-screen" style={{background:'var(--cc-bg)',color:'var(--cc-text-primary)'}}>
  <header ref={headerRef} className="ccx-shell-fixed-header fixed left-0 right-0 top-0 z-40 border-b backdrop-blur-xl" style={{paddingTop:'env(safe-area-inset-top,0px)',backgroundColor:'color-mix(in srgb,var(--cc-bg) 95%,transparent)',borderColor:'var(--cc-border)'}}>
   <div className="ccx-shell-toolbar">
    <button type="button" className="flex shrink-0 items-center gap-2" onClick={()=>onNavigate('dashboard')} aria-label="Content Connect X dashboard">
     <span className="ccx-monogram" aria-hidden="true">CX</span><span className="hidden text-lg font-semibold sm:block">Content Connect X</span>
    </button>
    <div className="ccx-shell-header-actions">
     {isAdmin&&<a href="/hostconnect" className="ccx-admin-host-link" aria-label="Open Host Connect">Host Connect</a>}
     <button type="button" onClick={()=>onNavigate('membership')} aria-label={'Membership: '+(isPremiumMember?'Premium Account':'Free Account')+'; view plans'} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-semibold sm:px-3" style={{borderColor:'var(--cc-border)',background:'var(--cc-surface)',color:'var(--cc-text-primary)'}}>
      <CreditCard size={15} className="text-[var(--cc-link)]"/><span className="hidden sm:inline">Membership</span><span>{isPremiumMember?'Premium':'Free'}</span>
     </button>
     <button type="button" onClick={()=>onNavigate('notifications')} title="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Notifications"><Bell size={20}/>{unread>0&&<span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{unread>9?'9+':unread}</span>}</button>
     <button type="button" onClick={()=>onNavigate('settings')} className="hidden h-10 w-10 items-center justify-center rounded-lg md:flex" aria-label="Settings"><Settings size={20}/></button>
     <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg md:hidden" aria-label="Open navigation menu" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Menu size={24}/></button>
    </div>
   </div>
  </header>
  <aside className="ccx-shell-sidebar fixed bottom-0 left-0 hidden w-64 flex-col border-r md:flex" style={{top:'var(--cc-shell-header-height,calc(4rem + env(safe-area-inset-top,0px)))',backgroundColor:'var(--cc-surface)',borderColor:'var(--cc-border)'}}>
   <div className="border-b p-4" style={{borderColor:'var(--cc-border)'}}>
    <button className="flex w-full items-center gap-3 rounded-lg p-2 text-left" onClick={()=>onNavigate('profile')}>
     <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full" style={{background:'var(--cc-surface-hover)',color:'var(--cc-blue)'}}>{profile?.avatar_path?<img src={profile.avatar_path} alt="" className="h-full w-full object-cover"/>:(profile?.display_name||'U').slice(0,1).toUpperCase()}</span>
     <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{profile?.display_name||'Set up profile'}</span><span className="mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs capitalize" style={{borderColor:'var(--cc-border)',color:'var(--cc-text-secondary)'}}>{roleLabel[role]||role}</span></span><ChevronRight size={16} style={{color:'var(--cc-text-muted)'}}/>
    </button>
    <button type="button" className="mt-2 flex items-center gap-2 px-2 text-xs" onClick={()=>onNavigate('directory')} style={{color:'var(--cc-blue)'}}><ExternalLink size={12}/> View Public Profile</button>
   </div>
   {isAdmin&&<RoleDashboardSwitcher value={adminRole} onChange={switchDashboard}/>}
   <nav aria-label="Role navigation" className="flex-1 space-y-1 overflow-y-auto p-4">
    {isAdmin&&adminRole==='admin'&&<><div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider" style={{color:'var(--cc-text-muted)'}}>Admin</div>{adminNav.map(item=><MenuLink key={item.path} item={item} tab={tab} onNavigate={onNavigate}/>)}<div className="my-2 border-b" style={{borderColor:'var(--cc-border)'}}/></>}
    {nav.map(item=><MenuLink key={item.path} item={item} tab={tab} onNavigate={onNavigate}/>)}
   </nav>
   <SponsorshipSlot placement="sidebar"/>
   <div className="border-t p-4" style={{borderColor:'var(--cc-border)'}}><button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm" style={{color:'var(--cc-text-secondary)'}}><LogOut size={20}/>Log Out</button></div>
  </aside>
  {mobileOpen&&<div className="fixed inset-0 z-[70] md:hidden">
   <button className="absolute inset-0 bg-black/60 text-white" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>
   <div role="dialog" aria-modal="true" aria-label="Navigation" className="absolute bottom-0 left-0 top-0 w-80 max-w-[85vw] overflow-y-auto border-r" style={{backgroundColor:'var(--cc-bg)',borderColor:'var(--cc-border)'}}>
    <div className="flex items-center justify-between border-b p-4" style={{borderColor:'var(--cc-border)'}}><div><div className="font-medium">{profile?.display_name||'Member'}</div><div className="text-xs capitalize" style={{color:'var(--cc-text-muted)'}}>{roleLabel[role]||role}</div></div><button className="p-2" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"><X size={22}/></button></div>
    {isAdmin&&<RoleDashboardSwitcher mobile value={adminRole} onChange={switchDashboard}/>}
    <nav aria-label="Mobile navigation" className="space-y-1 p-4">
     {isAdmin&&adminRole==='admin'&&<><div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider" style={{color:'var(--cc-text-muted)'}}>Admin</div>{adminNav.map(item=><MenuLink key={item.path} item={item} tab={tab} onNavigate={onNavigate} onClose={()=>setMobileOpen(false)} mobile/>)}<div className="my-2 border-b" style={{borderColor:'var(--cc-border)'}}/></>}
     {nav.map(item=><MenuLink key={item.path} item={item} tab={tab} onNavigate={onNavigate} onClose={()=>setMobileOpen(false)} mobile/>)}
     <div className="mt-4 border-t pt-3" style={{borderColor:'var(--cc-border)'}}><button type="button" aria-label="Sign out" className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold" onClick={()=>{setMobileOpen(false);onSignOut();}}><LogOut size={20}/> Sign Out</button></div>
    </nav>
   </div>
  </div>}
  <main id="main-content" className="ccx-shell-main min-h-screen px-4 pb-24 pt-24 md:pl-[calc(16rem+1.5rem)] md:pr-6 md:pb-10" style={{paddingTop:'calc(var(--cc-shell-header-height,4rem) + 1.5rem)'}}><div className="mx-auto max-w-7xl"><ModuleAccessBoundary tab={tab} flags={featureFlags} onNavigate={onNavigate}>{children}</ModuleAccessBoundary></div></main>
  <nav aria-label="Mobile bottom navigation" className="fixed bottom-0 left-0 right-0 z-50 flex border-t backdrop-blur-xl md:hidden" style={{backgroundColor:'color-mix(in srgb,var(--cc-bg) 95%,transparent)',borderColor:'var(--cc-border)',paddingBottom:'env(safe-area-inset-bottom,0px)'}}>
   {['Dashboard','Testing','Discovery','Collaborations','Properties'].map(path=>nav.find(item=>item.path===path)).filter(Boolean).map(item=>{const Icon=item.icon,active=tabMatches(tab,item.path);return <button key={item.path} onClick={()=>onNavigate(keyFor(item.path))} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2" aria-current={active?'page':undefined} style={{color:active?'var(--cc-blue)':'var(--cc-text-muted)'}}><Icon size={20}/><span className="max-w-full truncate text-[10px] font-medium">{item.label}</span></button>;})}
  </nav>
 </div></RoleWorkspaceContext.Provider>;
}
