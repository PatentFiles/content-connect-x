import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // BAN CHECK
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
      const profile = profiles[0];
      if (profile?.banned === true || profile?.suspended === true) {
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_id: 'SYSTEM_BAN_ENFORCEMENT', action_type: 'blocked_action_attempt',
          target_user_id: user.email,
          details: { action_attempted: 'generate_matches', block_reason: profile?.banned ? 'banned' : 'suspended', timestamp: new Date().toISOString() },
          reason: `Blocked ${profile?.banned ? 'banned' : 'suspended'} user from: generate_matches`
        });
        return Response.json({ error: 'Account is blocked', code: profile?.banned ? 'banned' : 'suspended', blocked: true }, { status: 403 });
      }
    } catch (e) { return Response.json({ error: 'Unable to verify account status', blocked: true }, { status: 403 }); }

    const { source_type, source_id, limit = 10 } = await req.json();

    // Fetch source data
    let sourceData, sourceProfile, sourceSkills, sourceRequirements;
    
    if (source_type === 'user') {
      sourceProfile = await base44.entities.UserProfile.filter({ user_id: source_id });
      sourceSkills = await base44.entities.ProfileSkill.filter({ user_id: source_id });
    } else if (source_type === 'collaboration') {
      sourceData = await base44.entities.Collaboration.filter({ id: source_id });
      sourceRequirements = await base44.entities.CollaborationRequirement.filter({ 
        collaboration_id: source_id 
      });
    }

    // Fetch all potential matches
    const allProfiles = await base44.asServiceRole.entities.UserProfile.list();
    const allVerifications = await base44.asServiceRole.entities.VerificationRecord.list();
    const allSkills = await base44.asServiceRole.entities.ProfileSkill.list();
    const allCollaborations = await base44.asServiceRole.entities.Collaboration.list();
    const allDisputes = await base44.asServiceRole.entities.CollaborationDispute.list();
    const allRepresentations = await base44.asServiceRole.entities.AgentRepresentation.list();
    const allStudioReps = await base44.asServiceRole.entities.StudioRepresentation.list();

    // Fetch verifications and subscriptions
    const verifiedUsers = allVerifications
      .filter(v => v.status === 'approved')
      .map(v => v.user_id);
    
    const activeSubscriptions = await base44.asServiceRole.entities.Subscription.filter({ 
      status: 'active' 
    });
    const subscribedUsers = activeSubscriptions.map(s => s.user_id);

    // Fetch active disputes
    const activeDisputes = allDisputes.filter(d => 
      ['open', 'under_review', 'escalated'].includes(d.status)
    );

    // Build match suggestions using AI
    const matchPrompt = `You are an AI matching assistant for Content Connect, an adult content collaboration platform.

Source Type: ${source_type}
Source Data: ${JSON.stringify(source_type === 'user' ? sourceProfile : sourceData, null, 2)}
${source_type === 'user' ? `Source Skills: ${JSON.stringify(sourceSkills, null, 2)}` : ''}
${source_type === 'collaboration' ? `Requirements: ${JSON.stringify(sourceRequirements, null, 2)}` : ''}

Available Profiles: ${JSON.stringify(allProfiles.slice(0, 50), null, 2)}
Available Skills: ${JSON.stringify(allSkills.slice(0, 100), null, 2)}
Verified Users: ${JSON.stringify(verifiedUsers)}
Subscribed Users: ${JSON.stringify(subscribedUsers)}
Agent Representations: ${JSON.stringify(allRepresentations.slice(0, 20))}
Studio Representations: ${JSON.stringify(allStudioReps.slice(0, 20))}
Active Disputes: ${JSON.stringify(activeDisputes.slice(0, 10))}

TASK: Generate ${limit} top match suggestions following Content Connect's EXACT rules.

HARD GATES (must pass or status = NOT_ELIGIBLE):
1. Suggested users MUST be verified (in verifiedUsers list)
2. Suggested users MUST be subscribed (in subscribedUsers list)
3. If collaboration has REQUIRED_VERIFICATION requirement, all suggestions must be verified
4. Never suggest users with active disputes
5. Respect hard limits: check ProfileSkill boundaries and never suggest incompatible acts
6. If collaboration requires specific SCENE_PAIRING, only suggest users with that pairing skill
7. Respect REPRESENTATION_COMPATIBILITY (Independent/Agent-allowed/Studio-allowed)
8. Respect STUDIO_EXCLUSIVITY_COMPATIBILITY (check StudioRepresentation active=true)

COMPATIBILITY CHECKS:
- Match SCENE_PAIRING requirements from CollaborationRequirement with user ProfileSkills
- Match STANDARD_ACT, FETISH_ACT, KINK_EDGE_ACT requirements with user skills
- Match PERFORMANCE_POSITIONING (only for gay/bi male creators)
- Check jurisdiction compatibility if REQUIRED_JURISDICTION is set
- Check insurance if REQUIRED_INSURANCE is set
- For photographers/videographers: match CREATOR_TYPES_SERVED with collaboration participants

MATCH STATUSES:
- MATCHED: all requirements met
- POTENTIAL_REQUIRES_REVIEW: most requirements met, 1-2 non-critical missing
- NOT_ELIGIBLE: fails a hard gate

OUTPUT FORMAT:
Return a JSON object with matches array:
{
  "matches": [
    {
      "target_type": "user" or "collaboration",
      "target_id": "string",
      "match_score": 85,
      "status": "MATCHED" | "POTENTIAL_REQUIRES_REVIEW" | "NOT_ELIGIBLE",
      "match_factors": [
        {"factor": "Scene Pairing: Girl/Girl", "score": 95, "weight": 2.0},
        {"factor": "Standard Acts: Oral, Toys", "score": 90, "weight": 1.5},
        {"factor": "Location: Same City", "score": 100, "weight": 1.0}
      ],
      "explanation": "Strong match: verified creator with Girl/Girl and fetish experience, shares location, available dates align",
      "missing_requirements": [],
      "risk_flags": [],
      "requires_review": false,
      "review_reason": null
    }
  ]
}

BE STRICT: Do not suggest anyone who fails verification, subscription, or has active disputes.`;

    const aiResponse = await base44.integrations.Core.InvokeLLM({
      prompt: matchPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          matches: {
            type: "array",
            items: {
              type: "object",
              properties: {
                target_type: { type: "string" },
                target_id: { type: "string" },
                match_score: { type: "number" },
                status: { type: "string" },
                match_factors: { 
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      factor: { type: "string" },
                      score: { type: "number" },
                      weight: { type: "number" }
                    }
                  }
                },
                explanation: { type: "string" },
                missing_requirements: {
                  type: "array",
                  items: { type: "string" }
                },
                risk_flags: { 
                  type: "array",
                  items: { type: "string" }
                },
                requires_review: { type: "boolean" },
                review_reason: { type: "string" }
              }
            }
          }
        }
      }
    });

    // Store suggestions in database
    const suggestions = [];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Suggestions expire in 7 days

    for (const match of aiResponse.matches || []) {
      // Skip NOT_ELIGIBLE matches
      if (match.status === 'NOT_ELIGIBLE') continue;

      const suggestion = await base44.asServiceRole.entities.AIMatchSuggestion.create({
        source_type,
        source_id,
        target_type: match.target_type,
        target_id: match.target_id,
        match_score: match.match_score,
        match_factors: match.match_factors,
        explanation: match.explanation,
        risk_flags: match.risk_flags || [],
        requires_review: match.requires_review || match.status === 'POTENTIAL_REQUIRES_REVIEW',
        review_reason: match.review_reason || (match.missing_requirements?.length > 0 ? `Missing: ${match.missing_requirements.join(', ')}` : null),
        status: 'pending',
        viewed: false,
        expires_at: expiresAt.toISOString(),
        model_version: 'cc-v1.0'
      });
      suggestions.push(suggestion);
    }

    return Response.json({ 
      success: true,
      suggestions,
      count: suggestions.length
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});