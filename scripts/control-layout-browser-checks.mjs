/** Executed inside Chromium against extracted controls and real React markup. */
export const inspectControlLayout = () => {
 const failures=[];let count=0;
 const intersect=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
 for(const input of document.querySelectorAll('input[type=checkbox],input[type=radio]')){
  if(input.classList.contains('sr-only')||input.hidden)continue;
  const rect=input.getBoundingClientRect(),css=getComputedStyle(input),label=input.closest('label');
  if(!rect.width||!label)continue;count++;
  const id=input.closest('[data-source]')?.getAttribute('data-source')||'Actual Collaborations';
  if(rect.width<19.5||rect.width>20.5||rect.height<19.5||rect.height>20.5)failures.push({id,kind:'choice size',width:rect.width,height:rect.height});
  if(parseFloat(css.marginLeft)<0||parseFloat(css.marginRight)<0||parseFloat(css.paddingLeft)>0)failures.push({id,kind:'negative margin/padding',margin:css.marginLeft,padding:css.paddingLeft});
  const lr=label.getBoundingClientRect();
  if(rect.left<lr.left-.5||rect.right>lr.right+.5||rect.top<lr.top-.5||rect.bottom>lr.bottom+.5)failures.push({id,kind:'choice outside label'});
  if(lr.height<43.5)failures.push({id,kind:'small label target',height:lr.height});
  const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);let text;
  while(text=walker.nextNode())if(text.textContent.trim()){
    const range=document.createRange();range.selectNodeContents(text);
    for(const tr of range.getClientRects())if(intersect(rect,tr))failures.push({id,kind:'overlapping label',text:text.textContent.trim().slice(0,50)});
  }
 }
 for(const row of document.querySelectorAll('[data-row]>.ccx-action-row')){
   const id=row.closest('[data-source]').dataset.source,rr=row.getBoundingClientRect();
   const kids=[...row.children].filter(e=>getComputedStyle(e).position!=='absolute').map(e=>({e,r:e.getBoundingClientRect()}));
   for(const {e,r} of kids){
     if(r.width&& (r.left<rr.left-.5||r.right>rr.right+.5))failures.push({id,kind:'action escapes row',tag:e.tagName,delta:r.right-rr.right});
   }
   for(let i=0;i<kids.length;i++)for(let j=i+1;j<kids.length;j++)if(intersect(kids[i].r,kids[j].r))failures.push({id,kind:'overlapping actions'});
 }
 if(document.documentElement.scrollWidth>innerWidth+1)failures.push({kind:'viewport overflow',width:document.documentElement.scrollWidth,viewport:innerWidth});
 const hidden=document.querySelector('input[type=hidden]'),range=document.querySelector('input[type=range]');
 if(hidden?.getBoundingClientRect().width)failures.push({kind:'hidden input shown'});
 if(range&&parseFloat(getComputedStyle(range).paddingLeft)>0)failures.push({kind:'modal range inherited text padding'});
 const icon=document.querySelector('.oh-circle-control');if(icon){const r=icon.getBoundingClientRect();if(Math.abs(r.width-r.height)>.5||r.width<44)failures.push({kind:'icon is not a 44px square',width:r.width,height:r.height});}
 return {choices:count,actionRows:document.querySelectorAll('[data-row]').length,failures};
};
