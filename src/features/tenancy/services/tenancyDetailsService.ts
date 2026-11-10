import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {readPublicPropertyPhotos} from '../../../shared/services/publicPropertyPhotos';
import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {parseConversation} from '../../messaging-viewing/services/messagingService';
import {parseReservation} from '../../messaging-viewing/services/reservationService';
import type {RentalRelationship} from '../models/TenancyWorkspace';
import {parseTenancyRelationship,TenancyReadError,type TenancyCardContext,type TenancyDetails} from '../models/TenancyDetails';
const fields='id,property_id,listing_id,conversation_id,tenant_id,landlord_id,status,start_date,expected_end_date,actual_end_date,agreed_monthly_rent,rent_due_day';
export function createTenancyDetailsService(client:()=>SupabaseClient<Database>,photoRead=readPublicPropertyPhotos){
 const identity=async(actor:string,signal:AbortSignal)=>{const {data,error}=await client().auth.getUser();if(error||data.user?.id!==actor||signal.aborted)throw new TenancyReadError('Your account changed or the request was canceled. Reopen Tenancy.');};
 const contexts=async(actor:string,rows:readonly RentalRelationship[],signal:AbortSignal)=>{
 const outer=signal,c=new AbortController(),cancel=()=>c.abort();if(outer.aborted)cancel();outer.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,15000);signal=c.signal;
 try{await identity(actor,signal);if(rows.some(t=>![t.tenant_id,t.landlord_id].includes(actor)))throw new TenancyReadError('Rental access could not be verified.');
 const result:Record<string,TenancyCardContext>={};
 for(const t of rows)result[t.id]={title:null,listingStatus:null,property:null,photos:[],notice:'Associated property information is unavailable.'};
 for(let start=0;start<rows.length;start+=50){const batch=rows.slice(start,start+50),ids=[...new Set(batch.map(t=>t.listing_id))];
 try{const {data,error}=await client().from('listings').select('id,property_id,landlord_id,title,status,published_at,properties(id,landlord_id,property_type,city,barangay,bedrooms,bathrooms,floor_area_sqm,furnishing_status,is_active)').in('id',ids).limit(50).abortSignal(signal);await identity(actor,signal);if(error||!Array.isArray(data))throw Error('Property read unavailable');
 const parents:{propertyId:string;ownerId:string}[]=[];
 for(const t of batch){const row=data.find(l=>l.id===t.listing_id&&l.property_id===t.property_id&&l.landlord_id===t.landlord_id);if(!row)continue;
 const p=row.properties,context=result[t.id]!;context.title=typeof row.title==='string'?row.title:null;context.listingStatus=row.status;
 if(!p||p.id!==t.property_id||p.landlord_id!==t.landlord_id)continue;
 context.property={id:p.id,type:p.property_type,city:p.city,barangay:p.barangay,bedrooms:p.bedrooms,bathrooms:p.bathrooms,floorArea:p.floor_area_sqm,furnishing:p.furnishing_status,active:p.is_active};context.notice=null;
 if(row.published_at)parents.push({propertyId:p.id,ownerId:p.landlord_id});
 }
 try{const photos=await photoRead(client(),parents,signal,500);await identity(actor,signal);for(const t of batch)if(result[t.id]!.property)result[t.id]!.photos=photos.filter(p=>p.propertyId===t.property_id).map(p=>p.photo);}
 catch{await identity(actor,signal);for(const t of batch)if(result[t.id]!.property)result[t.id]!.notice='Property photos could not load. Refresh to retry.';}
 }catch{await identity(actor,signal);for(const t of batch)result[t.id]!.notice='Property information could not load. Refresh to retry.';}
 }
 await identity(actor,signal);return result;}finally{clearTimeout(timer);outer.removeEventListener('abort',cancel);}
 };
 return {contexts,async read(actor:string,tenancyId:string,sourceId:string|null,signal:AbortSignal):Promise<TenancyDetails>{
 if(!isUuid(actor)||!isUuid(tenancyId))throw new TenancyReadError('Choose an authorized rental.');await identity(actor,signal);
 const {data,error}=await client().from('tenancies').select(fields).eq('id',tenancyId).or('tenant_id.eq.'+actor+',landlord_id.eq.'+actor).limit(1).abortSignal(signal);await identity(actor,signal);
 if(error||!data?.length)throw new TenancyReadError('This tenancy is inaccessible or could not load. Retry.');
 const tenancy=parseTenancyRelationship(data[0],actor);if(tenancy.id!==tenancyId)throw new TenancyReadError('Rental access could not be verified.');
 const optional=await Promise.allSettled([
 contexts(actor,[tenancy],signal),
 (async()=>{if(!tenancy.conversation_id)return null;const {data,error}=await client().rpc('get_messaging_inbox',{p_offset:0,p_limit:20,p_conversation_id:tenancy.conversation_id}).abortSignal(signal);await identity(actor,signal);if(error||!Array.isArray(data)||data.length!==1)throw Error('Conversation unavailable');const c=parseConversation(data[0],actor);if(c.id!==tenancy.conversation_id||c.listingId!==tenancy.listing_id||c.tenantId!==tenancy.tenant_id||c.landlordId!==tenancy.landlord_id)throw Error('Conversation relationship changed');return c.id;})(),
 (async()=>{if(!sourceId||!isUuid(sourceId))return null;const links=await client().rpc('get_tenancy_establishment_links',{p_reservation_ids:[sourceId]}).abortSignal(signal);await identity(actor,signal);if(links.error||!Array.isArray(links.data)||links.data.length!==1||links.data[0]?.reservation_id!==sourceId||links.data[0].tenancy_id!==tenancy.id)throw Error('Source association unavailable');
 if(!tenancy.conversation_id)return null;
 for(let offset=0;offset<1000;offset+=20){const page=await client().rpc('get_rental_reservations',{p_conversation_id:tenancy.conversation_id,p_offset:offset,p_limit:20}).abortSignal(signal);await identity(actor,signal);if(page.error||!Array.isArray(page.data)||page.data.length>20)throw Error('Reservation unavailable');
 const found=page.data.find((r:unknown)=>!!r&&typeof r==='object'&&(r as Record<string,unknown>).id===sourceId);
 if(found){const r=parseReservation(found,actor);if(r.propertyId!==tenancy.property_id||r.listingId!==tenancy.listing_id||r.tenantId!==tenancy.tenant_id||r.landlordId!==tenancy.landlord_id||r.conversationId!==tenancy.conversation_id)throw Error('Reservation relationship changed');return r;}
 if(page.data.length<20)return null;
 }throw Error('Reservation read limit reached');})()
 ]);
 await identity(actor,signal);
 const context=optional[0].status==='fulfilled'?optional[0].value[tenancy.id]!: {title:null,listingStatus:null,property:null,photos:[],notice:'Property information unavailable. Refresh to retry.'};
 return {tenancy,context,conversationId:optional[1].status==='fulfilled'?optional[1].value:null,conversationNotice:optional[1].status==='rejected'?'Conversation unavailable. Refresh to retry.':null,reservation:optional[2].status==='fulfilled'?optional[2].value:null,reservationNotice:optional[2].status==='rejected'?'Reservation reference unavailable. Refresh to retry.':null};
 }};
}
export type TenancyDetailsService=ReturnType<typeof createTenancyDetailsService>;
