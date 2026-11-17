import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {colors} from '../src/shared/theme/colors';
import {CHIP,stayProgress,tenancyChip,tenantNeedsOk} from '../src/features/tenancy/models/TenancyPresentation';
import {CHIP_COLORS} from '../src/shared/theme/statusColors';
import {TILE_COLORS} from '../src/features/tenancy/components/tileColors';
import {dueLabel,shortDate} from '../src/shared/utils/rentalDates';
import {cancelledLine,cancelledRentals,releaseSheetView,releaseTarget} from '../src/features/tenancy/models/CancelledRentals';
import {attentionItems,workspaceScreen,type WorkspaceInput} from '../src/features/tenancy/models/TenancyWorkspaceScreen';
import {detailsScreen} from '../src/features/tenancy/models/TenancyDetailsScreen';
import {tenancySections,tenancyCounts} from '../src/features/tenancy/models/TenancyWorkspace';
import {createTenancyReleaseWorkflow} from '../src/features/tenancy/viewModels/tenancyReleaseWorkflow';
import {emptyActivity} from '../src/features/tenancy/services/tenancyActivityService';

const L='00000000-0000-4000-8000-00000000000a',T='00000000-0000-4000-8000-00000000000b',P='00000000-0000-4000-8000-0000000000c1',LI='00000000-0000-4000-8000-0000000000d1',C='00000000-0000-4000-8000-0000000000e1';
const NOW=Date.parse('2026-11-16T04:00:00Z');
let n=0;const id=()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;
const tenancy=(over:any={}):any=>({id:id(),property_id:P,listing_id:LI,conversation_id:C,tenant_id:T,landlord_id:L,status:'active',start_date:'2026-11-12',expected_end_date:'2027-11-11',actual_end_date:null,agreed_monthly_rent:10000,rent_due_day:2,tenant_confirmed_at:null,landlord_confirmed_at:null,listingTitle:'Miguel House',...over});
const reservation=(over:any={}):any=>({id:id(),conversationId:C,listingId:LI,propertyId:P,tenantId:T,landlordId:L,listingTitle:'Garcia Apartment',moveInDate:'2026-11-25',durationMonths:1,endDate:'2026-12-25',status:'approved',storedStatus:'approved',expiresAt:'2026-12-25T00:00:00Z',serverNow:'2026-11-16T04:00:00Z',revision:3,history:[],message:null,responseNote:null,applicantLabel:'Renter',applicantTier1:true,applicantTier2:false,...over});
const ctx=(title='Miguel House'):any=>({title,listingStatus:'active',property:{id:P,type:'boarding_house',city:'tagaytay',barangay:'Bayan Luma',bedrooms:1,bathrooms:1,floorArea:20,furnishing:'unfurnished',active:true},photos:[],notice:null});
const ident=(nickname:string,uid:string):any=>({id:uid,nickname,avatarUrl:null,avatarPath:null});
const input=(actor:string,over:Partial<WorkspaceInput>={}):WorkspaceInput=>({actor,tenancies:[],reservations:[],links:[],contexts:{},identities:{[L]:ident('Nightcity',L),[T]:ident('Samuel',T)},activity:emptyActivity(),now:NOW,...over});
const request=(over:any={}):any=>({id:id(),title:'Leaking faucet',description:'Leaks',category:'plumbing',priority:'urgent',status:'submitted',response:null,revision:id(),createdAt:'2026-11-16T02:00:00Z',updatedAt:'2026-11-16T02:00:00Z',...over});
const care=(t:any,requests:any[]):any=>({tenancyId:t.id,tenantId:T,landlordId:L,status:'active',today:'2026-11-16',schedule:[],obligations:[],obligationsLimited:false,reminders:[],requests});
const life=(t:any,pending:any=null,events:any[]=[]):any=>({tenancyId:t.id,tenantId:T,landlordId:L,status:'active',today:'2026-11-16',startDate:t.start_date,expectedEndDate:t.expected_end_date,actualEndDate:null,endedAt:null,version:'a'.repeat(32),pending,events});
const review=(t:any,own:any[]=[]):any=>({tenancyId:t.id,propertyId:P,tenantId:T,landlordId:L,eligible:true,own,received:[],legacyUserReview:false});
const given=(kind:'property'|'user',rating=5):any=>({id:id(),kind,rating,text:'Nice',revision:id(),createdAt:'2026-11-14T00:00:00Z',status:'approved',propertyId:kind==='property'?P:null,updatedAt:null,moderatedAt:null,history:[],tags:[]});

// ---- Chips and tiles
test('status is a chip: each state maps to its label and an existing token tone', () => {
  assert.deepEqual(tenancyChip(tenancy({status:'active'}),T),CHIP.active);assert.deepEqual(tenancyChip(tenancy({status:'ended'}),T),CHIP.ended);assert.deepEqual(tenancyChip(tenancy({status:'cancelled'}),T),CHIP.cancelled);
  const waiting=tenancy({status:'pending_confirmation',landlord_confirmed_at:'2026-11-15T00:00:00Z'});
  assert.deepEqual(tenancyChip(waiting,T),CHIP.needsOk,'the tenant is asked'); assert.deepEqual(tenancyChip(waiting,L),CHIP.upcoming,'the landlord is not'); assert.equal(tenantNeedsOk(waiting,L),false);
  assert.deepEqual([CHIP.active.label,CHIP.upcoming.label,CHIP.needsOk.label,CHIP.ended.label,CHIP.cancelled.label],['Active','Upcoming','Needs your OK','Ended','Cancelled']);
  const allowed=new Set(Object.values(colors));for(const c of Object.values(CHIP_COLORS))for(const v of Object.values(c))assert.ok(allowed.has(v as never),`${v} is a theme token`);
  assert.equal(CHIP_COLORS.positive.color,colors.primaryAction);assert.equal(CHIP_COLORS.restricted.color,colors.restricted);assert.equal(CHIP_COLORS.info.backgroundColor,colors.identitySurface);
});
test('summary tiles: Upcoming blue (identity tokens), Active filled with the action green, Past neutral', () => {
  assert.equal(TILE_COLORS.upcoming.backgroundColor,colors.identitySurface);assert.equal(TILE_COLORS.upcoming.color,colors.identityInk);
  assert.equal(TILE_COLORS.active.backgroundColor,colors.primaryAction);assert.equal(TILE_COLORS.active.color,colors.white);
  assert.equal(TILE_COLORS.past.backgroundColor,colors.surface);
});
test('dates read the way the wireframe does: Dec 2 · in 16 days, Day 5 of 365', () => {
  assert.equal(dueLabel('2026-12-02',NOW),'Dec 2 · in 16 days');assert.equal(shortDate('2026-11-25'),'Nov 25');
  assert.deepEqual(stayProgress('2026-11-12','2027-11-11',NOW)?.day,5);assert.equal(stayProgress('2026-11-12','2027-11-11',NOW)?.total,365);assert.equal(stayProgress('2026-11-12',null,NOW),null);
});

