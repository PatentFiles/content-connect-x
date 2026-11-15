import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, Monitor, MapPin, Calendar, AlertTriangle, Clock, Smartphone, Tablet, Laptop } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { motion } from 'framer-motion';

export default function SessionHistoryViewer() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  // Fetch all session history
  const { data: sessions = [] } = useQuery({
    queryKey: ['allSessions'],
    queryFn: () => base44.entities.SessionHistory.list('-created_date', 100),
  });

  // Fetch user profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['sessionProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const getProfileByEmail = (email) => profiles.find(p => p.user_id === email);

  const getDeviceIcon = (userAgent) => {
    if (!userAgent) return Monitor;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return Smartphone;
    if (ua.includes('tablet') || ua.includes('ipad')) return Tablet;
    return Laptop;
  };

  const getDeviceType = (userAgent) => {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'Mobile';
    if (ua.includes('tablet') || ua.includes('ipad')) return 'Tablet';
    return 'Desktop';
  };

  // Group sessions by user
  const sessionsByUser = sessions.reduce((acc, session) => {
    if (!acc[session.user_id]) {
      acc[session.user_id] = [];
    }
    acc[session.user_id].push(session);
    return acc;
  }, {});

  // Detect suspicious patterns
  const detectSuspiciousActivity = (userSessions) => {
    const flags = [];
    
    // Too many logins in short time
    if (userSessions.length > 10) {
      const recentLogins = userSessions.filter(s => {
        const loginTime = new Date(s.login_at || s.created_date).getTime();
        const now = Date.now();
        return now - loginTime < 24 * 60 * 60 * 1000; // Last 24 hours
      });
      if (recentLogins.length > 5) {
        flags.push('Multiple logins in 24 hours');
      }
    }

    // Fast IP changes (if stored)
    const uniqueIPs = new Set(userSessions.map(s => s.ip_address).filter(Boolean));
    if (uniqueIPs.size > 3 && userSessions.length < 10) {
      flags.push('Frequent IP address changes');
    }

    // Multiple devices
    const uniqueDevices = new Set(userSessions.map(s => getDeviceType(s.user_agent)));
    if (uniqueDevices.size > 3) {
      flags.push('Multiple device types');
    }

    return flags;
  };

  // Filter users
  const filteredUsers = Object.keys(sessionsByUser).filter(userId => {
    if (!searchTerm) return true;
    const profile = getProfileByEmail(userId);
    return userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
           profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Session History</h2>
        <p className="text-sm text-[#6B7A94]">Monitor user login patterns and detect suspicious activity</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
        <input
          type="text"
          placeholder="Search by user email or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
        />
      </div>

      {/* Users with Sessions */}
      <div className="space-y-3">
        {filteredUsers.map(userId => {
          const userSessions = sessionsByUser[userId];
          const profile = getProfileByEmail(userId);
          const suspiciousFlags = detectSuspiciousActivity(userSessions);
          const isExpanded = selectedUserId === userId;

          return (
            <CCCard key={userId} padding="lg" hover>
              <div
                className="cursor-pointer"
                onClick={() => setSelectedUserId(isExpanded ? null : userId)}
              >
                {/* User Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {profile?.avatar_url && (
                      <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#E8EEF9]">
                          {profile?.display_name || userId}
                        </p>
                        {suspiciousFlags.length > 0 && (
                          <CCBadge variant="warning" size="sm" icon={AlertTriangle}>
                            Suspicious Activity
                          </CCBadge>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7A94]">{userId}</p>
                    </div>
                  </div>
                  <CCBadge variant="outline">
                    {userSessions.length} session{userSessions.length !== 1 ? 's' : ''}
                  </CCBadge>
                </div>

                {/* Suspicious Flags */}
                {suspiciousFlags.length > 0 && (
                  <div className="mb-3 flex gap-2 flex-wrap">
                    {suspiciousFlags.map((flag, idx) => (
                      <CCBadge key={idx} variant="warning" size="sm">
                        {flag}
                      </CCBadge>
                    ))}
                  </div>
                )}
              </div>

              {/* Session Details */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 pt-4 border-t border-[#263248] space-y-3"
                >
                  {userSessions.slice(0, 10).map((session, idx) => {
                    const DeviceIcon = getDeviceIcon(session.user_agent);
                    const loginTime = new Date(session.login_at || session.created_date);
                    const logoutTime = session.logout_at ? new Date(session.logout_at) : null;

                    return (
                      <div
                        key={session.id || idx}
                        className="bg-[#121824] rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <DeviceIcon className="w-4 h-4 text-[#4F8CFF]" />
                            <span className="text-sm text-[#E8EEF9]">
                              {getDeviceType(session.user_agent)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#6B7A94]">
                            <Clock className="w-3 h-3" />
                            {loginTime.toLocaleString()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {session.ip_address && (
                            <div className="flex items-center gap-1 text-[#6B7A94]">
                              <MapPin className="w-3 h-3" />
                              <span>IP: {session.ip_address.substring(0, 15)}...</span>
                            </div>
                          )}
                          {logoutTime && (
                            <div className="flex items-center gap-1 text-[#6B7A94]">
                              <Calendar className="w-3 h-3" />
                              <span>Duration: {Math.round((logoutTime - loginTime) / 1000 / 60)}m</span>
                            </div>
                          )}
                          {session.actions_count > 0 && (
                            <div className="text-[#6B7A94]">
                              Actions: {session.actions_count}
                            </div>
                          )}
                          {session.suspicious_flags && session.suspicious_flags.length > 0 && (
                            <div className="col-span-2">
                              <CCBadge variant="danger" size="sm">
                                Flagged: {session.suspicious_flags.join(', ')}
                              </CCBadge>
                            </div>
                          )}
                        </div>

                        {session.user_agent && (
                          <details className="text-xs text-[#6B7A94]">
                            <summary className="cursor-pointer hover:text-[#9AA6BC]">
                              User Agent
                            </summary>
                            <p className="mt-1 break-all">{session.user_agent}</p>
                          </details>
                        )}
                      </div>
                    );
                  })}

                  {userSessions.length > 10 && (
                    <p className="text-xs text-[#6B7A94] text-center pt-2">
                      Showing 10 of {userSessions.length} sessions
                    </p>
                  )}
                </motion.div>
              )}
            </CCCard>
          );
        })}
      </div>

      {filteredUsers.length === 0 && (
        <CCCard padding="xl">
          <div className="text-center py-8">
            <Monitor className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No session history found</p>
          </div>
        </CCCard>
      )}
    </div>
  );
}