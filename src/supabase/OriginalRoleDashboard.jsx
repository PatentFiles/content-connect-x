/**
 * Role-specific dashboard composition, based on the original Base44 dashboard
 * headings and module hierarchy. Actions link to existing Supabase workflows.
 * No speculative revenue, booking or verification figures are displayed.
 */
import React from 'react';
import {ArrowRight,Briefcase,Building2,Camera,CalendarDays,FileText,
 Heart,MessageCircle,Search,ShieldCheck,Users,Video,Film,UserRound} from 'lucide-react';

const roleNames={
 creator:'Creator',agent:'Agent',studio:'Studio',photographer:'Photographer',
 videographer:'Videographer',video_editor:'Video Editor',host:'Host'
};
// Each role has its own dashboard exactly as the original role switcher did.
// The module IDs are mapped to the current protected Supabase screens.
const roleModules={
 creator:[
  {name:'Collaborations',tab:'collaborations',icon:Briefcase,description:'Your collaborations, invitations and shooting arrangements'},
  {name:'Find Creators',tab:'directory',icon:Search,description:'Discover verified performers and creative partners'},
  {name:'Messages',tab:'messages',icon:MessageCircle,description:'Your private creator conversations'},
  {name:'Favorites',tab:'favorites',icon:Heart,description:'Saved performers and professional profiles'},
  {name:'Contracts',tab:'contracts',icon:FileText,description:'Production agreements and document packets'},
  {name:'Availability & Travel',tab:'schedule',icon:CalendarDays,description:'Manage calendar and travel windows'},
 ],
 agent:[
  {name:'Representations',tab:'representations',icon:Users,description:'Artists, permissions, exclusivity and agency arrangements'},
  {name:'Collaborations',tab:'collaborations',icon:Briefcase,description:'Negotiations and collaboration schedules'},
  {name:'Contracts',tab:'contracts',icon:FileText,description:'Manage agreements and delegated signatures'},
  {name:'Messages',tab:'messages',icon:MessageCircle,description:'Communicate with your talent and collaborators'},
  {name:'Discover Talent',tab:'directory',icon:Search,description:'Find verified creators'},
  {name:'Host Properties',tab:'hosting',icon:Building2,description:'Production locations and studio rentals'},
 ],
 studio:[
  {name:'Roster & Portfolio',tab:'roster',icon:Users,description:'Studio team and represented collaborators'},
  {name:'Collaborations',tab:'collaborations',icon:Briefcase,description:'Coordinate current and future productions'},
  {name:'Contracts',tab:'contracts',icon:FileText,description:'Studio and performer agreements'},
  {name:'Bookings',tab:'hosting',icon:CalendarDays,description:'Studio availability, rental requests and calendars'},
  {name:'Messages',tab:'messages',icon:MessageCircle,description:'Communication with talent and crew'},
  {name:'Hosting',tab:'host',icon:Building2,description:'Venue listings, rates and equipment'},
 ],
 photographer:[
  {name:'Portfolio',tab:'portfolio',icon:Camera,description:'Images and service portfolio'},
  {name:'Booking Requests',tab:'hosting',icon:CalendarDays,description:'Professional bookings and availability'},
  {name:'Discover Creators',tab:'directory',icon:Search,description:'Search verified creators seeking photographers'},
  {name:'Messages',tab:'messages',icon:MessageCircle,description:'Direct client and creative conversations'},
  {name:'Connections',tab:'connections',icon:Users,description:'Professional connections'},
  {name:'My Profile',tab:'profile',icon:UserRound,description:'Service details and public creator identity'},
 ],
 videographer:[
  {name:'Reels / Portfolio',tab:'portfolio',icon:Video,description:'Videos and professional work'},
  {name:'Booking Requests',tab:'hosting',icon:CalendarDays,description:'Production opportunities and schedules'},
  {name:'Discover Creators',tab:'directory',icon:Search,description:'Find verified production partners'},
  {name:'Messages',tab:'messages',icon:MessageCircle,description:'Message clients and collaborators'},
  {name:'Connections',tab:'connections',icon:Users,description:'Maintain your professional network'},
  {name:'My Profile',tab:'profile',icon:UserRound,description:'Services, rates and creator identity'},
 ],
 video_editor:[
  {name:'Portfolio',tab:'portfolio',icon:Film,description:'Editing showreel and previous projects'},
  {name:'Projects',tab:'collaborations',icon:Briefcase,description:'Manage current edit collaborations'},
  {name:'Discover Clients',tab:'directory',icon:Search,description:'Find creators and production teams'},
  {name:'Messages',tab:'messages',icon:MessageCircle,description:'Discuss deliveries and requirements'},
  {name:'Contracts',tab:'contracts',icon:FileText,description:'Agreements and delivery terms'},
  {name:'My Profile',tab:'profile',icon:UserRound,description:'Editing services and professional identity'},
 ],
 host:[
  {name:'Host Dashboard',tab:'host',icon:Building2,description:'Your properties, studios, calendars and guests'},
  {name:'Hosting Marketplace',tab:'hosting',icon:Search,description:'Browse filming locations and facilities'},
  {name:'Rental Bookings',tab:'host',icon:CalendarDays,description:'Guest requests and reservation operations'},
  {name:'Messages',tab:'messages',icon:MessageCircle,description:'Communicate about production arrangements'},
  {name:'Host Profile',tab:'profile',icon:UserRound,description:'Host identity and professional details'},
  {name:'Host Settings',tab:'host-settings',icon:ShieldCheck,description:'Hosting notifications, security and integrations'},
 ],
};

