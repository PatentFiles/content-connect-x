/** Signed-out landing sections. Marketing-only: never expose private records or bypass member gates. */
import React,{useEffect,useRef,useState} from 'react';
import {PUBLIC_DISCOVERY_DETAILS} from './publicDiscoveryDetails.mjs';
import {DISCOVERY_CATEGORIES} from './CategoryArtwork';
import { MessageCircleMore, UsersRound, HeartPulse, FileSignature, MapPinned, Fingerprint, CreditCard, Search, Globe2, Handshake, FilePenLine, X, ArrowUpRight, ArrowRight, Sparkles, Camera } from 'lucide-react';

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
 const [activeCategory,setActiveCategory]=useState('');
 const dialogRef=useRef(null),headingRef=useRef(null),triggerRef=useRef(null);
 const category=DISCOVERY_CATEGORIES.find(item=>item.key===activeCategory);
 const story=PUBLIC_DISCOVERY_DETAILS[activeCategory];
 useEffect(()=>{
  if(!activeCategory)return;
  const dialog=dialogRef.current;
  if(!dialog)return;
  const priorOverflow=document.body.style.overflow;
  if(!dialog.open)dialog.showModal();
  document.body.style.overflow='hidden';
  headingRef.current?.focus();
  return()=>{
   document.body.style.overflow=priorOverflow;
   if(dialog.open)dialog.close();
  };
 },[activeCategory]);
 const closeDialog=()=>{if(dialogRef.current?.open)dialogRef.current.close();else setActiveCategory('');};
 const openDialog=(key,trigger)=>{
  triggerRef.current=trigger;
  setActiveCategory(key);
 };
 return <div className="ccx-public-landing">
  <section className="ccx-slim-section ccx-home-discovery" aria-labelledby="ccx-home-discovery-title" data-public-discovery-icons="true">
   <div className="ccx-slim-container">
    <div className="ccx-slim-section-heading">
     <p className="ccx-slim-kicker"><Search size={15} aria-hidden="true"/> DISCOVERY</p>
     <h2 id="ccx-home-discovery-title">Discover a network of <span className="ccx-slim-gradient">industry professionals.</span></h2>
     <p>Find creators, filmmakers, production teams and services to collaborate, create and work together.</p>
    </div>
    <div className="ccx-home-discovery-grid" aria-label="Discover professional categories">
     {DISCOVERY_CATEGORIES.filter(item=>item.key!=='chef').map((item,index)=><article className={'ccx-home-discovery-card ccx-hover-'+hoverTones[index%hoverTones.length]} key={item.key}>
      <button type="button" className="ccx-home-discovery-trigger"
       aria-haspopup="dialog" aria-controls="ccx-discovery-detail-dialog"
       aria-label={'Learn about '+(PUBLIC_DISCOVERY_DETAILS[item.key]?.label||item.label)}
       onClick={event=>openDialog(item.key,event.currentTarget)}>
       <span className="ccx-home-discovery-artwork" aria-hidden="true">
        {item.image&&<img src={item.image} alt="" loading="lazy" decoding="async"/>}
       </span>
       <span className="ccx-home-discovery-title">{PUBLIC_DISCOVERY_DETAILS[item.key]?.label||item.label}</span>
      </button>
     </article>)}
    </div>
    <div className="ccx-home-discovery-actions">
     <a className="ccx-slim-button ccx-slim-button-primary" href="/signup">
      Join the network <ArrowRight size={18} aria-hidden="true"/>
     </a>
    </div>
   </div>
  </section>
  <dialog id="ccx-discovery-detail-dialog" ref={dialogRef} className="ccx-discovery-detail-dialog"
   aria-modal="true" aria-labelledby="ccx-discovery-dialog-title" aria-describedby="ccx-discovery-dialog-intro"
   onClose={()=>{setActiveCategory('');triggerRef.current?.focus();}}
   onClick={event=>{if(event.target===event.currentTarget)closeDialog();}}>
   {category&&story&&<div className="ccx-discovery-dialog-inner">
    <div className="ccx-discovery-dialog-glow" aria-hidden="true"/>
    <button type="button" className="ccx-discovery-dialog-close" aria-label="Close description" onClick={closeDialog}><X size={21} aria-hidden="true"/></button>
    <div className="ccx-discovery-dialog-heading">
     <div className="ccx-discovery-dialog-art" aria-hidden="true">{category.image&&<img src={category.image} alt=""/>}</div>
     <div className="ccx-discovery-dialog-heading-copy">
      <p className="ccx-discovery-dialog-eyebrow">{story.eyebrow}</p>
      <h2 id="ccx-discovery-dialog-title" ref={headingRef} tabIndex={-1}>{story.title}</h2>
     </div>
    </div>
    <p id="ccx-discovery-dialog-intro" className="ccx-discovery-dialog-intro">{story.intro}</p>
    <p className="ccx-discovery-dialog-detail">{story.detail}</p>
    <section className="ccx-discovery-dialog-ways" aria-label="What you can do">
     <h3>How you can work together</h3>
     <ul>{story.ways.map(way=><li key={way}><span className="ccx-discovery-dialog-check" aria-hidden="true">✓</span><span>{way}</span></li>)}</ul>
    </section>
    <div className="ccx-discovery-dialog-actions">
     <a className="ccx-slim-button ccx-slim-button-primary" href="/signup">{story.cta}<ArrowRight size={18} aria-hidden="true"/></a>
     <a className="ccx-discovery-dialog-signin" href="/login">Already a member? Sign in</a>
    </div>
   </div>}
  </dialog>
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
 </div>;
}
