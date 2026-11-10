export const reservationStatusLabels={pending:'Pending owner review',approved:'Approved reservation',declined:'Declined',cancelled:'Cancelled',expired:'Expired'} as const;
export type ReservationStatus=keyof typeof reservationStatusLabels;
export type ReservationAction='approve'|'decline'|'cancel';
export interface ReservationEvent {action:string;actorId:string;at:string;status:ReservationStatus;note:string|null}
export interface RentalReservation {
 id:string;conversationId:string;listingId:string;propertyId:string;tenantId:string;landlordId:string;
 listingTitle:string|null;moveInDate:string;durationMonths:number;endDate:string;message:string|null;
 status:ReservationStatus;storedStatus:ReservationStatus;expiresAt:string;serverNow:string;revision:number;responseNote:string|null;
 applicantLabel:'Renter';applicantTier1:boolean;applicantTier2:boolean;history:ReservationEvent[];
}
export interface ReservationDraft {moveInDate:string;durationMonths:string;message:string}
export class ReservationError extends Error {constructor(message:string,public denied=false,public uncertain=false){super(message);}}
export function philippineDate(now=Date.now()){return new Date(now+8*3600000).toISOString().slice(0,10);}
export function validCalendarDate(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=Date.parse(value+'T00:00:00Z');return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===value;
}
/** Calendar months match PostgreSQL make_interval, including month-end clamping. */
export function reservationEndDate(moveInDate:string,months:number){
 if(!validCalendarDate(moveInDate)||!Number.isInteger(months)||months<1||months>120)throw new ReservationError('Choose a valid move-in date and a duration of 1–120 whole months.');
 const [year,month,day]=moveInDate.split('-').map(Number);
 const first=new Date(Date.UTC(year!,month!-1+months,1)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0));
 first.setUTCDate(Math.min(day!,last.getUTCDate()));
 const result=first.toISOString().slice(0,10);if(!validCalendarDate(result))throw new ReservationError('Choose an earlier move-in date.');return result;
}
export function reservationInput(draft:ReservationDraft,now=Date.now()){
 const duration=Number(draft.durationMonths);
 if(!validCalendarDate(draft.moveInDate)||draft.moveInDate<=philippineDate(now))throw new ReservationError('Choose a future move-in date in Philippine time.');
 if(!/^\d+$/.test(draft.durationMonths)||!Number.isInteger(duration)||duration<1||duration>120)throw new ReservationError('Enter a duration of 1–120 whole months.');
 reservationEndDate(draft.moveInDate,duration);
 if(draft.message.trim().length>1000)throw new ReservationError('Keep the message within 1,000 characters.');
 return{moveInDate:draft.moveInDate,durationMonths:duration,message:draft.message.trim()||null};
}
export function effectiveReservationStatus(r:Pick<RentalReservation,'status'|'expiresAt'>,now=Date.now()):ReservationStatus{
 return (r.status==='pending'||r.status==='approved')&&Date.parse(r.expiresAt)<=now?'expired':r.status;
}
export function reservationActions(r:RentalReservation,actor:string,now=Date.now()):ReservationAction[]{
 const status=effectiveReservationStatus(r,now);if(![r.tenantId,r.landlordId].includes(actor)||!['pending','approved'].includes(status))return[];
 return[...(status==='pending'&&actor===r.landlordId?(r.applicantTier1?['approve','decline'] as const:['decline'] as const):[]),'cancel'];
}
export function reservationDateLabel(value:string){return new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'}).format(new Date(value+'T12:00:00+08:00'));}
