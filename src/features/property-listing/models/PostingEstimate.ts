import {RANGE_PROPERTY_TYPES,rentalEstimateEligibility} from '../../../shared/models/RentalEstimateEligibility';
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

/**
 * Whether a typical-rent range is available for this property, read from the shared eligibility (never a second list):
 * 'none' = no type chosen yet; 'type' = a type the estimator does not accept; 'city' = a supported type in a city it does not cover; 'range' = available.
 * A city that is not chosen yet does not take the range away.
 */
export type RangeSupport='none'|'type'|'city'|'range';
export function rangeSupport(i:{propertyType:string|null;city:string|null}):RangeSupport{
  if(!i.propertyType)return 'none';
  if(!RANGE_PROPERTY_TYPES.includes(i.propertyType))return 'type';
  if(i.city&&!rentalEstimateEligibility({property_type:i.propertyType,city:i.city,furnishing_status:'unfurnished',floor_area_sqm:1}).eligible)return 'city';
  return 'range';
}
/** The details only the range reads. Hidden when there is no range; their values are kept until the property is saved, and then left out. */
export const RANGE_ONLY_FIELDS=['propertySubtype','lotAreaSqm','parkingSpaces','floorNumber'] as const;
export function withoutRangeOnlyValues<T extends {propertyType:string|null;city:string|null;propertySubtype?:string;lotAreaSqm?:string;parkingSpaces?:string;floorNumber:string}>(draft:T):T{
  return rangeSupport(draft)==='range'?draft:{...draft,propertySubtype:'',lotAreaSqm:'',parkingSpaces:'',floorNumber:''};
}
const noun=(label:string)=>/^[aeiou]/i.test(label)?`an ${label.toLowerCase()}`:`a ${label.toLowerCase()}`;
/** The info line at the top of the plain Details card. */
export function rangeInfoLine(support:RangeSupport,typeLabel:string|null,cityLabel:string|null):string|null{
  if(support==='type')return `A typical-rent range is available for apartments, houses and condominiums. For ${typeLabel&&typeLabel!=='Other'?noun(typeLabel):'this type'} you set your own price.`;
  if(support==='city')return `${cityLabel??'This city'} is not covered by typical-rent ranges yet. You set your own price.`;
  return null;
}
export const NO_RANGE_FOOTER:Record<'type'|'city',string>={type:'No range for this type · saves your property',city:'No range for this city · saves your property'};
export const NO_RANGE_PRICE_LINE:Record<'type'|'city',string>={type:'A typical-rent range is not available for this type',city:'A typical-rent range is not available for this city'};
export const GROUP_RANGE_LABEL='Typical-rent range available';
export const GROUP_OWN_PRICE_LABEL='You set your own price';
