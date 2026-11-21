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

## Isolated restore exercise (operator runbook)

The source project is production Supabase `yxuqbygykpfbioslljlf`. **Never** point the restore target to that project, an existing staging environment, or a production database. A successful build or green CI pipeline is not disaster-recovery evidence.

The `ops/restore-drill.mjs` harness is implemented and its input/isolation logic is unit-tested. **A completed real restore has not yet been witnessed**: an isolated empty PostgreSQL 17+ recovery target, storage-object copy/manifest, encryption recipient/key, and operator-approved database access are necessary. Use a qualified DBA/operator to prepare a new isolated recovery database with the required PostgreSQL extensions and Supabase-compatible roles; a standard hosted Supabase branch is *not* a full copy of private storage objects, users, secrets, or Auth configuration.

1. Record a recovery approval and target identifier. Prove target isolation and an operator-controlled restricted network. Grant a read-only source backup credential limited to backup-specific privileges and a separate restore role on the disposable target. Keep database URLs and encryption keys in the operator's private secret manager, never GitHub.
2. Confirm a production-consistent backup boundary. `pg_dump` is not a substitute for PITR/WAL archival, and a normal SQL dump may not cover Supabase Auth service configuration, Vault keys, bucket object bytes, recovery application configuration, third-party DocuSign certificates, Railway identity documents, or merchant reports. Inventory these separately and select appropriate capture/restore methods. Do not assume cross-system atomicity.
3. Create encrypted, independently verifiable backups of **every required private bucket object**, preserving paths, permissions, byte lengths and SHA-256 digests. Restore the objects only into an isolated bucket namespace with equivalent policy; independently generate a source and target manifest in the form `[{"bucket":"example","key":"private-path","sha256":"<64 lowercase hex>","bytes":1234}]`. A manifest alone is not a storage backup. Do not expose filenames or private evidence content in logs.
4. Set the following protected environment values on the isolated runner (not in version control): `CCX_DRILL_SOURCE_DATABASE_URL`, `CCX_DRILL_TARGET_DATABASE_URL`, `CCX_DRILL_PRODUCTION_REF`, `CCX_DRILL_TARGET_REF`, `CCX_DRILL_AGE_RECIPIENT`, `CCX_DRILL_AGE_IDENTITY_FILE`, `CCX_DRILL_SOURCE_STORAGE_MANIFEST`, `CCX_DRILL_TARGET_STORAGE_MANIFEST`, `CCX_DRILL_OUTPUT_DIR`, and `CCX_DRILL_APPROVED=ISOLATED_TARGET_ONLY`. The runner must have `pg_dump`, `pg_restore`, `psql`, and `age` installed. Use `node ops/restore-drill.mjs` only **after** confirming the disposable target is empty.
5. The script refuses matching production/target identities and prepopulated target tables; it encrypts the dump using an age recipient, restores to the isolated database in one transaction, compares fixed aggregate record counts, compares the complete private Storage object manifests, and writes a restricted `restore-attestation.json`. Do not publish the backup archive or credentials. Run manual permission checks, archived signature/PDF hash comparisons, role/MFA tests, queue replay/idempotency and a real application smoke test against the restored target.
6. Document the measured recovery time, recovery point/backup cutoff, non-atomic cross-service gaps, missing key dependencies, test account results, access violations, and cleanup of the isolated environment. Obtain separate release/security sign-off. Keep audit logs append-only and use record-specific legal retention holds. **Never** claim “drill passed” from a preflight, an empty test, or storage metadata alone.

**Go/no-go:** Disaster recovery remains a **NO-GO** until a complete operator-run isolated database *and private object* restore succeeds with checked evidence. Billing and signing integrations must also be reconciled against their authoritative external providers before release.
