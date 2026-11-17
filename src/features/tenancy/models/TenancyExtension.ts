import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {validCalendarDate} from '../../messaging-viewing/models/RentalReservation';
import {pesos,shortDate} from '../../../shared/utils/rentalDates';
import {stayLength} from './TenancySetupScreen';

/**
 * "Ask to extend" (docs/design/rentlease_f1c_stay_longer_v11.html). Pure: shapes returned by get_tenancy_extension, get_pending_tenancy_extensions and
 * write_tenancy_extension, the date rule, the calendar grid, the error mapping and what each screen shows. Shapes are those of
 * supabase/migrations/20261117100000_tenancy_extension.sql and docs/design/f1c-extension-backend-design.md.
 */
export type ExtensionStatus='pending'|'accepted'|'declined'|'withdrawn';
export type ExtensionAction='request'|'withdraw'|'accept'|'decline';
export interface ExtensionRequest {
  id:string;status:ExtensionStatus;requestedEndDate:string;baseEndDate:string;note:string|null;decisionNote:string|null;whoDecided:'tenant'|'landlord'|null;
  revision:string;createdAt:string;decidedAt:string|null;
  /** Owner and pending only: the first clashing date, live. The owner screen does not use it up front (Accept stays tappable). */
  conflictDate:string|null;canAccept:boolean;canDecline:boolean;canWithdraw:boolean;
}
export interface ExtensionRead {
  tenancyId:string;role:'tenant'|'landlord';currentEndDate:string|null;latestEndDate:string|null;canRequest:boolean;cannotRequestReason:string|null;request:ExtensionRequest|null;
}
export interface PendingExtension {tenancyId:string;propertyId:string;requestId:string;requestedEndDate:string;currentEndDate:string;createdAt:string;conflictDate:string|null}
export interface ExtensionWrite {requestId:string;status:ExtensionStatus;requestedEndDate:string;currentEndDate:string|null;revision:string}
export interface ExtensionOperation {tenancyId:string;operationId:string;action:ExtensionAction;payload:Record<string,string>}

/** A server refusal keeps its SQLSTATE and message only so they can be mapped; the message is never shown. */
export class ExtensionError extends Error {constructor(message:string,readonly code:string|null=null,readonly uncertain=false){super(message);}}

// ---------------------------------------------------------------- strict parsing
const bad=(what:string)=>new ExtensionError(`Extension response could not be verified (${what}).`);
const object=(v:unknown,what:string):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw bad(what);return v as Record<string,unknown>;};
const uuid=(v:unknown,what:string):string=>{if(typeof v!=='string'||!isUuid(v))throw bad(what);return v;};
const date=(v:unknown,what:string):string=>{if(typeof v!=='string'||!validCalendarDate(v))throw bad(what);return v;};
const nullableDate=(v:unknown,what:string):string|null=>v===null||v===undefined?null:date(v,what);
const stamp=(v:unknown,what:string):string=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw bad(what);return v;};
const nullableText=(v:unknown,what:string):string|null=>{if(v===null||v===undefined)return null;if(typeof v!=='string'||v.length>1000)throw bad(what);return v;};
const flag=(v:unknown,what:string):boolean=>{if(typeof v!=='boolean')throw bad(what);return v;};
const STATUSES:ExtensionStatus[]=['pending','accepted','declined','withdrawn'];
const RESULT_STATUS:Record<ExtensionAction,ExtensionStatus>={request:'pending',withdraw:'withdrawn',accept:'accepted',decline:'declined'};

