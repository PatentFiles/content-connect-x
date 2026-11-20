/** Stable dashboard entry point; legacy page props remain supported. */
import React from 'react';
import CustomDashboard from './CustomDashboard';
/** @param {{profile:any,onNavigate:(tab:string)=>void,roleOverride?:string,verified?:boolean,paid?:boolean,features?:any}} props */
export default function OriginalRoleDashboard({profile,onNavigate,roleOverride,paid=false}){
 return <CustomDashboard profile={profile} onNavigate={onNavigate} roleOverride={roleOverride} paid={paid}/>;
}
