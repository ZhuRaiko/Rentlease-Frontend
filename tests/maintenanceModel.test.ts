import {test} from 'node:test';import assert from 'node:assert/strict';
import {PICKER_CATEGORIES,categoryLabel,priorityOf,priorityLabel,deriveTitle,createPayload,reportValid,stepIndex,trackerSteps,requestChip,careActionsFor,statusNote,careErrorMessage,parseMaintenanceInbox,parseMaintenanceRequest,stepTimes,isOpen,tabOf,ageText,URGENCY_OPTIONS} from '../src/features/tenancy/models/Maintenance';
import {countRows,forProperty} from '../src/features/tenancy/models/MaintenanceInbox';
import {formatWhen,shortDate} from '../src/features/tenancy/models/MaintenanceFormat';
import {careCategories,careStatuses,validateCareOperation,type CareStatus} from '../src/features/tenancy/models/TenancyCare';
const U='00000000-0000-4000-8000-000000000001',V='00000000-0000-4000-8000-000000000002';

test('the picker has six categories; structural stays valid and shown, but is not offered',()=>{
  assert.deepEqual([...PICKER_CATEGORIES],['plumbing','electrical','appliance','internet','pests','other']);
  assert.ok((careCategories as readonly string[]).includes('structural'));assert.equal(categoryLabel('structural'),'Structural');assert.equal(categoryLabel('internet'),'Internet');assert.equal(categoryLabel('pests'),'Pests');
});
test('urgency maps Urgent=urgent, Soon=normal, Can wait=low, and high is never produced',()=>{
  assert.deepEqual(URGENCY_OPTIONS.map(o=>[o.label,o.priority]),[['Urgent','urgent'],['Soon','normal'],['Can wait','low']]);
  assert.equal(priorityOf('urgent'),'urgent');assert.equal(priorityOf('soon'),'normal');assert.equal(priorityOf('later'),'low');
  assert.equal(priorityLabel('high'),'Soon');
});
test('title comes from the first sentence or line, cut at a word boundary within 60 characters, else the category',()=>{
  assert.equal(deriveTitle("The kitchen faucet keeps leaking even when it's closed. It started on Monday.",'plumbing'),"The kitchen faucet keeps leaking even when it's closed");
  assert.equal(deriveTitle('Hallway light flickers\nand then goes out','electrical'),'Hallway light flickers');
  const text='The water heater in the second bathroom makes a loud banging noise every morning when it turns on';
  const long=deriveTitle(text,'appliance');
  assert.ok(long.length<=60&&!long.endsWith(' '));assert.ok(text.startsWith(long));
  assert.equal(deriveTitle('..?','internet'),'Internet');
});
test('create payload carries the derived title, trimmed description, category and mapped priority',()=>{
  const p=createPayload({description:'  Wi-Fi keeps dropping every hour.  ',category:'internet',urgency:'later'});
  assert.deepEqual(p,{title:'Wi-Fi keeps dropping every hour',description:'Wi-Fi keeps dropping every hour.',category:'internet',priority:'low'});
  validateCareOperation({operationId:U,tenancyId:V,action:'create',payload:p});
  assert.equal(reportValid('too short'),false);assert.equal(reportValid('x'.repeat(10)),true);assert.equal(reportValid('x'.repeat(2001)),false);
});
test('four-step line for every status',()=>{
  const at:Record<CareStatus,number>={submitted:0,acknowledged:1,reopened:1,needs_information:1,in_progress:2,scheduled:2,resolved:3,cancelled:-1,rejected:-1};
  for(const s of careStatuses)assert.equal(stepIndex(s),at[s],s);
  const steps=(status:CareStatus,confirmed=false,role:'tenant'|'landlord'='tenant')=>trackerSteps({status,confirmed,role,otherName:'Nightcity'});
  assert.deepEqual(steps('submitted').map(s=>s.state),['current','upcoming','upcoming','upcoming']);
  assert.deepEqual(steps('in_progress').map(s=>s.state),['done','done','current','upcoming']);
  assert.deepEqual(steps('cancelled'),[]);
  assert.equal(steps('submitted')[1]!.label,'Seen by Nightcity');assert.equal(steps('submitted',false,'landlord')[1]!.label,'Seen');
});
test('resolved shows who must confirm, and "Fixed · confirmed" once the tenant did',()=>{
  const last=(confirmed:boolean,role:'tenant'|'landlord')=>trackerSteps({status:'resolved',confirmed,role,otherName:'Samuel'}).at(-1)!;
  assert.equal(last(false,'tenant').detail,'Waiting for your confirmation');assert.equal(last(false,'landlord').detail,'Waiting for Samuel to confirm');
  assert.equal(last(true,'tenant').detail,'Fixed · you confirmed');assert.equal(last(true,'landlord').detail,'Fixed · confirmed');
  assert.ok(trackerSteps({status:'resolved',confirmed:true,role:'tenant',otherName:'x'}).every(s=>s.state==='done'));
});
test('red is only for Urgent while open',()=>{
  assert.deepEqual(requestChip({priority:'urgent',status:'submitted',confirmed:false}),{label:'Urgent',tone:'urgent'});
  assert.notEqual(requestChip({priority:'urgent',status:'resolved',confirmed:true})?.tone,'urgent');
  assert.equal(requestChip({priority:'normal',status:'submitted',confirmed:false}),null);
  assert.equal(requestChip({priority:'normal',status:'resolved',confirmed:false})?.label,'Fixed?');
});
test('tabs: open until confirmed; cancelled leaves both',()=>{
  assert.equal(tabOf('submitted',false),'open');assert.equal(tabOf('resolved',false),'open');assert.equal(tabOf('resolved',true),'resolved');assert.equal(tabOf('cancelled',false),'closed');
  assert.equal(isOpen('rejected',false),false);
});
test('actions by role, status and tenancy state',()=>{
  const a=(role:'tenant'|'landlord',status:CareStatus,tenancy:'active'|'ended'|'other'='active',confirmed=false)=>careActionsFor({role,tenancy,status,confirmed});
  assert.deepEqual(a('tenant','submitted'),{reply:true,seen:false,start:false,resolve:false,confirm:false,notFixed:false,cancel:true});
  assert.equal(a('tenant','in_progress').cancel,false);
  for(const s of ['submitted','acknowledged','reopened'] as const)assert.equal(a('tenant',s).cancel,true,s);
  assert.equal(a('tenant','resolved').confirm,true);assert.equal(a('tenant','resolved').notFixed,true);
  assert.equal(a('tenant','resolved','active',true).confirm,false);
  assert.equal(a('tenant','resolved','ended').confirm,true);
  assert.equal(a('tenant','resolved','ended').notFixed,false);assert.equal(a('tenant','submitted','ended').reply,false);assert.equal(a('tenant','submitted','ended').cancel,true);
  assert.equal(a('landlord','submitted').seen,true);assert.equal(a('landlord','submitted').start,true);
  assert.equal(a('landlord','in_progress').seen,false);assert.equal(a('landlord','in_progress').resolve,true);
  assert.equal(a('landlord','resolved').resolve,false);assert.equal(a('landlord','resolved').reply,true);
  assert.equal(a('landlord','submitted','ended').start,false);
  for(const role of ['tenant','landlord'] as const)assert.ok(Object.values(a(role,'submitted','other')).every(v=>!v));
  for(const s of ['cancelled','rejected'] as const)assert.ok(Object.values(a('tenant',s)).every(v=>!v));
});
test('landlord status control: typed note, else the default for that status',()=>{
  assert.equal(statusNote('','acknowledged'),'Seen');assert.equal(statusNote('   ','in_progress'),'Work started');assert.equal(statusNote('','resolved'),'Marked as fixed');assert.equal(statusNote(' Plumber tomorrow ','in_progress'),'Plumber tomorrow');
});
test('server codes become plain sentences, never raw text',()=>{
  assert.equal(careErrorMessage('40001'),'This changed while you were looking. Updated.');assert.equal(careErrorMessage('22023'),'This request was already updated.');assert.equal(careErrorMessage('42501'),'This isn’t available right now.');
  assert.doesNotMatch(careErrorMessage('XX000'),/XX000|exception/i);
});
const row=(o:any={})=>({id:U,tenancyId:V,propertyId:U,title:'Leaking faucet',category:'plumbing',priority:'urgent',status:'submitted',tenantConfirmedAt:null,createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',revision:V,tenancyEnded:false,lastNote:null,...o});
const counts={open:1,inProgress:0,awaitingConfirmation:0,resolved:0,urgentOpen:1};
test('inbox parser is strict about keys and values',()=>{
  const ok=parseMaintenanceInbox({counts,rows:[row()],hasMore:false});assert.equal(ok.rows[0]!.title,'Leaking faucet');
  assert.throws(()=>parseMaintenanceInbox({counts,rows:[row({extra:1})],hasMore:false}));
  assert.throws(()=>parseMaintenanceInbox({counts,rows:[row({category:'garden'})],hasMore:false}));
  assert.throws(()=>parseMaintenanceInbox({counts:{...counts,open:-1},rows:[],hasMore:false}));
  assert.throws(()=>parseMaintenanceInbox({counts,rows:Array(21).fill(row()),hasMore:false}));
  assert.equal(parseMaintenanceInbox({counts,rows:[row({priority:'high'})],hasMore:false}).rows[0]!.priority,'normal');
});
test('request parser checks the id and keeps roles, not ids',()=>{
  const req={id:U,tenancyId:V,propertyId:U,title:'t',description:'d',category:'structural',priority:'low',status:'resolved',landlordResponse:null,scheduledFor:null,resolvedAt:null,tenantConfirmedAt:null,createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',revision:V,tenancyEnded:false,role:'tenant'};
  const thread=[{id:V,role:'landlord',fromStatus:null,status:'submitted',note:'hi',at:'2026-11-17T01:00:00Z'}];
  assert.equal(parseMaintenanceRequest({request:req,thread,hasMore:false},U).thread[0]!.role,'landlord');
  assert.throws(()=>parseMaintenanceRequest({request:req,thread,hasMore:false},V));
  assert.throws(()=>parseMaintenanceRequest({request:{...req,actorId:U},thread,hasMore:false},U));
});
test('inbox counts and property filter keep the server order',()=>{
  const rows=[row({id:'a',propertyId:'p1'}),row({id:'b',propertyId:'p2',status:'in_progress',priority:'normal'}),row({id:'c',propertyId:'p1',status:'resolved',tenantConfirmedAt:'2026-11-17T02:00:00Z'}),row({id:'d',propertyId:'p1',status:'resolved'})] as any[];
  assert.deepEqual(forProperty(rows,'p1').map(r=>r.id),['a','c','d']);assert.equal(forProperty(rows,null).length,4);
  assert.deepEqual(countRows(forProperty(rows,'p1')),{open:2,inProgress:0,awaitingConfirmation:1,resolved:1,urgentOpen:2});
});
test('step times come from the thread and ages and dates are in Philippine time',()=>{
  const t=stepTimes([{id:'1',role:'landlord',fromStatus:'submitted',status:'acknowledged',note:'Seen',at:'2026-11-17T02:00:00Z'},{id:'2',role:'landlord',fromStatus:'acknowledged',status:'in_progress',note:'x',at:'2026-11-17T03:00:00Z'}],'2026-11-17T01:00:00Z',s=>s.slice(11,16));
  assert.deepEqual(t,{sent:'01:00',seen:'02:00',progress:'03:00'});
  const now=Date.parse('2026-11-17T04:00:00Z');
  assert.equal(formatWhen('2026-11-16T23:12:00Z',now),'Today 7:12 AM');assert.equal(formatWhen('2026-11-09T01:00:00Z',now),'Nov 9, 9:00 AM');assert.equal(shortDate('2026-11-09T01:00:00Z'),'Nov 9');
  assert.equal(ageText('2026-11-17T02:00:00Z',now),'2h ago');assert.equal(ageText('2026-11-14T04:00:00Z',now),'3d ago');
});