export function parseExtension(value:unknown,tenancyId:string):ExtensionRead{
  const r=object(value,'read');
  if(uuid(r.tenancyId,'tenancy')!==tenancyId)throw bad('tenancy');
  if(r.role!=='tenant'&&r.role!=='landlord')throw bad('role');
  let request:ExtensionRequest|null=null;
  if(r.request!==null&&r.request!==undefined){
    const q=object(r.request,'request');
    if(!STATUSES.includes(q.status as ExtensionStatus))throw bad('status');
    const who=q.whoDecided;if(who!==null&&who!==undefined&&who!=='tenant'&&who!=='landlord')throw bad('decider');
    request={id:uuid(q.id,'request id'),status:q.status as ExtensionStatus,requestedEndDate:date(q.requestedEndDate,'requested date'),baseEndDate:date(q.baseEndDate,'base date'),note:nullableText(q.note,'note'),
      decisionNote:nullableText(q.decisionNote,'decision note'),whoDecided:who??null,revision:uuid(q.revision,'revision'),createdAt:stamp(q.createdAt,'created'),decidedAt:q.decidedAt===null||q.decidedAt===undefined?null:stamp(q.decidedAt,'decided'),
      conflictDate:nullableDate(q.conflictDate,'conflict date'),canAccept:flag(q.canAccept,'canAccept'),canDecline:flag(q.canDecline,'canDecline'),canWithdraw:flag(q.canWithdraw,'canWithdraw')};
  }
  const reason=r.cannotRequestReason;if(reason!==null&&reason!==undefined&&typeof reason!=='string')throw bad('reason');
  return {tenancyId,role:r.role as 'tenant'|'landlord',currentEndDate:nullableDate(r.currentEndDate,'current end'),latestEndDate:nullableDate(r.latestEndDate,'latest end'),canRequest:flag(r.canRequest,'canRequest'),cannotRequestReason:reason??null,request};
}
export function parsePendingExtensions(value:unknown):PendingExtension[]{
  const r=object(value,'feed');
  if(!Array.isArray(r.rows)||r.rows.length>50)throw bad('rows');
  return r.rows.map(x=>{const o=object(x,'row');return {tenancyId:uuid(o.tenancyId,'tenancy'),propertyId:uuid(o.propertyId,'property'),requestId:uuid(o.requestId,'request'),requestedEndDate:date(o.requestedEndDate,'requested'),currentEndDate:date(o.currentEndDate,'current'),createdAt:stamp(o.createdAt,'created'),conflictDate:nullableDate(o.conflictDate,'conflict')};});
}
/** The result must match the action that was sent. Anything else is "not confirmed": the caller retries the same operation id. */
export function parseExtensionWrite(value:unknown,action:ExtensionAction):ExtensionWrite{
  try{
    const r=object(value,'result');
    if(r.status!==RESULT_STATUS[action])throw bad('status');
    return {requestId:uuid(r.requestId,'request'),status:r.status as ExtensionStatus,requestedEndDate:date(r.requestedEndDate,'requested'),currentEndDate:nullableDate(r.currentEndDate,'current'),revision:uuid(r.revision,'revision')};
  }catch{throw new ExtensionError('Outcome not confirmed.',null,true);}
}
export function validateExtensionOperation(op:ExtensionOperation):void{
  if(!isUuid(op.tenancyId)||!isUuid(op.operationId)||!(op.action in RESULT_STATUS))throw new ExtensionError('Invalid extension action.');
}
/** Payloads exactly as the RPC accepts them: request {requestedEndDate, note?}; accept and withdraw {requestId, revision}; decline adds an optional note. */
export const requestPayload=(requestedEndDate:string):Record<string,string>=>({requestedEndDate});
export function decisionPayload(requestId:string,revision:string,note?:string):Record<string,string>{
  const text=note?.trim();return {requestId,revision,...(text?{note:text.slice(0,1000)}:{})};
}

