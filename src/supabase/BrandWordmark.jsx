/** Shared branded wordmarks for headers, navigation, links and footers.
 * Always render "Content ConnectX" and "Host ConnectX" with an attached,
 * colored X. This component is presentation-only and does not grant access.
 */
import React from 'react';

export const BRAND_NAMES=Object.freeze({
 content:'Content ConnectX',
 host:'Host ConnectX'
});
export default function BrandWordmark({brand='content',className='',style={}}){
 const host=brand==='host';
 const prefix=host?'Host Connect':'Content Connect';
 return <span className={className} style={{display:'inline-flex',alignItems:'baseline',whiteSpace:'nowrap',...style}}>
  <span>{prefix}</span><span aria-hidden="true" style={host?{color:'#12698f',fontWeight:900}:{
   backgroundImage:'linear-gradient(110deg,#6d4aff 0%,#a13ef4 50%,#c32fae 100%)',
   WebkitBackgroundClip:'text',backgroundClip:'text',WebkitTextFillColor:'transparent',color:'#9751db',fontWeight:900
  }}>X</span>
 </span>;
}
