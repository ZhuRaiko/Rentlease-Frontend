import test from 'node:test';
import assert from 'node:assert/strict';
import {createTenancyMoveInWorkflow} from '../src/features/tenancy/viewModels/tenancyMoveInWorkflow';
import {createTenancyEstablishmentWorkflow} from '../src/features/tenancy/viewModels/tenancyEstablishmentWorkflow';
import {setupActions,type SetupContext} from '../src/features/tenancy/models/TenancyEstablishment';
import {setupScreen} from '../src/features/tenancy/models/TenancySetupScreen';
import {attentionItems,type WorkspaceInput} from '../src/features/tenancy/models/TenancyWorkspaceScreen';
import {emptyActivity} from '../src/features/tenancy/services/tenancyActivityService';
import {GENERIC_ERROR,INVALID_DATE,LOAD_ERROR,MoveInError,NOT_ALLOWED,RELOADING,UNAVAILABLE,decisionPayload,inMoveInBounds,mapMoveInError,moveInBounds,moveInScreen,moveInSheetView,parseMoveIn,parseMoveInWrite,parsePendingMoveIns,requestPayload,respondView,validateMoveInOperation,weekdayDate,type MoveInOperation,type MoveInRead} from '../src/features/tenancy/models/TenancyMoveIn';

const U=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const TENANT=U(1),OWNER=U(2),TEN=U(3),REQ=U(4),REV=U(5),REV2=U(6),PROP=U(7),RES=U(8),LISTING=U(9),CONV=U(10);
const TODAY='2026-11-21',NOW=Date.parse('2026-11-21T04:00:00Z');
const tick=()=>new Promise<void>(r=>setImmediate(r));
const request=(over:object={})=>({id:REQ,status:'pending',requestedStartDate:'2026-11-22',baseStartDate:'2026-11-25',note:null,decisionNote:null,requestedBy:'tenant',requestedByMe:false,whoDecided:null,revision:REV,createdAt:'2026-11-21T01:00:00Z',decidedAt:null,conflictDate:null,canAccept:true,canDecline:true,canWithdraw:false,...over});
const readOf=(role:'tenant'|'landlord',req:object|null=null,over:object={}):MoveInRead=>({tenancyId:TEN,role,currentStartDate:'2026-11-25',earliestDate:TODAY,canRequest:!req,cannotRequestReason:req?'request_pending':null,request:req as MoveInRead['request'],history:[],...over});
const stay={moveOut:'2027-02-24',rent:25000,dueDay:25};

// ---- parsing the shapes the server returns
test('get_tenancy_move_in is parsed strictly: a wrong tenancy, role, date or flag is refused',()=>{
  const wire={tenancyId:TEN,role:'tenant',currentStartDate:'2026-11-25',earliestDate:TODAY,canRequest:false,cannotRequestReason:'request_pending',history:[{action:'request',by:'tenant',byMe:true,startDate:'2026-11-22',note:'Dry run',at:'2026-11-21T01:00:00Z'}],
    request:{id:REQ,status:'pending',requestedStartDate:'2026-11-22',baseStartDate:'2026-11-25',note:'Dry run',decisionNote:null,requestedBy:'tenant',requestedByMe:true,whoDecided:null,revision:REV,createdAt:'2026-11-21T01:00:00Z',decidedAt:null,conflictDate:null,canAccept:false,canDecline:false,canWithdraw:true}};
  const ok=parseMoveIn(wire,TEN);assert.equal(ok.currentStartDate,'2026-11-25');assert.equal(ok.request?.canWithdraw,true);assert.equal(ok.history[0]!.action,'request');
  const without=parseMoveIn({...wire,history:undefined,request:null,canRequest:true,cannotRequestReason:null},TEN);assert.deepEqual([without.request,without.history],[null,[]]);
  for(const broken of [{...wire,tenancyId:U(99)},{...wire,role:'admin'},{...wire,currentStartDate:'2026-02-30'},{...wire,canRequest:'yes'},{...wire,request:{...wire.request,requestedByMe:1}},{...wire,history:[{action:'steal'}]},null,[]])assert.throws(()=>parseMoveIn(broken,TEN),MoveInError);
});
test('the pending feed and write results are parsed; a result that does not match the action is "not confirmed"',()=>{
  const row={tenancyId:TEN,propertyId:PROP,requestId:REQ,requestedStartDate:'2026-11-22',currentStartDate:'2026-11-25',requestedBy:'landlord',createdAt:'2026-11-21T01:00:00Z',conflictDate:null};
  assert.equal(parsePendingMoveIns({rows:[row],hasMore:false})[0]!.requestedBy,'landlord');assert.throws(()=>parsePendingMoveIns({rows:[{...row,requestedBy:'x'}]}));assert.throws(()=>parsePendingMoveIns({rows:new Array(51).fill(row)}));
  const result={requestId:REQ,status:'pending',requestedStartDate:'2026-11-22',currentStartDate:'2026-11-25',revision:REV};
  assert.equal(parseMoveInWrite(result,'request').status,'pending');
  for(const action of ['accept','decline','withdraw'] as const){try{parseMoveInWrite(result,action);assert.fail('should refuse');}catch(e){assert.ok(e instanceof MoveInError&&e.uncertain,action);}}
  assert.throws(()=>validateMoveInOperation({tenancyId:'x',operationId:U(1),action:'request',payload:{}}),MoveInError);
});
test('payloads are exactly what the RPC accepts; a note is trimmed, capped and left out when empty',()=>{
  assert.deepEqual(requestPayload('2026-11-22'),{requestedStartDate:'2026-11-22'});assert.deepEqual(requestPayload('2026-11-22','  Soon  '),{requestedStartDate:'2026-11-22',note:'Soon'});assert.deepEqual(requestPayload('2026-11-22','   '),{requestedStartDate:'2026-11-22'});
  assert.deepEqual(decisionPayload(REQ,REV),{requestId:REQ,revision:REV});assert.deepEqual(decisionPayload(REQ,REV,'No'),{requestId:REQ,revision:REV,note:'No'});assert.equal(decisionPayload(REQ,REV,'x'.repeat(2000)).note!.length,1000);
});

