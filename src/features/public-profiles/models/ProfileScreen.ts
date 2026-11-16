import { chooseBlock, profileName, type BlockChoice, type LandlordBlock, type ProfileRating, type ProfileReview, type PublicProfile, type TenantBlock } from '../../../shared/models/PublicProfile';
import { filledStars, monthYear } from '../../../shared/models/ReviewPresentation';
import { tagLabels } from '../../../shared/models/ReviewTags';
import { pesos } from '../../../shared/utils/rentalDates';

export const TENANT_INFO_LINE = 'Landlords you talk to can see this profile. Reviewer names stay hidden.';
export const NO_REVIEWS = 'No reviews yet';
export const UNAVAILABLE = 'Profile unavailable';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface BarRow { stars: number; count: number; fraction: number }
export interface RatingView {
  empty: boolean;
  average: string | null;
  starsFilled: number;
  /** Count line under the stars. */
  countLine: string;
  bars: BarRow[];
  tags: { code: string; label: string; count: number }[];
}
/** The rating card. With no reviews: "No reviews yet", no average, no stars, no bars. */
export function ratingView(r: ProfileRating, group: 'property' | 'user', countLine: (n: number) => string): RatingView {
  const tags = r.tags.map(t => ({ code: t.tag, label: tagLabels(group, [t.tag])[0]!, count: t.count }));
  if (r.count === 0 || r.average === null) return { empty: true, average: null, starsFilled: 0, countLine: NO_REVIEWS, bars: [], tags: [] };
  const peak = Math.max(1, ...r.distribution);
  const bars = [5, 4, 3, 2, 1].map(stars => ({ stars, count: r.distribution[stars - 1]!, fraction: r.distribution[stars - 1]! / peak }));
  return { empty: false, average: r.average.toFixed(1), starsFilled: filledStars(r.average), countLine: countLine(r.count), bars, tags };
}
export interface ReviewLine { key: string; stars: number; heading: string; text: string | null; tags: string[] }
/** Landlord reviews: property title and month. Tenant reviews ("What landlords said"): role and month only, never a property name. */
export function reviewLines(rows: ProfileReview[], kind: 'landlord' | 'tenant'): ReviewLine[] {
  return rows.map((r, i) => ({
    key: `${i}:${r.createdAt}`, stars: r.rating,
    heading: kind === 'landlord' ? [r.propertyTitle ?? 'A property', monthYear(r.createdAt)].filter(Boolean).join(' · ') : ['Landlord', monthYear(r.createdAt)].filter(Boolean).join(' · '),
    text: r.text, tags: tagLabels(kind === 'landlord' ? 'property' : 'user', r.tags),
  }));
}
export interface LandlordView { subtitle: string; rating: RatingView; listings: { id: string; title: string; line: string }[]; reviews: ReviewLine[] }
export function landlordView(b: LandlordBlock): LandlordView {
  return {
    subtitle: `${plural(b.activeListings, 'active listing', 'active listings')} · ${plural(b.propertiesManaged, 'property', 'properties')} managed`,
    rating: ratingView(b.rating, 'property', n => `${plural(n, 'review', 'reviews')} across their properties`),
    listings: b.listings.map(l => ({ id: l.listingId, title: l.title, line: `${l.city.charAt(0).toUpperCase()}${l.city.slice(1)} · ${pesos(l.monthlyRent)} / mo` })),
    reviews: reviewLines(b.recentReviews, 'landlord'),
  };
}
export interface TenantView { subtitle: string; rating: RatingView; reviews: ReviewLine[]; info: string }
export function tenantView(b: TenantBlock): TenantView {
  return {
    subtitle: plural(b.completedStays, 'completed stay', 'completed stays'),
    rating: ratingView(b.rating, 'user', () => `From ${plural(b.reviewerCount, 'landlord', 'landlords')}`),
    reviews: reviewLines(b.recentReviews, 'tenant'), info: TENANT_INFO_LINE,
  };
}
export interface ScreenView { name: string; kind: 'landlord' | 'tenant' | 'identity'; label: string | null; landlord: LandlordView | null; tenant: TenantView | null }
/** What the profile screen shows for one profile and one entry point. */
export function screenView(p: PublicProfile, prefer: 'landlord' | 'tenant' | null): ScreenView {
  const c: BlockChoice = chooseBlock(p, prefer);
  return {
    name: profileName(p.nickname), kind: c.kind,
    label: c.kind === 'landlord' ? 'Landlord' : c.kind === 'tenant' ? 'Tenant' : null,
    landlord: c.kind === 'landlord' ? landlordView(c.block) : null, tenant: c.kind === 'tenant' ? tenantView(c.block) : null,
  };
}
