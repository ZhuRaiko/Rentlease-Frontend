/**
 * The fixed review tags (Feature 4). The codes are what the server stores and validates; the labels are what people read.
 * Property tags go on a review of a property (tenant rates the stay), tenant tags on a review of a tenant (landlord rates the tenant).
 * The server accepts only these lists, at most MAX_REVIEW_TAGS per review, no duplicates.
 */
export type TagGroup = 'property' | 'user';
export const MAX_REVIEW_TAGS = 5;

export const PROPERTY_TAGS = [
  { code: 'clean', label: 'Clean' },
  { code: 'good_wifi', label: 'Good wifi' },
  { code: 'quiet', label: 'Quiet' },
  { code: 'safe_area', label: 'Safe area' },
  { code: 'fair_price', label: 'Fair price' },
  { code: 'well_maintained', label: 'Well maintained' },
  { code: 'matches_listing', label: 'Matches the listing' },
  { code: 'good_location', label: 'Good location' },
] as const;

export const TENANT_TAGS = [
  { code: 'communicated_well', label: 'Communicated well' },
  { code: 'respectful', label: 'Respectful' },
  { code: 'paid_on_time', label: 'Paid on time' },
  { code: 'kept_clean', label: 'Kept the place clean' },
  { code: 'followed_rules', label: 'Followed house rules' },
  { code: 'reported_issues_early', label: 'Reported issues early' },
] as const;

export interface TagOption { code: string; label: string }
export const tagOptions = (group: TagGroup): readonly TagOption[] => (group === 'property' ? PROPERTY_TAGS : TENANT_TAGS);
export const isKnownTag = (group: TagGroup, code: string): boolean => tagOptions(group).some(t => t.code === code);

/** Label for a stored code, or null when the code is not one of ours (an unknown code is never shown raw). */
export function tagLabel(group: TagGroup, code: string): string | null {
  return tagOptions(group).find(t => t.code === code)?.label ?? null;
}

/** Server tags for display: known codes only, in the server's order, each once. Anything else is ignored. */
export function knownTags(group: TagGroup, codes: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of codes) {
    if (!isKnownTag(group, code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** Labels of the known tags, in order. */
export const tagLabels = (group: TagGroup, codes: readonly string[]): string[] => knownTags(group, codes).map(c => tagLabel(group, c)!);

/** Select or unselect a tag. A sixth tag is not added; an unknown tag is never added. */
export function toggleTag(group: TagGroup, selected: readonly string[], code: string): string[] {
  if (selected.includes(code)) return selected.filter(c => c !== code);
  if (!isKnownTag(group, code) || selected.length >= MAX_REVIEW_TAGS) return [...selected];
  return [...selected, code];
}

/** A tag that cannot be added now: not selected and the limit is reached. */
export const tagDisabled = (selected: readonly string[], code: string): boolean => !selected.includes(code) && selected.length >= MAX_REVIEW_TAGS;

/** Valid for sending: known codes only, distinct, at most MAX_REVIEW_TAGS. */
export function tagsValidForSubmit(group: TagGroup, tags: readonly string[]): boolean {
  return tags.length <= MAX_REVIEW_TAGS && new Set(tags).size === tags.length && tags.every(c => isKnownTag(group, c));
}
