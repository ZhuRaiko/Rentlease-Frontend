import type {Database} from '../../../shared/services/supabase/database.types';
export type ViewingStatus=Database['public']['Enums']['viewing_status'];
export type ViewingAction='approve'|'decline'|'reschedule'|'cancel';
export interface ViewingEvent {action:string;actorId:string;at:string;startsAt:string;endsAt:string;status:ViewingStatus;note:string|null}
export interface PropertyViewing {id:string;conversationId:string;listingId:string;listingTitle:string|null;tenantId:string;landlordId:string;proposedBy:string;startsAt:string;endsAt:string;status:ViewingStatus;revision:number;requestNote:string|null;responseNote:string|null;history:ViewingEvent[]}
export interface ViewingDraft {date:string;start:string;end:string;note:string}
export class ViewingError extends Error {constructor(message:string,public denied=false,public uncertain=false){super(message);}}
export const viewingStatusLabels:Record<ViewingStatus,string>={pending:'Pending owner response',confirmed:'Confirmed',declined:'Declined',reschedule_requested:'Alternative proposed',cancelled:'Cancelled',completed:'Completed',no_show:'No show'};
export function viewingTimes(draft:ViewingDraft,now=Date.now()){
 const parse=(time:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||!/^\d{2}:\d{2}$/.test(time))throw new ViewingError('Choose a valid date and time.');
 const stamp=Date.parse(`${draft.date}T${time}:00+08:00`);
 const check=new Date(stamp+8*3600000);
 if(!Number.isFinite(stamp)||check.toISOString().slice(0,16)!==`${draft.date}T${time}`)throw new ViewingError('Choose a valid date and time.');
 return stamp;};
 const start=parse(draft.start),end=parse(draft.end);
 if(start<=now||end<=start)throw new ViewingError('Choose a future start time and a later end time.');
 if(draft.note.trim().length>1000)throw new ViewingError('Keep the note within 1,000 characters.');
 return{startsAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString(),note:draft.note.trim()||null};
}
export function manilaParts(value:string){const d=new Date(Date.parse(value)+8*3600000);return{date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16)};}
export function viewingDateLabel(value:string){return new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));}
export function viewingBucket(v:PropertyViewing,now=Date.now()):'pending'|'upcoming'|'past'{return ['declined','cancelled','completed','no_show'].includes(v.status)||Date.parse(v.endsAt)<=now?'past':v.status==='confirmed'?'upcoming':'pending';}
export function viewingActions(v:PropertyViewing,owner:string,now=Date.now()):ViewingAction[]{
 if(![v.tenantId,v.landlordId].includes(owner)||Date.parse(v.startsAt)<=now||!['pending','confirmed','reschedule_requested'].includes(v.status))return[];
 const recipient=v.status==='pending'?owner===v.landlordId:v.status==='reschedule_requested'&&owner!==v.proposedBy;
 return[...(recipient?['approve','decline'] as const:[]),...(owner===v.landlordId?['reschedule'] as const:[]),'cancel'];
}
