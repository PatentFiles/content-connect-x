/**
 * Public editorial homepage content under the CCX hero.
 * Source of truth remains Supabase. Avoid synthetic user counts, fabricated
 * testimonials, promises of verified providers, or fake available studios.
 */
import React from 'react';
import {ArrowUpRight,ArrowRight,Camera,Clapperboard,UsersRound,ShieldCheck,
 CalendarDays,LockKeyhole,MessageSquare,CheckCircle2,Building2,
 Fingerprint,ScanFace,FileSignature,Layers,ChevronRight} from 'lucide-react';

const categories=[
 {title:'Find your people',category:'DISCOVER',Icon:UsersRound,text:'Connect with creators, filmmakers, producers and production services in a private professional network.',theme:'fuchsia'},
 {title:'Make the plan',category:'PRODUCE',Icon:Clapperboard,text:'Build a shoot team, coordinate dates and bring approvals and documents together.',theme:'pink'},
 {title:'Book the location',category:'HOSTING',Icon:Building2,text:'Explore studios and film-friendly locations through the connected OnlyHost marketplace.',theme:'blue'}
];
const steps=[
 {n:'01',title:'Create your professional profile',text:'Tell the community what you do, how you work and the people you want to collaborate with.',Icon:Fingerprint},
 {n:'02',title:'Verify and connect',text:'Identity checks and consent rules protect sensitive professional interactions.',Icon:ShieldCheck},
 {n:'03',title:'Plan your next shoot',text:'Coordinate your team, availability, location and production documents.',Icon:CalendarDays},
 {n:'04',title:'Create with confidence',text:'Keep your agreed production workflow, messages and records together.',Icon:Camera}
];
const faq=[
 ['Do I need to pay to create an account?','No. Registration and independent age-verification submissions are free. Premium collaboration tools require an active plan when the approved payment service becomes available.'],
 ['Can I book a studio or location?','Approved locations can be discovered through the hosting marketplace. Booking requests, agreements and checkout remain subject to the platform’s release and identity requirements.'],
 ['Does the platform display private health reports?','No. Its work-readiness workflows are designed around time-limited clearance status and explicit collaboration sharing consent—not sharing individual laboratory results.'],
 ['Who can see my private production information?','Access is governed by your role, verification, booking status, consent and server-side permission checks. Sensitive records are not public directory content.']
];

