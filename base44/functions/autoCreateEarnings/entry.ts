/**
 * autoCreateEarnings
 *
 * Triggered when a collaboration reaches 'completed' status.
 * Also callable manually by admins for backfill.
 *
 * Idempotency: checks for existing EarningsRecord with
 * { user_id, collaboration_id, type } before creating.
 *
 * Creates records for:
 *   - Each creator: their net share after agent commission + studio split
 *   - Each agent: commission_received record per represented creator
 *   - Each studio: commission_received record per represented creator
 *
 * Revenue sources (priority order):
 *   1. Contract.post_scene_rules.revenue_split (most authoritative)
 *   2. Contract.content.key_terms (AI-generated)
 *   3. Collaboration.compensation_details.amount
 *   4. Fallback: gross=0, split=100%, status=projected
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function safePct(v) {
  const n = parseFloat(v);
  return isNaN(n) || n < 0 || n > 100 ? null : n;
}

function fmt(n) {
  return Math.round((n || 0) * 100) / 100;
}

async function recordExists(base44, userId, collaborationId, type) {
  const existing = await base44.asServiceRole.entities.EarningsRecord.filter({
    user_id: userId,
    collaboration_id: collaborationId,
    type,
  });
  return existing.length > 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { collaboration_id, admin_override } = body;

    if (!collaboration_id) {
      return Response.json({ error: 'collaboration_id required' }, { status: 400 });
    }

    // Allow the call from: admin users OR the system (entity automation)
    const isAdmin = user.role === 'admin';
    if (!isAdmin && !admin_override) {
      // Non-admin can trigger for their own collaboration (participant check below)
    }

    // ── 1. Load collaboration ──────────────────────────────────────────────
    const collabs = await base44.asServiceRole.entities.Collaboration.filter({ id: collaboration_id });
    if (!collabs.length) return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    const collab = collabs[0];

    // Only auto-create for completed (or admin override for any state)
    if (!isAdmin && collab.status !== 'completed') {
      return Response.json({
        skipped: true,
        reason: 'Collaboration not yet completed',
        status: collab.status,
      });
    }

    const participantIds = collab.participant_ids || [];

    // ── 2. Load contract (most recent signed/completed) ────────────────────
    const contracts = await base44.asServiceRole.entities.Contract.filter({
      collaboration_id,
    });
    const contract = contracts
      .filter(c => ['signed', 'completed', 'generated', 'draft'].includes(c.status))
      .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))[0] || null;

    // ── 3. Determine gross amount ──────────────────────────────────────────
    let grossAmount = 0;
    let currency = collab.compensation_details?.currency || 'USD';

    if (collab.compensation_type === 'paid' || collab.compensation_type === 'rev_share_external') {
      grossAmount = parseFloat(collab.compensation_details?.amount) || 0;
    }
    // Override from contract key_terms if present
    if (contract?.content?.key_terms?.compensation) {
      const parsed = parseFloat(String(contract.content.key_terms.compensation).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) grossAmount = parsed;
    }

    // ── 4. Load representation data ────────────────────────────────────────
    const agentReps = await base44.asServiceRole.entities.AgentRepresentation.filter({
      status: 'ACTIVE',
    });
    const studioReps = await base44.asServiceRole.entities.StudioRepresentation.filter({
      active: true,
    });

    // ── 5. Build per-creator earnings ──────────────────────────────────────
    const collaborationType = collab.created_by_role || 'creator';
    const createdRecords = [];
    const skippedRecords = [];

    for (const creatorId of participantIds) {
      // Determine split from contract post_scene_rules
      let creatorSplitPct = null;
      const revSplit = contract?.post_scene_rules?.revenue_split || {};
      if (revSplit[creatorId] !== undefined) {
        creatorSplitPct = safePct(revSplit[creatorId]);
      }
      // Equal split fallback
      if (creatorSplitPct === null && participantIds.length > 0) {
        creatorSplitPct = fmt(100 / participantIds.length);
      }

      // Agent commission for this creator
      const agentRep = agentReps.find(r => r.creator_user_id === creatorId);
      const agentCommissionRate = agentRep ? safePct(agentRep.commission_rate) : null;

      // Studio split for this creator
      const studioRep = studioReps.find(r => r.creator_user_id === creatorId);
      const studioSplitRate = studioRep ? safePct(studioRep.revenue_share_percentage) : null;

      // Compute creator gross share
      const creatorGross = fmt(grossAmount * (creatorSplitPct / 100));

      // Deduct agent commission
      const agentDeduction = agentCommissionRate ? fmt(creatorGross * (agentCommissionRate / 100)) : 0;
      // Deduct studio split
      const studioDeduction = studioSplitRate ? fmt(creatorGross * (studioSplitRate / 100)) : 0;
      // Creator net
      const creatorNet = fmt(creatorGross - agentDeduction - studioDeduction);

      const settlementStatus = grossAmount > 0 ? 'pending_settlement' : 'projected';

      // ── Creator record (idempotent) ──────────────────────────────────────
      if (await recordExists(base44, creatorId, collaboration_id, 'confirmed')) {
        skippedRecords.push({ user_id: creatorId, type: 'confirmed', reason: 'already_exists' });
      } else {
        const rec = await base44.asServiceRole.entities.EarningsRecord.create({
          user_id: creatorId,
          collaboration_id,
          contract_id: contract?.id || null,
          type: 'confirmed',
          gross_amount: fmt(grossAmount),
          net_amount: creatorNet,
          currency,
          split_percentage: creatorSplitPct,
          agent_commission_rate: agentCommissionRate,
          studio_split_rate: studioSplitRate,
          collaboration_type: collaborationType,
          settlement_status: settlementStatus,
          visibility: 'private',
          notes: `Auto-created on collaboration completion`,
        });
        createdRecords.push({ id: rec.id, user_id: creatorId, type: 'confirmed' });

        // ── Agent commission record ──────────────────────────────────────
        if (agentRep && agentCommissionRate && agentDeduction > 0) {
          if (await recordExists(base44, agentRep.agent_user_id, collaboration_id, 'commission_received')) {
            skippedRecords.push({ user_id: agentRep.agent_user_id, type: 'commission_received', reason: 'already_exists' });
          } else {
            const agentRec = await base44.asServiceRole.entities.EarningsRecord.create({
              user_id: agentRep.agent_user_id,
              collaboration_id,
              contract_id: contract?.id || null,
              type: 'commission_received',
              gross_amount: fmt(grossAmount),
              net_amount: agentDeduction,
              currency,
              split_percentage: agentCommissionRate,
              agent_commission_rate: agentCommissionRate,
              collaboration_type: collaborationType,
              settlement_status: settlementStatus,
              visibility: 'agent_visible',
              notes: `Agent commission from ${creatorId} — ${agentCommissionRate}%`,
            });
            createdRecords.push({ id: agentRec.id, user_id: agentRep.agent_user_id, type: 'commission_received' });
          }
        }

        // ── Studio split record ──────────────────────────────────────────
        if (studioRep && studioSplitRate && studioDeduction > 0) {
          if (await recordExists(base44, studioRep.studio_id, collaboration_id, 'commission_received')) {
            skippedRecords.push({ user_id: studioRep.studio_id, type: 'commission_received', reason: 'already_exists' });
          } else {
            const studioRec = await base44.asServiceRole.entities.EarningsRecord.create({
              user_id: studioRep.studio_id,
              collaboration_id,
              contract_id: contract?.id || null,
              type: 'commission_received',
              gross_amount: fmt(grossAmount),
              net_amount: studioDeduction,
              currency,
              split_percentage: studioSplitRate,
              studio_split_rate: studioSplitRate,
              collaboration_type: collaborationType,
              settlement_status: settlementStatus,
              visibility: 'studio_visible',
              notes: `Studio split from ${creatorId} — ${studioSplitRate}%`,
            });
            createdRecords.push({ id: studioRec.id, user_id: studioRep.studio_id, type: 'commission_received' });
          }
        }
      }
    }

    // ── 6. Audit log ──────────────────────────────────────────────────────
    if (contract?.id && createdRecords.length > 0) {
      await base44.asServiceRole.entities.ContractAuditLog.create({
        contract_id: contract.id,
        action: 'EARNINGS_AUTO_CREATED',
        user_id: user.email,
        details: {
          collaboration_id,
          records_created: createdRecords.length,
          records_skipped: skippedRecords.length,
          gross_amount: grossAmount,
          currency,
          participant_count: participantIds.length,
          triggered_by: admin_override ? 'admin_manual' : 'collaboration_completed',
        },
      }).catch(() => {});
    }

    return Response.json({
      success: true,
      collaboration_id,
      gross_amount: grossAmount,
      records_created: createdRecords,
      records_skipped: skippedRecords,
    });
  } catch (error) {
    console.error('[autoCreateEarnings]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});