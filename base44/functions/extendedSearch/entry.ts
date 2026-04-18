import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Extended search: returns both profiles and properties
 * Merges results with type field for frontend routing
 */
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
    const q = query.toLowerCase();

    // Search profiles (users)
    if (!payload.typeFilter || payload.typeFilter === 'profile') {
      const profiles = await base44.entities.UserProfile.list('-updated_date', 100);
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
        )
        .slice(0, limit);

      results.push(...filtered.map(p => ({
        type: 'profile',
        id: p.id,
        user_id: p.user_id,
        display_name: p.display_name,
        role_type: p.role_type,
        avatar_url: p.avatar_url,
        city: p.base_location?.city,
        verified: false, // would be populated from VerificationRecord
      })));
    }

    // Search properties
    if (!payload.typeFilter || payload.typeFilter === 'property') {
      const properties = await base44.entities.Property.list('-updated_date', 100);
      const filtered = properties
        .filter(p =>
          p.status === 'active' &&
          (q === '' ||
            p.title?.toLowerCase().includes(q) ||
            p.city?.toLowerCase().includes(q) ||
            p.property_type?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q))
        )
        .slice(0, limit);

      results.push(...filtered.map(p => ({
        type: 'property',
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

    return Response.json({ results: results.slice(0, limit) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});