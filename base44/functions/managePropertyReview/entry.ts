import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Manage property reviews: create, update, delete
 * Enforces eligibility: user must have completed booking/session for property
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, review_id, property_id, session_id, rating, review_text } = payload;

    if (action === 'create') {
      // Verify session belongs to user and is completed
      const session = await base44.entities.SoloSession.get(session_id);
      
      if (!session || session.guest_user_id !== user.email) {
        return Response.json({ error: 'Session not found or unauthorized' }, { status: 403 });
      }

      if (session.status !== 'completed') {
        return Response.json({ error: 'Session must be completed to review' }, { status: 403 });
      }

      if (session.property_id !== property_id) {
        return Response.json({ error: 'Session does not match property' }, { status: 403 });
      }

      // Check for duplicate review
      const existing = await base44.entities.PropertyReview.filter({
        property_id,
        session_id,
        reviewer_user_id: user.email,
      });

      if (existing.length > 0) {
        return Response.json({ error: 'Already reviewed this booking' }, { status: 409 });
      }

      // Create review
      const review = await base44.entities.PropertyReview.create({
        property_id,
        session_id,
        reviewer_user_id: user.email,
        rating: Math.min(Math.max(rating, 1), 5),
        review_text: review_text?.trim() || '',
        verified: true,
        status: 'active',
      });

      return Response.json({ success: true, review });
    } else if (action === 'update') {
      // Only user who created review can update
      const review = await base44.entities.PropertyReview.get(review_id);

      if (!review || review.reviewer_user_id !== user.email) {
        return Response.json({ error: 'Review not found or unauthorized' }, { status: 403 });
      }

      const updated = await base44.entities.PropertyReview.update(review_id, {
        rating: Math.min(Math.max(rating, 1), 5),
        review_text: review_text?.trim() || '',
      });

      return Response.json({ success: true, review: updated });
    } else if (action === 'delete') {
      // Only user who created review or admin can delete
      const review = await base44.entities.PropertyReview.get(review_id);

      if (!review) {
        return Response.json({ error: 'Review not found' }, { status: 404 });
      }

      if (review.reviewer_user_id !== user.email) {
        // Check admin status
        const profile = await base44.entities.UserProfile.filter({ user_id: user.email });
        if (!profile[0]?.is_admin) {
          return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }
      }

      await base44.entities.PropertyReview.delete(review_id);
      return Response.json({ success: true });
    } else if (action === 'moderate') {
      // Admin-only: hide or remove reviews
      const review = await base44.entities.PropertyReview.get(review_id);

      if (!review) {
        return Response.json({ error: 'Review not found' }, { status: 404 });
      }

      const profile = await base44.entities.UserProfile.filter({ user_id: user.email });
      if (!profile[0]?.is_admin) {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }

      const updated = await base44.entities.PropertyReview.update(review_id, {
        status: payload.status || 'hidden',
      });

      return Response.json({ success: true, review: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});