// ---- the date window
test('the picker allows only today (from the server) through the day before the current move-in',()=>{
  const b=moveInBounds({earliestDate:TODAY,currentStartDate:'2026-11-25'});assert.deepEqual(b,{earliest:TODAY,latest:'2026-11-24'});
  assert.equal(inMoveInBounds('2026-11-20',b),false,'before today');assert.equal(inMoveInBounds(TODAY,b),true);assert.equal(inMoveInBounds('2026-11-24',b),true);assert.equal(inMoveInBounds('2026-11-25',b),false,'the current move-in itself');assert.equal(inMoveInBounds('2027-01-01',b),false);
  assert.deepEqual(moveInBounds({earliestDate:TODAY,currentStartDate:'2026-11-22'}),{earliest:TODAY,latest:TODAY},'start tomorrow: only today');
  assert.equal(moveInBounds({earliestDate:TODAY,currentStartDate:TODAY}),null,'already today: nothing to pick');assert.equal(inMoveInBounds(TODAY,null),false);
  assert.equal(weekdayDate('2026-11-21'),'Sat, Nov 21');assert.equal(weekdayDate('2026-11-22'),'Sun, Nov 22');
});
test('dates stay Manila calendar days: the bounds use the server date and add no time-zone shift around midnight',()=>{
  // 2026-11-20 17:00 UTC is already Nov 21 in Manila: the screens never compute "today" themselves, they take earliestDate from the server.
  const r=readOf('tenant',null,{earliestDate:'2026-11-21'});assert.deepEqual(moveInBounds(r),{earliest:'2026-11-21',latest:'2026-11-24'});
  assert.equal(moveInBounds({earliestDate:'2026-12-31',currentStartDate:'2027-01-02'})!.latest,'2027-01-01','year boundary');
});
test('the sheet shows today, the window, what stays the same and a neutral line about who has to agree',()=>{
  const v=moveInSheetView(readOf('tenant'),stay,'Samuel')!;
  assert.equal(v.today.sub,'Sat, Nov 21');assert.equal(v.pickSub,'Before Nov 25');assert.equal(v.moveOutLine,'Move-out stays Feb 24');assert.equal(v.rentLine,'Rent stays ₱25,000 / month, due on the 25th');
  assert.equal(v.agree,'Samuel has to agree. Nothing changes until they do.');assert.doesNotMatch(v.agree,/\b(he|she|him|her)\b/i);assert.equal(v.range,'You can pick Nov 21 to Nov 24.');
  for(const line of [v.moveOutLine,v.rentLine])assert.equal(typeof line,'string','each check line is a single text run');
  assert.equal(moveInSheetView(readOf('tenant',null,{currentStartDate:TODAY}),stay,'Samuel'),null);assert.equal(moveInSheetView(null,stay,'Samuel'),null);
  assert.equal(moveInSheetView(readOf('tenant'),{moveOut:null,rent:null,dueDay:null},'Samuel')!.rentLine,'Rent stays the same');
});

