import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Extended search: unified profiles + properties with relevance scoring
 * Returns single sorted array: [{ type, score, ... }, ...]
 */
function scoreResult(item, query, type) {
  let score = 0;
  const q = query.toLowerCase().trim();
  if (!q) return 1; // Default score if no query

  // Type-specific weighting
  if (type === 'property') {
    const title = item.title?.toLowerCase() || '';
    const city = item.city?.toLowerCase() || '';
    const description = item.description?.toLowerCase() || '';
    const propType = item.property_type?.toLowerCase() || '';

    if (title.includes(q)) score += 5; // Exact match in title
    if (title.startsWith(q)) score += 3;
    if (city.includes(q)) score += 2;
    if (propType.includes(q)) score += 2;
    if (description.includes(q)) score += 1;
  } else if (type === 'profile') {
    const name = item.display_name?.toLowerCase() || '';
    const bio = item.bio?.toLowerCase() || '';
    const city = item.base_location?.city?.toLowerCase() || '';

    if (name.includes(q)) score += 5;
    if (name.startsWith(q)) score += 3;
    if (city.includes(q)) score += 2;
    if (bio.includes(q)) score += 1;
  }

  return Math.max(score, 0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { query = '', limit = 50 } = payload;

    const results = [];

    // Search profiles (users)
    if (!payload.typeFilter || payload.typeFilter === 'profile') {
      const profiles = await base44.entities.UserProfile.list('-updated_date', 100);
      const q = query.toLowerCase();
      const filtered = profiles
        .filter(p =>
          !p.is_admin &&
          p.profile_complete &&
          !p.banned &&
          !p.account_deactivated &&
          p.deletion_status !== 'anonymized' &&
          p.deletion_status !== 'completed' &&
          (q === '' || 
            p.display_name?.toLowerCase().includes(q) ||
            p.bio?.toLowerCase().includes(q) ||
            p.base_location?.city?.toLowerCase().includes(q))
        );

      results.push(...filtered.map(p => ({
        type: 'profile',
        score: scoreResult(p, query, 'profile'),
        id: p.id,
        user_id: p.user_id,
        display_name: p.display_name,
        role_type: p.role_type,
        avatar_url: p.avatar_url,
        city: p.base_location?.city,
        verified: false,
      })));
    }

    // Search properties
    if (!payload.typeFilter || payload.typeFilter === 'property') {
      const properties = await base44.entities.Property.list('-updated_date', 100);
      const q = query.toLowerCase();
      const filtered = properties
        .filter(p =>
          p.status === 'active' &&
          (q === '' ||
            p.title?.toLowerCase().includes(q) ||
            p.city?.toLowerCase().includes(q) ||
            p.property_type?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q))
        );

      results.push(...filtered.map(p => ({
        type: 'property',
        score: scoreResult(p, query, 'property'),
        id: p.id,
        property_id: p.id,
        title: p.title,
        property_type: p.property_type,
        city: p.city,
        state: p.state,
        country: p.country,
        owner_user_id: p.owner_user_id,
        pricing: p.pricing,
        media: p.media,
      })));
    }

    // Sort by score descending, then return
    const sorted = results.sort((a, b) => b.score - a.score).slice(0, limit);

    return Response.json({ results: sorted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});