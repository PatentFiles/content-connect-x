/** Public role-specific subscription catalog. Price edits originate from Supabase and are display-only
 * until an adult-industry-approved billing provider is operational and webhook-validated. */
import React,{useEffect,useState} from 'react';
import {ArrowRight,Check,ShieldCheck,UsersRound,Building2,LockKeyhole} from 'lucide-react';
import {supabase} from '@/api/supabaseClient';
import {PROFESSIONAL_ROLES,ROLE_BENEFITS,FREE_BENEFITS,DEFAULT_PREMIUM_PLANS} from './membershipCatalog.mjs';

function Card({eyebrow,title,price,features,subtitle,highlight=false,action,href,disabled=false}){
 return <article className={'flex h-full flex-col rounded-2xl border p-5 sm:p-7 '+
 (highlight?'border-[#D34DBB]/70 bg-[#20172F] shadow-xl shadow-black/20':'border-[#34445D] bg-[#111A2B]')}>
  <p className="text-xs font-bold uppercase tracking-[.15em] text-[#FF91D9]">{eyebrow}</p>
  <h2 className="mt-2 text-xl font-bold text-white">{title}</h2>
  <div className="mt-4 text-3xl font-extrabold tracking-tight text-white">{price}</div>
  <p className="mt-2 min-h-12 text-sm leading-6 text-[#B9C5DB]">{subtitle}</p>
  <ul className="mt-5 flex-1 space-y-3 border-t border-[#37415A] pt-5">
   {features.map(feature=><li key={feature} className="flex items-start gap-3 text-sm leading-6 text-[#E5E8F4]">
    <Check size={18} className="mt-1 shrink-0 text-[#FF79C8]"/><span>{feature}</span>
   </li>)}
  </ul>
  {disabled?<p className="mt-7 rounded-xl border border-[#53425A] bg-[#30263D] px-4 py-3 text-center text-sm font-semibold text-[#E7CDE5]">{action}</p>:
   <a href={href||'/signup'} className="ccx-primary mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white">{action}<ArrowRight size={17}/></a>}
 </article>;
}
export default function PublicPricing({signedIn=false,onNavigate,initialRole='creator'}){
 const [role,setRole]=useState(PROFESSIONAL_ROLES.some(x=>x.id===initialRole)?initialRole:'creator');
 const [plans,setPlans]=useState(DEFAULT_PREMIUM_PLANS);
 const [agentPlan,setAgentPlan]=useState('agent_10');
 useEffect(()=>{
  let live=true;
  void supabase.from('membership_plan_catalog')
   .select('plan_code,role_type,monthly_cents,label,roster_seats,display_order,active')
   .eq('active',true).order('display_order').then(({data,error})=>{
    if(live&&!error&&data?.length)setPlans(data);
   }).catch(()=>{});
  return()=>{live=false;};
 },[]);
 const matching=plans.filter(p=>p.role_type===role);
 const selected=matching.find(p=>p.plan_code===agentPlan)||matching[0];
 const price=selected?'$'+(selected.monthly_cents/100).toFixed(2):'Not available';
 const premium=ROLE_BENEFITS[role]||ROLE_BENEFITS.creator;
 return <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
  <div className="mx-auto max-w-3xl text-center">
   <p className="ccx-eyebrow">Content Connect X memberships</p>
   <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
    Simple, <span className="ccx-gradient-text">transparent pricing.</span>
   </h1>
   <p className="mt-5 text-base leading-7 text-[#B7C3DD]">
    Create your profile and independently verify you are 18 or older before using the protected network.
    Free members can discover creators worldwide; premium unlocks global collaboration.
   </p>
  </div>
  <section className="mt-9" aria-labelledby="pricing-role-heading">
   <h2 id="pricing-role-heading" className="text-center text-sm font-semibold text-[#D9DDF0]">Choose your professional role</h2>
   <div className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-2" role="group" aria-label="Professional pricing roles">
    {PROFESSIONAL_ROLES.map(item=><button key={item.id} type="button"
      onClick={()=>setRole(item.id)} aria-pressed={role===item.id}
      className={'rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors '+
       (role===item.id?'border-[#FF84D9] bg-[#46234B] text-white':'border-[#3F4561] bg-[#141C2E] text-[#C5C9DF] hover:border-[#FF84D9]')}>
       {item.label}</button>)}
   </div>
   <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-6 text-[#ABBDDA]">{premium.description}</p>
   {role==='agent'&&<fieldset className="mx-auto mt-5 max-w-xl text-center">
    <legend className="mb-2 text-sm font-semibold">Agency capacity</legend>
    <div className="flex flex-wrap justify-center gap-2">
     {matching.map(plan=><button type="button" key={plan.plan_code} aria-pressed={selected?.plan_code===plan.plan_code}
      className={(selected?.plan_code===plan.plan_code?'ccx-primary':'ccx-secondary')+' rounded-xl px-3 py-2 text-sm'}
      onClick={()=>setAgentPlan(plan.plan_code)}>
      {plan.roster_seats===null?'100+ creators':'Up to '+plan.roster_seats}</button>)}
    </div>
   </fieldset>}
  </section>
  <section className="mx-auto mt-9 grid max-w-5xl gap-5 md:grid-cols-2" aria-label="Membership choices">
   <Card eyebrow="Get started" title="Free Membership" price="$0" subtitle="No payment is required for registration or independent age verification."
    features={FREE_BENEFITS} action={signedIn?'Free plan information':'Create a free account'} href="/signup" disabled={signedIn}/>
   <Card highlight eyebrow="Expanded access" title={role==='studio'?'Studio Membership':'Professional Membership'}
    price={price+(selected?'/mo':'')} subtitle={role==='agent'
     ?selected?.label+' · Cancel according to the published subscription terms.'
     :'Flat monthly membership. No Content Connect X percentage taken from your project earnings.'}
    features={premium.items} disabled action="Membership checkout opens after approved billing is connected"/>
  </section>
  <section className="mx-auto mt-7 grid max-w-5xl gap-4 sm:grid-cols-3">
   <div className="ccx-surface p-5"><ShieldCheck size={22} className="text-[#FF83D5]"/><h3 className="mt-3 font-semibold text-white">Verified adults only</h3>
    <p className="mt-2 text-sm leading-6 text-[#B6C3D8]">Every member must complete independent 18+ verification before entering the professional network.</p></div>
   <div className="ccx-surface p-5"><UsersRound size={22} className="text-[#FF83D5]"/><h3 className="mt-3 font-semibold text-white">Free local introductions</h3>
    <p className="mt-2 text-sm leading-6 text-[#B6C3D8]">Up to five distinct local contacts within a rolling seven days; long-distance profiles remain searchable and savable.</p></div>
   <div className="ccx-surface p-5"><Building2 size={22} className="text-[#FF83D5]"/><h3 className="mt-3 font-semibold text-white">OnlyHost locations</h3>
    <p className="mt-2 text-sm leading-6 text-[#B6C3D8]">Property listings and booking-based host fees belong to the independent OnlyHost marketplace.</p></div>
  </section>
  <div className="mx-auto mt-7 max-w-5xl rounded-2xl border border-[#354360] bg-[#10192A] p-5 text-sm leading-7 text-[#B5C5DC]">
   <div className="flex items-center gap-2 font-semibold text-white"><LockKeyhole size={19}/> Billing status</div>
   <p className="mt-2">These monthly prices are configured in the membership catalog. Paid checkout is not yet enabled because an adult-industry-approved merchant provider and subscription webhooks must be verified before charges are accepted.</p>
  </div>
  <div className="mt-10 flex justify-center">
   {signedIn?<button type="button" className="ccx-secondary rounded-xl px-5 py-3 text-sm font-semibold"
      onClick={()=>onNavigate?.('dashboard')}>Back to dashboard</button>:
     <a href="/" className="ccx-secondary rounded-xl px-5 py-3 text-sm font-semibold">Back to homepage</a>}
  </div>
 </main>;
}
