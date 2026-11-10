import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {validCalendarDate} from '../../messaging-viewing/models/RentalReservation';
export const lifecycleActionNames=['complete','request_end','accept','reject','withdraw'] as const;
export type LifecycleAction=typeof lifecycleActionNames[number];
export interface LifecycleRequest {id:string;revision:string;initiatorId:string;date:string;reason:string;version:string}
export interface LifecycleEvent {id:string;actorId:string;action:LifecycleAction;requestId:string|null;date:string|null;reason:string;createdAt:string}
export interface LifecycleContext {tenancyId:string;tenantId:string;landlordId:string;status:string;today:string;startDate:string;expectedEndDate:string|null;actualEndDate:string|null;endedAt:string|null;version:string;pending:LifecycleRequest|null;events:LifecycleEvent[]}
export interface LifecycleOperation {tenancyId:string;operationId:string;action:LifecycleAction;version:string;requestRevision:string|null;reason:string}
export class LifecycleError extends Error {constructor(message:string,readonly uncertain=false){super(message);}}
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new LifecycleError('Lifecycle information could not be verified.');return v as Record<string,unknown>;}
function str(v:unknown,max=1000){if(typeof v!=='string'||!v||v.length>max)throw new LifecycleError('Lifecycle information could not be verified.');return v;}
function uuid(v:unknown){const s=str(v,36);if(!isUuid(s))throw new LifecycleError('Lifecycle reference is invalid.');return s;}
function date(v:unknown){const s=str(v,10);if(!validCalendarDate(s))throw new LifecycleError('Lifecycle date is invalid.');return s;}
function stamp(v:unknown){const s=str(v,50);if(!Number.isFinite(Date.parse(s)))throw new LifecycleError('Lifecycle timestamp is invalid.');return s;}
function version(v:unknown){const s=str(v,32);if(!/^[a-f0-9]{32}$/.test(s))throw new LifecycleError('Lifecycle version is invalid.');return s;}
export function parseLifecycle(value:unknown,actor:string,id:string):LifecycleContext {
 const r=obj(value);if(r.tenancyId!==id||![r.tenantId,r.landlordId].includes(actor)||r.tenantId===r.landlordId||!isUuid(actor))throw new LifecycleError('Tenancy participant access could not be verified.');
 const tenantId=uuid(r.tenantId),landlordId=uuid(r.landlordId),state=str(r.status,30);if(!['proposed','pending_confirmation','active','ended','cancelled'].includes(state)||!Array.isArray(r.events)||r.events.length>20)throw new LifecycleError('Lifecycle state is unavailable.');
 let pending:LifecycleRequest|null=null;
 if(r.pending!==null){const p=obj(r.pending),initiatorId=uuid(p.initiatorId);if(![tenantId,landlordId].includes(initiatorId))throw new LifecycleError('Lifecycle participant is invalid.');pending={id:uuid(p.id),revision:uuid(p.revision),initiatorId,date:date(p.date),reason:str(p.reason),version:version(p.version)};}
 return{tenancyId:uuid(r.tenancyId),tenantId,landlordId,status:state,today:date(r.today),startDate:date(r.startDate),expectedEndDate:r.expectedEndDate===null?null:date(r.expectedEndDate),actualEndDate:r.actualEndDate===null?null:date(r.actualEndDate),endedAt:r.endedAt===null?null:stamp(r.endedAt),version:version(r.version),pending,
 events:r.events.map(v=>{const e=obj(v),actorId=uuid(e.actorId),action=str(e.action,20) as LifecycleAction;if(![tenantId,landlordId].includes(actorId)||!lifecycleActionNames.includes(action))throw new LifecycleError('Lifecycle history is invalid.');return{id:uuid(e.id),actorId,action,requestId:e.requestId===null?null:uuid(e.requestId),date:e.date===null?null:date(e.date),reason:str(e.reason),createdAt:stamp(e.createdAt)};})};
}
export function lifecycleActions(c:LifecycleContext,actor:string):LifecycleAction[]{if(![c.tenantId,c.landlordId].includes(actor)||c.status!=='active'||c.startDate>c.today||c.actualEndDate||c.endedAt)return[];
 if(c.pending){if(c.pending.initiatorId===actor)return['withdraw'];return c.pending.date===c.today&&c.pending.version===c.version&&(!c.expectedEndDate||c.today<c.expectedEndDate)?['accept','reject']:['reject'];}
 if(c.expectedEndDate&&c.today>c.expectedEndDate)return['complete'];if(!c.expectedEndDate||c.today<c.expectedEndDate)return['request_end'];return[];
}
export function validateLifecycleOperation(op:LifecycleOperation){if(!isUuid(op.tenancyId)||!isUuid(op.operationId)||!lifecycleActionNames.includes(op.action)||!op.reason?.trim()||op.reason.trim().length>1000||!/^[a-f0-9]{32}$/.test(op.version)||(op.requestRevision!==null&&!isUuid(op.requestRevision)))throw new LifecycleError('Enter a reason (1-1,000 characters) and reload current tenancy information.');}
