/** UI explanations only. All writes/read access are still checked by Supabase. */
import {featureForTab} from './featureModules.mjs';
export const ACCESS_COPY=Object.freeze({
 loading:{title:'Checking access…',description:'Loading your account and module settings.'},
 unavailable:{title:'Module settings could not be loaded',description:'This is a connection or configuration error, not a disabled feature. Retry to load the current server settings.'},
 disabled:{title:'This module is turned off',description:'An administrator has explicitly disabled this feature. Your existing records have not been deleted.',tab:'controls',action:'Platform controls'},
 rollout_excluded:{title:'This module is not in your rollout yet',description:'The administrator has enabled this feature for a limited rollout.',tab:'dashboard',action:'Return to dashboard'},
 verification_required:{title:'Complete your age verification',description:'This feature is enabled, but your account does not yet have an independent, current age approval. Administrator status and role previews do not establish age verification.',tab:'verification',action:'Open verification'},
 mfa_required:{title:'Administrator two-factor authentication required',description:'This feature is enabled. Complete administrator MFA before using this protected workflow.',tab:'account-security',action:'Open account security'},
 membership_required:{title:'Premium membership required',description:'This feature is enabled, but the current account does not have the membership required for this action.',tab:'membership',action:'View membership'},
 role_required:{title:'Use the matching professional account',description:'This workspace belongs to a different professional role. The administrator role selector previews layouts; it does not change the account or grant another role’s permissions.',tab:'profile',action:'My profile'},
 restricted:{title:'Account access is restricted',description:'The account is suspended or restricted. Safety and consent controls remain available.',tab:'settings',action:'Account settings'}
});
export function accessReason(tab,flags){
 const key=featureForTab(tab);
 if(!key)return 'ready';
 if(flags===null)return 'loading';
 if(!flags||flags.__ccxLoaded!==true)return 'unavailable';
 const decision=flags.__ccxAccess?.[key];
 if(!decision)return 'unavailable';
 return decision.eligible===true&&flags[key]===true?'ready':
   Object.hasOwn(ACCESS_COPY,decision.reason)?decision.reason:'unavailable';
}
export const accessCopy=reason=>ACCESS_COPY[reason]||ACCESS_COPY.unavailable;
