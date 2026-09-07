export type EstimateActor = 'tenant' | 'landlord';

export type RentalPriceEstimationScreen =
  | 'introduction'
  | 'selectProperty'
  | 'propertyReview'
  | 'loading'
  | 'landlordResult'
  | 'suggestedRange'
  | 'landlordComparison'
  | 'tenantComparison'
  | 'estimateInformation'
  | 'estimateHistory'
  | 'unavailable'
  | 'error';

export interface EstimatePropertyPreview {
  id: string;
  title: string;
  address: string;
  city: 'Imus' | 'Dasmariñas' | 'Tagaytay';
  propertyType: string;
  furnished: boolean;
  landArea: number | null;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  amenities: string[];
  askingRent: number;
  imageCrop: { x: number; y: number; width: number; height: number };
  estimateAvailable: boolean;
}

export interface RentalPriceEstimate {
  propertyId: string;
  estimatedMonthlyRent: number;
  suggestedMinimum: number;
  suggestedMaximum: number;
  askingRent: number;
  differenceAmount: number;
  differencePercent: number;
  comparison: 'below-range' | 'within-range' | 'above-range';
  confidenceLabel: 'High' | 'Moderate';
  estimatedAt: string;
}

export interface DatedRentalPriceEstimate {
  id: string;
  estimatedMonthlyRent: number;
  suggestedMinimum: number;
  suggestedMaximum: number;
  estimatedAt: string;
}

export const estimatePropertyPreviews: EstimatePropertyPreview[] = [
  {
    id: 'estimate-imus-house',
    title: '2-Bedroom House with Balcony',
    address: 'Brgy. Alapan II-B, Imus, Cavite',
    city: 'Imus',
    propertyType: 'House for rent',
    furnished: true,
    landArea: 110,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    amenities: ['Wi-fi', 'Airconditioning', 'Parking Space'],
    askingRent: 60_800,
    imageCrop: { x: 2, y: 25, width: 225, height: 105 },
    estimateAvailable: true,
  },
  {
    id: 'estimate-dasma-studio',
    title: 'Studio Unit near DLSU-D',
    address: 'Brgy. Burol Main, Dasmariñas, Cavite',
    city: 'Dasmariñas',
    propertyType: 'Studio apartment',
    furnished: true,
    landArea: 28,
    bedrooms: 1,
    bathrooms: 1,
    parkingSpaces: 0,
    amenities: ['Wi-fi', 'Airconditioning'],
    askingRent: 18_500,
    imageCrop: { x: 108, y: 154, width: 44, height: 33 },
    estimateAvailable: true,
  },
  {
    id: 'estimate-incomplete-draft',
    title: 'Untitled property draft',
    address: 'Tagaytay, Cavite',
    city: 'Tagaytay',
    propertyType: 'Condominium unit',
    furnished: false,
    landArea: null,
    bedrooms: 1,
    bathrooms: 1,
    parkingSpaces: 0,
    amenities: [],
    askingRent: 0,
    imageCrop: { x: 108, y: 154, width: 44, height: 33 },
    estimateAvailable: false,
  },
];

export const previewRentalEstimate: RentalPriceEstimate = {
  propertyId: 'estimate-imus-house',
  estimatedMonthlyRent: 58_400,
  suggestedMinimum: 52_000,
  suggestedMaximum: 64_000,
  askingRent: 60_800,
  differenceAmount: 2_400,
  differencePercent: 4.1,
  comparison: 'within-range',
  confidenceLabel: 'High',
  estimatedAt: 'September 6, 2026',
};

export const previousEstimatePreviews: DatedRentalPriceEstimate[] = [
  {
    id: 'estimate-history-current',
    estimatedMonthlyRent: 58_400,
    suggestedMinimum: 52_000,
    suggestedMaximum: 64_000,
    estimatedAt: 'September 6, 2026',
  },
  {
    id: 'estimate-history-june',
    estimatedMonthlyRent: 56_900,
    suggestedMinimum: 50_500,
    suggestedMaximum: 62_500,
    estimatedAt: 'June 18, 2026',
  },
];
