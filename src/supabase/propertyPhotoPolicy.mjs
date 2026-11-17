/** File limits protect storage and browsers; there is deliberately no per-listing count cap. */
export const PROPERTY_PHOTO_MAX_BYTES=10*1024*1024;
export const PROPERTY_PHOTO_TYPES=Object.freeze(['image/jpeg','image/png','image/webp']);
export const photoKey=file=>`${file.name}:${file.size}:${file.lastModified||0}`;
export function mergePhotoSelection(existing,incoming){
 const keys=new Set(existing.map(photoKey));const files=[...existing],errors=[];
 for(const file of incoming){
  if(!PROPERTY_PHOTO_TYPES.includes(file.type)){errors.push(`${file.name}: use JPG, PNG or WebP.`);continue;}
  if(file.size<=0||file.size>PROPERTY_PHOTO_MAX_BYTES){errors.push(`${file.name}: each photo must be between 1 byte and 10 MB.`);continue;}
  const key=photoKey(file);if(!keys.has(key)){files.push(file);keys.add(key);}
 }
 return {files,errors};
}
