/** Shared module registry. Visibility and authorization are deliberately distinct. */
export const MODULE_FEATURES=Object.freeze({
 directory:'creator_discovery',search:'search',favorites:'favorites',connections:'connections',messages:'messages',collaborations:'collaborations',
 invitations:'collaborations',workspace:'collaborations',contracts:'contracts',testing:'testing',trust:'testing',hosting:'hosting_marketplace',
 host:'hosting_marketplace','host-settings':'hosting_marketplace',schedule:'availability',production:'production_manager',roster:'roster',
 representations:'roster',portfolio:'portfolio',media:'media_gallery',community:'community_feed',feedback:'product_feedback',reputation:'verified_reviews',agreements:'contracts'
});
export const featureForTab=tab=>MODULE_FEATURES[tab]||null;
export const isModuleEnabled=(tab,flags)=>!featureForTab(tab)||flags?.[featureForTab(tab)]===true;
// Missing/loading flags must not erase the original menu. Opening a page still
// uses isModuleEnabled, and backend policies independently authorize every action.
export const isModuleVisible=(tab,flags)=>!featureForTab(tab)||!flags||!(featureForTab(tab) in flags)||flags[featureForTab(tab)]===true;