// ---- when the button shows and what each state looks like
const screenOf=(read:MoveInRead|null,over:object={})=>moveInScreen({read,enabled:true,busy:false,ready:true,loadFailed:false,partnerName:'Samuel',stay,now:NOW,...over});
test('Ask to move in earlier shows only when the server says canRequest, and never while a request is pending or the other person has to answer',()=>{
  assert.equal(screenOf(readOf('tenant')).ask,true);
  assert.equal(screenOf(readOf('tenant',request({requestedByMe:true,canWithdraw:true,canAccept:false,canDecline:false}))).ask,false,'my request is waiting');
  assert.equal(screenOf(readOf('tenant',request())).ask,false,'the other person asked: I answer instead');
  for(const reason of ['already_started','early_end_pending','not_scheduled','not_confirmed','ended'])assert.equal(screenOf(readOf('tenant',null,{canRequest:false,cannotRequestReason:reason})).ask,false,reason);
  assert.equal(screenOf(readOf('landlord')).ask,true,'the owner can ask too');
});
test('nothing shows until the tenancy exists and the read has worked: loading, failed (with a retry) and off are separate states',()=>{
  assert.deepEqual(screenOf(null,{enabled:false}),{load:'off',start:null,ask:false,banner:null,respond:null});
  assert.equal(screenOf(null).load,'loading');assert.equal(screenOf(null,{loadFailed:true}).load,'failed');assert.equal(screenOf(null,{loadFailed:true}).ask,false);
  const ready=screenOf(readOf('tenant'));assert.equal(ready.load,'ready');assert.equal(ready.start,'2026-11-25','the start date is the tenancy\'s, from the read');
  assert.equal(LOAD_ERROR,"We couldn't load the move-in details.");
});
test('board 04: my pending request is an amber "Waiting for <name>" card with Withdraw request',()=>{
  const b=screenOf(readOf('tenant',request({requestedByMe:true,canWithdraw:true,canAccept:false,canDecline:false}))).banner;
  assert.deepEqual(b,{kind:'waiting',title:'Waiting for Samuel',headline:'You asked to move in on Nov 22',body:'The move-in stays Nov 25 until Samuel agrees.',canWithdraw:true});
});
test('boards 09 and 10: after an accept the new date shows, "moved to today" says the stay can start, and it fades after 14 days',()=>{
  const accepted=(over:object,read:object={})=>screenOf(readOf('tenant',request({status:'accepted',requestedByMe:true,whoDecided:'landlord',decidedAt:'2026-11-21T02:00:00Z',canAccept:false,canDecline:false,canWithdraw:false,...over}),{currentStartDate:'2026-11-22',canRequest:true,cannotRequestReason:null,...read})).banner;
  assert.deepEqual(accepted({}),{kind:'accepted',movedToToday:false,headline:'Move-in moved to Nov 22',body:'Samuel agreed. Move-out and rent are unchanged.'});
  assert.deepEqual(accepted({},{currentStartDate:TODAY}),{kind:'accepted',movedToToday:true,headline:'Move-in moved to today',body:'Samuel agreed. You can start the stay now.'});
  assert.equal((accepted({requestedByMe:false,requestedBy:'landlord',whoDecided:'tenant'}) as any).body,'You agreed. Move-out and rent are unchanged.','the person who accepted is told so');
  assert.equal(accepted({decidedAt:'2026-10-01T00:00:00Z'}),null,'an old decision is not repeated');
  assert.equal(screenOf(readOf('tenant',request({status:'accepted',requestedByMe:true,whoDecided:'landlord',decidedAt:'2026-11-21T02:00:00Z',canAccept:false,canDecline:false}),{currentStartDate:'2026-11-22',canRequest:true,cannotRequestReason:null})).ask,true,'the button stays while the stay is still ahead');
});
test('board 11: a decline shows the note to the asker only, says the date is unchanged, and the button stays so it is never a dead end',()=>{
  const declined=(over:object)=>screenOf(readOf('tenant',request({status:'declined',requestedByMe:true,whoDecided:'landlord',decisionNote:'I need the room cleaned first.',decidedAt:'2026-11-21T02:00:00Z',canAccept:false,canDecline:false,...over}),{canRequest:true,cannotRequestReason:null}));
  const s=declined({});assert.deepEqual(s.banner,{kind:'declined',headline:'Samuel declined your request',note:'I need the room cleaned first.',body:'The move-in is still Nov 25. You can ask again.'});assert.equal(s.ask,true);
  assert.equal((declined({decisionNote:null}).banner as any).note,null);
  assert.equal(declined({requestedByMe:false,requestedBy:'landlord'}).banner,null,'the person who declined sees no banner');
  assert.equal(declined({decidedAt:'2026-10-01T00:00:00Z'}).banner,null);
});

