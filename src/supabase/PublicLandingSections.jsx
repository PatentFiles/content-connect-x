/** Signed-out landing sections. Marketing-only: never expose private records or bypass member gates. */
import React from 'react';
import {DISCOVERY_CATEGORIES} from './CategoryArtwork';
import BrandWordmark from './BrandWordmark';
import { MessageCircleMore, UsersRound, HeartPulse, FileSignature, MapPinned, Fingerprint, CreditCard, Search, Globe2, Handshake, FilePenLine, ArrowUpRight, ArrowRight, Sparkles, Camera } from 'lucide-react';

const features = [
  {title:'Messaging', sub:'Stay connected', text:'Direct in-app conversations with verified members. Keep introductions and production discussions in one place.', Icon:MessageCircleMore, tone:'cyan'},
  {title:'Collaborations', sub:'Create together', text:'Coordinate multi-participant projects, negotiate expectations, and keep contracts and consent records connected.', Icon:UsersRound, tone:'pink'},
  {title:'Health Testing', sub:'Work-readiness checks', text:'Privacy-conscious testing credential workflows, with clearance requirements before applicable collaborations.', Icon:HeartPulse, tone:'violet'},
  {title:'Digital Contracts', sub:'Clarity from the start', text:'Prepare, sign, and retain agreements with documented consent and a traceable history.', Icon:FileSignature, tone:'cyan'},
  {title:'Hosting & Location Booking', sub:'Powered by Host Connect', text:'Discover production spaces, request bookings, and coordinate a location with the rest of your project.', Icon:MapPinned, tone:'pink', href:'https://hostconnectx.com'}
];
const hoverTones=['cyan','pink','violet'];
const steps = [
  {label:'Verify',desc:'Confirm your identity and age.',Icon:Fingerprint},
  {label:'Subscribe',desc:'Choose the membership that fits your work.',Icon:CreditCard},
  {label:'Discover',desc:'Explore creators, production partners, and spaces.',Icon:Globe2},
  {label:'Negotiate',desc:'Align on project details and expectations.',Icon:Handshake},
  {label:'Sign',desc:'Review and sign your collaboration agreement.',Icon:FilePenLine}
];

export default function PublicLandingSections(){
 return <div className="ccx-public-landing">
  <section className="ccx-slim-section ccx-home-discovery" aria-labelledby="ccx-home-discovery-title" data-public-discovery-icons="true">
   <div className="ccx-slim-container">
    <div className="ccx-slim-section-heading">
     <p className="ccx-slim-kicker"><Search size={15} aria-hidden="true"/> DISCOVERY</p>
     <h2 id="ccx-home-discovery-title">Discover a network of <span className="ccx-slim-gradient">industry professionals.</span></h2>
     <p>Find creators, filmmakers, production teams and services to collaborate, create and work together.</p>
    </div>
    <div className="ccx-home-discovery-grid" aria-label="Discover professional categories">
     {DISCOVERY_CATEGORIES.filter(item=>item.key!=='chef').map((item,index)=><article className={`ccx-home-discovery-card ccx-hover-${hoverTones[index%hoverTones.length]}`} key={item.key}>
      <span className="ccx-home-discovery-artwork" aria-hidden="true">
       {item.image&&<img src={item.image} alt="" loading="lazy" decoding="async"/>}
      </span>
      <h3>{item.label}</h3>
     </article>)}
    </div>
    <div className="ccx-home-discovery-actions">
     <a className="ccx-slim-button ccx-slim-button-primary" href="/signup">
      Join the network <ArrowRight size={18} aria-hidden="true"/>
     </a>
    </div>
   </div>
  </section>
  <section className="ccx-slim-section ccx-slim-features" aria-labelledby="ccx-feature-title">
   <div className="ccx-slim-container">
    <div className="ccx-slim-section-heading">
     <p className="ccx-slim-kicker"><Sparkles size={15} aria-hidden="true"/> CREATE · COLLABORATE · GROW</p>
     <h2 id="ccx-feature-title">Everything you need to <span className="ccx-slim-gradient">create together.</span></h2>
     <p>Five connected tools for professionals who want to make more and manage less.</p>
    </div>
    <div className="ccx-slim-feature-grid">
     {features.map(({title,sub,text,Icon,tone,href})=>
      <article key={title} className={`ccx-slim-feature ccx-slim-${tone}`}>
       <div className="ccx-slim-feature-icon"><Icon size={29} strokeWidth={1.65} aria-hidden="true"/></div>
       <div className="ccx-slim-feature-body">
        <p className="ccx-slim-feature-sub">{sub}</p>
        <h3>{title}</h3>
        <p>{text}</p>
       </div>
       {href?<a className="ccx-slim-feature-link" href={href}>Explore Host Connect <ArrowUpRight size={17}/></a>:<span className="ccx-slim-feature-rule" aria-hidden="true"/>}
      </article>)}
    </div>
   </div>
  </section>
  <section className="ccx-slim-section ccx-slim-steps-section" aria-labelledby="ccx-steps-title">
   <div className="ccx-slim-container">
    <div className="ccx-slim-section-heading">
     <p className="ccx-slim-kicker"><Camera size={15} aria-hidden="true"/> SIMPLE · SAFE · PROFESSIONAL</p>
     <h2 id="ccx-steps-title">From introduction to <span className="ccx-slim-gradient">action.</span></h2>
     <p>A clear path from creating an account to planning your next professional collaboration.</p>
    </div>
    <ol className="ccx-slim-steps">{steps.map(({label,desc,Icon},index)=>
     <li className={`ccx-slim-step ccx-hover-${hoverTones[index%hoverTones.length]}`} key={label}>
      <div className="ccx-slim-step-top"><Icon size={64} strokeWidth={1.55} aria-hidden="true"/></div>
      <h3>{label}</h3><p>{desc}</p>
     </li>)}</ol>
   </div>
  </section>
  <section className="ccx-slim-cta-wrap" aria-labelledby="ccx-cta-title">
   <div className="ccx-slim-container">
    <div className="ccx-slim-cta">
     <div className="ccx-slim-cta-glow" aria-hidden="true"/>
     <p className="ccx-slim-kicker">YOUR NEXT COLLABORATION STARTS HERE</p>
     <h2 id="ccx-cta-title">Ready to join the <span className="ccx-slim-gradient">community?</span></h2>
     <p>Meet verified professionals, manage your projects, and bring your next production to life.</p>
     <div className="ccx-slim-cta-actions">
      <a className="ccx-slim-button ccx-slim-button-primary" href="/signup">Create free account <ArrowRight size={18}/></a>
      <a className="ccx-slim-button ccx-slim-button-secondary" href="/pricing">View pricing <ArrowUpRight size={18}/></a>
     </div>
    </div>
   </div>
  </section>
  <footer className="ccx-slim-footer">
   <div className="ccx-slim-container ccx-slim-footer-inner">
    <BrandWordmark brand="content"/>
    <p>Production spaces and venue hosting: <a href="https://hostconnectx.com" className="ccx-host-footer-link" target="_blank" rel="noopener noreferrer"><BrandWordmark brand="host"/></a></p>
   </div>
  </footer>
 </div>;
}
