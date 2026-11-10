import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {validCalendarDate} from '../../messaging-viewing/models/RentalReservation';
export const careCategories=['plumbing','electrical','appliance','structural','other'] as const;
export const careStatuses=['submitted','acknowledged','needs_information','scheduled','in_progress','resolved','reopened','rejected','cancelled'] as const;
export type CareStatus=typeof careStatuses[number];
export interface CareRequest {id:string;title:string;description:string;category:typeof careCategories[number]|null;priority:string;status:CareStatus;response:string|null;revision:string;createdAt:string;updatedAt:string}
export interface CareHistory {id:string;actorId:string;fromStatus:CareStatus|null;status:CareStatus;note:string|null;createdAt:string}
export interface CareContext {tenancyId:string;tenantId:string;landlordId:string;status:string;today:string;schedule:{date:string;amount:number}[];obligations:{id:string;date:string;amount:number;status:string}[];obligationsLimited:boolean;reminders:{date:string;createdAt:string}[];requests:CareRequest[]}
export interface CareOperation {operationId:string;action:'create'|'respond'|'check_reminder';payload:Record<string,string>;tenancyId:string}
export class CareError extends Error {constructor(message:string,readonly uncertain=false){super(message);}}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new CareError('Rental information could not be verified.');return v as Record<string,unknown>;};
const text=(v:unknown,max=2000):string=>{if(typeof v!=='string'||v.length>max)throw new CareError('Rental information could not be verified.');return v;};
const uuid=(v:unknown):string=>{if(typeof v!=='string'||!isUuid(v))throw new CareError('Rental reference could not be verified.');return v;};
const date=(v:unknown):string=>{if(typeof v!=='string'||!validCalendarDate(v))throw new CareError('Rental date could not be verified.');return v;};
const stamp=(v:unknown):string=>{const s=text(v,50);if(!Number.isFinite(Date.parse(s)))throw new CareError('Rental timestamp could not be verified.');return s;};
const status=(v:unknown):CareStatus=>{if(!careStatuses.includes(v as CareStatus))throw new CareError('Request status could not be verified.');return v as CareStatus;};
const list=(v:unknown,cap:number):unknown[]=>{if(!Array.isArray(v)||v.length>cap)throw new CareError('Rental page could not be verified.');return v;};
const amount=(v:unknown)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw new CareError('Rental amount could not be verified.');return v;};
export function parseCare(v:unknown,actor:string,id:string):CareContext {
 const r=object(v);if(r.tenancyId!==id||!isUuid(actor)||![r.tenantId,r.landlordId].includes(actor)||r.tenantId===r.landlordId)throw new CareError('Rental access could not be verified.');
 if(!['proposed','pending_confirmation','active','ended','cancelled'].includes(String(r.status))||typeof r.obligationsLimited!=='boolean')throw new CareError('Rental status could not be verified.');
 return {tenancyId:uuid(r.tenancyId),tenantId:uuid(r.tenantId),landlordId:uuid(r.landlordId),status:String(r.status),today:date(r.today),obligationsLimited:r.obligationsLimited,
 schedule:list(r.schedule,3).map(v=>{const x=object(v);return {date:date(x.date),amount:amount(x.amount)};}),
 obligations:list(r.obligations,50).map(v=>{const x=object(v);const s=text(x.status,40);if(!['upcoming','due','overdue','tenant_marked_paid','landlord_acknowledged','waived','disputed'].includes(s))throw new CareError('Obligation status could not be verified.');return{id:uuid(x.id),date:date(x.date),amount:amount(x.amount),status:s};}),
 reminders:list(r.reminders,6).map(v=>{const x=object(v);return{date:date(x.date),createdAt:stamp(x.createdAt)};}),
 requests:list(r.requests,20).map(v=>{const x=object(v);if(x.category!==null&&!careCategories.includes(x.category as typeof careCategories[number]))throw new CareError('Request category unavailable.');return{id:uuid(x.id),title:text(x.title,100),description:text(x.description),category:x.category as CareRequest['category'],priority:text(x.priority,30),status:status(x.status),response:x.response===null?null:text(x.response),revision:uuid(x.revision),createdAt:stamp(x.createdAt),updatedAt:stamp(x.updatedAt)};})};
}
export function parseCareHistory(v:unknown,participants:readonly string[]):CareHistory[]{return list(v,20).map(v=>{const x=object(v);const actorId=uuid(x.actorId);if(!participants.includes(actorId))throw new CareError('History participant unavailable.');return{id:uuid(x.id),actorId,fromStatus:x.fromStatus===null?null:status(x.fromStatus),status:status(x.status),note:x.note===null?null:text(x.note),createdAt:stamp(x.createdAt)};});}
export function maintenanceTransitions(s:CareStatus):CareStatus[]{if(['resolved','rejected','cancelled'].includes(s))return[];return [s,...(['submitted','reopened','needs_information'].includes(s)?['acknowledged' as const]:[]),...(['acknowledged','scheduled'].includes(s)?['in_progress' as const]:[]),...(['acknowledged','in_progress','scheduled'].includes(s)?['resolved' as const]:[])];}
export function validateCareOperation(op:CareOperation){if(!isUuid(op.operationId)||!isUuid(op.tenancyId))throw new CareError('Invalid rental operation.');if(op.action==='create'){if((op.payload.title??'').trim().length<3||(op.payload.title??'').trim().length>100||(op.payload.description??'').trim().length<10||(op.payload.description??'').trim().length>2000||!careCategories.includes(op.payload.category as typeof careCategories[number]))throw new CareError('Enter a title (3-100 characters), description (10-2,000) and category.');}if(op.action==='respond'&&(!op.payload.note?.trim()||op.payload.note.trim().length>2000))throw new CareError('Enter a response (1-2,000 characters).');}
export function formatRentDate(value:string){if(!validCalendarDate(value))return 'Date unavailable';return new Date(value+'T04:00:00Z').toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric',timeZone:'Asia/Manila'});}
/** Dates only: no payment status inferred. Due days 1-28 never overflow a month. */
export function rentSchedule(t:{status:string;start_date:string;expected_end_date:string|null;actual_end_date:string|null;rent_due_day?:number},now=Date.now()):string[]{
 if(t.status!=='active'||!validCalendarDate(t.start_date)||!Number.isInteger(t.rent_due_day)||t.rent_due_day!<1||t.rent_due_day!>28)return[];
 const today=new Date(now+8*3600000).toISOString().slice(0,10),base=t.start_date>today?t.start_date:today,[y,m]=base.split('-').map(Number),end=t.actual_end_date??t.expected_end_date,result:string[]=[];
 for(let i=0;i<4;i++){const d=new Date(Date.UTC(y!,m!-1+i,t.rent_due_day)).toISOString().slice(0,10);if(d>=base&&(!end||d<=end))result.push(d);if(result.length===3)break;}return result;
}
