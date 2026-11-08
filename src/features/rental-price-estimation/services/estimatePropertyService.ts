import {propertyMeasurementWarnings} from '../../../shared/models/PropertyMeasurementQuality';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../../../shared/services/supabase/database.types';
import {mapPredictionInput,isPredictionId,PredictionError} from '../../../shared/models/RentalPrediction';
import type {EstimateSource,EstimateProperty} from '../models/RentalPriceEstimate';
const fields='id,landlord_id,is_active,property_type,city,barangay,bedrooms,bathrooms,floor_area_sqm,floor_number,furnishing_status';
const cities:Record<string,string>={imus:'Imus',dasmarinas:'Dasmari\u00f1as',tagaytay:'Tagaytay'};
export function estimateCandidate(property:Record<string,unknown>,listing:Record<string,unknown>|null):EstimateProperty {
 if(!isPredictionId(property.id)||!isPredictionId(property.landlord_id)||(listing&&(!isPredictionId(listing.id)||listing.property_id!==property.id||listing.landlord_id!==property.landlord_id)))throw new PredictionError('Property access could not be verified.','access');
 let unavailable:string|null=null;try{mapPredictionInput(property);}catch(e){unavailable=e instanceof Error?e.message:'Property inputs are unavailable.';}
 if(property.is_active!==true)unavailable='This property is inactive.';
 const target=listing?{listingId:String(listing.id)}:{propertyId:String(property.id)};
 return {key:listing?'listing:'+listing.id:'property:'+property.id,propertyId:String(property.id),target,title:typeof listing?.title==='string'?listing.title:'Your '+String(property.property_type).replace(/_/g,' '),location:String(property.barangay??'')+', '+(cities[String(property.city)]??String(property.city)),propertyType:String(property.property_type).replace(/_/g,' '),floorArea:typeof property.floor_area_sqm==='number'?property.floor_area_sqm:null,bedrooms:typeof property.bedrooms==='number'?property.bedrooms:null,bathrooms:typeof property.bathrooms==='number'?property.bathrooms:null,warnings:propertyMeasurementWarnings(property),askingRent:typeof listing?.asking_rent_monthly==='number'&&listing.asking_rent_monthly>0?listing.asking_rent_monthly:null,unavailable};
}
export function createEstimatePropertyService(getClient:()=>SupabaseClient<Database>){
 const user=async()=>{const {data,error}=await getClient().auth.getUser();if(error||!data.user||data.user.is_anonymous)throw new PredictionError('Sign in again to estimate rent.','auth');return data.user.id;};
 const identity=async(actor:string)=>{if(await user()!==actor)throw new PredictionError('Your account changed. Reopen the estimator.','auth');};
 return {user,async load(actor:string,source:EstimateSource,offset:number,signal:AbortSignal){
 await identity(actor);const eligible=await getClient().rpc('is_tier1_verified',{}).abortSignal(signal);if(eligible.error||eligible.data!==true)throw new PredictionError('An active Tier 1 account is required.','eligibility');
 if(!Number.isInteger(offset)||offset<0||offset>1000)throw new PredictionError('The safe browsing limit was reached. Narrow your selection.');
 let rows:EstimateProperty[];
 if(source==='owned'){
 const {data,error}=await getClient().from('properties').select(`${fields},listings(id,property_id,landlord_id,title,status,asking_rent_monthly,published_at)` as const).eq('landlord_id',actor).order('created_at',{ascending:false}).order('id').range(offset,offset+19).limit(50,{referencedTable:'listings'}).abortSignal(signal);
 await identity(actor);if(error||!data)throw new PredictionError('Your properties could not load. Retry.');
 rows=data.map(p=>{if(p.landlord_id!==actor)throw new PredictionError('Property ownership could not be verified.','access');const listing=p.listings.length<50?[...p.listings].sort((a,b)=>['active','paused','draft','rented','archived','removed'].indexOf(a.status)-['active','paused','draft','rented','archived','removed'].indexOf(b.status)||String(b.published_at??'').localeCompare(String(a.published_at??''))||a.id.localeCompare(b.id))[0]??null:null;return estimateCandidate(p,listing);});
 }else{
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const {data,error}=await getClient().from('listings').select(`id,property_id,landlord_id,title,asking_rent_monthly,published_at,status,available_from,properties!inner(${fields})` as const).eq('status','active').not('published_at','is',null).eq('properties.is_active',true).or('available_from.is.null,available_from.lte.'+today).order('published_at',{ascending:false}).order('id').range(offset,offset+19).abortSignal(signal);
 await identity(actor);if(error||!data)throw new PredictionError('Published rentals could not load. Retry.');
 rows=data.map(l=>{if(l.status!=='active'||!l.published_at||(l.available_from&&l.available_from>today)||!l.properties?.is_active)throw new PredictionError('A rental is no longer available. Refresh.','access');return estimateCandidate(l.properties,l);});
 }
 if(signal.aborted)throw new PredictionError('Request canceled.');return rows;
 }};
}
export type EstimatePropertyService=ReturnType<typeof createEstimatePropertyService>;
