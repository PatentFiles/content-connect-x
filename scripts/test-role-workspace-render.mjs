/** Render actual React layouts and access explanations without accounts or writes. */
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {ROLE_ROUTES} from '../src/supabase/roleNavigationData.mjs';
import {MODULE_FEATURES} from '../src/supabase/featureModules.mjs';
// SSR-only checks do not need the browser dependency optimizer. Disabling its
// discovery prevents a background scan racing with server.close() after tests.
const server=await createServer({server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
let checks=0;
try{
 const [{default:Shell},{default:Dashboard},{default:ProfessionalProfile},{default:Roster},{default:Portfolio},{default:Card},{default:Boundary}]=await Promise.all([
  server.ssrLoadModule('/src/supabase/OriginalShell.jsx'),server.ssrLoadModule('/src/supabase/OriginalRoleDashboard.jsx'),server.ssrLoadModule('/src/supabase/ProfessionalProfileEditor.jsx'),server.ssrLoadModule('/src/supabase/RosterPanel.jsx'),server.ssrLoadModule('/src/supabase/ProfessionalPortfolio.jsx'),server.ssrLoadModule('/src/supabase/MemberDiscoveryCard.jsx'),server.ssrLoadModule('/src/supabase/ModuleAccessBoundary.jsx')
 ]);
 const flags=Object.fromEntries(Object.values(MODULE_FEATURES).map(key=>[key,true]));
 const user={id:'00000000-0000-4000-8000-000000000001'};
 const base={id:user.id,display_name:'Role layout test',country:'United States',state:'AZ',city:'Phoenix',profile_complete:true};
 for(const role of Object.keys(ROLE_ROUTES)){
  const profile={...base,role_type:role};
  const html=renderToStaticMarkup(React.createElement(Shell,{user,profile,approved:true,tab:'dashboard',featureFlags:flags,onNavigate:()=>{},onSignOut:()=>{}},React.createElement(Dashboard,{profile,verified:true,features:flags,onNavigate:()=>{}})));
  for(const label of ['Discovery','Search','Favorites','Properties'])assert.ok(html.includes(label),role+' must render '+label);
  assert.ok(html.includes('Mobile bottom navigation'));
  assert.ok(!html.includes('Host Dashboard'));
  if(['agent','studio'].includes(role))assert.ok(html.includes('Roster'));
  if(['photographer','videographer','video_editor'].includes(role))assert.ok(html.includes('Portfolio'));
  checks++;
  assert.ok(html.includes('Customize dashboard')&&html.includes('Profile views')&&html.includes('Unread messages'),role+' must render metrics instead of only shortcut modules');checks++;
  if(role!=='creator'){
   const settings=renderToStaticMarkup(React.createElement(ProfessionalProfile,{user,profile,role,preview:true,approved:true}));
   assert.ok(!settings.includes('Production details')&&!settings.includes('Health &amp; testing'),role+' must not render performer settings');
   assert.ok(settings.includes(role==='agent'?'Agency details':role==='studio'?'Studio details':role==='video_editor'?'Editing services':'Services &amp; rates'));
   checks++;
  }
 }
 for(const role of ['agent','studio']){const html=renderToStaticMarkup(React.createElement(Roster,{user,role,preview:true}));assert.ok(html.includes('Roster')&&html.includes('Add creator'));checks++;}
 for(const role of ['photographer','videographer','video_editor']){const html=renderToStaticMarkup(React.createElement(Portfolio,{userId:user.id,role,preview:true}));assert.ok(html.includes('Portfolio')&&html.includes('Add work'));checks++;}
 const card=renderToStaticMarkup(React.createElement(Card,{person:{id:user.id,display_name:'Synthetic sample',role_type:'creator',city:'Phoenix',age_verified:true},saved:true,onClick:()=>{},onFavorite:()=>{}}));
 assert.ok(card.includes('Remove favorite: Synthetic sample')&&card.includes('aria-pressed="true"')&&card.includes('right-3 top-3'));checks++;
 for(const [reason,title] of [['verification_required','Complete your age verification'],['mfa_required','two-factor authentication'],['role_required','matching professional account'],['membership_required','Premium membership'],['unavailable','could not be loaded']]){
  const state={roster:true,__ccxLoaded:true,__ccxAccess:{roster:{eligible:false,reason}}};
  const html=renderToStaticMarkup(React.createElement(Boundary,{tab:'roster',flags:state,onNavigate:()=>{}},'MUST NOT MOUNT'));
  assert.ok(html.includes(title));assert.ok(!html.includes('MUST NOT MOUNT'));assert.ok(!html.includes('module is turned off'));checks++;
 }
 console.log('PASS '+checks+' rendered React role/card/dashboard/access checks. No backend writes performed.');
}finally{await server.close();}
