/** Role-specific membership promises, separate from server entitlements and payment activation. */
export const PROFESSIONAL_ROLES=Object.freeze([
 {id:'creator',label:'Creator'},{id:'photographer',label:'Photographer'},
 {id:'videographer',label:'Videographer'},{id:'video_editor',label:'Video Editor'},
 {id:'agent',label:'Agent'},{id:'studio',label:'Studio'},
 {id:'director_producer',label:'Director / Producer'},
 {id:'hair_stylist',label:'Hair Stylist'},
 {id:'makeup_artist',label:'Makeup Artist'},
 {id:'wardrobe_stylist',label:'Wardrobe Stylist'},
 {id:'equipment_rental',label:'Equipment Rental'},
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
,
 director_producer:{description:'Build productions and coordinate verified crews.',items:['Professional profile and discovery','Production project coordination subject to the current membership gates']},
 hair_stylist:{description:'Offer hair styling for productions.',items:['Professional styling portfolio and services','Verified-member discovery and project enquiries']},
 makeup_artist:{description:'Provide makeup services for shoots.',items:['Professional makeup portfolio and services','Verified-member discovery and project enquiries']},
 wardrobe_stylist:{description:'Style production wardrobes.',items:['Professional wardrobe portfolio and services','Verified-member discovery and project enquiries']},
 equipment_rental:{description:'List production equipment and rental services.',items:['Equipment provider portfolio','Verified-member discovery and project enquiries']},
});
export const DEFAULT_PREMIUM_PLANS=Object.freeze([
 {plan_code:'creator_pro',role_type:'creator',monthly_cents:1999,label:'Creator Premium',roster_seats:null},
 {plan_code:'photographer_pro',role_type:'photographer',monthly_cents:2999,label:'Photographer Premium',roster_seats:null},
 {plan_code:'videographer_pro',role_type:'videographer',monthly_cents:4999,label:'Solo Videographer Premium',roster_seats:null},
 {plan_code:'video_editor_pro',role_type:'video_editor',monthly_cents:4999,label:'Video Editor Premium',roster_seats:null},
 {plan_code:'agent_10',role_type:'agent',monthly_cents:4999,label:'Agent · up to 10 creators',roster_seats:10},
 {plan_code:'agent_25',role_type:'agent',monthly_cents:9999,label:'Agent · up to 25 creators',roster_seats:25},
 {plan_code:'agent_100plus',role_type:'agent',monthly_cents:24999,label:'Agent · 100+ creators',roster_seats:null},
 {plan_code:'studio_pro',role_type:'studio',monthly_cents:24999,label:'Studio Premium · starting at',roster_seats:null},
 {plan_code:'director_producer_pro',role_type:'director_producer',monthly_cents:1999,label:'Director / Producer Premium',roster_seats:null},
 {plan_code:'hair_stylist_pro',role_type:'hair_stylist',monthly_cents:1999,label:'Hair Stylist Premium',roster_seats:null},
 {plan_code:'makeup_artist_pro',role_type:'makeup_artist',monthly_cents:1999,label:'Makeup Artist Premium',roster_seats:null},
 {plan_code:'wardrobe_stylist_pro',role_type:'wardrobe_stylist',monthly_cents:1999,label:'Wardrobe Stylist Premium',roster_seats:null},
 {plan_code:'equipment_rental_pro',role_type:'equipment_rental',monthly_cents:1999,label:'Equipment Rental Premium',roster_seats:null},
]);

/** Integer-cent totals match ccx_membership_term_price. Discounts compare with six or twelve monthly charges. */
export const MEMBERSHIP_TERMS=Object.freeze([
 {id:'monthly',label:'Monthly',days:30,months:1,discount:0},
 {id:'six_months',label:'6 months',days:180,months:6,discount:10},
 {id:'annual',label:'Annual',days:365,months:12,discount:20}
]);
export function membershipTermPrice(monthlyCents,termId){
 const term=MEMBERSHIP_TERMS.find(x=>x.id===termId);
 if(!term||!Number.isSafeInteger(monthlyCents)||monthlyCents<0||monthlyCents>1000000)return null;
 const regular=monthlyCents*term.months;
 const total=Math.floor((regular*(100-term.discount)+50)/100);
 return {...term,total_cents:total,savings_cents:regular-total,monthly_equivalent_cents:Math.round(total/term.months)};
}