// ---- the other person's decision screen
test('boards 06 to 08: Accept needs a clear date; a clash or a passed date turns Accept off and leaves Decline on',()=>{
  const ok=respondView(readOf('landlord',request({requestedBy:'tenant'})),'Maria',stay)!;
  assert.deepEqual([ok.state,ok.canAccept,ok.canDecline,ok.alert],['ok',true,true,null]);
  assert.deepEqual([ok.headline,ok.now,ok.asks,ok.moveOutLine,ok.longer,ok.rentLine],['Maria asks to move in earlier','Nov 25','Sun, Nov 22','Move-out stays Feb 24','the stay is 3 days longer','Rent stays ₱25,000 / month, due on the 25th']);
  const clash=respondView(readOf('landlord',request({conflictDate:'2026-11-23',canAccept:false})),'Maria',stay)!;
  assert.deepEqual([clash.state,clash.canAccept,clash.canDecline],['clash',false,true]);
  assert.deepEqual(clash.alert,{title:"Nov 22 can't work",body:"Another stay on this property starts Mon, Nov 23. Decline and ask Maria to pick a later date.",first:'First blocked: Nov 23',asked:'Nov 22 asked'});
  const passed=respondView(readOf('landlord',request({requestedStartDate:'2026-11-20',canAccept:false}),{}),'Maria',stay)!;
  assert.deepEqual([passed.state,passed.canAccept,passed.canDecline],['passed',false,true]);assert.equal(passed.alert!.title,'Nov 20 has passed');assert.equal(passed.alert!.first,null);
  const blocked=respondView(readOf('landlord',request({canAccept:false})),'Maria',stay)!;assert.deepEqual([blocked.state,blocked.canAccept,blocked.canDecline],['blocked',false,true]);
  const closed=respondView(readOf('landlord',request({canAccept:true,canDecline:false})),'Maria',stay)!;assert.equal(closed.canDecline,false,'Decline follows the server too');
  assert.equal(respondView(readOf('tenant',request({requestedByMe:true})),'Maria',stay),null,'the asker never answers their own request');assert.equal(respondView(readOf('landlord'),'Maria',stay),null);
  assert.equal(respondView(readOf('landlord',request({status:'declined'})),'Maria',stay),null,'only a pending request is answered');
  assert.equal(screenOf(readOf('landlord',request())).ask,false,'the answering screen replaces the Ask button');assert.equal(screenOf(readOf('landlord',request())).respond!.state,'ok');
});

// ---- the workflow: operation ids, retry, check status, mapped errors
function fake(opts:{reads?:(MoveInRead|Error)[];writes?:(object|Error)[]}={}){
  const reads=[...(opts.reads??[readOf('tenant')])],writes=[...(opts.writes??[])],ops:MoveInOperation[]=[];let readCalls=0;
  const service:any={
    read:async()=>{readCalls++;const next=reads.length>1?reads.shift()!:reads[0]!;if(next instanceof Error)throw next;return next;},
    write:async(_a:string,op:MoveInOperation)=>{ops.push(op);const next=writes.shift();if(next instanceof Error)throw next;return next??{requestId:REQ,status:'pending',requestedStartDate:'2026-11-22',currentStartDate:'2026-11-25',revision:REV};},
  };
  return {service,ops,readCalls:()=>readCalls};
}
const ids=()=>{let n=100;return()=>U(n++);};
const make=(f:ReturnType<typeof fake>,over:Partial<{actor:string|undefined;enabled:boolean}>={},written?:()=>void)=>createTenancyMoveInWorkflow(f.service,{actor:TENANT,tenancyId:TEN,enabled:true,...over},ids(),written);
const mine=(over:object={})=>request({requestedByMe:true,canWithdraw:true,canAccept:false,canDecline:false,...over});

