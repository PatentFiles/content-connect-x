/** Availability is not authorization. Keep loading, failures and access prerequisites distinct. */
import {featureForTab} from './featureModules.mjs';
export function moduleAccessState(tab,{flags=null,access={},status='loading',error='',verified=false}={}){
 const feature=featureForTab(tab);
 if(!feature)return {code:'ready',feature:null};
 if(status==='error')return {code:'unavailable',feature,message:error||'Could not load module access. Retry without changing any feature switches.'};
 if(status!=='ready'||!flags)return {code:'loading',feature};
 const detail=access?.[feature];
 if(detail?.reason&&detail.reason!=='ready')return {code:detail.reason,feature};
 if(!(feature in flags))return {code:'unavailable',feature,message:'This module is missing from the backend feature registry.'};
 if(flags[feature]!==true)return {code:'disabled',feature};
 if(!verified)return {code:'verification_required',feature};
 return {code:'ready',feature};
}
