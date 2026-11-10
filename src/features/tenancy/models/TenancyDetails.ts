import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {validCalendarDate,type RentalReservation} from '../../messaging-viewing/models/RentalReservation';
import type {PublicPropertyPhoto} from '../../../shared/models/PropertyMediaPath';
import type {RentalRelationship} from './TenancyWorkspace';
export interface TenancyPropertyContext {id:string;type:string;city:string;barangay:string;bedrooms:number|null;bathrooms:number|null;floorArea:number|null;furnishing:string|null;active:boolean}
export interface TenancyCardContext {title:string|null;listingStatus:string|null;property:TenancyPropertyContext|null;photos:PublicPropertyPhoto[];notice:string|null}
export interface TenancyDetails {tenancy:RentalRelationship;context:TenancyCardContext;conversationId:string|null;conversationNotice:string|null;reservation:RentalReservation|null;reservationNotice:string|null}
export class TenancyReadError extends Error {}
export function parseTenancyRelationship(value:unknown,actor:string):RentalRelationship {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TenancyReadError('Rental relationship could not be verified.');
 const r=value as RentalRelationship;
 if(![r.tenant_id,r.landlord_id].includes(actor)||r.tenant_id===r.landlord_id||![r.id,r.property_id,r.listing_id,r.tenant_id,r.landlord_id].every(isUuid)||(r.conversation_id!==null&&!isUuid(r.conversation_id))||!['proposed','pending_confirmation','active','ended','cancelled'].includes(r.status)||!validCalendarDate(r.start_date)||(r.expected_end_date!==null&&!validCalendarDate(r.expected_end_date))||(r.actual_end_date!==null&&!validCalendarDate(r.actual_end_date))||typeof r.agreed_monthly_rent!=='number'||!Number.isFinite(r.agreed_monthly_rent)||r.agreed_monthly_rent<=0||!Number.isInteger(r.rent_due_day)||r.rent_due_day!<1||r.rent_due_day!>28)throw new TenancyReadError('Rental access or saved terms could not be verified.');
 return {id:r.id,property_id:r.property_id,listing_id:r.listing_id,conversation_id:r.conversation_id,tenant_id:r.tenant_id,landlord_id:r.landlord_id,status:r.status,start_date:r.start_date,expected_end_date:r.expected_end_date,actual_end_date:r.actual_end_date,agreed_monthly_rent:r.agreed_monthly_rent,rent_due_day:r.rent_due_day!};
}
export function generalizedLocation(property:TenancyPropertyContext|null){if(!property)return 'Public location unavailable';const cities:Record<string,string>={imus:'Imus',dasmarinas:'Dasmari\u00f1as',tagaytay:'Tagaytay'};return [property.barangay,cities[property.city]??property.city].filter(Boolean).join(', ')||'Public location unavailable';}
