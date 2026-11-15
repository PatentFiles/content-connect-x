/**
 * generateAIContract — AI-Assisted Contract Drafting (Admin-safe, user-authenticated)
 *
 * Flow:
 *  1. Authenticate + ban check
 *  2. Load collaboration, participants, profiles, representations, templates
 *  3. Pick best matching template (if any) and extract its structure as guidance
 *  4. Build a rich, structured prompt from all available collaboration data
 *  5. Call InvokeLLM requesting a structured JSON contract output (not a blob)
 *  6. Return structured sections + metadata to the frontend
 *
 * The frontend then:
 *  - Shows the draft for user review/edit
 *  - Calls the existing createContractSnapshot → Contract → ContractVersion → ContractAuditLog pipeline
 *
 * This function ONLY generates the draft. It does NOT bypass any existing contract infrastructure.
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

    // ── Ban / suspension check ────────────────────────────────────────────────
    const svc = base44.asServiceRole;
    const userProfiles = await svc.entities.UserProfile.filter({ user_id: user.email });
    const userProfile = userProfiles[0];
    if (userProfile?.banned || userProfile?.suspended) {
      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_BAN_ENFORCEMENT',
        action_type: 'blocked_action_attempt',
        target_user_id: user.email,
        details: { action_attempted: 'generate_ai_contract', block_reason: userProfile.banned ? 'banned' : 'suspended' },
        reason: `Blocked ${userProfile.banned ? 'banned' : 'suspended'} user from AI contract generation`,
      }).catch(() => {});
      return Response.json({ error: 'Account is blocked', blocked: true }, { status: 403 });
    }

    const body = await req.json();
    const {
      collaboration_id,
      extra_provisions = '',
      special_notes = '',
      preferred_template_id = null,
    } = body;

    if (!collaboration_id) return Response.json({ error: 'collaboration_id required' }, { status: 400 });

    // ── Load collaboration ────────────────────────────────────────────────────
    const collabs = await svc.entities.Collaboration.filter({ id: collaboration_id });
    if (!collabs.length) return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    const collab = collabs[0];

    // ── Authorization: caller must be a participant or an admin ──────────────
    if (!(collab.participant_ids || []).includes(user.email) && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ── Load participant profiles ─────────────────────────────────────────────
    const allProfiles = await svc.entities.UserProfile.list();
    const profileMap = {};
    allProfiles.forEach(p => { profileMap[p.user_id] = p; });

    const participantIds = collab.participant_ids || [];
    const participants = participantIds.map(id => {
      const p = profileMap[id] || {};
      return {
        user_id: id,
        display_name: p.display_name || id,
        real_name: p.real_name || '',
        role_type: p.role_type || 'creator',
        location: p.base_location || {},
      };
    });

    // ── Load representations ──────────────────────────────────────────────────
    const agentReps = await svc.entities.AgentRepresentation.filter({ status: 'ACTIVE' });
    const studioReps = await svc.entities.StudioRepresentation.list().catch(() => []);

    const representations = [];
    for (const pid of participantIds) {
      const agentRep = agentReps.find(r => r.creator_user_id === pid);
      if (agentRep) {
        const agentProfile = profileMap[agentRep.agent_user_id] || {};
        representations.push({
          creator_id: pid,
          type: 'agent',
          representative_name: agentProfile.display_name || agentRep.agent_user_id,
          commission_rate: agentRep.commission_rate || 0,
          exclusivity: agentRep.exclusivity || false,
        });
      }
      const studioRep = studioReps.find(r => r.creator_user_id === pid || r.creator_id === pid);
      if (studioRep) {
        const studioProfile = profileMap[studioRep.studio_user_id || studioRep.studio_id] || {};
        representations.push({
          creator_id: pid,
          type: 'studio',
          representative_name: studioProfile.display_name || 'Studio',
          revenue_percentage: studioRep.revenue_percentage || studioRep.split_rate || 0,
        });
      }
    }

    // ── Determine collaboration type ──────────────────────────────────────────
    let collaborationType = 'creator_to_creator';
    if (collab.studio_id) collaborationType = 'studio_contract';
    else if (collab.photographer_id) collaborationType = 'photographer_contract';
    else if (collab.videographer_id) collaborationType = 'videographer_contract';
    else if (collab.agent_id) collaborationType = 'agent_managed';
    else if (representations.some(r => r.type === 'studio')) collaborationType = 'studio_contract';
    else if (representations.some(r => r.type === 'agent')) collaborationType = 'agent_managed';

    // ── Pick best matching template ───────────────────────────────────────────
    const templates = await svc.entities.ContractTemplate.filter({ is_active: true });
    let bestTemplate = null;
    if (preferred_template_id) {
      bestTemplate = templates.find(t => t.id === preferred_template_id) || null;
    }
    if (!bestTemplate) {
      // Match by applicable_roles first, then category, then any active
      bestTemplate = templates.find(t => (t.applicable_roles || []).includes(collaborationType))
        || templates.find(t => t.category === collaborationType)
        || templates.find(t => t.is_default)
        || templates[0]
        || null;
    }

    // ── Build structured context for the LLM ─────────────────────────────────
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const participantSummary = participants.map(p =>
      `${p.display_name} (${p.role_type}${p.real_name ? `, legal name: ${p.real_name}` : ''})`
    ).join(', ');

    const repSummary = representations.length > 0
      ? representations.map(r =>
          `${r.creator_id} is ${r.type === 'agent' ? 'agent-represented' : 'studio-represented'} by ${r.representative_name}` +
          (r.commission_rate ? ` (${r.commission_rate}% commission)` : '') +
          (r.revenue_percentage ? ` (${r.revenue_percentage}% split)` : '')
        ).join('; ')
      : 'None';

    const schedule = collab.schedule || {};
    const location = collab.location || {};
    const compensation = collab.compensation_details || {};
    const deliverables = collab.deliverables || {};
    const usageRights = collab.usage_rights || {};
    const boundaries = collab.boundaries || {};

    const templateGuidance = bestTemplate
      ? `\nBase your clause structure and tone on this template titled "${bestTemplate.name}" (category: ${bestTemplate.category}). Template content for reference:\n${(bestTemplate.content || '').substring(0, 2000)}\n`
      : '';

    const prompt = `You are a legal contract drafting assistant specializing in content creation industry agreements. 
Draft a professional, complete, and legally structured contract based on the following collaboration details.

COLLABORATION TYPE: ${collaborationType.replace(/_/g, ' ').toUpperCase()}
PROJECT NAME: ${collab.collaboration_name || 'Untitled Project'}
EFFECTIVE DATE: ${today}

PARTIES:
${participantSummary}

REPRESENTATION:
${repSummary}

SCENE/PROJECT TYPE: ${collab.scene_type || 'standard'}
SCENE TYPES: ${(collab.scene_selected || []).join(', ') || 'Not specified'}
ACTS AGREED: ${(collab.acts_selected || []).join(', ') || 'Not specified'}
HARD LIMITS (must not appear in contract as permitted): ${(boundaries.hard_no || []).join(', ') || 'None specified'}
SOFT LIMITS: ${(boundaries.soft_limits || []).join(', ') || 'None specified'}
AFTERCARE REQUIRED: ${boundaries.aftercare_required ? 'Yes' : 'No'}

SCHEDULE:
Confirmed Date: ${schedule.confirmed_date || 'TBD'}
Start Time: ${schedule.start_time || 'TBD'}
End Time: ${schedule.end_time || 'TBD'}
Duration: ${schedule.duration_hours ? schedule.duration_hours + ' hours' : 'TBD'}

LOCATION:
Type: ${location.type || 'TBD'}
City: ${location.city || 'TBD'}
Address: ${location.address || 'TBD'}
Notes: ${location.notes || 'None'}

COMPENSATION:
Type: ${collab.compensation_type || 'paid'}
Amount: ${compensation.amount ? `${compensation.currency || 'USD'} ${compensation.amount}` : 'TBD'}
Split: ${compensation.split_details || 'Equal split unless specified'}
Notes: ${compensation.notes || 'None'}

DELIVERABLES:
Photos: ${deliverables.photo ? 'Yes' : 'No'}
Video: ${deliverables.video ? 'Yes' : 'No'}
Raw Files: ${deliverables.raw_files ? 'Yes' : 'No'}
Editing Included: ${deliverables.editing_included ? 'Yes' : 'No'}
Delivery Timeline: ${deliverables.delivery_timeline_days ? deliverables.delivery_timeline_days + ' days' : 'TBD'}

USAGE RIGHTS:
Platforms: ${(usageRights.platforms || []).join(', ') || 'All platforms'}
Exclusivity: ${usageRights.exclusivity ? 'Yes' : 'No'}
Exclusivity Period: ${usageRights.exclusivity_period_days ? usageRights.exclusivity_period_days + ' days' : 'N/A'}
Resale Allowed: ${usageRights.resale_allowed ? 'Yes' : 'No'}
Credit Required: ${usageRights.credit_required ? 'Yes' : 'No'}
Other: ${usageRights.other_platforms || ''}

SPECIAL PROVISIONS FROM USER:
${extra_provisions || 'None'}

ADDITIONAL NOTES:
${special_notes || 'None'}
${templateGuidance}

INSTRUCTIONS:
1. Draft a complete, professional contract with all standard and industry-specific clauses.
2. Include consent, revocation rights, and performer safety clauses appropriate to the content type.
3. Include explicit AI use policy: no AI training without written consent.
4. Include a 30-day takedown request right.
5. Hard limits listed above must NOT be referenced as permitted activities.
6. Ensure representation/commission clauses are included when representatives are listed.
7. Output ONLY valid JSON matching the exact schema below. Do not include any explanation outside the JSON.

OUTPUT JSON SCHEMA (return EXACTLY this structure):
{
  "contract_title": "string — professional title for this contract",
  "collaboration_type": "string — one of: creator_to_creator, studio_contract, photographer_contract, videographer_contract, agent_managed, custom",
  "parties_summary": "string — plain English summary of who the parties are and their roles",
  "sections": [
    {
      "title": "string — clause/section title",
      "content": "string — full professional clause text. Use \\n for newlines.",
      "editable": true
    }
  ],
  "key_terms": {
    "effective_date": "string",
    "shoot_date": "string",
    "location": "string",
    "compensation": "string",
    "deliverables": "string",
    "exclusivity": "string",
    "platforms": "string",
    "credit_required": "string",
    "ai_use_policy": "string",
    "takedown_policy": "string"
  },
  "ai_notes": "string — brief notes about what the AI assumed or what the user should review before signing",
  "template_used": "${bestTemplate?.name || 'none'}"
}`;

    // ── Call InvokeLLM with structured JSON response ───────────────────────────
    const aiResult = await svc.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          contract_title: { type: 'string' },
          collaboration_type: { type: 'string' },
          parties_summary: { type: 'string' },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                editable: { type: 'boolean' },
              },
            },
          },
          key_terms: { type: 'object' },
          ai_notes: { type: 'string' },
          template_used: { type: 'string' },
        },
      },
    });

    // ── Log AI draft generation to AdminActionLog ─────────────────────────────
    await svc.entities.AdminActionLog.create({
      admin_user_id: user.email,
      action_type: 'ai_contract_draft_generated',
      target_user_id: user.email,
      details: {
        collaboration_id,
        collaboration_type: collaborationType,
        template_used: bestTemplate?.name || 'none',
        template_id: bestTemplate?.id || null,
        section_count: aiResult?.sections?.length || 0,
        participants: participantIds,
        has_representations: representations.length > 0,
        model_used: 'claude_sonnet_4_6',
      },
      reason: `AI contract draft generated for collaboration: ${collab.collaboration_name || collaboration_id}`,
    }).catch(() => {});

    return Response.json({
      success: true,
      draft: aiResult,
      metadata: {
        collaboration_id,
        collaboration_type: collaborationType,
        template_used: bestTemplate ? { id: bestTemplate.id, name: bestTemplate.name } : null,
        generated_at: new Date().toISOString(),
        generated_by: user.email,
        ai_assisted: true,
        model: 'claude_sonnet_4_6',
      },
    });

  } catch (error) {
    console.error('AI contract generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});