// ---- Sections, counts, cancelled once
test('section order is fixed: attention, then the active stay, upcoming, past; tiles count the same sections', () => {
  const active=tenancy(),ended=tenancy({status:'ended',actual_end_date:'2026-11-13'}),gone=tenancy({status:'cancelled'});
  const s=workspaceScreen(input(T,{tenancies:[active,ended,gone],contexts:{[active.id]:ctx()}}));
  assert.deepEqual(s.order,['attention','active','upcoming','past']);assert.deepEqual(s.tiles,[{kind:'upcoming',count:0},{kind:'active',count:1},{kind:'past',count:2}]);
  assert.equal(s.activeTitle,'Active stay');
  assert.equal(workspaceScreen(input(L,{tenancies:[active]})).activeTitle,'Active stays');
});
test('a cancelled rental appears once, under Past, and never under Upcoming', () => {
  const gone=tenancy({status:'cancelled'}),held=reservation({listingTitle:'Dela Cruz Unit'}),ended=tenancy({status:'ended',actual_end_date:'2026-11-13'});
  const links=[{reservation_id:held.id,tenancy_id:gone.id}];
  const sections=tenancySections(T,[gone,ended],[held],NOW,links);
  assert.equal(sections.upcoming.length,0,'the held reservation is not listed as upcoming');assert.deepEqual(sections.past.map(x=>x.status),['cancelled','ended'],'cancelled first');
  const s=workspaceScreen(input(T,{tenancies:[gone,ended],reservations:[held],links}));
  assert.equal(s.upcoming.length,0);assert.equal(s.past.filter(p=>p.chip.label==='Cancelled').length,1);assert.equal(tenancyCounts(sections).past,2);assert.equal(s.tiles[0]!.count,0);
  // Without link data (older backend) nothing is inferred: the reservation stays an upcoming commitment.
  assert.equal(tenancySections(T,[gone],[held],NOW,null).upcoming.length,1);
});

// ---- Cancelled rental: buttons, release target, sheet
test('cancelled card: tenant gets Start a new request, Find similar, Message; landlord gets Release it and Message', () => {
  const gone=tenancy({status:'cancelled'}),held=reservation(),links=[{reservation_id:held.id,tenancy_id:gone.id}],base={tenancies:[gone],reservations:[held],links,contexts:{[gone.id]:ctx('Dela Cruz Unit')}};
  const tenant=workspaceScreen(input(T,base)).past[0]!,landlord=workspaceScreen(input(L,base)).past[0]!;
  assert.deepEqual(tenant.buttons,[{key:'start_request',label:'Start a new request',primary:true},{key:'find_similar',label:'Find similar',primary:false},{key:'message',label:'Message',primary:false}]);
  assert.deepEqual(landlord.buttons,[{key:'release',label:'Release it',primary:true},{key:'message',label:'Message',primary:false}]);
  assert.equal(tenant.note,'Setup was cancelled. The reservation is still held, so a new request is blocked.');assert.equal(landlord.note,'The reservation is still held for Nov 12, 2026 – Nov 11, 2027.');
  assert.deepEqual(tenant.similar,{city:'tagaytay',type:'boarding_house'},'Find similar uses the same city and property type');
  const noChat=workspaceScreen(input(T,{...base,tenancies:[{...gone,conversation_id:null}],reservations:[{...held,conversationId:null}]})).past[0]!;
  assert.deepEqual(noChat.buttons.map(b=>b.key),['find_similar'],'no conversation, no buttons that would do nothing');
  const released=workspaceScreen(input(L,{...base,reservations:[{...held,status:'cancelled'}]})).past[0]!;
  assert.deepEqual(released.buttons.map(b=>b.key),['message'],'nothing left to release');assert.equal(released.note,'Setup was cancelled.');
});
test('releaseTarget: held only while the reservation is effectively approved', () => {
  const gone=tenancy({status:'cancelled'}),r=reservation(),links=[{reservation_id:r.id,tenancy_id:gone.id}];
  assert.equal(releaseTarget(gone,links,[r],NOW).needsRelease,true);assert.equal(releaseTarget(gone,links,[r],NOW).reservation?.id,r.id);
  assert.equal(releaseTarget(gone,links,[{...r,status:'cancelled'}],NOW).needsRelease,false);assert.equal(releaseTarget(gone,links,[{...r,expiresAt:'2026-11-01T00:00:00Z'}],NOW).needsRelease,false,'expired');
  assert.equal(releaseTarget(gone,null,[r],NOW).needsRelease,false,'no link data');assert.equal(cancelledLine('tenant',false,'x'),'Setup was cancelled.');
});
test('the release sheet says why in plain words and names the effect; the landlord sees the owner wording', () => {
  const tenant=releaseSheetView('tenant',{listing:'Dela Cruz Unit',range:'Nov 14 – Dec 14',other:'Em Cee'}),landlord=releaseSheetView('landlord',{listing:'Dela Cruz Unit',range:'Nov 14 – Dec 14',other:'Em Cee'});
  assert.equal(tenant.title,'Release the old reservation?');assert.equal(tenant.body,'Your approved reservation for Dela Cruz Unit (Nov 14 – Dec 14) is still held, even though the setup was cancelled. To ask again, we release it first.');
  assert.equal(tenant.note,'After this, a new request opens to Em Cee. Nothing is deleted. Your chat history stays.');assert.deepEqual([tenant.confirmLabel,tenant.keepLabel],['Release and request again','Keep it for now']);
  assert.equal(landlord.title,'Release the reservation held for Em Cee?');
});

