/**
 * Mobile keyboard hints for all Bolt/Supabase form modules (including forms
 * loaded after navigation). This is a progressive enhancement: React inputs
 * with explicit inputMode always win. Never change a field's value or type.
 */
const nonTextTypes=new Set(['checkbox','radio','range','file','hidden','button','submit','reset','color','date','datetime-local','month','week','time']);
export function inferInputMode({type='text',name='',id='',placeholder='',label='',step=''}={}){
 const kind=String(type||'text').toLowerCase();
 if(nonTextTypes.has(kind)||kind==='password')return null;
 if(kind==='email')return 'email';
 if(kind==='tel')return 'tel';
 const hint=[name,id,placeholder,label].join(' ').toLowerCase();
 if(kind==='number'){
  return /price|amount|rate|cost|decimal|percent|weight|latitude|longitude/.test(hint)||step==='any'||(/^(0?\.\d+)/.test(String(step)))?'decimal':'numeric';
 }
 if(!['text','search',''].includes(kind))return null;
 if(/\b(phone|telephone|mobile|cell\s*number|contact\s*number)\b/.test(hint))return 'tel';
 // International postal codes can be alphanumeric. Only US ZIP fields use
 // the digits-only keypad; never force all postal-code fields to numeric.
 if(/\b(zip|zip.?code|us.?postal.?code|one.?time.?code|otp|six.?digit.?code)\b/.test(hint))return 'numeric';
 if(/\b(email|e.?mail)\b/.test(hint))return 'email';
 return null;
}

export function initializeFormKeyboardHints(root){
 if(!root||typeof MutationObserver==='undefined')return ()=>{};
 const enhance=(node)=>{
  if(!(node instanceof Element))return;
  const candidates=[...(node.matches('input')?[node]:[]),...Array.from(node.querySelectorAll('input'))];
  for(const field of candidates){
   if(field.hasAttribute('inputmode'))continue;
   const mode=inferInputMode({
    type:field.getAttribute('type')||'text', name:field.getAttribute('name')||'',
    id:field.id,placeholder:field.getAttribute('placeholder')||'',
    label:field.closest('label')?.textContent?.slice(0,120)||field.getAttribute('aria-label')||'',
    step:field.getAttribute('step')||''
   });
   if(mode)field.setAttribute('inputmode',mode);
  }
 };
 enhance(root);
 const observer=new MutationObserver(records=>{
  for(const record of records)for(const node of Array.from(record.addedNodes))enhance(node);
 });
 observer.observe(root,{childList:true,subtree:true});
 return ()=>observer.disconnect();
}
