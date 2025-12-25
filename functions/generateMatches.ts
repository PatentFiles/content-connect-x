import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Build match suggestions using AI
    const matchPrompt = `You are an AI matching assistant for Content Connect, an adult content collaboration platform.

Source Type: ${source_type}
Source Data: ${JSON.stringify(source_type === 'user' ? sourceProfile : sourceData, null, 2)}
${source_type === 'user' ? `Source Skills: ${JSON.stringify(sourceSkills, null, 2)}` : ''}
${source_type === 'collaboration' ? `Requirements: ${JSON.stringify(sourceRequirements, null, 2)}` : ''}

Available Profiles: ${JSON.stringify(allProfiles.slice(0, 50), null, 2)}
Available Skills: ${JSON.stringify(allSkills.slice(0, 100), null, 2)}

TASK: Generate ${limit} top match suggestions.

For each match:
1. Calculate a match score (0-100)
2. Identify key matching factors (skills, experience, location, availability, representation compatibility)
3. Check for any risk flags (disputes, consent issues, jurisdiction conflicts, exclusivity violations)
4. Provide a human-readable explanation
5. Determine if admin/agent review is required

OUTPUT FORMAT:
Return a JSON array of matches:
[
  {
    "target_type": "user" or "collaboration",
    "target_id": "string",
    "match_score": 85,
    "match_factors": [
      {"factor": "Scene Pairing Experience", "score": 90, "weight": 2.0},
      {"factor": "Location Proximity", "score": 80, "weight": 1.5}
    ],
    "explanation": "Strong match based on shared Girl/Girl experience and same location",
    "risk_flags": [],
    "requires_review": false,
    "review_reason": null
  }
]

RULES:
- Only suggest verified profiles
- Respect representation exclusivity
- Check dispute history
- Consider jurisdiction eligibility
- Match experience levels appropriately
- Prioritize safety and consent compatibility`;

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
      const suggestion = await base44.asServiceRole.entities.AIMatchSuggestion.create({
        source_type,
        source_id,
        target_type: match.target_type,
        target_id: match.target_id,
        match_score: match.match_score,
        match_factors: match.match_factors,
        explanation: match.explanation,
        risk_flags: match.risk_flags || [],
        requires_review: match.requires_review || false,
        review_reason: match.review_reason,
        status: 'pending',
        viewed: false,
        expires_at: expiresAt.toISOString(),
        model_version: 'v1.0'
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