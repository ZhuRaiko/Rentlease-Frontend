import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {validCalendarDate,philippineDate} from '../../messaging-viewing/models/RentalReservation';
export type SetupAction='create'|'confirm'|'activate'|'review'|'cancel';
export interface SetupContext {
 reservationId:string;tenantId:string;landlordId:string;listingTitle:string;propertyVersion:string;identityRevision:string|null;
 eligible:boolean;reason:string|null;askingRent:number|null;startDate:string;endDate:string;serverNow:string;propertySummary:string;setupRevision:string|null;
 tenancy:null|{id:string;status:string;rent:number;dueDay:number;ownerConfirmed:boolean;tenantConfirmed:boolean;propertyVersion:string;identityRevision:string};
}
export interface SetupDraft {rent:string;dueDay:string}
export class TenancySetupError extends Error {constructor(message:string,public uncertain=false,public unavailable=false){super(message);}}
export function setupTerms(draft:SetupDraft){
 const rent=Number(draft.rent),dueDay=Number(draft.dueDay);
 if(!/^\d+(?:\.\d{1,2})?$/.test(draft.rent)||!Number.isFinite(rent)||rent<=0||rent>=10000000000)throw new TenancySetupError('Enter a positive monthly rent with at most two decimal places.');
 if(!/^\d+$/.test(draft.dueDay)||!Number.isInteger(dueDay)||dueDay<1||dueDay>28)throw new TenancySetupError('Choose a monthly rent day from 1 to 28.');
 return {rent,dueDay};
}
export function setupActions(ctx:SetupContext,actor:string):SetupAction[]{
 if(![ctx.landlordId,ctx.tenantId].includes(actor))return [];
 const t=ctx.tenancy,owner=actor===ctx.landlordId;
 if(!t)return ctx.eligible&&owner?['create']:[];
 if(!['proposed','pending_confirmation'].includes(t.status))return [];
 if(!ctx.eligible)return ['cancel'];
 const stale=t.propertyVersion!==ctx.propertyVersion||t.identityRevision!==ctx.identityRevision;
 if(stale)return owner?['review','cancel']:['cancel'];
 if(!owner&&!t.tenantConfirmed&&t.ownerConfirmed)return ['confirm','cancel'];
 if(t.ownerConfirmed&&t.tenantConfirmed&&ctx.startDate<=philippineDate(Date.parse(ctx.serverNow)))return ['activate','cancel'];
 return ['cancel'];
}
export function parseSetupContext(value:unknown,actor:string,reservationId:string):SetupContext {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TenancySetupError('Tenancy setup response is unavailable.');
 const r=value as SetupContext;
 if(r.reservationId!==reservationId||!isUuid(r.reservationId)||!isUuid(r.landlordId)||!isUuid(r.tenantId)||![r.landlordId,r.tenantId].includes(actor)||r.landlordId===r.tenantId||!isUuid(r.propertyVersion)||(r.identityRevision!==null&&!isUuid(r.identityRevision))||typeof r.eligible!=='boolean'||!(r.reason===null||typeof r.reason==='string')||typeof r.listingTitle!=='string'||typeof r.propertySummary!=='string'||!validCalendarDate(r.startDate)||!validCalendarDate(r.endDate)||r.endDate<r.startDate||!Number.isFinite(Date.parse(r.serverNow))||(r.setupRevision!==null&&!isUuid(r.setupRevision))||(r.askingRent!==null&&(typeof r.askingRent!=='number'||!Number.isFinite(r.askingRent)||r.askingRent<=0)))throw new TenancySetupError('Tenancy setup response could not be verified.');
 if(r.tenancy!==null&&(typeof r.tenancy!=='object'||Array.isArray(r.tenancy)))throw new TenancySetupError('Tenancy terms are unavailable.');
 if(r.tenancy){const t=r.tenancy;if(!isUuid(r.setupRevision)||!isUuid(t.id)||!['proposed','pending_confirmation','active','ended','cancelled'].includes(t.status)||typeof t.ownerConfirmed!=='boolean'||typeof t.tenantConfirmed!=='boolean'||!isUuid(t.propertyVersion)||!isUuid(t.identityRevision)||typeof t.rent!=='number'||!Number.isFinite(t.rent)||t.rent<=0||!Number.isInteger(t.dueDay)||t.dueDay<1||t.dueDay>28)throw new TenancySetupError('Tenancy terms could not be verified.');}
 return r;
}
