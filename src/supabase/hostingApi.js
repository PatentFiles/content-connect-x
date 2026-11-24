import { supabase } from '@/api/supabaseClient';
import {hostingEndpoint} from './hostingEndpoints.mjs';
import {PROPERTY_FEATURE_GROUPS} from '../../supabase/functions/_shared/propertyFeatureCatalog.mjs';

/**
 * All hosting mutations are independently authorized by the protected Edge
 * Function. Browser fields never determine host, verification, subscription
 * or public approval.
 */
export async function hostingAction(action, args = {}) {
  const { data, error } = await supabase.functions.invoke(hostingEndpoint(action), {
    body: { action, ...args },
  });
  if (error || data?.error) {
    let message = data?.error || error?.message || 'Hosting service unavailable';
    if (error?.context?.json) {
      try {
        const response = await error.context.json();
        if (typeof response?.error === 'string') message = response.error;
      } catch { /* preserve the original error */ }
    }
    throw new Error(message);
  }
  // A small per-listing cover set avoids the legacy shared 400-photo response
  // limit. Full libraries are paginated only when the gallery is opened.
  if(['browse','my_listings','listing'].includes(action)){
    const items=data.items|| (data.item?[data.item]:[]);
    if(items.length){
      const thumbnails=await hostingAction('listing_thumbnails',{ids:items.map(item=>item.id).slice(0,100)});
      const byId=new Map((thumbnails.items||[]).map(item=>[item.id,item]));
      const enrich=item=>({...item,...(byId.get(item.id)||{})});
      return data.item?{...data,item:enrich(data.item)}:{...data,items:items.map(enrich)};
    }
  }
  return data;
}

/**
 * Upload via a scoped, short-lived server-created storage token.
 * Neither the publishable key nor client form grants permission to approve
 * publicly visible media.
 */
export async function uploadHostingPhoto(propertyId, file, caption = '') {
  if (!['image/jpeg','image/png','image/webp'].includes(file?.type)) {
    throw new Error('Use a JPEG, PNG or WebP image');
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('Maximum image size is 10 MB');
  const granted = await hostingAction('host_photos_token', {
    id: propertyId, mime_type: file.type,
  });
  const { error } = await supabase.storage.from('property-images')
    .uploadToSignedUrl(granted.path, granted.token, file, {
      contentType: file.type, upsert: false,
    });
  if (error) throw error;
  return hostingAction('host_photos_register', {
    id: propertyId, path: granted.path, mime_type: file.type, caption,
  });
}

/**
 * Videos remain in a private bucket and are never exposed until reviewed
 * by an independent administrator. The host can preview pending uploads.
 */
export async function uploadHostingVideo(propertyId, file, caption = '') {
  if (!['video/mp4','video/webm'].includes(file?.type)) {
    throw new Error('Use an MP4 or WebM property walk-through video');
  }
  if (file.size > 40 * 1024 * 1024) throw new Error('Maximum video size is 40 MB');
  const granted = await hostingAction('host_video_token', {
    id: propertyId, mime_type: file.type,
  });
  const { error } = await supabase.storage.from('property-videos')
    .uploadToSignedUrl(granted.path, granted.token, file, {
      contentType: file.type, upsert: false,
    });
  if (error) throw error;
  return hostingAction('host_video_register', {
    id: propertyId, path: granted.path, mime_type: file.type, caption,
  });
}

export const rentalCategories = [
  ['film_studio','Film studio'],['photo_studio','Photography studio'],
  ['house','House'],['villa','Villa'],['loft','Loft'],['apartment','Apartment / high-rise'],
  ['set','Production set'],['outdoor','Outdoor location'],
  ['equipment','Equipment'],['dungeon','Dungeon / specialty studio'],['other','Other space'],
];

export const rentalAmenities = PROPERTY_FEATURE_GROUPS.flatMap(g=>g.items);

export const rentalUses = [
  ['photography','Photography'],['filming','Filming'],['commercial','Commercial production'],
  ['interviews','Interviews'],['music_video','Music videos'],
  ['nude_photography','Nude / implied-nude photography'],['explicit_adult_video','Sexually explicit adult video'],
  ['adult_production','Other permitted adult content production'],['events','Events'],
  ['equipment_rental','Equipment rental'],
];

export function usd(value) {
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})
    .format(Number(value)||0);
}
export function dateTime(value) {
  return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
}