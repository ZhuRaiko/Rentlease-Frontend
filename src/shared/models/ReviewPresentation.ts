import type { ReceivedReview, ReviewContext, ReviewKind, ReviewRow, ReviewStatus, ReviewSummary, SummaryKind } from './RentalReview';
import { knownTags, tagLabels, type TagGroup } from './ReviewTags';

/** The word under the stars. One to five. */
export const STAR_WORDS: Record<number, string> = { 1: 'Bad', 2: 'Poor', 3: 'OK', 4: 'Good', 5: 'Excellent' };
export const starWord = (rating: number | null): string => (rating !== null && STAR_WORDS[rating]) || 'Tap a star to rate';
export const COMMENT_LIMIT = 2000;
export const commentCounter = (text: string): string => `${text.length} / ${COMMENT_LIMIT}`;

export const groupOf = (kind: ReviewKind): TagGroup => (kind === 'property' ? 'property' : 'user');

export interface FormCopy {
  title: string;
  question: string;
  info: string;
  submit: string;
  commentPlaceholder: string;
}
/**
 * Copy for the rate screen, by the person's role. `name` is the tenant's name (from the tenancy's people), never taken from a review.
 * The tenant info line is the wireframe's. The landlord line is the wireframe's first sentence, then says what the tenant sees truthfully.
 */
export function formCopy(role: 'tenant' | 'landlord', rawName: string): FormCopy {
  const name = rawName.trim(), who = name || 'your tenant';
  return role === 'tenant'
    ? { title: 'Rate your stay', question: 'How was your stay?', submit: 'Submit review', commentPlaceholder: 'Share what it was like to live here',
        info: "An admin checks every review before it appears. You can't edit it after sending. Don't include contact details." }
    : { title: 'Rate your tenant', question: name ? `How was ${name} as a tenant?` : 'How was your tenant?', submit: 'Submit review', commentPlaceholder: `Share what it was like to rent to ${who}`,
        info: `Shown on ${who}'s profile after an admin approves it. It doesn't show your name. You can't edit it after sending.` };
}

export type StepState = 'done' | 'current' | 'upcoming';
export interface SentStep { key: 'sent' | 'check' | 'published'; label: string; detail: string; state: StepState }
export interface SentView {
  heading: string;
  body: string;
  chip: { label: string; tone: 'warning' | 'positive' | 'neutral' };
  steps: SentStep[];
  cardTitle: string;
}
/** The "Review sent" screen. Everything comes from the STORED review's status, never from what the screen just did. */
export function sentView(status: ReviewStatus, role: 'tenant' | 'landlord', rawName: string, createdLabel: string): SentView {
  const name = rawName.trim() || 'your tenant';
  const subject = role === 'tenant' ? 'the property' : name;
  const published = role === 'tenant' ? 'Published on the property' : `Published on ${name}'s profile`;
  const cardTitle = role === 'tenant' ? 'Your review of the property' : `Your review of ${name}`;
  if (status === 'approved') {
    return { heading: role === 'tenant' || name === 'your tenant' ? 'Your review is published' : `Your review of ${name} is published`, body: 'An admin approved it.', chip: { label: 'Published', tone: 'positive' }, cardTitle,
      steps: [{ key: 'sent', label: 'Sent', detail: createdLabel, state: 'done' }, { key: 'check', label: 'Admin check', detail: 'Approved', state: 'done' }, { key: 'published', label: published, detail: 'Live', state: 'done' }] };
  }
  if (status === 'rejected' || status === 'hidden') {
    return { heading: 'This review was not published', body: `It will not appear for ${subject}. It can't be edited or sent again.`, chip: { label: 'Not published', tone: 'neutral' }, cardTitle,
      steps: [{ key: 'sent', label: 'Sent', detail: createdLabel, state: 'done' }, { key: 'check', label: 'Admin check', detail: 'Done', state: 'done' }, { key: 'published', label: 'Not published', detail: 'Not shown to others', state: 'current' }] };
  }
  return { heading: role === 'tenant' || name === 'your tenant' ? 'Thanks, your review is in' : `Thanks, ${name}'s review is in`, body: 'An admin checks it first, usually within a day. It appears once approved.', chip: { label: 'Pending review', tone: 'warning' }, cardTitle,
    steps: [{ key: 'sent', label: 'Sent', detail: createdLabel, state: 'done' }, { key: 'check', label: 'Admin check', detail: 'Pending', state: 'current' }, { key: 'published', label: published, detail: 'After approval', state: 'upcoming' }] };
}

/** "Today" or "Nov 12", in Manila time. */
export function sentDateLabel(createdAt: string, now: number = Date.now()): string {
  const day = (ms: number) => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return '';
  if (day(created) === day(now)) return 'Today';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }).format(new Date(created));
}

/** "Nov 2026". */
export const monthYear = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', year: 'numeric' }).format(new Date(t)) : '';
};

export const filledStars = (rating: number): number => Math.max(0, Math.min(5, Math.round(rating)));

