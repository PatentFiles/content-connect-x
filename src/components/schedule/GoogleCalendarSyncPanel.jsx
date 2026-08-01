import React, { useState } from 'react';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, AlertCircle, Loader2, Lock } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';

/**
 * GoogleCalendarSyncPanel
 *
 * UI scaffolding for Google Calendar two-way sync.
 *
 * STATE MODEL (persisted once backend functions + OAuth are enabled):
 *   - status: 'disconnected' | 'connecting' | 'connected' | 'error'
 *   - lastSyncAt: ISO timestamp of last successful sync
 *   - syncDirection: 'one_way_export' | 'two_way'  (default one_way_export)
 *   - calendarId: selected Google Calendar ID (primary by default)
 *
 * When Builder+ is active and the googlecalendar connector is authorized,
 * wire this component to a backend function that:
 *   1. Calls base44.asServiceRole.connectors.getConnection('googlecalendar')
 *   2. Lists calendars, writes events from ScheduleEntry records (export)
 *   3. Reads Google events and creates/updates ScheduleEntry records (import)
 *   4. Persists connection state to UserSettings.google_calendar_sync
 *
 * Until then this panel is display-only and shows an upgrade prompt.
 */
export default function GoogleCalendarSyncPanel() {
  const [status, setStatus] = useState('disconnected');
  const [syncDirection, setSyncDirection] = useState('one_way_export');

  const handleConnect = () => {
    // Placeholder — replace with request_oauth_authorization flow
    // once Builder+ is enabled and the googlecalendar connector is wired.
    setStatus('connecting');
    setTimeout(() => setStatus('disconnected'), 1500);
  };

  const handleSyncNow = () => {
    // Placeholder — replace with backend function call
    // base44.integrations.<GoogleCalendarSync> once backend functions are enabled.
    toast?.info?.('Sync requires Builder+ upgrade.');
  };

  const isBuilderPlus = false; // flip to true once upgraded + connector authorized

  return (
    <CCCard padding="lg" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#22C55E]/20 flex items-center justify-center">
            <Calendar className="w-5 h-5" style={{ color: 'var(--cc-blue)' }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--cc-text-primary)' }}>
              Google Calendar Sync
            </h3>
            <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
              Two-way availability sync with your Google Calendar
            </p>
          </div>
        </div>
        {status === 'connected' ? (
          <CCBadge variant="success" icon={CheckCircle2}>Connected</CCBadge>
        ) : status === 'connecting' ? (
          <CCBadge variant="primary" icon={Loader2}>Connecting…</CCBadge>
        ) : (
          <CCBadge variant="outline" icon={Lock}>Not Connected</CCBadge>
        )}
      </div>

      {/* Sync direction toggle (UI only until wired) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setSyncDirection('one_way_export')}
          disabled={!isBuilderPlus}
          className={`rounded-lg p-3 text-left border transition-colors disabled:opacity-50 ${
            syncDirection === 'one_way_export' ? 'border-[var(--cc-blue)]' : ''
          }`}
          style={{
            backgroundColor: syncDirection === 'one_way_export' ? 'color-mix(in srgb, var(--cc-blue) 10%, transparent)' : 'var(--cc-surface)',
            borderColor: syncDirection === 'one_way_export' ? 'var(--cc-blue)' : 'var(--cc-border)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>One-way export</p>
          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Push availability → Google</p>
        </button>
        <button
          type="button"
          onClick={() => setSyncDirection('two_way')}
          disabled={!isBuilderPlus}
          className={`rounded-lg p-3 text-left border transition-colors disabled:opacity-50`}
          style={{
            backgroundColor: syncDirection === 'two_way' ? 'color-mix(in srgb, var(--cc-blue) 10%, transparent)' : 'var(--cc-surface)',
            borderColor: syncDirection === 'two_way' ? 'var(--cc-blue)' : 'var(--cc-border)',
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>Two-way sync</p>
          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Push + import from Google</p>
        </button>
      </div>

      {!isBuilderPlus ? (
        <div
          className="rounded-lg p-3 flex items-start gap-2 border"
          style={{ backgroundColor: 'color-mix(in srgb, #F59E0B 8%, transparent)', borderColor: 'color-mix(in srgb, #F59E0B 30%, transparent)' }}
        >
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
          <p className="text-xs" style={{ color: 'var(--cc-text-secondary)' }}>
            Calendar sync requires a <span className="font-semibold">Builder+ plan</span> with the Google Calendar
            OAuth connector authorized. Upgrade to enable automatic two-way sync.
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        {status === 'connected' ? (
          <>
            <CCButton variant="outline" size="sm" icon={Calendar} onClick={handleSyncNow}>
              Sync Now
            </CCButton>
            <CCButton variant="ghost" size="sm" onClick={() => setStatus('disconnected')}>
              Disconnect
            </CCButton>
          </>
        ) : (
          <CCButton
            variant="primary"
            size="sm"
            icon={Calendar}
            onClick={handleConnect}
            loading={status === 'connecting'}
            disabled={!isBuilderPlus}
          >
            Connect Google Calendar
          </CCButton>
        )}
      </div>
    </CCCard>
  );
}