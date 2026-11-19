/** Device-local optional consent. Authentication storage is separate and necessary. */
export const TRACKING_KEY='ccx:privacy:v1';
export const TRACKING_VERSION=1;
export function normalizeTracking(value){
 return {version:TRACKING_VERSION,necessary:true,diagnostics:value?.version===TRACKING_VERSION&&value.diagnostics===true,experiments:value?.version===TRACKING_VERSION&&value.experiments===true,advertising:false};
}
export function readTracking(storage){
 // Even reading the localStorage property can throw in a privacy-restricted browser.
 try{const store=storage===undefined?globalThis.localStorage:storage;return normalizeTracking(JSON.parse(store?.getItem(TRACKING_KEY)||'null'));}catch{return normalizeTracking(null);}
}
export function saveTracking(value,storage){
 const next=normalizeTracking({...value,version:TRACKING_VERSION});
 const store=storage===undefined?globalThis.localStorage:storage;
 if(!store)throw Error('Browser storage is unavailable. Optional services remain off.');
 store.setItem(TRACKING_KEY,JSON.stringify({...next,updatedAt:new Date().toISOString()}));
 return next;
}
