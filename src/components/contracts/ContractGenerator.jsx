
// Contract generation utility function
export function generateContractFromCollaboration(collaboration, template) {
  // Build parties array
  const parties = [];
  
  if (collaboration.creator_ids) {
    collaboration.creator_ids.forEach(email => {
      parties.push({
        role_type: 'creator',
        email,
        legal_name: '',
        stage_name: email,
      });
    });
  }
  
  if (collaboration.studio_id) {
    parties.push({
      role_type: 'studio',
      email: collaboration.studio_id,
      company_name: '',
    });
  }
  
  if (collaboration.agent_id) {
    parties.push({
      role_type: 'agent',
      email: collaboration.agent_id,
      company_name: '',
    });
  }
  
  if (collaboration.photographer_id) {
    parties.push({
      role_type: 'photographer',
      email: collaboration.photographer_id,
    });
  }
  
  if (collaboration.videographer_id) {
    parties.push({
      role_type: 'videographer',
      email: collaboration.videographer_id,
    });
  }

  // Build scenes array
  const scenes = [];
  if (collaboration.scene_selected?.length > 0) {
    collaboration.scene_selected.forEach(sceneType => {
      scenes.push({
        title: sceneType,
        description: '',
        performers: collaboration.creator_ids || [],
        acts: collaboration.acts_selected || [],
        boundaries: collaboration.boundaries || {},
        notes: '',
      });
    });
  }

  // Build post-scene rules
  const postSceneRules = {
    editing_rules: collaboration.deliverables?.editing_included ? 'Editing included in agreement' : 'Raw files only',
    posting_rules: collaboration.usage_rights?.exclusivity ? 'Exclusive rights period applies' : 'Non-exclusive usage',
    ownership_model: collaboration.usage_rights?.resale_allowed ? 'Resale permitted' : 'No resale',
    ownership_split: collaboration.compensation_details?.split_details || '',
    revenue_split: {},
    platforms: collaboration.usage_rights?.platforms || [],
    embargo_until: collaboration.usage_rights?.exclusivity_period_days 
      ? new Date(Date.now() + collaboration.usage_rights.exclusivity_period_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null,
    takedown_policy: 'Standard 24-hour takedown upon request',
    crediting_rules: collaboration.usage_rights?.credit_required ? 'Credit required on all platforms' : 'Credit optional',
    ai_use_policy: 'No AI training without explicit consent',
  };

  // Populate template content with tokens
  let bodyHtml = template?.content || '';
  
  // Replace legacy placeholders
  bodyHtml = bodyHtml.replace(/\{collaboration_name\}/g, collaboration.collaboration_name || 'Untitled Collaboration');
  bodyHtml = bodyHtml.replace(/\{scene_type\}/g, collaboration.scene_type || 'standard');
  bodyHtml = bodyHtml.replace(/\{compensation\}/g, collaboration.compensation_type || 'paid');
  bodyHtml = bodyHtml.replace(/\{location\}/g, collaboration.location?.city || 'TBD');
  bodyHtml = bodyHtml.replace(/\{deliverables\}/g, collaboration.deliverables?.photo ? 'Photos & Video' : 'Video');
  
  // Replace structured tokens
  bodyHtml = bodyHtml.replace(/\{\{effective_date\}\}/g, new Date().toLocaleDateString());
  bodyHtml = bodyHtml.replace(/\{\{collaboration\.name\}\}/g, collaboration.collaboration_name || 'Untitled');
  bodyHtml = bodyHtml.replace(/\{\{collaboration\.location\.full_address\}\}/g, 
    collaboration.location?.address || collaboration.location?.city || 'TBD');
  
  if (parties.length > 0) {
    bodyHtml = bodyHtml.replace(/\{\{parties\.creators\[0\]\.stage_name\}\}/g, parties[0]?.stage_name || '');
    bodyHtml = bodyHtml.replace(/\{\{parties\.creators\[0\]\.legal_name\}\}/g, parties[0]?.legal_name || '');
  }
  
  if (parties.find(p => p.role_type === 'studio')) {
    bodyHtml = bodyHtml.replace(/\{\{parties\.studio_producer\.company_name\}\}/g, 
      parties.find(p => p.role_type === 'studio')?.company_name || '');
  }
  
  if (scenes.length > 0) {
    bodyHtml = bodyHtml.replace(/\{\{scenes\[0\]\.title\}\}/g, scenes[0]?.title || '');
    bodyHtml = bodyHtml.replace(/\{\{scenes\[0\]\.performers\}\}/g, scenes[0]?.performers?.join(', ') || '');
    bodyHtml = bodyHtml.replace(/\{\{scenes\[0\]\.acts\}\}/g, scenes[0]?.acts?.join(', ') || '');
  }
  
  bodyHtml = bodyHtml.replace(/\{\{post_scene_rules\.ownership_model\}\}/g, postSceneRules.ownership_model);
  bodyHtml = bodyHtml.replace(/\{\{post_scene_rules\.revenue_split\}\}/g, postSceneRules.ownership_split);

  return {
    parties,
    scenes,
    post_scene_rules: postSceneRules,
    body_html: bodyHtml,
    body_markdown: bodyHtml, // For now, same content
    structured_snapshot: {
      parties,
      scenes,
      post_scene_rules: postSceneRules,
      collaboration_meta: {
        name: collaboration.collaboration_name,
        scene_type: collaboration.scene_type,
        compensation_type: collaboration.compensation_type,
        schedule: collaboration.schedule,
      },
    },
  };
}

export default function ContractGenerator() {
  return null; // Utility component, no UI
}