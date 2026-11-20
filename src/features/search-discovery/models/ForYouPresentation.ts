/** The states the For You tab can really be in, from the saved preferences and the recommendation workflow's phase. */
export type ForYouState = 'no-preferences' | 'unavailable' | 'loading' | 'error' | 'empty' | 'ranked';

export function forYouState(hasPreferences: boolean, phase: string | undefined, rowCount: number): ForYouState {
  if (!hasPreferences) return 'no-preferences';
  if (phase === 'unavailable') return 'unavailable';
  if (phase === 'error') return 'error';
  if (phase === 'success') return rowCount > 0 ? 'ranked' : 'empty';
  return 'loading';
}

export const SUGGESTIONS_NOTE = 'Recommendations are suggestions, not guarantees.';
/** Also the notice the view model sets right after Save; the For You tab shows it in its info box instead of as a separate notice. */
export const PREFERENCES_SAVED_NOTICE = 'Preferences kept for this session. Recommendations use your selected preferences.';
export const coverageNote = (scanned: number, limited: boolean): string =>
  limited ? 'Ranking covers the first 100 recent filtered listings.' : `Ranking covers ${scanned} loaded ${scanned === 1 ? 'listing' : 'listings'}.`;

/** The one info box under "Recommended rentals": the same sentences the separate notices used, with the real count. The coverage sentence appears once a ranking exists. */
export function infoBoxText(state: ForYouState, scanned: number, limited: boolean): string | null {
  if (state === 'no-preferences') return null;
  const ranked = state === 'ranked' || state === 'empty';
  return [SUGGESTIONS_NOTE, ranked ? coverageNote(scanned, limited) : null, PREFERENCES_SAVED_NOTICE].filter(Boolean).join(' ');
}

/** "Top match" for the first ranked listing, then #2, #3 ... from the ranking order. */
export const rankLabel = (index: number): string => index === 0 ? 'Top match' : `#${index + 1}`;
