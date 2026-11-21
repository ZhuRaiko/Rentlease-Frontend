import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {validCalendarDate} from '../../messaging-viewing/models/RentalReservation';
import {daysBetween,pesos,shortDate} from '../../../shared/utils/rentalDates';
import {addDays,dateLabel} from './TenancyExtension';

/**
 * "Ask to move in earlier" (docs/design/early-move-in). Pure: the shapes returned by get_tenancy_move_in, get_pending_tenancy_move_ins and write_tenancy_move_in
 * (supabase/migrations/20261121100000_tenancy_move_in.sql), the date window, the error mapping and what each part of the Tenancy setup screen shows.
 * Either person can ask; the other person decides; the asker can withdraw. Accepting changes only the start date; the existing Start stay still starts the stay.
 */
export type MoveInStatus='pending'|'accepted'|'declined'|'withdrawn';
export type MoveInAction='request'|'withdraw'|'accept'|'decline';
export type MoveInRole='tenant'|'landlord';
export interface MoveInRequest {
  id:string;status:MoveInStatus;requestedStartDate:string;baseStartDate:string;note:string|null;decisionNote:string|null;
  requestedBy:MoveInRole;requestedByMe:boolean;whoDecided:MoveInRole|null;revision:string;createdAt:string;decidedAt:string|null;
  /** Only for the person who has to decide, and only while pending: the first date another stay blocks, live from the server. */
  conflictDate:string|null;canAccept:boolean;canDecline:boolean;canWithdraw:boolean;
}
export interface MoveInHistoryEntry {action:MoveInAction;by:MoveInRole;byMe:boolean;startDate:string;note:string|null;at:string}
export interface MoveInRead {
  tenancyId:string;role:MoveInRole;
  /** The tenancy's real start date. The reservation's move-in date goes stale after an accept, so screens must show this one. */
  currentStartDate:string;
  /** Today in Asia/Manila, from the server. The earliest date that can be asked for. */
  earliestDate:string;canRequest:boolean;cannotRequestReason:string|null;request:MoveInRequest|null;history:MoveInHistoryEntry[];
}
export interface PendingMoveIn {tenancyId:string;propertyId:string;requestId:string;requestedStartDate:string;currentStartDate:string;requestedBy:MoveInRole;createdAt:string;conflictDate:string|null}
export interface MoveInWrite {requestId:string;status:MoveInStatus;requestedStartDate:string;currentStartDate:string;revision:string}
export interface MoveInOperation {tenancyId:string;operationId:string;action:MoveInAction;payload:Record<string,string>}

/** A server refusal keeps its SQLSTATE and message only so they can be mapped; the message is never shown. */
export class MoveInError extends Error {constructor(message:string,readonly code:string|null=null,readonly uncertain=false){super(message);}}

// ---------------------------------------------------------------- strict parsing
const bad=(what:string)=>new MoveInError(`Move-in response could not be verified (${what}).`);
const object=(v:unknown,what:string):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw bad(what);return v as Record<string,unknown>;};
const uuid=(v:unknown,what:string):string=>{if(typeof v!=='string'||!isUuid(v))throw bad(what);return v;};
const date=(v:unknown,what:string):string=>{if(typeof v!=='string'||!validCalendarDate(v))throw bad(what);return v;};
const nullableDate=(v:unknown,what:string):string|null=>v===null||v===undefined?null:date(v,what);
const stamp=(v:unknown,what:string):string=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw bad(what);return v;};
const nullableText=(v:unknown,what:string):string|null=>{if(v===null||v===undefined)return null;if(typeof v!=='string'||v.length>1000)throw bad(what);return v;};
const flag=(v:unknown,what:string):boolean=>{if(typeof v!=='boolean')throw bad(what);return v;};
const role=(v:unknown,what:string):MoveInRole=>{if(v!=='tenant'&&v!=='landlord')throw bad(what);return v;};
const STATUSES:MoveInStatus[]=['pending','accepted','declined','withdrawn'];
const ACTIONS:MoveInAction[]=['request','withdraw','accept','decline'];
const RESULT_STATUS:Record<MoveInAction,MoveInStatus>={request:'pending',withdraw:'withdrawn',accept:'accepted',decline:'declined'};

