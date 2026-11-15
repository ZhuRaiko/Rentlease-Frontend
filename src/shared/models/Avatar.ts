/** Avatar sizes in dp: lists and chat bubbles, ratings and request cards, profile. */
export const avatarSizes = [36, 48, 96] as const;
export type AvatarSize = (typeof avatarSizes)[number];

/** Snap any requested diameter to the nearest allowed size at or above it, so one circle spec is used everywhere. */
export function avatarDiameter(requested: number): AvatarSize {
  return requested <= 36 ? 36 : requested <= 48 ? 48 : 96;
}

/** Up to two initials from a PUBLIC display name only. Returns null when no letter or digit is available (then the silhouette shows). */
export function avatarInitials(name: string | null | undefined): string | null {
  const words = (name ?? '').normalize('NFC').split(/\s+/).map(word => Array.from(word.replace(/^[^\p{L}\p{N}]+/u, ''))[0]).filter((letter): letter is string => !!letter);
  return words.length ? words.slice(0, 2).join('').toUpperCase() : null;
}
