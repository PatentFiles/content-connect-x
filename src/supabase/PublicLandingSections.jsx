/** Signed-out landing sections. Marketing-only: never expose private records or bypass member gates. */
import React from 'react';
import { MessageCircleMore, UsersRound, HeartPulse, FileSignature, MapPinned, Fingerprint, CreditCard, Search, MessagesSquare, PenLine, ArrowUpRight, ArrowRight, ShieldCheck, Sparkles, Camera } from 'lucide-react';

const features = [
  {number:'01', title:'Messaging', sub:'Stay connected', text:'Direct in-app conversations with verified members. Keep introductions and production discussions in one place.', Icon:MessageCircleMore, tone:'cyan'},
  {number:'02', title:'Collaborations', sub:'Create together', text:'Coordinate multi-participant projects, negotiate expectations, and keep contracts and consent records connected.', Icon:UsersRound, tone:'pink'},
  {number:'03', title:'Health Testing', sub:'Work-readiness checks', text:'Privacy-conscious testing credential workflows, with clearance requirements before applicable collaborations.', Icon:HeartPulse, tone:'violet'},
  {number:'04', title:'Digital Contracts', sub:'Clarity from the start', text:'Prepare, sign, and retain agreements with documented consent and a traceable history.', Icon:FileSignature, tone:'cyan'},
  {number:'05', title:'Hosting & Location Booking', sub:'Powered by Host Connect', text:'Discover production spaces, request bookings, and coordinate a location with the rest of your project.', Icon:MapPinned, tone:'pink', href:'https://hostconnectx.com'}
];
const steps = [
  {label:'Verify',desc:'Complete your independent identity and age verification.',Icon:Fingerprint},
  {label:'Subscribe',desc:'Explore plans and choose the access you need when available.',Icon:CreditCard},
  {label:'Discover',desc:'Find creators, production partners, and spaces.',Icon:Search},
  {label:'Negotiate',desc:'Discuss collaboration details and agree on expectations.',Icon:MessagesSquare},
  {label:'Sign',desc:'Review and e-sign agreements where enabled.',Icon:PenLine}
];

export default function PublicLandingSections(){
 return <div className="ccx-public-landing">
  <section className="ccx-slim-section ccx-slim-features" aria-labelledby="ccx-feature-title">
   <div className="ccx-slim-container">
    <div className="ccx-slim-section-heading">
     <p className="ccx-slim-kicker"><Sparkles size={15} aria-hidden="true"/> CREATE · COLLABORATE · GROW</p>
     <h2 id="ccx-feature-title">Everything you need to <span className="ccx-slim-gradient">create together.</span></h2>
     <p>Five connected tools for professionals who want to make more and manage less.</p>
    </div>
    <div className="ccx-slim-feature-grid">
     {features.map(({number,title,sub,text,Icon,tone,href})=>
      <article key={title} className={`ccx-slim-feature ccx-slim-${tone}`}>
       <span className="ccx-slim-feature-num">{number} / 05</span>
       <div className="ccx-slim-feature-icon"><Icon size={29} strokeWidth={1.65} aria-hidden="true"/></div>
       <div className="ccx-slim-feature-body">
        <p className="ccx-slim-feature-sub">{sub}</p>
        <h3>{title}</h3>
        <p>{text}</p>
       </div>
       {href?<a className="ccx-slim-feature-link" href={href}>Explore Host Connect <ArrowUpRight size={17}/></a>:<span className="ccx-slim-feature-rule" aria-hidden="true"/>}
      </article>)}
    </div>
    <p className="ccx-slim-availability-note"><ShieldCheck size={16} aria-hidden="true"/> Features requiring verification, subscription, provider approval, or payment are available only when the corresponding services are enabled.</p>
   </div>
  </section>
  <section className="ccx-slim-section ccx-slim-steps-section" aria-labelledby="ccx-steps-title">
   <div className="ccx-slim-container">
    <div className="ccx-slim-section-heading">
     <p className="ccx-slim-kicker"><Camera size={15} aria-hidden="true"/> SIMPLE · SAFE · PROFESSIONAL</p>
     <h2 id="ccx-steps-title">From introduction to <span className="ccx-slim-gradient">action.</span></h2>
     <p>A clear path from creating an account to planning your next professional collaboration.</p>
    </div>
    <ol className="ccx-slim-steps">{steps.map(({label,desc,Icon},i)=>
     <li className="ccx-slim-step" key={label}>
      <div className="ccx-slim-step-top"><span>{String(i+1).padStart(2,'0')}</span><Icon size={24} strokeWidth={1.6} aria-hidden="true"/></div>
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
     <p className="ccx-slim-fineprint">Registration is free. Verification and paid feature access are subject to eligibility and service availability.</p>
    </div>
   </div>
  </section>
  <footer className="ccx-slim-footer">
   <div className="ccx-slim-container ccx-slim-footer-inner"><span>Content Connect <strong>X</strong></span><p>Professional collaborations · Locations by <a href="https://hostconnectx.com" className="ccx-host-footer-link" target="_blank" rel="noopener noreferrer">Host Connect X</a></p></div>
  </footer>
 </div>;
}
