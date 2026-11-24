import react from '@vitejs/plugin-react';
import {prepareMapAssets} from './scripts/prepare-map-assets.mjs';
import { defineConfig,loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import {assertSafeBrowserEnvironment} from './src/api/browserKeySafety.mjs';

// A runtime error is too late: VITE_* values have already been embedded in JS.
export default defineConfig(({mode})=>{
 assertSafeBrowserEnvironment({...loadEnv(mode,process.cwd(),'VITE_'),...process.env});
 prepareMapAssets();
 return {
  resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
  plugins:[react()],
 };
});
