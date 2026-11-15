# CCX database and evidence recovery

**Not yet operationally validated.** A Supabase project and green build do not prove recoverability.

Protect separate recovery domains: PostgreSQL, Supabase Auth, Storage objects, externally stored signing certificates, private media, merchant transaction references and encryption/rotation records.

1. Choose suitable Supabase backup/PITR capability and record RPO/RTO and responsible on-call staff.
2. Enable and monitor backups plus off-site storage backups for private buckets consistent with approved retention/legal holds.
3. Store migrations in version control; apply only forward-compatible migrations through staging. Generate a backup before schema change.
4. Rehearse restoring a fresh isolated project. Verify auth identifiers, private bucket permissions, sensitive row visibility, signing-document SHA-256 and cross-table booking consistency.
5. Validate replay of webhooks with unique provider event IDs; avoid duplicating captures, refunds, contract completions or notifications.
6. Document missing objects, key-loss limitations and recovery owner; capture evidence and timestamps from each rehearsal.
7. Perform recovery drills at a frequency aligned with actual uptime guarantees and incident plans.

Do not run any destructive production restore until the restoration target and rollback are separately confirmed.
