/** Keep SPA navigation at page-top on mobile and desktop.
 * Avoid CSS smooth-scroll when switching destinations. The extra animation
 * frame handles DOM layout updates and mobile browsers restoring old offsets.
 * Do not call this on filter changes or when opening modal overlays.
 */
export function resetPageScroll(){
 if(typeof window==='undefined'||typeof document==='undefined')return;
 try{window.scrollTo({top:0,left:0,behavior:'instant'});}
 catch{window.scrollTo(0,0);}
 const root=document.scrollingElement||document.documentElement;
 if(root)root.scrollTop=0;
 if(document.body)document.body.scrollTop=0;
 const main=document.getElementById('main-content');
 if(main)main.scrollTop=0;
}
export function scrollToNewPage(){
 resetPageScroll();
 if(typeof window!=='undefined'&&typeof window.requestAnimationFrame==='function')
  window.requestAnimationFrame(resetPageScroll);
}
