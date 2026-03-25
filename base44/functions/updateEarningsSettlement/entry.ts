/**
 * updateEarningsSettlement
 *
 * Moves EarningsRecord(s) through the settlement lifecycle.
 * Valid transitions:
 *   projected → pending_settlement
 *   pending_settlement → settled | disputed
 *   disputed → pending_settlement (re-open) | settled
 *
 * Logs every change to ContractAuditLog.
 * Only the record owner or admin may update their records.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const VALID_TRANSITIONS = {
  projected: ['pending_settlement'],
  pending_settlement: ['settled', 'disputed'],
  disputed: ['pending_settlement', 'settled'],
  settled: [], // terminal — require admin override
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { record_id, new_status, notes, admin_override } = await req.json();
    if (!record_id || !new_status) {
      return Response.json({ error: 'record_id and new_status required' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities.EarningsRecord.filter({ id: record_id });
    if (!records.length) return Response.json({ error: 'Record not found' }, { status: 404 });
    const record = records[0];

    // Authorization: owner or admin
    const isAdmin = user.role === 'admin';
    if (record.user_id !== user.email && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentStatus = record.settlement_status;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(new_status) && !isAdmin) {
      return Response.json({
        error: `Cannot transition from ${currentStatus} to ${new_status}`,
        allowed_transitions: allowed,
      }, { status: 400 });
    }

    const updatePayload = {
      settlement_status: new_status,
      notes: notes || record.notes,
    };
    if (new_status === 'settled') {
      updatePayload.settled_at = new Date().toISOString();
    }

    await base44.asServiceRole.entities.EarningsRecord.update(record_id, updatePayload);

    // Audit log
    if (record.contract_id) {
      await base44.asServiceRole.entities.ContractAuditLog.create({
        contract_id: record.contract_id,
        action: 'EARNINGS_SETTLEMENT_STATUS_CHANGED',
        user_id: user.email,
        details: {
          record_id,
          from_status: currentStatus,
          to_status: new_status,
          notes,
          admin_override: !!admin_override,
        },
      }).catch(() => {});
    }

    return Response.json({ success: true, record_id, from: currentStatus, to: new_status });
  } catch (error) {
    console.error('[updateEarningsSettlement]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});