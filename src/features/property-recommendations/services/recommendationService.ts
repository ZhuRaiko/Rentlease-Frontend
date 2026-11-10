import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import type {ManualSearchService} from '../../search-discovery/services/manualSearchService';
import {ManualSearchError,type SearchFilters,type SearchListing} from '../../search-discovery/models/ManualSearch';
import {recommendationPoolLimit,type RecommendationCandidate,type OwnerVerification} from '../models/ContentRecommendation';

// A failed/missing status endpoint is neutral, not evidence of nonverification.
// Only exact, unique listing-owner-bound true results enter the scoring model.
function approvedOwners(data:unknown,batch:readonly string[],candidates:Map<string,SearchListing>){
 const approved=new Map<string,OwnerVerification>(),seen=new Set<string>();
 if(!Array.isArray(data)||data.length>50)return approved;
 for(const row of data){
  if(!row||typeof row!=='object'||typeof row.listing_id!=='string'||!batch.includes(row.listing_id))continue;
  const id=row.listing_id;
  if(seen.has(id)){approved.delete(id);continue;}seen.add(id);
  if(Object.keys(row).some(k=>!['listing_id','listing_owner_id','owner_tier2_verified'].includes(k)))continue;
  const listing=candidates.get(id);
  if(listing&&row.listing_owner_id===listing.ownerId&&row.owner_tier2_verified===true)
   approved.set(id,{ownerId:listing.ownerId,status:'approved',active:true,authoritative:true,expiresAt:null});
 }
 return approved;
}
export function createRecommendationService(manual:Pick<ManualSearchService,'user'|'search'>,getClient:()=>SupabaseClient<Database>){
 const identity=async(actor:string)=>{if(await manual.user()!==actor)throw new ManualSearchError('Your account changed. Reopen Discover.',true);};
 return {user:manual.user,async load(actor:string,filters:SearchFilters,query:string,signal:AbortSignal){
 await identity(actor);const candidates=new Map<string,SearchListing>();let scanned=0,limited=false;
 for(let offset=0;offset<recommendationPoolLimit;offset+=20){if(signal.aborted)throw new ManualSearchError('Recommendation request canceled.');const page=await manual.search(actor,{filters,query,sort:'Recently Listed',offset,publishedOnly:true},signal);await identity(actor);scanned+=page.length;for(const row of page)if(row.ownerId!==actor&&!candidates.has(row.listingId))candidates.set(row.listingId,row);if(page.length<20)break;if(offset+20>=recommendationPoolLimit)limited=true;}
 const result:RecommendationCandidate[]=[],ids=[...candidates.keys()],today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 for(let start=0;start<ids.length;start+=50){const batch=ids.slice(start,start+50);
 const {data,error}=await getClient().from('listings').select('id,property_id,landlord_id,status,published_at,available_from,completeness_score,properties!inner(id,landlord_id,is_active,property_amenities(amenities(name)))').in('id',batch).eq('status','active').not('published_at','is',null).eq('properties.is_active',true).or('available_from.is.null,available_from.lte.'+today).limit(50).limit(101,{referencedTable:'properties.property_amenities'}).abortSignal(signal);
 await identity(actor);if(error||!data)throw new ManualSearchError('Recommendations could not load. Retry.');
 let verification:unknown=null;
 if(signal.aborted)throw new ManualSearchError('Recommendation request canceled.');
 try{
  const response=await getClient().rpc('get_recommendation_owner_verification',{p_listing_ids:batch}).abortSignal(signal);
  if(!response.error)verification=response.data;
 }catch{/* Optional credibility read: preserve eligible rentals, never fabricate approval. */}
 await identity(actor);
 if(signal.aborted)throw new ManualSearchError('Recommendation request canceled.');
 const approved=approvedOwners(verification,batch,candidates);
 for(const row of data){const listing=candidates.get(row.id),p=row.properties;if(!listing||!batch.includes(row.id)||row.status!=='active'||!row.published_at||(row.available_from&&row.available_from>today)||p?.is_active!==true||row.property_id!==listing.propertyId||p.id!==listing.propertyId||row.landlord_id!==listing.ownerId||p.landlord_id!==listing.ownerId||p.landlord_id===actor)continue;
 const links=p.property_amenities,amenities=Array.isArray(links)&&links.length<101&&links.every(l=>typeof l.amenities?.name==='string')?links.map(l=>l.amenities!.name):null;
 result.push({listing,amenities,completeness:row.completeness_score,publishedAt:row.published_at,ownerVerification:approved.get(row.id)??null});}
 }
 if(signal.aborted)throw new ManualSearchError('Recommendation request canceled.');return {candidates:result,limited,scanned};
 }};
}
export type RecommendationService=ReturnType<typeof createRecommendationService>;
