/**
 * signContract
 *
 * Backend-enforced contract signing pipeline.
 *
 * Actions:
 *   send_for_signatures  — advance contract from generated→sent, populate signatories
 *   sign                 — record a ContractSignature for the calling user
 *
 * Enforces:
 *   - ban/suspension gate
 *   - verification required
 *   - user must be a listed signatory
 *   - contract must be in signable status (sent | partially_signed)
 *   - no double-signing
 *   - agent can_sign_contracts permission check
 *   - all-signed: advance to 'signed', fire snapshot, update collaboration
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;

    // ── Ban / suspension gate ──────────────────────────────────────────────────
    const profiles = await svc.entities.UserProfile.filter({ user_id: user.email }).catch(() => []);
    const profile = profiles[0];
    if (profile?.banned || profile?.suspended) {
      return Response.json({ error: 'Account restricted', code: profile.banned ? 'banned' : 'suspended' }, { status: 403 });
    }

    // ── Verification gate ──────────────────────────────────────────────────────
    const verifications = await svc.entities.VerificationRecord.filter({ user_id: user.email }).catch(() => []);
    const verification = verifications[0];
    if (!verification || verification.status !== 'approved') {
      return Response.json({ error: 'Identity verification required to sign contracts', code: 'unverified' }, { status: 403 });
    }

    const body = await req.json();
    const { action, contract_id, signed_name, participant_ids } = body;

    if (!contract_id) return Response.json({ error: 'contract_id required' }, { status: 400 });

    // ── Fetch contract ─────────────────────────────────────────────────────────
    const contracts = await svc.entities.Contract.filter({ id: contract_id }).catch(() => []);
    const contract = contracts[0];
    if (!contract) return Response.json({ error: 'Contract not found' }, { status: 404 });

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: send_for_signatures
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === 'send_for_signatures') {
      if (!['generated', 'draft'].includes(contract.status)) {
        return Response.json({ error: `Contract is already ${contract.status}` }, { status: 409 });
      }

      // Build signatories from participant_ids (passed in) or collaboration participants
      let signatoryIds = participant_ids;
      if (!signatoryIds?.length) {
        const collabs = await svc.entities.Collaboration.filter({ id: contract.collaboration_id }).catch(() => []);
        signatoryIds = collabs[0]?.participant_ids || [];
      }
      if (!signatoryIds.length) {
        return Response.json({ error: 'No participants found to sign' }, { status: 400 });
      }

      // Resolve display names
      const profileMap = {};
      for (const uid of signatoryIds) {
        const p = await svc.entities.UserProfile.filter({ user_id: uid }).catch(() => []);
        profileMap[uid] = p[0]?.display_name || uid;
      }

      const signatories = signatoryIds.map(uid => ({
        user_id: uid,
        name: profileMap[uid],
        signed: false,
        signed_at: null,
      }));

      await svc.entities.Contract.update(contract_id, {
        status: 'sent',
        signatories,
        sent_date: new Date().toISOString(),
      });

      // Notify each signatory
      for (const uid of signatoryIds) {
        await svc.entities.Notification.create({
          user_id: uid,
          type: 'contracts',
          actor_user_id: user.email,
          title: 'Contract Ready for Signature',
          body: `"${contract.title}" is ready for your signature.`,
          related_entity_type: 'Contract',
          related_entity_id: contract_id,
          action_url: `/ViewContract?id=${contract_id}`,
        }).catch(() => {});
      }

      // Audit log
      await svc.entities.ContractAuditLog.create({
        contract_id,
        collaboration_id: contract.collaboration_id,
        action: 'contract_sent',
        actor_email: user.email,
        metadata_json: { signatories: signatoryIds, sent_at: new Date().toISOString() },
      }).catch(() => {});

      return Response.json({ success: true, status: 'sent', signatories });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ACTION: sign
    // ═══════════════════════════════════════════════════════════════════════════
    if (action === 'sign') {
      // Contract must be in signable status
      if (!['sent', 'partially_signed'].includes(contract.status)) {
        return Response.json({ error: `Contract cannot be signed in status: ${contract.status}` }, { status: 409 });
      }

      // User must be a listed signatory
      const signatories = contract.signatories || [];
      const myEntry = signatories.find(s => s.user_id === user.email);
      if (!myEntry) {
        return Response.json({ error: 'You are not a required signatory for this contract' }, { status: 403 });
      }

      // No double-signing
      if (myEntry.signed) {
        return Response.json({ error: 'You have already signed this contract' }, { status: 409 });
      }

      // Agent permission check — if user is an agent, they need can_sign_contracts
      if (profile?.role_type === 'agent') {
        const agentDetails = await svc.entities.AgentDetails.filter({ user_id: user.email }).catch(() => []);
        const agent = agentDetails[0];
        if (agent?.permissions?.can_sign_contracts === false) {
          return Response.json({ error: 'Your agent account does not have permission to sign contracts' }, { status: 403 });
        }
      }

      const now = new Date().toISOString();
      const displayName = signed_name || profile?.display_name || user.full_name || user.email;

      // ── Create ContractSignature record ──────────────────────────────────────
      const signature = await svc.entities.ContractSignature.create({
        contract_id,
        signer_id: user.email,
        signer_name: displayName,
        signer_role: profile?.role_type || 'creator',
        signed_at: now,
        signature_data: displayName, // typed name as signature data
        signature_type: 'typed',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
      });

      // ── Update signatories array on Contract ─────────────────────────────────
      const updatedSignatories = signatories.map(s =>
        s.user_id === user.email
          ? { ...s, signed: true, signed_at: now }
          : s
      );

      const allSigned = updatedSignatories.every(s => s.signed);
      const newStatus = allSigned ? 'signed' : 'partially_signed';

      await svc.entities.Contract.update(contract_id, {
        signatories: updatedSignatories,
        status: newStatus,
        ...(allSigned ? { signed_at: now, signed_version_hash: `v${contract.version}_${Date.now()}` } : {}),
      });

      // ── Audit log ────────────────────────────────────────────────────────────
      await svc.entities.ContractAuditLog.create({
        contract_id,
        collaboration_id: contract.collaboration_id,
        action: allSigned ? 'contract_signed' : 'signature_added',
        actor_email: user.email,
        metadata_json: {
          signer: user.email,
          signer_name: displayName,
          signed_at: now,
          signatures_collected: updatedSignatories.filter(s => s.signed).length,
          total_required: updatedSignatories.length,
        },
      }).catch(() => {});

      // ── Notify other signatories that a signature was added ──────────────────
      const unsignedOthers = updatedSignatories.filter(s => !s.signed && s.user_id !== user.email);
      for (const s of unsignedOthers) {
        await svc.entities.Notification.create({
          user_id: s.user_id,
          type: 'contracts',
          actor_user_id: user.email,
          title: `${displayName} has signed`,
          body: `"${contract.title}" — your signature is still required.`,
          related_entity_type: 'Contract',
          related_entity_id: contract_id,
          action_url: `/ViewContract?id=${contract_id}`,
        }).catch(() => {});
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ALL SIGNED — finalize
      // ═══════════════════════════════════════════════════════════════════════
      if (allSigned) {
        // Notify all signatories
        for (const s of updatedSignatories) {
          await svc.entities.Notification.create({
            user_id: s.user_id,
            type: 'contracts',
            actor_user_id: 'SYSTEM',
            title: 'Contract Fully Signed!',
            body: `"${contract.title}" has been signed by all parties.`,
            related_entity_type: 'Contract',
            related_entity_id: contract_id,
            action_url: `/ViewContract?id=${contract_id}`,
          }).catch(() => {});
        }

        // Advance collaboration to contract_signed status if applicable
        if (contract.collaboration_id) {
          const collabs = await svc.entities.Collaboration.filter({ id: contract.collaboration_id }).catch(() => []);
          const collab = collabs[0];
          if (collab && ['agreed', 'contract_pending', 'contract_sent'].includes(collab.status)) {
            await svc.entities.Collaboration.update(contract.collaboration_id, {
              status: 'signed',
            }).catch(() => {});
          }
        }

        // Audit: contract_completed
        await svc.entities.ContractAuditLog.create({
          contract_id,
          collaboration_id: contract.collaboration_id,
          action: 'contract_completed',
          actor_email: 'SYSTEM',
          metadata_json: {
            all_signed_at: now,
            signatories: updatedSignatories.map(s => ({ user_id: s.user_id, signed_at: s.signed_at })),
          },
        }).catch(() => {});
      }

      return Response.json({
        success: true,
        all_signed: allSigned,
        status: newStatus,
        signature_id: signature.id,
        signatures_collected: updatedSignatories.filter(s => s.signed).length,
        total_required: updatedSignatories.length,
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('signContract error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});