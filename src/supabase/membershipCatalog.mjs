/** Role-specific membership promises, separate from server entitlements and payment activation. */
export const PROFESSIONAL_ROLES=Object.freeze([
 {id:'creator',label:'Creator'},{id:'photographer',label:'Photographer'},
 {id:'videographer',label:'Videographer'},{id:'video_editor',label:'Video Editor'},
 {id:'agent',label:'Agent'},{id:'studio',label:'Studio'}
]);
export const FREE_BENEFITS=Object.freeze([
 'Create a professional profile after mandatory 18+ verification',
 'Browse verified professional profiles worldwide',
 'Save local and long-distance profiles to Favorites',
 'Connect with up to five people within your 25-mile local area per rolling week',
 'Direct messaging with approved local connections, subject to free contact limits',
 'Private account settings and consent controls',
 'External creator social links remain hidden until Premium'
]);
export const ROLE_BENEFITS=Object.freeze({
 creator:{description:'Discover creators, plan content and manage your professional collaborations.',items:[
  'Global discovery, unlimited professional contacts and private messages',
  'View creator-provided professional social links when shared',
  'Production rooms, casting and team invitations',
  'Shoot availability, travel scheduling and document workflows',
  'Consent, agreements and production collaboration tools']},
 photographer:{description:'Build a professional photography portfolio and collaborate with verified adults.',items:[
  'Unlimited global client discovery and contact',
  'Full portfolio and permitted social links',
  'Booking requests and shoot scheduling',
  'Photography service packages, deliverables and agreements',
  'Studio and OnlyHost location discovery']},
 videographer:{description:'Find production clients, manage shoots and deliver professional video.',items:[
  'Unlimited global clients and professional messages',
  'Video reel, portfolio and shared social links',
  'Production teams, crew coordination and equipment planning',
  'Shoot calendars, booking requests and delivery terms',
  'Consent, production agreements and document workflows']},
 video_editor:{description:'Showcase editing expertise and manage creator production projects.',items:[
  'Unlimited global client discovery and private communication',
  'Video editing portfolio and permitted professional links',
  'Project invitations, task collaboration and delivery scheduling',
  'Editing deliverable agreements and revision terms',
  'Cross-role access to production teams and location discovery']},
 agent:{description:'Manage creator representation and a growing professional roster.',items:[
  'Unlimited global talent discovery and client communications',
  'Multiple creator representations and managed negotiations',
  'Agency portfolio, team bookings and agreement oversight',
  'Delegated workflows subject to each creator’s explicit consent',
  'Roster capacity based on your selected 10, 25 or 100+ plan']},
 studio:{description:'Operate a professional production studio with teams, talent and facilities.',items:[
  'Unlimited global creator and production talent discovery',
  'Studio team, creator rosters and management permissions',
  'Production rooms, shoot calendars and resource scheduling',
  'Multiple collaborators, contracts and consent workflows',
  'Equipment, location coordination and integrated OnlyHost discovery']}
});
export const DEFAULT_PREMIUM_PLANS=Object.freeze([
 {plan_code:'creator_pro',role_type:'creator',monthly_cents:1999,label:'Creator Premium',roster_seats:null},
 {plan_code:'photographer_pro',role_type:'photographer',monthly_cents:2999,label:'Photographer Premium',roster_seats:null},
 {plan_code:'videographer_pro',role_type:'videographer',monthly_cents:4999,label:'Solo Videographer Premium',roster_seats:null},
 {plan_code:'video_editor_pro',role_type:'video_editor',monthly_cents:4999,label:'Video Editor Premium',roster_seats:null},
 {plan_code:'agent_10',role_type:'agent',monthly_cents:4999,label:'Agent · up to 10 creators',roster_seats:10},
 {plan_code:'agent_25',role_type:'agent',monthly_cents:9999,label:'Agent · up to 25 creators',roster_seats:25},
 {plan_code:'agent_100plus',role_type:'agent',monthly_cents:24999,label:'Agent · 100+ creators',roster_seats:null},
 {plan_code:'studio_pro',role_type:'studio',monthly_cents:24999,label:'Studio Premium · starting at',roster_seats:null}
]);