// ---- Release workflow: success, failure with Retry, no loop
const wait=()=>new Promise<void>(r=>setImmediate(r));
const req=():any=>({tenancyId:id(),role:'tenant',reservationId:id(),revision:3,conversationId:C,listing:'Dela Cruz Unit',range:'Nov 14 – Dec 14',other:'Em Cee'});
test('release then request: the existing cancel is called once with the reservation and revision, then the request opens', async () => {
  const calls:any[]=[],opened:any[]=[];let ids=0;
  const flow=createTenancyReleaseWorkflow({cancelReservation:async(a,op)=>{calls.push([a,op]);}},T,()=>`op-${++ids}`,r=>opened.push(r.conversationId));
  const r=req();flow.ask(r);assert.equal(flow.getSnapshot().request,r);await flow.confirm();
  assert.equal(calls.length,1);assert.deepEqual(calls[0],[T,{id:'op-1',reservationId:r.reservationId,revision:3}]);assert.deepEqual(opened,[C]);assert.equal(flow.getSnapshot().request,null);assert.equal(flow.getSnapshot().error,null);
});
test('release failure: one amber line, the sheet stays, Retry repeats the same operation, and nothing retries by itself', async () => {
  const ops:string[]=[],opened:string[]=[];let fail=true;
  const flow=createTenancyReleaseWorkflow({cancelReservation:async(_a,op)=>{ops.push(op.id);if(fail)throw new Error('offline');}},T,()=>'op-1',r=>opened.push(r.tenancyId));
  flow.ask(req());await flow.confirm();
  assert.equal(flow.getSnapshot().error,'Couldn’t release the reservation');assert.equal(flow.getSnapshot().saving,false);assert.ok(flow.getSnapshot().request,'the sheet stays open');assert.deepEqual(opened,[]);
  for(let i=0;i<5;i++)await wait();assert.equal(ops.length,1,'no automatic second try');
  fail=false;await flow.retry();assert.deepEqual(ops,['op-1','op-1'],'Retry repeats the same operation id');assert.equal(opened.length,1);assert.equal(flow.getSnapshot().request,null);
});
test('release: a second tap while saving does nothing; Keep it for now closes without calling anything', async () => {
  let release!:()=>void,calls=0;const flow=createTenancyReleaseWorkflow({cancelReservation:()=>{calls++;return new Promise<void>(r=>{release=r;});}},T,()=>'op',()=>{});
  flow.ask(req());const first=flow.confirm();void flow.confirm();void flow.retry();flow.keep();assert.equal(calls,1);assert.equal(flow.getSnapshot().saving,true);assert.ok(flow.getSnapshot().request,'Keep is ignored while saving');release();await first;
  const other=createTenancyReleaseWorkflow({cancelReservation:async()=>{calls++;}},T,()=>'op',()=>{});other.ask(req());other.keep();await other.confirm();assert.equal(calls,1);assert.equal(other.getSnapshot().request,null);
});

// ---- Rating prompt
test('ended rentals ask for a rating until it is given, then show one line', () => {
  const ended=tenancy({status:'ended',actual_end_date:'2026-11-13',start_date:'2026-11-12'}),base={tenancies:[ended],contexts:{[ended.id]:ctx('Miguel House')}};
  const tenant=workspaceScreen(input(T,{...base,activity:{...emptyActivity(),reviews:{[ended.id]:review(ended)}}})).past[0]!;
  assert.deepEqual(tenant.prompt,{title:'Rate Miguel House',body:'Your rating helps the next renter. Takes under a minute.',button:'Rate your stay'});assert.deepEqual(tenant.buttons.map(b=>[b.key,b.label,b.primary]),[['rate','Rate your stay',true],['view','View',false]]);
  const landlord=workspaceScreen(input(L,{...base,activity:{...emptyActivity(),reviews:{[ended.id]:review(ended)}}})).past[0]!;
  assert.deepEqual([landlord.prompt?.title,landlord.prompt?.button],['Rate Nightcity'.replace('Nightcity','Samuel'),'Rate your tenant']);
  const rated=workspaceScreen(input(T,{...base,activity:{...emptyActivity(),reviews:{[ended.id]:review(ended,[given('property',5)])}}})).past[0]!;
  assert.equal(rated.prompt,null);assert.equal(rated.subtitle,'Rated 5.0 · Nov 12 – Nov 13');assert.deepEqual(rated.buttons.map(b=>[b.key,b.label]),[['rate','Your review'],['view','View']],'a rated rental opens the review screen again');
  const unknown=workspaceScreen(input(T,base)).past[0]!;assert.equal(unknown.prompt,null,'review state not read: no prompt');assert.equal(unknown.subtitle,'Nightcity · Nov 12 – Nov 13');
});

