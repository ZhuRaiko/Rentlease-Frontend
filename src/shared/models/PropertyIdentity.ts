import type {Enums} from '../services/supabase/database.types';
export interface PropertyIdentitySnapshot {
 property_type:Enums<'property_type'>;city:Enums<'cavite_city'>;barangay:string;floor_number:number|null;
 address_line_1:string;address_line_2:string|null;postal_code:string|null;
 exact_lat:number;exact_lng:number;public_lat:number;public_lng:number;
}
export interface IdentityReviewContext {
 submission_version:string;property_version:string;current_revision_id:string;
 current:PropertyIdentitySnapshot;proposed:PropertyIdentitySnapshot;correction_id:string|null;correction_version:string|null;same_asset_required:boolean;requires_repair:boolean;
}
export const identityDisplayFields = [
 ['property_type','Property type'],['city','City'],['barangay','Barangay'],['address_line_1','Address line 1'],['address_line_2','Address line 2 / unit'],['postal_code','Postal code'],['floor_number','Rental floor'],
] as const;
// Coordinate changes are identified without displaying raw private coordinates.
export function identityLocationChanged(a:PropertyIdentitySnapshot,b:PropertyIdentitySnapshot){return ['exact_lat','exact_lng','public_lat','public_lng'].some(key=>a[key as keyof PropertyIdentitySnapshot]!==b[key as keyof PropertyIdentitySnapshot]);}
