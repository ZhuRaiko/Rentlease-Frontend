import type {MatchingPreferences, PropertyKind, StayLength} from './SearchDiscovery';

/** Which card of the Matching preferences screen is open. Only one is open at a time; "about" is the first one. */
export type PreferenceSection = 'about' | 'property' | 'budget' | 'matters';
export const initialPreferenceSection: PreferenceSection = 'about';
/** Tapping a closed card opens it (and closes the open one); tapping the open card closes it. */
export const toggleSection = (open: PreferenceSection | null, id: PreferenceSection): PreferenceSection | null => open === id ? null : id;

export type RankingField = 'factorRanking' | 'unitSpecificationRanking' | 'amenityRanking';
export const rankingTabs: readonly {id: string; label: string; field: RankingField}[] = [
  {id: 'factors', label: 'Factors', field: 'factorRanking'},
  {id: 'units', label: 'Unit specs', field: 'unitSpecificationRanking'},
  {id: 'amenities', label: 'Amenities', field: 'amenityRanking'},
];

const STAY: Record<StayLength, {title: string; detail: string}> = {
  'Transient or short-term': {title: 'Transient', detail: 'Short-term'},
  'Short-term (less than 1 month)': {title: 'Short-term', detail: 'Less than 1 month'},
  'Medium-term (1–6 months)': {title: 'Medium-term', detail: '1–6 months'},
  'Long-term (6+ months)': {title: 'Long-term', detail: '6+ months'},
};
/** The two lines of a length-of-stay card. The stored value stays the full label. */
export const stayParts = (length: StayLength) => STAY[length];

export const cityLabel = (city: string): string => !city ? '' : city === 'Dasmariñas' ? 'City of Dasmariñas' : `${city} City`;
export const propertyKindLabel = (kind: PropertyKind): string => kind === 'House' ? 'House For Rent' : kind;

export const formatPeso = (amount: number): string => '₱' + String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

type Summarized = Pick<MatchingPreferences, 'renterProfile' | 'stayLength' | 'city' | 'propertyKinds' | 'minimumLandArea' | 'minimumBedrooms' | 'minimumBathrooms' | 'budgetMode' | 'minimumRent' | 'maximumRent' | 'factorRanking'>;

/** "Student · Long-term · Imus City" */
export const aboutSummary = (p: Summarized): string => [p.renterProfile, stayParts(p.stayLength).title, cityLabel(p.city)].filter(Boolean).join(' · ');

/** "House, Apartment · 40 sqm · 1 bed · 1 bath": the kind names, then only the specs that are set. */
export function propertySummary(p: Summarized): string {
  const parts = [p.propertyKinds.length ? p.propertyKinds.join(', ') : 'Any type'];
  if (p.minimumLandArea > 0) parts.push(`${p.minimumLandArea} sqm`);
  if (p.minimumBedrooms > 0) parts.push(`${p.minimumBedrooms} ${p.minimumBedrooms === 1 ? 'bed' : 'beds'}`);
  if (p.minimumBathrooms > 0) parts.push(`${p.minimumBathrooms} ${p.minimumBathrooms === 1 ? 'bath' : 'baths'}`);
  return parts.join(' · ');
}

/** "₱15,000–₱65,000 a month", or "Estimated for you" when RentLease estimates it. */
export function budgetSummary(p: Summarized): string {
  if (p.budgetMode === 'estimate') return 'Estimated for you';
  const {minimumRent: low, maximumRent: high} = p;
  if (low > 0 && high > 0) return budgetRangeError(p) ? 'Check the range' : `${formatPeso(low)}–${formatPeso(high)} a month`;
  if (high > 0) return `Up to ${formatPeso(high)} a month`;
  if (low > 0) return `From ${formatPeso(low)} a month`;
  return 'Not set';
}

/** The factors in order of importance, top three. */
export const mattersSummary = (p: Summarized): string => p.factorRanking.slice(0, 3).join(', ');

export const BUDGET_RANGE_MESSAGE = '“From” can’t be higher than “To”. Swap them or change one.';
export const BUDGET_SAVE_HINT = 'Fix the budget range to save';
/** Only the amounts the user can see and edit are checked: "I will enter my own", with both set. An empty field is "no limit". */
export const budgetRangeError = (p: Pick<MatchingPreferences, 'budgetMode' | 'minimumRent' | 'maximumRent'>): string | null =>
  p.budgetMode === 'own' && p.minimumRent > 0 && p.maximumRent > 0 && p.minimumRent > p.maximumRent ? BUDGET_RANGE_MESSAGE : null;

/** True when the form differs from the last saved (or opening) values. This is what decides whether Close asks first. */
export const preferencesChanged = (current: MatchingPreferences, saved: MatchingPreferences): boolean => JSON.stringify(current) !== JSON.stringify(saved);

/** Where a dragged row lands: the row index moved by the drag distance, kept inside the list. */
export function dragTarget(index: number, dragDistance: number, rowHeight: number, length: number): number {
  if (rowHeight <= 0 || length <= 0) return index;
  return Math.min(length - 1, Math.max(0, index + Math.round(dragDistance / rowHeight)));
}
export const canMoveUp = (index: number): boolean => index > 0;
export const canMoveDown = (index: number, length: number): boolean => index < length - 1;

/** Where the Matching preferences screen was opened from: "workspace" = as the first screen of the Discovery flow (from Profile, or the first-run offer); "discover" = from inside the flow (For You, Edit preferences). */
export type PreferencesOrigin = 'workspace' | 'discover';
export type PreferencesExit = 'skip-introduction' | 'close-workspace' | 'back-in-flow';
/** What Close does on the Matching preferences screen: carry on with the first-run skip, leave the whole Discovery flow (back to Profile), or go back one screen inside it (back to For You). */
export function preferencesExit(introductionPending: boolean, origin: PreferencesOrigin): PreferencesExit {
  return introductionPending ? 'skip-introduction' : origin === 'workspace' ? 'close-workspace' : 'back-in-flow';
}
