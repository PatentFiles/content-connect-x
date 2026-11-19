# Voluntary collaboration safety check-ins — operator guide

**Content Connect X / Host Connect · November 19, 2026**
**Status:** backend and UI implementation pending controlled release; does not operate an emergency-response or staffed safety-monitoring service.

## Purpose and user-facing limits

Each accepted, admitted collaboration participant may privately timestamp their own arrival, confirm safe check-out, leave, or record a concern. These are **self-reports**, not proof of physical presence, consent, or any other person's safety. A signed contract does not compel a person to stay or prevent withdrawal of consent.

There is no GPS capture, location polling, raw location coordinate collection, trusted-contact phone/email storage, or automatic emergency dispatch. The optional checkbox means **the participant states they personally informed a trusted contact**. The platform does not contact that person, and it does not store their identity or notify staff merely because the checkbox was selected.

The **Record safety concern** action stores a private event and displays reporting guidance. It does not submit to the separate public safety intake (which remains disabled), contact emergency services or open an acknowledged investigation. The user should see a link to current safety/contact options and directions to seek local emergency help when urgently needed.

## Authorization and transitions

- An authenticated account with a durable adult admission and no active ban/suspension must belong to the collaboration. Pending invitees, unrelated users and unscreened accounts cannot read or mutate a check-in.
- Only the user's own record is read/modified. Service-only RPCs re-check authorization; there are no direct browser table privileges. Events are append-only.
- A self-reported arrival is accepted only near a scheduled, nonterminal collaboration: from four hours before its canonical start until twelve hours after the canonical end (or estimated four-hour end when missing). The stored timestamps are timezone-aware.
- Arrivals cannot be restarted after a departure, safe check-out, or concern; a repeated arrival does not change the timestamp.
- Departure is available even without arrival. Safety concerns can be recorded before or after leaving, and later safe check-out does not erase the earlier concern event.
- There is no automatic change to consent, collaboration contracts, eligibility, fees, booking or representation from any check-in state.

## Acceptance tests to run on approved devices

Check mobile and desktop layouts at large text sizes, keyboard navigation, screen readers, reduced motion and denied network. Test valid member, blocked member, unadmitted account, pending invitation, unrelated user, schedule conflict, near/far shoot time, repeated taps, concurrent requests, cancelled collaboration, consent withdrawal, server outage and status refresh.

A backend event can prove only that an authenticated person recorded a statement at a time; **it must never show a "safety rescue sent" or "help is on the way" message.**

## Safe release and rollback

1. Run the disposable PostgreSQL fixture and Node handler authorization tests.
2. Deploy the SQL migration and matching `collaboration-safety` Edge Function with existing project auth. Do not publish the Bolt UI until the backend is verified.
3. Check table privacy grants and confirm service-only RPC access. Verify that queries cannot read another user's record.
4. Run controlled admitted-user check-ins and status checks without real emergency incidents, documenting outcomes privately.
5. Publish the code from GitHub `main` through the existing **Bolt** project. Railway continues to handle identity computation only.
6. On defects, disable the UI entrypoint or roll back the Edge version. Retain historical events as required; do not delete records to mask an outage.

**Remaining dependency:** Staff coverage, high-priority incident routing, secure trusted-contact notifications (if ever introduced), actual alert delivery, case-specific preservation, appeals, and lawful reporting must be separately approved and tested before public claims of proactive monitoring. See safety issue #25.
