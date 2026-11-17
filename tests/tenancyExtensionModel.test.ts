import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ExtensionError,GENERIC_ERROR,NOT_ALLOWED,RELOADING,INVALID_DATE,UNAVAILABLE,SHEET,RECENT_DAYS,
  acceptClash,addDays,calendarMonth,dateLabel,decisionPayload,earliestEnd,endAfterMonths,extensionBounds,latestEnd,mapExtensionError,monthOf,ownerExtensionView,parseExtension,parseExtensionWrite,
  parsePendingExtensions,plusMonths,quickChoices,requestPayload,shiftMonth,tenantExtensionView,type ExtensionRead,type ExtensionRequest,
} from '../src/features/tenancy/models/TenancyExtension';

const U=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const TEN=U(1),REQ=U(2),REV=U(3),PROP=U(4);
const request=(over:Partial<ExtensionRequest>={}):ExtensionRequest=>({id:REQ,status:'pending',requestedEndDate:'2027-03-17',baseEndDate:'2027-02-17',note:null,decisionNote:null,whoDecided:null,revision:REV,createdAt:'2026-11-17T01:00:00Z',decidedAt:null,conflictDate:null,canAccept:true,canDecline:true,canWithdraw:true,...over});
const read=(over:Partial<ExtensionRead>={}):ExtensionRead=>({tenancyId:TEN,role:'tenant',currentEndDate:'2027-02-17',latestEndDate:'2027-08-17',canRequest:true,cannotRequestReason:null,request:null,...over});
const NOW=Date.parse('2026-11-17T04:00:00Z');

// ---------------------------------------------------------------- the date rule
test('the rule: new end = (current end + 1 day) + N months - 1 day; the example Feb 17 allows Feb 18 to Aug 17',()=>{
  assert.equal(earliestEnd('2027-02-17'),'2027-02-18');assert.equal(latestEnd('2027-02-17'),'2027-08-17');
  assert.deepEqual([1,3,6].map(n=>endAfterMonths('2027-02-17',n)),['2027-03-17','2027-05-17','2027-08-17'],'the dates on the +1, +3, +6 chips in v11');
  assert.deepEqual(extensionBounds(read()),{earliest:'2027-02-18',latest:'2027-08-17'});assert.equal(extensionBounds(read({currentEndDate:null,latestEndDate:null})),null);
});
test('month-end cases differ from "current end + 6 months" and clamp like Postgres: Jan 31, Feb 28/29, Aug 31, Dec 31',()=>{
  assert.equal(plusMonths('2027-01-31',1),'2027-02-28');assert.equal(plusMonths('2028-01-31',1),'2028-02-29');assert.equal(plusMonths('2027-08-31',1),'2027-09-30');assert.equal(plusMonths('2027-12-15',1),'2028-01-15');
  // Jan 31: Feb 1 + N months - 1 day
  assert.deepEqual([1,3,6].map(n=>endAfterMonths('2027-01-31',n)),['2027-02-28','2027-04-30','2027-07-31'],'Jan 31');
  assert.equal(endAfterMonths('2028-01-31',1),'2028-02-29','Jan 31 in a leap year');
  // last day of Feb: Mar 1 + 6 months - 1 day = Aug 31, not Aug 28 (current end + 6 months)
  assert.deepEqual([1,3,6].map(n=>endAfterMonths('2027-02-28',n)),['2027-03-31','2027-05-31','2027-08-31'],'Feb 28');
  assert.equal(latestEnd('2028-02-29'),'2028-08-31','Feb 29');
  assert.notEqual(latestEnd('2027-02-28'),plusMonths('2027-02-28',6),'not "end + 6 months"');
  // Aug 31: Sep 1 + 1 month - 1 day = Sep 30; +6 = Feb 28
  assert.deepEqual([1,3,6].map(n=>endAfterMonths('2026-08-31',n)),['2026-09-30','2026-11-30','2027-02-28'],'Aug 31');
  assert.equal(latestEnd('2026-12-31'),'2027-06-30','Dec 31');assert.equal(addDays('2027-02-28',1),'2027-03-01');assert.equal(addDays('2028-02-28',1),'2028-02-29');
});
test('quick choices: the resulting dates, always inside the window, +6 months is exactly the latest end the server accepts',()=>{
  const q=quickChoices(read());
  assert.deepEqual(q.map(c=>[c.key,c.label,c.date,c.sub]),[['m1','+1 month','2027-03-17','to Mar 17'],['m3','+3 months','2027-05-17','to May 17'],['m6','+6 months','2027-08-17','to Aug 17']]);
  for(const end of ['2027-01-31','2027-02-28','2028-02-29','2026-08-31','2026-12-31','2027-05-31']){
    const r=read({currentEndDate:end,latestEndDate:latestEnd(end)}),b=extensionBounds(r)!,c=quickChoices(r);
    assert.equal(c.length,3,end);assert.ok(c.every(x=>x.date>=b.earliest&&x.date<=b.latest),end);assert.equal(c[2]!.date,r.latestEndDate,`${end}: +6 months is the server's latest`);
  }
  assert.deepEqual(quickChoices(read({latestEndDate:'2027-04-01'})).map(c=>c.key),['m1'],'the server\'s own bounds win: only the choices inside them are offered');
  assert.deepEqual(quickChoices(read({currentEndDate:null,latestEndDate:null})),[]);
  assert.equal(dateLabel('2027-03-17','2027-02-17'),'Mar 17');assert.equal(dateLabel('2027-01-10','2026-12-20'),'Jan 10, 2027','the year shows when it differs');
});
test('the server\'s latestEndDate is used when present; the client computes it only when it is missing',()=>{
  assert.equal(extensionBounds(read({latestEndDate:'2027-07-01'}))!.latest,'2027-07-01');assert.equal(extensionBounds(read({latestEndDate:null}))!.latest,'2027-08-17');
});

