// Physical-property persistence uses DraftProperty.ts. Types below describe listing previews only.
export type ListingScreen =
  | 'dashboard'
  | 'empty'
  | 'postingType'
  | 'propertySetup'
  | 'photoUpload'
  | 'photoManager'
  | 'basicInfo'
  | 'specifications'
  | 'address'
  | 'mapConfirm'
  | 'amenities'
  | 'rentTerms'
  | 'description'
  | 'rules'
  | 'availability'
  | 'preview'
  | 'missingRequirements'
  | 'publishConfirmation'
  | 'published'
  | 'management'
  | 'editListing'
  | 'pauseConfirmation'
  | 'reactivateConfirmation'
  | 'unavailableConfirmation'
  | 'archiveConfirmation';

export type ListingStatus = 'draft' | 'published' | 'paused' | 'unavailable' | 'archived';

export type PropertyType =
  | 'Boarding house'
  | 'Studio apartment'
  | 'Resort for sublease'
  | 'Apartment'
  | 'House for rent'
  | 'Condominium unit';

export type Amenity = 'Wi-fi' | 'Parking Spaces' | 'Airconditioning';

export type PropertyRule =
  | 'No smoking'
  | 'Pets allowed'
  | 'No loud parties'
  | 'Visitors allowed';

export interface ListingDraft {
  title: string;
  propertyType: PropertyType | null;
  description: string;
  furnished: boolean;
  landArea: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  amenities: Amenity[];
  address: string;
  pinConfirmed: boolean;
  photoCount: number;
  coverPhotoIndex: number;
  advancePayment: string;
  securityDeposit: string;
  askingRent: string;
  rules: PropertyRule[];
  availableDate: string;
}

export interface PropertyListingSummary {
  id: string;
  title: string;
  address: string;
  rent: string;
  status: ListingStatus;
  bedrooms: number;
  bathrooms: number;
  landArea: string;
}

export interface LandlordListingPreview extends PropertyListingSummary {
  unitCode: string;
  tenancyLabel: string;
  rentLabel: string;
  rentOverdue: boolean;
  photoCount: number;
  views: number;
  inquiries: number;
  rating: number;
  imageCrop: { x: number; y: number; width: number; height: number };
}

export const propertyTypes: PropertyType[] = [
  'Boarding house',
  'Studio apartment',
  'Resort for sublease',
  'Apartment',
  'House for rent',
  'Condominium unit',
];

export const amenities: Amenity[] = ['Wi-fi', 'Parking Spaces', 'Airconditioning'];

export const propertyRules: PropertyRule[] = [
  'No smoking',
  'Pets allowed',
  'No loud parties',
  'Visitors allowed',
];

export const emptyListingDraft: ListingDraft = {
  title: '',
  propertyType: null,
  description: '',
  furnished: false,
  landArea: '',
  bedrooms: 0,
  bathrooms: 0,
  parkingSpaces: 0,
  amenities: [],
  address: '',
  pinConfirmed: false,
  photoCount: 0,
  coverPhotoIndex: 0,
  advancePayment: '',
  securityDeposit: '',
  askingRent: '',
  rules: [],
  availableDate: '',
};

export const figmaPreviewDraft: ListingDraft = {
  title: '2-Bedroom House with Balcony',
  propertyType: 'House for rent',
  description:
    'You can sip your coffee on the balcony while watching the city wake up. This 2-bedroom apartment features a modern open layout, fully equipped kitchen, and covered parking ideal for small families or working professionals.',
  furnished: true,
  landArea: '110',
  bedrooms: 2,
  bathrooms: 2,
  parkingSpaces: 1,
  amenities: ['Wi-fi', 'Airconditioning', 'Parking Spaces'],
  address: 'Brgy. Alapan II-B, Imus, Cavite, Philippines',
  pinConfirmed: true,
  photoCount: 4,
  coverPhotoIndex: 0,
  advancePayment: '1 month advance + 2 months deposit',
  securityDeposit: '2 months',
  askingRent: '60,800',
  rules: ['No smoking', 'Pets allowed', 'Visitors allowed'],
  availableDate: 'September 15, 2026',
};

export const initialPreviewListing: PropertyListingSummary = {
  id: 'figma-property-1',
  title: figmaPreviewDraft.title,
  address: 'Imus City, Cavite',
  rent: '60,800',
  status: 'published',
  bedrooms: figmaPreviewDraft.bedrooms,
  bathrooms: figmaPreviewDraft.bathrooms,
  landArea: figmaPreviewDraft.landArea,
};

export const landlordListingPreviews: LandlordListingPreview[] = [
  {
    ...initialPreviewListing,
    unitCode: 'UC-06',
    tenancyLabel: 'Live · Tenanted',
    rentLabel: 'Rent overdue',
    rentOverdue: true,
    photoCount: 8,
    views: 310,
    inquiries: 28,
    rating: 4.6,
    imageCrop: { x: 2, y: 25, width: 225, height: 70 },
  },
  {
    id: 'figma-property-2',
    title: 'Studio Unit — Near DLSU-D',
    address: 'Dasmariñas City, Cavite',
    rent: '18,500',
    status: 'published',
    bedrooms: 1,
    bathrooms: 1,
    landArea: '28',
    unitCode: 'UC-12',
    tenancyLabel: 'Live · Tenanted',
    rentLabel: 'Rent current',
    rentOverdue: false,
    photoCount: 5,
    views: 178,
    inquiries: 14,
    rating: 4.8,
    imageCrop: { x: 61, y: 154, width: 44, height: 15 },
  },
];

export const requiredListingFields: Array<{
  label: string;
  isMissing: (draft: ListingDraft) => boolean;
  target: ListingScreen;
}> = [
  { label: 'At least one property photo', isMissing: (draft) => draft.photoCount < 1, target: 'photoUpload' },
  { label: 'Listing title', isMissing: (draft) => !draft.title.trim(), target: 'basicInfo' },
  { label: 'Property type', isMissing: (draft) => draft.propertyType === null, target: 'basicInfo' },
  { label: 'Land area', isMissing: (draft) => !draft.landArea.trim(), target: 'specifications' },
  { label: 'Confirmed address pin', isMissing: (draft) => !draft.address.trim() || !draft.pinConfirmed, target: 'address' },
  { label: 'Asking rent', isMissing: (draft) => !draft.askingRent.trim(), target: 'rentTerms' },
  { label: 'Listing description', isMissing: (draft) => !draft.description.trim(), target: 'description' },
  { label: 'Availability date', isMissing: (draft) => !draft.availableDate.trim(), target: 'availability' },
];
