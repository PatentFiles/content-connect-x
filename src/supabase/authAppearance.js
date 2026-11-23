/** Presentation follows the actual Auth session, never a URL, OS mode or saved theme.
 * This changes CSS/chrome only; it never grants membership or verification. */
import {useLayoutEffect} from 'react';
export function applyAuthAppearance(signedIn,root=document.documentElement){
 const appearance=signedIn?'workspace':'public';
 root.dataset.ccxAppearance=appearance;
 root.classList.toggle('dark',!signedIn);
 const doc=root.ownerDocument;
 for(const [name,value] of [['color-scheme',signedIn?'light':'dark'],['theme-color',signedIn?'#F7F3FF':'#080A15'],['apple-mobile-web-app-status-bar-style',signedIn?'default':'black-translucent']]){
  doc?.querySelector('meta[name="'+name+'"]')?.setAttribute('content',value);
 }
 return appearance;
}
export function useAuthAppearance(user){
 useLayoutEffect(()=>{applyAuthAppearance(Boolean(user?.id));},[user?.id]);
}
