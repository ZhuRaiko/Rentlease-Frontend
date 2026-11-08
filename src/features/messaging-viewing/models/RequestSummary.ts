import type {PropertyViewing} from './PropertyViewing';
import {viewingBucket} from './PropertyViewing';
import {effectiveReservationStatus,type RentalReservation} from './RentalReservation';
export function requestSummary(property:{propertyId:string;listings:readonly {id:string}[]},actor:string,viewings:PropertyViewing[],reservations:RentalReservation[],now=Date.now()){
 const vs=viewings.filter(v=>v.landlordId===actor&&property.listings.some(l=>l.id===v.listingId)),rs=reservations.filter(r=>r.landlordId===actor&&r.propertyId===property.propertyId);
 const pending=vs.filter(v=>viewingBucket(v,now)==='pending').length,confirmed=vs.filter(v=>viewingBucket(v,now)==='upcoming').length;
 const status=(r:RentalReservation)=>effectiveReservationStatus(r,now);
 return `Viewings: ${pending} pending, ${confirmed} upcoming. Reservations: ${rs.filter(r=>status(r)==='pending').length} pending, ${rs.filter(r=>status(r)==='approved').length} approved.`;
}
