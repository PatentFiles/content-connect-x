/**
 * Creator dashboard: reuse the homepage hero asset without inventing metrics.
 * Calls no privileged endpoints. Each quick action navigates to an existing
 * Supabase-authorized workflow rather than pretending a backend capability exists.
 */
import React from 'react';
import {
  ArrowUpRight, CalendarDays, Building2, UsersRound, Search,
  ShieldCheck, Sparkles, MessageSquare, CheckCircle2, UserRound,
  ArrowRight, LockKeyhole, Zap,
} from 'lucide-react';

const statusTone={verified:'text-emerald-300',pending:'text-amber-200',neutral:'text-white'};
function StatusCard({label,value,detail,Icon,tone='neutral',onClick}) {
  return <button className="ccx-stat-card group w-full text-left transition hover:border-[#FF65CB]/50"
    onClick={onClick} aria-label={label+': '+value}>
    <div className="flex justify-between gap-2 items-center">
      <span className="text-xs font-semibold uppercase tracking-widest text-[#ACB8D4]">{label}</span>
      <Icon size={18} className="text-[#FF77CC]"/>
    </div>
    <p className={'mt-3 text-xl font-bold '+(statusTone[tone]||statusTone.neutral)}>{value}</p>
    <div className="mt-2 ccx-stat-marker"/>
    <p className="mt-3 text-xs leading-relaxed text-[#ADB9D3]">{detail}</p>
  </button>;
}
const modules=[
  {key:'directory',title:'Discover creators',description:'Find verified talent, videographers and production partners.',Icon:Search,tag:'DISCOVERY',color:'rgba(233,0,197,.17)'},
  {key:'production',title:'Production Manager',description:'Coordinate teams, shoot schedules, consent and project safety.',Icon:UsersRound,tag:'COORDINATE',color:'rgba(255,73,182,.17)'},
  {key:'hosting',title:'Locations & studios',description:'Explore and manage filming spaces, equipment and reservations.',Icon:Building2,tag:'BOOK SPACES',color:'rgba(79,140,255,.19)'},
  {key:'workspace',title:'Messages & projects',description:'Manage professional conversations, invites and collaborations.',Icon:MessageSquare,tag:'WORKSPACE',color:'rgba(181,93,246,.17)'},
  {key:'schedule',title:'Availability',description:'Keep your availability organized for the next collaboration.',Icon:CalendarDays,tag:'PLAN AHEAD',color:'rgba(79,140,255,.15)'},
  {key:'account-security',title:'Trust & account',description:'Control security, your account and access settings.',Icon:LockKeyhole,tag:'SECURITY',color:'rgba(255,73,182,.16)'},
];

export default function DashboardHome({profile,verification,approved,paid,isAdmin,onNavigate,features={}}){
  const name=profile?.display_name?.trim();
  const hasProfile=profile?.profile_complete===true;
  const canAccessWorkspace=Boolean(paid&&approved);
  const status=approved?'Verified':verification?.status==='pending'?'Pending review':'Not verified';
  const nextStep=!hasProfile?{key:'profile',label:'Complete your profile'}:
    !approved?{key:'verification',label:verification?.status==='pending'?'View verification':'Verify your age'}:
      {key:'hosting',label:'Explore studios & locations'};

  return <div className="space-y-6">
    <section className="ccx-hero rounded-[26px] min-h-[282px] md:min-h-[320px]">
      <div className="ccx-hero-ambient absolute inset-0 pointer-events-none"/>
      <div className="relative z-10 flex min-h-[282px] md:min-h-[320px] flex-col justify-center gap-4 px-6 py-10 md:px-10 md:py-12 max-w-[740px]">
        <div className="flex items-center gap-2 ccx-eyebrow"><Sparkles size={15}/> Your creative workspace</div>
        <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
          {name?<>Welcome back, <span className="ccx-gradient-text">{name}</span>.</>:
            <>Create. Collaborate. <span className="ccx-gradient-text">Connect.</span></>}
        </h2>
        <p className="max-w-lg text-sm sm:text-base leading-relaxed text-[#E2DAF3]">
          Your productions, collaborations, locations and professional tools in one private workspace.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={()=>onNavigate(nextStep.key)}
            className="ccx-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm">
            {nextStep.label}<ArrowUpRight size={17}/>
          </button>
          {approved&&<button onClick={()=>onNavigate('production')}
            className="ccx-secondary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm">
            Production Manager<ArrowRight size={17}/>
          </button>}
        </div>
      </div>
    </section>

    <section aria-label="Account readiness" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatusCard label="Age verification" value={status}
        detail={approved?'Your identity review is approved.':'Required before protected creator and studio features.'}
        tone={approved?'verified':verification?.status==='pending'?'pending':'neutral'}
        Icon={ShieldCheck} onClick={()=>onNavigate('verification')}/>
      <StatusCard label="Membership" value={paid?'Premium access':'Free account'}
        detail={paid?'Premium tools are available according to service readiness.':'Free discovery and account setup; premium actions need an active subscription.'}
        Icon={Zap} onClick={()=>onNavigate('membership')}/>
      <StatusCard label="Profile" value={hasProfile?'Complete':'Finish setup'}
        detail={hasProfile?'Your professional profile is ready for collaboration.':'Introduce yourself and set your creator or studio role.'}
        tone={hasProfile?'verified':'neutral'}
        Icon={UserRound} onClick={()=>onNavigate('profile')}/>
    </section>

    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="ccx-eyebrow">Your tools</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">Your creative command center</h3>
        </div>
        <p className="text-xs text-[#A9B5CE]">Protected actions follow your verification and membership status</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.filter(m=>
          m.key==='workspace'?canAccessWorkspace:
          m.key==='schedule'?canAccessWorkspace&&features.availability===true:
          m.key==='hosting'||m.key==='production'?approved:true
        ).map(({key,title,description,Icon,tag,color})=>
          <button key={key} className="ccx-module-card group"
            style={{'--ccx-card-glow':color}} onClick={()=>onNavigate(key)}>
            <span className="ccx-icon-wrap"><Icon size={22}/></span>
            <p className="mt-5 text-[10px] uppercase tracking-[.17em] font-bold text-[#FF89DB]">{tag}</p>
            <div className="mt-1 flex items-center gap-2">
              <h4 className="text-base font-bold text-white">{title}</h4>
              <ArrowUpRight size={15} className="text-[#FF91DF] opacity-60 group-hover:opacity-100"/>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#ABB9D5]">{description}</p>
          </button>
        )}
      </div>
    </section>
    <div className="ccx-surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="ccx-icon-wrap shrink-0"><CheckCircle2 size={21}/></span>
        <div>
          <h4 className="font-semibold">Build your professional presence</h4>
          <p className="mt-1 text-sm text-[#B4C1DA]">
            {approved?'Your account is verified. Keep your consents, bookings and professional details current.':
              'Complete profile and independent age verification to unlock the protected marketplace.'}
          </p>
        </div>
      </div>
      <button className="ccx-secondary shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold"
        onClick={()=>onNavigate(approved?'consent':'verification')}>
        {approved?'Review consent':'Continue verification'}
      </button>
    </div>
  </div>;
}