// ---------------------------------------------------------------- the calendar
test('calendar: only the window can be pressed; the rest is greyed; month buttons stop at the window',()=>{
  const b={earliest:'2027-02-18',latest:'2027-08-17'};
  const feb=calendarMonth({year:2027,month:2},b,null),days=feb.weeks.flat().filter(Boolean) as {day:number;enabled:boolean}[];
  assert.equal(feb.title,'February 2027');assert.equal(days.length,28);assert.deepEqual(days.filter(d=>d.enabled).map(d=>d.day),[18,19,20,21,22,23,24,25,26,27,28]);
  assert.deepEqual([feb.hasEarlier,feb.hasLater],[false,true]);
  const aug=calendarMonth({year:2027,month:8},b,'2027-08-10'),ad=aug.weeks.flat().filter(Boolean) as {day:number;enabled:boolean;selected:boolean}[];
  assert.deepEqual(ad.filter(d=>d.enabled).map(d=>d.day).slice(-1),[17]);assert.equal(ad.filter(d=>d.selected).length,1);assert.deepEqual([aug.hasEarlier,aug.hasLater],[true,false]);
  assert.ok(feb.weeks.every(w=>w.length===7),'Sunday-first weeks of seven');assert.equal(feb.weeks[0]![1]!.day,1,'Feb 1 2027 is a Monday, so the second column');
  assert.deepEqual(shiftMonth({year:2027,month:12},1),{year:2028,month:1});assert.deepEqual(shiftMonth({year:2027,month:1},-1),{year:2026,month:12});assert.deepEqual(monthOf('2027-03-17'),{year:2027,month:3});
});

