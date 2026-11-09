import {mapPredictionInput} from './RentalPrediction';
export interface RentalEstimateEligibility {eligible:boolean;reason:string|null}
/** Saved fields only. Backend Auth, RLS and current visibility remain authoritative. */
export function rentalEstimateEligibility(property:Record<string,unknown>|null|undefined):RentalEstimateEligibility {
 const denied=(reason:string)=>({eligible:false,reason});
 if(!property)return denied('Saved property details are not available yet. Reopen the details to check estimation eligibility.');
 if(property.is_active===false)return denied('Price estimation is not available because this property is inactive.');
 if(!['house','apartment','condominium'].includes(String(property.property_type)))return denied("Price estimation isn't available for this property. This property type is not currently supported.");
 const area=property.floor_area_sqm;
 if(area===null||area===undefined||typeof area==='string'&&!area.trim())return denied("Price estimation isn't available because the property's floor area has not been provided.");
 if(typeof area!=='number'||!Number.isFinite(area)||area<=0)return denied("Price estimation isn't available because some saved measurements need review.");
 try{mapPredictionInput(property);return {eligible:true,reason:null};}
 catch{return denied("Price estimation isn't available because saved measurements, city, or furnishing details need review.");}
}
