import type {Database,Enums} from '../../../shared/services/supabase/database.types';
import {emptyDraftProperty,propertyValidationIssues,propertyFloorRelationshipMessage,type DraftProperty} from './DraftProperty';
export interface PropertyEditContext {
 owner_id:string;property_id:string;edit_version:string;property_type:Enums<'property_type'>;city:Enums<'cavite_city'>;barangay:string;floor_number:number|null;
 bedrooms:number;bathrooms:number;floor_area_sqm:number|null;max_occupants:number|null;total_floors:number|null;
 furnishing_status:Enums<'furnishing_status'>;access_instructions:string|null;amenity_ids:number[];
 catalog:{id:number;name:string;is_active:boolean}[];open_tenancy:boolean;
}
export type RoutineField='bedrooms'|'bathrooms'|'floorAreaSqm'|'maxOccupants'|'totalFloors'|'furnishingStatus'|'amenityIds'|'accessInstructions';
export type RoutineDraft=Pick<DraftProperty,RoutineField>;
export const materialFields:RoutineField[]=['bedrooms','bathrooms','floorAreaSqm','maxOccupants'];
export class PropertyEditError extends Error {constructor(message:string,public kind:'rejected'|'conflict'|'uncertain'|'access'='rejected'){super(message);this.name='PropertyEditError';}}
export const routineDraft=(c:PropertyEditContext):RoutineDraft=>({bedrooms:String(c.bedrooms),bathrooms:String(c.bathrooms),floorAreaSqm:c.floor_area_sqm===null?'':String(c.floor_area_sqm),maxOccupants:c.max_occupants===null?'':String(c.max_occupants),totalFloors:c.total_floors===null?'':String(c.total_floors),furnishingStatus:c.furnishing_status,amenityIds:[...c.amenity_ids],accessInstructions:c.access_instructions??''});
export function routineIssues(c:PropertyEditContext,d:RoutineDraft){
 const full={...emptyDraftProperty(),...d,propertyType:c.property_type,city:c.city,barangay:c.barangay,addressLine1:'saved identity',floorNumber:c.floor_number===null?'':String(c.floor_number)};
 const issues=propertyValidationIssues(full,false).filter(i=>i.section!=='address'&&i.field!=='propertyType').map(i=>({...i,field:i.field==='floorNumber'?'totalFloors':i.field}));
 if(c.floor_number!==null&&d.totalFloors.trim()&&Number.isInteger(Number(d.totalFloors))&&Number(d.totalFloors)>0&&c.floor_number>Number(d.totalFloors)&&!issues.some(i=>i.field==='totalFloors'))issues.push({field:'totalFloors',section:'floors',kind:'invalid',message:propertyFloorRelationshipMessage});
 const baseline=routineDraft(c);
 if(c.open_tenancy)for(const field of materialFields)if(Number(d[field])!==Number(baseline[field])||(String(d[field]).trim()==='')!==(String(baseline[field]).trim()===''))issues.push({field,section:'property',kind:'invalid',message:'This detail cannot change while a tenancy is proposed, awaiting confirmation, or active.'});
 if(d.amenityIds.some(id=>!c.catalog.some(a=>a.id===id&&a.is_active)))issues.push({field:'amenityIds',section:'amenities',kind:'invalid',message:'Choose available amenities from the catalog.'});
 return issues;
}
export function routinePayload(c:PropertyEditContext,d:RoutineDraft):Omit<Database['public']['Functions']['update_property_details']['Args'],'p_request_id'>{
 const error=routineIssues(c,d)[0];if(error)throw new PropertyEditError(error.message);
 return {p_property_id:c.property_id,p_expected_edit_version:c.edit_version,p_bedrooms:Number(d.bedrooms),p_bathrooms:Number(d.bathrooms),p_floor_area_sqm:d.floorAreaSqm.trim()?Number(d.floorAreaSqm):null,p_max_occupants:d.maxOccupants.trim()?Number(d.maxOccupants):null,p_total_floors:d.totalFloors.trim()?Number(d.totalFloors):null,p_furnishing_status:d.furnishingStatus,p_amenity_ids:[...d.amenityIds].sort((a,b)=>a-b),p_access_instructions:d.accessInstructions.trim()||null};
}

// Compare only persisted routine content. Invalid values stay distinct and guarded.
export function routineFieldsEqual(a:RoutineDraft,b:RoutineDraft):boolean {
 const number=(v:string,optional=false)=>!v.trim()?optional?null:['missing']:Number.isFinite(Number(v))?Number(v):['invalid',v];
 const normalized=(d:RoutineDraft)=>[number(d.bedrooms),number(d.bathrooms),number(d.floorAreaSqm,true),number(d.maxOccupants,true),number(d.totalFloors,true),d.furnishingStatus,[...d.amenityIds].sort((x,y)=>x-y),d.accessInstructions.trim()||null];
 return JSON.stringify(normalized(a))===JSON.stringify(normalized(b));
}