export interface SummaryView {
  empty: boolean;
  /** Hidden (null) when there are no reviews. */
  average: string | null;
  starsFilled: number;
  countLine: string;
  tags: { code: string; label: string; count: number }[];
}
/** The ratings header. With no reviews: "No reviews yet", no average and no stars. */
export function summaryView(s: ReviewSummary, audience: 'property' | 'landlord' | 'tenant' = 'property'): SummaryView {
  const group: TagGroup = s.kind === 'tenant' ? 'user' : 'property';
  const tags = s.tags.filter(t => knownTags(group, [t.tag]).length === 1).map(t => ({ code: t.tag, label: tagLabels(group, [t.tag])[0]!, count: t.count }));
  if (s.count === 0 || s.average === null) return { empty: true, average: null, starsFilled: 0, countLine: 'No reviews yet', tags: [] };
  const unit = s.count === 1 ? 'review' : 'reviews';
  const from = audience === 'property' ? ' from past tenants' : '';
  return { empty: false, average: s.average.toFixed(1), starsFilled: filledStars(s.average), countLine: `${s.count} ${unit}${from}`, tags };
}

/** "★ 4.8 landlord" for the owner row. Null (hidden) when there is no summary or no review. */
export function landlordRatingLine(s: ReviewSummary | null | undefined): string | null {
  if (!s || s.kind !== 'landlord' || s.count === 0 || s.average === null) return null;
  return `★ ${s.average.toFixed(1)} landlord`;
}

export interface PublishedRowView { key: string; stars: number; role: string | null; month: string; text: string | null; tags: string[] }
export function publishedRowView(r: ReviewRow): PublishedRowView {
  return { key: r.id, stars: r.rating, role: r.reviewerRole === 'tenant' ? 'Tenant' : r.reviewerRole === 'landlord' ? 'Landlord' : null, month: monthYear(r.createdAt), text: r.text, tags: tagLabels(groupOf(r.kind), r.tags ?? []) };
}

/** First reviews shown, then "See all N reviews". */
export const PREVIEW_ROWS = 3;
export const seeAllLabel = (count: number): string => `See all ${count} reviews`;

export const WORD_CLOUD_UNAVAILABLE = 'Not available right now';

export interface ReviewLine { key: string; label: string; status: string | null; rating: number; text: string | null; tags: string[] }
/** A received (counterpart, approved) review for the details card. The name comes from the tenancy's people, never from the review. */
export function receivedLine(r: ReceivedReview, otherName: string): ReviewLine {
  return { key: r.id, label: r.kind === 'property' ? `${otherName}'s review of this property` : `${otherName}'s review of you`, status: null, rating: r.rating, text: r.text, tags: tagLabels(groupOf(r.kind), r.tags) };
}

export const summaryKindLabel = (k: SummaryKind): string => (k === 'property' ? 'property' : k);

/** Which direction this person rates, from the loaded context: the tenant the property, the landlord the tenant. */
export const roleOfActor = (c: ReviewContext, actor: string): 'tenant' | 'landlord' | null => (actor === c.tenantId ? 'tenant' : actor === c.landlordId ? 'landlord' : null);

/** Themes need a few tag selections to say anything. Below this the section shows the reviews only. */
export const THEMES_MIN_TAGS = 3;
export const NO_REVIEWS_CARD = 'No reviews yet. Reviews appear after a tenant finishes a stay.';
export const STAYS_WITH_PROPERTY = 'Reviews stay with this property, even when it is listed again.';
export type FeedbackTab = 'Themes' | 'Reviews';
/**
 * How the ratings section on a listing is laid out, decided once the summary has loaded:
 * no approved reviews -> one muted card; fewer than THEMES_MIN_TAGS tag selections -> the reviews only, no tabs;
 * otherwise tabs, opening on Themes.
 */
export type FeedbackLayout = { mode: 'loading' | 'empty' | 'reviews_only' | 'tabs'; defaultTab: FeedbackTab | null };
export function feedbackLayout(view: SummaryView | null, summaryFailed = false): FeedbackLayout {
  // A summary that could not be read must not hide the reviews: they show on their own, with the Retry for the summary above them.
  if (!view) return summaryFailed ? { mode: 'reviews_only', defaultTab: 'Reviews' } : { mode: 'loading', defaultTab: null };
  if (view.empty) return { mode: 'empty', defaultTab: null };
  const selections = view.tags.reduce((sum, t) => sum + t.count, 0);
  return selections >= THEMES_MIN_TAGS ? { mode: 'tabs', defaultTab: 'Themes' } : { mode: 'reviews_only', defaultTab: 'Reviews' };
}
export interface CloudWord { code: string; label: string; count: number; fontSize: number; bold: boolean }
/** The tag cloud: a word's size follows how many reviews used it (15 to 30), the most used words are bold. Most used first. */
export function cloudWords(tags: readonly { code: string; label: string; count: number }[]): CloudWord[] {
  const max = Math.max(1, ...tags.map(t => t.count));
  return [...tags].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).map(t => ({ ...t, fontSize: 15 + Math.round(15 * (t.count / max) ** 1.5), bold: t.count / max >= 0.8 }));
}