// ---- Attention list and Needs your OK
test('attention for the landlord: urgent maintenance first, then a setup to start, then an end request; nothing waiting means nothing shown', () => {
  const stay=tenancy(),held=reservation({listingTitle:'Garcia Apartment',propertyId:'00000000-0000-4000-8000-0000000000c2'});
  const activity={care:{[stay.id]:care(stay,[request({priority:'normal',title:'Door sticks',createdAt:'2026-11-15T00:00:00Z'}),request({priority:'urgent'}),request({status:'resolved',title:'Old'})])},lifecycle:{[stay.id]:life(stay,{id:id(),revision:id(),initiatorId:T,date:'2026-11-16',reason:'Need to leave',version:'a'.repeat(32)})},reviews:{},rent:{}};
  const items=attentionItems(input(L,{tenancies:[stay],reservations:[held],contexts:{[stay.id]:ctx()},activity}));
  assert.deepEqual(items.map(x=>[x.kind,x.title,x.chip.label]),[['maintenance','Leaking faucet','Urgent'],['start_setup','Set up tenancy','Do now'],['end_request','Early-end request','Reply'],['maintenance','Door sticks','Open']]);
  assert.equal(items[0]!.subtitle,'Miguel House · Samuel · 2h ago');assert.equal(items[1]!.subtitle,'Garcia Apartment · Samuel approved');
  assert.deepEqual(attentionItems(input(L,{tenancies:[stay],activity:{...emptyActivity(),care:{[stay.id]:care(stay,[request({status:'resolved'})])}}})),[]);
  assert.equal(workspaceScreen(input(L,{tenancies:[stay],activity})).attention.length,3,'the setup row needs the reservation');assert.equal(workspaceScreen(input(L,{tenancies:[stay]})).attention.length,0);
});
test('Needs your OK (tenant): the setup waiting for the tenant, an end request from the landlord, a request that needs more information; never other people\'s items', () => {
  const stay=tenancy(),pending=tenancy({status:'pending_confirmation',landlord_confirmed_at:'2026-11-15T00:00:00Z',start_date:'2026-11-25',listingTitle:'Garcia Apartment'}),r=reservation();
  const activity={care:{[stay.id]:care(stay,[request({status:'needs_information',priority:'normal'}),request({status:'submitted'})])},lifecycle:{[stay.id]:life(stay,{id:id(),revision:id(),initiatorId:L,date:'2026-11-16',reason:'Selling',version:'a'.repeat(32)})},reviews:{},rent:{}};
  const s=workspaceScreen(input(T,{tenancies:[stay,pending],reservations:[r],links:[{reservation_id:r.id,tenancy_id:pending.id}],activity}));
  assert.deepEqual(s.needsOk.map(x=>[x.kind,x.title,x.buttonLabel]),[['confirm_terms','Confirm your tenancy terms','Review terms'],['end_request','Early-end request','Reply'],['maintenance','Leaking faucet','Open']]);
  assert.equal(s.needsOk[0]!.subtitle,'Garcia Apartment · move-in Nov 25. Nightcity shared the terms.');assert.equal(s.needsOk[0]!.chip.label,'Needs your OK');assert.deepEqual(s.needsOk[0]!.action,{kind:'setup',reservationId:r.id});
  assert.equal(s.attention.length,0,'the landlord list is for landlords');
  assert.equal(workspaceScreen(input(T,{tenancies:[stay]})).needsOk.length,0);
});
test('active stay: the primary action follows the role and Details is always secondary', () => {
  const stay=tenancy(),base={tenancies:[stay],contexts:{[stay.id]:ctx()}};
  const t=workspaceScreen(input(T,base)).active[0]!,l=workspaceScreen(input(L,base)).active[0]!;
  assert.deepEqual([t.primary,t.secondary,t.other.relation,t.other.label],[{kind:'report',label:'Report an issue'},{label:'Details'},'Landlord','Nightcity']);
  assert.deepEqual([l.primary,l.other.relation,l.other.label],[{kind:'open_property',label:'Open property'},'Tenant','Samuel']);
  assert.deepEqual([t.rent,t.nextDue,t.place],['₱10,000 / mo','Dec 2 · in 16 days','Bayan Luma, Tagaytay · Boarding house']);
});

// ---- Details screen
test('details, active (tenant): summary, actions, rent schedule only, people, maintenance, documents, end early last', () => {
  const stay=tenancy(),res=reservation({history:[]});
  const d=detailsScreen({actor:T,tenancy:stay,context:ctx(),identities:{[L]:ident('Nightcity',L)},care:care(stay,[request({status:'acknowledged',priority:'normal'})]),lifecycle:life(stay),reviews:null,reservation:res,conversationId:C,now:NOW});
  assert.equal(d.chip.label,'Active');assert.equal(d.dates.progress?.label,'Day 5 of 365');assert.deepEqual(d.actions,{primary:{kind:'report',label:'Report an issue'},message:true});
  assert.deepEqual(d.rent,{dueOn:'Due on the 2nd',rows:['Dec 2 · in 16 days','Jan 2 · in 47 days','Feb 2 · in 78 days'],note:'This is the agreed schedule. The rent ledger records what each person says and does not move money.'});
  assert.deepEqual([d.person.relation,d.person.label],['Landlord','Nightcity']);assert.deepEqual(d.maintenance,{chip:'1 open',latest:{title:'Leaking faucet',meta:'Seen by landlord · 2h ago'}});
  assert.deepEqual(d.documents.map(x=>x.label),['Property information','Source reservation','Lifecycle history']);assert.equal(d.endEarly,true);assert.equal(d.ratingPrompt,null);assert.equal(d.timeline,null);
  assert.ok(!JSON.stringify(d).includes(res.id),'the raw reservation id is never shown');assert.ok(!/paid/i.test(JSON.stringify(d.rent)),'no I\'ve-paid action or ledger');
});
test('details, active (landlord): Open property is primary; the people card names the tenant', () => {
  const stay=tenancy(),d=detailsScreen({actor:L,tenancy:stay,context:ctx(),identities:{[T]:ident('Samuel',T)},care:null,lifecycle:null,reviews:null,reservation:null,conversationId:null,now:NOW});
  assert.deepEqual(d.actions,{primary:{kind:'open_property',label:'Open property'},message:false});assert.equal(d.person.relation,'Tenant');assert.equal(d.maintenance?.latest,null);assert.deepEqual(d.documents.map(x=>x.label),['Property information','Lifecycle history']);
});
test('details, ended (landlord): rating prompt first, one reviews card, a timeline, read-only, no end-early button', () => {
  const ended=tenancy({status:'ended',actual_end_date:'2026-11-13',start_date:'2026-11-12',expected_end_date:'2027-11-11'});
  const events=[{id:id(),actorId:L,action:'request_end',requestId:null,date:'2026-11-13',reason:'I can’t pay anymore',createdAt:'2026-11-13T01:00:00Z'},{id:id(),actorId:T,action:'accept',requestId:null,date:'2026-11-13',reason:'Ok',createdAt:'2026-11-13T02:00:00Z'}];
  const res=reservation({history:[{action:'approve',actorId:L,at:'2026-11-07T03:00:00Z',status:'approved',note:null}]});
  const d=detailsScreen({actor:L,tenancy:ended,context:ctx(),identities:{[T]:ident('Samuel',T)},care:null,lifecycle:life(ended,null,events),reviews:review(ended),reservation:res,conversationId:C,now:NOW});
  assert.deepEqual(d.ratingPrompt,{title:'Rate Samuel',body:'One rating per tenancy. It helps other landlords decide.',button:'Rate your tenant'});
  assert.equal(d.summary,'Ended early by mutual agreement. Rent was ₱10,000 / month.');assert.equal(d.endEarly,false);assert.equal(d.actions,null);assert.equal(d.rent,null);assert.equal(d.maintenance,null);assert.equal(d.openConversation,true);
  assert.deepEqual(d.timeline!.map(e=>[e.label,e.date,e.note]),[['Reservation approved','Nov 7',null],['Tenancy confirmed and started','Nov 12',null],['You asked to end early','Nov 13','“I can’t pay anymore”'],['Samuel accepted · tenancy ended','Nov 13','“Ok”']]);
  assert.deepEqual(d.documents.map(x=>x.label),['Property information','Source reservation','Rent ledger']);assert.deepEqual(d.reviews,[]);
  const rated=detailsScreen({actor:L,tenancy:ended,context:ctx(),identities:{[T]:ident('Samuel',T)},care:null,lifecycle:null,reviews:review(ended,[given('user',4)]),reservation:null,conversationId:null,now:NOW});
  assert.equal(rated.ratingPrompt,null);assert.deepEqual(rated.reviews!.map(r=>[r.label,r.status,r.rating]),[['Your review of Samuel','Published',4]]);
});

