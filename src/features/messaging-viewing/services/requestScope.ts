import type {ViewingService} from './viewingService';
import type {ReservationService} from './reservationService';
export type RequestScope={kind:'requester'}|{kind:'property';propertyId:string;listingIds:readonly string[]};
/** Complete bounded snapshot. A full final page is unavailable, never a false total. */
export async function completeRequestPages<T extends {id:string}>(read:(offset:number)=>Promise<T[]>,signal?:AbortSignal):Promise<T[]>{
 const rows=new Map<string,T>();
 for(let offset=0;offset<1000;offset+=20){if(signal?.aborted)throw new Error('Request canceled.');const page=await read(offset);if(signal?.aborted)throw new Error('Request canceled.');for(const r of page)rows.set(r.id,r);if(page.length<20)return [...rows.values()];}
 throw new Error('Complete request counts are unavailable. Too many records to load safely.');
}
export function inRequestScope(row:{tenantId:string;landlordId:string;listingId:string;propertyId?:string},actor:string,scope:RequestScope){return scope.kind==='requester'?row.tenantId===actor:row.landlordId===actor&&(row.propertyId?row.propertyId===scope.propertyId:scope.listingIds.includes(row.listingId));}
/** Private snapshot belongs to one hook/workflow instance. Writes remain the existing protected service. */
function scoped<T extends {id:string;tenantId:string;landlordId:string;listingId:string;propertyId?:string},W>(service:{user:()=>Promise<string>;list:(actor:string,conversation:string|null,offset:number,signal?:AbortSignal)=>Promise<T[]>;write:(actor:string,op:W,signal?:AbortSignal)=>Promise<T>},scope:RequestScope,expectedActor:string|undefined){
 let snapshot:T[]|null=null;
 const user=async()=>{const actor=await service.user();if(actor!==expectedActor){snapshot=null;throw new Error('Your account changed. Reopen requests.');}return actor;};
 return {...service,user,async list(actor:string,_conversation:string|null,offset:number,signal?:AbortSignal){
  if(await user()!==actor)throw new Error('Your account changed.');
  if(offset===0||!snapshot){const rows=await completeRequestPages(o=>service.list(actor,null,o,signal),signal);snapshot=rows.filter(r=>inRequestScope(r,actor,scope));}
  await user();if(signal?.aborted){snapshot=null;throw new Error('Request canceled.');}return snapshot.slice(offset,offset+20);
 },async write(actor:string,op:W,signal?:AbortSignal){await user();snapshot=null;return service.write(actor,op,signal);}};
}
export const scopedViewingService=(s:ViewingService,scope:RequestScope,actor:string|undefined):ViewingService=>scoped(s,scope,actor);
export const scopedReservationService=(s:ReservationService,scope:RequestScope,actor:string|undefined):ReservationService=>scoped(s,scope,actor);
