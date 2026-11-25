/** Session-only demo data boundary. Unknown actions fail CLOSED: never fall through
 * to a real service, upload, payment, message, signature or verification endpoint.
 * The real client remains separately exported for root authentication and admin checks.
 */
import {createMarketingFixtures,DEMO_CLOCK,DEMO_PERSON_ID,demoDate} from './marketingFixtures.mjs';
let session=null,epoch=0,serial=0;
const listeners=new Set();
const clone=value=>value===undefined?undefined:structuredClone(value);
export const isDemoActive=()=>session!==null;
export const demoEpoch=()=>epoch;
export const demoSnapshot=()=>session?.data||null;
export function subscribeDemo(listener){listeners.add(listener);return()=>{listeners.delete(listener);};}
function changed(){for(const listener of listeners)listener();if(typeof window!=='undefined')window.dispatchEvent(new Event('ccx-data-changed'));}
export function startDemo(owner,assets={}){
 if(!owner)throw Error('A real administrator session is required.');
 stopDemo();session={owner,data:createMarketingFixtures(assets),tables:{},blobs:new Map(),layout:null};epoch++;changed();return session.data;
}
export function stopDemo(){if(session){for(const url of session.blobs.values())if(String(url).startsWith('blob:'))URL.revokeObjectURL(url);}session=null;epoch++;if(typeof window!=='undefined'&&window.history.state?.memberContext){const state={...window.history.state};delete state.memberContext;window.history.replaceState(state,'',window.location.href);}changed();}
/** Prevent a delayed demo callback or back-navigation from submitting a fictional
 * record ID after the user has switched back to live mode. Text bodies are not IDs. */
