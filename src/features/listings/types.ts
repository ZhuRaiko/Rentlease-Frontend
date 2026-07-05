export type ListingStatus = 'draft' | 'active' | 'delisted';

export type FurnishingStatus = 'furnished' | 'semi_furnished' | 'unfurnished';

export type ListingAmenity =
  | 'wifi'
  | 'parking'
  | 'air_conditioning'
  | 'near_public_transport'
  | 'near_grocery'
  | 'near_school'
  | 'near_hospital'
  | 'pet_friendly'
  | 'furnished';

export type Listing = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  city: 'Imus' | 'Dasmarinas' | 'Tagaytay';
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  sizeSqm: number;
  propertyType: string;
  furnishingStatus: FurnishingStatus;
  amenities: ListingAmenity[];
  lat: number | null;
  lng: number | null;
  status: ListingStatus;
  imageGradient: readonly [string, string, string];
  landlordName: string;
  landlordBadge: string;
  createdAt: string;
};

export type ListingFilters = {
  city?: Listing['city'] | 'All';
  minPrice?: number;
  maxPrice?: number;
  amenities: ListingAmenity[];
  radiusKm?: number;
};

export type ListingDraft = {
  title: string;
  description: string;
  city: Listing['city'];
  address: string;
  price: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  sizeSqm: string;
  propertyType: string;
  furnishingStatus: FurnishingStatus;
  amenities: ListingAmenity[];
  lat: number | null;
  lng: number | null;
  paymentTerms: string;
  usedSuggestedPrice: boolean;
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  city?: string;
};
