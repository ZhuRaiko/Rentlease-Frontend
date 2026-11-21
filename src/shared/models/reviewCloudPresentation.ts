import { colors } from '../theme/colors';
import { ui } from '../theme/ui';
import { highlightSegments, type CloudTerm, type ReviewCloud, type ReviewCorpus } from './ReviewWordCloud';
import { publishedRowView } from './ReviewPresentation';

/**
 * What the review word cloud shows, decided in one place and kept free of React so it can be tested. The cloud mines only the free-text comments of approved property
 * reviews; it is a separate addition to the Themes (tag counts). Colors are decoration and carry no meaning.
 */
export type CloudErrorKind = 'network' | 'auth' | 'busy' | 'unavailable' | 'invalid' | 'timeout' | 'generic';
export type CloudLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export const CLOUD_TITLE = 'What tenants wrote';
export const CLOUD_HINT = 'Tap a word to see the reviews that use it.';
export const CLOUD_EMPTY_COPY = 'The word cloud appears once 2 or more reviews share words.';
export const CLOUD_LOADING_TITLE = 'Finding the words tenants wrote…';
export const CLOUD_LOADING_COPY = 'The first time can take up to a minute. You can keep reading.';
export const CLOUD_ERROR_TITLE = 'Couldn’t load what tenants wrote';
/** The smaller card under the word cloud: the tags reviewers picked on the review form, with how many reviews chose each. */
export const TAGS_CARD_TITLE = 'Tags tenants picked';
export const TAGS_CARD_NOTE = 'From the review form. The number is how many reviews chose it.';
/** Matching reviews shown before "Show N more". */
export const MATCH_PREVIEW = 2;
export const showMoreLabel = (hidden: number): string => `Show ${hidden} more`;
/** "7 of 18 reviews mention “wifi”". `total` is every approved review on the property; `count` is how many of them contain the word. */
export const matchHeading = (count: number, total: number, text: string): string => `${count} of ${Math.max(total, count)} ${Math.max(total, count) === 1 ? 'review mentions' : 'reviews mention'} “${text}”`;
/** Plain, non-technical messages. Raw error text is never shown. */
export const cloudErrorCopy: Record<CloudErrorKind, string> = {
  network: 'Check your connection and try again.',
  auth: 'Please sign in again to see the word cloud.',
  busy: 'The word cloud is busy right now. Please try again in a moment.',
  unavailable: 'The word cloud isn’t available right now. Please try again in a moment.',
  invalid: 'The word cloud couldn’t be made from these reviews right now.',
  timeout: 'This is taking longer than usual. Please try again.',
  generic: 'Something went wrong with the word cloud. Please try again.',
};

/** What an HTTP status from the review-wordcloud function means to the owner of the screen. No status at all means the request never got an answer (the network). */
export function cloudErrorKindForStatus(status: number | null | undefined): CloudErrorKind {
  if (status === null || status === undefined) return 'network';
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'busy';
  if (status === 400 || status === 422) return 'invalid';
  if (status === 404 || status === 409 || status === 413 || status >= 500) return 'unavailable';
  return 'generic';
}

/**
 * The service sends one of five color names per word. They carry no meaning, so each maps to a soft tint built from existing theme tokens, and none is red or amber (those read
 * as warnings). The theme has no purple or pink, so two of the five share a neutral tint. Text on its tint is at least 4.5:1 (checked in the tests).
 */
export interface CloudTint { background: string; text: string; border: string }
export const cloudTints: Record<'blue' | 'green' | 'orange' | 'purple' | 'pink', CloudTint> = {
  blue: { background: colors.identitySurface, text: colors.identityInk, border: colors.identityCredentialSurface },
  green: { background: colors.primaryPale, text: colors.accountCredentialInk, border: colors.accountCredentialSurface },
  orange: { background: colors.accountCredentialSurface, text: colors.accountCredentialInk, border: colors.primaryPale },
  purple: { background: colors.surface, text: colors.ink, border: colors.border },
  pink: { background: colors.identityCredentialSurface, text: colors.identityInk, border: colors.identitySurface },
};
const NEUTRAL_TINT: CloudTint = cloudTints.purple;
export const cloudTermTint = (name: unknown): CloudTint => (typeof name === 'string' && Object.hasOwn(cloudTints, name) ? cloudTints[name as keyof typeof cloudTints] : NEUTRAL_TINT);
/** Kept for callers that only need the text color. */
export const cloudColorTokens = { blue: cloudTints.blue.text, green: cloudTints.green.text, orange: cloudTints.orange.text, purple: cloudTints.purple.text, pink: cloudTints.pink.text } as const;
export const cloudTermColor = (name: unknown): string => cloudTermTint(name).text;
/** A word that is not the selected one fades to the plain surface with the secondary text color: colour drops away but the words stay readable (4.5:1 or better). */
export const CLOUD_FADED: CloudTint = { background: colors.background, text: colors.textSecondary, border: colors.outline };
/** The selected word: dark fill, light text and a check mark (so it never relies on colour alone). */
export const CLOUD_SELECTED: CloudTint = { background: colors.ink, text: colors.white, border: colors.ink };