// ---------------------------------------------------------------- errors: mapped, never raw
test('error mapping: 42501, every extension_unavailable reason, every extension_date_invalid why, 23P01 with the date, 40001, anything else',()=>{
  const map=(code:string|null,message:string,uncertain=false)=>mapExtensionError(new ExtensionError(message,code,uncertain),'2027-02-17');
  assert.equal(map('42501','Owner required').text,NOT_ALLOWED);assert.equal(NOT_ALLOWED,"You can't do that on this tenancy.");
  for(const [reason,text] of Object.entries(UNAVAILABLE))assert.equal(map('22023',`extension_unavailable:${reason}`).text,text,reason);
  assert.deepEqual(Object.keys(UNAVAILABLE).sort(),['early_end_pending','no_end_date','not_active','past_end_date','request_pending'],'every reason the SQL raises');
  assert.match(UNAVAILABLE.early_end_pending!,/early-end request/i);
  for(const [why,text] of Object.entries(INVALID_DATE))assert.equal(map('22023',`extension_date_invalid:${why}`).text,text,why);
  assert.deepEqual(Object.keys(INVALID_DATE).sort(),['beyond_limit','malformed','missing','not_after_end'],'every why the SQL raises');
  const clash=map('23P01','extension_conflict:2027-03-10');
  assert.deepEqual([clash.text,clash.conflictDate,clash.reload],['Another stay starts Mar 10.','2027-03-10',false]);
  const changed=map('40001','Extension request changed. Reload.');assert.deepEqual([changed.text,changed.reload],[RELOADING,true]);assert.equal(RELOADING,'This changed. Reloading.');
  assert.equal(map('40001','Tenancy changed. Reload.').reload,true);
  for(const [code,message] of [['22023','Conflicting retry'],['22023','Unexpected fields'],['22023','Note must be 1 to 1000 characters'],['22023','extension_unavailable:something_new'],['23P01','Unit has an overlapping reservation commitment'],['23P01','extension_conflict:not-a-date'],['XX000','boom'],['PGRST202','Could not find the function']] as const){
    const m=map(code,message);assert.equal(m.text,GENERIC_ERROR,`${code} ${message}`);assert.equal(m.conflictDate,null);
  }
  assert.equal(GENERIC_ERROR,'Something went wrong. Try again.');
  assert.deepEqual([map(null,'Request failed.').text,map(null,'Request failed.').uncertain],[GENERIC_ERROR,true],'no database answer: unknown outcome');
  assert.equal(mapExtensionError(new Error('network down')).uncertain,true);
  for(const raw of ['Tenant required','Owner required','extension_conflict:2027-03-10','Conflicting retry','Access unavailable']){const m=map('42501',raw);assert.ok(!m.text.includes(raw)||raw==='',`raw text "${raw}" is never shown`);}
  assert.equal(map('23P01','extension_conflict:2028-01-05').text,'Another stay starts Jan 5, 2028.','the year shows when it differs from the current end');
});