export function parseMoveIn(value:unknown,tenancyId:string):MoveInRead{
  const r=object(value,'read');
  if(uuid(r.tenancyId,'tenancy')!==tenancyId)throw bad('tenancy');
  let request:MoveInRequest|null=null;
  if(r.request!==null&&r.request!==undefined){
    const q=object(r.request,'request');
    if(!STATUSES.includes(q.status as MoveInStatus))throw bad('status');
    const who=q.whoDecided;if(who!==null&&who!==undefined)role(who,'decider');
    request={id:uuid(q.id,'request id'),status:q.status as MoveInStatus,requestedStartDate:date(q.requestedStartDate,'requested date'),baseStartDate:date(q.baseStartDate,'base date'),note:nullableText(q.note,'note'),
      decisionNote:nullableText(q.decisionNote,'decision note'),requestedBy:role(q.requestedBy,'requester'),requestedByMe:flag(q.requestedByMe,'requestedByMe'),whoDecided:(who??null) as MoveInRole|null,
      revision:uuid(q.revision,'revision'),createdAt:stamp(q.createdAt,'created'),decidedAt:q.decidedAt===null||q.decidedAt===undefined?null:stamp(q.decidedAt,'decided'),
      conflictDate:nullableDate(q.conflictDate,'conflict date'),canAccept:flag(q.canAccept,'canAccept'),canDecline:flag(q.canDecline,'canDecline'),canWithdraw:flag(q.canWithdraw,'canWithdraw')};
  }
  const reason=r.cannotRequestReason;if(reason!==null&&reason!==undefined&&typeof reason!=='string')throw bad('reason');
  const rows=r.history===undefined||r.history===null?[]:r.history;if(!Array.isArray(rows)||rows.length>20)throw bad('history');
  const history=rows.map(x=>{const o=object(x,'history row');if(!ACTIONS.includes(o.action as MoveInAction))throw bad('history action');
    return {action:o.action as MoveInAction,by:role(o.by,'history actor'),byMe:flag(o.byMe,'byMe'),startDate:date(o.startDate,'history date'),note:nullableText(o.note,'history note'),at:stamp(o.at,'history time')};});
  return {tenancyId,role:role(r.role,'role'),currentStartDate:date(r.currentStartDate,'current start'),earliestDate:date(r.earliestDate,'earliest'),canRequest:flag(r.canRequest,'canRequest'),cannotRequestReason:reason??null,request,history};
}
export function parsePendingMoveIns(value:unknown):PendingMoveIn[]{
  const r=object(value,'feed');
  if(!Array.isArray(r.rows)||r.rows.length>50)throw bad('rows');
  return r.rows.map(x=>{const o=object(x,'row');return {tenancyId:uuid(o.tenancyId,'tenancy'),propertyId:uuid(o.propertyId,'property'),requestId:uuid(o.requestId,'request'),requestedStartDate:date(o.requestedStartDate,'requested'),
    currentStartDate:date(o.currentStartDate,'current'),requestedBy:role(o.requestedBy,'requester'),createdAt:stamp(o.createdAt,'created'),conflictDate:nullableDate(o.conflictDate,'conflict')};});
}
/** The result must match the action that was sent. Anything else is "not confirmed": the caller retries the same operation id. */
export function parseMoveInWrite(value:unknown,action:MoveInAction):MoveInWrite{
  try{
    const r=object(value,'result');
    if(r.status!==RESULT_STATUS[action])throw bad('status');
    return {requestId:uuid(r.requestId,'request'),status:r.status as MoveInStatus,requestedStartDate:date(r.requestedStartDate,'requested'),currentStartDate:date(r.currentStartDate,'current'),revision:uuid(r.revision,'revision')};
  }catch{throw new MoveInError('Outcome not confirmed.',null,true);}
}
export function validateMoveInOperation(op:MoveInOperation):void{
  if(!isUuid(op.tenancyId)||!isUuid(op.operationId)||!(op.action in RESULT_STATUS))throw new MoveInError('Invalid move-in action.');
}
/** Payloads exactly as the RPC accepts them: request {requestedStartDate, note?}; accept and withdraw {requestId, revision}; decline adds an optional note. */
export function requestPayload(requestedStartDate:string,note?:string):Record<string,string>{const text=note?.trim();return {requestedStartDate,...(text?{note:text.slice(0,1000)}:{})};}
export function decisionPayload(requestId:string,revision:string,note?:string):Record<string,string>{const text=note?.trim();return {requestId,revision,...(text?{note:text.slice(0,1000)}:{})};}

