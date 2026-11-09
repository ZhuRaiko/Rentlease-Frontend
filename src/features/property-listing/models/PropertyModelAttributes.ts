export class ModelAttributeError extends Error {constructor(public readonly field:'propertySubtype'|'lotAreaSqm'|'parkingSpaces',message:string){super(message);}}
export interface PropertyModelAttributeDraft {propertySubtype?:string;lotAreaSqm?:string;parkingSpaces?:string}
export const modelSubtypeOptions=(type:string|null):readonly string[]=>type==='house'?['house','townhouse','beach_house','villa']:type==='apartment'||type==='condominium'?['apartment','room','condominium','studio','loft','penthouse','condotel']:[];
export function propertyModelAttributes(type:string|null,d:PropertyModelAttributeDraft){
 const subtype=d.propertySubtype?.trim()||null;
 if(subtype&&!modelSubtypeOptions(type).includes(subtype))throw new ModelAttributeError('propertySubtype','Choose a subtype for this property category, or leave it unspecified.');
 const parse=(value:string|undefined,parking=false)=>{if(!value?.trim())return null;const n=Number(value);if(!Number.isFinite(n)||n<0||(parking?(!Number.isInteger(n)||n>2147483647):Math.round(n*100)>=10000000000))throw new ModelAttributeError(parking?'parkingSpaces':'lotAreaSqm',parking?'Enter a whole, nonnegative parking-space count or leave it blank.':'Enter a valid nonnegative lot area or leave it blank.');return parking?n:Math.round(n*100)/100;};
 return {p_property_subtype:subtype,p_lot_area_sqm:parse(d.lotAreaSqm),p_parking_spaces:parse(d.parkingSpaces,true)};
}
export const hasModelAttributes=(d:PropertyModelAttributeDraft)=>!!(d.propertySubtype?.trim()||d.lotAreaSqm?.trim()||d.parkingSpaces?.trim());
