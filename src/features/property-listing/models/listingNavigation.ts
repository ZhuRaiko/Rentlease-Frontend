import type { ListingScreen } from './PropertyListing';

const creation: readonly ListingScreen[] = ['postingType', 'photoUpload', 'photoManager', 'basicInfo', 'specifications', 'address', 'mapConfirm', 'amenities', 'rentTerms', 'description', 'rules', 'availability'];
const preview: readonly ListingScreen[] = ['preview', 'missingRequirements', 'publishConfirmation'];
export const isListingEditor = (screen: ListingScreen) => creation.includes(screen) || preview.includes(screen) || screen === 'editListing';
export const leavesListingEditor = (screen: ListingScreen, target: ListingScreen) => isListingEditor(screen) && !isListingEditor(target);
export const listingActiveTab = (screen: ListingScreen) => creation.includes(screen) || preview.includes(screen) ? 'post' as const : 'listing' as const;
