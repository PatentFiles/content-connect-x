/** Explicit routing: helpers, tests and deployment inventories share this allowlist. */
export const HOST_DISCOVERY_ACTIONS=new Set(['listing_thumbnails','host_market_overview','host_media_page','property_media_page','host_photos_register']);
export const hostingEndpoint=action=>HOST_DISCOVERY_ACTIONS.has(action)?'hosting-discovery':'hosting-marketplace';
