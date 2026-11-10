import {rentSchedule} from './TenancyCare';
import type {Database} from '../../../shared/services/supabase/database.types';
import {effectiveReservationStatus,type RentalReservation} from '../../messaging-viewing/models/RentalReservation';
export type RentalRelationship=Pick<Database['public']['Tables']['tenancies']['Row'],'id'|'property_id'|'listing_id'|'conversation_id'|'tenant_id'|'landlord_id'|'status'|'start_date'|'expected_end_date'|'actual_end_date'>&Partial<Pick<Database['public']['Tables']['tenancies']['Row'],'agreed_monthly_rent'|'rent_due_day'>>&{listingTitle?:string|null};
/** Reservations are commitments, never inferred tenancy records. Match established relationships only. */
export function tenancySections(actor:string,tenancies:RentalRelationship[],reservations:RentalReservation[],now=Date.now(),links:{reservation_id:string;tenancy_id:string}[]|null=null){
 const own=tenancies.filter(t=>[t.tenant_id,t.landlord_id].includes(actor));
 const upcoming=reservations.filter(r=>[r.tenantId,r.landlordId].includes(actor)&&effectiveReservationStatus(r,now)==='approved'&&!links?.some(link=>link.reservation_id===r.id&&own.some(t=>t.id===link.tenancy_id&&t.status!=='cancelled'))&&!own.some(t=>['active','ended'].includes(t.status)&&t.property_id===r.propertyId&&t.tenant_id===r.tenantId&&t.landlord_id===r.landlordId&&t.start_date<r.endDate&&((t.actual_end_date??t.expected_end_date)===null||(t.actual_end_date??t.expected_end_date)!>r.moveInDate)));
 return {upcoming,pending:own.filter(t=>['proposed','pending_confirmation'].includes(t.status)),active:own.filter(t=>t.status==='active'),history:own.filter(t=>t.status==='ended')};
}

export function tenancyCounts(sections:ReturnType<typeof tenancySections>){return {upcoming:sections.upcoming.length+sections.pending.length,active:sections.active.length,history:sections.history.length};}
/** Scheduled date only; there is no payment/outstanding-balance ledger in T1. */
export function nextScheduledRentDate(t:RentalRelationship,now=Date.now()):string|null {return rentSchedule(t,now)[0]??null;}
