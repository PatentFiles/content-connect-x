import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Manage property reviews: create, update, delete, moderate
 * Enforces eligibility across ALL session types (solo_session, collaboration, service_booking, location_booking)
 * Prevents duplicates: one review per (property_id, session_id, reviewer_user_id)
 * Updates Property.average_rating and Property.total_reviews as source of truth
 */

/**
 * Calculate recency multiplier for a review based on age
 */
function getRecencyMultiplier(createdAt, recencyConfig) {
  if (!createdAt) return 1.0;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  
  if (ageDays <= 7) return recencyConfig.recency_weight_7_days || 1.5;
  if (ageDays <= 30) return recencyConfig.recency_weight_30_days || 1.2;
  if (ageDays <= 90) return recencyConfig.recency_weight_90_days || 1.0;
  return recencyConfig.recency_weight_default || 0.7;
}

/**
 * Aggregate reviews for a property with integrity & recency weighting
 * Property.average_rating is weighted aggregation: SUM(rating * integrity * recency) / SUM(integrity * recency)
 */
async function updatePropertyReviewStats(base44, propertyId, featureFlags = {}) {
  const reviews = await base44.entities.PropertyReview.filter({
    property_id: propertyId,
    status: 'active',
  });

  const totalReviews = reviews.length;
  
  // Get config defaults
  const recencyEnabled = featureFlags.review_recency_enabled !== false;
  const integrityEnabled = featureFlags.review_integrity_enabled !== false;
  const recencyConfig = {
    recency_weight_7_days: featureFlags.recency_weight_7_days || 1.5,
    recency_weight_30_days: featureFlags.recency_weight_30_days || 1.2,
    recency_weight_90_days: featureFlags.recency_weight_90_days || 1.0,
    recency_weight_default: featureFlags.recency_weight_default || 0.7,
  };

  let averageRating = 0;
  if (totalReviews > 0) {
    let weightedSum = 0;
    let weightSum = 0;
    
    reviews.forEach(r => {
      const integrity = integrityEnabled ? (r.review_integrity_score || 1.0) : 1.0;
      const recency = recencyEnabled ? getRecencyMultiplier(r.created_at, recencyConfig) : 1.0;
      const weight = integrity * recency;
      
      weightedSum += r.rating * weight;
      weightSum += weight;
    });
    
    averageRating = weightSum > 0 ? weightedSum / weightSum : 0;
  }

  // Count recent reviews (within last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentReviews = reviews.filter(r => r.created_at > thirtyDaysAgo);
  const recentReviewCount = recentReviews.length;

  // Get last review date
  const lastReviewAt = reviews.length > 0
    ? reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
    : null;

  await base44.entities.Property.update(propertyId, {
    average_rating: Math.round(averageRating * 100) / 100,
    total_reviews: totalReviews,
    recent_review_count: recentReviewCount,
    last_review_at: lastReviewAt,
  });
}

/**
 * Verify session eligibility for review (works for ALL session types)
 */
