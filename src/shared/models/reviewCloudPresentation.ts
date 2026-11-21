import { colors } from '../theme/colors';
import { ui } from '../theme/ui';
import { highlightSegments, type CloudTerm, type ReviewCloud, type ReviewCorpus } from './ReviewWordCloud';

/**
 * What the review word cloud shows, decided in one place and kept free of React so it can be tested. The cloud mines only the free-text comments of approved property
 * reviews; it is a separate addition to the Themes (tag counts). Colors are decoration and carry no meaning.
 */
export type CloudErrorKind = 'network' | 'auth' | 'busy' | 'unavailable' | 'invalid' | 'timeout' | 'generic';
export type CloudLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export const CLOUD_TITLE = 'Words reviewers use';
export const CLOUD_HINT = 'Tap a word to see where it appears in the reviews.';
export const CLOUD_EMPTY_COPY = 'The word cloud appears once 2 or more reviews share words.';
export const CLOUD_LOADING_COPY = 'Finding the words reviewers use most. The first time can take up to a minute.';
/** Plain, non-technical messages. Raw error text is never shown. */
export const cloudErrorCopy: Record<CloudErrorKind, string> = {
  network: 'We couldn’t load the word cloud. Check your connection and try again.',
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

/** The service's color names, mapped to existing theme tokens. There is no purple or pink token in the theme, so purple uses the ink color and pink the rose text color. */
export const cloudColorTokens = { blue: colors.identityInk, green: colors.primaryAction, orange: colors.warning, purple: colors.ink, pink: colors.premiumText } as const;
export const cloudTermColor = (name: unknown): string => (typeof name === 'string' && Object.hasOwn(cloudColorTokens, name) ? cloudColorTokens[name as keyof typeof cloudColorTokens] : colors.ink);

/**
 * Chip text size from the service's relative size (about 1.0 to 2.3 rem), mapped onto the theme's own type scale (body, section title, page title) and no larger than the page
 * title, so a phrase still fits at 320dp and 150% font size (long phrases wrap inside their chip).
 */
export const CLOUD_SIZE_STEPS = [ui.body.fontSize, ui.sectionTitle.fontSize, ui.pageTitle.fontSize] as const;
export function cloudTermFontSize(rem: number): number {
  if (!Number.isFinite(rem) || rem < 1.35) return CLOUD_SIZE_STEPS[0];
  return rem < 1.8 ? CLOUD_SIZE_STEPS[1] : CLOUD_SIZE_STEPS[2];
}

export interface CloudChip { id: string; text: string; reviewCount: number; fontSize: number; color: string; accessibilityLabel: string }
export function cloudChips(cloud: ReviewCloud | null): CloudChip[] {
  return (cloud?.terms ?? []).map(t => ({ id: t.id, text: t.text, reviewCount: t.review_count, fontSize: cloudTermFontSize(t.font_size_rem), color: cloudTermColor(t.color),
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

export interface MatchingReview { id: string; text: string; segments: { text: string; marked: boolean }[] }
/** The reviews that contain the selected term, in the order they were read, each split into plain and highlighted parts (code point spans, converted safely). */
export function matchingReviews(corpus: ReviewCorpus | null, term: CloudTerm | null | undefined): MatchingReview[] {
  if (!corpus || !term) return [];
  const out: MatchingReview[] = [];
  for (const row of corpus.rows) {
    const match = term.matches.find(m => m.id === row.id);
    if (match && row.text && row.text.trim()) out.push({ id: row.id, text: row.text, segments: highlightSegments(row.text, match.spans) });
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
