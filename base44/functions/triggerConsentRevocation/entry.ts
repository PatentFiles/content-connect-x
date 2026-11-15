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

    // ── Load collaboration and authorize before any write ────────────────────
    const collaboration = await base44.asServiceRole.entities.Collaboration.filter({
      id: collaboration_id
    });

    if (collaboration.length === 0) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    const participantIds = collaboration[0].participant_ids || [];
    if (!participantIds.includes(user.email) && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
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

    // Get notification preferences
    const notificationPrefs = await base44.asServiceRole.entities.NotificationPreference.list();

    for (const participantId of participantIds) {
      if (participantId === user.email) continue;

      // Check if user wants this notification type
      const pref = notificationPrefs.find(p => 
        p.user_id === participantId && 
        p.notification_type === 'dispute_updates'
      );

      const shouldNotify = !pref || pref.enabled;
      
      if (shouldNotify) {
        // In-app notification
        if (!pref || pref.channels?.in_app !== false) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: participantId,
            type: 'consent_revocation',
            title: 'Consent Revoked - Action Required',
            message: `A participant has revoked consent for this collaboration. The collaboration has been paused and is under admin review.`,
            related_entity_type: 'collaboration',
            related_entity_id: collaboration_id,
            read: false
          });
        }

        // Email notification
        if (pref?.channels?.email !== false) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: participantId,
              subject: 'Consent Revoked - Collaboration Paused',
              body: `A participant has revoked consent for collaboration "${collaboration[0].collaboration_name}". The collaboration has been paused pending admin review. Please check the platform for details.`,
              from_name: 'Content Connect'
            });
          } catch (error) {
            console.error('Failed to send email notification:', error);
          }
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