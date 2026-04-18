import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, property } = payload;

    // Fetch user profile
    const profiles = await base44.entities.UserProfile.filter({ user_id: user.email });
    const profile = profiles[0];

    // Host eligibility check
    const isHostEligible = profile?.host_account_active === true && profile?.host_terms_accepted_at;
    
    if (!isHostEligible) {
      return Response.json({
        error: 'Host onboarding required before creating a property',
        code: 'HOST_NOT_ELIGIBLE',
      }, { status: 403 });
    }

    // Create property
    if (action === 'create') {
      const newProperty = await base44.entities.Property.create({
        ...property,
        owner_user_id: user.email,
        status: property.status || 'draft',
      });
      return Response.json({ property: newProperty });
    }

    // Update property
    if (action === 'update') {
      if (property.id) {
        // Verify ownership
        const existing = await base44.entities.Property.filter({ id: property.id });
        if (existing[0]?.owner_user_id !== user.email) {
          return Response.json({ error: 'Forbidden: Not property owner' }, { status: 403 });
        }

        const updated = await base44.entities.Property.update(property.id, property);
        return Response.json({ property: updated });
      }
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});