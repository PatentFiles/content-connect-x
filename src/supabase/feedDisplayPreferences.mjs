/** User-owned feed preferences, stored in Supabase rather than device storage.
 * These settings never alter visibility authorization: each feed request is still
 * checked by the private Connect Feed backend.
 */
export const DEFAULT_FEED_PREFERENCES=Object.freeze({default_audience:'verified',feed_view:'discover'});
export const FEED_AUDIENCES=Object.freeze([
 {value:'verified',label:'Entire verified community'},
 {value:'friends',label:'Friends only'},
 {value:'only_me',label:'Only me'}
]);
export const FEED_VIEWS=Object.freeze([
 {value:'discover',label:'Discover (entire community)'},
 {value:'friends',label:'Friends'},
 {value:'following',label:'Following'}
]);
const audiences=new Set(FEED_AUDIENCES.map(v=>v.value));
const views=new Set(FEED_VIEWS.map(v=>v.value));
export function normalizeFeedPreferences(value){
 return {
  default_audience:audiences.has(value?.default_audience)?value.default_audience:DEFAULT_FEED_PREFERENCES.default_audience,
  feed_view:views.has(value?.feed_view)?value.feed_view:DEFAULT_FEED_PREFERENCES.feed_view
 };
}
export async function loadFeedPreferences(client,userId){
 if(!userId)throw Error('Sign in to load feed preferences.');
 const {data,error}=await client.from('ccx_feed_display_preferences')
  .select('default_audience,feed_view').eq('user_id',userId).maybeSingle();
 if(error)throw Error('Feed preferences could not be loaded.');
 return normalizeFeedPreferences(data);
}
export async function saveFeedPreferences(client,userId,value){
 if(!userId)throw Error('Sign in to save feed preferences.');
 const normalized=normalizeFeedPreferences(value);
 if(normalized.default_audience!==value?.default_audience||normalized.feed_view!==value?.feed_view)
  throw Error('Choose a supported feed preference.');
 const {data,error}=await client.from('ccx_feed_display_preferences').upsert({
  user_id:userId,...normalized,updated_at:new Date().toISOString()
 },{onConflict:'user_id'}).select('default_audience,feed_view').single();
 if(error||!data)throw Error('Feed preferences could not be saved.');
 return normalizeFeedPreferences(data);
}
