import {createTenancyDetailsService} from './tenancyDetailsService';
import {getSupabaseClient} from '../../../shared/services/supabase/client';
import {isUuid} from '../../messaging-viewing/models/PersistentMessaging';
import {reservationService} from '../../messaging-viewing/services/messagingDependencies';
import {completeRequestPages} from '../../messaging-viewing/services/requestScope';
import type {RentalRelationship} from '../models/TenancyWorkspace';
export async function readTenancyWorkspace(actor:string,signal:AbortSignal){
 const client=getSupabaseClient();const identity=async()=>{const {data,error}=await client.auth.getUser();if(error||data.user?.id!==actor||signal.aborted)throw new Error('Your account changed. Reopen Tenancy.');};
 if(!isUuid(actor))throw new Error('Sign in to view rentals.');await identity();
 const reservations=await completeRequestPages(o=>reservationService.list(actor,null,o,signal),signal);
 // Each branch is explicitly participant-scoped even if an administrator opens this UI.
 const tenancies:RentalRelationship[]=[];
 for(let offset=0;offset<1000;offset+=100){const {data,error}=await client.from('tenancies').select('id,property_id,listing_id,conversation_id,tenant_id,landlord_id,status,start_date,expected_end_date,actual_end_date,agreed_monthly_rent,rent_due_day,listings(title)').or('tenant_id.eq.'+actor+',landlord_id.eq.'+actor).order('created_at',{ascending:false}).order('id').range(offset,offset+99).abortSignal(signal);await identity();if(error||!data)throw new Error('Rental relationships could not load. Retry.');
 if(data.some(t=>![t.tenant_id,t.landlord_id].includes(actor)))throw new Error('Rental access could not be verified.');tenancies.push(...data.map(t=>({...t,listingTitle:t.listings?.title??null})));if(data.length<100){
 const links:{reservation_id:string;tenancy_id:string}[]=[];let legacy=false;
 for(let start=0;start<reservations.length;start+=50){const ids=reservations.slice(start,start+50).map(r=>r.id);const response=await client.rpc('get_tenancy_establishment_links',{p_reservation_ids:ids}).abortSignal(signal);await identity();
 if(response.error){if(response.error.code==='PGRST202'){legacy=true;break;}throw new Error('Tenancy setup links could not load. Retry.');}
 if(!Array.isArray(response.data)||response.data.length>50||response.data.some(r=>!ids.includes(r.reservation_id)||!isUuid(r.tenancy_id)))throw new Error('Tenancy setup links could not be verified.');links.push(...response.data);
 }
 let contexts:Awaited<ReturnType<ReturnType<typeof createTenancyDetailsService>['contexts']>>={},contextWarning:string|null=null;
 try{contexts=await createTenancyDetailsService(()=>client).contexts(actor,tenancies,signal);if(Object.values(contexts).some(c=>c.notice))contextWarning='Some property information or photos are unavailable. Pull to refresh to retry.';}catch{await identity();contextWarning='Property information could not load. Your rental records remain available.';}
 await identity();return {tenancies,reservations,links:legacy?null:links,contexts,contextWarning};}}
throw new Error('Complete rental history is unavailable: the safe loading limit was reached.');
}
