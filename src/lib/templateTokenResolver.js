/**
 * templateTokenResolver.js
 * 
 * Auto-populates contract template token values from collaboration + profile data.
 * Returns { autoFilled, missing, allTokens } so the UI knows what to show vs. hide.
 * 
 * Reuses the same field mapping logic as ContractGenerator.js.
 */

export function resolveTokensFromCollaboration({ collaboration, profiles = [], agentReps = [], studioReps = [] }) {
  if (!collaboration) return { autoFilled: {}, missing: [] };

  const participantIds = collaboration.participant_ids || [];

  // Build a lookup: userId -> profile
  const profileByUser = {};
  profiles.forEach(p => { profileByUser[p.user_id] = p; });

  // Participant display names
  const participantNames = participantIds.map(id => {
    const p = profileByUser[id];
    return p?.display_name || p?.real_name || id;
  });

  const creatorIds = collaboration.creator_ids || [];
  const creatorProfiles = creatorIds.map(id => profileByUser[id]).filter(Boolean);
  const creatorNames = creatorProfiles.map(p => p.display_name || p.real_name || p.user_id).join(', ') || participantNames.join(', ');

  // Studio
  const studioProfile = collaboration.studio_id ? profileByUser[collaboration.studio_id] : null;
  const studioName = studioProfile?.display_name || studioProfile?.real_name || collaboration.studio_id || '';

  // Agent
  const agentProfile = collaboration.agent_id ? profileByUser[collaboration.agent_id] : null;
  const agentName = agentProfile?.display_name || agentProfile?.real_name || collaboration.agent_id || '';

  // Photographer / Videographer
  const photographerProfile = collaboration.photographer_id ? profileByUser[collaboration.photographer_id] : null;
  const videographerProfile = collaboration.videographer_id ? profileByUser[collaboration.videographer_id] : null;

  // Schedule
  const confirmedDate = collaboration.schedule?.confirmed_date || '';
  const proposedDates = (collaboration.schedule?.proposed_dates || []).join(', ');
  const scheduledDate = confirmedDate || proposedDates || 'TBD';
  const startTime = collaboration.schedule?.start_time || '';
  const endTime = collaboration.schedule?.end_time || '';
  const durationHours = collaboration.schedule?.duration_hours || '';

  // Location
  const locationCity = collaboration.location?.city || '';
  const locationAddress = collaboration.location?.address || locationCity || 'TBD';
  const locationNotes = collaboration.location?.notes || '';
  const locationType = collaboration.location?.type || '';

  // Compensation
  const compType = collaboration.compensation_type || '';
  const compAmount = collaboration.compensation_details?.amount
    ? `${collaboration.compensation_details.currency || 'USD'} ${collaboration.compensation_details.amount}`
    : '';
  const splitDetails = collaboration.compensation_details?.split_details || '';
  const compNotes = collaboration.compensation_details?.notes || '';

  // Deliverables
  const deliverablesArr = [];
  if (collaboration.deliverables?.photo) deliverablesArr.push('Photos');
  if (collaboration.deliverables?.video) deliverablesArr.push('Video');
  if (collaboration.deliverables?.raw_files) deliverablesArr.push('Raw Files');
  const deliverablesList = deliverablesArr.join(', ') || 'TBD';
  const deliveryTimeline = collaboration.deliverables?.delivery_timeline_days
    ? `${collaboration.deliverables.delivery_timeline_days} days`
    : '';

  // Usage rights
  const platforms = (collaboration.usage_rights?.platforms || []).join(', ');
  const exclusivity = collaboration.usage_rights?.exclusivity ? 'Yes' : 'No';
  const exclusivityPeriod = collaboration.usage_rights?.exclusivity_period_days
    ? `${collaboration.usage_rights.exclusivity_period_days} days`
    : '';
  const resaleAllowed = collaboration.usage_rights?.resale_allowed ? 'Yes' : 'No';
  const creditRequired = collaboration.usage_rights?.credit_required ? 'Credit required on all platforms' : 'Credit optional';

  // Scenes & acts
  const sceneTypes = (collaboration.scene_selected || []).join(', ');
  const acts = (collaboration.acts_selected || []).join(', ');
  const sceneType = collaboration.scene_type || '';
  const hardLimits = (collaboration.boundaries?.hard_no || []).join(', ');
  const softLimits = (collaboration.boundaries?.soft_limits || []).join(', ');

  // Effective date = today
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Context-derived role label
  let collaborationType = 'creator_to_creator';
  if (collaboration.studio_id) collaborationType = 'studio_contract';
  else if (collaboration.photographer_id) collaborationType = 'photographer_contract';
  else if (collaboration.videographer_id) collaborationType = 'videographer_contract';
  else if (collaboration.agent_id) collaborationType = 'agent_managed';

  const autoFilled = {
    // Core
    collaboration_name: collaboration.collaboration_name || '',
    collaboration_type: collaborationType,
    effective_date: today,
    scene_type: sceneType,
    project_type: sceneType || collaborationType,

    // Parties
    creator_names: creatorNames,
    creator_1_name: creatorProfiles[0]?.display_name || creatorProfiles[0]?.real_name || '',
    creator_2_name: creatorProfiles[1]?.display_name || creatorProfiles[1]?.real_name || '',
    all_participant_names: participantNames.join(', '),
    studio_name: studioName,
    agent_name: agentName,
    photographer_name: photographerProfile?.display_name || '',
    videographer_name: videographerProfile?.display_name || '',

    // Schedule
    shoot_date: scheduledDate,
    start_time: startTime,
    end_time: endTime,
    duration: durationHours ? `${durationHours} hours` : '',
    proposed_dates: proposedDates,

    // Location
    location: locationAddress,
    location_city: locationCity,
    location_type: locationType,
    location_notes: locationNotes,

    // Compensation
    compensation_type: compType,
    compensation_amount: compAmount,
    revenue_split: splitDetails,
    compensation_notes: compNotes,

    // Deliverables
    deliverables: deliverablesList,
    delivery_timeline: deliveryTimeline,
    editing_included: collaboration.deliverables?.editing_included ? 'Yes' : 'No',

    // Usage rights
    platforms,
    exclusivity,
    exclusivity_period: exclusivityPeriod,
    resale_allowed: resaleAllowed,
    credit_rules: creditRequired,

    // Scenes
    scene_types: sceneTypes,
    acts_agreed: acts,
    hard_limits: hardLimits,
    soft_limits: softLimits,
    aftercare_required: collaboration.boundaries?.aftercare_required ? 'Yes' : 'No',
    aftercare_notes: collaboration.boundaries?.aftercare_notes || '',

    // Post-production
    ownership_model: collaboration.usage_rights?.resale_allowed ? 'Joint ownership — resale permitted' : 'Creator retains ownership — no resale',
    ai_use_policy: 'No AI training or AI-generated derivatives without explicit written consent from all parties.',
    takedown_policy: 'Either party may request content removal within 30 days with 24-hour compliance window.',
  };

  return { autoFilled };
}

