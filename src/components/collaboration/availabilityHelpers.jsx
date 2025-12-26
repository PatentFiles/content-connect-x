import { base44 } from '@/api/base44Client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

/**
 * Computes unavailable reasons per day for collaboration scheduling
 * 
 * @param {Object} params
 * @param {string} params.collaborationId - ID of the collaboration
 * @param {Date} params.monthYear - Month/year to check
 * @param {Array<string>} params.participantUserIds - Array of participant user IDs
 * @param {Object} params.collaborationLocation - { city, region, country }
 * @param {Array<Object>} params.participantProfiles - Array of UserProfile objects for display names
 * 
 * @returns {Promise<Object>} Map of day (YYYY-MM-DD) to array of reason objects
 */
export async function computeDailyUnavailableReasons({
  collaborationId,
  monthYear,
  participantUserIds,
  collaborationLocation,
  participantProfiles
}) {
  const monthStart = startOfMonth(monthYear);
  const monthEnd = endOfMonth(monthYear);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

  // Create a map for quick profile lookup
  const profileMap = {};
  participantProfiles.forEach(profile => {
    profileMap[profile.user_id] = profile;
  });

  // Fetch all ScheduleEntry records for all participants in one query
  const allEntries = await base44.entities.ScheduleEntry.filter({});
  
  // Filter for this month and these participants
  const relevantEntries = allEntries.filter(entry => {
    // Must be one of our participants
    if (!participantUserIds.includes(entry.user_id)) {
      return false;
    }

    // Must overlap with the selected month
    const entryStart = entry.start_date;
    const entryEnd = entry.end_date;
    const overlaps = (entryStart >= monthStartStr && entryStart <= monthEndStr) ||
                     (entryEnd >= monthStartStr && entryEnd <= monthEndStr) ||
                     (entryStart <= monthStartStr && entryEnd >= monthEndStr);
    
    return overlaps;
  });

  // Build the day -> reasons map
  const dayReasons = {};

  relevantEntries.forEach(entry => {
    const profile = profileMap[entry.user_id];
    const displayName = profile?.display_name || entry.user_id;

    // Determine reason type
    let reasonType = null;
    let locationContext = null;

    if (entry.entry_type === 'AVAILABILITY' && entry.status === 'UNAVAILABLE') {
      reasonType = 'PERSONAL_UNAVAILABLE';
    } else if (entry.entry_type === 'BOOKING' || entry.status === 'BOOKED') {
      reasonType = 'BOOKED_COLLABORATION';
    } else if (entry.entry_type === 'EXTERNAL_BUSY') {
      reasonType = 'EXTERNAL_BUSY';
    } else if (entry.entry_type === 'TRAVEL') {
      // Check if travel location matches collaboration location
      const travelCity = entry.location_city;
      const travelCountry = entry.location_country;
      const collabCity = collaborationLocation?.city;
      const collabCountry = collaborationLocation?.country;

      const locationMatches = 
        (travelCity && collabCity && travelCity === collabCity) ||
        (travelCountry && collabCountry && travelCountry === collabCountry);

      if (!locationMatches) {
        reasonType = 'TRAVEL_DIFFERENT_LOCATION';
        locationContext = {
          city: entry.location_city || null,
          country: entry.location_country || null
        };
      }
    }

    // If we have a reason, add it to all affected days
    if (reasonType) {
      const startDate = new Date(entry.start_date);
      const endDate = new Date(entry.end_date);
      
      // Iterate through each day in the entry's range
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayStr = format(currentDate, 'yyyy-MM-dd');
        
        // Only add if within our month range
        if (dayStr >= monthStartStr && dayStr <= monthEndStr) {
          if (!dayReasons[dayStr]) {
            dayReasons[dayStr] = [];
          }

          dayReasons[dayStr].push({
            user_id: entry.user_id,
            display_name: displayName,
            reason_type: reasonType,
            location_context: locationContext,
            source_entry_id: entry.id
          });
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  });

  return dayReasons;
}