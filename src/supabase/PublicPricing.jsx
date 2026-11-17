/**
 * Public pricing surface, intentionally independent from member authorization.
 *
 * The Base44 version displayed role-specific subscription prices from a
 * PricingTier entity. Supabase has no published matching price catalog yet,
 * so never invent amounts or create a checkout entitlement from client code.
 * Restore the original role selector and free-vs-premium explanation while
 * keeping checkout disabled until approved provider plans are configured.
 */
import React, {useState} from 'react';
import {ArrowRight, Check, ShieldCheck, UsersRound, Building2, LockKeyhole} from 'lucide-react';

const roleChoices=[
  ['creator','Creator'],['photographer','Photographer'],['videographer','Videographer'],
  ['video_editor','Video Editor'],['agent','Agent'],['studio','Studio'],['host','Host']
];

const roleDescription={
 creator:'Create professional connections, find collaborators, plan shoots and manage agreements.',
 photographer:'Discover verified creators, present your professional work and manage client projects.',
 videographer:'Connect with production teams, coordinate filming and handle project agreements.',
 video_editor:'Present editing services, connect with creators and coordinate deliverables.',
 agent:'Manage professional relationships, collaboration opportunities and client communications.',
 studio:'Coordinate studio productions, professional teams and facility bookings.',
 host:'Manage production locations, availability, guest requests and hosting operations.'
};

const freeFeatures=[
 'Create an account and set up your professional profile',
 'Submit independent age verification at no cost',
 'Preview a limited verified creator directory',
 'Review your own consent and account settings'
];
const premiumFeatures=[
 'Expanded creator search and discovery',
 'Direct messages and professional connections',
 'Collaboration planning, contracts and document workflows',
 'Availability, production and hosting tools where enabled'
];

function PlanCard({title,eyebrow,price,subtitle,features,highlight=false,action,href='/signup',disabled=false}){
 return <article className={
  'flex h-full flex-col rounded-2xl border p-5 sm:p-7 '+
  (highlight?'border-[#D34DBB]/70 bg-[#20172F] shadow-xl shadow-black/20':'border-[#34445D] bg-[#111A2B]')
 }>
  <p className="text-xs font-bold uppercase tracking-[.15em] text-[#FF91D9]">{eyebrow}</p>
  <h2 className="mt-2 text-xl font-bold text-white">{title}</h2>
  <div className="mt-4 text-3xl font-extrabold tracking-tight text-white">{price}</div>
  <p className="mt-2 min-h-12 text-sm leading-6 text-[#B9C5DB]">{subtitle}</p>
  <ul className="mt-5 flex-1 space-y-3 border-t border-[#37415A] pt-5">
   {features.map(feature=><li key={feature} className="flex items-start gap-3 text-sm leading-6 text-[#E5E8F4]">
    <Check size={18} className="mt-1 shrink-0 text-[#FF79C8]" aria-hidden="true"/>
    <span>{feature}</span>
   </li>)}
  </ul>
  {disabled?<p className="mt-7 rounded-xl border border-[#53425A] bg-[#30263D] px-4 py-3 text-center text-sm font-semibold text-[#E7CDE5]">
   {action}</p>:
   <a href={href} className="ccx-primary mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white">
    {action}<ArrowRight size={17}/></a>}
 </article>;
}

/** @param {{signedIn?: boolean, onNavigate?: (destination: string)=>void}} props */
export default function PublicPricing({signedIn=false,onNavigate}){
 const [role,setRole]=useState('creator');
 return <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
  <div className="mx-auto max-w-3xl text-center">
   <p className="ccx-eyebrow">Content Connect X memberships</p>
   <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
    Simple, <span className="ccx-gradient-text">transparent pricing.</span>
   </h1>
   <p className="mt-5 text-base leading-7 text-[#B7C3DD]">
    Join free, build your profile and complete age verification. Premium collaboration
    features will be available when approved membership billing is activated.
   </p>
  </div>
  <section className="mt-9" aria-labelledby="pricing-role-heading">
   <h2 id="pricing-role-heading" className="text-center text-sm font-semibold text-[#D9DDF0]">Choose your professional role</h2>
   <div className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2" role="group" aria-label="Professional pricing roles">
    {roleChoices.map(([value,label])=><button key={value} type="button"
     onClick={()=>setRole(value)} aria-pressed={role===value}
     className={'rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors '+
      (role===value?'border-[#FF84D9] bg-[#46234B] text-white':'border-[#3F4561] bg-[#141C2E] text-[#C5C9DF] hover:border-[#FF84D9]')}>
     {label}</button>)}
   </div>
   <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-[#ABBDDA]">
    {roleDescription[role]}
   </p>
  </section>
  <section className="mx-auto mt-9 grid max-w-5xl gap-5 md:grid-cols-2" aria-label="Membership choices">
   <PlanCard title="Free Membership" eyebrow="Get started" price="$0" subtitle="No payment is required to register or submit age verification."
    features={freeFeatures} action={signedIn?'Your free features are available':'Create a free account'}
    href="/signup" disabled={signedIn}/>
   <PlanCard title="Professional Membership" eyebrow="Expanded access" price="Pricing pending"
    subtitle="Premium billing is not yet active. Pricing will appear here after approved plans are configured."
    features={premiumFeatures} highlight disabled action="Subscription checkout is not available yet"/>
  </section>
  <section className="mx-auto mt-7 grid max-w-5xl gap-4 sm:grid-cols-3">
   <div className="ccx-surface p-5"><ShieldCheck size={22} className="text-[#FF83D5]"/><h3 className="mt-3 font-semibold text-white">Independent age verification</h3>
    <p className="mt-2 text-sm leading-6 text-[#B6C3D8]">Required for protected adult creator and production features.</p></div>
   <div className="ccx-surface p-5"><UsersRound size={22} className="text-[#FF83D5]"/><h3 className="mt-3 font-semibold text-white">Membership access</h3>
    <p className="mt-2 text-sm leading-6 text-[#B6C3D8]">Features follow role, verification, enabled services and subscription status.</p></div>
   <div className="ccx-surface p-5"><Building2 size={22} className="text-[#FF83D5]"/><h3 className="mt-3 font-semibold text-white">Hosting and locations</h3>
    <p className="mt-2 text-sm leading-6 text-[#B6C3D8]">Studio and venue rates depend on the individual approved listing.</p></div>
  </section>
  <div className="mx-auto mt-9 max-w-3xl rounded-2xl border border-[#354360] bg-[#10192A] p-5 text-sm leading-7 text-[#B5C5DC]">
   <div className="flex items-center gap-2 font-semibold text-white"><LockKeyhole size={19}/> Billing status</div>
   <p className="mt-2">Paid membership checkout remains unavailable until an approved payment processor
    and published subscription terms are configured. No payment or membership activation occurs on this page.</p>
  </div>
  <div className="mt-10 flex justify-center gap-3">
   {signedIn?<button type="button" className="ccx-secondary rounded-xl px-5 py-3 text-sm font-semibold"
     onClick={()=>onNavigate?.('dashboard')}>Back to dashboard</button>:
    <a href="/" className="ccx-secondary rounded-xl px-5 py-3 text-sm font-semibold">Back to homepage</a>}
  </div>
 </main>;
}
