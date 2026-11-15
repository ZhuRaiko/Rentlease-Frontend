import {modelPropertyCategory,type RentalRequestCategory,type RentalModelSubtype} from './RentalModelAttributes.ts';
import {RANGE_HALF_WIDTH,roundRangeOutward,type RentalRange} from './RentalRange.ts';
/** Contract pinned to Rentlease-Features dee06f16fe182361b1d9d7e6ecf35f41703bf1a6. */
export const ML_SOURCE_COMMIT='dee06f16fe182361b1d9d7e6ecf35f41703bf1a6';
// Exact fitted vocabulary. Aliases apply only at inference, never to stored listings.
const fittedAmenities=new Set<string>(["24 hours security","access for people with disabilities","air conditioning","alarm","badminton court","balcony","basketball court","built in wardrobe","cctv","cellar","club house","concierge","deck","drying area","electricity","ensuite","entertainment room","equipped kitchen","fire alarm","fire exits","fire sprinkler system","fireplace","fully fenced","function area","garage","garden","gazebo","green area","grill","guardhouse","gym","heating","integral kitchen","intercom","internet","jacuzzi","jogging path","lanai","laundry room","library","lift","lounge","multi purpose lawn","multipurpose room","natural gas","office room","open space","panoramic view","playground","powder room","roof garden","sauna","security","service room","shops","shower rooms","smoke detector","spa","sports facilities","storage room","swimming pool","tennis court","terrace","video cable","water","water tank","wifi","yard"]);
const amenityAliases:Readonly<Record<string,string>>=Object.freeze({'wi-fi':'wifi',elevator:'lift','24/7 security':'24 hours security'});
export function mapPredictionAmenities(amenities:readonly string[]|null):string[]|null {
 if(amenities===null)return null;
 if(!Array.isArray(amenities)||amenities.some(v=>typeof v!=='string'))throw new PredictionError('Property amenities could not be verified.','input');
 const result=new Set<string>();
 for(const value of amenities){const label=value.trim().toLowerCase().replace(/\s+/g,' ');const canonical=amenityAliases[label]??label;if(fittedAmenities.has(canonical))result.add(canonical);}
 return [...result];
}
export type PredictionTarget={propertyId:string;listingId?:never}|{listingId:string;propertyId?:never};
export interface PredictionRequest {
 property_type:RentalRequestCategory;property_subtype:RentalModelSubtype;city:string;furnishing_status:string;
 bedrooms:number|null;bathrooms:number|null;floor_area_sqm:number;floor_number:number|null;
 lot_area_sqm:number|null;parking_spaces:number|null;latitude:null;longitude:null;amenities_normalized:string[]|null;
}
export type IllustrativeRentalRange=RentalRange;
/** The wire shape the Edge function forwards (it still carries the model's point value). Only the Edge function and parsePredictionReceipt read it; no screen does. */
export interface ModelPrediction {estimatedMonthlyRent:number;currency:'PHP';modelVersion:string;illustrativeRange?:IllustrativeRentalRange|null}
/** What the app keeps and renders: only the range (rounded outward) and the property it belongs to. There is no point value anywhere in this type. */
export interface PredictionReceipt {currency:'PHP';modelVersion:string;illustrativeRange?:IllustrativeRentalRange|null;target:PredictionTarget;predictedAt:string;askingRent:number|null}
export class PredictionError extends Error {constructor(message:string,public readonly code='unavailable'){super(message);}}
const cities:Record<string,string>={imus:'Imus',dasmarinas:'Dasmari\u00f1as',tagaytay:'Tagaytay'};
export const isPredictionId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function parsePredictionTarget(value:unknown):PredictionTarget {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new PredictionError('Choose an available property.','input');
 const r=value as Record<string,unknown>,keys=Object.keys(r);
 if(keys.length!==1||!['listingId','propertyId'].includes(keys[0]!)||!isPredictionId(r[keys[0]!]))throw new PredictionError('Choose an available property.','input');
 return keys[0]==='listingId'?{listingId:r.listingId as string}:{propertyId:r.propertyId as string};
}
export function mapPredictionInput(property:Record<string,unknown>,amenities:string[]|null=null):PredictionRequest {
 const type=property.property_type;if(type!=='house'&&type!=='apartment'&&type!=='condominium')throw new PredictionError('Estimation supports houses, apartments, and condominiums only. Standalone rooms and studios do not identify a supported parent category.','input');
 const number=(key:string):number|null=>{const v=property[key];if(v===null||v===undefined||typeof v==='string'&&!v.trim())return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new PredictionError('Property measurements are invalid. Review the stored property details.','input');return v;};
 const area=number('floor_area_sqm');if(area===null||area<=0)throw new PredictionError('A positive floor area is needed for a useful estimate.','input');
 const city=typeof property.city==='string'?cities[property.city]:undefined;if(!city)throw new PredictionError('This property city is not supported by RentLease.','input');
 const furnishing=property.furnishing_status;if(!['unfurnished','semi_furnished','furnished'].includes(String(furnishing)))throw new PredictionError('Review the property furnishing information.','input');
 if(amenities!==null&&(!Array.isArray(amenities)||amenities.some(v=>typeof v!=='string')))throw new PredictionError('Property amenities could not be verified.','input');
 let category;try{category=modelPropertyCategory(type,property.property_subtype);}catch{throw new PredictionError('Review the saved property subtype for this category.','input');}
 const lot=number('lot_area_sqm'),parking=number('parking_spaces');if(parking!==null&&!Number.isSafeInteger(parking))throw new PredictionError('Review the saved parking-space count.','input');
 return {...category,city,furnishing_status:String(furnishing),bedrooms:number('bedrooms'),bathrooms:number('bathrooms'),floor_area_sqm:area,floor_number:number('floor_number'),lot_area_sqm:lot,parking_spaces:parking,latitude:null,longitude:null,amenities_normalized:mapPredictionAmenities(amenities)};
}
/** Validate supplied arithmetic bounds against the point. Never invent missing bounds or model uncertainty. */
function parseIllustrativeRange(estimate:number,minimum:unknown,maximum:unknown):IllustrativeRentalRange|null {
 if(typeof minimum!=='number'||typeof maximum!=='number'||!Number.isFinite(minimum)||!Number.isFinite(maximum)||minimum<=0||minimum>estimate||maximum<estimate||minimum>=maximum)return null;
 // Estimate and bounds can be independently rounded to PHP cents upstream.
 // Two cents accommodates that rounding, without accepting a different band.
 const tolerance=0.02;
 if(Math.abs(minimum-estimate*(1-RANGE_HALF_WIDTH))>tolerance||Math.abs(maximum-estimate*(1+RANGE_HALF_WIDTH))>tolerance)return null;
 return {minimum,maximum};
}
export function parseModelPrediction(value:unknown):ModelPrediction {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new PredictionError('The estimator returned an invalid result.');const r=value as Record<string,unknown>;
 if(typeof r.estimated_rent_monthly!=='number'||!Number.isFinite(r.estimated_rent_monthly)||r.estimated_rent_monthly<=0||r.currency!=='PHP'||typeof r.model_version!=='string'||!r.model_version.trim()||r.model_version.length>100)throw new PredictionError('The estimator returned an invalid result.');
 return {estimatedMonthlyRent:r.estimated_rent_monthly,currency:'PHP',modelVersion:r.model_version,illustrativeRange:parseIllustrativeRange(r.estimated_rent_monthly,r.range_min,r.range_max)};
}
export function parsePredictionReceipt(value:unknown,target:PredictionTarget):PredictionReceipt {
 if(!value||typeof value!=='object')throw new PredictionError('The estimator returned an invalid result.');const r=value as Record<string,unknown>;
 const range=r.illustrativeRange&&typeof r.illustrativeRange==='object'?r.illustrativeRange as Record<string,unknown>:null;
 const model=parseModelPrediction({estimated_rent_monthly:r.estimatedMonthlyRent,currency:r.currency,model_version:r.modelVersion,range_min:range?.minimum,range_max:range?.maximum});
 const receivedTarget=parsePredictionTarget(r.target);
 if(JSON.stringify(receivedTarget)!==JSON.stringify(target)||typeof r.predictedAt!=='string'||!Number.isFinite(Date.parse(r.predictedAt))||(r.askingRent!==null&&(typeof r.askingRent!=='number'||!Number.isFinite(r.askingRent)||r.askingRent<=0)))throw new PredictionError('The estimate could not be matched to this property.');
 // The point value ends here: the UI model keeps the range only, rounded outward.
 return {currency:model.currency,modelVersion:model.modelVersion,illustrativeRange:model.illustrativeRange?roundRangeOutward(model.illustrativeRange.minimum,model.illustrativeRange.maximum):null,target:receivedTarget,predictedAt:r.predictedAt,askingRent:r.askingRent as number|null};
}
export const formatMonthlyPhp=(amount:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(amount)+' / month';
