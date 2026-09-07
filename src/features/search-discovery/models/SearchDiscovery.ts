export type DiscoveryScreen =
  | 'home'
  | 'searchLocation'
  | 'resultsList'
  | 'resultsMap'
  | 'filters'
  | 'sort'
  | 'locationPermission'
  | 'matchingPreferences'
  | 'propertyDetails'
  | 'photoGallery'
  | 'propertyAmenities'
  | 'nearbyPlaces'
  | 'propertyLocation'
  | 'savedListings'
  | 'noResults'
  | 'searchError';

export type PropertyKind = 'House' | 'Apartment' | 'Condominium' | 'Studio';
export type SortOption = 'Recommended' | 'Price: Low to High' | 'Price: High to Low' | 'Best Match';
export type LocationPermissionState = 'idle' | 'prompt' | 'granted' | 'denied';
export type RenterProfile = 'Student' | 'Working Professionally' | 'Living with a Housemate' | 'Family';
export type StayLength =
  | 'Transient or short-term'
  | 'Short-term (less than 1 month)'
  | 'Medium-term (1–6 months)'
  | 'Long-term (6+ months)';
export type PreferenceFactor = 'Location' | 'Budget' | 'Unit specifications' | 'Amenities';
export type BudgetMode = 'estimate' | 'own';

export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NearbyPlace {
  id: string;
  name: string;
  category: 'School' | 'Hospital' | 'Mall' | 'Transport';
  distance: string;
}

export interface DiscoveryProperty {
  id: string;
  title: string;
  city: 'Imus' | 'Dasmariñas' | 'Tagaytay';
  address: string;
  rent: number;
  rating: number;
  reviewCount: number;
  propertyKind: PropertyKind;
  furnished: boolean;
  bedrooms: number;
  bathrooms: number;
  landArea: number;
  matchScore: number;
  description: string;
  amenities: string[];
  nearbyPlaces: NearbyPlace[];
  coordinates: { latitude: number; longitude: number };
  imageCrop: ImageCrop;
}

export interface DiscoveryFeedPostPreview {
  id: string;
  propertyId: string;
  landlordName: string;
  verificationTier: string;
  caption: string;
  displayedMatchScore: number;
  heroCrop: ImageCrop;
  showGallery: boolean;
  avatar: 'samuel' | 'juan';
  galleryMoreCount: number;
}

export interface DiscoveryFilters {
  city: string;
  minimumRent: number;
  maximumRent: number;
  propertyKinds: PropertyKind[];
  minimumBedrooms: number;
  minimumBathrooms: number;
  minimumLandArea: number;
  furnishedOnly: boolean;
  amenities: string[];
}

export interface MatchingPreferences extends DiscoveryFilters {
  prioritizeNearbyPlaces: boolean;
  renterProfile: RenterProfile;
  stayLength: StayLength;
  budgetMode: BudgetMode;
  unitSpecificationRanking: string[];
  amenityRanking: string[];
  factorRanking: PreferenceFactor[];
}

export const propertyKinds: PropertyKind[] = ['House', 'Apartment', 'Condominium', 'Studio'];
export const discoveryAmenities = [
  'Wi-fi',
  'Parking Space',
  'Airconditioning',
  'Pet friendly',
] as const;
export const sortOptions: SortOption[] = [
  'Recommended',
  'Best Match',
  'Price: Low to High',
  'Price: High to Low',
];

export const defaultDiscoveryFilters: DiscoveryFilters = {
  city: '',
  minimumRent: 0,
  maximumRent: 70000,
  propertyKinds: [],
  minimumBedrooms: 0,
  minimumBathrooms: 0,
  minimumLandArea: 0,
  furnishedOnly: false,
  amenities: [],
};

export const recommendedMatchingPreferences: MatchingPreferences = {
  city: 'Imus',
  minimumRent: 15000,
  maximumRent: 65000,
  propertyKinds: ['House', 'Apartment'],
  minimumBedrooms: 1,
  minimumBathrooms: 1,
  minimumLandArea: 40,
  furnishedOnly: false,
  amenities: ['Wi-fi', 'Parking Space'],
  prioritizeNearbyPlaces: true,
  renterProfile: 'Student',
  stayLength: 'Long-term (6+ months)',
  budgetMode: 'own',
  unitSpecificationRanking: ['Bedrooms', 'Bathrooms', 'Land Area', 'Kitchen', 'Floors'],
  amenityRanking: ['Wi-fi', 'Parking Space', 'Airconditioning', 'Pet friendly'],
  factorRanking: ['Location', 'Budget', 'Unit specifications', 'Amenities'],
};

export const renterProfiles: RenterProfile[] = [
  'Student',
  'Working Professionally',
  'Living with a Housemate',
  'Family',
];

export const stayLengths: StayLength[] = [
  'Transient or short-term',
  'Short-term (less than 1 month)',
  'Medium-term (1–6 months)',
  'Long-term (6+ months)',
];

export const locationSuggestions = [
  'Imus, Cavite',
  'Alapan II-B, Imus, Cavite',
  'Dasmariñas, Cavite',
  'Tagaytay, Cavite',
];

