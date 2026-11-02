import type {PropertyIdentitySnapshot} from '../../../shared/models/PropertyIdentity';
import {emptyDraftProperty,propertyValidationIssues,hasConfirmedPropertyLocation,type DraftProperty,type PropertyValidationIssue} from './DraftProperty';
export type IdentityCorrectionKind='same_property_correction'|'relocation'|'split'|'merge'|'different_unit';
const addressFields=['city','barangay','addressLine1','addressLine2','postalCode'] as const;
const locationFields=['exactLatitude','exactLongitude','publicLatitude','publicLongitude'] as const;
const identityFields=new Set<string>(['propertyType','floorNumber',...addressFields,...locationFields,'location']);
// Pure validation only. A candidate is not an approval, persisted revision, or property.
export function identityChangesRequireLocation(current:DraftProperty,proposed:DraftProperty):boolean {
 return addressFields.some(field=>String(current[field]??'').trim()!==String(proposed[field]??'').trim())
  || locationFields.some(field=>current[field]!==proposed[field]);
}
export function identityCorrectionIssues(current:DraftProperty,proposed:DraftProperty,kind:IdentityCorrectionKind,sameAssetConfirmed:boolean,locationConfirmedForRevision:boolean):PropertyValidationIssue[]{
 const issues:PropertyValidationIssue[]=[];
 if(kind!=='same_property_correction')return[{field:'propertyType',section:'property',kind:'invalid',message:'Relocation, splitting, merging, or another unit requires a new physical property. Existing approval and tenancy history cannot be transferred.'}];
 if(!sameAssetConfirmed)issues.push({field:'propertyType',section:'property',kind:'required',message:'Confirm that these details correct the same physical property, not a different rental.'});
 const candidate={...proposed,totalFloors:current.totalFloors};
 issues.push(...propertyValidationIssues(candidate).filter(issue=>identityFields.has(issue.field)));
 if(identityChangesRequireLocation(current,proposed)&&!locationConfirmedForRevision&&!issues.some(issue=>issue.field==='location'))issues.push({field:'location',section:'location',kind:'required',message:'Confirm the corrected address and location on the map before submitting.'});
 return issues;
}
export function identityCorrectionSnapshot(d:DraftProperty){
 const issue=propertyValidationIssues(d).find(item=>identityFields.has(item.field));
 if(issue||!d.propertyType||!d.city||!hasConfirmedPropertyLocation(d))throw new Error(issue?.message??'Confirm the complete property identity first.');
 return {property_type:d.propertyType,city:d.city,barangay:d.barangay.trim(),floor_number:d.propertyType==='house'||!d.floorNumber.trim()?null:Number(d.floorNumber),
  address_line_1:d.addressLine1.trim(),address_line_2:d.addressLine2.trim()||null,postal_code:d.postalCode.trim()||null,
  exact_lat:d.exactLatitude,exact_lng:d.exactLongitude,public_lat:d.publicLatitude,public_lng:d.publicLongitude};
}

/** Data-quality check only; passing this never establishes ownership or verification. */
export function identityDataRepairRequired(identity: DraftProperty | null): boolean {
 if (!identity) return true;
 try { identityCorrectionSnapshot(identity); return false; }
 catch { return true; }
}

export interface IdentityContext {property_id:string;owner_id:string;edit_version:string;total_floors:number|null;current:PropertyIdentitySnapshot|null;current_revision_id:string|null;verified:boolean;requires_repair:boolean;open_tenancy:boolean;correction:null|{id:string;status:'draft'|'submitted'|'applied'|'rejected'|'cancelled';version:string;proposed:PropertyIdentitySnapshot;submission_id:string|null;submission_status?:string|null;rejection_reason?:string|null;review_note?:string|null}}
export class IdentityError extends Error {constructor(message:string,readonly kind:'rejected'|'conflict'|'uncertain'='rejected'){super(message);}}
export function identityDraft(c:IdentityContext):DraftProperty{const s=c.current;return {...emptyDraftProperty(),propertyType:s?.property_type??null,city:s?.city??null,barangay:s?.barangay??'',addressLine1:s?.address_line_1??'',addressLine2:s?.address_line_2??'',postalCode:s?.postal_code??'',floorNumber:s?.floor_number===null||s?.floor_number===undefined?'':String(s.floor_number),totalFloors:c.total_floors===null?'':String(c.total_floors),exactLatitude:s?.exact_lat??null,exactLongitude:s?.exact_lng??null,publicLatitude:s?.public_lat??null,publicLongitude:s?.public_lng??null};}