export default function OriginalRoleDashboard({profile,verified,paid,onNavigate,roleOverride}){
 const role=roleOverride||profile?.role_type||'creator';
 const modules=roleModules[role]||roleModules.creator;
 return <div className="space-y-6">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-2xl font-bold" style={{color:'var(--cc-text-primary)'}}>
     {roleNames[role]||'Creator'} Dashboard
    </h2>
    <p className="mt-1 text-sm" style={{color:'var(--cc-text-secondary)'}}>
     Welcome back{profile?.display_name?', '+profile.display_name:''}. Manage your professional workspace.
    </p>
   </div>
   <button type="button" onClick={()=>onNavigate('profile')}
    className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm"
    style={{borderColor:'var(--cc-border)',color:'var(--cc-blue)'}}>
    My Profile <ArrowRight size={16}/>
   </button>
  </header>
  <div className="grid gap-4 sm:grid-cols-3">
   <div className="rounded-xl border p-4" style={{borderColor:'var(--cc-border)',backgroundColor:'var(--cc-surface)'}}>
    <p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>Verification</p>
    <p className="mt-2 text-lg font-semibold">{verified?'Verified':'Verification required'}</p>
    <button onClick={()=>onNavigate('verification')} className="mt-3 text-sm" style={{color:'var(--cc-blue)'}}>
     Review verification</button>
   </div>
   <div className="rounded-xl border p-4" style={{borderColor:'var(--cc-border)',backgroundColor:'var(--cc-surface)'}}>
    <p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>Membership</p>
    <p className="mt-2 text-lg font-semibold">{paid?'Premium':'Free account'}</p>
    <button onClick={()=>onNavigate('membership')} className="mt-3 text-sm" style={{color:'var(--cc-blue)'}}>
     Membership details</button>
   </div>
   <div className="rounded-xl border p-4" style={{borderColor:'var(--cc-border)',backgroundColor:'var(--cc-surface)'}}>
    <p className="text-sm" style={{color:'var(--cc-text-secondary)'}}>Your role</p>
    <p className="mt-2 text-lg font-semibold">{roleNames[role]||role}</p>
    <button onClick={()=>onNavigate('profile')} className="mt-3 text-sm" style={{color:'var(--cc-blue)'}}>
     Edit role and profile</button>
   </div>
  </div>
  <section>
   <h3 className="mb-4 text-xl font-semibold">Your Workspace</h3>
   <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {modules.map(({name,tab,icon:Icon,description})=><button type="button" key={name}
     onClick={()=>onNavigate(tab)} className="group rounded-xl border p-5 text-left transition-colors hover:border-[#4F8CFF]"
     style={{backgroundColor:'var(--cc-surface)',borderColor:'var(--cc-border)'}}>
     <span className="mb-4 grid h-11 w-11 place-items-center rounded-lg"
      style={{backgroundColor:'var(--cc-surface-hover)',color:'var(--cc-blue)'}}><Icon size={22}/></span>
     <span className="flex items-center gap-2 font-semibold">{name}<ArrowRight size={14}
      className="opacity-50 transition-opacity group-hover:opacity-100"/></span>
     <span className="mt-2 block text-sm" style={{color:'var(--cc-text-secondary)'}}>{description}</span>
    </button>)}
   </div>
  </section>
 </div>;
}
