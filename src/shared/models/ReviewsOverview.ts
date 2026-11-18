import {reviewTargets, type ReviewContext, type ReviewStatus} from './RentalReview';

/** An ended tenancy where I was the renter, as read for the Reviews screen. */
export interface EndedStay {id: string; title: string; ended: string}
export interface WaitingReview {tenancyId: string; title: string; ended: string}
export interface OwnPropertyReview {id: string; tenancyId: string; title: string; rating: number; status: ReviewStatus; createdAt: string}
export interface ReviewsOverview {waiting: WaitingReview[]; reviews: OwnPropertyReview[]; /** Ended stays the user has had in all (the first OVERVIEW_LIMIT are checked). */ stays: number}

/** The Reviews screen checks the most recent ended stays only: one review read each, so the number is bounded. */
export const OVERVIEW_LIMIT = 10;

/**
 * Waiting = an ended stay where the renter may still review the property (eligible, no property review yet). Reviews = the renter's own PROPERTY
 * reviews with their status. The review of the other participant (the landlord's rating of a tenant, kind "user") is left out on purpose: the screen
 * does not offer it. A stay whose review read failed (null) is skipped rather than guessed.
 */
export function buildOverview(stays: readonly EndedStay[], contexts: readonly (ReviewContext | null)[], actor: string, total = stays.length): ReviewsOverview {
  const waiting: WaitingReview[] = [], reviews: OwnPropertyReview[] = [];
  stays.forEach((stay, i) => {
    const context = contexts[i];
    if (!context || context.tenantId !== actor) return;
    if (reviewTargets(context, actor).includes('property')) waiting.push({tenancyId: stay.id, title: stay.title, ended: stay.ended});
    for (const own of context.own) if (own.kind === 'property') reviews.push({id: own.id, tenancyId: stay.id, title: stay.title, rating: own.rating, status: own.status, createdAt: own.createdAt});
  });
  reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return {waiting, reviews, stays: total};
}

/** Published / Pending approval; a review an admin rejected or hid is "Not published". */
export const reviewStatusLabel = (status: ReviewStatus): string => status === 'approved' ? 'Published' : status === 'pending' ? 'Pending approval' : 'Not published';
export const PENDING_NOTE = 'It appears on the listing after an admin approves it.';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Stay ended Feb 17, 2027" from a calendar date (YYYY-MM-DD). */
export function stayEndedText(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return m && d && y ? `Stay ended ${MONTHS[m - 1]} ${d}, ${y}` : 'Stay ended';
}
/** "Nov 13": the day a review was sent, in Philippine time. */
export function reviewDay(createdAt: string): string {
  const d = new Date(Date.parse(createdAt) + 8 * 3600000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
