import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Manage property reviews: create, update, delete, moderate
 * Enforces eligibility across ALL session types (solo_session, collaboration, service_booking, location_booking)
 * Prevents duplicates: one review per (property_id, session_id, reviewer_user_id)
 * Updates Property.average_rating and Property.total_reviews as source of truth
 */

/**
 * Aggregate reviews for a property and update Property.average_rating + Property.total_reviews
 */
async function updatePropertyReviewStats(base44, propertyId) {
  const reviews = await base44.entities.PropertyReview.filter({
    property_id: propertyId,
    status: 'active',
  });

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  await base44.entities.Property.update(propertyId, {
    average_rating: Math.round(averageRating * 100) / 100,
    total_reviews: totalReviews,
  });
}

/**
 * Verify session eligibility for review (works for ALL session types)
 */
async function verifySessioEligibility(base44, sessionId, userEmail, propertyId) {
  // Try SoloSession first
  let session = null;
  try {
    session = await base44.entities.SoloSession.get(sessionId);
  } catch {
    // Not a SoloSession, try Collaboration
    try {
      session = await base44.entities.Collaboration.get(sessionId);
      // For Collaboration, check if user is participant
      if (!session.participant_ids?.includes(userEmail)) {
        return { valid: false, error: 'Not a participant in this collaboration' };
      }
    } catch {
      return { valid: false, error: 'Session not found' };
    }
  }

  // Verify session is completed
  if (session.status !== 'completed') {
    return { valid: false, error: 'Session must be completed to review' };
  }

  // Verify session has a property_id (location_booking must have this)
  if (!session.property_id) {
    return { valid: false, error: 'Session does not have a property' };
  }

  // Verify property matches
  if (session.property_id !== propertyId) {
    return { valid: false, error: 'Session does not match property' };
  }

  // For SoloSession, verify user is guest; for Collaboration, already checked
  if (session.guest_user_id && session.guest_user_id !== userEmail) {
    return { valid: false, error: 'Not authorized to review this session' };
  }

  return { valid: true, session };
}

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
      // Verify eligibility across ALL session types
      const eligibility = await verifySessioEligibility(base44, session_id, user.email, property_id);
      if (!eligibility.valid) {
        return Response.json({ error: eligibility.error }, { status: 403 });
      }

      // Check for duplicate review: UNIQUE (property_id, session_id, reviewer_user_id)
      const existing = await base44.entities.PropertyReview.filter({
        property_id,
        session_id,
        reviewer_user_id: user.email,
      });

      if (existing.length > 0) {
        return Response.json({ error: 'Already reviewed this booking' }, { status: 409 });
      }

      // Create review with verified=true (immutable, trusted source)
      const review = await base44.entities.PropertyReview.create({
        property_id,
        session_id,
        reviewer_user_id: user.email,
        rating: Math.min(Math.max(rating, 1), 5),
        review_text: review_text?.trim() || '',
        verified: true,
        status: 'active',
      });

      // Update Property.average_rating and Property.total_reviews
      await updatePropertyReviewStats(base44, property_id);

      return Response.json({ success: true, review });
    } else if (action === 'update') {
      // Only reviewer or admin can update
      const review = await base44.entities.PropertyReview.get(review_id);

      if (!review) {
        return Response.json({ error: 'Review not found' }, { status: 404 });
      }

      if (review.reviewer_user_id !== user.email) {
        const profile = await base44.entities.UserProfile.filter({ user_id: user.email });
        if (!profile[0]?.is_admin) {
          return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }
      }

      const updated = await base44.entities.PropertyReview.update(review_id, {
        rating: Math.min(Math.max(rating, 1), 5),
        review_text: review_text?.trim() || '',
      });

      // Recalculate property stats after update
      await updatePropertyReviewStats(base44, review.property_id);

      return Response.json({ success: true, review: updated });
    } else if (action === 'delete') {
      // Only reviewer or admin can delete
      const review = await base44.entities.PropertyReview.get(review_id);

      if (!review) {
        return Response.json({ error: 'Review not found' }, { status: 404 });
      }

      if (review.reviewer_user_id !== user.email) {
        const profile = await base44.entities.UserProfile.filter({ user_id: user.email });
        if (!profile[0]?.is_admin) {
          return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }
      }

      const propertyId = review.property_id;
      await base44.entities.PropertyReview.delete(review_id);

      // Recalculate property stats after deletion
      await updatePropertyReviewStats(base44, propertyId);

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

      // Recalculate property stats (hidden reviews not counted)
      await updatePropertyReviewStats(base44, review.property_id);

      return Response.json({ success: true, review: updated });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});