test('details, ended: your own review with its tags and status, then the other persons approved review, named from the tenancy people', () => {
  const ended=tenancy({status:'ended',actual_end_date:'2026-11-13',start_date:'2026-11-12'});
  const mine={...given('user',4),status:'pending',text:'Easy to deal with',tags:['respectful','paid_on_time']};
  const theirs={id:id(),kind:'property',rating:5,text:'Lovely place',tags:['clean','mystery'],createdAt:'2026-11-14T00:00:00Z',reviewerRole:'tenant'};
  const landlord=detailsScreen({actor:L,tenancy:ended,context:ctx(),identities:{[T]:ident('Samuel',T)},care:null,lifecycle:null,reviews:{...review(ended,[mine]),received:[theirs,{...theirs,id:id(),kind:'user'}]},reservation:null,conversationId:null,now:NOW});
  assert.deepEqual(landlord.reviews!.map(r=>[r.label,r.status,r.rating,r.tags]),[['Your review of Samuel','Pending review',4,['Respectful','Paid on time']],["Samuel's review of this property",null,5,['Clean']]],'an older tenant review of the landlord is not shown');
  const aboutMe={...theirs,kind:'user',tags:['respectful']};
  const tenant=detailsScreen({actor:T,tenancy:ended,context:ctx(),identities:{[L]:ident('Nightcity',L)},care:null,lifecycle:null,reviews:{...review(ended,[]),received:[aboutMe]},reservation:null,conversationId:null,now:NOW});
  assert.deepEqual(tenant.reviews!.map(r=>[r.label,r.tags]),[["Nightcity's review of you",['Respectful']]]);
  const rejected=detailsScreen({actor:L,tenancy:ended,context:ctx(),identities:{[T]:ident('Samuel',T)},care:null,lifecycle:null,reviews:review(ended,[{...mine,status:'rejected'}]),reservation:null,conversationId:null,now:NOW});
  assert.equal(rejected.reviews![0]!.status,'Not published','a rejected review says only "Not published"');
});

