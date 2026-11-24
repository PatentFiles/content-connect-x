/** Vite/Bolt serves the lockfile-pinned ES module, worker and CSS locally. */
import {copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const MAP_ASSET_PATH='/vendor/maplibre-6.19.0/';
export function prepareMapAssets(){
 const src=new URL('../node_modules/maplibre-gl/',import.meta.url);
 const dest=new URL('../public'+MAP_ASSET_PATH,import.meta.url);
 mkdirSync(fileURLToPath(dest),{recursive:true});
 for(const name of ['maplibre-gl.mjs','maplibre-gl-worker.mjs','maplibre-gl.css'])
  copyFileSync(fileURLToPath(new URL('dist/'+name,src)),fileURLToPath(new URL(name,dest)));
 const license=['LICENSE.txt','LICENSE'].find(name=>existsSync(fileURLToPath(new URL(name,src))));
 if(license)copyFileSync(fileURLToPath(new URL(license,src)),fileURLToPath(new URL('LICENSE.txt',dest)));
}