test('a request sends a fresh operation id and exactly the date, reads again, and tells the screen it changed',async()=>{
  let written=0;const f=fake({reads:[readOf('tenant'),readOf('tenant',mine())]});const w=make(f,{},()=>{written++;});await w.load();
  assert.equal(await w.request('2026-11-22','Please'),true);
  assert.deepEqual(f.ops.map(o=>[o.action,o.payload,o.tenancyId]),[['request',{requestedStartDate:'2026-11-22',note:'Please'},TEN]]);assert.ok(/^[0-9a-f-]{36}$/.test(f.ops[0]!.operationId));
  assert.equal(w.getSnapshot().read?.request?.status,'pending');assert.equal(w.getSnapshot().pending,null);assert.equal(f.readCalls(),2,'a write is always followed by a read');assert.equal(written,1);
});
test('every user action gets its own operation id; a tenancy that is off reads and writes nothing',async()=>{
  const f=fake({reads:[readOf('tenant'),readOf('tenant',mine()),readOf('tenant'),readOf('tenant',mine())]});const w=make(f);await w.load();
  await w.request('2026-11-22');await w.withdraw();await w.request('2026-11-23');
  assert.equal(new Set(f.ops.map(o=>o.operationId)).size,3,'three actions, three ids');
  const off=fake();const n=make(off,{enabled:false});await n.load();assert.equal(off.readCalls(),0);assert.equal(await n.request('2026-11-22'),false);assert.equal(off.ops.length,0);
});
test('withdraw, accept and decline use the pending request id and revision from the read; they do nothing without one; accept sends no note',async()=>{
  const t=fake({reads:[readOf('tenant',mine())],writes:[{requestId:REQ,status:'withdrawn',requestedStartDate:'2026-11-22',currentStartDate:'2026-11-25',revision:REV2}]});const tw=make(t);await tw.load();
  await tw.withdraw();assert.deepEqual([t.ops[0]!.action,t.ops[0]!.payload],['withdraw',{requestId:REQ,revision:REV}]);
  const o=fake({reads:[readOf('landlord',request())],writes:[{requestId:REQ,status:'accepted',requestedStartDate:'2026-11-22',currentStartDate:'2026-11-22',revision:REV2},{requestId:REQ,status:'declined',requestedStartDate:'2026-11-22',currentStartDate:'2026-11-25',revision:REV2}]});const ow=make(o,{actor:OWNER});await ow.load();
  await ow.accept();assert.deepEqual([o.ops[0]!.action,o.ops[0]!.payload],['accept',{requestId:REQ,revision:REV}]);
  await ow.decline('  Not that day  ');assert.deepEqual([o.ops[1]!.action,o.ops[1]!.payload],['decline',{requestId:REQ,revision:REV,note:'Not that day'}]);
  const none=fake({reads:[readOf('tenant')]});const nw=make(none);await nw.load();assert.equal(await nw.withdraw(),false);assert.equal(await nw.accept(),false);assert.equal(await nw.decline(),false);assert.equal(none.ops.length,0);
});
test('board 05: an unknown outcome keeps the action; Try again resends the SAME operation id; nothing else can start until it is resolved',async()=>{
  const f=fake({reads:[readOf('tenant'),readOf('tenant',mine())],writes:[new MoveInError('Outcome not confirmed.',null,true)]});const w=make(f);await w.load();
  assert.equal(await w.request('2026-11-21'),false);
  const s=w.getSnapshot();assert.equal(s.pending?.action,'request');assert.equal(s.pending?.payload.requestedStartDate,'2026-11-21');assert.equal(s.error,null,'no raw or misleading text; the screen shows the could-not-confirm state');assert.equal(s.saving,false);
  const firstId=f.ops[0]!.operationId;
  assert.equal(await w.request('2026-11-22'),false,'a new action is refused while one is unresolved');assert.equal(f.ops.length,1);
  assert.equal(await w.retry(),true);assert.equal(f.ops.length,2);assert.equal(f.ops[1]!.operationId,firstId,'the retry reuses the operation id');assert.deepEqual(f.ops[1]!.payload,f.ops[0]!.payload);
  assert.equal(w.getSnapshot().pending,null);assert.equal(w.getSnapshot().read?.request?.status,'pending');
});
test('a network failure (no server answer) is an unknown outcome too, for every action',async()=>{
  for(const run of [(w:any)=>w.request('2026-11-22'),(w:any)=>w.withdraw(),(w:any)=>w.accept(),(w:any)=>w.decline('x')]){
    const f=fake({reads:[readOf('landlord',request({requestedByMe:true,canWithdraw:true}))],writes:[new MoveInError('Request failed.',null,true)]});const w=make(f,{actor:OWNER});await w.load();
    await run(w);assert.ok(w.getSnapshot().pending,'kept for Try again');assert.equal(w.getSnapshot().error,null);
  }
});
test('Check status reads again: if the request went through nothing is left to retry; if not, Try again stays',async()=>{
  const went=fake({reads:[readOf('tenant'),readOf('tenant',mine({requestedStartDate:'2026-11-21'}))],writes:[new MoveInError('Outcome not confirmed.',null,true)]});const a=make(went);await a.load();await a.request('2026-11-21');
  assert.ok(a.getSnapshot().pending);await a.checkStatus();assert.equal(a.getSnapshot().pending,null,'the read shows my request: resolved');assert.equal(a.getSnapshot().notice,'It went through.');
  const notYet=fake({reads:[readOf('tenant')],writes:[new MoveInError('Outcome not confirmed.',null,true)]});const b=make(notYet);await b.load();await b.request('2026-11-21');await b.checkStatus();
  assert.ok(b.getSnapshot().pending,'nothing there yet: Try again (same id) stays available');assert.equal(b.getSnapshot().notice,'It has not gone through yet. Try again.');
  const failedRead=fake({reads:[readOf('tenant'),new Error('offline')],writes:[new MoveInError('Outcome not confirmed.',null,true)]});const c=make(failedRead);await c.load();await c.request('2026-11-21');await c.checkStatus();assert.ok(c.getSnapshot().pending);assert.equal(c.getSnapshot().loadFailed,true);
  const decided=fake({reads:[readOf('landlord',request()),readOf('landlord',null,{request:request({status:'accepted'}) as any})],writes:[new MoveInError('Outcome not confirmed.',null,true)]});const d=make(decided,{actor:OWNER});await d.load();await d.accept();await d.checkStatus();
  assert.equal(d.getSnapshot().pending,null,'an accept that is no longer pending went through');
});
test('a definite refusal is mapped to one plain sentence, never the raw text, and the next tap is a new action with a new id',async()=>{
  const f=fake({reads:[readOf('tenant')],writes:[new MoveInError('move_in_unavailable:request_pending','22023'),{requestId:REQ,status:'pending',requestedStartDate:'2026-11-22',currentStartDate:'2026-11-25',revision:REV}]});const w=make(f);await w.load();
  assert.equal(await w.request('2026-11-22'),false);const s=w.getSnapshot();assert.equal(s.error,UNAVAILABLE.request_pending);assert.equal(s.pending,null);assert.ok(!String(s.error).includes('move_in_'));
  await w.request('2026-11-22');assert.notEqual(f.ops[1]!.operationId,f.ops[0]!.operationId);
});
test('a clash keeps its first blocked date; "changed, reload" reads again and says so; a failed read is shown with Reload and clears on success',async()=>{
  const clash=fake({reads:[readOf('landlord',request())],writes:[new MoveInError('move_in_conflict:2026-11-23','23P01')]});const c=make(clash,{actor:OWNER});await c.load();await c.accept();
  assert.equal(c.getSnapshot().conflictDate,'2026-11-23');assert.equal(c.getSnapshot().error,'Another stay starts Nov 23.');
  const stale=fake({reads:[readOf('landlord',request()),readOf('landlord',null)],writes:[new MoveInError('Move-in request changed. Reload.','40001')]});const s=make(stale,{actor:OWNER});await s.load();await s.accept();
  assert.equal(s.getSnapshot().notice,RELOADING);assert.equal(s.getSnapshot().error,null);assert.equal(s.getSnapshot().read?.request,null,'the screen reloaded');assert.equal(stale.readCalls(),2);
  const down=fake({reads:[new MoveInError('Request failed.',null,true),readOf('tenant')]});const d=make(down);await d.load();
  assert.equal(d.getSnapshot().loadFailed,true);assert.equal(d.getSnapshot().read,null);assert.equal(d.getSnapshot().ready,true);await d.load();assert.equal(d.getSnapshot().loadFailed,false);assert.equal(d.getSnapshot().read?.role,'tenant');
});
test('every server error maps to a short plain message; the raw text is never shown',()=>{
  const code=(c:string,m:string)=>mapMoveInError(new MoveInError(m,c));
  assert.equal(code('42501','Requester required').text,NOT_ALLOWED);assert.equal(code('42501','The other participant must decide').text,NOT_ALLOWED);assert.equal(code('42501','Access unavailable').text,NOT_ALLOWED);
  assert.deepEqual([code('40001','Move-in request changed. Reload.').text,code('40001','Move-in request changed. Reload.').reload],[RELOADING,true]);assert.equal(code('40001','Tenancy changed. Reload.').reload,true);
  assert.deepEqual([code('23P01','move_in_conflict:2026-11-23').text,code('23P01','move_in_conflict:2026-11-23').conflictDate],['Another stay starts Nov 23.','2026-11-23']);
  assert.equal(code('23P01','move_in_conflict:nonsense').text,GENERIC_ERROR);assert.equal(code('23P01','move_in_conflict:2026-02-30').conflictDate,null);
  for(const [k,text] of Object.entries(UNAVAILABLE)){const m=code('22023',`move_in_unavailable:${k}`);assert.equal(m.text,text,k);assert.ok(m.text.length>10&&!/move_in_|_/.test(m.text),k);}
  for(const [k,text] of Object.entries(INVALID_DATE))assert.equal(code('22023',`move_in_date_invalid:${k}`).text,text,k);
  assert.deepEqual(Object.keys(UNAVAILABLE).sort(),['already_started','early_end_pending','ended','not_confirmed','not_scheduled','request_pending']);assert.deepEqual(Object.keys(INVALID_DATE).sort(),['in_past','malformed','missing','not_before_start']);
  for(const raw of ['Conflicting retry','Invalid operation','Unexpected fields','Note must be 1 to 1000 characters','move_in_unavailable:something_new','boom'])assert.equal(code('22023',raw).text,GENERIC_ERROR,raw);
  const unknown=mapMoveInError(new Error('SELECT * FROM secret'));assert.deepEqual([unknown.text,unknown.uncertain],[GENERIC_ERROR,true]);
  assert.equal(mapMoveInError(new MoveInError('Outcome not confirmed.',null,true)).uncertain,true);assert.equal(mapMoveInError(new MoveInError('x','22023')).uncertain,false);
  assert.ok(!INVALID_DATE.in_past!.includes('in_past'));
});

