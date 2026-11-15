import type {PropertyViewing} from './PropertyViewing';
import {viewingBucket} from './PropertyViewing';
import {effectiveReservationStatus,type RentalReservation} from './RentalReservation';
export interface RequestActivity{viewingsPending:number;viewingsUpcoming:number;reservationsPending:number;reservationsApproved:number}
export function requestActivity(property:{propertyId:string;listings:readonly {id:string}[]},actor:string,viewings:PropertyViewing[],reservations:RentalReservation[],now=Date.now()):RequestActivity{
 const vs=viewings.filter(v=>v.landlordId===actor&&property.listings.some(l=>l.id===v.listingId)),rs=reservations.filter(r=>r.landlordId===actor&&r.propertyId===property.propertyId);
 const status=(r:RentalReservation)=>effectiveReservationStatus(r,now);
 return {viewingsPending:vs.filter(v=>viewingBucket(v,now)==='pending').length,viewingsUpcoming:vs.filter(v=>viewingBucket(v,now)==='upcoming').length,reservationsPending:rs.filter(r=>status(r)==='pending').length,reservationsApproved:rs.filter(r=>status(r)==='approved').length};
}
export function requestSummary(property:{propertyId:string;listings:readonly {id:string}[]},actor:string,viewings:PropertyViewing[],reservations:RentalReservation[],now=Date.now()){
 const a=requestActivity(property,actor,viewings,reservations,now);
 return `Viewings: ${a.viewingsPending} pending, ${a.viewingsUpcoming} upcoming. Reservations: ${a.reservationsPending} pending, ${a.reservationsApproved} approved.`;
}
/** Compact card line listing only non-zero counts; null when nothing needs attention. `pending` marks work awaiting the landlord. */
export function requestActivityLine(a:RequestActivity):{text:string;pending:boolean}|null{
 const part=(n:number,what:string)=>n>0?`${n} ${what}${n===1?'':'s'}`:null;
 const parts=[part(a.viewingsPending,'pending viewing'),part(a.reservationsPending,'pending reservation'),part(a.viewingsUpcoming,'upcoming viewing'),part(a.reservationsApproved,'approved reservation')].filter((x):x is string=>x!==null);
 return parts.length?{text:parts.join(', '),pending:a.viewingsPending+a.reservationsPending>0}:null;
}
