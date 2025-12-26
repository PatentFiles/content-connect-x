import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, MapPin, Info, AlertCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { computeDailyUnavailableReasons } from './availabilityHelpers';

export default function AvailabilityCalendar({ 
  participantProfiles,
  myLocation,
  selectedDates,
  onDatesChange,
  collaborationId,
  collaborationLocation
}) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const [unavailableReasons, setUnavailableReasons] = useState({});
  const [expandedDay, setExpandedDay] = useState(null);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch unavailable reasons for the current month
  useEffect(() => {
    if (participantProfiles.length > 0) {
      const participantUserIds = participantProfiles.map(p => p.user_id);
      computeDailyUnavailableReasons({
        collaborationId,
        monthYear: viewMonth,
        participantUserIds,
        collaborationLocation: collaborationLocation || myLocation,
        participantProfiles
      }).then(reasons => {
        setUnavailableReasons(reasons);
      });
    }
  }, [viewMonth, participantProfiles, collaborationId, collaborationLocation, myLocation]);

  // Get availability for all participants
  const getDateAvailability = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const availability = [];

    participantProfiles.forEach(profile => {
      const availableDates = profile.availability_dates || [];
      const travelDates = profile.travel_dates || [];
      
      // Check if they're available this date
      if (availableDates.includes(dateStr)) {
        // Check if they're traveling to user's location
        const travelToMyCity = travelDates.find(travel => {
          const travelStart = new Date(travel.start_date);
          const travelEnd = new Date(travel.end_date);
          const currentDate = new Date(dateStr);
          
          return currentDate >= travelStart && 
                 currentDate <= travelEnd && 
                 travel.location.includes(myLocation?.city);
        });

        if (travelToMyCity) {
          availability.push({
            profile,
            location: myLocation.city,
            travelInfo: `Traveling to ${myLocation.city}`
          });
        } else {
          // Check their other travel locations
          const travelLocation = travelDates.find(travel => {
            const travelStart = new Date(travel.start_date);
            const travelEnd = new Date(travel.end_date);
            const currentDate = new Date(dateStr);
            
            return currentDate >= travelStart && currentDate <= travelEnd;
          });

          if (travelLocation) {
            availability.push({
              profile,
              location: travelLocation.location,
              travelInfo: `Available in ${travelLocation.location}`
            });
          } else {
            // They're at their home location
            const homeLocation = profile.base_location;
            availability.push({
              profile,
              location: homeLocation?.city || 'Unknown',
              travelInfo: `At home in ${homeLocation?.city || 'their location'}`
            });
          }
        }
      }
    });

    return availability;
  };

  const toggleDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const availability = getDateAvailability(date);
    
    // Only allow selecting if all participants are available
    if (availability.length === participantProfiles.length) {
      const isSelected = selectedDates.some(d => d === dateStr);
      if (isSelected) {
        onDatesChange(selectedDates.filter(d => d !== dateStr));
      } else {
        onDatesChange([...selectedDates, dateStr]);
      }
    }
  };

  const previousMonth = () => {
    setViewMonth(addMonths(viewMonth, -1));
  };

  const nextMonth = () => {
    setViewMonth(addMonths(viewMonth, 1));
  };

  const getReasonLabel = (reasonType) => {
    switch (reasonType) {
      case 'PERSONAL_UNAVAILABLE':
        return 'Unavailable';
      case 'BOOKED_COLLABORATION':
        return 'Booked';
      case 'EXTERNAL_BUSY':
        return 'Busy (External)';
      case 'TRAVEL_DIFFERENT_LOCATION':
        return 'Traveling elsewhere';
      default:
        return 'Unavailable';
    }
  };

  return (
    <div className="space-y-4">
      {/* Location Info */}
      {participantProfiles.length > 0 && (
        <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#4F8CFF] mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#E8EEF9] mb-2">
                Availability is based on participant locations and travel schedules
              </p>
              <div className="space-y-1">
                {participantProfiles.map((profile, idx) => (
                  <p key={idx} className="text-xs text-[#9AA6BC]">
                    <span className="font-medium text-[#E8EEF9]">{profile.display_name}</span>
                    {' - '}Based in {profile.base_location?.city || 'Unknown'}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <CCButton variant="ghost" size="icon" onClick={previousMonth}>
            <ChevronLeft className="w-5 h-5" />
          </CCButton>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">
            {format(viewMonth, 'MMMM yyyy')}
          </h3>
          <CCButton variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-5 h-5" />
          </CCButton>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs text-[#6B7A94] font-medium py-2">
              {day}
            </div>
          ))}
          
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          
          {daysInMonth.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const availability = getDateAvailability(date);
            const isSelected = selectedDates.some(d => d === dateStr);
            const isPast = date < new Date().setHours(0, 0, 0, 0);
            const allAvailable = availability.length === participantProfiles.length;
            const someAvailable = availability.length > 0 && availability.length < participantProfiles.length;
            const reasons = unavailableReasons[dateStr] || [];
            const isExpanded = expandedDay === dateStr;
            
            // Check if they're in user's city
            const inMyCity = availability.every(a => a.location === myLocation?.city);
            
            return (
              <div key={dateStr} className="relative">
                <button
                  onClick={() => !isPast && toggleDate(date)}
                  disabled={isPast || !allAvailable}
                  className={`
                    w-full aspect-square rounded-lg text-sm font-medium transition-all relative group
                    ${isPast ? 'text-[#3A4A6B] cursor-not-allowed bg-[#0B0F14]' : ''}
                    ${!allAvailable && !isPast ? 'text-[#6B7A94] cursor-not-allowed bg-[#121824]' : ''}
                    ${someAvailable && !isPast ? 'bg-[#263248]/50' : ''}
                    ${allAvailable && !isPast && !isSelected ? 'hover:bg-[#263248] text-[#E8EEF9]' : ''}
                    ${isSelected ? 'bg-[#4F8CFF] text-white' : ''}
                    ${allAvailable && !isSelected ? 'bg-[#151D2B]' : ''}
                  `}
                >
                  <span className="block">{format(date, 'd')}</span>
                  {allAvailable && !isPast && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                      {inMyCity ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                      )}
                    </div>
                  )}
                  
                  {/* Tooltip for available dates */}
                  {allAvailable && !isPast && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-[#0B0F14] border border-[#263248] rounded-lg p-2 min-w-[150px] shadow-xl">
                        {availability.map((a, idx) => (
                          <div key={idx} className="text-xs text-left mb-1 last:mb-0">
                            <p className="font-medium text-[#E8EEF9]">{a.profile.display_name}</p>
                            <p className="text-[#9AA6BC] flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {a.location}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tooltip for unavailable dates with reasons */}
                  {!allAvailable && !isPast && reasons.length > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-[#0B0F14] border border-[#EF4444]/50 rounded-lg p-2 min-w-[180px] max-w-[220px] shadow-xl">
                        <div className="flex items-center gap-1 mb-2 pb-2 border-b border-[#263248]">
                          <AlertCircle className="w-3 h-3 text-[#EF4444]" />
                          <p className="text-xs font-medium text-[#EF4444]">Unavailable</p>
                        </div>
                        <div className="space-y-2">
                          {reasons.slice(0, isExpanded ? undefined : 3).map((reason, idx) => (
                            <div key={idx} className="text-xs">
                              <p className="font-medium text-[#E8EEF9]">{reason.display_name}</p>
                              <p className="text-[#9AA6BC]">{getReasonLabel(reason.reason_type)}</p>
                              {reason.location_context && (reason.location_context.city || reason.location_context.country) && (
                                <p className="text-[#6B7A94] flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {reason.location_context.city || reason.location_context.country}
                                </p>
                              )}
                            </div>
                          ))}
                          {reasons.length > 3 && !isExpanded && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDay(dateStr);
                              }}
                              className="text-[#4F8CFF] text-xs hover:underline"
                            >
                              +{reasons.length - 3} more
                            </button>
                          )}
                          {isExpanded && reasons.length > 3 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDay(null);
                              }}
                              className="text-[#4F8CFF] text-xs hover:underline"
                            >
                              Show less
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[#263248]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#22C55E]" />
            <span className="text-xs text-[#9AA6BC]">In your city</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
            <span className="text-xs text-[#9AA6BC]">Different location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#263248]" />
            <span className="text-xs text-[#9AA6BC]">Not available</span>
          </div>
        </div>
      </div>

      {/* Selected Dates Summary */}
      {selectedDates.length > 0 && (
        <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4">
          <p className="text-sm font-medium text-[#E8EEF9] mb-3">
            Selected Dates ({selectedDates.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedDates.sort().map(dateStr => {
              const date = new Date(dateStr);
              const availability = getDateAvailability(date);
              const inMyCity = availability.every(a => a.location === myLocation?.city);
              
              return (
                <CCBadge 
                  key={dateStr} 
                  variant={inMyCity ? "success" : "warning"}
                >
                  {format(date, 'MMM d')}
                  {!inMyCity && (
                    <span className="ml-1 text-xs">
                      ({availability[0]?.location})
                    </span>
                  )}
                </CCBadge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}