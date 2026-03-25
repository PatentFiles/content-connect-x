import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Protected backend function for all profile-related mutations.
 * Enforces ban/suspend checks before executing create/update operations.
 * Routes: updateProfile, updateCreatorDetails, updateGallery, deleteGalleryItem
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    // Real-time ban/suspend check
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
    const profile = profiles[0];

    if (profile?.banned === true) {
      await base44.asServiceRole.entities.AdminActionLog.create({
        admin_id: 'SYSTEM_BAN_ENFORCEMENT',
        action_type: 'blocked_mutation_attempt',
        target_user_id: user.email,
        details: { action, reason: 'banned' },
        reason: `Blocked profile mutation attempt (${action})`
      }).catch(() => {});
      return Response.json({ error: 'Your account is banned' }, { status: 403 });
    }

    if (profile?.suspended === true) {
      await base44.asServiceRole.entities.AdminActionLog.create({
        admin_id: 'SYSTEM_BAN_ENFORCEMENT',
        action_type: 'blocked_mutation_attempt',
        target_user_id: user.email,
        details: { action, reason: 'suspended' },
        reason: `Blocked profile mutation attempt (${action})`
      }).catch(() => {});
      return Response.json({ error: 'Your account is suspended' }, { status: 403 });
    }

    // Execute action
    if (action === 'updateProfile') {
      const { profileId, data } = payload;
      // Strip privileged fields — users cannot self-modify ban/admin status
      const { banned, suspended, suspension_reason, legal_hold, is_admin, deletion_status, deleted_at, account_deactivated, ...safeData } = data || {};
      if (profileId) {
        return Response.json(await base44.entities.UserProfile.update(profileId, safeData));
      } else {
        return Response.json(await base44.entities.UserProfile.create({ ...safeData, user_id: user.email }));
      }
    }

    if (action === 'updateCreatorDetails') {
      const { detailsId, data } = payload;
      if (detailsId) {
        return Response.json(await base44.entities.CreatorDetails.update(detailsId, data));
      } else {
        return Response.json(await base44.entities.CreatorDetails.create({ ...data, user_id: user.email }));
      }
    }

    if (action === 'updateGallery') {
      const { galleryId, data } = payload;
      if (galleryId) {
        return Response.json(await base44.entities.Gallery.update(galleryId, data));
      } else {
        return Response.json(await base44.entities.Gallery.create({ ...data, user_id: user.email }));
      }
    }

    if (action === 'deleteGalleryItem') {
      const { galleryId, itemIndex } = payload;
      const gallery = await base44.entities.Gallery.list(); // Fallback if needed
      // This will be handled via Gallery.update in frontend
      return Response.json({ message: 'handled' });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});