/**
 * Airbnb-style private creator hosting marketplace.
 * Search/discovery: age-verified free. Requests: premium only.
 * Never renders exact address or guest identity in public listing cards.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, SlidersHorizontal, MapPin, Heart, CalendarDays, Users, Star,
  Camera, Home, Film, ArrowLeft, ShieldCheck, ImageIcon,
  Clock, ChevronRight, CheckCircle2, RefreshCw,
} from 'lucide-react';
import {
  hostingAction, rentalCategories, rentalAmenities, rentalUses, usd, dateTime,
} from './hostingApi';
import HostingHost from './HostingHost';
import HostingAreaMap from './HostingAreaMap';
import {hostingAdvanced} from './hostingBusinessApi';
import HostingBookingOperations from './HostingBookingOperations';
import {hostingBusiness} from './hostingBusinessApi';
import HostingNotificationSettings from './HostingNotificationSettings';
import HostingCrewInbox from './HostingCrewInbox';
import HostingWorkforceManager from './HostingWorkforceManager';
import {hostingProduction} from './hostingBusinessApi';

const panel='ccx-surface';
const input='w-full rounded-xl border border-[#34465E] bg-[#0B1422] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-fuchsia-500';
const button='rounded-xl ccx-action-primary px-5 py-3 text-sm font-semibold text-white transition  disabled:opacity-50';
const pill='rounded-full border border-[#34465E] px-3 py-1.5 text-xs text-[#C4D3E5]';
const empty='text-sm text-[#9AADC4]';
const labels=Object.fromEntries(rentalCategories);
const amenityLabels=Object.fromEntries(rentalAmenities);
const usageLabels=Object.fromEntries(rentalUses);

function Photo({photos,alt,height='h-52'}) {
  const src=photos?.[0]?.url;
  return <div className={height+' relative overflow-hidden rounded-xl bg-gradient-to-br from-[#253D63] via-[#1C2D49] to-[#101926]'}>
    {src?<img src={src} alt={alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy"/>:
    <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-[#839BB8]"><ImageIcon size={39}/><span className="text-xs">Gallery awaiting approval</span></div>}
  </div>;
}

function ListingCard({listing,favorite,toggle,open}) {
  return <article className={panel+' group overflow-hidden p-3 shadow-lg shadow-black/10'}>
    <div className="relative">
      <button onClick={()=>open(listing.id)} className="w-full text-left" aria-label={'View '+listing.title}>
        <Photo photos={listing.photos} alt={listing.title}/>
      </button>
      <button onClick={()=>toggle(listing.id)} aria-label={favorite?'Remove favorite':'Save property'}
        className={'absolute right-3 top-3 rounded-full p-2.5 backdrop-blur '+(favorite?'bg-[#E900C5] text-white':'bg-[#0B1524]/80 text-white')}>
        <Heart size={18} fill={favorite?'currentColor':'none'}/>
      </button>
      <div className="absolute left-3 top-3 pointer-events-none">
        <span className="rounded-full bg-[#101A2C]/90 px-3 py-1.5 text-xs font-medium text-white">{labels[listing.category]||'Location'}</span>
      </div>
    </div>
    <button className="w-full text-left px-1 pt-4" onClick={()=>open(listing.id)}>
      <h3 className="truncate text-base font-semibold text-white">{listing.title}</h3>
      <p className="mt-1 flex items-center gap-1 text-sm text-[#A4B6CB]"><MapPin size={14}/>{[listing.city,listing.state,listing.country].filter(Boolean).join(', ')}</p>
      <p className="mt-2 flex items-center gap-3 text-xs text-[#98AFCB]"><Users size={14}/>Up to {listing.capacity} people <Clock size={14}/>{listing.minimum_hours}h minimum</p>
      <div className="mt-2 flex items-center gap-1 text-xs text-[#AABDD5]">{listing.rating_count?<><Star size={14} className="text-yellow-300" fill="currentColor"/>{listing.rating_average} ({listing.rating_count} verified)</>:<>New listing · No reviews yet</>}</div>
      <div className="mt-3 flex items-baseline gap-1 border-t border-[#293649] pt-3"><strong className="text-lg text-white">{usd(listing.hourly_rate)}</strong><span className="text-sm text-[#A4B6CB]">/ hour</span><ChevronRight size={17} className="ml-auto"/></div>
    </button>
  </article>;
}

function ListingDetail({id,paid,favorites,toggle,back,onBooked}) {
  const [item,setItem]=useState(null);
  const [dates,setDates]=useState([]);
  const [reviews,setReviews]=useState([]);
  const [reviewSummary,setReviewSummary]=useState(null);
  const [suitability,setSuitability]=useState(null);
  const [photoIndex,setPhotoIndex]=useState(0);
  const [starts,setStarts]=useState('');
  const [ends,setEnds]=useState('');
  const [crew,setCrew]=useState(1);
  const [purpose,setPurpose]=useState('');
  const [notes,setNotes]=useState('');
  const [assetItems,setAssetItems]=useState([]);
  const [bundles,setBundles]=useState([]);
  const [selectedBundle,setSelectedBundle]=useState('');
  const [addonCounts,setAddonCounts]=useState({});
  const [discountCode,setDiscountCode]=useState('');
  const [secureQuote,setSecureQuote]=useState(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    let alive=true;
    Promise.all([hostingAction('listing',{id}),hostingAction('reviews_public',{id}),hostingAdvanced('addons_public',{property_id:id}),hostingProduction('suitability_get',{property_id:id})]).then(([r,reviewData,equipment,venue])=>{
      if(!alive)return;setItem(r.item);setDates(r.unavailable||[]);setReviews(reviewData.items||[]);setReviewSummary(reviewData);setAssetItems(equipment.assets||[]);setBundles(equipment.bundles||[]);setSuitability(venue.item||null);
      setPurpose(r.item?.permitted_uses?.[0]||'');
    }).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setBusy(false);});
    return()=>{alive=false;};
  },[id]);
  const hours=starts&&ends?(new Date(ends).getTime()-new Date(starts).getTime())/3600000:0;

  const bookingParams=()=>({
    property_id:item.id,starts_at:new Date(starts).toISOString(),ends_at:new Date(ends).toISOString(),
    crew_size:crew,requested_use:purpose,notes,
    addons:Object.entries(addonCounts).filter(([,qty])=>qty>0).map(([id,quantity])=>({id,quantity})),
    bundle_id:selectedBundle||null,discount_code:discountCode.trim()||null
  });
  const calculate=async()=>{
    setBusy(true);setError('');setNotice('');setSecureQuote(null);
    try{
      const result=await hostingAdvanced('quote',bookingParams());
      setSecureQuote(result.quote);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const submit=async(e)=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const result=await hostingAdvanced('reserve',bookingParams());
      setNotice(result.note||'Booking request submitted. No payment collected.');
      setStarts('');setEnds('');setNotes('');setSecureQuote(null);
      onBooked?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  if(busy&&!item)return <div className={panel+' p-8 text-[#A6B5C8]'}>Loading location…</div>;
  if(!item)return <div className={panel+' p-8'}><button onClick={back} className="text-blue-300">Back to spaces</button><p className="mt-4 text-red-300">{error||'Location unavailable'}</p></div>;
  const photo=item.photos?.[photoIndex];
  return <div className="space-y-6">
    <button className="flex items-center gap-2 text-sm text-[#9FB5D2] hover:text-white" onClick={back}><ArrowLeft size={17}/>Back to hosting</button>
    <div className="flex flex-wrap justify-between gap-3"><div>
      <p className="text-xs uppercase tracking-[0.18em] text-blue-400">{labels[item.category]}</p>
      <h2 className="mt-1 text-3xl font-semibold text-white">{item.title}</h2>
      <p className="mt-2 flex gap-2 items-center text-sm text-[#A4B6CB]"><MapPin size={16}/>{[item.city,item.state,item.country].filter(Boolean).join(', ')}</p><a target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-blue-300" href={'https://www.openstreetmap.org/search?query='+encodeURIComponent([item.city,item.state,item.country].filter(Boolean).join(', '))}>Explore general neighborhood map</a>
    </div><button className={pill+' h-fit flex items-center gap-2'} onClick={()=>toggle(item.id)}><Heart size={16} fill={favorites.includes(item.id)?'currentColor':'none'}/>{favorites.includes(item.id)?'Saved':'Save location'}</button></div>
    <div className="grid gap-3 md:grid-cols-3">
      <div className="md:col-span-2 overflow-hidden rounded-2xl bg-[#1B2B45] min-h-72">
        {photo?.url?<img alt={photo.caption||item.title} src={photo.url} className="h-full max-h-[520px] w-full object-cover"/>:<div className="flex h-full min-h-[320px] flex-col items-center justify-center text-[#7E97B7]"><ImageIcon size={52}/>No approved property photos</div>}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        {(item.photos||[]).slice(0,4).map((pic,i)=><button className={'overflow-hidden rounded-xl '+(photoIndex===i?'ring-2 ring-blue-500':'')} key={pic.id} onClick={()=>setPhotoIndex(i)}><img src={pic.url} alt={pic.caption||'Property photo'} className="h-28 w-full object-cover md:h-[118px]"/></button>)}
      </div>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className={panel+' p-6'}><h3 className="text-xl font-semibold">About this space</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#B4C5DC]">{item.description||'This host has not added a description.'}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <span className={pill}><Users size={14} className="inline mr-2"/>{item.capacity} people</span>
            <span className={pill}><Clock size={14} className="inline mr-2"/>{item.minimum_hours} hour minimum</span>
            <span className={pill}><ShieldCheck size={14} className="inline mr-2"/>Verified host listing</span>
          </div>
        </section>
        <section className={panel+' p-6'}><h3 className="text-lg font-semibold">Amenities</h3>
          <div className="mt-4 flex flex-wrap gap-2">{item.amenities?.length?item.amenities.map(a=><span className={pill} key={a}>{amenityLabels[a]||a}</span>):<span className={empty}>No amenities listed</span>}</div>
        </section>
        <section className={panel+' p-6'}><h3 className="text-lg font-semibold">Production suitability</h3>
          {!suitability?<p className="mt-2 text-sm text-[#A3B7D0]">No venue suitability declaration is available.</p>:
           <div className="mt-3 flex flex-wrap gap-2 text-xs">
             {suitability.adult_production_permitted&&<span className={pill}>Host declares adult production permitted</span>}
             {suitability.soundproof_confirmed&&<span className={pill}>Host-declared soundproofing</span>}
             <span className={pill}>{suitability.parking_spaces} parking spaces</span>
             <span className={pill}>{suitability.separate_dressing_rooms} dressing rooms</span>
             <span className={pill}>Privacy: {suitability.privacy_level?.replaceAll('_',' ')}</span>
             {suitability.permits_verified&&<span className="rounded-full bg-emerald-900 px-3 py-1.5">Independent venue suitability review recorded</span>}
             {!suitability.permits_verified&&<span className="text-amber-200">Host-declared, not independently verified</span>}
           </div>}
        </section>
        <section className={panel+' p-6'}><h3 className="text-lg font-semibold">Permitted production uses</h3>
          <div className="mt-3 flex flex-wrap gap-2">{(item.permitted_uses||[]).map(p=><span key={p} className="rounded-full bg-blue-500/10 px-3 py-2 text-xs text-blue-200"><CheckCircle2 size={13} className="inline mr-1"/>{usageLabels[p]||p}</span>)}</div>
          <p className="mt-4 text-sm text-[#A9BDD6] whitespace-pre-wrap">{item.rules||'Confirm all production details with the host before booking.'}</p>
        </section>
        <section className={panel+' p-6'}><h3 className="font-semibold flex items-center gap-2"><Star size={17}/>Verified guest reviews {reviewSummary?.count?'('+reviewSummary.count+', '+reviewSummary.average+'/5)':''}</h3>
          {!reviews.length&&<p className={empty+' mt-3'}>No published reviews from completed bookings yet.</p>}
          {reviews.map(review=><div className="mt-3 border-t border-[#293649] pt-3" key={review.id}><p className="font-semibold text-sm">{review.rating}/5 stars</p><p className="text-sm text-[#B4C5DC] whitespace-pre-wrap">{review.description}</p></div>)}
        </section>
        <section className={panel+' p-6'}><h3 className="font-semibold">Calendar conflicts</h3>
          <p className="mt-2 text-sm text-[#A3B5CD]">Requested and accepted reservations reserve the time. Setup and cleanup buffers are enforced automatically.</p>
          <div className="mt-3 flex flex-wrap gap-2">{dates.length?dates.slice(0,14).map((d,i)=><span key={i} className="rounded-lg bg-[#263449] px-3 py-2 text-xs text-[#B8C9DA]">{dateTime(d.starts_at)} – {dateTime(d.ends_at)}</span>):<p className={empty}>No upcoming blocked dates</p>}</div>
        </section>
      </div>
      <form className={panel+' h-fit p-6 space-y-4 lg:sticky lg:top-5'} onSubmit={submit}>
        <h3 className="text-2xl font-semibold">{usd(item.hourly_rate)} <span className="text-sm font-normal text-[#AABDD4]">/ hour</span></h3>
        {error&&<p className="rounded-lg bg-red-950 p-3 text-sm text-red-200" role="alert">{error}</p>}
        {notice&&<p className="rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200" role="status">{notice}</p>}
        <label className="block text-sm">Start date & time<input className={input+' mt-1'} type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)} required/></label>
        <label className="block text-sm">End date & time<input className={input+' mt-1'} type="datetime-local" value={ends} onChange={e=>setEnds(e.target.value)} required/></label>
        <label className="block text-sm">Crew size<input type="number" min={1} max={item.capacity} className={input+' mt-1'} value={crew} onChange={e=>setCrew(Number(e.target.value))}/></label>
        <label className="block text-sm">Requested production use<select className={input+' mt-1'} value={purpose} onChange={e=>setPurpose(e.target.value)}>{(item.permitted_uses||[]).map(v=><option key={v} value={v}>{usageLabels[v]||v}</option>)}</select></label>
        {assetItems.length>0&&<div className="space-y-3 rounded-xl border border-[#304967] p-3"><h4 className="font-semibold text-sm">Production equipment and add-ons</h4>
          {assetItems.map(asset=><label key={asset.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{asset.label} · {usd(asset.hourly_cents/100)}/hr · {asset.quantity} available</span>
            <input className={input+' max-w-[90px]'} type="number" min={0} max={asset.quantity} value={addonCounts[asset.id]||0}
             onChange={e=>{setAddonCounts(p=>({...p,[asset.id]:Number(e.target.value)}));setSecureQuote(null);}}/>
          </label>)}
          {bundles.length>0&&<label className="block text-xs">Equipment bundle<select className={input+' mt-1'} value={selectedBundle}
            onChange={e=>{setSelectedBundle(e.target.value);setSecureQuote(null);}}>
             <option value="">No bundle</option>{bundles.map(b=><option key={b.id} value={b.id}>{b.title} · {b.discount_bps/100}% equipment discount</option>)}
          </select></label>}
        </div>}
        <label className="block text-xs">Discount code (optional)<input className={input+' mt-1'} maxLength={40} value={discountCode}
          onChange={e=>{setDiscountCode(e.target.value);setSecureQuote(null);}} placeholder="Enter code"/></label>
        <label className="block text-sm">Message to host<textarea className={input+' mt-1'} rows={3} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Describe your shoot, equipment and special requests."/></label>
        <div className="rounded-xl border-y border-[#34465E] py-3 text-sm space-y-2">
          <p className="text-[#AABDD4]">{hours>0?hours.toFixed(2)+' hours':'Select booking dates'} · Minimum notice: {item.min_notice_hours||24}h</p>
          {secureQuote?<div className="space-y-2">
            <div className="flex justify-between"><span>Rental</span><strong>{usd(secureQuote.rental_cents/100)}</strong></div>
            <div className="flex justify-between"><span>Equipment</span><span>{usd(secureQuote.addon_cents/100)}</span></div>
            <div className="flex justify-between"><span>Cleaning fee</span><span>{usd(secureQuote.cleaning_cents/100)}</span></div>
            {secureQuote.discount_cents>0&&<div className="flex justify-between text-emerald-300"><span>Discounts</span><span>-{usd(secureQuote.discount_cents/100)}</span></div>}
            <div className="flex justify-between border-t border-[#34465E] pt-2 font-semibold"><span>Booking total</span><span>{usd(secureQuote.total_cents/100)}</span></div>
            <p className="text-xs text-[#A6B9D2]">Proposed deposit ceiling: {usd(secureQuote.deposit_cents/100)} · Overtime: {usd(secureQuote.overtime_hour_cents/100)}/h</p>
          </div>:<p className="text-xs text-[#98AFCB]">Calculate the authoritative server quote before requesting. Rates may vary by date, bundle or promotion.</p>}
        </div>
        <button type="button" className={button+' w-full bg-[#233F70]'} onClick={calculate} disabled={!paid||busy||hours<item.minimum_hours||crew<1||!purpose}>Calculate secure price</button>
        <button type="submit" className={button+' w-full'} disabled={!paid||busy||!secureQuote}>{paid?'Request space with this quote':'Premium booking required'}</button>
        <p className="text-center text-xs leading-5 text-[#A3B5CD]">No payment is collected here. The host must approve your request. The exact address is shared only through a trusted post-approval process, not through search results.</p>
      </form>
    </div>
  </div>;
}

export default function HostingMarketplace({paid=false,isAdmin=false,user}) {
  const [section,setSection]=useState('explore');
  const [selected,setSelected]=useState('');
  const [query,setQuery]=useState('');
  const [city,setCity]=useState('');
  const [category,setCategory]=useState('');
  const [maxPrice,setMaxPrice]=useState('');
  const [crew,setCrew]=useState('');
  const [amenity,setAmenity]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [onlySaved,setOnlySaved]=useState(false);
  const [showMap,setShowMap]=useState(true);
  const [areas,setAreas]=useState([]);
  const [mapBounds,setMapBounds]=useState(null);
  const [listings,setListings]=useState([]);
  const [favorites,setFavorites]=useState([]);
  const [myBookings,setMyBookings]=useState([]);
  const [expandedBooking,setExpandedBooking]=useState('');
  const [entryDetails,setEntryDetails]=useState({});
  const [reviewRatings,setReviewRatings]=useState({});
  const [reviewTexts,setReviewTexts]=useState({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const search=useCallback(async(boundsOverride=null)=>{
    setBusy(true);setError('');
    try{
      const [browse,favs,bookings]=await Promise.all([
        hostingAction('browse',{query,city,category,max_price:maxPrice,crew_size:crew,amenity,from:from?new Date(from).toISOString():null,to:to?new Date(to).toISOString():null,bounds:boundsOverride===false?null:(boundsOverride||mapBounds)}),
        hostingAction('favorites'),hostingAction('my_bookings'),
      ]);
      setListings(browse.items||[]);setFavorites(favs.ids||[]);setMyBookings(bookings.items||[]);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  },[query,city,category,maxPrice,crew,amenity,from,to,mapBounds]);
  useEffect(()=>{search();hostingAdvanced('areas_public').then(r=>setAreas(r.items||[])).catch(()=>{});},[]);

  const toggle=async(id)=>{
    setError('');
    try{
      const result=await hostingAction('favorite_toggle',{id});
      setFavorites(p=>result.favorite?[...new Set([...p,id])]:p.filter(x=>x!==id));
    }catch(e){setError(e.message);}
  };
  const cancel=async(id)=>{
    if(!window.confirm('Cancel your booking request?'))return;
    setError('');setNotice('');
    try{
      await hostingBusiness('cancel_booking',{booking_id:id});setNotice('Your booking is cancelled. Refunds, if eligible, remain pending provider confirmation.');
      const result=await hostingAction('my_bookings');setMyBookings(result.items||[]);
    }catch(e){setError(e.message);}
  };

  const viewEntry=async(id)=>{
    setError('');
    try{
      const response=await hostingAction('guest_checkin_details',{booking_id:id});
      setEntryDetails(p=>({...p,[id]:response.item}));
    }catch(e){setError(e.message);}
  };
  const reviewBooking=async(booking)=>{
    setError('');setNotice('');
    try{
      const response=await hostingAction('reviews_submit',{
        booking_id:booking.id,rating:Number(reviewRatings[booking.id]||5),
        description:reviewTexts[booking.id]||''
      });
      setNotice(response.note||'Review submitted for moderation.');
    }catch(e){setError(e.message);}
  };
  const visible=useMemo(()=>onlySaved?listings.filter(v=>favorites.includes(v.id)):listings,[listings,favorites,onlySaved]);

  return <div className="space-y-6 text-white">
    <div className="ccx-hosting-banner relative overflow-hidden rounded-3xl px-6 py-8 sm:px-10 sm:py-10">
      <div className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl"/>
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.21em] text-blue-300">CONTENT CONNECT X • HOSTING</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">The right space for every production.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#B7CBE4]">Discover professionally listed studios, locations, sets and equipment. Book by the hour, coordinate with verified hosts, and keep production details private.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className={pill+' bg-white/5'}><ShieldCheck size={14} className="inline mr-1"/>Age-verified marketplace</span>
          <span className={pill+' bg-white/5'}><Film size={14} className="inline mr-1"/>Production-first rentals</span>
          <span className={pill+' bg-white/5'}><CalendarDays size={14} className="inline mr-1"/>Hourly reservations</span>
        </div>
      </div>
    </div>
    <nav className="flex flex-wrap gap-2">
      {/** @type {Array<[string, string, import('react').ElementType]>} */ ([['explore','Explore spaces',Search],['favorites','Saved',Heart],['bookings','My requests',CalendarDays],...(paid?[['host','Host dashboard',Home]]:[]),...(isAdmin?[['review','Listing approvals',ShieldCheck]]:[]),['alerts','Notifications',CalendarDays],['crew','Crew invitations',Users],['cleaning','My cleaning jobs',Home]])
      .map(([key,label,Icon])=><button key={key} className={'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm '+(section===key?'ccx-action-primary text-white':'border border-[#31435C] bg-[#141D2B] text-[#BED0E6]')} onClick={()=>{setSection(key);setSelected('');setError('');}}><Icon size={16}/>{label}</button>)}
    </nav>
    {error&&<p className="rounded-xl border border-red-700/50 bg-red-900/20 p-3 text-sm text-red-300" role="alert">{error}</p>}
    {notice&&<p className="rounded-xl border border-green-700/50 bg-green-900/20 p-3 text-sm text-green-300" role="status">{notice}</p>}

    {(section==='explore'||section==='favorites')&&<>
      {selected?<ListingDetail id={selected} paid={paid} favorites={favorites} toggle={toggle} back={()=>setSelected('')} onBooked={()=>search()}/>:
      <div className="space-y-5">
        <form onSubmit={e=>{e.preventDefault();search();}} className={panel+' grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-4'}>
          <label className="block text-xs text-[#ADC1DA]">Find a space<input className={input+' mt-1'} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Studio, loft, location…"/></label>
          <label className="block text-xs text-[#ADC1DA]">City<input className={input+' mt-1'} value={city} onChange={e=>setCity(e.target.value)} placeholder="Los Angeles"/></label>
          <label className="block text-xs text-[#ADC1DA]">Category<select value={category} onChange={e=>setCategory(e.target.value)} className={input+' mt-1'}><option value="">All spaces</option>{rentalCategories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
          <label className="block text-xs text-[#ADC1DA]">Max $/hr<input className={input+' mt-1'} type="number" min={1} value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Any"/></label>
          <label className="block text-xs text-[#ADC1DA]">Crew size<input className={input+' mt-1'} type="number" min={1} value={crew} onChange={e=>setCrew(e.target.value)} placeholder="Any"/></label>
          <label className="block text-xs text-[#ADC1DA]">Amenity<select className={input+' mt-1'} value={amenity} onChange={e=>setAmenity(e.target.value)}><option value="">All amenities</option>{rentalAmenities.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
          <label className="block text-xs text-[#ADC1DA]">Available from<input className={input+' mt-1'} type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)}/></label>
          <label className="block text-xs text-[#ADC1DA]">Available until<input className={input+' mt-1'} type="datetime-local" value={to} onChange={e=>setTo(e.target.value)}/></label>
          <button type="submit" disabled={busy} className={button+' mt-4 self-end'}><SlidersHorizontal size={16} className="inline mr-2"/>Search spaces</button>
        </form>
        <div className="flex flex-wrap gap-2 items-center">
          <button className={showMap?button: 'rounded-lg border border-[#34465E] px-4 py-2 text-sm'} onClick={()=>setShowMap(!showMap)}>
            {showMap?'Hide interactive map':'Show interactive map'}
          </button>
          {mapBounds&&<button className="text-xs text-blue-300" onClick={()=>{setMapBounds(null);search(false);}}>Clear map-area search</button>}
        </div>
        {showMap&&<HostingAreaMap areas={areas} listings={listings} onSelect={setSelected}
           onSearchBounds={bounds=>{setMapBounds(bounds);search(bounds);}}/>}
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{section==='favorites'?'Your saved locations':'Explore professional spaces'}</h2><p className="mt-1 text-xs text-[#91A7C4]">{visible.length} approved {visible.length===1?'listing':'listings'} · Search returns only general location information</p></div>
          <button className="flex items-center gap-2 text-sm text-blue-300" onClick={search} disabled={busy}><RefreshCw size={15}/>Refresh</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(section==='favorites'?listings.filter(v=>favorites.includes(v.id)):visible).map(item=>
            <ListingCard key={item.id} listing={item} favorite={favorites.includes(item.id)} toggle={toggle} open={setSelected}/>
          )}
        </div>
        {!(section==='favorites'?listings.filter(v=>favorites.includes(v.id)):visible).length&&<div className={panel+' flex min-h-52 flex-col items-center justify-center gap-3 p-10 text-center'}><Camera size={34} className="text-blue-300"/><h3 className="font-semibold">No spaces matched</h3><p className={empty}>Try another city or category. Only approved and verified locations appear in search.</p></div>}
      </div>}
    </>}

    {section==='bookings'&&<div className={panel+' space-y-3 p-6'}>
      <h2 className="text-xl font-semibold">Your reservation requests</h2>
      <p className={empty}>Requests do not collect payment or disclose a venue's private address.</p>
      {!myBookings.length&&<p className={empty+' py-6'}>No booking requests yet.</p>}
      {myBookings.map(b=><div key={b.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[#33445C] py-4">
        <div className="space-y-1"><p className="text-sm font-semibold">{dateTime(b.starts_at)} – {dateTime(b.ends_at)}</p>
          <p className={empty}>Crew {b.crew_size} · {usageLabels[b.requested_use]||b.requested_use} · Estimated {usd(b.estimated_total)}</p>
          <p className="text-xs text-[#8095B0]">Reference: {b.id}</p><button onClick={()=>setExpandedBooking(expandedBooking===b.id?'':b.id)} className="mt-2 block text-sm text-blue-300">{expandedBooking===b.id?'Hide booking operations':'Agreement, payment, cancellation, claims'}</button>
          {expandedBooking===b.id&&<div className="mt-4 max-w-3xl"><HostingBookingOperations bookingId={b.id} userId={user?.id}/></div>}
          {entryDetails[b.id]&&<div className="mt-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3"><p className="font-semibold text-sm">Private access details</p><p className="text-sm">{entryDetails[b.id].exact_address||'Host has not supplied address yet.'}</p><p className="text-xs whitespace-pre-wrap text-[#AEC5E1]">{entryDetails[b.id].entry_instructions||''}</p></div>}
          {b.status==='completed'&&<div className="mt-3 flex flex-wrap gap-2"><select className={input+' max-w-[150px]'} value={reviewRatings[b.id]||5} onChange={e=>setReviewRatings(p=>({...p,[b.id]:Number(e.target.value)}))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n}/5 stars</option>)}</select><input className={input+' min-w-[160px] flex-1'} placeholder="Public professional review" value={reviewTexts[b.id]||''} maxLength={1200} onChange={e=>setReviewTexts(p=>({...p,[b.id]:e.target.value}))}/><button className={button} onClick={()=>reviewBooking(b)}>Submit review</button></div>}
          </div>
        <div className="flex flex-wrap gap-2 items-start">{['accepted','completed'].includes(b.status)&&<button className={pill} onClick={()=>viewEntry(b.id)}>Private entry instructions</button>}<span className="rounded-full bg-blue-500/10 px-3 py-2 text-xs capitalize text-blue-300">{b.status}</span>
          {['requested','accepted'].includes(b.status)&&<button onClick={()=>cancel(b.id)} className="text-sm text-red-300">Cancel</button>}</div>
      </div>)}
    </div>}

    {section==='alerts'&&<HostingNotificationSettings/>}
    {section==='crew'&&<HostingCrewInbox/>}
    {section==='cleaning'&&<HostingWorkforceManager worker/>}
    {(section==='host'||section==='review')&&<HostingHost paid={paid} isAdmin={isAdmin} reviewMode={section==='review'} user={user}/>}
  </div>;
}