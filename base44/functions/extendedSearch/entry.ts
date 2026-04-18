import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Extended search: unified profiles + properties with admin-configurable relevance scoring
 * Returns single sorted array: [{ type, score, ... }, ...]
 */
async function loadRankingConfig(base44) {
  // Load ranking weights from feature flags
  const defaults = {
    title_weight: 5,
    city_weight: 2,
    description_weight: 1,
    role_weight: 2,
    exact_match_boost: 5,
    property_boost: 0,
    profile_boost: 0,
    pro_host_boost: 2,
    high_reputation_boost: 2,
    rating_weight: 1,
    review_volume_weight: 0.5,
  };

  try {
    const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
    const config = {};
    
    Object.keys(defaults).forEach(key => {
      const flagKey = `search_ranking_${key}`;
      const flag = flags.find(f => f.flag_key === flagKey);
      config[key] = flag?.number_value ?? defaults[key];
    });

    return config;
  } catch {
    return defaults;
  }
}

function scoreResult(item, query, type, rankingConfig, reviews = {}) {
  let score = 0;
  const q = query.toLowerCase().trim();
  
  if (!q) {
    score = 1;
  } else {
    // Type-specific weighting
    if (type === 'property') {
      const title = item.title?.toLowerCase() || '';
      const city = item.city?.toLowerCase() || '';
      const description = item.description?.toLowerCase() || '';
      const propType = item.property_type?.toLowerCase() || '';

      if (title === q) score += rankingConfig.exact_match_boost;
      if (title.includes(q)) score += rankingConfig.title_weight;
      if (title.startsWith(q)) score += 3;
      if (city.includes(q)) score += rankingConfig.city_weight;
      if (propType.includes(q)) score += rankingConfig.description_weight;
      if (description.includes(q)) score += rankingConfig.description_weight;
    } else if (type === 'profile') {
      const name = item.display_name?.toLowerCase() || '';
      const bio = item.bio?.toLowerCase() || '';
      const city = item.base_location?.city?.toLowerCase() || '';

      if (name === q) score += rankingConfig.exact_match_boost;
      if (name.includes(q)) score += rankingConfig.title_weight;
      if (name.startsWith(q)) score += 3;
      if (city.includes(q)) score += rankingConfig.city_weight;
      if (bio.includes(q)) score += rankingConfig.description_weight;
      
      score += rankingConfig.role_weight;
    }
  }

  // Type-based boosts
  score += type === 'property' ? rankingConfig.property_boost : rankingConfig.profile_boost;

  // Pro host boost
  if (type === 'property' && item.pro_host) {
    score += rankingConfig.pro_host_boost;
  }

  // High reputation boost
  if (item.average_rating && item.average_rating >= 4.5) {
    score += rankingConfig.high_reputation_boost;
  }

  // Review signals with CAPPED scoring (prevent review spam dominance)
  if (type === 'property' && reviews && reviews[item.id]) {
    const { average_rating, total_reviews } = reviews[item.id];
    const MAX_RATING_SCORE = 10;   // Cap rating contribution
    const MAX_VOLUME_SCORE = 8;    // Cap volume contribution
    
    if (average_rating) {
      const ratingScore = Math.min(average_rating * rankingConfig.rating_weight, MAX_RATING_SCORE);
      score += ratingScore;
    }
    if (total_reviews) {
      const volumeScore = Math.min(Math.log(total_reviews + 1) * rankingConfig.review_volume_weight, MAX_VOLUME_SCORE);
      score += volumeScore;
    }
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

    // Load ranking config
    const rankingConfig = await loadRankingConfig(base44);

    // Load reviews with integrity filtering
    let reviewsMap = {};
    try {
      const reviews = await base44.asServiceRole.entities.PropertyReview.list('-created_date', 1000);
      const activeReviews = reviews.filter(r => r.status === 'active');
      
      activeReviews.forEach(review => {
        if (!reviewsMap[review.property_id]) {
          reviewsMap[review.property_id] = { ratings: [], count: 0, lastReview: null };
        }
        
        // Apply integrity score if review_integrity_enabled (filter low-integrity reviews from ranking)
        const integrityScore = review.review_integrity_score || 1.0;
        if (rankingConfig.review_integrity_enabled && integrityScore < 0.1) {
          // Skip this review (flagged as spam)
          return;
        }
        
        // Weight review by integrity score
        const weightedRating = review.rating * integrityScore;
        reviewsMap[review.property_id].ratings.push(weightedRating);
        reviewsMap[review.property_id].count += 1;
        
        // Track most recent review
        if (!reviewsMap[review.property_id].lastReview || 
            new Date(review.created_at) > new Date(reviewsMap[review.property_id].lastReview)) {
          reviewsMap[review.property_id].lastReview = review.created_at;
        }
      });

      // Calculate average ratings (weighted by integrity) and capture last_review_at
      Object.keys(reviewsMap).forEach(propertyId => {
        const data = reviewsMap[propertyId];
        data.average_rating = data.ratings.length > 0 
          ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length 
          : 0;
        data.total_reviews = data.count;
        data.last_review_at = data.lastReview;
      });
    } catch {
      // Reviews not available, continue without them
    }

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
        score: scoreResult(p, query, 'profile', rankingConfig),
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
        score: scoreResult(p, query, 'property', rankingConfig, reviewsMap),
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
        average_rating: reviewsMap[p.id]?.average_rating,
        total_reviews: reviewsMap[p.id]?.total_reviews,
      })));
    }

    // Sort by score descending, then return
    const sorted = results.sort((a, b) => b.score - a.score).slice(0, limit);

    return Response.json({ results: sorted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});