import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {readPublicPropertyPhotos} from '../../../shared/services/publicPropertyPhotos';
import {MessagingError,isUuid,type Conversation} from '../models/PersistentMessaging';
import {propertyAvailability,type ConversationProperty} from '../models/ConversationProperty';
import {parseReservation} from './reservationService';
export function createConversationPropertyService(getClient:()=>SupabaseClient<Database>){
 const identity=async(owner:string)=>{const {data,error}=await getClient().auth.getUser();if(error||data.user?.id!==owner)throw new MessagingError('Your account changed. Reopen Chat.',true);};
 return{async load(owner:string,conversations:readonly Conversation[],signal?:AbortSignal):Promise<Record<string,ConversationProperty>>{
  if(!isUuid(owner))throw new MessagingError('Sign in again to use Chat.',true);
  await identity(owner);if(!conversations.length)return{};
  if(conversations.length>50||conversations.some(c=>!isUuid(c.listingId)||![c.tenantId,c.landlordId].includes(owner)))throw new MessagingError('Property context access could not be verified.');
  const controller=new AbortController(),cancel=()=>controller.abort();if(signal?.aborted)cancel();signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,20000);
  try{
   const ids=[...new Set(conversations.map(c=>c.listingId))];
   const {data,error}=await getClient().from('listings').select('id,property_id,landlord_id,title,status,published_at,available_from,properties(id,landlord_id,is_active)').in('id',ids).limit(50).abortSignal(controller.signal);
   await identity(owner);if(error||!data)throw new MessagingError('Property information could not load. Your conversation is still available.');
   const rows=data.filter(row=>ids.includes(row.id)&&isUuid(row.property_id)&&conversations.some(c=>c.listingId===row.id&&c.landlordId===row.landlord_id));
   const visible=rows.filter(row=>row.properties&&row.properties.id===row.property_id&&row.properties.landlord_id===row.landlord_id);
   const parents=visible.filter(r=>r.published_at!==null).map(r=>({propertyId:r.property_id,ownerId:r.landlord_id}));
   const propertyIds=[...new Set(parents.map(r=>r.propertyId))];
   const [photoResult,tenancyResult,reservationResult]=await Promise.allSettled([
    readPublicPropertyPhotos(getClient(),parents,controller.signal,500),
    propertyIds.length?getClient().from('tenancies').select('property_id,status,tenant_id,landlord_id').in('property_id',propertyIds).eq('status','active').or('tenant_id.eq.'+owner+',landlord_id.eq.'+owner).limit(200).abortSignal(controller.signal):Promise.resolve({data:[],error:null}),
    getClient().rpc('get_rental_reservations',{p_offset:0,p_limit:50}).abortSignal(controller.signal),
   ]);
   await identity(owner);if(controller.signal.aborted)throw new MessagingError('Property request was canceled.');
   const photos=photoResult.status==='fulfilled'?photoResult.value:[];
   const tenancies=tenancyResult.status==='fulfilled'&&!tenancyResult.value.error?tenancyResult.value.data:null;
   let reservations:ReturnType<typeof parseReservation>[]|null=null;
   if(reservationResult.status==='fulfilled'&&!reservationResult.value.error&&Array.isArray(reservationResult.value.data)){
    try{reservations=reservationResult.value.data.map(r=>parseReservation(r,owner));}catch{/* Omit uncertain availability. */}
   }
   const complete=!!tenancies&&tenancies.length<200&&!!reservations&&reservations.length<50;
   const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10),result:Record<string,ConversationProperty>={};
   for(const row of rows){const p=row.properties,valid=visible.includes(row),active=valid&&p!.is_active;
    const rented=!!tenancies?.some(t=>t.property_id===row.property_id&&t.status==='active'&&[t.tenant_id,t.landlord_id].includes(owner));
    const reserved=!!reservations?.some(r=>r.propertyId===row.property_id&&r.status==='approved');
    result[row.id]={listingId:row.id,propertyId:row.property_id,title:row.title,photos:valid?photos.filter(p=>p.propertyId===row.property_id).map(p=>p.photo):[],photoError:photoResult.status==='rejected',canViewListing:active&&row.status==='active'&&row.published_at!==null&&(!row.available_from||row.available_from<=today),availability:valid?propertyAvailability(row.status,active,row.published_at!==null,row.available_from,today,row.landlord_id===owner,rented,reserved,complete):null};
   }
   return result;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }};
}