// ---------------------------------------------------------------- payloads and strict parsing
test('payloads are exactly what the RPC accepts, and parsers refuse anything they cannot verify',()=>{
  assert.deepEqual(requestPayload('2027-03-17'),{requestedEndDate:'2027-03-17'});
  assert.deepEqual(decisionPayload(REQ,REV),{requestId:REQ,revision:REV});assert.deepEqual(decisionPayload(REQ,REV,'  Not now  '),{requestId:REQ,revision:REV,note:'Not now'});assert.deepEqual(decisionPayload(REQ,REV,'   '),{requestId:REQ,revision:REV});
  const ok={tenancyId:TEN,role:'tenant',currentEndDate:'2027-02-17',latestEndDate:'2027-08-17',canRequest:false,cannotRequestReason:'request_pending',request:{id:REQ,status:'pending',requestedEndDate:'2027-03-17',baseEndDate:'2027-02-17',note:null,decisionNote:null,whoDecided:null,revision:REV,createdAt:'2026-11-17T01:00:00Z',decidedAt:null,conflictDate:null,canAccept:false,canDecline:false,canWithdraw:true}};
  assert.equal(parseExtension(ok,TEN).request!.canWithdraw,true);assert.equal(parseExtension({...ok,request:null},TEN).request,null);
  assert.throws(()=>parseExtension(ok,U(99)),ExtensionError,'another tenancy');assert.throws(()=>parseExtension({...ok,role:'admin'},TEN));assert.throws(()=>parseExtension({...ok,request:{...ok.request,status:'expired'}},TEN));
  assert.throws(()=>parseExtension({...ok,currentEndDate:'2027-02-30'},TEN),'an impossible date');assert.throws(()=>parseExtension({...ok,request:{...ok.request,canAccept:'yes'}},TEN));assert.throws(()=>parseExtension(null,TEN));
  const row={tenancyId:TEN,propertyId:PROP,requestId:REQ,requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',createdAt:'2026-11-17T01:00:00Z',conflictDate:null};
  assert.equal(parsePendingExtensions({rows:[row],hasMore:false}).length,1);assert.deepEqual(parsePendingExtensions({rows:[],hasMore:false}),[]);assert.throws(()=>parsePendingExtensions({rows:[{...row,tenancyId:'x'}]}));assert.throws(()=>parsePendingExtensions({}));
  const w={requestId:REQ,status:'pending',requestedEndDate:'2027-03-17',currentEndDate:'2027-02-17',revision:REV};
  assert.equal(parseExtensionWrite(w,'request').status,'pending');
  for(const bad of [{...w,status:'accepted'},{...w,revision:'x'},null]){try{parseExtensionWrite(bad,'request');assert.fail('accepted');}catch(e){assert.ok(e instanceof ExtensionError&&e.uncertain,'a result that does not match is "not confirmed": retry the same operation');}}
});

// ---------------------------------------------------------------- what the tenant sees
test('tenant: nothing unless the tenancy is active and the read says so; a pending request or an early-end request hides the button',()=>{
  const view=(over:Parameters<typeof tenantExtensionView>[0])=>tenantExtensionView(over);
  assert.equal(view({read:read(),tenancyActive:true,ownerName:'Samuel',now:NOW}).state,'ask');assert.equal(view({read:read(),tenancyActive:true,ownerName:'Samuel',now:NOW}).canAsk,true);
  for(const [name,r] of [['not active',read()],['pending request on an ended tenancy',read({canRequest:false,cannotRequestReason:'not_active',request:request()})]] as const){const v=view({read:r,tenancyActive:false,ownerName:'Samuel',now:NOW});assert.deepEqual([v.state,v.canAsk,v.canCancel,v.headline],['hidden',false,false,null],name);}
  assert.equal(view({read:null,tenancyActive:true,ownerName:'Samuel',now:NOW}).state,'hidden','the read failed or the function is not deployed');
  assert.equal(view({read:read({role:'landlord'}),tenancyActive:true,ownerName:'Samuel',now:NOW}).state,'hidden','the owner has no Ask button');
  const early=view({read:read({canRequest:false,cannotRequestReason:'early_end_pending'}),tenancyActive:true,ownerName:'Samuel',now:NOW});assert.deepEqual([early.state,early.canAsk],['hidden',false]);
  for(const reason of ['past_end_date','no_end_date'])assert.equal(view({read:read({canRequest:false,cannotRequestReason:reason}),tenancyActive:true,ownerName:'Samuel',now:NOW}).canAsk,false,reason);
  const waiting=view({read:read({canRequest:false,cannotRequestReason:'request_pending',request:request()}),tenancyActive:true,ownerName:'Samuel',now:NOW});
  assert.deepEqual([waiting.state,waiting.canAsk,waiting.canCancel,waiting.chip?.label],['waiting',false,true,'Waiting for Samuel']);
  assert.equal(waiting.headline,'You asked to stay until Mar 17');assert.equal(waiting.body,'Your stay still ends Feb 17 until Samuel agrees.','the old end date stays until accepted');
});
test('tenant after an answer: an accept shows the new end date with the button back; a recent decline says so; old answers are quiet',()=>{
  const day=24*3600000,recentAt=new Date(NOW-2*day).toISOString(),oldAt=new Date(NOW-(RECENT_DAYS+1)*day).toISOString();
  const accepted=tenantExtensionView({read:read({currentEndDate:'2027-03-17',request:request({status:'accepted',decidedAt:recentAt,whoDecided:'landlord',canAccept:false,canDecline:false,canWithdraw:false})}),tenancyActive:true,ownerName:'Samuel',now:NOW});
  assert.deepEqual([accepted.state,accepted.canAsk,accepted.chip?.label,accepted.headline],['extended',true,'Extended','Your stay now ends Mar 17']);
  assert.equal(tenantExtensionView({read:read({currentEndDate:'2027-03-17',request:request({status:'accepted',decidedAt:oldAt})}),tenancyActive:true,ownerName:'Samuel',now:NOW}).state,'ask');
  const declined=tenantExtensionView({read:read({request:request({status:'declined',decidedAt:recentAt,decisionNote:'Not this time',whoDecided:'landlord'})}),tenancyActive:true,ownerName:'Samuel',now:NOW});
  assert.deepEqual([declined.state,declined.canAsk,declined.headline],['declined',true,'Samuel declined your last request.']);assert.match(declined.body!,/Not this time/);
  assert.equal(tenantExtensionView({read:read({request:request({status:'withdrawn',decidedAt:recentAt})}),tenancyActive:true,ownerName:'Samuel',now:NOW}).state,'ask');
});

// ---------------------------------------------------------------- what the owner sees
test('owner request screen: now ends, asks until, extra time, rent stays, rent due; nothing for an inactive tenancy or without a pending request',()=>{
  const view=(over:Partial<Parameters<typeof ownerExtensionView>[0]>={})=>ownerExtensionView({read:read({role:'landlord',request:request()}),tenancyActive:true,tenantName:'Maria',propertyTitle:'Fully Furnished Condominium',rent:25000,dueDay:17,...over});
  const v=view()!;
  assert.deepEqual([v.title,v.property,v.now,v.asks,v.extra,v.rent,v.rentDue],['Maria asks to stay longer','Fully Furnished Condominium','Feb 17','Mar 17','1 month','Stays ₱25,000 / month','The 17th, as now']);
  assert.deepEqual([v.noteLabel,v.messageLabel],['Optional note to Maria if you decline','Message Maria']);
  assert.equal(view({read:read({role:'landlord',currentEndDate:'2027-02-17',request:request({requestedEndDate:'2027-03-01'})})})!.extra,'12 days');
  assert.equal(view({tenancyActive:false}),null,'hidden when the tenancy is no longer active');
  assert.equal(view({read:read({role:'landlord',request:null})}),null);assert.equal(view({read:read({role:'landlord',request:request({status:'declined'})})}),null);assert.equal(view({read:read({role:'tenant',request:request()})}),null);assert.equal(view({read:null}),null);
  assert.equal(view({rent:null,dueDay:null})!.rent,'Stays the same');
});
test('the clash after Accept: the first clashing date, what happened and what to do; never computed up front',()=>{
  const c=acceptClash({conflictDate:'2027-03-10',asks:'Mar 17',tenantName:'Maria',reference:'2027-02-17'});
  assert.equal(c.title,'Another stay starts Mar 10');assert.equal(c.body,'Accept did not go through. Another stay starts Mar 10, so Mar 17 is not available. Decline and ask Maria to pick an earlier date.');
  assert.deepEqual(SHEET.clash('2027-03-10','2027-02-17'),{title:'Another stay starts Mar 10',body:'Pick a date before Mar 10. Dates from then on are not available.'});
  assert.equal(SHEET.range({earliest:'2027-02-18',latest:'2027-08-17'},'2027-02-17'),'You can pick Feb 18 to Aug 17, up to 6 months at a time.');
  assert.equal(SHEET.agree('Samuel'),'Samuel has to agree. Nothing changes until Samuel does. You can ask again later.');assert.equal(SHEET.rentStays(25000),'Stays ₱25,000');
});