export function hasDemoIdentifier(value,key=''){
 if(typeof value==='string')return /(?:id|ids)$/i.test(key)&&value.startsWith('demo-');
 if(Array.isArray(value))return value.some(item=>hasDemoIdentifier(item,key));
 return Boolean(value&&typeof value==='object'&&Object.entries(value).some(([name,item])=>hasDemoIdentifier(item,name)));
}
const closedDemoError=()=>({data:null,error:{message:'This demonstration record belongs to a closed demo session. Reopen mock mode or select a live record.'}});
export const demoOwner=()=>session?.owner||null;
const data=()=>{if(!session)throw Error('Demo session has ended.');return session.data;};
const id=prefix=>'demo-'+prefix+'-local-'+(++serial);
const blocked=()=>{throw Error('This action is not available in demo mode. No live request was sent.');};
const result=items=>({items:clone(items),demo:true});
function requireItem(rows,key){const item=rows.find(x=>x.id===key);if(!item)throw Error('This demo record no longer exists.');return item;}
export function filterDemoProperties(items,filters={}){
 const text=v=>String(v||'').toLowerCase();
 return items.filter(p=>{
  if(filters.query&&!text(p.title+' '+p.neighborhood+' '+p.city).includes(text(filters.query)))return false;
  for(const field of ['country','state','city'])if(filters[field]&&text(p[field])!==text(filters[field])&&!(field==='city'&&text(filters[field])==='los angeles'))return false;
  const kinds=filters.categories?.length?filters.categories:filters.category?[filters.category]:[];
  if(kinds.length&&!kinds.some(k=>k===p.category||(k==='pool'&&p.amenities.includes('pool'))))return false;
  if(filters.crew_size&&Number(filters.crew_size)>p.capacity)return false;
  if(filters.amenities?.some(v=>!p.amenities.includes(v))||filters.accessibility?.some(v=>!p.accessibility_features.includes(v)))return false;
  if(filters.host_language&&!p.host_languages.includes(filters.host_language))return false;
  if(filters.requested_use&&!p.permitted_uses.includes(filters.requested_use))return false;
  const cost=(p.daily_rate_cents+p.cleaning_fee_cents)/100;
  if(filters.min_price!==undefined&&cost<Number(filters.min_price)||filters.max_price!==undefined&&cost>Number(filters.max_price))return false;
  const b=filters.bounds;if(b){const west=b.west??b.min_lng,east=b.east??b.max_lng,south=b.south??b.min_lat,north=b.north??b.max_lat;
   if([west,east,south,north].every(Number.isFinite)&&(p.approx_lng<west||p.approx_lng>east||p.approx_lat<south||p.approx_lat>north))return false;}
  return true;
 });
}
export function demoQuote(property,args){
 const start=Date.parse(args.starts_at||args.start_date),end=Date.parse(args.ends_at||args.end_date);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error('Choose a valid start and end.');
 const hourly=args.rental_unit==='hour';const units=hourly?Math.ceil((end-start)/3600000):Math.ceil((end-start)/86400000);
 if(hourly&&units<property.min_rental_hours)throw Error('This location has a three-hour minimum.');
 if(Number(args.crew_size)>property.capacity)throw Error('The selected crew exceeds this venue’s capacity.');
 const base=units*(hourly?property.hourly_rate_cents:property.daily_rate_cents);
 return {property_id:property.id,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),rental_unit:hourly?'hour':'day',rental_hours:hourly?units:null,rental_days:hourly?null:units,days:hourly?null:units,rate_cents:hourly?property.hourly_rate_cents:property.daily_rate_cents,rental_cents:base,cleaning_cents:property.cleaning_fee_cents,deposit_cents:0,subtotal_cents:base,rental_subtotal_cents:base,cleaning_fee_cents:property.cleaning_fee_cents,total_cents:base+property.cleaning_fee_cents,currency:'USD',demo:true};
}
export function demoHostAction(action,args={}){
 const d=data();
 if(action==='browse')return result(filterDemoProperties(d.properties,args));
 if(action==='my_listings')return result(d.properties.filter((p,i)=>i%7===0));
 if(action==='listing'){const p=requireItem(d.properties,args.id||args.property_id);return {item:clone(p),unavailable:[],photos:clone(p.photos),demo:true};}
 if(['availability','calendar','host_blocks'].includes(action))return {unavailable:[],items:[],demo:true};
 if(action==='my_bookings'||action==='host_bookings')return result(d.bookings);
 if(action==='collaboration_bookings')return result(d.bookings.filter(b=>b.collaboration_id===args.collaboration_id));
 if(action==='quote')return {quote:demoQuote(requireItem(d.properties,args.property_id),args),demo:true};
 if(action==='reserve'){
  const p=requireItem(d.properties,args.property_id),quote=demoQuote(p,args);
  const item={id:id('booking'),...quote,property_title:p.title,title:p.title,cover_url:p.cover_url,guest_id:d.self.id,guest_name:d.self.display_name,status:'requested',legal_status:'not_started',payment_status:'unpaid',created_at:DEMO_CLOCK,crew_size:args.crew_size,collaboration_id:args.collaboration_id||null,demo:true};
  d.bookings.unshift(item);changed();return {item:clone(item),booking:clone(item),demo:true,note:'Demo request saved locally. No real reservation or payment was made.'};
 }
 if(action==='cancel'||action==='cancel_booking'||action==='booking_cancel'){const b=requireItem(d.bookings,args.id||args.booking_id);b.status='cancelled';changed();return {item:clone(b),demo:true};}
 if(action==='host_private_get')return {item:{address_line1:'Approximate location only — no real address in this demo'},demo:true};
 if(action==='host_booking_respond'){const b=requireItem(d.bookings,args.booking_id);if(!['accepted','declined'].includes(args.decision))throw Error('Choose an accepted or declined response.');if(b.status!=='requested')throw Error('Only pending demo requests can be changed.');b.status=args.decision;changed();return {item:clone(b),demo:true};}
 if(action==='booking_messages'||action==='booking_message_send'){
  const b=requireItem(d.bookings,args.booking_id),key='booking-chat-'+b.id;
  if(!session.tables[key])session.tables[key]=[
   {id:key+'-1',sender_user_id:d.agent.id,sender_label:d.agent.display_name,content:'Hello Tommy, the production layout and crew parking details are ready for your review.',created_at:b.created_at},
   {id:key+'-2',sender_user_id:d.self.id,sender_label:d.self.display_name,content:'Thank you, Jade. We will keep the crew within the agreed capacity and confirm the call sheet before arrival.',created_at:b.created_at}
  ];
  if(action==='booking_messages')return result(session.tables[key]);
  const body=String(args.content||'').trim();if(!body||body.length>4000)throw Error('Write a message of up to 4,000 characters.');
  const message={id:id('booking-message'),sender_user_id:d.self.id,sender_label:d.self.display_name,content:body,created_at:DEMO_CLOCK,demo:true};session.tables[key].push(message);changed();return {item:clone(message),demo:true,note:'Message saved locally in this demo session. No real message was sent.'};
 }
 if(action==='staff_status')return {role:null,demo:true};
 if(['favorites','my_favorites','saved_properties'].includes(action))return result(d.properties.slice(0,8));
 if(action==='listing_thumbnails')return {items:d.properties.filter(p=>!args.ids||args.ids.includes(p.id)).map(p=>({id:p.id,property_id:p.id,cover_url:p.cover_url})),demo:true};
 if(['equipment','equipment_list','reviews','host_notifications','list_notifications'].includes(action))return result(action.includes('notification')?d.notifications:[]);
 return blocked();
}
function directory(args){
 const d=data();if(args.action==='my_public_profile')return {item:{...clone(d.self),representatives:[clone(d.agent)],travel_dates:[{id:'demo-trip',city:'Los Angeles',country:'United States',starts_at:demoDate(3),ends_at:demoDate(7)}],availability_blocks:[]},demo:true};
 let rows=d.profiles.filter(p=>!args.ids||args.ids.includes(p.id));
 if(args.query)rows=rows.filter(p=>p.display_name.toLowerCase().includes(args.query.toLowerCase()));
 if(args.role)rows=rows.filter(p=>p.role_type===args.role);
 if(args.gender)rows=rows.filter(p=>p.gender===args.gender);
 if(args.min_age)rows=rows.filter(p=>p.age>=Number(args.min_age));if(args.max_age)rows=rows.filter(p=>p.age<=Number(args.max_age));
 for(const field of ['country','state','city'])if(args[field])rows=rows.filter(p=>p[field].toLowerCase()===String(args[field]).toLowerCase()||(field==='country'&&args[field]==='US'));
 const offset=Number(args.offset)||0;return {results:clone(rows.slice(offset,offset+100)),has_more:rows.length>offset+100,demo:true};
}
function member(action,args){
 const d=data();
 const lists={list_collaborations:d.collaborations,list_invitations:(d.invitations||[]).filter(i=>i.invitee_id===d.self.id),list_connection_requests:d.connections,list_conversations:d.conversations,list_contracts:d.contracts,list_notifications:d.notifications};
 if(Object.hasOwn(lists,action))return {...result(lists[action]),...(action==='list_conversations'?{capabilities:{attachments:true}}:{})};
 if(action==='list_messages')return result(d.messages.filter(m=>m.conversation_id===args.conversation_id));
 if(action==='view_social_links')return {socials:{},demo:true};
 if(action==='mark_conversation_read'){const c=requireItem(d.conversations,args.conversation_id);if(c.unread||c.unread_count){c.unread=0;c.unread_count=0;changed();}return {demo:true};}
 if(action==='mark_notification_read'||action==='mark_all_notifications_read'){let dirty=false;d.notifications.forEach(n=>{if(!n.read_at&&(action==='mark_all_notifications_read'||n.id===args.notification_id)){n.read_at=DEMO_CLOCK;dirty=true;}});if(dirty)changed();return {demo:true};}
 if(action==='send_message'){
  const c=requireItem(d.conversations,args.conversation_id),body=String(args.body||args.message||'').trim();
  if(!body&&!args.attachments?.length)throw Error('Add a message or attachment.');
  if(body.length>10000)throw Error('Message is too long.');
  const item={id:id('message'),conversation_id:c.id,sender_id:d.self.id,sender_user_id:d.self.id,body,attachments:clone(args.attachments||[]),reactions:[],created_at:DEMO_CLOCK,demo:true};
  d.messages.push(item);c.last_message_preview=body||'Attachment';c.updated_at=DEMO_CLOCK;changed();return {item:clone(item),demo:true};
 }
 if(action==='edit_message'){const m=requireItem(d.messages,args.message_id);if(m.sender_id!==d.self.id)return blocked();m.body=String(args.body||args.message||'');m.edited_at=DEMO_CLOCK;changed();return {item:clone(m),demo:true};}
 if(action==='delete_message'){const m=requireItem(d.messages,args.message_id);if(m.sender_id!==d.self.id)return blocked();m.body='Message removed';m.deleted_at=DEMO_CLOCK;changed();return {demo:true};}
 if(action==='add_group_conversation_member'){const c=requireItem(d.conversations,args.conversation_id);if(c.kind!=='group'||c.created_by!==d.self.id)return blocked();requireItem(d.profiles,args.target_user_id);if(!d.connections.some(x=>x.status==='accepted'&&(x.requester_id===args.target_user_id||x.recipient_id===args.target_user_id)))throw Error('Choose an accepted connection.');c.member_ids=[...new Set([...(c.member_ids||[]),args.target_user_id])];changed();return {item:clone(c),demo:true};}
 if(action==='create_group_conversation'){const ids=[...new Set(args.member_ids||[])];if(ids.length<2||ids.length>9)throw Error('Choose 2–9 connected friends.');ids.forEach(key=>requireItem(d.profiles,key));const item={id:id('conversation'),kind:'group',title:String(args.title||'').trim(),member_ids:[d.self.id,...ids],created_by:d.self.id,unread:0,unread_count:0,created_at:DEMO_CLOCK,demo:true};d.conversations.unshift(item);changed();return {item:clone(item),demo:true};}
 if(action==='create_conversation'){const person=requireItem(d.profiles,args.target_user_id);let c=d.conversations.find(v=>v.peer_user_id===person.id);if(!c){c={id:id('conversation'),kind:'direct',title:person.display_name,peer_user_id:person.id,peer:clone(person),unread_count:0,created_at:DEMO_CLOCK,demo:true};d.conversations.unshift(c);changed();}return {item:clone(c),conversation_id:c.id,demo:true};}
 if(action==='request_connection'){const p=requireItem(d.profiles,args.target_user_id);const item={id:id('connection'),requester_id:d.self.id,recipient_id:p.id,status:'pending',created_at:DEMO_CLOCK,demo:true};d.connections.push(item);changed();return {item,demo:true};}
 if(action==='respond_connection'){const c=requireItem(d.connections,args.request_id);if(!['accepted','declined'].includes(args.status))throw Error('Invalid response.');c.status=args.status;changed();return {item:clone(c),demo:true};}
 if(action==='invite_collaborator'){
  const c=requireItem(d.collaborations,args.collaboration_id),p=requireItem(d.profiles,args.invitee_id);
  if(c.creator_id!==d.self.id||p.id===d.self.id)return blocked();
  if(!d.connections.some(x=>x.status==='accepted'&&(x.requester_id===p.id||x.recipient_id===p.id)))throw Error('Connect with this professional before sending an invitation.');
  d.invitations||=[];let item=d.invitations.find(i=>i.collaboration_id===c.id&&i.invitee_id===p.id&&i.status==='pending');
  if(!item){item={id:id('invitation'),collaboration_id:c.id,inviter_id:d.self.id,invitee_id:p.id,invitee_name:p.display_name,proposed_role:args.proposed_role||p.role_type,status:'pending',created_at:DEMO_CLOCK,demo:true};d.invitations.push(item);changed();}
  return {item:clone(item),demo:true};
 }
 if(action==='create_collaboration'){const item={id:id('collaboration'),creator_id:d.self.id,title:args.title,description:args.description,status:'draft',created_at:DEMO_CLOCK,participants:[{...d.self,user_id:d.self.id,status:'accepted'}],requires_work_clearance:args.requires_work_clearance===true,demo:true};d.collaborations.unshift(item);changed();return {item:clone(item),demo:true};}
 if(action==='create_contract'){requireItem(d.collaborations,args.collaboration_id);const item={id:id('contract'),collaboration_id:args.collaboration_id,title:args.title,content:clone(args.content),status:'draft',created_at:DEMO_CLOCK,version:1,demo:true};d.contracts.unshift(item);changed();return {item:clone(item),demo:true};}
 if(action==='react_message'){const m=requireItem(d.messages,args.message_id);m.reactions=[{emoji:args.emoji||'heart',user_id:d.self.id,count:1}];changed();return {item:clone(m),demo:true};}
 return blocked();
}
function groups(action,args){
 const d=data(),g=()=>requireItem(d.groups,args.group_id);
 if(action==='discover')return result(d.groups.filter(x=>!args.query||(x.name+' '+x.description).toLowerCase().includes(String(args.query).toLowerCase())));
 if(action==='mine')return result(d.groups.filter(x=>x.member_status==='active'));
 if(action==='detail')return {group:clone(g()),demo:true};
 if(action==='members')return result(d.profiles.slice(0,8).map(p=>({...p,user_id:p.id,role:'member',status:'active'})));
 if(['requests','admin_queue'].includes(action))return result([]);
 if(['apply','join','accept'].includes(action)){const group=g();if(group.member_status!=='active'){group.member_status='active';group.membership_status='active';group.member_count++;group.members=group.member_count;changed();}return {group:clone(group),demo:true,note:'Joined locally for this demo session.'};}
 if(['leave','withdraw','decline'].includes(action)){const group=g();if(group.member_status==='active')group.member_count--;group.members=group.member_count;group.member_status=null;group.membership_status=null;changed();return {demo:true};}
 if(action==='create'){const item={id:id('group'),name:args.name,description:args.description,rules:args.rules,visibility:args.visibility||'public',member_count:1,members:1,owner_id:d.self.id,member_status:'active',membership_status:'active',member_role:'owner',state:'active',location:'Los Angeles, California',created_at:DEMO_CLOCK,demo:true};d.groups.push(item);changed();return {group:clone(item),item:clone(item),demo:true};}
 return blocked();
}
function collaborations(action,args){
 const d=data();
 if(action==='list')return {...result(d.collaborations.filter(c=>!c.hidden)),hidden:d.collaborations.filter(c=>c.hidden).map(c=>c.id)};
 if(action==='properties')return result(d.properties);
 if(action==='eligibility')return {eligible:true,demo:true,reason:'Fictional demo participants only.'};
 const c=requireItem(d.collaborations,args.collaboration_id);
 if(action==='detail')return {collaboration:clone(c),plan:clone(c.plan||null),participants:clone(c.participants||[]),members:clone((c.participants||[]).map(p=>({user_id:p.id,membership_role:p.id===d.self.id?'organizer':p.role_type,profile:p}))),contracts:clone(d.contracts.filter(x=>x.collaboration_id===c.id)),invitations:clone((d.invitations||[]).filter(i=>i.collaboration_id===c.id)),consents:[],history:c.plan?[{version:c.plan.version||1,recorded_at:c.created_at,snapshot:clone(c.plan)}]:[],revisions:[],audit:[],demo:true};
 if(action==='save_plan'){c.plan={...args,version:(c.plan?.version||0)+1};changed();return {plan:clone(c.plan),demo:true};}
 if(action==='hide'||action==='unhide'){c.hidden=action==='hide';changed();return {demo:true};}
 return blocked();
}
function integrations(action,args){
 const d=data();
 if(action==='pass_link_status')return {item:{status:'not_linked'},demo:true};
 if(action==='pass_my_clearance')return {status:'current',tested_at:d.testing[0].tested_at,expires_at:d.testing[0].expires_at,source:'independent_review',demo:true};
 if(action==='clearance_documents_mine'||action==='clearance_history')return result(d.testing.filter(t=>(!args.from||t.created_at>=args.from)&&(!args.to||t.created_at<=args.to+'T23:59:59Z')));
 if(action==='pass_my_collaborations')return result(d.collaborations);
 if(action==='admin_clearance_queue')return result([]);
 if(action==='pass_collaboration_status')return {items:[],all_current:false,demo:true};
 return blocked();
}
function identity(action){
 if(action!=='status')return blocked();
 const d=data();
 return {enabled:true,email_confirmed:true,demo:true,notice_version:'demo-only',session:{id:'demo-identity-result',status:'approved',production_approved:false,demo:true,expected_name:d.self.display_name,legal_name:d.self.display_name,age:d.self.age,created_at:demoDate(-210),completed_at:demoDate(-210),updated_at:demoDate(-210),checks:{age:true,identity:true,name:true},diagnostics:{age_passed:true,identity_passed:true,name_match:true,face_match:true},uploaded:{front:true,back:true,capture:true}}};
}
export function demoFunction(name,args={}){
 if(name==='directory')return directory(args);
 if(name==='host-operations'){
  const d=data(),owned=d.properties.filter((p,i)=>i%7===0);
  if(args.action==='overview')return {properties:clone(owned),pending_cleaning_reviews:1,upcoming_cleans:2,pending_invites:1,demo:true};
  if(args.action==='alerts')return {items:[],demo:true};
  if(args.property_id)requireItem(d.properties,args.property_id);
  if(args.action==='rooms_list')return result(['Preparation room','Main production space','Bathroom'].map((name,i)=>({id:args.property_id+'-room-'+i,name,category:i===2?'bathroom':i===1?'studio':'other',tasks:[{id:args.property_id+'-task-'+i,label:['Reset preparation surfaces','Check floor and equipment layout','Clean and restock washroom'][i],required:true}],reference_photos:[]})));
  if(args.action==='jobs_list')return result([0,1,2].map((n)=>({id:args.property_id+'-clean-'+n,property_id:args.property_id,status:n===0?'submitted':'scheduled',starts_at:demoDate(n*3+1,17),ends_at:demoDate(n*3+1,19),scheduled_start:demoDate(n*3+1,17),scheduled_end:demoDate(n*3+1,19),cleaner_name:d.profiles[10+n].display_name,assigned_to:d.profiles[10+n].id,notes:'Reset the location for the next production.',created_at:DEMO_CLOCK,demo:true})));
  if(args.action==='cleaner_access_list')return {invitations:[{id:'demo-cleaner-invite',email:'crew@example.invalid',status:'pending',created_at:DEMO_CLOCK}],active:[{id:'demo-cleaner-access',cleaner_id:d.profiles[10].id,display_name:d.profiles[10].display_name,status:'active',created_at:demoDate(-30)}],demo:true};
  if(args.action==='equipment_list')return result(['LED panel kit','Tripod and light stands','Portable backdrop','Wardrobe rack','Fresh linen set','Cleaning supplies'].map((name,i)=>({id:args.property_id+'-equipment-'+i,name,category:i<4?'equipment':'supplies',quantity:2+i,included_in_rental:true,add_on_fee_cents:0,offered_to_guests:i<4,consumable:i===5,description:'Fictional on-site production inventory.',demo:true})));
  if(args.action==='agreement_get')return {item:{booking_rules:'Observe the agreed crew capacity. Do not obstruct access routes.',cancellation_terms:'Illustrative terms only; no real booking agreement.',deposit_terms:'No payment or deposit is collected in this demonstration.',cleaning_scope:'Return each room to its agreed condition and remove production waste.'},demo:true};
  if(args.action==='issues_list')return {items:[],demo:true};
  return blocked();
 }
 if(name==='media-gateway'&&['gallery','my_media','list_albums','gallery_comments'].includes(args.action))return {items:[],albums:[],demo:true};
 if(name==='collab-suite'){
  const d=data(),c=args.collaboration_id?requireItem(d.collaborations,args.collaboration_id):null;
  if(args.action==='matches_list')return {items:[],demo:true};
  if(args.action==='travel_list')return {items:clone(session.tables.demo_travel||[{id:'demo-trip-la',user_id:d.self.id,city:'Los Angeles',region:'California',country:'United States',starts_at:demoDate(3),ends_at:demoDate(7),note:'Production sessions with the Los Angeles creative community.',visible_to_members:true}]),has_more:false,blocks:clone(session.tables.ccx_calendar_blocks||[]),demo:true};
  if(args.action==='travel_save'){const start=Date.parse(args.starts_at),end=Date.parse(args.ends_at);if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw Error('Choose valid travel dates.');const rows=session.tables.demo_travel||[];const item={...args,id:args.id||id('travel'),user_id:d.self.id,demo:true};session.tables.demo_travel=[...rows.filter(r=>r.id!==item.id),item];changed();return {item:clone(item),demo:true};}
  if(args.action==='travel_delete'){session.tables.demo_travel=(session.tables.demo_travel||[]).filter(t=>t.id!==args.id);changed();return {demo:true};}
  if(args.action==='notes_get')return {item:{body:c?.demo_notes||'Confirm the location, wardrobe and crew call time. Leave time for a lighting check and individual review of the production plan.',version:c?.notes_version||1},demo:true};
  if(args.action==='notes_save'){if(!c)return blocked();c.demo_notes=String(args.note||'');c.notes_version=(c.notes_version||1)+1;changed();return {version:c.notes_version,demo:true};}
  if(args.action==='testing_list')return result(d.testing.map(t=>({...t,issuer:'Fictional demonstration',status:t.status==='current'?'verified':'expired'})));
  if(args.action==='testing_policy_get')return {policy:{requires_testing:false,tested_within_days:30,deadline_at:null},status:{required:false,ready:false,participants:[]},demo:true};
  if(['intro_inbox','intro_thread','testing_admin_queue'].includes(args.action))return result([]);
  if(args.action==='friend_settings_get')return {settings:{request_policy:'message_first',allow_intro_messages:true},demo:true};
  return blocked();
 }
 if(name==='meeting-suite'){
  const d=data(),members=args.scope==='collaboration'?requireItem(d.collaborations,args.scope_id).participants:[d.self];
  if(args.action==='recording_state')return {participants:members.map(p=>({user_id:p.id,display_name:p.display_name,approved:false})),all_approved:false,recording_ready:false,available:false,demo:true};
  if(args.action==='details')return {participants:members.map(p=>({user_id:p.id,display_name:p.display_name,recording_approved:false})),recording_ready:false,demo:true};
  if(args.action==='notes_get')return {item:{body:'Confirm the production schedule and review individual deliverables.',version:1},demo:true};
  if(args.action==='recordings_list')return result([]);
  if(['status','room_status'].includes(args.action))return {configured:false,available:false,participants:[],demo:true};
  return blocked();
 }
 if(name==='collaboration-safety'&&args.action==='status'){const c=requireItem(data().collaborations,args.collaboration_id);return {item:{status:c.status==='completed'?'left':'not_started',monitored_emergency_response:false,can_check_in:false,schedule_available:Boolean(c.plan),contact_informed_by_member:false},demo:true};}
 if(name==='collaboration-actuals'&&args.action==='list'){const d=data(),c=requireItem(d.collaborations,args.collaboration_id);return {statements:c.status==='completed'?[{id:c.id+'-statement',actor_id:d.self.id,revision:1,recorded_at:c.ends_at,work_completed:'Editorial photography and short-form production completed as planned.',deliverables_completed:c.plan.deliverables,differences_or_concerns:'No changes noted in this fictional demonstration.',disputes:[],demo:true}]:[],demo:true};}
 if(name==='platform-extras'){
  if(args.action==='get_schedule')return {items:[{id:'demo-trip-la',kind:'travel',city:'Los Angeles',country:'United States',starts_at:demoDate(3),ends_at:demoDate(7),title:'Los Angeles production week'}],demo:true};
  if(['get_profile_assets','profile_assets'].includes(args.action))return {assets:{avatar_url:data().self.avatar_url,cover_url:data().self.cover_url},demo:true};
 }

 if(name==='member-workflows')return member(args.action,args);
 if(name==='connect-groups')return groups(args.action,args);
 if(name==='collaboration-workspace')return collaborations(args.action,args);
 if(name==='host-marketplace')return demoHostAction(args.action,args);
 if(name==='ccx-integrations')return integrations(args.action,args);
 if(name==='identity-verification')return identity(args.action);
 if(name==='shop-directory'&&args.action==='list')return result(data().products);
 if(name==='annual-recap'){
  const d=data();if(args.action==='list')return result([{year:2026,as_of:DEMO_CLOCK,year_to_date:true}]);
  if(args.action==='view')return {report:clone(d.recap),demo:true};
  if(args.action==='share_feed'){d.recap.feedPostId='demo-recap-post';if(!d.feed.some(p=>p.id===d.recap.feedPostId))d.feed.unshift({id:d.recap.feedPostId,author_id:d.self.id,author_name:d.self.display_name,author_avatar_url:d.self.avatar_url,body:d.recap.share_text,audience:'verified',created_at:DEMO_CLOCK,photos:[],likes:0,comments:0,demo:true});changed();return {result:{id:d.recap.feedPostId},demo:true};}
  if(args.action==='hide_feed'){d.recap.feedHidden=true;d.feed=d.feed.filter(p=>p.id!==d.recap.feedPostId);changed();return {demo:true};}
  return blocked();
 }
 if(name==='connect-feed'){
  const d=data();if(['list','feed','list_posts','mine','group_feed'].includes(args.action))return {...result(args.profile_id?d.feed.filter(p=>p.author_id===args.profile_id):d.feed),has_more:false};
  if(['comments','list_comments','saved','preferences'].includes(args.action))return result([]);
  if(['like','unlike','save','unsave'].includes(args.action)){const p=requireItem(d.feed,args.post_id);if(args.action==='like'&&!p.liked){p.liked=true;p.likes++;}if(args.action==='unlike'&&p.liked){p.liked=false;p.likes--;}if(args.action==='save')p.saved=true;if(args.action==='unsave')p.saved=false;changed();return {item:clone(p),demo:true};}
  if(args.action==='post')return {item:clone(requireItem(d.feed,args.post_id)),demo:true};
  if(['react','repost','comment'].includes(args.action)){const p=requireItem(d.feed,args.post_id);if(args.action==='react')p.reaction_count++;changed();return {item:clone(p),demo:true};}
  return blocked();
 }
 if(name==='profile-analytics'){
  if(args.action==='record')return {recorded:false,demo:true};
  if(['summary','mine','views','list'].includes(args.action))return {total:248,unique_visitors:84,total_views:248,views_30d:248,views_7d:84,unique_viewers_30d:84,daily_14d:Array.from({length:14},(_,i)=>({date:demoDate(i-13).slice(0,10),views:8+i%9})),items:[],demo:true};
 }
 if(name==='profile-ai'&&args.action==='generate_bio')return {bio:data().self.bio,demo:true};
 // Explicit read-only endpoints with no fixture records yet. No unknown mutation
 // is ever treated as a success, and no demo call contacts a live backend.
 const emptyReads={
  'member-media':['list','albums','list_albums','profile_gallery','gallery','mine'],
  'profile-gallery':['list','albums'], 'friend-messaging':['inbox','list','thread','list_messages','status'],
  'sponsorships':['placement','list','active'], 'ai-matches':['suggest','list'],
  'host-cleaning':['list','dashboard','my_jobs','rooms','cleaners','history'],
  'host-rental-agreements':['list','templates','view','status'],
  'collaboration-testing':['status','mine','list','credentials'],
  'platform-extras':['list','get_schedule','list_schedule','get_profile_assets','get_notifications','get_roster','list_roster'],
  'profile-assets':['list','view'], 'production-workspace':['list','overview']
 };
 if(emptyReads[name]?.includes(args.action))return {items:[],messages:[],albums:[],assets:{},demo:true};
 return blocked();
}
export function demoRpc(name,args={}){
 const d=data(),action=args.p_action||args.action||'load',v=args.p_data||{};
 if(name==='ccx_dashboard_action'){
  if(action==='save'){session.layout=clone(args.p_layout||[]);changed();}
  else if(action!=='load')return blocked();
  const values={profile_views:[248,'84 unique visitors in the last 30 days'],connections:[d.connections.filter(c=>c.status==='accepted').length,'Accepted professional connections'],upcoming:[3,'Upcoming productions in Los Angeles'],testing:[0,'No private submissions awaiting review'],unread_messages:[d.conversations.reduce((n,c)=>n+c.unread_count,0),'Unread messages'],favorites:[d.favoriteIds.length,'Saved professional profiles'],contracts:[d.contracts.filter(c=>c.status!=='signed').length,'Agreements awaiting attention'],collaborations:[d.collaborations.filter(c=>c.status!=='completed').length,'Active production projects'],connection_requests:[d.connections.filter(c=>c.status==='pending').length,'Incoming friend requests'],invitations:[0,'No pending collaboration invitations'],recent_activity:[d.notifications.length,'Updates from your community'],account:['Passed','Illustrative identity and age checks']};
  return {schema_version:1,role:d.self.role_type,revision:1,layout:session.layout||['profile_views','upcoming','testing','connections'].map(id=>({id,width:'normal'})),metrics:Object.fromEntries(Object.entries(values).map(([k,[value,subtitle]])=>[k,{status:'ready',value,subtitle}])),demo:true};
 }
 if(name==='ccx_representation_agreement_action'){
  if(action==='list')return result([d.representation]);
  if(action==='profile_links')return result(v.target_id===d.self.id?[d.agent]:v.target_id===d.agent.id?[d.self]:[]);
  return blocked();
 }
 if(name==='ccx_member_feature_flags')return {flags:{},access:{},account:{},demo:true};
 const readOnlyNames=['ccx_profile_analytics','ccx_member_profile_assets','ccx_my_travel_calendar','ccx_profile_travel_calendar','ccx_member_social_links','ccx_profile_discovery_attributes','ccx_annual_recap_action','ccx_agreement_packets','ccx_production_readiness','ccx_intro_threads','ccx_collaboration_testing','ccx_feed_preferences'];
 if(readOnlyNames.includes(name)&&['load','list','get','mine','view','status','profile','summary'].includes(action))return {items:[],assets:{},preferences:{},demo:true};
 return blocked();
}
function tableRows(table){
 const d=data();
 if(session.tables[table])return session.tables[table];
 if(table==='member_profiles'||table==='creator_profiles')return d.profiles;
 if(table==='creator_favorites')return d.favoriteIds.map(creator_id=>({user_id:d.self.id,creator_id,created_at:DEMO_CLOCK}));
 if(table==='age_verification_requests')return [{id:'demo-age-evidence',user_id:d.self.id,status:'approved',created_at:demoDate(-210),verified_at:demoDate(-210),expires_at:'2027-04-29T12:00:00Z',display_name:d.self.display_name,age:d.self.age,identity_status:'passed',demo:true}];
 if(table==='member_notifications')return d.notifications;
 if(table==='collaborations')return d.collaborations;
 if(table==='collaboration_invitations')return [];
 if(table==='contracts')return d.contracts;
 if(table==='messages')return d.messages;
 if(table==='conversations')return d.conversations;
 if(table==='hc_properties')return d.properties;
 if(table==='hc_bookings')return d.bookings;
 if(table==='connection_requests')return d.connections;
 if(['creator_preferences','member_discovery_attributes','creator_private_preferences'].includes(table))return [{id:d.self.id,user_id:d.self.id,preferred_collaborators:[],content_categories:[],scene_pairings:[],specialties:[],languages:['English'],show_age:true,age:d.self.age}];
 return session.tables[table]||[];
}
/** Minimal PostgREST-compatible projection for existing page components. Filters
 * are evaluated locally; unsupported methods reject rather than reaching the SDK.
 */
