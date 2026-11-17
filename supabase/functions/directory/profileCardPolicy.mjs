/** Never sign arbitrary private-gallery, identity, or medical paths for a card. */
export const safeProfileAvatarPath=(owner,path)=>typeof path==='string'&&path.startsWith(owner+'/profile/avatar-')&&!path.includes('..')&&/\.(jpeg|jpg|png|webp)$/i.test(path)?path:null;
export const directoryFeatureForMode=mode=>mode==='search'?'search':mode==='favorites'?'favorites':'creator_discovery';