// ---- View: what the tab renders (no Refresh buttons, no removed panels, state-colored tiles)
function renderWorkspace(vm:any,scale=1,width=411){
  const file=resolve('src/features/tenancy/views/TenancyWorkspaceView.tsx'),mod={exports:{} as any};
  const mock=(key:string):any=>{
    if(key==='react')return{useEffect:()=>{},useState:(v:any)=>[v,()=>{}],useRef:(v:any)=>({current:v})};
    if(key==='react/jsx-runtime'){const jsx=(type:any,props:any)=>typeof type==='function'?type(props):({type,props});return{jsx,jsxs:jsx};}
    if(key==='react-native')return new Proxy({StyleSheet:{create:(x:any)=>x},useWindowDimensions:()=>({width,height:800,fontScale:scale})},{get:(x:any,k)=>x[k]??k});
    if(key.includes('useTenancyWorkspaceViewModel'))return{useTenancyWorkspaceViewModel:()=>vm};
    if(key.includes('models/TenancyPresentation'))return require('../src/features/tenancy/models/TenancyPresentation');
    if(key.endsWith('/tileColors'))return require('../src/features/tenancy/components/tileColors');
    if(key.endsWith('/colors'))return{colors:{}};if(key.endsWith('/ui'))return{ui:{}};if(key.endsWith('/radius'))return{radius:{}};if(key.endsWith('/spacing'))return{spacing:{}};
    return new Proxy({},{get:(_x,k)=>String(k)}); // every other import is a named stand-in: each component stays an element named after itself
  };
  new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(mock,mod,mod.exports);
  return mod.exports.TenancyWorkspaceView({accountId:vm.actor,onBack(){},onDiscover(){},onListings(){},onPost(){},onChat(){},registerBackAction(){}});
}
const nodes=(v:any):any[]=>v&&typeof v==='object'?[v,...[v.props?.children].flat(Infinity).flatMap(nodes)]:[];
const texts=(tree:any)=>nodes(tree).filter(x=>x.type==='Text').map(x=>[x.props.children].flat(Infinity).join(''));
const vmFor=(actor:string,i:Partial<WorkspaceInput>,over:any={})=>({actor,busy:false,loaded:!over.busy,refreshError:null,error:null,contextWarning:null,links:i.links??[],screen:workspaceScreen(input(actor,i)),release:{request:null,saving:false,error:null,confirm(){},retry(){},keep(){}},startRequest(){},refresh(){},...over});
test('the tab shows state tiles, no removed panels and no Refresh button; headings follow the fixed order', () => {
  const stay=tenancy(),gone=tenancy({status:'cancelled'}),tree=renderWorkspace(vmFor(T,{tenancies:[stay,gone],contexts:{[stay.id]:ctx()}}));
  const all=texts(tree);for(const removed of ['What you can do here','Maintenance Requests','Upcoming Rentals','Cancelled Rentals','Rental History'])assert.ok(!all.includes(removed),`${removed} is gone`);
  assert.ok(!nodes(tree).some(x=>/refresh/i.test(String(x.props?.label??'')+String(x.props?.accessibilityLabel??''))),'no Refresh buttons: pull to refresh instead');
  const headers=nodes(tree).filter(x=>x.props?.accessibilityRole==='header').map(x=>[x.props.children].flat(Infinity).join(''));assert.deepEqual(headers,['Active stay','Miguel House','Upcoming','Past'],'Active, Upcoming, Past in order (the stay card title is the second heading)');
  const tiles=nodes(tree).filter(x=>x.type==='Pressable'&&/rentals: /.test(String(x.props.accessibilityLabel)));assert.equal(tiles.length,3);
  assert.deepEqual(tiles.map(x=>x.props.style.at(-1).backgroundColor),[TILE_COLORS.upcoming.backgroundColor,TILE_COLORS.active.backgroundColor,TILE_COLORS.past.backgroundColor]);
  assert.ok(nodes(tree).some(x=>x.type==='ScrollView'&&x.props.refreshControl),'pull to refresh');
});
test('loading or failed: no zero counts are invented and the error has Retry', () => {
  const tree=renderWorkspace(vmFor(T,{},{error:'Request failed'}));
  assert.ok(!nodes(tree).some(x=>/rentals: 0/.test(String(x.props?.accessibilityLabel))));assert.ok(nodes(tree).some(x=>x.props?.accessibilityRole==='alert'));
  assert.ok(nodes(tree).some(x=>x.type==='StatusButton'&&x.props.label==='Retry'));
});
test('the tab shows Needs your OK first for the tenant and the attention list first for the landlord, only when something waits', () => {
  const pending=tenancy({status:'pending_confirmation',landlord_confirmed_at:'2026-11-15T00:00:00Z'}),r=reservation(),links=[{reservation_id:r.id,tenancy_id:pending.id}];
  const tenant=renderWorkspace(vmFor(T,{tenancies:[pending],reservations:[r],links}));
  assert.ok(texts(tenant).includes('Confirm your tenancy terms'));assert.ok(nodes(tenant).some(x=>x.type==='StatusButton'&&x.props.label==='Review terms'&&x.props.tone==='warning'));
  const order=nodes(tenant).filter(x=>x.type==='StatusChip'||(x.props?.accessibilityRole==='header')).map(x=>x.type==='StatusChip'?'chip':[x.props.children].flat(Infinity).join(''));assert.equal(order[0],'chip','the Needs your OK card comes before the first section heading');
  assert.ok(!texts(renderWorkspace(vmFor(T,{}))).includes('Confirm your tenancy terms'),'nothing waiting, no card');
  const stay=tenancy(),landlord=renderWorkspace(vmFor(L,{tenancies:[stay],activity:{...emptyActivity(),care:{[stay.id]:care(stay,[request()])}}}));
  assert.ok(texts(landlord).includes('Needs your attention'));assert.ok(!texts(renderWorkspace(vmFor(L,{tenancies:[stay]}))).includes('Needs your attention'));
});
test('Report an issue opens the report form in one tap and Open property the property screen', () => {
  const src=readFileSync('src/features/tenancy/views/TenancyWorkspaceView.tsx','utf8');
  assert.match(src,/s\.primary\.kind==='report'\?open\(s\.id,'report'\):onOpenProperty\?\.\(s\.propertyId\)/);
});

