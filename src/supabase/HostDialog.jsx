/** Native top-layer dialog: focus containment, Escape, backdrop and focus return. */
import React,{useId,useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X,LockKeyhole} from 'lucide-react';
let bodyLocks=0;
let previousOverflow='';

/** @param {{title:string,subtitle?:string,children?:React.ReactNode,onClose:()=>void,busy?:boolean,className?:string}} props */
export default function HostDialog({title,subtitle='',children,onClose,busy=false,className=''}){
 const ref=useRef(/** @type {HTMLDialogElement|null} */ (null));
 const titleId=useId();
 useLayoutEffect(()=>{
  const dialog=ref.current;
  if(!dialog)return;
  const previouslyFocused=document.activeElement;
  if(bodyLocks===0){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
  bodyLocks++;
  dialog.showModal();
  return()=>{
   if(dialog.open)dialog.close();
   bodyLocks=Math.max(0,bodyLocks-1);
   if(bodyLocks===0)document.body.style.overflow=previousOverflow;
   if(previouslyFocused instanceof HTMLElement&&previouslyFocused.isConnected)previouslyFocused.focus({preventScroll:true});
  };
 },[]);
 const dismiss=()=>{if(!busy)onClose();};
 return createPortal(<dialog ref={ref} className={'oh-dialog '+className} aria-labelledby={titleId}
   onCancel={event=>{event.preventDefault();dismiss();}}
   onClick={event=>{if(event.target===event.currentTarget)dismiss();}}>
   <div className="oh-dialog-shell">
    <header className="oh-dialog-heading">
     <div><p className="oh-dialog-eyebrow"><LockKeyhole size={13} aria-hidden="true"/> HOST CONNECT WORKSPACE</p>
      <h2 id={titleId}>{title}</h2>{subtitle&&<p className="oh-dialog-subtitle">{subtitle}</p>}</div>
     <button type="button" className="oh-circle-control" onClick={dismiss} disabled={busy} aria-label="Close dialog"><X size={20}/></button>
    </header>
    <div className="oh-dialog-content">{children}</div>
   </div>
  </dialog>,document.body);
}
