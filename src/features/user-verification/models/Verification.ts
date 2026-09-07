export type VerificationActor = 'tenant' | 'landlord';

export type VerificationTier = 1 | 2 | 3;

export type VerificationStatus =
  | 'locked'
  | 'notStarted'
  | 'inProgress'
  | 'pending'
  | 'approved'
  | 'rejected';

export type VerificationScreen =
  | 'overview'
  | 'tier1Intro'
  | 'tier1Email'
  | 'tier1Mobile'
  | 'tier1Complete'
  | 'tier2Intro'
  | 'tier2IdType'
  | 'tier2Upload'
  | 'tier2Review'
  | 'tier2Pending'
  | 'tier2Approved'
  | 'tier2Rejected'
  | 'tier2Resubmission'
  | 'tier3Intro'
  | 'tier3Property'
  | 'tier3Document'
  | 'tier3Review'
  | 'tier3Pending'
  | 'tier3Approved'
  | 'tier3Rejected';

export type GovernmentIdType =
  | 'Driver’s License'
  | 'UMID'
  | 'Passport'
  | 'SSS ID'
  | 'National ID'
  | 'Student’s ID';

export type OwnershipDocumentType =
  | 'Land Title'
  | 'Home-Owners Association Document'
  | 'Notarized Authorization to Lease';

export interface PreviewProperty {
  id: string;
  title: string;
  address: string;
}

export interface VerificationDraft {
  email: string;
  emailCode: string;
  mobile: string;
  mobileCode: string;
  governmentIdType: GovernmentIdType | null;
  tier2FileName: string | null;
  propertyId: string | null;
  ownershipDocumentType: OwnershipDocumentType | null;
  tier3FileName: string | null;
}

export const governmentIdTypes: GovernmentIdType[] = [
  'Driver’s License',
  'UMID',
  'Passport',
  'SSS ID',
  'National ID',
  'Student’s ID',
];

export const ownershipDocumentTypes: OwnershipDocumentType[] = [
  'Land Title',
  'Home-Owners Association Document',
  'Notarized Authorization to Lease',
];

export const previewProperties: PreviewProperty[] = [
  { id: 'property-1', title: 'Daffodil Residence', address: 'Imus, Cavite' },
  { id: 'property-2', title: 'Greenview Apartment', address: 'Dasmariñas, Cavite' },
  { id: 'property-3', title: 'Tagaytay Garden Home', address: 'Tagaytay, Cavite' },
];

export const initialVerificationDraft: VerificationDraft = {
  email: 'samuel.feliciano@example.com',
  emailCode: '',
  mobile: '+63 917 123 4567',
  mobileCode: '',
  governmentIdType: null,
  tier2FileName: null,
  propertyId: null,
  ownershipDocumentType: null,
  tier3FileName: null,
};
