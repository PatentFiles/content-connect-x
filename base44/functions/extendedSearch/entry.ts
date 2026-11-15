import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Extended search: unified profiles + properties with admin-configurable relevance scoring.
 * Returns single sorted array: [{ type, score, ... }, ...]
 * 
 * Rating source: uses ONLY Property.average_rating and Property.total_reviews (stored aggregates).
 * No live review aggregation — single source of truth, consistent with managePropertyReview.
 */
async function loadRankingConfig(base44) {
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
    featured_property_boost: 5,
    verified_property_boost: 3,
    freshness_boost: 2,
    max_rating_score: 10,
    max_volume_score: 8,
    review_recency_enabled: false,
    review_integrity_enabled: false,
    ranking_boosts_enabled: false,
    recency_weight_7_days: 1.5,
    recency_weight_30_days: 1.2,
    recency_weight_90_days: 1.0,
    recency_weight_default: 0.7,
  };

  try {
    const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
    const config = {};
    Object.keys(defaults).forEach(key => {
      const flagKey = `search_ranking_${key}`;
      const flag = flags.find(f => f.flag_key === flagKey);
      if (flag?.bool_value !== undefined && flag.value_type === 'boolean') {
        config[key] = flag.bool_value;
      } else if (flag?.number_value !== undefined) {
        config[key] = flag.number_value;
      } else {
        config[key] = defaults[key];
      }
    });
    return config;
  } catch {
    return defaults;
  }
}

function getRecencyMultiplier(lastReviewAt, rankingConfig) {
  if (!lastReviewAt) return 1.0;
  const ageDays = (Date.now() - new Date(lastReviewAt).getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays <= 7) return rankingConfig.recency_weight_7_days || 1.5;
  if (ageDays <= 30) return rankingConfig.recency_weight_30_days || 1.2;
  if (ageDays <= 90) return rankingConfig.recency_weight_90_days || 1.0;
  return rankingConfig.recency_weight_default || 0.7;
}

/**
 * Score a result using ONLY stored Property aggregates (average_rating, total_reviews, last_review_at).
 * No live review data is loaded — single source of truth.
 */
function scoreResult(item, query, type, rankingConfig) {
  let score = 0;
  const q = query.toLowerCase().trim();

  if (!q) {
    score = 1;
  } else {
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

  if (type === 'property') {
    // Monetization / ranking boosts (enabled by ranking_boosts_enabled flag)
    if (rankingConfig.ranking_boosts_enabled) {
      if (item.pro_host) score += rankingConfig.pro_host_boost;
      if (item.is_featured) score += rankingConfig.featured_property_boost;
    }

    // High-rating boost: uses stored Property.average_rating
    if (item.average_rating && item.average_rating >= 4.5 && rankingConfig.ranking_boosts_enabled) {
      score += rankingConfig.verified_property_boost;
    }

    // Review signals using stored aggregates only (single source of truth)
    const avgRating = item.average_rating || 0;
    const totalReviews = item.total_reviews || 0;
    const lastReviewAt = item.last_review_at || null;

    if (avgRating > 0) {
      const MAX_RATING_SCORE = rankingConfig.max_rating_score || 10;
      let recencyMult = 1.0;
      if (rankingConfig.review_recency_enabled && lastReviewAt) {
        recencyMult = getRecencyMultiplier(lastReviewAt, rankingConfig);
      }
      const ratingScore = Math.min(avgRating * rankingConfig.rating_weight, MAX_RATING_SCORE) * recencyMult;
      score += ratingScore;
    }

    if (totalReviews > 0) {
      const MAX_VOLUME_SCORE = rankingConfig.max_volume_score || 8;
      const volumeScore = Math.min(Math.log(totalReviews + 1) * rankingConfig.review_volume_weight, MAX_VOLUME_SCORE);
      score += volumeScore;
    }

    // Freshness boost: last review within 30 days
    if (lastReviewAt) {
      const daysSinceReview = (Date.now() - new Date(lastReviewAt).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceReview <= 30) {
        score += rankingConfig.freshness_boost || 2;
      }
    }
  }

  return Math.max(score, 0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const query = typeof payload.query === 'string' ? payload.query.slice(0, 120) : '';
    const subs = await base44.asServiceRole.entities.Subscription.filter({ user_id: user.email });
    const isAdmin = user.role === 'admin';
    const subscribed = isAdmin || subs.some(s => ['active', 'trial'].includes(s.status));
    // The verified-free tier gets a limited, read-only public-field preview.
    const limit = Math.max(1, Math.min(Number(payload.limit) || 50, subscribed ? 100 : 12));
    if (!isAdmin) {
      const ownVerification = await base44.asServiceRole.entities.VerificationRecord.filter({ user_id: user.email });
      if (!ownVerification.some(v => v.status === 'approved' && (!v.expires_at || Date.parse(v.expires_at) > Date.now()))) {
        return Response.json({ error: 'Age verification required' }, { status: 403 });
      }
    }
    const approved = await base44.asServiceRole.entities.VerificationRecord.list('-verified_at', 2000);
    const verifiedIds = new Set(approved.filter(v => v.status === 'approved' && (!v.expires_at || Date.parse(v.expires_at) > Date.now())).map(v => v.user_id));

    const rankingConfig = await loadRankingConfig(base44);
    const results = [];

    // Search profiles
    if (!payload.typeFilter || payload.typeFilter === 'profile') {
      const profiles = await base44.asServiceRole.entities.UserProfile.list('-updated_date', 500);
      const q = query.toLowerCase();
      const filtered = profiles.filter(p =>
        !p.is_admin &&
        p.profile_complete && verifiedIds.has(p.user_id) &&
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
        verified: true,
      })));
    }

    // Search properties — use stored aggregates (average_rating, total_reviews, last_review_at)
    if (!payload.typeFilter || payload.typeFilter === 'property') {
      const properties = await base44.asServiceRole.entities.Property.list('-updated_date', 300);
      const q = query.toLowerCase();
      const filtered = properties.filter(p =>
        p.status === 'active' &&
        (q === '' ||
          p.title?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.property_type?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q))
      );
      results.push(...filtered.map(p => ({
        type: 'property',
        score: scoreResult(p, query, 'property', rankingConfig),
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
        // Stored aggregates — single source of truth
        average_rating: p.average_rating || null,
        total_reviews: p.total_reviews || 0,
        last_review_at: p.last_review_at || null,
      })));
    }

    const sorted = results.sort((a, b) => b.score - a.score).slice(0, limit);
    return Response.json({ results: sorted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});