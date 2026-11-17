import { supabase } from '@/api/supabaseClient';

/**
 * All hosting mutations are independently authorized by the protected Edge
 * Function. Browser fields never determine host, verification, subscription
 * or public approval.
 */
export async function hostingAction(action, args = {}) {
  const { data, error } = await supabase.functions.invoke('hosting-marketplace', {
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

export const rentalCategories = [
  ['film_studio','Film studio'],['photo_studio','Photography studio'],
  ['house','House'],['villa','Villa'],['loft','Loft'],
  ['set','Production set'],['outdoor','Outdoor location'],
  ['equipment','Equipment'],['dungeon','Dungeon / specialty studio'],['other','Other space'],
];

export const rentalAmenities = [
  ['wifi','Wi-Fi'],['parking','Parking'],['private_entrance','Private entrance'],
  ['makeup_room','Makeup room'],['dressing_room','Dressing room'],['shower','Shower'],
  ['kitchen','Kitchen'],['restroom','Restroom'],['soundproof','Soundproofing'],
  ['lighting','Studio lighting'],['green_screen','Green screen'],
  ['power_220v','220V power'],['accessible','Accessibility'],
  ['outdoor','Outdoor space'],['security','Security'],['air_conditioning','A/C'],
  ['load_in','Load-in access'],['bedroom','Bedroom'],['pool','Pool'],
];

export const rentalUses = [
  ['photography','Photography'],['filming','Filming'],['commercial','Commercial production'],
  ['interviews','Interviews'],['music_video','Music videos'],
  ['adult_production','Adult content production'],['events','Events'],
  ['equipment_rental','Equipment rental'],
];

export function usd(value) {
  return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})
    .format(Number(value)||0);
}
export function dateTime(value) {
  return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
}