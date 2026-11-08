import type {Database} from '../../../shared/services/supabase/database.types';
import {effectiveReservationStatus,type RentalReservation} from '../../messaging-viewing/models/RentalReservation';
export type RentalRelationship=Pick<Database['public']['Tables']['tenancies']['Row'],'id'|'property_id'|'listing_id'|'conversation_id'|'tenant_id'|'landlord_id'|'status'|'start_date'|'expected_end_date'|'actual_end_date'>&{listingTitle?:string|null};
/** Reservations are commitments, never inferred tenancy records. Match established relationships only. */
export function tenancySections(actor:string,tenancies:RentalRelationship[],reservations:RentalReservation[],now=Date.now()){
 const own=tenancies.filter(t=>[t.tenant_id,t.landlord_id].includes(actor));
 const upcoming=reservations.filter(r=>[r.tenantId,r.landlordId].includes(actor)&&effectiveReservationStatus(r,now)==='approved'&&!own.some(t=>['active','ended'].includes(t.status)&&t.property_id===r.propertyId&&t.tenant_id===r.tenantId&&t.landlord_id===r.landlordId&&t.start_date<r.endDate&&((t.actual_end_date??t.expected_end_date)===null||(t.actual_end_date??t.expected_end_date)!>r.moveInDate)));
 return {upcoming,active:own.filter(t=>t.status==='active'),history:own.filter(t=>t.status==='ended')};
}