export const previewDiscoveryProperties: DiscoveryProperty[] = [
  {
    id: 'preview-imus-house',
    title: '2-Bedroom House with Balcony',
    city: 'Imus',
    address: 'Brgy. Alapan II-B, Imus, Cavite',
    rent: 60800,
    rating: 4.6,
    reviewCount: 28,
    propertyKind: 'House',
    furnished: true,
    bedrooms: 2,
    bathrooms: 2,
    landArea: 110,
    matchScore: 87,
    description:
      'A bright two-bedroom home with a balcony, equipped kitchen, covered parking, and a calm residential setting for a small family or working professionals.',
    amenities: ['Wi-fi', 'Airconditioning', 'Parking Space'],
    nearbyPlaces: [
      { id: 'imus-school', name: 'Imus National High School', category: 'School', distance: '1.2 km' },
      { id: 'imus-hospital', name: 'Medical Center Imus', category: 'Hospital', distance: '2.1 km' },
      { id: 'imus-mall', name: 'The District Imus', category: 'Mall', distance: '3.4 km' },
      { id: 'imus-terminal', name: 'Imus Transport Terminal', category: 'Transport', distance: '1.8 km' },
    ],
    coordinates: { latitude: 14.4297, longitude: 120.9367 },
    imageCrop: { x: 2, y: 25, width: 225, height: 105 },
  },
  {
    id: 'preview-juan-apartment',
    title: 'City-view Apartment near Imus Center',
    city: 'Imus',
    address: 'Imus City, Cavite',
    rent: 20100,
    rating: 4.2,
    reviewCount: 21,
    propertyKind: 'Apartment',
    furnished: false,
    bedrooms: 1,
    bathrooms: 1,
    landArea: 42,
    matchScore: 88,
    description:
      'A practical one-bedroom apartment close to schools, shops, and public transportation.',
    amenities: ['Wi-fi', 'Pet friendly'],
    nearbyPlaces: [
      { id: 'imus-institute', name: 'Imus Institute', category: 'School', distance: '800 m' },
      { id: 'imus-plaza', name: 'Imus City Plaza', category: 'Transport', distance: '1.1 km' },
      { id: 'district-imus', name: 'The District Imus', category: 'Mall', distance: '3.2 km' },
    ],
    coordinates: { latitude: 14.4297, longitude: 120.9367 },
    imageCrop: { x: 61, y: 154, width: 44, height: 33 },
  },
  {
    id: 'preview-dasma-studio',
    title: 'Studio Unit near DLSU-D',
    city: 'Dasmariñas',
    address: 'Brgy. Burol Main, Dasmariñas, Cavite',
    rent: 18500,
    rating: 4.4,
    reviewCount: 17,
    propertyKind: 'Studio',
    furnished: true,
    bedrooms: 1,
    bathrooms: 1,
    landArea: 28,
    matchScore: 81,
    description: 'A furnished studio close to the university belt, shops, and public transport.',
    amenities: ['Wi-fi', 'Airconditioning'],
    nearbyPlaces: [
      { id: 'dlsu', name: 'DLSU-D', category: 'School', distance: '900 m' },
      { id: 'dasma-hospital', name: 'DLSUMC', category: 'Hospital', distance: '1.4 km' },
      { id: 'dasma-mall', name: 'SM City Dasmariñas', category: 'Mall', distance: '2.6 km' },
    ],
    coordinates: { latitude: 14.3269, longitude: 120.9573 },
    imageCrop: { x: 108, y: 154, width: 44, height: 33 },
  },
  {
    id: 'preview-tagaytay-condo',
    title: 'Furnished Condo with Ridge View',
    city: 'Tagaytay',
    address: 'Tagaytay-Nasugbu Highway, Tagaytay, Cavite',
    rent: 32000,
    rating: 4.8,
    reviewCount: 36,
    propertyKind: 'Condominium',
    furnished: true,
    bedrooms: 1,
    bathrooms: 1,
    landArea: 48,
    matchScore: 76,
    description:
      'A furnished condominium with cool-weather views and convenient access to dining and transport.',
    amenities: ['Wi-fi', 'Airconditioning', 'Parking Space'],
    nearbyPlaces: [
      { id: 'tagaytay-mall', name: 'Ayala Malls Serin', category: 'Mall', distance: '1.1 km' },
      { id: 'tagaytay-hospital', name: 'Tagaytay Medical Center', category: 'Hospital', distance: '2.5 km' },
      { id: 'tagaytay-terminal', name: 'Olivarez Terminal', category: 'Transport', distance: '1.7 km' },
    ],
    coordinates: { latitude: 14.1153, longitude: 120.9621 },
    imageCrop: { x: 108, y: 154, width: 44, height: 33 },
  },
];

export const previewDiscoveryFeed: DiscoveryFeedPostPreview[] = [
  {
    id: 'preview-feed-samuel-house',
    propertyId: 'preview-imus-house',
    landlordName: 'Samuel Feliciano',
    verificationTier: 'Tier 3 Verified Landlord',
    caption:
      'You can sip your coffee on the balcony while watching the city wake up. This 2-bedroom apartment is ready for viewing.',
    displayedMatchScore: 90,
    heroCrop: { x: 2, y: 25, width: 225, height: 113 },
    showGallery: true,
    avatar: 'samuel',
    galleryMoreCount: 4,
  },
  {
    id: 'preview-feed-juan-apartment',
    propertyId: 'preview-juan-apartment',
    landlordName: 'Juan Dela Cruz',
    verificationTier: '',
    caption:
      'Take a look at the new place! Apartment tour coming soon!',
    displayedMatchScore: 88,
    heroCrop: { x: 61, y: 154, width: 44, height: 22 },
    showGallery: true,
    avatar: 'juan',
    galleryMoreCount: 7,
  },
];
