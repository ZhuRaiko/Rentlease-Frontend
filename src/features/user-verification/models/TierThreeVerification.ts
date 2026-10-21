import type { Enums, Tables } from '../../../shared/services/supabase/database.types';
import type { TierTwoSubmission } from './TierTwoVerification';

export type TierThreeDocumentType = Extract<Enums<'verification_document_type'>, 'land_title' | 'tax_declaration' | 'hoa_document' | 'authorization_to_lease'>;
export const tierThreeDocumentOptions = [
  { label: 'Land Title', value: 'land_title' },
  { label: 'Tax Declaration', value: 'tax_declaration' },
  { label: 'HOA Document', value: 'hoa_document' },
  { label: 'Authorization to Lease', value: 'authorization_to_lease' },
] as const satisfies ReadonlyArray<{ label: string; value: TierThreeDocumentType }>;
export function isTierThreeDocumentType(value: string): value is TierThreeDocumentType {
  return tierThreeDocumentOptions.some(option => option.value === value);
}
// Presentation eligibility only. Services recheck identity; backend RLS/triggers enforce authorization.
export const canEnterTierThree = (tierOneVerified: boolean, hasLandlordRole: boolean) => tierOneVerified && hasLandlordRole;
export type VerificationProperty = Pick<Tables<'properties'>, 'id' | 'landlord_id' | 'property_type' | 'barangay' | 'city'>;
const readable = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
export const verificationPropertyLabel = (property: VerificationProperty) => `${readable(property.property_type)} - ${property.barangay}, ${readable(property.city)}`;
export type TierThreeSubmission = TierTwoSubmission & Pick<Tables<'verification_submissions'>, 'property_id'>;
export type TierThreeScreen = 'intro' | 'property' | 'documentType' | 'document' | 'review' | 'status';