// ---- the start date shown and used on the setup screen comes from the tenancy, not the reservation
const setupCtx=(over:Partial<SetupContext>={}):SetupContext=>({reservationId:RES,tenantId:TENANT,landlordId:OWNER,listingTitle:'Fully Furnished Condominium',propertyVersion:U(20),identityRevision:U(21),eligible:true,reason:null,askingRent:25000,
  startDate:'2026-11-25',endDate:'2027-02-24',serverNow:'2026-11-21T04:00:00Z',propertySummary:'condominium, tagaytay, Maharlika West, 1 bedrooms',setupRevision:U(22),
  tenancy:{id:TEN,status:'pending_confirmation',rent:25000,dueDay:25,ownerConfirmed:true,tenantConfirmed:true,propertyVersion:U(20),identityRevision:U(21)},...over});
const names={owner:'Samuel',renter:'Maria'};
test('Start stay uses the tenancy start date: it opens when an accepted move-in reaches today, even though the reservation date is still ahead',()=>{
  assert.deepEqual(setupActions(setupCtx(),TENANT),['cancel'],'before: the reservation date is ahead');
  assert.deepEqual(setupActions(setupCtx(),TENANT,TODAY),['activate','cancel'],'the tenancy now starts today');
  assert.deepEqual(setupActions(setupCtx(),TENANT,'2026-11-22'),['cancel'],'still ahead');
  assert.deepEqual(setupActions(setupCtx(),TENANT,null),['cancel'],'unknown: falls back to the reservation date');
  assert.deepEqual(setupActions(setupCtx({startDate:'2026-11-20'}),TENANT),['activate','cancel']);
});
test('the setup screen shows the tenancy start date everywhere: chip, Move-in, Stay, and the Start stay button',()=>{
  const at=(startDate:string|null)=>setupScreen({ctx:setupCtx(),actor:TENANT,actions:setupActions(setupCtx(),TENANT,startDate),names,conversationId:CONV,startDate});
  const ahead=at('2026-11-22');
  assert.equal(ahead.chip!.label,'Ready · starts tomorrow');assert.equal(ahead.main!.label,'Start stay · available Nov 22');assert.equal(ahead.main!.disabled,true);
  assert.equal(ahead.facts!.find(f=>f.label==='Stay')!.value,'Nov 22 – Feb 24 (95 days)','stay range starts on the new date');
  assert.equal(ahead.stay.start,'Nov 22, 2026');assert.equal(ahead.steps!.find(s=>s.key==='move')!.detail,'Nov 22 · tomorrow');
  const today=at(TODAY);assert.equal(today.state,'start_now');assert.equal(today.main!.label,'Start stay');assert.equal(today.main!.disabled,false);assert.equal(today.main!.action,'activate');
  const old=at(null);assert.equal(old.main!.label,'Start stay · available Nov 25');
  const noTenancy=setupScreen({ctx:setupCtx({tenancy:null}),actor:OWNER,actions:[],names,conversationId:null,startDate:'2026-11-22'});assert.equal(noTenancy.stay.start,'Nov 25, 2026','before a tenancy exists the reservation date is the right one');
});
test('the setup workflow lets Start stay through once the tenancy start date is today, and not before',async()=>{
  const writes:string[]=[];const service:any={read:async()=>setupCtx(),write:async(_a:string,input:{action:string})=>{writes.push(input.action);return setupCtx({tenancy:{...setupCtx().tenancy!,status:'active'}});}};
  const w=createTenancyEstablishmentWorkflow(service,TENANT,RES,ids());await w.load();
  await w.submit('activate');assert.deepEqual(writes,[],'the reservation date is still ahead');
  w.setStartDate('2026-11-22');await w.submit('activate');assert.deepEqual(writes,[],'the tenancy date is still ahead');
  w.setStartDate(TODAY);await w.submit('activate');assert.deepEqual(writes,['activate'],'the tenancy date reached today');
});