// ---------------------------------------------------------------- the date window
/** Selectable dates: today (from the server) through the day before the current move-in. Null when nothing is selectable. */
export function moveInBounds(read:Pick<MoveInRead,'earliestDate'|'currentStartDate'>):{earliest:string;latest:string}|null{
  const latest=addDays(read.currentStartDate,-1);
  return read.earliestDate<=latest?{earliest:read.earliestDate,latest}:null;
}
export const inMoveInBounds=(d:string,b:{earliest:string;latest:string}|null):boolean=>!!b&&d>=b.earliest&&d<=b.latest;
const WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
/** "Sat, Nov 21" */
export const weekdayDate=(d:string):string=>`${WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]}, ${shortDate(d)}`;
const ordinal=(n:number)=>{const v=n%100;return `${n}${v>=11&&v<=13?'th':['th','st','nd','rd'][n%10]??'th'}`;};

// ---------------------------------------------------------------- errors: mapped by SQLSTATE and message prefix, never shown raw
export const GENERIC_ERROR='Something went wrong. Try again.';
export const NOT_ALLOWED="You can't do that on this tenancy.";
export const RELOADING='This changed. Reloading.';
export const LOAD_ERROR="We couldn't load the move-in details.";
export const UNAVAILABLE:Record<string,string>={
  not_scheduled:"This tenancy isn't waiting for its move-in date, so the date can't be moved.",not_confirmed:'Both of you need to confirm the terms first.',ended:'This tenancy has ended.',
  already_started:'The move-in date has already arrived.',early_end_pending:'An early-end request is waiting on this tenancy. Answer it first.',request_pending:'A request is already waiting for an answer.',
};
export const INVALID_DATE:Record<string,string>={
  in_past:'That date has passed. Pick today or a later date.',not_before_start:'Pick a date before the current move-in.',malformed:"That date isn't valid. Pick another.",missing:'Pick a date.',
};
export interface MappedMoveInError {text:string;/** Load again, then show the text. */reload:boolean;/** The first clashing date (23P01), for the clash alert. */conflictDate:string|null;/** The outcome is unknown: retry the SAME operation id. */uncertain:boolean}
export function mapMoveInError(e:unknown,reference?:string|null):MappedMoveInError{
  const none={reload:false,conflictDate:null,uncertain:false};
  if(!(e instanceof MoveInError))return {...none,text:GENERIC_ERROR,uncertain:true};
  if(e.uncertain||e.code===null)return {...none,text:GENERIC_ERROR,uncertain:true};
  const m=e.message??'';
  if(e.code==='42501')return {...none,text:NOT_ALLOWED};
  if(e.code==='40001')return {...none,text:RELOADING,reload:true};
  if(e.code==='23P01'){const x=/^move_in_conflict:(\d{4}-\d{2}-\d{2})$/.exec(m);return x&&validCalendarDate(x[1]!)?{...none,text:`Another stay starts ${dateLabel(x[1]!,reference)}.`,conflictDate:x[1]!}:{...none,text:GENERIC_ERROR};}
  if(e.code==='22023'){
    const u=/^move_in_unavailable:([a-z_]+)$/.exec(m),w=/^move_in_date_invalid:([a-z_]+)$/.exec(m);
    if(u&&UNAVAILABLE[u[1]!])return {...none,text:UNAVAILABLE[u[1]!]!};
    if(w&&INVALID_DATE[w[1]!])return {...none,text:INVALID_DATE[w[1]!]!};
  }
  return {...none,text:GENERIC_ERROR};
}

