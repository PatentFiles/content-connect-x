import React from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, CheckCircle, Sparkles } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';

export default function SuggestedDates({
  viewMonth,
  participantProfiles,
  unavailableReasons,
  collaborationLocation,
  selectedDates,
  onSelectDate
}) {
  // Only show if no dates selected or not all constraints are met
  if (!participantProfiles || participantProfiles.length === 0) {
    return null;
  }

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate suggestions
  const suggestions = [];

  daysInMonth.forEach(date => {
    if (date < today) return; // Skip past dates

    const dateStr = format(date, 'yyyy-MM-dd');
    const reasons = unavailableReasons[dateStr] || [];
    
    // Check if any participant is unavailable
    const unavailableUsers = new Set(reasons.map(r => r.user_id));
    const allAvailable = participantProfiles.every(p => !unavailableUsers.has(p.user_id));

    if (!allAvailable) return; // Skip if not all available

    let score = 40; // Base score for all available
    let reason = 'All participants available';

    // Check if all in collaboration location
    const travelingElsewhere = reasons.some(r => r.reason_type === 'TRAVEL_DIFFERENT_LOCATION');
    if (!travelingElsewhere) {
      score += 20;
      reason = 'All participants available in location';
    }

    // Bonus for being close to selected dates
    if (selectedDates.length > 0) {
      const selectedDate = new Date(selectedDates[0]);
      const daysDiff = Math.abs((date - selectedDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 7) {
        score += 10;
      } else if (daysDiff <= 14) {
        score += 5;
      }
    }

    suggestions.push({
      date,
      dateStr,
      score,
      reason
    });
  });

  // Sort by score and take top 5
  suggestions.sort((a, b) => b.score - a.score);
  const topSuggestions = suggestions.slice(0, 5);

  if (topSuggestions.length === 0) {
    return null;
  }

  // Check if we have a perfect match already
  const hasExactMatch = selectedDates.length > 0 && 
    selectedDates.every(dateStr => {
      const reasons = unavailableReasons[dateStr] || [];
      const unavailableUsers = new Set(reasons.map(r => r.user_id));
      return participantProfiles.every(p => !unavailableUsers.has(p.user_id));
    });

  if (hasExactMatch) {
    return null; // Don't show suggestions if we have exact match
  }

  return (
    <CCCard padding="lg" className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#4F8CFF]" />
        <h3 className="text-lg font-semibold text-[#E8EEF9]">Suggested Dates</h3>
      </div>
      <p className="text-sm text-[#9AA6BC] mb-4">
        Based on participant availability in {format(viewMonth, 'MMMM')}
      </p>
      <div className="space-y-2">
        {topSuggestions.map((suggestion, idx) => (
          <div
            key={suggestion.dateStr}
            className="flex items-center justify-between p-3 rounded-lg bg-[#121824] border border-[#263248] hover:border-[#4F8CFF]/50 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="font-medium text-[#E8EEF9]">
                  {format(suggestion.date, 'EEEE, MMMM d')}
                </p>
                <p className="text-xs text-[#9AA6BC] flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-[#22C55E]" />
                  {suggestion.reason}
                </p>
              </div>
            </div>
            <CCButton
              variant="primary"
              size="sm"
              onClick={() => onSelectDate(suggestion.dateStr)}
            >
              Use this date
            </CCButton>
          </div>
        ))}
      </div>
    </CCCard>
  );
}