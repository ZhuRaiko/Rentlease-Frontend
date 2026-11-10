import {isPredictionId} from './RentalPrediction.ts';
export const rentalLocationPolicy='rental-public-location-v1';
export interface RentalCoordinates {latitude:number;longitude:number}
/** Only an independently caller-authorized server projection may enter this boundary. */
export function parseRentalCoordinates(value:unknown,propertyId:string,editVersion:unknown):RentalCoordinates|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 if(Object.keys(r).sort().join(',')!=='approvedRevision,editVersion,latitude,locationRevision,longitude,policy,propertyId'||r.propertyId!==propertyId||!isPredictionId(editVersion)||r.editVersion!==editVersion||!isPredictionId(r.locationRevision)||r.locationRevision!==r.approvedRevision||r.policy!==rentalLocationPolicy)return null;
 return parsePublicRentalPoint({latitude:r.latitude,longitude:r.longitude});
}

/** Shape validation alone never establishes authorization or approval. */
export function parsePublicRentalPoint(value:unknown):RentalCoordinates|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 if(Object.keys(r).sort().join(',')!=='latitude,longitude')return null;
 if(typeof r.latitude!=='number'||typeof r.longitude!=='number'||!Number.isFinite(r.latitude)||!Number.isFinite(r.longitude)||Math.abs(r.latitude)>85.05112878||Math.abs(r.longitude)>180)return null;
 const rad=Math.PI/180,x=6378137*r.longitude*rad,y=6378137*Math.asinh(Math.tan(r.latitude*rad));
 const centered=(n:number)=>Math.abs(n/300-.5-Math.round(n/300-.5))<1e-7;
 if(!centered(x)||!centered(y))return null;
 return {latitude:r.latitude,longitude:r.longitude};
}
