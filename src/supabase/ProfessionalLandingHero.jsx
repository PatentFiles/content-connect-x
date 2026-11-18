/** Public presentation only. The workflow illustration contains no invented
 * customer records, live statistics, payment confirmations or verification. */
import React from 'react';
import {ArrowRight, CalendarDays, FileText, Home, MessageSquare, Users, ShieldCheck} from 'lucide-react';

export function PublicBrand({host=false}) {
 return <a href={host?'/hostconnect':'/'} className="professional-wordmark" aria-label={host?'Host Connect home':'Content Connect X home'}>
  <span className="ccx-monogram" aria-hidden="true">{host?<Home size={20}/>: 'CX'}</span>
  <span>{host?'Host Connect':'Content Connect'}{!host&&<span className="professional-brand-x"> X</span>}</span>
 </a>;
}

export default function ProfessionalLandingHero({host=false,onStart=undefined}) {
 const items=host?[
  {Icon:Home,title:'Your spaces',description:'Showcase the details that make your location work.'},
  {Icon:CalendarDays,title:'Your availability',description:'Set your schedule, rates, and booking rules.'},
  {Icon:FileText,title:'Your booking workspace',description:'Keep requests and production details together.'}
 ]:[
  {Icon:Users,title:'Your professional network',description:'Discover creators and production partners.'},
  {Icon:MessageSquare,title:'Your collaborations',description:'Bring conversations and project plans together.'},
  {Icon:FileText,title:'Your shared expectations',description:'Keep agreements and consent records organized.'}
 ];
 return <section className={'professional-hero'+(host?' professional-hero-host':'')} aria-labelledby="professional-hero-title">
  <div className="professional-hero-inner">
   <div className="professional-hero-copy">
    <p className="professional-overline">{host?'SPACES FOR PROFESSIONAL PRODUCTION':'THE PROFESSIONAL CREATOR NETWORK'}</p>
    <h1 id="professional-hero-title">{host?<>Great spaces.<br/><span>Better productions.</span></>:<>A professional network.<br/><span>Built for collaboration.</span></>}</h1>
    <p className="professional-hero-description">{host?'Connect your property with professional adult-content productions. Set clear boundaries, manage availability, and keep every request organized.':'A dedicated workspace for adult-content creators, production professionals, and studios. Find the right people, plan your work, and collaborate with clarity.'}</p>
    <div className="professional-hero-actions">
     {host?<button type="button" className="ccx-primary" onClick={onStart}>List your space <ArrowRight size={18}/></button>:<a href="/signup" className="ccx-primary">Create your profile <ArrowRight size={18}/></a>}
     <a href={host?'#oh-features-title':'#ccx-steps-title'} className="ccx-secondary">{host?'Explore host tools':'How it works'}</a>
    </div>
    <p className="professional-hero-note"><ShieldCheck size={16} aria-hidden="true"/>{host?'Your property. Your rules. Independent listing approval.':'Free registration. Independent age verification with Yoti.'}</p>
   </div>
   <aside className="professional-workflow" aria-label={host?'Host workspace overview':'Network workspace overview'}>
    <div className="professional-workflow-top"><span>{host?'HOST CONNECT':'CONTENT CONNECT X'}</span><span>Workspace overview</span></div>
    <h2>{host?<>A considered space.<br/>A connected workflow.</>:<>Less administration.<br/>More collaboration.</>}</h2>
    <div className="professional-workflow-items">{items.map(({Icon,title,description},i)=><div key={title} className="professional-workflow-item"><span className="professional-workflow-icon"><Icon size={22} strokeWidth={1.6} aria-hidden="true"/></span><div><h3>{title}</h3><p>{description}</p></div><span className="professional-workflow-number" aria-hidden="true">0{i+1}</span></div>)}</div>
    <p className="professional-workflow-caption">{host?'Designed around the way you host.':'One place to organize your professional work.'}</p>
   </aside>
  </div>
 </section>;
}
