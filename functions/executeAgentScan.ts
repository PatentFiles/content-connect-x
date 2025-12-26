import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Deterministic risk scoring function for collaborations
 * Stores scores in CollaborationRiskScore and creates AgentFlags for critical issues
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agentId, runId } = await req.json();

    // Update run status to RUNNING
    await base44.asServiceRole.entities.AgentRun.update(runId, {
      run_status: 'RUNNING',
      started_at: new Date().toISOString(),
    });

    // Fetch data
    const collaborations = await base44.asServiceRole.entities.Collaboration.list();
    const verifications = await base44.asServiceRole.entities.VerificationRecord.list();
    const requirements = await base44.asServiceRole.entities.CollaborationRequirement.list();
    const contracts = await base44.asServiceRole.entities.Contract.list();
    const consentRevocations = await base44.asServiceRole.entities.ConsentRevocation.list();
    const studioReps = await base44.asServiceRole.entities.StudioRepresentation.list();
    const agentReps = await base44.asServiceRole.entities.AgentRepresentation.list();
    const activities = await base44.asServiceRole.entities.CollaborationActivity.list();
    const testingCredentials = await base44.asServiceRole.entities.TestingCredential.list();

    let scoresCreated = 0;
    let flagsCreated = 0;

    // Score each collaboration
    for (const collab of collaborations) {
      if (!['active', 'negotiating', 'agreed', 'contract_sent'].includes(collab.status)) {
        continue; // Skip completed/cancelled
      }

      const score = calculateCollaborationRiskScore(collab, {
        verifications,
        requirements,
        contracts,
        consentRevocations,
        studioReps,
        agentReps,
        activities,
        testingCredentials,
      });

      // Store score
      await base44.asServiceRole.entities.CollaborationRiskScore.create({
        collaboration_id: collab.id,
        score: score.total,
        band: score.band,
        score_breakdown_json: score.breakdown,
        explanation: score.explanation,
        calculated_at: new Date().toISOString(),
      });
      scoresCreated++;

      // Create flags for critical issues
      for (const flag of score.flags) {
        await base44.asServiceRole.entities.AgentFlag.create({
          agent_id: agentId,
          run_id: runId,
          target_type: 'COLLABORATION',
          target_id: collab.id,
          severity: flag.severity,
          category: flag.category,
          title: flag.title,
          description: flag.description,
          reason_codes_json: flag.reasons,
          suggested_actions_json: flag.actions,
          risk_score: score.total,
          status: 'OPEN',
        });
        flagsCreated++;
      }
    }

    // Update run status to COMPLETED
    await base44.asServiceRole.entities.AgentRun.update(runId, {
      run_status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      output_summary: `Scored ${scoresCreated} collaborations, created ${flagsCreated} flags`,
      metadata_json: { scoresCreated, flagsCreated },
    });

    return Response.json({
      success: true,
      scoresCreated,
      flagsCreated,
    });
  } catch (error) {
    console.error('Agent scan error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateCollaborationRiskScore(collab, data) {
  const breakdown = {
    verification_readiness: 0,
    testing_readiness: 0,
    contract_readiness: 0,
    representation_conflicts: 0,
    audit_integrity: 0,
  };
  const flags = [];

  // A) Verification Readiness (0-35)
  const participants = collab.participant_ids || [];
  let unverifiedCount = 0;
  let pendingCount = 0;
  
  for (const participantId of participants) {
    const verification = data.verifications.find(v => v.user_id === participantId);
    if (!verification || verification.status !== 'approved') {
      if (!verification || verification.status === 'pending') {
        pendingCount++;
        breakdown.verification_readiness += 20;
      } else {
        unverifiedCount++;
        breakdown.verification_readiness += 35;
        flags.push({
          severity: 'CRITICAL',
          category: 'VERIFICATION_PENDING',
          title: 'Unverified Participant',
          description: `Participant ${participantId} is not verified`,
          reasons: { participantId, verificationStatus: verification?.status || 'none' },
          actions: ['Review and approve verification', 'Contact participant for documents'],
        });
      }
      break; // Only count first unverified
    }
  }

  // B) Testing Readiness (0-20)
  const testingReq = data.requirements.find(
    r => r.collaboration_id === collab.id && r.requirement_type === 'REQUIRED_TESTING_VISIBILITY'
  );
  if (testingReq) {
    const hasValidCredentials = participants.every(pid => {
      const cred = data.testingCredentials.find(tc => tc.user_id === pid);
      return cred && cred.status === 'valid';
    });
    if (!hasValidCredentials) {
      breakdown.testing_readiness = 20;
      flags.push({
        severity: 'HIGH',
        category: 'TESTING_GAP',
        title: 'Testing Requirements Not Met',
        description: 'Collaboration requires testing but credentials are missing or invalid',
        reasons: { requirement: testingReq.requirement_value },
        actions: ['Verify testing credentials', 'Update testing visibility settings'],
      });
    }
  }

  // C) Contract Readiness (0-20)
  const contract = data.contracts.find(c => c.collaboration_id === collab.id);
  const hasConsentRevocation = data.consentRevocations.some(
    cr => cr.collaboration_id === collab.id && cr.status === 'active'
  );
  
  if (hasConsentRevocation) {
    breakdown.contract_readiness = 20;
    flags.push({
      severity: 'CRITICAL',
      category: 'CONSENT_REVOCATION',
      title: 'Active Consent Revocation',
      description: 'Participant has revoked consent for this collaboration',
      reasons: { collaboration_id: collab.id },
      actions: ['Review consent revocation', 'Halt collaboration if necessary'],
    });
  } else if (contract && contract.status === 'draft' && !contract.content) {
    breakdown.contract_readiness = 20;
  }

  // D) Representation Conflicts (0-15)
  const exclusiveStudioRep = data.studioReps.find(
    sr => participants.includes(sr.creator_user_id) && sr.representation_type === 'Exclusive'
  );
  if (exclusiveStudioRep) {
    const isStudioInvolved = participants.includes(exclusiveStudioRep.studio_id);
    if (!isStudioInvolved) {
      breakdown.representation_conflicts = 15;
      flags.push({
        severity: 'HIGH',
        category: 'EXCLUSIVITY_CONFLICT',
        title: 'Exclusive Studio Representation Conflict',
        description: 'Creator is exclusively represented by a studio not involved in collaboration',
        reasons: { studioId: exclusiveStudioRep.studio_id, creatorId: exclusiveStudioRep.creator_user_id },
        actions: ['Verify studio approval', 'Add studio as collaborator', 'Update representation terms'],
      });
    }
  }

  const agentRep = data.agentReps.find(ar => participants.includes(ar.creator_user_id));
  if (agentRep && agentRep.representation_type === 'Exclusive' && collab.created_by_role !== 'agent') {
    breakdown.representation_conflicts += 8;
  }

  // E) Audit Integrity (0-10)
  const collabActivities = data.activities.filter(a => a.collaboration_id === collab.id);
  const hasCreatedEvent = collabActivities.some(a => a.activity_type === 'created');
  const hasRoleChanges = participants.length > 1 && collabActivities.some(a => a.activity_type === 'role_changed');
  
  if (!hasCreatedEvent || (contract && !collabActivities.some(a => a.activity_type.includes('contract')))) {
    breakdown.audit_integrity = 10;
  }

  // Calculate total (clamped 0-100)
  const total = Math.min(
    100,
    breakdown.verification_readiness +
    breakdown.testing_readiness +
    breakdown.contract_readiness +
    breakdown.representation_conflicts +
    breakdown.audit_integrity
  );

  // Determine band
  let band = 'SAFE';
  if (total >= 70) band = 'HIGH_RISK';
  else if (total >= 30) band = 'REVIEW';

  // Generate explanation
  const topIssues = Object.entries(breakdown)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, score]) => `${key.replace(/_/g, ' ')}: ${score}`)
    .join(', ');

  return {
    total,
    band,
    breakdown,
    explanation: topIssues || 'No significant issues detected',
    flags,
  };
}