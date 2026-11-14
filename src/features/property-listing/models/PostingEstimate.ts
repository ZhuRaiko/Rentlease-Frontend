import {rentalEstimateEligibility} from '../../../shared/models/RentalEstimateEligibility';
import {propertyTypeOptions,propertyCityOptions,furnishingOptions} from './DraftProperty';

/** The posting wizard's view of the property: the same shape for a new draft and for the saved (routine) editor. */
export interface EstimateInputs {
  propertyType:string|null;city:string|null;furnishingStatus:string|null;propertySubtype:string;
  floorAreaSqm:string;floorNumber:string;lotAreaSqm:string;parkingSpaces:string;bedrooms:string;bathrooms:string;amenityCount:number;
}
const filled=(value?:string|null)=>!!value&&!!value.trim();
export const validFloorArea=(value:string)=>{const n=value.trim()===''?NaN:Number(value);return Number.isFinite(n)&&n>0;};

/**
 * True when the estimator would accept this property if it had a floor area. Reuses the shared eligibility
 * (type, city, furnishing, subtype) with a stand-in area, so those rules are not copied here.
 */
export const estimateNeedsFloorArea=(i:Pick<EstimateInputs,'propertyType'|'city'|'furnishingStatus'|'propertySubtype'>)=>
  rentalEstimateEligibility({property_type:i.propertyType,city:i.city,furnishing_status:i.furnishingStatus,property_subtype:i.propertySubtype||null,floor_area_sqm:1}).eligible;

/** Required in the wizard only when the property can be estimated; otherwise optional. */
export const floorAreaRequired=estimateNeedsFloorArea;
export const floorAreaMissing=(i:EstimateInputs)=>floorAreaRequired(i)&&!validFloorArea(i.floorAreaSqm);

/** The fields the estimator reads (see mapPredictionInput), in the order the form shows them. One list feeds the count and the names. */
const estimateChecks=(i:EstimateInputs):readonly (readonly [string,boolean])[]=>[
  ['floor area',validFloorArea(i.floorAreaSqm)],['floor number or lot area',filled(i.floorNumber)||filled(i.lotAreaSqm)],['parking spaces',filled(i.parkingSpaces)],['subtype',filled(i.propertySubtype)],
  ['furnishing',filled(i.furnishingStatus)],['amenities',i.amenityCount>0],['bedrooms',filled(i.bedrooms)],['bathrooms',filled(i.bathrooms)]];
/** Plain count of the estimate details filled. No accuracy claim. */
export function estimateDetailCount(i:EstimateInputs){
  const checks=estimateChecks(i);
  return {filled:checks.filter(([,ok])=>ok).length,total:checks.length};
}
/** Names of the estimate details still missing, in form order, so the meter can say what to add. */
export const missingEstimateDetails=(i:EstimateInputs):string[]=>estimateChecks(i).filter(([,ok])=>!ok).map(([name])=>name);

/** "House · 85 sqm · 3 bd · Imus · Semi-furnished" from saved values, skipping anything unknown. */
export function estimateBasis(p:{property_type?:unknown;floor_area_sqm?:unknown;bedrooms?:unknown;city?:unknown;furnishing_status?:unknown}|null|undefined):string {
  if(!p)return '';
  const label=(options:readonly {value:string;label:string}[],value:unknown)=>options.find(o=>o.value===value)?.label;
  return [label(propertyTypeOptions,p.property_type),typeof p.floor_area_sqm==='number'&&p.floor_area_sqm>0?`${p.floor_area_sqm} sqm`:null,typeof p.bedrooms==='number'?`${p.bedrooms} bd`:null,label(propertyCityOptions,p.city),label(furnishingOptions,p.furnishing_status)].filter(Boolean).join(' · ');
}