function demoQuery(table){
 const started=epoch,filters=[],sorts=[];let single=false,optional=false,limit=null,range=null,options={},operation='read',payload=null;
 const q={
  select(_columns='*',opts={}){options=opts;return q;},eq(key,value){filters.push(r=>r[key]===value);return q;},neq(key,value){filters.push(r=>r[key]!==value);return q;},
  is(key,value){filters.push(r=>r[key]===value||value===null&&r[key]===undefined);return q;},in(key,values){filters.push(r=>values.includes(r[key]));return q;},
  gt(key,value){filters.push(r=>r[key]>value);return q;},gte(key,value){filters.push(r=>r[key]>=value);return q;},lt(key,value){filters.push(r=>r[key]<value);return q;},lte(key,value){filters.push(r=>r[key]<=value);return q;},
  ilike(key,value){const needle=String(value).replaceAll('%','').toLowerCase();filters.push(r=>String(r[key]||'').toLowerCase().includes(needle));return q;},
  order(key,opts={}){sorts.push([key,opts.ascending!==false]);return q;},limit(value){limit=value;return q;},range(from,to){range=[from,to];return q;},
  single(){single=true;return q;},maybeSingle(){single=true;optional=true;return q;},abortSignal(){return q;},
  insert(value){operation='insert';payload=value;return q;},upsert(value){operation='upsert';payload=value;return q;},update(value){operation='update';payload=value;return q;},delete(){operation='delete';return q;},
  then(resolve,reject){return Promise.resolve().then(()=>{
   if(started!==epoch||!session)throw Error('Data mode changed; retry in the current session.');
   let rows=tableRows(table).filter(r=>filters.every(fn=>fn(r)));
   if(operation!=='read'){
    if(table==='creator_favorites'){
     if(operation==='delete'){const ids=new Set(rows.map(r=>r.creator_id));data().favoriteIds=data().favoriteIds.filter(v=>!ids.has(v));}
     else if(operation==='upsert'||operation==='insert'){for(const row of Array.isArray(payload)?payload:[payload]){requireItem(data().profiles,row.creator_id);if(!data().favoriteIds.includes(row.creator_id))data().favoriteIds.push(row.creator_id);}}
     else return blocked();
    }else if(table==='member_profiles'&&operation==='update'){
     if(rows.some(r=>r.id!==DEMO_PERSON_ID))return blocked();
     const allowed=['display_name','stage_name','bio','city','state','country','avatar_path','cover_path','avatar_url','cover_url','updated_at','role_type','real_name','company_name','representative_name'];
     for(const key of Object.keys(payload))if(!allowed.includes(key))throw Error('This account field cannot be changed in demo mode.');
     Object.assign(data().self,payload);for(const kind of ['avatar','cover'])if(payload[kind+'_path'])data().self[kind+'_url']=session.blobs.get(payload[kind+'_path'])||payload[kind+'_path'];Object.assign(data().profiles[0],data().self);
    }else if(['creator_preferences','creator_private_preferences','member_discovery_attributes','member_profile_preferences','creator_production_preferences','member_social_links','ccx_feed_display_preferences'].includes(table)&&['upsert','update'].includes(operation))session.tables[table]=[{...payload,user_id:DEMO_PERSON_ID}];
    else return blocked();
    changed();rows=tableRows(table).filter(r=>filters.every(fn=>fn(r)));
   }
   const count=rows.length;rows=clone(rows);
   for(const [key,ascending] of sorts)rows.sort((a,b)=>String(a[key]??'').localeCompare(String(b[key]??''))*(ascending?1:-1));
   if(range)rows=rows.slice(range[0],range[1]+1);if(limit!==null)rows=rows.slice(0,limit);
   if(single&&!optional&&!rows.length)return {data:null,error:{message:'Demo record not found'},count:0};
   return {data:options.head?null:single?rows[0]||null:rows,error:null,count};
  }).catch(error=>({data:null,error:{message:error.message},count:null})).then(resolve,reject);},
  catch(reject){return q.then(x=>x,reject);}
 };
 return new Proxy(q,{get(target,key){if(key in target)return target[key];if(typeof key==='symbol')return undefined;return()=>{throw Error('This query operation is unavailable in demo mode: '+String(key));};}});
}
function demoChannel(){const c={__demo:true,on(){return c;},subscribe(callback){queueMicrotask(()=>callback?.('SUBSCRIBED'));return c;},unsubscribe:async()=> 'ok',track:async()=> 'ok',untrack:async()=> 'ok',send:async()=> 'ok',presenceState:()=>({})};return c;}
function demoStorage(){return {from(bucket){return {
 async upload(path,file){if(!['member-private','message-media'].includes(bucket)||!(file instanceof Blob)||file.size>20*1024*1024||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type))return {data:null,error:{message:'This upload is unavailable in demo mode.'}};const url=URL.createObjectURL(file);session.blobs.set(path,url);return {data:{path,fullPath:path},error:null};},
 async createSignedUrl(path){const url=session?.blobs.get(path)||(String(path).startsWith('/demo-assets/')?path:null);return url?{data:{signedUrl:url},error:null}:{data:null,error:{message:'No demo file is available.'}};},
 async createSignedUrls(paths){return {data:paths.map(path=>({path,signedUrl:session?.blobs.get(path)||(String(path).startsWith('/demo-assets/')?path:null)})),error:null};},
 async uploadToSignedUrl(){return {data:null,error:{message:'Private evidence uploads are disabled in demo mode.'}};},
 async remove(){return {data:null,error:{message:'Live file changes are disabled in demo mode.'}};},
 getPublicUrl(path){return {data:{publicUrl:session?.blobs.get(path)||null}};}
 };}};}