export default function PublicLandingSections(){
 return <div className="ccx-public-landing">
  <section className="ccx-public-section">
    <div className="ccx-public-container">
      <div className="ccx-public-section-head">
        <div><p className="ccx-eyebrow">Your professional network, reimagined</p>
        <h2>Everything you need to bring<br className="hidden md:block"/> <span className="ccx-gradient-text">an idea to life.</span></h2></div>
        <p>Real creative work takes more than a profile. Bring talent, production and places together—without juggling a dozen disconnected tools.</p>
      </div>
      <div className="ccx-public-category-grid">{categories.map(v=>
       <article className={'ccx-public-category theme-'+v.theme} key={v.title}>
        <span className="ccx-public-mini-label">{v.category}</span>
        <div className="ccx-public-symbol"><v.Icon size={30} strokeWidth={1.6}/></div>
        <h3>{v.title}</h3><p>{v.text}</p>
        <a href="#ccx-auth" className="ccx-public-link">Get started <ArrowUpRight size={17}/></a>
       </article>)}</div>
    </div>
  </section>

  <section className="ccx-public-section ccx-public-story-section">
    <div className="ccx-public-container">
      <div className="ccx-public-story-grid">
        <div className="ccx-public-story-visual" aria-hidden="true">
          <div className="ccx-public-ring ring-one"/><div className="ccx-public-ring ring-two"/>
          <div className="ccx-public-film-card">
            <div className="flex items-center gap-3"><span className="ccx-icon-wrap"><Clapperboard size={21}/></span><span className="text-xs font-bold uppercase tracking-widest text-[#C6BED9]">The next project</span></div>
            <div className="mt-9 space-y-3">
              <div className="ccx-public-visual-row"><UsersRound size={18}/><span>Find your team</span><CheckCircle2 size={18} className="ml-auto text-[#FF7FD4]"/></div>
              <div className="ccx-public-visual-row"><CalendarDays size={18}/><span>Coordinate schedules</span><CheckCircle2 size={18} className="ml-auto text-[#92A7FF]"/></div>
              <div className="ccx-public-visual-row"><Building2 size={18}/><span>Choose your space</span><ChevronRight size={18} className="ml-auto text-[#B5C7EB]"/></div>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <p className="ccx-eyebrow">Made for the entire creative process</p>
          <h2 className="ccx-public-display mt-5">Less coordination.<br/><span className="ccx-gradient-text">More creation.</span></h2>
          <p className="mt-6 max-w-lg text-base leading-8 text-[#BBC4D9]">One place for the details that matter: who’s involved, when everyone is available, where you’re filming, and which permissions are in place.</p>
          <div className="mt-8 space-y-4">
            <p className="ccx-public-check"><CheckCircle2 size={19}/> Collaboration rooms and team invitations</p>
            <p className="ccx-public-check"><CheckCircle2 size={19}/> Availability, bookings and location management</p>
            <p className="ccx-public-check"><CheckCircle2 size={19}/> Consent and document workflows</p>
          </div>
          <a href="#ccx-auth" className="ccx-primary mt-8 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-3 text-sm">Join the creative network <ArrowUpRight size={17}/></a>
        </div>
      </div>
    </div>
  </section>

  <section className="ccx-public-section">
    <div className="ccx-public-container">
      <div className="ccx-public-section-head">
        <div><p className="ccx-eyebrow">How it comes together</p><h2>A better way to <span className="ccx-gradient-text">collaborate.</span></h2></div>
        <p>Built around practical creative workflows, not vanity engagement metrics or superficial social profiles.</p>
      </div>
      <div className="ccx-public-timeline">
        {steps.map(v=><div className="ccx-public-step" key={v.n}>
         <div className="flex items-center justify-between gap-2"><span className="ccx-public-step-index">{v.n}</span><v.Icon size={22} className="text-[#FF93D9]"/></div>
         <h3>{v.title}</h3><p>{v.text}</p>
        </div>)}
      </div>
    </div>
  </section>

  <section className="ccx-public-section">
    <div className="ccx-public-container">
      <div className="ccx-public-feature-panel">
        <div className="ccx-public-feature-grid">
          <div>
            <p className="ccx-eyebrow">Privacy is part of the process</p>
            <h2 className="ccx-public-display mt-4">Creative freedom.<br/><span className="ccx-gradient-text">Thoughtful safeguards.</span></h2>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[#B8C7DA]">Professional collaboration needs clear boundaries. Age verification, consent, approved access and private evidence handling belong in the workflow—not in an afterthought.</p>
            <p className="mt-4 text-xs leading-6 text-[#98A9C4]">Actual provider verification and production availability are enabled only after the required setup, approvals and testing are complete.</p>
          </div>
          <div className="ccx-public-trust-stack">
            {[
             [ScanFace,'Independent identity checks','Hosted provider checks and reviewer-based verification'],
             [FileSignature,'Clear agreements','Signature and retained-document workflows'],
             [LockKeyhole,'Role-based privacy','Sensitive files are scoped to approved participants']
            ].map(([Icon,title,description])=><div className="ccx-public-trust-row" key={title}>
             <span className="ccx-icon-wrap"><Icon size={22}/></span><div><h3>{title}</h3><p>{description}</p></div>
            </div>)}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section className="ccx-public-section">
    <div className="ccx-public-container">
      <div className="ccx-public-onlyhost">
        <div className="flex flex-col justify-center">
          <p className="ccx-eyebrow">Locations, without the logistics headache</p>
          <h2 className="ccx-public-display mt-4">The right space changes <span className="ccx-gradient-text">everything.</span></h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#BBC6DC]">Our connected OnlyHost marketplace makes professional film and photography spaces easier to discover and manage. Hosts work from one inventory, with availability coordinated across both brands.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="/onlyhost" className="ccx-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm">Discover OnlyHost <ArrowUpRight size={18}/></a><a href="#ccx-auth" className="ccx-secondary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm">Join Content Connect X</a></div>
        </div>
        <div className="ccx-public-onlyhost-art" aria-hidden="true">
          <div className="ccx-public-location-glow"/>
          <div className="ccx-public-location-card">
            <span className="ccx-icon-wrap"><Building2 size={22}/></span>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[.18em] text-[#B6C7E0]">The connected marketplace</p>
            <p className="mt-2 text-3xl font-extrabold">Only<span className="ccx-gradient-text">Host</span></p>
            <p className="mt-3 text-sm text-[#B4C4DD]">Spaces · Studios · Productions</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section className="ccx-public-section">
    <div className="ccx-public-container">
      <div className="ccx-public-section-head">
        <div><p className="ccx-eyebrow">Built for your role</p><h2>Every creator. <span className="ccx-gradient-text">Every side of production.</span></h2></div>
        <p>From the people in front of the camera to everyone making the production happen behind the scenes.</p>
      </div>
      <div className="ccx-public-role-grid">
       {[
        [Camera,'Creators & performers','Build your professional presence and manage trusted connections.'],
        [Clapperboard,'Videographers & photographers','Connect with talent, plan work and manage agreements.'],
        [Layers,'Studios & production teams','Coordinate people, locations, schedules and private workflows.'],
        [MessageSquare,'Agents & collaborators','Keep communication and project responsibilities organized.']
       ].map(([Icon,title,description])=><article className="ccx-public-role" key={title}>
        <Icon size={23} className="text-[#FF8DD9]"/><h3>{title}</h3><p>{description}</p>
       </article>)}
      </div>
    </div>
  </section>

  <section className="ccx-public-section">
    <div className="ccx-public-container ccx-public-faq-wrap">
      <div><p className="ccx-eyebrow">Good to know</p><h2 className="ccx-public-display mt-4">Questions, <span className="ccx-gradient-text">answered.</span></h2><p className="mt-5 text-sm leading-7 text-[#B3C1D9]">Clarity matters when you're building real professional relationships.</p></div>
      <div className="space-y-3">{faq.map(([q,a])=><details className="ccx-public-faq" key={q}>
        <summary>{q}<span className="text-xl text-[#FF80CF]">+</span></summary>
        <p>{a}</p>
       </details>)}</div>
    </div>
  </section>

  <section className="ccx-public-container px-4 pb-16 md:px-6">
    <div className="ccx-public-final">
      <div className="relative z-10 max-w-3xl">
        <p className="ccx-eyebrow">What will you create next?</p>
        <h2 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">Your next collaboration<br/> <span className="ccx-gradient-text">starts here.</span></h2>
        <p className="mt-5 max-w-xl text-sm leading-7 text-[#DDD9EC]">Join a network built around creative people, thoughtful safeguards and the work they want to make together.</p>
        <a href="#ccx-auth" className="ccx-primary mt-7 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm">Get started free <ArrowRight size={18}/></a>
      </div>
    </div>
  </section>
  <footer className="border-t border-[#34405A] py-9">
    <div className="ccx-public-container flex flex-wrap items-center justify-between gap-3 px-4 md:px-6">
      <p className="text-lg font-bold">Content Connect <span className="ccx-gradient-text">X</span></p>
      <p className="text-xs text-[#A3B3CA]">A professional network for trusted creative collaboration. All protected features are subject to verified access.</p>
    </div>
  </footer>
 </div>;
}