// ---- the other person finds the request in "Needs your attention"
const attention=(over:Partial<WorkspaceInput>={},moveIns:object[]|null=[{tenancyId:TEN,propertyId:PROP,requestId:REQ,requestedStartDate:'2026-11-22',currentStartDate:'2026-11-25',requestedBy:'tenant',createdAt:'2026-11-21T01:00:00Z',conflictDate:null}])=>attentionItems({actor:OWNER,
  tenancies:[{id:TEN,property_id:PROP,listing_id:LISTING,conversation_id:CONV,tenant_id:TENANT,landlord_id:OWNER,status:'pending_confirmation',start_date:'2026-11-25',expected_end_date:'2027-02-24',actual_end_date:null,tenant_confirmed_at:'2026-11-18T00:00:00Z',landlord_confirmed_at:'2026-11-18T00:00:00Z'}],
  reservations:[],links:[{reservation_id:RES,tenancy_id:TEN}],contexts:{[TEN]:{title:'Fully Furnished Condominium',listingStatus:'active',property:null,photos:[],notice:null} as any},identities:{[TENANT]:{id:TENANT,nickname:'Maria',avatarUrl:null,avatarPath:null}},
  activity:{...emptyActivity(),...(moveIns?{moveIns:moveIns as any}:{})},now:NOW,...over});