// ---------------------------------------------------------------- what each part of the screen shows
export const RECENT_DAYS=14;
const DAY=86400000;
const recent=(iso:string|null,now:number)=>!!iso&&now-Date.parse(iso)<=RECENT_DAYS*DAY&&now>=Date.parse(iso)-DAY;
export const COPY={
  ask:'Ask to move in earlier',sheetTitle:'When do you want to move in?',pickTitle:'Pick a new move-in date',today:'Today',pick:'Pick a date',send:'Send request',withdraw:'Withdraw request',notNow:'Not now',back:'Back',
  nowMovesIn:'Now moves in',newMoveIn:'New move-in',asksToMoveIn:'Asks to move in',requestTitle:'Move-in request',needsOk:'Needs your OK',noteLabel:'Note if you decline',noteOptional:'(optional)',
  notePlaceholder:'For example: the room needs cleaning first.',accept:'Accept',decline:'Decline',message:'Message',retry:'Try again',check:'Check status',
  uncertainTitle:'We could not confirm it went through',uncertainText:'Your connection dropped. Nothing was lost.',
  loading:'Loading move-in details…',reload:'Reload',
  agree:(name:string)=>`${name} has to agree. Nothing changes until they do.`,
  range:(b:{earliest:string;latest:string},ref:string)=>`You can pick ${dateLabel(b.earliest,ref)} to ${dateLabel(b.latest,ref)}.`,
  before:(start:string)=>`Before ${shortDate(start)}`,
  yourRequest:(date:string)=>`Your request: move in on ${date}`,
  moveOutStays:(end:string|null)=>end?`Move-out stays ${shortDate(end)}`:'Move-out stays the same',
  rentStays:(rent:number|null,dueDay:number|null)=>rent===null?'Rent stays the same':`Rent stays ${pesos(rent)} / month${dueDay?`, due on the ${ordinal(dueDay)}`:''}`,
} as const;

export interface MoveInStay {moveOut:string|null;rent:number|null;dueDay:number|null}
export interface SheetView {
  now:string;bounds:{earliest:string;latest:string};today:{date:string;sub:string};pickSub:string;moveOutLine:string;rentLine:string;agree:string;range:string;
}
/** The sheet's fixed text and window. Null when no date can be asked for. */
export function moveInSheetView(read:MoveInRead|null,stay:MoveInStay,partnerName:string):SheetView|null{
  const b=read?moveInBounds(read):null;if(!read||!b)return null;
  return {now:dateLabel(read.currentStartDate),bounds:b,today:{date:read.earliestDate,sub:weekdayDate(read.earliestDate)},pickSub:COPY.before(read.currentStartDate),
    moveOutLine:COPY.moveOutStays(stay.moveOut),rentLine:COPY.rentStays(stay.rent,stay.dueDay),agree:COPY.agree(partnerName),range:COPY.range(b,read.currentStartDate)};
}
export const newMoveInLabel=(date:string,today:string)=>date===today?`${weekdayDate(date)} (today)`:weekdayDate(date);

export type MoveInBanner=
  |{kind:'waiting';title:string;headline:string;body:string;canWithdraw:boolean}
  |{kind:'accepted';headline:string;body:string;movedToToday:boolean}
  |{kind:'declined';headline:string;note:string|null;body:string};
export interface RespondView {
  state:'ok'|'clash'|'passed'|'blocked';headline:string;now:string;asks:string;moveOutLine:string;rentLine:string;
  /** "the stay is 3 days longer" */longer:string;alert:{title:string;body:string;first:string|null;asked:string}|null;canAccept:boolean;canDecline:boolean;notePlaceholder:string;
}
export interface MoveInScreen {
  load:'off'|'loading'|'failed'|'ready';
  /** The tenancy's real start date, or null until it is read. */
  start:string|null;
  ask:boolean;banner:MoveInBanner|null;respond:RespondView|null;
}
export interface MoveInInput {read:MoveInRead|null;enabled:boolean;busy:boolean;ready:boolean;loadFailed:boolean;partnerName:string;stay:MoveInStay;now:number}

