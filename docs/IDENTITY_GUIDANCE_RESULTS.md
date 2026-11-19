# Guided identity capture and automatic results

The phone flow previews both server-assigned head turns before starting. A visible 3–2–1 countdown precedes the first center frame. Each turn has an explicit movement prompt, a three-second HOLD countdown, and a three-second return-to-center countdown. The original six phases, minimum timings and server-only verdict remain unchanged.

Status polling is single-flight and automatic during processing. Terminal responses cannot be overwritten by older pending polls. The finished result is prominent, manual status has visible feedback, and pilot diagnostics explain name, expiry, barcode, field confidence and capture failures. A passed face/DOB check never bypasses the other requirements.

The worker adapter now preserves middle names from a real decoded AAMVA payload and normalizes US barcode dates before exact front/back comparisons. Text OCR fallback cannot masquerade as a successful barcode decode. Successful barcode decoding avoids redundant back-side OCR. Movement-frame continuity compares against the initial live selfie, while the independent ID-to-selfie threshold remains unchanged. A bounded diagnostic allowlist records only check categories/booleans and processing duration; no raw OCR, document numbers, photos or reusable face embeddings are added to results or logs.

These fixes do not certify a document or liveness model. The original failed attempt stays unchanged. The owner should retest with the printed complete legal name, a current readable document, and the improved capture guidance. Public signup is not activated by a private test.

Hosting stays Bolt for the website, the existing Supabase project for accounts/evidence, and the dedicated identity-only Railway service for computation. Public homepage artwork/styles are untouched. Publish the matching frontend in Bolt after merging. Worker changes and the diagnostic policy require their own deployments.
