import { propertyFloorRelationshipMessage } from './DraftProperty';
export class PropertyCreationError extends Error {
  constructor(message: string, public readonly code: 'property_creation_rejected' | 'property_creation_preflight' | 'property_identity_changed') { super(message); }
}
export function propertyCreationBackendError(error: {code?: string; message?: string}): PropertyCreationError {
  const messages: Record<string,string> = {
    'Authentication required':'Sign in again before adding a property.',
    'Active account required':'An active account is required to add a property.',
    'Landlord role required':'The Landlord role is required to add a property.',
    'Tier 1 verification required':'Complete Tier 1 account verification before adding a property.',
    'Barangay is required':'Enter the property barangay.',
    'Address line 1 is required':'Enter address line 1 for the property.',
    'Property coordinates are required':'Confirm the property location on the map before saving.',
    'Invalid latitude':'Confirm a valid property location on the map before saving.',
    'Invalid longitude':'Confirm a valid property location on the map before saving.',
    'One or more amenities are invalid or inactive':'Some amenities are no longer available. Refresh the amenities and select them again.',
  };
  return new PropertyCreationError((error.code==='23514' && error.message?.includes('"properties_floor_numbers"') ? propertyFloorRelationshipMessage : messages[error.message??'']) ?? (error.code==='42501' ? 'Property creation was denied. Check your account and property access.' : 'The property was not saved. Review its details and try again.'),'property_creation_rejected');
}