/** One public SDK boundary; authentication itself is never synthesized. */
export function withDemoData(live){
 if(!live)return null;
 const safe=async handler=>{const generation=epoch;try{const value=handler();await Promise.resolve();if(generation!==epoch)throw Error('Data mode changed; retry.');return {data:clone(value),error:null};}catch(e){return {data:null,error:{message:e.message}};}};
 return new Proxy(live,{get(target,key){
  if(key==='functions')return new Proxy(target.functions,{get(fn,method){if(method==='invoke')return (name,opts={})=>isDemoActive()?safe(()=>demoFunction(name,opts.body||{})):hasDemoIdentifier(opts.body)?Promise.resolve(closedDemoError()):fn.invoke(name,opts);const value=fn[method];return typeof value==='function'?value.bind(fn):value;}});
  if(key==='rpc')return (name,args={})=>isDemoActive()?safe(()=>demoRpc(name,args)):hasDemoIdentifier(args)?Promise.resolve(closedDemoError()):target.rpc(name,args);
  if(key==='from')return table=>isDemoActive()?demoQuery(table):target.from(table);
  if(key==='storage')return isDemoActive()?demoStorage():target.storage;
  if(key==='channel')return (...args)=>isDemoActive()?demoChannel():target.channel(...args);
  if(key==='removeChannel')return channel=>channel?.__demo?Promise.resolve('ok'):target.removeChannel(channel);
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
}

/** Local object URLs are revoked when the administrator leaves demo mode. */
export function createDemoAttachment(conversationId,file){
 const d=data();requireItem(d.conversations,conversationId);
 if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type)||file.size>20*1024*1024)throw Error('Unsupported demo attachment.');
 const key=id('attachment'),url=URL.createObjectURL(file);session.blobs.set(key,url);
 return {id:key,url,name:file.name,mime_type:file.type,size_bytes:file.size,conversation_id:conversationId,demo:true};
}
