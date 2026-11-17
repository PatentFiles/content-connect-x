/**
 * Feature-to-page registry for the Bolt React application.
 * A false/unavailable server flag hides a module everywhere, including direct
 * deep links. Core account, verification, safety and admin settings stay visible.
 * All sensitive actions must ALSO be authorized by their Supabase Edge Function.
 */
export const MODULE_FEATURES = Object.freeze({
 directory:'creator_discovery',search:'search',favorites:'favorites',
 connections:'connections',messages:'messages',collaborations:'collaborations',
 invitations:'collaborations',workspace:'collaborations',contracts:'contracts',
 testing:'testing',trust:'testing',hosting:'hosting_marketplace',
 host:'hosting_marketplace','host-settings':'hosting_marketplace',
 schedule:'availability',production:'production_manager',roster:'roster',
 representations:'representations',portfolio:'media_gallery',media:'media_gallery',
 community:'community_feed',feedback:'product_feedback',reputation:'verified_reviews',
 agreements:'contracts'
});
export const featureForTab=tab=>MODULE_FEATURES[tab]||null;
export const isModuleEnabled=(tab,flags)=>{
 const key=featureForTab(tab);
 return !key||flags?.[key]===true;
};