/**
 * Given a template's token_schema and resolved auto-filled values,
 * returns which tokens still need manual input.
 */
export function classifyTokens(tokenSchema, autoFilled) {
  const required = [];
  const optional = [];

  Object.entries(tokenSchema || {}).forEach(([key, schema]) => {
    const hasAuto = autoFilled[key] !== undefined && autoFilled[key] !== '';
    if (schema.required && !hasAuto) {
      required.push({ key, schema, autoValue: autoFilled[key] || '' });
    } else if (!hasAuto) {
      optional.push({ key, schema, autoValue: '' });
    }
    // if hasAuto and required — it's auto-filled, no manual input needed
  });

  return { required, optional };
}

/**
 * Determine if a template is applicable to a given collaboration context.
 * Returns { applicable, reason }
 */
export function isTemplateApplicable(template, collaboration) {
  if (!template.applicable_roles || template.applicable_roles.length === 0) {
    return { applicable: true, reason: 'Universal template' };
  }

  const context = [];
  if ((collaboration?.creator_ids || []).length >= 2) context.push('creator_to_creator');
  if (collaboration?.studio_id) context.push('studio_contract');
  if (collaboration?.photographer_id) context.push('photographer_contract');
  if (collaboration?.videographer_id) context.push('videographer_contract');
  if (collaboration?.agent_id) context.push('agent_managed');
  if (context.length === 0) context.push('creator_to_creator');

  const match = template.applicable_roles.some(r => context.includes(r));
  return {
    applicable: match,
    reason: match
      ? `Matches: ${context.filter(c => template.applicable_roles.includes(c)).join(', ')}`
      : `Template is for: ${template.applicable_roles.join(', ')} — this collaboration is: ${context.join(', ')}`,
  };
}

/**
 * Replace all {{token}} occurrences in template content with resolved values.
 */
export function applyTokensToContent(content, tokenValues) {
  let out = content || '';
  Object.entries(tokenValues).forEach(([key, val]) => {
    out = out.replace(new RegExp(`{{${key}}}`, 'g'), val || '');
  });
  return out;
}