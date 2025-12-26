import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      collaboration_id, 
      reason, 
      scope, 
      specific_content 
    } = await req.json();

    if (!collaboration_id) {
      return Response.json({ error: 'collaboration_id required' }, { status: 400 });
    }

    // Create consent revocation record
    const revocation = await base44.asServiceRole.entities.ConsentRevocation.create({
      user_id: user.email,
      collaboration_id,
      revoked_at: new Date().toISOString(),
      reason,
      scope: scope || 'all_content',
      specific_content_ids: specific_content || [],
      status: 'active'
    });

    // Pause the collaboration
    await base44.asServiceRole.entities.Collaboration.update(collaboration_id, {
      status: 'paused'
    });

    // Lock related contracts
    const contracts = await base44.asServiceRole.entities.Contract.filter({
      collaboration_id
    });

    for (const contract of contracts) {
      await base44.asServiceRole.entities.Contract.update(contract.id, {
        status: 'disputed'
      });

      await base44.asServiceRole.entities.ContractAuditLog.create({
        contract_id: contract.id,
        action: 'locked_due_to_consent_revocation',
        performed_by: 'SYSTEM',
        details: {
          revocation_id: revocation.id,
          revoking_user: user.email
        }
      });
    }

    // Log to collaboration activity
    await base44.asServiceRole.entities.CollaborationActivityLog.create({
      collaboration_id,
      activity_type: 'CONSENT_REVOKED',
      user_id: user.email,
      details: {
        revocation_id: revocation.id,
        reason,
        scope
      }
    });

    // Get all participants to notify
    const collaboration = await base44.asServiceRole.entities.Collaboration.filter({
      id: collaboration_id
    });

    if (collaboration.length > 0) {
      const participantIds = collaboration[0].participant_ids || [];
      
      for (const participantId of participantIds) {
        if (participantId !== user.email) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: participantId,
            type: 'consent_revocation',
            title: 'Consent Revoked',
            message: `${user.email} has revoked consent for collaboration. The collaboration has been paused.`,
            related_entity_type: 'collaboration',
            related_entity_id: collaboration_id,
            read: false
          });
        }
      }
    }

    return Response.json({
      success: true,
      revocation_id: revocation.id,
      collaboration_status: 'paused',
      contracts_locked: contracts.length
    });

  } catch (error) {
    console.error('Consent revocation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});