// ---------------------------------------------------------------- the date rule (the server is the authority; this mirrors it for the screens)
const DAY=86400000;
const parts=(d:string):[number,number,number]=>{const [y,m,day]=d.split('-').map(Number);return [y!,m!,day!];};
const iso=(y:number,m:number,d:number)=>`${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
export const addDays=(d:string,n:number):string=>new Date(Date.parse(`${d}T00:00:00Z`)+n*DAY).toISOString().slice(0,10);
export const daysInMonth=(y:number,m:number):number=>new Date(Date.UTC(y,m,0)).getUTCDate();
/** date + N months the way Postgres does it: the day of the month is clamped to the end of the target month (Jan 31 + 1 month = Feb 28 or 29). */
export function plusMonths(d:string,n:number):string{
  const [y,m,day]=parts(d),index=y*12+(m-1)+n,ny=Math.floor(index/12),nm=index%12+1;
  return iso(ny,nm,Math.min(day,daysInMonth(ny,nm)));
}
/** new_end = (current_end + 1 day) + N months - 1 day, the same rule the server uses for its upper bound (N = 6). */
export const endAfterMonths=(currentEnd:string,months:number):string=>addDays(plusMonths(addDays(currentEnd,1),months),-1);
export const earliestEnd=(currentEnd:string):string=>addDays(currentEnd,1);
export const latestEnd=(currentEnd:string):string=>endAfterMonths(currentEnd,6);
/** Selectable window. get_tenancy_extension already returns the latest end, so it is used when present. */
export function extensionBounds(read:Pick<ExtensionRead,'currentEndDate'|'latestEndDate'>):{earliest:string;latest:string}|null{
  if(!read.currentEndDate)return null;
  return {earliest:earliestEnd(read.currentEndDate),latest:read.latestEndDate??latestEnd(read.currentEndDate)};
}
export const inBounds=(d:string,b:{earliest:string;latest:string}):boolean=>d>=b.earliest&&d<=b.latest;
export interface QuickChoice {key:'m1'|'m3'|'m6';months:number;label:string;date:string;sub:string}
export function quickChoices(read:Pick<ExtensionRead,'currentEndDate'|'latestEndDate'>):QuickChoice[]{
  const b=extensionBounds(read);if(!b||!read.currentEndDate)return [];
  return ([[1,'m1'],[3,'m3'],[6,'m6']] as const).map(([months,key])=>{const day=endAfterMonths(read.currentEndDate!,months);return {key,months,label:`+${months} ${months===1?'month':'months'}`,date:day,sub:`to ${dateLabel(day,read.currentEndDate!)}`};}).filter(c=>inBounds(c.date,b));
}
/** "Mar 17", with the year only when it differs from the reference date's year. */
export function dateLabel(d:string,reference?:string|null):string{return reference&&reference.slice(0,4)!==d.slice(0,4)?`${shortDate(d)}, ${d.slice(0,4)}`:shortDate(d);}

// ---------------------------------------------------------------- the calendar
export interface CalendarCell {day:number;date:string;enabled:boolean;selected:boolean}
export interface CalendarMonth {year:number;month:number;title:string;weeks:(CalendarCell|null)[][];hasEarlier:boolean;hasLater:boolean}
const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function monthOf(d:string):{year:number;month:number}{const [y,m]=parts(d);return {year:y,month:m};}
export function shiftMonth(m:{year:number;month:number},by:number):{year:number;month:number}{const i=m.year*12+(m.month-1)+by;return {year:Math.floor(i/12),month:i%12+1};}
/** Sunday-first weeks. A day is selectable only inside the window; the rest are drawn greyed. */
export function calendarMonth(m:{year:number;month:number},bounds:{earliest:string;latest:string},selected:string|null):CalendarMonth{
  const first=new Date(Date.UTC(m.year,m.month-1,1)).getUTCDay(),dim=daysInMonth(m.year,m.month),cells:(CalendarCell|null)[]=[];
  for(let i=0;i<first;i++)cells.push(null);
  for(let day=1;day<=dim;day++){const d=iso(m.year,m.month,day);cells.push({day,date:d,enabled:inBounds(d,bounds),selected:d===selected});}
  while(cells.length%7)cells.push(null);
  const weeks:(CalendarCell|null)[][]=[];for(let i=0;i<cells.length;i+=7)weeks.push(cells.slice(i,i+7));
  const lo=monthOf(bounds.earliest),hi=monthOf(bounds.latest);
  return {...m,title:`${MONTH_NAMES[m.month-1]} ${m.year}`,weeks,hasEarlier:m.year*12+m.month>lo.year*12+lo.month,hasLater:m.year*12+m.month<hi.year*12+hi.month};
}

// ---------------------------------------------------------------- errors: mapped by SQLSTATE and message prefix, never shown raw
export const GENERIC_ERROR='Something went wrong. Try again.';
export const NOT_ALLOWED="You can't do that on this tenancy.";
export const RELOADING='This changed. Reloading.';
export const UNAVAILABLE:Record<string,string>={
  not_active:"This tenancy isn't active, so it can't be extended.",no_end_date:'This tenancy has no end date to extend.',past_end_date:'This stay has already passed its end date.',
  early_end_pending:'An early-end request is waiting on this tenancy. Answer it first.',request_pending:'A request is already waiting for an answer.',
};
export const INVALID_DATE:Record<string,string>={
  missing:'Pick a new end date.',malformed:"That date isn't valid. Pick another.",not_after_end:'Pick a date after the current end.',beyond_limit:'You can extend up to 6 months at a time. Pick an earlier date.',
};
export interface MappedError {text:string;/** Load again, then show the text. */reload:boolean;/** The first clashing date (23P01), for the clash alert. */conflictDate:string|null;/** The outcome is unknown: retry the SAME operation id. */uncertain:boolean}
export function mapExtensionError(e:unknown,reference?:string|null):MappedError{
  const none={reload:false,conflictDate:null,uncertain:false};
  if(!(e instanceof ExtensionError))return {...none,text:GENERIC_ERROR,uncertain:true};
  if(e.uncertain||e.code===null)return {...none,text:GENERIC_ERROR,uncertain:true};
  const m=e.message??'';
  if(e.code==='42501')return {...none,text:NOT_ALLOWED};
  if(e.code==='40001')return {...none,text:RELOADING,reload:true};
  if(e.code==='23P01'){const x=/^extension_conflict:(\d{4}-\d{2}-\d{2})$/.exec(m);return x&&validCalendarDate(x[1]!)?{...none,text:`Another stay starts ${dateLabel(x[1]!,reference)}.`,conflictDate:x[1]!}:{...none,text:GENERIC_ERROR};}
  if(e.code==='22023'){
    const u=/^extension_unavailable:([a-z_]+)$/.exec(m),w=/^extension_date_invalid:([a-z_]+)$/.exec(m);
    if(u&&UNAVAILABLE[u[1]!])return {...none,text:UNAVAILABLE[u[1]!]!};
    if(w&&INVALID_DATE[w[1]!])return {...none,text:INVALID_DATE[w[1]!]!};
  }
  return {...none,text:GENERIC_ERROR};
}

// ---------------------------------------------------------------- what each screen shows
export const RECENT_DAYS=14;
const recent=(iso:string|null,now:number)=>!!iso&&now-Date.parse(iso)<=RECENT_DAYS*DAY&&now>=Date.parse(iso)-DAY;
export type TenantExtensionState='hidden'|'ask'|'waiting'|'extended'|'declined';
export interface TenantExtensionView {
  state:TenantExtensionState;
  /** "Ask to extend" is shown. */
  canAsk:boolean;
  chip:{label:string;tone:'warning'|'positive'}|null;headline:string|null;body:string|null;
  /** Cancel request (withdraw) is shown. */
  canCancel:boolean;
}
const HIDDEN:TenantExtensionView={state:'hidden',canAsk:false,chip:null,headline:null,body:null,canCancel:false};
/**
 * The tenant's part of tenancy details. Nothing at all unless the tenancy is active. A pending request replaces the button (Waiting, old end date
 * still shown, Cancel request); the button is also hidden while an early-end request is pending or the stay is past its end (the server says so in
 * canRequest). After an accept the new end date shows with the button back; a recent decline says so quietly (not drawn in v11).
 */
export function tenantExtensionView(i:{read:ExtensionRead|null;tenancyActive:boolean;ownerName:string;now:number}):TenantExtensionView{
  const r=i.read;
  if(!i.tenancyActive||!r||r.role!=='tenant')return HIDDEN;
  const q=r.request,end=r.currentEndDate;
  if(q&&q.status==='pending')return {state:'waiting',canAsk:false,chip:{label:`Waiting for ${i.ownerName}`,tone:'warning'},headline:`You asked to stay until ${dateLabel(q.requestedEndDate,end)}`,
    body:`Your stay still ends ${end?dateLabel(end,q.requestedEndDate):'on its current date'} until ${i.ownerName} agrees.`,canCancel:q.canWithdraw};
  if(!r.canRequest)return HIDDEN;
  if(q&&q.status==='accepted'&&recent(q.decidedAt,i.now)&&end)return {state:'extended',canAsk:true,chip:{label:'Extended',tone:'positive'},headline:`Your stay now ends ${dateLabel(end)}`,body:null,canCancel:false};
  if(q&&q.status==='declined'&&recent(q.decidedAt,i.now))return {state:'declined',canAsk:true,chip:null,headline:`${i.ownerName} declined your last request.`,body:q.decisionNote?`“${q.decisionNote}” You can ask again.`:'You can ask again.',canCancel:false};
  return {state:'ask',canAsk:true,chip:null,headline:null,body:null,canCancel:false};
}
export interface OwnerExtensionView {
  title:string;property:string;now:string;asks:string;extra:string;rent:string;rentDue:string;
  noteLabel:string;notePlaceholder:string;messageLabel:string;
}
const ordinal=(n:number)=>{const v=n%100;return `${n}${v>=11&&v<=13?'th':['th','st','nd','rd'][n%10]??'th'}`;};
/** The owner's request screen. Null when there is nothing to answer: no pending request, or the tenancy is no longer active. */
export function ownerExtensionView(i:{read:ExtensionRead|null;tenancyActive:boolean;tenantName:string;propertyTitle:string;rent:number|null;dueDay:number|null}):OwnerExtensionView|null{
  const r=i.read,q=r?.request;
  if(!i.tenancyActive||!r||r.role!=='landlord'||!q||q.status!=='pending'||!r.currentEndDate)return null;
  return {title:`${i.tenantName} asks to stay longer`,property:i.propertyTitle,now:dateLabel(r.currentEndDate,q.requestedEndDate),asks:dateLabel(q.requestedEndDate,r.currentEndDate),
    extra:stayLength(earliestEnd(r.currentEndDate),q.requestedEndDate),rent:i.rent===null?'Stays the same':`Stays ${pesos(i.rent)} / month`,rentDue:i.dueDay?`The ${ordinal(i.dueDay)}, as now`:'As now',
    noteLabel:`Optional note to ${i.tenantName} if you decline`,notePlaceholder:'Add a note (optional)',messageLabel:`Message ${i.tenantName}`};
}
/** The alert after Accept returns 23P01 (never shown up front): the first clashing date and what to do. */
export function acceptClash(i:{conflictDate:string;asks:string;tenantName:string;reference:string|null}):{title:string;body:string}{
  const day=dateLabel(i.conflictDate,i.reference);
  return {title:`Another stay starts ${day}`,body:`Accept did not go through. Another stay starts ${day}, so ${i.asks} is not available. Decline and ask ${i.tenantName} to pick an earlier date.`};
}
export const SHEET={
  title:'How much longer do you want to stay?',pick:'Pick a date',pickTitle:'Pick the new end date',newEnd:'New end date',rent:'Rent',send:'Send request',notNow:'Not now',back:'Back',ask:'Ask to extend',cancel:'Cancel request',
  agree:(owner:string)=>`${owner} has to agree. Nothing changes until ${owner} does. You can ask again later.`,
  range:(b:{earliest:string;latest:string},ref:string)=>`You can pick ${dateLabel(b.earliest,ref)} to ${dateLabel(b.latest,ref)}, up to 6 months at a time.`,
  clash:(d:string,ref:string|null)=>({title:`Another stay starts ${dateLabel(d,ref)}`,body:`Pick a date before ${dateLabel(d,ref)}. Dates from then on are not available.`}),
  rentStays:(rent:number|null)=>rent===null?'Stays the same':`Stays ${pesos(rent)}`,
} as const;