async function verifySessionEligibility(base44, sessionId, userEmail, propertyId) {
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
      const eligibility = await verifySessionEligibility(base44, session_id, user.email, property_id);
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

      // Check rate limit: max reviews per 24h (configurable, default 5)
      try {
        const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
        const maxReviewsPer24h = flags.find(f => f.flag_key === 'review_max_submissions_per_24h')?.number_value || 5;
        const rateLimitEnabled = flags.find(f => f.flag_key === 'review_rate_limit_enabled')?.bool_value !== false;
        
        if (rateLimitEnabled) {
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const userReviewsLast24h = await base44.entities.PropertyReview.filter({
            reviewer_user_id: user.email,
          }, '-created_at', 100);
          const recentCount = userReviewsLast24h.filter(r => r.created_at > twentyFourHoursAgo).length;
          
          if (recentCount >= maxReviewsPer24h) {
            return Response.json({ error: `Rate limit: max ${maxReviewsPer24h} reviews per 24 hours` }, { status: 429 });
          }
        }
      } catch {
        // Proceed if rate limit check fails
      }

      // Get reviewer's role type for badge display
      const reviewer = await base44.entities.UserProfile.filter({ user_id: user.email });
      const reviewerRoleType = reviewer[0]?.role_type || 'creator';

      // Detect integrity flags (lightweight check for manipulation)
      const integrityFlags = [];
      const userRecentReviews = await base44.entities.PropertyReview.filter({
        reviewer_user_id: user.email,
      }, '-created_date', 100);
      
      // Check for rapid review velocity (multiple reviews within 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const reviewsInLastHour = userRecentReviews.filter(r => r.created_at > oneHourAgo);
      if (reviewsInLastHour.length >= 2) {
        integrityFlags.push('user_review_velocity');
      }

      // Create review with verified=true (immutable, trusted source)
      const review = await base44.entities.PropertyReview.create({
        property_id,
        session_id,
        reviewer_user_id: user.email,
        reviewer_role_type: reviewerRoleType,
        rating: Math.min(Math.max(rating, 1), 5),
        review_text: review_text?.trim() || '',
        verified: true,
        status: 'active',
        review_integrity_score: integrityFlags.length > 0 ? 0.5 : 1.0,
        integrity_flags: integrityFlags,
        created_at: new Date().toISOString(),
      });

      // Get feature flags for aggregation
      try {
        const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
        const flagObj = {};
        flags.forEach(f => {
          if (f.flag_key.startsWith('review_') || f.flag_key.startsWith('recency_')) {
            flagObj[f.flag_key] = f.bool_value || f.number_value;
          }
        });
        await updatePropertyReviewStats(base44, property_id, flagObj);
      } catch {
        await updatePropertyReviewStats(base44, property_id);
      }

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

      // Check edit window for non-admins (default 24 hours)
      const profile = await base44.entities.UserProfile.filter({ user_id: user.email });
      if (review.reviewer_user_id === user.email && !profile[0]?.is_admin) {
        try {
          const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
          const editWindowHours = flags.find(f => f.flag_key === 'review_edit_window_hours')?.number_value || 24;
          const ageHours = (Date.now() - new Date(review.created_at).getTime()) / (60 * 60 * 1000);
          
          if (ageHours > editWindowHours) {
            return Response.json({ error: `Review can only be edited within ${editWindowHours} hours of creation` }, { status: 403 });
          }
        } catch {
          // Proceed if flag check fails
        }
      }

      const updated = await base44.entities.PropertyReview.update(review_id, {
        rating: Math.min(Math.max(rating, 1), 5),
        review_text: review_text?.trim() || '',
      });

      // Recalculate property stats after update
      try {
        const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
        const flagObj = {};
        flags.forEach(f => {
          if (f.flag_key.startsWith('review_') || f.flag_key.startsWith('recency_')) {
            flagObj[f.flag_key] = f.bool_value || f.number_value;
          }
        });
        await updatePropertyReviewStats(base44, review.property_id, flagObj);
      } catch {
        await updatePropertyReviewStats(base44, review.property_id);
      }

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
      try {
        const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
        const flagObj = {};
        flags.forEach(f => {
          if (f.flag_key.startsWith('review_') || f.flag_key.startsWith('recency_')) {
            flagObj[f.flag_key] = f.bool_value || f.number_value;
          }
        });
        await updatePropertyReviewStats(base44, propertyId, flagObj);
      } catch {
        await updatePropertyReviewStats(base44, propertyId);
      }

      return Response.json({ success: true });
    } else if (action === 'moderate') {
      // Admin-only: hide, remove, or flag reviews
      const review = await base44.entities.PropertyReview.get(review_id);

      if (!review) {
        return Response.json({ error: 'Review not found' }, { status: 404 });
      }

      const profile = await base44.entities.UserProfile.filter({ user_id: user.email });
      if (!profile[0]?.is_admin) {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }

      // Admin can update status, integrity score, and flags
      const updateData = { status: payload.status || review.status };
      if (payload.review_integrity_score !== undefined) {
        updateData.review_integrity_score = Math.max(0, Math.min(1, payload.review_integrity_score));
      }
      if (payload.integrity_flags) {
        updateData.integrity_flags = payload.integrity_flags;
      }

      const updated = await base44.entities.PropertyReview.update(review_id, updateData);

      // Recalculate property stats (hidden/low-integrity reviews affect aggregation)
      try {
        const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
        const flagObj = {};
        flags.forEach(f => {
          if (f.flag_key.startsWith('review_') || f.flag_key.startsWith('recency_')) {
            flagObj[f.flag_key] = f.bool_value || f.number_value;
          }
        });
        await updatePropertyReviewStats(base44, review.property_id, flagObj);
      } catch {
        await updatePropertyReviewStats(base44, review.property_id);
      }

      return Response.json({ success: true, review: updated });
    } else if (action === 'list_suspicious') {
      // Admin-only: list flagged reviews
      const profile = await base44.entities.UserProfile.filter({ user_id: user.email });
      if (!profile[0]?.is_admin) {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }

      try {
        const allReviews = await base44.asServiceRole.entities.PropertyReview.list('-created_date', 1000);
        const suspicious = allReviews.filter(r => 
          r.integrity_flags?.length > 0 || 
          (r.review_integrity_score !== undefined && r.review_integrity_score < 1.0)
        );
        
        return Response.json({ reviews: suspicious });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});