/** The respond screen for the person who has to decide (boards 06 to 08). Accept needs canAccept from the server AND no clash and no passed date. */
export function respondView(read:MoveInRead,partnerName:string,stay:MoveInStay):RespondView|null{
  const q=read.request;if(!q||q.status!=='pending'||q.requestedByMe)return null;
  const asked=dateLabel(q.requestedStartDate,read.currentStartDate),days=Math.max(0,daysBetween(q.requestedStartDate,read.currentStartDate));
  const passed=q.requestedStartDate<read.earliestDate,clash=q.conflictDate!==null;
  const state:RespondView['state']=clash?'clash':passed?'passed':!q.canAccept?'blocked':'ok';
  const alert=clash?{title:`${asked} can't work`,body:`Another stay on this property starts ${weekdayDate(q.conflictDate!)}. Decline and ask ${partnerName} to pick a later date.`,first:`First blocked: ${shortDate(q.conflictDate!)}`,asked:`${shortDate(q.requestedStartDate)} asked`}
    :passed?{title:`${asked} has passed`,body:`The date ${partnerName} asked for is already behind us. Decline and ask ${partnerName} to pick a new date.`,first:null,asked:`${shortDate(q.requestedStartDate)} asked`}
    :state==='blocked'?{title:"This can't be accepted right now",body:`Decline and ask ${partnerName} to ask again, or reload to see what changed.`,first:null,asked:`${shortDate(q.requestedStartDate)} asked`}:null;
  return {state,headline:`${partnerName} asks to move in earlier`,now:dateLabel(read.currentStartDate),asks:weekdayDate(q.requestedStartDate),moveOutLine:COPY.moveOutStays(stay.moveOut),rentLine:COPY.rentStays(stay.rent,stay.dueDay),
    longer:`the stay is ${days} ${days===1?'day':'days'} longer`,alert,canAccept:state==='ok',canDecline:q.canDecline,notePlaceholder:COPY.notePlaceholder};
}

/**
 * The move-in part of the Tenancy setup screen. Nothing at all until the tenancy exists and the read has worked. The Ask button comes from the server's
 * canRequest (so it is hidden while a request is pending, an early-end request waits, or the start date has arrived). After a decision the requester sees the
 * outcome for 14 days: accepted (green), declined (with the note; the button stays, so it is never a dead end).
 */
export function moveInScreen(i:MoveInInput):MoveInScreen{
  const off:MoveInScreen={load:'off',start:null,ask:false,banner:null,respond:null};
  if(!i.enabled)return off;
  const r=i.read;
  if(!r)return {...off,load:i.loadFailed?'failed':'loading'};
  const q=r.request,name=i.partnerName;
  const respond=respondView(r,name,i.stay);
  let banner:MoveInBanner|null=null;
  if(q&&q.status==='pending'&&q.requestedByMe)banner={kind:'waiting',title:`Waiting for ${name}`,headline:`You asked to move in on ${dateLabel(q.requestedStartDate,r.currentStartDate)}`,body:`The move-in stays ${dateLabel(r.currentStartDate,q.requestedStartDate)} until ${name} agrees.`,canWithdraw:q.canWithdraw};
  else if(q&&q.status==='accepted'&&recent(q.decidedAt,i.now)){
    // The person who did not ask is the one who accepted, so "mine" means I accepted.
    const today=r.currentStartDate<=r.earliestDate,mine=!q.requestedByMe;
    banner={kind:'accepted',movedToToday:today,headline:today?'Move-in moved to today':`Move-in moved to ${dateLabel(r.currentStartDate)}`,
      body:today?(mine?'You agreed. You can start the stay now.':`${name} agreed. You can start the stay now.`):(mine?'You agreed. Move-out and rent are unchanged.':`${name} agreed. Move-out and rent are unchanged.`)};
  }else if(q&&q.status==='declined'&&q.requestedByMe&&recent(q.decidedAt,i.now))banner={kind:'declined',headline:`${name} declined your request`,note:q.decisionNote,body:`The move-in is still ${dateLabel(r.currentStartDate)}. You can ask again.`};
  return {load:'ready',start:r.currentStartDate,ask:r.canRequest&&!respond,banner,respond};
}
