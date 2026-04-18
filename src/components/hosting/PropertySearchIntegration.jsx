/**
 * PropertySearchIntegration
 * 
 * This module documents the Property search support added to Search/Discovery.
 * 
 * **DESIGN NOTE**: Property records are currently searched/discovered via the
 * HostingMarketplace page (pages/HostingMarketplace.jsx), which fetches active
 * Property records separately from user profile search.
 * 
 * Search and Discovery pages search UserProfile records (which include video_editor role).
 * Host properties are exposed via the dedicated Hosting Marketplace tab/page.
 * 
 * Property search backend is live and functional in HostingMarketplace:
 * - Filters by city, property_type, price, amenities
 * - Searches title, description, city
 * 
 * If future UX requests unified search results merging profiles + properties,
 * extend Search/Discovery to query Property entity and merge results below profiles.
 */

export const PROPERTY_SEARCH_FIELDS = ['title', 'city', 'state', 'property_type', 'description', 'amenities'];

export const PROPERTY_FILTERS = {
  city: { type: 'text', operator: 'lowercase_includes' },
  property_type: { type: 'select', options: ['studio', 'loft', 'house', 'rooftop', 'warehouse'] },
  minPrice: { type: 'number', field: 'pricing.hourly_rate', operator: 'gte' },
  maxPrice: { type: 'number', field: 'pricing.hourly_rate', operator: 'lte' },
};