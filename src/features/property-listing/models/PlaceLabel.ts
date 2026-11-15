const particles = new Set(['na', 'ng', 'sa', 'de', 'del', 'y']);
/**
 * "imus" -> "Imus", "san jose" -> "San Jose", "buhay na tubig" -> "Buhay na Tubig". Text that already has a capital was typed on purpose
 * ("Buhay na Tubig", "Alapan II-B") and is left alone.
 */
export const titleCasePlace = (part: string) => {
  const t = part.trim().split(/\s+/).filter(Boolean);
  if (t.some(w => w !== w.toLowerCase())) return t.join(' ');
  return t.map((w, i) => (i > 0 && particles.has(w) ? w : w.replace(/^([^a-z]*)([a-z])/, (_m, p: string, c: string) => p + c.toUpperCase()))).join(' ');
};
/** Joins place parts with ", ": title-cased, empty parts skipped, and a part repeated (any case) shown once. "imus", "Imus" -> "Imus". */
export function placeLabel(parts: readonly (string | null | undefined)[]): string {
  const seen = new Set<string>(), out: string[] = [];
  for (const raw of parts) for (const piece of String(raw ?? '').split(',')) {
    const t = titleCasePlace(piece), key = t.toLowerCase();
    if (t && !seen.has(key)) { seen.add(key); out.push(t); }
  }
  return out.join(', ');
}
