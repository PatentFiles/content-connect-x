/** Stable, privacy-restricted year recap presentation contract.
 * Never include health, age documents, DOB, legal identity or private messages.
 * Share copy contains aggregate counts only; never share the owner's full PDF.
 */
export const RECAP_ROLES=Object.freeze({
 creator:'Creator',photographer:'Photographer',videographer:'Videographer',
 video_editor:'Video Editor',agent:'Agent',studio:'Studio'
});
export const RECAP_METRICS=Object.freeze([
 {key:'collaborations',label:'Collaborations',description:'Projects created in the year you participated in'},
 {key:'new_friends',label:'New Friends',description:'Connections accepted in the year'},
 {key:'published_posts',label:'Published Posts',description:'Posts still visible from the year'},
 {key:'completed_projects',label:'Completed Projects',description:'Projects from the year now closed or completed'},
 {key:'featured_portfolio_items',label:'Portfolio Highlights',description:'Featured work added during the year'},
 {key:'shared_media',label:'Approved Media',description:'Verified-audience media approved from the year'},
 {key:'shared_trips',label:'Shared Trips',description:'Trips you marked visible to verified members'},
 {key:'new_representations',label:'New Representation',description:'Active, mutually accepted agreements begun in the year'}
]);
export function safeCount(value){
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>=0&&n<=100000000? n:0;
}
export function normalizeRecap(input){
 if(!input||!Number.isInteger(input.report_year)||input.report_year<2026||input.report_year>2200||
  !Object.hasOwn(RECAP_ROLES,input.role_type))throw Error('Unsupported or invalid annual recap');
 const metrics=Object.fromEntries(RECAP_METRICS.map(x=>[x.key,safeCount(input.metrics?.[x.key])]));
 return {id:typeof input.id==='string'?input.id:'',
  year:input.report_year,role:input.role_type,roleLabel:RECAP_ROLES[input.role_type],
  metrics,feedPostId:typeof input.feed_post_id==='string'?input.feed_post_id:null,
  feedHidden:Boolean(input.feed_hidden_at)};
}
export function recapAchievements(input){
 const r=normalizeRecap(input),m=r.metrics;
 const items=[];
 if(m.collaborations>=1)items.push({title:m.collaborations>=5?'Collaboration Champion':'Creative Collaborator',
  detail:m.collaborations+' projects made with your community'});
 if(m.new_friends>=1)items.push({title:m.new_friends>=5?'Community Connector':'New Connections',
  detail:m.new_friends+' new professional friendships'});
 if(m.published_posts>=1)items.push({title:m.published_posts>=10?'Community Storyteller':'Voice of the Year',
  detail:m.published_posts+' published updates'});
 if(m.featured_portfolio_items>=1)items.push({title:'Portfolio Spotlight',
  detail:m.featured_portfolio_items+' featured portfolio entries'});
 if(m.shared_trips>=1)items.push({title:'On the Move',detail:m.shared_trips+' shared travel plans'});
 if(m.new_representations>=1)items.push({title:r.role==='agent'||r.role==='studio'?'Professional Representation':'New Representation',
  detail:m.new_representations+' mutually accepted relationships'});
 return items.slice(0,4);
}
export function recapShareText(input){
 const r=normalizeRecap(input),m=r.metrics;
 return 'My '+r.year+' Content Connect X Year in Review: '+
  m.collaborations+' collaborations, '+m.new_friends+' new friends, '+
  m.published_posts+' published posts, and '+
  m.featured_portfolio_items+' featured portfolio projects. #CCXYearInReview';
}
export function safePdfText(value,max=90){
 return String(value??'').normalize('NFKD').replace(/[\u0000-\u001f\u007f]/g,' ')
  .replace(/[^\x20-\x7e]/g,'').trim().slice(0,max);
}