import PropertyVirtualTour from './PropertyVirtualTour';
import PropertyAmenities,{usePropertyAmenities} from './PropertyAmenities';
import {supabase} from '@/api/supabaseClient';
/**
 * Airbnb-style private creator hosting marketplace.
 * Search/discovery: age-verified free. Requests: premium only.
 * Never renders exact address or guest identity in public listing cards.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, SlidersHorizontal, MapPin, Heart, CalendarDays, Users, Star,
  Camera, Home, ArrowLeft, ShieldCheck, Clock, CheckCircle2, RefreshCw,
} from 'lucide-react';
import {
  hostingAction, rentalCategories, rentalAmenities, rentalUses, usd, dateTime,
} from './hostingApi';
import HostingHost from './HostingHost';
import {PropertyPreviewCard} from './HostPortfolio';
import PropertyPhotoGallery from './PropertyPhotoGallery';
import HostingAreaMap from './HostingAreaMap';
import HostingDateRange from './HostingDateRange';
import {validRange} from './hostingDateRange.mjs';
import {hostingAdvanced} from './hostingBusinessApi';
import HostingBookingOperations from './HostingBookingOperations';
import {hostingBusiness} from './hostingBusinessApi';
import HostingNotificationSettings from './HostingNotificationSettings';
import HostingCrewInbox from './HostingCrewInbox';
import HostingWorkforceManager from './HostingWorkforceManager';
import {hostingProduction} from './hostingBusinessApi';

const panel='ccx-surface';
const input='w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] px-4 py-3 text-sm text-[var(--cc-text-primary)] outline-none focus:ring-2 focus:ring-fuchsia-500';
const button='rounded-xl ccx-action-primary px-5 py-3 text-sm font-semibold text-[var(--cc-text-primary)] transition  disabled:opacity-50';
const pill='rounded-full border border-[var(--cc-border)] px-3 py-1.5 text-xs text-[var(--cc-text-secondary)]';
const empty='text-sm text-[var(--cc-text-secondary)]';
const labels=Object.fromEntries(rentalCategories);
const amenityLabels=Object.fromEntries(rentalAmenities);
const usageLabels=Object.fromEntries(rentalUses);

function ListingCard({listing,favorite,toggle,open}) {
 return <PropertyPreviewCard listing={listing} favorite={favorite} onFavorite={toggle} onOpen={open}/>;
}

function ListingDetail({id,paid,favorites,toggle,back,onBooked,brand='content_connect'}) {
  const [item,setItem]=useState(null);
  const {amenities:amenityCatalog}=usePropertyAmenities();
  const liveAmenityLabels={...amenityLabels,...Object.fromEntries(amenityCatalog.map(v=>[v.key,v.label]))};
  const [dates,setDates]=useState([]);
  const [reviews,setReviews]=useState([]);
  const [reviewSummary,setReviewSummary]=useState(null);
  const [suitability,setSuitability]=useState(null);
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
  const hours=validRange(starts,ends)?(new Date(ends).getTime()-new Date(starts).getTime())/3600000:0;

  const bookingParams=()=>({
    property_id:item.id,starts_at:new Date(starts).toISOString(),ends_at:new Date(ends).toISOString(),
    crew_size:crew,requested_use:purpose,notes,source_brand:brand,
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
  if(busy&&!item)return <div className={panel+' p-8 text-[var(--cc-text-secondary)]'}>Loading location…</div>;
  if(!item)return <div className={panel+' p-8'}><button onClick={back} className="text-[var(--cc-text-secondary)]">Back to spaces</button><p className="mt-4 text-red-800">{error||'Location unavailable'}</p></div>;
  return <div className="space-y-6">
    <button className="flex items-center gap-2 text-sm text-[var(--cc-text-secondary)] hover:text-[var(--cc-text-primary)]" onClick={back}><ArrowLeft size={17}/>Back to hosting</button>
    <div className="flex flex-wrap justify-between gap-3"><div>
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--cc-text-secondary)]">{labels[item.category]}</p>
      <h2 className="mt-1 text-3xl font-semibold text-[var(--cc-text-primary)]">{item.title}</h2>
      <p className="mt-2 flex gap-2 items-center text-sm text-[var(--cc-text-secondary)]"><MapPin size={16}/>{item.public_address||[item.city,item.state,item.country].filter(Boolean).join(', ')}</p><a target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--cc-text-secondary)]" href={'https://www.openstreetmap.org/search?query='+encodeURIComponent([item.city,item.state,item.country].filter(Boolean).join(', '))}>Explore general neighborhood map</a>
    </div><button className={pill+' h-fit flex items-center gap-2'} onClick={()=>toggle(item.id)}><Heart size={16} fill={favorites.includes(item.id)?'currentColor':'none'}/>{favorites.includes(item.id)?'Saved':'Save location'}</button></div>
    <PropertyPhotoGallery propertyId={item.id} title={item.title} photos={item.photos||[]} total={item.photo_count||0}/>
    {(item.videos||[]).length>0&&<section className={panel+' space-y-3 p-5'} aria-label="Approved property walk-through videos">
      <h3 className="text-lg font-semibold">Property walkthrough videos</h3>
      <div className="grid gap-3 sm:grid-cols-2">{item.videos.map(video=>
        <figure key={video.id} className="overflow-hidden rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)]">
          <video src={video.url} controls preload="metadata" playsInline className="aspect-video w-full object-cover"
            aria-label={video.caption||'Property walkthrough'} />
          <figcaption className="p-3 text-xs text-[var(--cc-text-secondary)]">{video.caption||'Approved property video'}</figcaption>
        </figure>)}</div>
    </section>}
    <PropertyVirtualTour propertyId={item.id} title={item.title}/>
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className={panel+' p-6'}><h3 className="text-xl font-semibold">About this space</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--cc-text-secondary)]">{item.description||'This host has not added a description.'}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <span className={pill}><Users size={14} className="inline mr-2"/>{item.capacity} people</span>
            <span className={pill}><Clock size={14} className="inline mr-2"/>{item.minimum_hours} hour minimum</span>
            <span className={pill}><ShieldCheck size={14} className="inline mr-2"/>Verified host listing</span>
          </div>
        </section>
        <section className={panel+' p-6'}><h3 className="text-lg font-semibold">Amenities</h3>
          <div className="mt-4 flex flex-wrap gap-2">{item.amenities?.length?item.amenities.map(a=><span className={pill} key={a}>{liveAmenityLabels[a]||a}</span>):<span className={empty}>No amenities listed</span>}</div>
        </section>
        <section className={panel+' p-6'}><h3 className="text-lg font-semibold">Production suitability</h3>
          {!suitability?<p className="mt-2 text-sm text-[var(--cc-text-secondary)]">No venue suitability declaration is available.</p>:
           <div className="mt-3 flex flex-wrap gap-2 text-xs">
             {suitability.adult_production_permitted&&<span className={pill}>Host declares adult production permitted</span>}
             {suitability.soundproof_confirmed&&<span className={pill}>Host-declared soundproofing</span>}
             <span className={pill}>{suitability.parking_spaces} parking spaces</span>
             <span className={pill}>{suitability.separate_dressing_rooms} dressing rooms</span>
             <span className={pill}>Privacy: {suitability.privacy_level?.replaceAll('_',' ')}</span>
             {suitability.permits_verified&&<span className="rounded-full bg-emerald-50 px-3 py-1.5">Independent venue suitability review recorded</span>}
             {!suitability.permits_verified&&<span className="text-amber-800">Host-declared, not independently verified</span>}
           </div>}
        </section>
        <section className={panel+' p-6'}><h3 className="text-lg font-semibold">Permitted production uses</h3>
          <div className="mt-3 flex flex-wrap gap-2">{(item.permitted_uses||[]).map(p=><span key={p} className="rounded-full bg-[var(--cc-surface-subtle)] px-3 py-2 text-xs text-[var(--cc-text-secondary)]"><CheckCircle2 size={13} className="inline mr-1"/>{usageLabels[p]||p}</span>)}</div>
          <p className="mt-4 text-sm text-[var(--cc-text-secondary)] whitespace-pre-wrap">{item.rules||'Confirm all production details with the host before booking.'}</p>
        </section>
        <section className={panel+' p-6'}><h3 className="font-semibold flex items-center gap-2"><Star size={17}/>Verified guest reviews {reviewSummary?.count?'('+reviewSummary.count+', '+reviewSummary.average+'/5)':''}</h3>
          {!reviews.length&&<p className={empty+' mt-3'}>No published reviews from completed bookings yet.</p>}
          {reviews.map(review=><div className="mt-3 border-t border-[var(--cc-border)] pt-3" key={review.id}><p className="font-semibold text-sm">{review.rating}/5 stars</p><p className="text-sm text-[var(--cc-text-secondary)] whitespace-pre-wrap">{review.description}</p></div>)}
        </section>
        <section className={panel+' p-6'}><h3 className="font-semibold">Calendar conflicts</h3>
          <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">Requested and accepted reservations reserve the time. Setup and cleanup buffers are enforced automatically.</p>
          <div className="mt-3 flex flex-wrap gap-2">{dates.length?dates.slice(0,14).map((d,i)=><span key={i} className="rounded-lg bg-[var(--cc-surface)] px-3 py-2 text-xs text-[var(--cc-text-secondary)]">{dateTime(d.starts_at)} – {dateTime(d.ends_at)}</span>):<p className={empty}>No upcoming blocked dates</p>}</div>
        </section>
      </div>
      <form className={panel+' h-fit p-6 space-y-4 lg:sticky lg:top-5'} onSubmit={submit}>
        <h3 className="text-2xl font-semibold">{usd(item.hourly_rate)} <span className="text-sm font-normal text-[var(--cc-text-secondary)]">/ hour</span></h3>
        {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        {notice&&<p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</p>}
        <HostingDateRange label="Rental check-in and checkout" start={starts} end={ends}
         onChange={({start,end})=>{setStarts(start);setEnds(end);setSecureQuote(null);}} defaultOpen/>
        <label className="block text-sm">Crew size<input type="number" min={1} max={item.capacity} className={input+' mt-1'} value={crew} onChange={e=>setCrew(Number(e.target.value))}/></label>
        <label className="block text-sm">Requested production use<select className={input+' mt-1'} value={purpose} onChange={e=>setPurpose(e.target.value)}>{(item.permitted_uses||[]).map(v=><option key={v} value={v}>{usageLabels[v]||v}</option>)}</select></label>
        {assetItems.length>0&&<div className="space-y-3 rounded-xl border border-[var(--cc-border)] p-3"><h4 className="font-semibold text-sm">Production equipment and add-ons</h4>
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
        <div className="rounded-xl border-y border-[var(--cc-border)] py-3 text-sm space-y-2">
          <p className="text-[var(--cc-text-secondary)]">{hours>0?hours.toFixed(2)+' hours':'Select booking dates'} · Minimum notice: {item.min_notice_hours||24}h</p>
          {secureQuote?<div className="space-y-2">
            <div className="flex justify-between"><span>Rental</span><strong>{usd(secureQuote.rental_cents/100)}</strong></div>
            <div className="flex justify-between"><span>Equipment</span><span>{usd(secureQuote.addon_cents/100)}</span></div>
            <div className="flex justify-between"><span>Cleaning fee</span><span>{usd(secureQuote.cleaning_cents/100)}</span></div>
            {secureQuote.discount_cents>0&&<div className="flex justify-between text-emerald-800"><span>Discounts</span><span>-{usd(secureQuote.discount_cents/100)}</span></div>}
            <div className="flex justify-between border-t border-[var(--cc-border)] pt-2 font-semibold"><span>Booking total</span><span>{usd(secureQuote.total_cents/100)}</span></div>
            <p className="text-xs text-[var(--cc-text-secondary)]">Proposed deposit ceiling: {usd(secureQuote.deposit_cents/100)} · Overtime: {usd(secureQuote.overtime_hour_cents/100)}/h</p>
          </div>:<p className="text-xs text-[var(--cc-text-secondary)]">Calculate the authoritative server quote before requesting. Rates may vary by date, bundle or promotion.</p>}
        </div>
        <button type="button" className={button+' w-full bg-[var(--cc-surface)]'} onClick={calculate} disabled={!paid||busy||hours<item.minimum_hours||crew<1||!purpose}>Calculate secure price</button>
        <button type="submit" className={button+' w-full'} disabled={!paid||busy||!secureQuote}>{paid?'Request space with this quote':'Premium booking required'}</button>
        <p className="text-center text-xs leading-5 text-[var(--cc-text-secondary)]">No payment is collected here. The host must approve your request. The exact address is shared only through a trusted post-approval process, not through search results.</p>
      </form>
    </div>
  </div>;
}

export default function HostingMarketplace({paid=false,isAdmin=false,user,brand='content_connect',initialSection='explore',hostOnly=false}) {
  const [section,setSection]=useState(()=>hostOnly?initialSection:['explore','favorites','bookings'].includes(initialSection)?initialSection:'explore');
  const [selected,setSelected]=useState('');
  const query='';
  const [country,setCountry]=useState('');
  const [region,setRegion]=useState('');
  const [locations,setLocations]=useState([]);
  const [city,setCity]=useState('');
  const [category,setCategory]=useState('');
  const [maxPrice,setMaxPrice]=useState('');
  const [crew,setCrew]=useState('');
  const [selectedAmenities,setSelectedAmenities]=useState([]);
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

  const searchGeneration=React.useRef(0);
  const search=useCallback(async(boundsOverride=null)=>{
    const request=++searchGeneration.current;
    setBusy(true);setError('');
    try{
      const [browse,favs,bookings]=await Promise.all([
        hostingAction('browse',{query,city,state:region,country,category,max_price:maxPrice,crew_size:crew,amenities:selectedAmenities,from:from?new Date(from).toISOString():null,to:to?new Date(to).toISOString():null,bounds:boundsOverride===false?null:(boundsOverride||mapBounds)}),
        hostingAction('favorites'),hostingAction('my_bookings'),
      ]);
      if(request!==searchGeneration.current)return;
      setListings(browse.items||[]);setFavorites(favs.ids||[]);setMyBookings(bookings.items||[]);
    }catch(e){if(request===searchGeneration.current)setError(e.message);}finally{if(request===searchGeneration.current)setBusy(false);}
  },[query,city,region,country,category,maxPrice,crew,selectedAmenities,from,to,mapBounds]);
  useEffect(()=>{if(hostOnly)return;search();hostingAdvanced('areas_public').then(r=>setAreas(r.items||[])).catch(()=>{});},[hostOnly,search]);

  useEffect(()=>{if(hostOnly)return;let live=true;void supabase.rpc('ccx_property_filter_options').then(({data,error})=>{if(!live)return;if(error){setError('Location filters could not load: '+error.message);return;}setLocations(data?.locations||[]);});return()=>{live=false;};},[hostOnly]);
  const countries=[...new Set(locations.map(v=>v.country).filter(Boolean))].sort();
  const regions=[...new Set(locations.filter(v=>!country||v.country===country).map(v=>v.state).filter(Boolean))].sort();
  const cities=[...new Set(locations.filter(v=>(!country||v.country===country)&&(!region||v.state===region)).map(v=>v.city).filter(Boolean))].sort();
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

  return <div className="space-y-6 text-[var(--cc-text-primary)]">
    <header className="professional-market-heading">
      <span className="ccx-monogram" aria-hidden="true"><Home size={20}/></span>
      <div><h2>Host Connect</h2><p>{hostOnly?'Your spaces, availability, and booking requests.':'Find the right space for your next production.'}</p></div>
    </header>
    {!hostOnly&&<nav aria-label="Guest Host Connect navigation" className="flex flex-wrap gap-2">
      {/** @type {Array<[string, string, import('react').ElementType]>} */ ([['explore','Explore spaces',Search],['favorites','Saved',Heart],['bookings','My requests',CalendarDays]])
      .map(([key,label,Icon])=><button key={key} className={'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm '+(section===key?'ccx-action-primary text-[var(--cc-text-primary)]':'border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] text-[var(--cc-text-secondary)]')} onClick={()=>{setSection(key);setSelected('');setError('');}}><Icon size={16}/>{label}</button>)}
    </nav>}
    {error&&<p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
    {notice&&<p className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-800" role="status">{notice}</p>}

    {(section==='explore'||section==='favorites')&&<>
      {selected?<ListingDetail brand={brand} id={selected} paid={paid} favorites={favorites} toggle={toggle} back={()=>setSelected('')} onBooked={()=>search()}/>:
      <div className="space-y-5">
        <details className={panel+' group overflow-hidden'} data-host-space-filters="true">
         <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
          <span className="flex items-center gap-2"><SlidersHorizontal size={18}/>Find a space · Filter location, dates and amenities</span>
          <span className="text-xs text-[var(--cc-text-secondary)] group-open:hidden">Expand</span>
          <span className="hidden text-xs text-[var(--cc-text-secondary)] group-open:block">Collapse</span>
         </summary>
         <form onSubmit={e=>{e.preventDefault();search();}} className="grid gap-3 border-t border-[var(--cc-border)] p-4 md:grid-cols-3 xl:grid-cols-4">
          <label className="block text-xs text-[var(--cc-text-secondary)]">Find a space<select aria-label="Find a space" value={category} onChange={e=>setCategory(e.target.value)} className={input+' mt-1'}><option value="">All space types</option>{rentalCategories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
          <label className="block text-xs text-[var(--cc-text-secondary)]">Country<select aria-label="Country" className={input+' mt-1'} value={country} onChange={e=>{setCountry(e.target.value);setRegion('');setCity('');}}><option value="">All countries</option>{countries.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className="block text-xs text-[var(--cc-text-secondary)]">State / region<select aria-label="State / region" className={input+' mt-1'} value={region} onChange={e=>{setRegion(e.target.value);setCity('');}}><option value="">All states / regions</option>{regions.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className="block text-xs text-[var(--cc-text-secondary)]">City<select aria-label="City" className={input+' mt-1'} value={city} onChange={e=>setCity(e.target.value)}><option value="">All cities</option>{cities.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className="block text-xs text-[var(--cc-text-secondary)]">Max $/hr<input className={input+' mt-1'} type="number" min={1} value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} placeholder="Any"/></label>
          <label className="block text-xs text-[var(--cc-text-secondary)]">Crew size<input className={input+' mt-1'} type="number" min={1} value={crew} onChange={e=>setCrew(e.target.value)} placeholder="Any"/></label>
          <div className="md:col-span-3 xl:col-span-4"><PropertyAmenities values={selectedAmenities} onChange={setSelectedAmenities}/></div>
          <div className="md:col-span-3 xl:col-span-4"><HostingDateRange label="Search check-in and checkout" compact optional start={from} end={to}
            onChange={({start,end})=>{setFrom(start);setTo(end);}}/></div>
          <button type="submit" disabled={busy||(Boolean(from||to)&&!validRange(from,to))} className={button+' mt-4 self-end'}><SlidersHorizontal size={16} className="inline mr-2"/>Search spaces</button>
         </form>
        </details>
        <div className="flex flex-wrap gap-2 items-center">
          <button className={showMap?button: 'rounded-lg border border-[var(--cc-border)] px-4 py-2 text-sm'} onClick={()=>setShowMap(!showMap)}>
            {showMap?'Hide interactive map':'Show interactive map'}
          </button>
          {mapBounds&&<button className="text-xs text-[var(--cc-text-secondary)]" onClick={()=>{setMapBounds(null);search(false);}}>Clear map-area search</button>}
        </div>
        {showMap&&<HostingAreaMap areas={areas} listings={listings} onSelect={setSelected}
           onSearchBounds={bounds=>{setMapBounds(bounds);}}/>}
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{section==='favorites'?'Your saved locations':brand==='host_connect'||brand==='onlyhost'?'Browse Host Connect spaces':'Explore professional spaces'}</h2><p className="mt-1 text-xs text-[var(--cc-text-secondary)]">{visible.length} approved {visible.length===1?'listing':'listings'} · Search returns only general location information</p></div>
          <button className="flex items-center gap-2 text-sm text-[var(--cc-text-secondary)]" onClick={search} disabled={busy}><RefreshCw size={15}/>Refresh</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(section==='favorites'?listings.filter(v=>favorites.includes(v.id)):visible).map(item=>
            <ListingCard key={item.id} listing={item} favorite={favorites.includes(item.id)} toggle={toggle} open={setSelected}/>
          )}
        </div>
        {!(section==='favorites'?listings.filter(v=>favorites.includes(v.id)):visible).length&&<div className={panel+' flex min-h-52 flex-col items-center justify-center gap-3 p-10 text-center'}><Camera size={34} className="text-[var(--cc-text-secondary)]"/><h3 className="font-semibold">No spaces matched</h3><p className={empty}>Try another city or category. Only approved and verified locations appear in search.</p></div>}
      </div>}
    </>}

    {section==='bookings'&&<div className={panel+' space-y-3 p-6'}>
      <h2 className="text-xl font-semibold">Your reservation requests</h2>
      <p className={empty}>Requests do not collect payment or disclose a venue's private address.</p>
      {!myBookings.length&&<p className={empty+' py-6'}>No booking requests yet.</p>}
      {myBookings.map(b=><div key={b.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--cc-border)] py-4">
        <div className="space-y-1"><p className="text-sm font-semibold">{dateTime(b.starts_at)} – {dateTime(b.ends_at)}</p>
          <p className={empty}>Crew {b.crew_size} · {usageLabels[b.requested_use]||b.requested_use} · Estimated {usd(b.estimated_total)}</p>
          <p className="text-xs text-[var(--cc-text-secondary)]">Reference: {b.id}</p><button onClick={()=>setExpandedBooking(expandedBooking===b.id?'':b.id)} className="mt-2 block text-sm text-[var(--cc-text-secondary)]">{expandedBooking===b.id?'Hide booking operations':'Agreement, payment, cancellation, claims'}</button>
          {expandedBooking===b.id&&<div className="mt-4 max-w-3xl"><HostingBookingOperations bookingId={b.id} userId={user?.id}/></div>}
          {entryDetails[b.id]&&<div className="mt-2 rounded-lg border border-[var(--cc-border)] bg-[var(--cc-surface-subtle)] p-3"><p className="font-semibold text-sm">Private access details</p><p className="text-sm">{entryDetails[b.id].exact_address||'Host has not supplied address yet.'}</p><p className="text-xs whitespace-pre-wrap text-[var(--cc-text-secondary)]">{entryDetails[b.id].entry_instructions||''}</p></div>}
          {b.status==='completed'&&<div className="mt-3 flex flex-wrap gap-2"><select className={input+' max-w-[150px]'} value={reviewRatings[b.id]||5} onChange={e=>setReviewRatings(p=>({...p,[b.id]:Number(e.target.value)}))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n}/5 stars</option>)}</select><input className={input+' min-w-[160px] flex-1'} placeholder="Public professional review" value={reviewTexts[b.id]||''} maxLength={1200} onChange={e=>setReviewTexts(p=>({...p,[b.id]:e.target.value}))}/><button className={button} onClick={()=>reviewBooking(b)}>Submit review</button></div>}
          </div>
        <div className="flex flex-wrap gap-2 items-start">{['accepted','completed'].includes(b.status)&&<button className={pill} onClick={()=>viewEntry(b.id)}>Private entry instructions</button>}<span className="rounded-full bg-[var(--cc-surface-subtle)] px-3 py-2 text-xs capitalize text-[var(--cc-text-secondary)]">{b.status}</span>
          {['requested','accepted'].includes(b.status)&&<button onClick={()=>cancel(b.id)} className="text-sm text-red-800">Cancel</button>}</div>
      </div>)}
    </div>}

    {hostOnly&&section==='alerts'&&<HostingNotificationSettings/>}
    {hostOnly&&section==='crew'&&<HostingCrewInbox/>}
    {hostOnly&&section==='cleaning'&&<HostingWorkforceManager worker/>}
    {hostOnly&&(section==='host'||section==='review')&&<HostingHost paid={paid} isAdmin={isAdmin} reviewMode={section==='review'} user={user} brand={brand}/>}
  </div>;
}