test('entry point: a move-in request waiting for me is one "Needs your OK" item that opens the Tenancy setup screen for that reservation',()=>{
  const items=attention().filter(i=>i.kind==='move_in_request');assert.equal(items.length,1);
  assert.deepEqual([items[0]!.title,items[0]!.buttonLabel,items[0]!.chip.label,items[0]!.action],['Move-in request','Review','Needs your OK',{kind:'setup',reservationId:RES}]);
  assert.match(items[0]!.subtitle,/Fully Furnished Condominium · Maria asks to move in Nov 22/);
  assert.deepEqual(attention({},null).filter(i=>i.kind==='move_in_request'),[],'no feed (a failed read or an older server): no item');assert.deepEqual(attention({},[]).filter(i=>i.kind==='move_in_request'),[]);
  assert.deepEqual(attention({links:[]}).filter(i=>i.kind==='move_in_request'),[],'no reservation link, nowhere to open it');
  assert.deepEqual(attention({},[{tenancyId:U(60),propertyId:PROP,requestId:U(61),requestedStartDate:'2026-11-22',currentStartDate:'2026-11-25',requestedBy:'tenant',createdAt:'2026-11-21T01:00:00Z',conflictDate:null}]).filter(i=>i.kind==='move_in_request'),[],'a request for a tenancy that is not listed is ignored');
});