/**
 * Four fixed text sizes for the words, chosen from the service's relative size (about 1.0 to 2.3 rem). The largest is the theme's page title size, so a phrase still fits at 320dp
 * and 150% font size (a long phrase wraps inside its pill rather than overflowing).
 */
export const CLOUD_SIZE_STEPS = [ui.body.fontSize, ui.sectionTitle.fontSize, 20, ui.pageTitle.fontSize] as const;
export function cloudTermFontSize(rem: number): number {
  if (!Number.isFinite(rem) || rem < 1.3) return CLOUD_SIZE_STEPS[0];
  if (rem < 1.65) return CLOUD_SIZE_STEPS[1];
  return rem < 2 ? CLOUD_SIZE_STEPS[2] : CLOUD_SIZE_STEPS[3];
}

export interface CloudChip { id: string; text: string; reviewCount: number; fontSize: number; color: string; tint: CloudTint; accessibilityLabel: string }
export function cloudChips(cloud: ReviewCloud | null): CloudChip[] {
  return (cloud?.terms ?? []).map(t => ({ id: t.id, text: t.text, reviewCount: t.review_count, fontSize: cloudTermFontSize(t.font_size_rem), color: cloudTermColor(t.color), tint: cloudTermTint(t.color),
    accessibilityLabel: `${t.text}, in ${t.review_count} ${t.review_count === 1 ? 'review' : 'reviews'}` }));
}

export type CloudView = { kind: 'hidden' } | { kind: 'loading' } | { kind: 'notice'; message: string } | { kind: 'error'; message: string } | { kind: 'ready' };
/** The state the card is in. Anything unexpected hides the card: the Themes above it never depend on it. */
export function cloudView(input: { signedIn: boolean; status: string; cloud: ReviewCloud | null; errorKind: CloudErrorKind | null }): CloudView {
  if (!input.signedIn) return { kind: 'hidden' };
  switch (input.status) {
    case 'idle': case 'loading': return { kind: 'loading' };
    case 'error': return { kind: 'error', message: cloudErrorCopy[input.errorKind ?? 'generic'] };
    case 'ready': {
      if (!input.cloud) return { kind: 'hidden' };
      if (input.cloud.status === 'ready' && input.cloud.terms.length > 0) return { kind: 'ready' };
      return { kind: 'notice', message: CLOUD_EMPTY_COPY };
    }
    default: return { kind: 'hidden' };
  }
}

export interface MatchingReview { id: string; text: string; segments: { text: string; marked: boolean }[]; stars: number; meta: string }
/** The reviews that contain the selected term, in the order they were read, each split into plain and highlighted parts (code point spans, converted safely). */
export function matchingReviews(corpus: ReviewCorpus | null, term: CloudTerm | null | undefined): MatchingReview[] {
  if (!corpus || !term) return [];
  const out: MatchingReview[] = [];
  for (const row of corpus.rows) {
    const match = term.matches.find(m => m.id === row.id);
    if (match && row.text && row.text.trim()) { const shown = publishedRowView(row); out.push({ id: row.id, text: row.text, segments: highlightSegments(row.text, match.spans), stars: shown.stars, meta: [shown.role, shown.month].filter(Boolean).join(' · ') }); }
  }
  return out;
}
/** Highlight parts for a review shown elsewhere (the Reviews list), or null when nothing should be marked: no term, no match, or the shown text is not the analysed text. */
export function highlightForReview(corpus: ReviewCorpus | null, term: CloudTerm | null | undefined, reviewId: string, shownText: string | null): { text: string; marked: boolean }[] | null {
  if (!corpus || !term || !shownText) return null;
  const row = corpus.rows.find(r => r.id === reviewId), match = term.matches.find(m => m.id === reviewId);
  if (!row || !match || row.text !== shownText) return null;
  const parts = highlightSegments(shownText, match.spans);
  return parts.some(p => p.marked) ? parts : null;
}
/** Tapping the selected term again clears it; tapping another term changes it. */
export const nextSelection = (current: string | null, tapped: string | null): string | null => (tapped === null || tapped === current ? null : tapped);