// ---- Polish pass
test('empty Active and Upcoming collapse into one muted line with a link-style Chat row; Past stays', () => {
  const tree=renderWorkspace(vmFor(T,{}));
  const headers=nodes(tree).filter(x=>x.props?.accessibilityRole==='header').map(x=>[x.props.children].flat(Infinity).join(''));
  assert.deepEqual(headers,['Past'],'no Active or Upcoming headings when both are empty');
  assert.equal(texts(tree).filter(s=>s==='No active or upcoming rentals right now.').length,1);
  const link=nodes(tree).find(x=>x.type==='Pressable'&&x.props.accessibilityRole==='link');assert.ok(link,'Browse reservations in Chat is a link-style row');assert.deepEqual(texts(link),['Browse reservations in Chat']);
  assert.ok(!nodes(tree).some(x=>x.type==='Text'&&/No approved reservations or tenancy setups/.test(String(x.props.children))),'not the second grey line');
});
test('with only one of Active and Upcoming empty, both headings stay (so each tile still has its section)', () => {
  const stay=tenancy(),tree=renderWorkspace(vmFor(T,{tenancies:[stay],contexts:{[stay.id]:ctx()}}));
  const headers=nodes(tree).filter(x=>x.props?.accessibilityRole==='header').map(x=>[x.props.children].flat(Infinity).join(''));
  assert.ok(headers.includes('Active stay')&&headers.includes('Upcoming')&&headers.includes('Past'));assert.ok(texts(tree).includes('No approved reservations or tenancy setups waiting to start.'));
});
test('cancelled card: the primary (Start a new request for the tenant, Release it for the landlord) is the one filled green button; Message and Find similar stay outlined', () => {
  const gone=tenancy({status:'cancelled'}),held=reservation(),links=[{reservation_id:held.id,tenancy_id:gone.id}],base={tenancies:[gone],reservations:[held],links,contexts:{[gone.id]:ctx('Dela Cruz Unit')}};
  for(const actor of [T,L]){
    const tree=renderWorkspace(vmFor(actor,base)),buttons=nodes(tree).filter(x=>x.type==='StatusButton'&&/: Dela Cruz Unit$/.test(String(x.props.accessibilityLabel)));
    assert.deepEqual(buttons.map(b=>[b.props.label,b.props.tone]),actor===T?[['Start a new request','primary'],['Find similar','secondary'],['Message','secondary']]:[['Release it','primary'],['Message','secondary']]);
  }
});
// Style values live in .tsx files the test runner cannot import, so this one reads the source (a source-text test, kept to the spacing rules only).
test('spacing uses the theme: 16dp card padding and between sections, 12dp between rows of buttons, 48dp buttons that wrap', () => {
  const parts=readFileSync('src/shared/components/StatusParts.tsx','utf8'),view=readFileSync('src/features/tenancy/views/TenancyWorkspaceView.tsx','utf8'),spacing=readFileSync('src/shared/theme/spacing.ts','utf8');
  assert.match(spacing,/sm: 12/);assert.match(spacing,/md: 16/);
  assert.match(parts,/row:\{flexDirection:'row',flexWrap:'wrap',gap:spacing\.sm\}/);assert.match(parts,/cells:\{flexDirection:'row',flexWrap:'wrap',gap:spacing\.sm\}/);assert.match(parts,/slot:\{flexGrow:1,flexBasis:130\}/);assert.match(parts,/button:\{minHeight:48/);
  assert.match(view,/content:\{padding:spacing\.md,gap:spacing\.md/);assert.match(view,/card:\{\.\.\.ui\.panel,padding:spacing\.md,gap:spacing\.sm/);
});

test('large text or a narrow screen: the chip moves under the title instead of squeezing it, and the tiles wrap', () => {
  const gone=tenancy({status:'cancelled'}),held=reservation(),base={tenancies:[gone],reservations:[held],links:[{reservation_id:held.id,tenancy_id:gone.id}],contexts:{[gone.id]:ctx('Dela Cruz Unit')}};
  const chipPlace=(tree:any)=>{const head=nodes(tree).find(x=>x.type==='View'&&[x.props.children].flat(Infinity).some((c:any)=>c?.type==='Thumb'));const direct=[head.props.children].flat(Infinity).filter(Boolean);return direct.some((c:any)=>c.type==='StatusChip')?'beside':'under';};
  assert.equal(chipPlace(renderWorkspace(vmFor(T,base))),'beside','normal text: the chip is beside the title, as drawn');
  assert.equal(chipPlace(renderWorkspace(vmFor(T,base),1.5,411)),'under','150% font');assert.equal(chipPlace(renderWorkspace(vmFor(T,base),1,320)),'under','320dp wide');
  const wide=nodes(renderWorkspace(vmFor(T,base),1.5)).filter(x=>x.type==='Pressable'&&/rentals: /.test(String(x.props.accessibilityLabel)));assert.ok(wide.every(x=>x.props.style[1]?.flexBasis===130),'tiles take a wider basis so they wrap');
});

// ---- Mutation pass: rules the first suite did not pin down
test('mutation pass: who is asked, what is shown, and how long a stay is',()=>{
  const pending=tenancy({status:'pending_confirmation',landlord_confirmed_at:null,tenant_confirmed_at:null});
  assert.equal(tenantNeedsOk(pending,T),false,'the owner has not confirmed yet, so the renter is not asked');
  assert.equal(tenantNeedsOk({...pending,landlord_confirmed_at:'2026-11-15T00:00:00Z'},L),false,'never the landlord');
  assert.equal(stayProgress('2026-11-20','2027-11-19',NOW)?.day,1,'before the start it reads day 1, not day 0');
  assert.equal(stayProgress('2026-11-12','2026-11-01',NOW),null,'an end before the start has no progress');
  const stranger=id(),gone=tenancy({status:'cancelled'});
  assert.deepEqual(cancelledRentals(stranger,[gone]),[]);assert.deepEqual(cancelledRentals(T,[gone]),[gone]);
  const held=reservation({conversationId:C}),noChat=tenancy({status:'cancelled',conversation_id:null});
  assert.equal(releaseTarget(noChat,[{reservation_id:held.id,tenancy_id:noChat.id}],[held],NOW).conversationId,C,'the reservation chat is used when the tenancy has none');
  assert.equal(cancelledLine('tenant',false,'Nov 14 – Dec 14'),'Setup was cancelled.');
});
test('mutation pass: attention items only for the person who must act',()=>{
  const waiting=tenancy({status:'pending_confirmation',landlord_confirmed_at:'2026-11-15T00:00:00Z',tenant_confirmed_at:null});
  assert.deepEqual(attentionItems(input(T,{tenancies:[waiting],links:[]})),[],'no reservation link, no Confirm item');
  assert.equal(attentionItems(input(T,{tenancies:[waiting],links:[{reservation_id:id(),tenancy_id:waiting.id}]})).some(x=>x.kind==='confirm_terms'),true);
  const approved=reservation({tenantId:T,landlordId:L});
  assert.equal(attentionItems(input(T,{reservations:[approved]})).some(x=>x.kind==='start_setup'),false,'the renter never sets up the tenancy');
  assert.equal(attentionItems(input(L,{reservations:[approved]})).some(x=>x.kind==='start_setup'),true);
  const stay=tenancy(),mine={care:{},lifecycle:{[stay.id]:life(stay,{id:id(),revision:id(),initiatorId:T,date:'2026-11-16',reason:'Moving',version:'a'.repeat(32)})},reviews:{},rent:{}};
  assert.equal(attentionItems(input(T,{tenancies:[stay],activity:mine})).some(x=>x.kind==='end_request'),false,'your own early-end request is not waiting on you');
  assert.equal(attentionItems(input(L,{tenancies:[stay],activity:mine})).some(x=>x.kind==='end_request'),true);
});
test('mutation pass: details only show what fits the stage of the tenancy',()=>{
  const base={context:ctx(),identities:{[L]:ident('Nightcity',L),[T]:ident('Samuel',T)},care:null,lifecycle:null,reviews:null,reservation:null,conversationId:C,now:NOW};
  const active=tenancy(),ended=tenancy({status:'ended',actual_end_date:'2026-11-13'});
  assert.equal(detailsScreen({...base,actor:T,tenancy:active,reviews:review(active)}).ratingPrompt,null,'no rating while the stay is active');
  assert.equal(detailsScreen({...base,actor:T,tenancy:active}).openConversation,false,'an active stay has Message, not Open conversation');
  assert.equal(detailsScreen({...base,actor:T,tenancy:ended}).dates.progress,null,'no progress bar after the end');
  const done=[{id:id(),actorId:L,action:'complete',requestId:null,date:'2026-11-13',reason:null,createdAt:'2026-11-13T01:00:00Z'}];
  assert.match(detailsScreen({...base,actor:T,tenancy:ended,lifecycle:life(ended,null,done)}).summary!,/^Completed at the end/,'a completed stay is not an early end');
  const upcoming=tenancy({status:'pending_confirmation',rent_due_day:2,landlord_confirmed_at:null,tenant_confirmed_at:null});
  assert.equal(detailsScreen({...base,actor:L,tenancy:upcoming}).rent?.dueOn,'Due on the 2nd','an upcoming tenancy shows its agreed rent day');
  const open=detailsScreen({...base,actor:T,tenancy:active,care:care(active,[request({status:'resolved'}),request({status:'cancelled'}),request({status:'submitted'})])});
  assert.equal(open.maintenance?.chip,'1 open','closed requests are not open');
});
test('mutation pass: a failed release is retried with its own operation id, and a new request gets a new one',async()=>{
  const ops:string[]=[];let n=0,fail=true;
  const flow=createTenancyReleaseWorkflow({cancelReservation:async(_a,op)=>{ops.push(op.id);if(fail)throw new Error('offline');}},T,()=>`op-${++n}`,()=>{});
  flow.ask(req());await flow.confirm();await flow.retry();assert.deepEqual(ops,['op-1','op-1'],'the retry is the same operation');
  flow.ask(req());await flow.confirm();assert.equal(ops[2],'op-2','another reservation is a new operation');
  fail=false;await flow.retry();assert.equal(ops[3],'op-2');
});

// ---- Themes pass: titles of your own review card
test('your own review card is titled "Your review" for a property, and keeps the tenant\'s name when a landlord rates a tenant',()=>{
  const ended=tenancy({status:'ended',actual_end_date:'2026-11-13'}),mine={...given('property',5),status:'pending'};
  const tenant=detailsScreen({actor:T,tenancy:ended,context:ctx(),identities:{[L]:ident('Nightcity',L)},care:null,lifecycle:null,reviews:review(ended,[mine]),reservation:null,conversationId:null,now:NOW});
  assert.deepEqual(tenant.reviews!.map(r=>[r.label,r.status]),[['Your review','Pending review']]);
  const landlord=detailsScreen({actor:L,tenancy:ended,context:ctx(),identities:{[T]:ident('Samuel',T)},care:null,lifecycle:null,reviews:review(ended,[{...given('user',4),status:'approved'}]),reservation:null,conversationId:null,now:NOW});
  assert.deepEqual(landlord.reviews!.map(r=>[r.label,r.status]),[['Your review of Samuel','Published']]);
});

test('first load with nothing cached: placeholders stand where the tiles and sections will be, never "--" or "appear after loading"',()=>{
  const tree=renderWorkspace(vmFor(T,{},{busy:true})),all=texts(tree),blocks=nodes(tree).filter(n=>n.type==='SkeletonBlock');
  assert.ok(blocks.length>=6,'three tile counts and the three sections');assert.ok(!all.includes('--'));assert.ok(!all.some(t=>/appear after loading succeeds/.test(t)));
  assert.ok(!nodes(tree).some(n=>n.type==='ActivityIndicator'),'no spinner in place of content');
});
test('cached data on screen while it refreshes: the cards stay, the counts show, only a small refresh hint appears',()=>{
  const stay=tenancy(),tree=renderWorkspace(vmFor(T,{tenancies:[stay],contexts:{[stay.id]:ctx()}},{busy:true,loaded:true})),hint=nodes(tree).find(n=>n.type==='RefreshHint');
  assert.ok(hint&&hint.props.refreshing===true&&hint.props.failed===false);assert.ok(!nodes(tree).some(n=>n.type==='SkeletonBlock'),'no placeholders when data is on screen');assert.ok(!texts(tree).includes('--'));
  assert.ok(nodes(tree).some(n=>n.props?.accessibilityLabel&&/Active rentals: 1/.test(String(n.props.accessibilityLabel))),'the tile shows the cached count');
});
test("a refresh that failed with data on screen: the data stays and the hint offers a quiet retry (no error card)",()=>{
  const stay=tenancy(),tree=renderWorkspace(vmFor(T,{tenancies:[stay],contexts:{[stay.id]:ctx()}},{busy:false,loaded:true,refreshError:'offline'})),hint=nodes(tree).find(n=>n.type==='RefreshHint');
  assert.ok(hint&&hint.props.failed===true&&hint.props.refreshing===false);assert.ok(!texts(tree).includes('offline'));assert.ok(!nodes(tree).some(n=>n.props?.accessibilityRole==='alert'));
});
