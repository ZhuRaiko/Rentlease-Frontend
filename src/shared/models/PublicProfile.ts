import { identityUuid, publicAvatarPath } from './PublicIdentity';
import { knownTags } from './ReviewTags';

/** The whitelist get_public_profile returns (Feature 5). Nothing else is ever read, shown or cached. */
export class PublicProfileError extends Error {
  constructor(message: string, readonly denied = false) { super(message); }
}
export const PROFILE_UNAVAILABLE = 'Profile unavailable';
export const FALLBACK_NAME = 'RentLease user';

export type ProfileRole = 'landlord' | 'tenant';
export interface ProfileTag { tag: string; count: number }
export interface ProfileRating { count: number; average: number | null; distribution: number[]; tags: ProfileTag[] }
export interface ProfileReview { rating: number; text: string | null; tags: string[]; createdAt: string; reviewerRole: ProfileRole; propertyTitle: string | null }
export interface ProfileListing { listingId: string; propertyId: string; title: string; city: string; monthlyRent: number }
export interface LandlordBlock { activeListings: number; propertiesManaged: number; rating: ProfileRating; listings: ProfileListing[]; recentReviews: ProfileReview[] }
export interface TenantBlock { completedStays: number; reviewerCount: number; rating: ProfileRating; recentReviews: ProfileReview[] }
export interface PublicProfile {
  id: string; nickname: string | null; avatarPath: string | null; idVerified: boolean; roles: ProfileRole[]; relationship: boolean;
  landlord: LandlordBlock | null; tenant: TenantBlock | null;
}

const bad = (what: string) => new PublicProfileError(`Profile response could not be verified (${what}).`);
const object = (v: unknown, what: string): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw bad(what); return v as Record<string, unknown>; };
/** Exactly these keys, no more and no fewer: an unknown field is a rejected response, never a silently ignored one. */
function exact(r: Record<string, unknown>, keys: readonly string[], what: string) {
  const got = Object.keys(r).sort().join(','), want = [...keys].sort().join(',');
  if (got !== want) throw bad(`${what} fields`);
}
const count = (v: unknown, what: string): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw bad(what); return v; };
const text = (v: unknown, what: string, max: number): string => { if (typeof v !== 'string' || v.length > max) throw bad(what); return v; };
const stamp = (v: unknown, what: string): string => { const s = text(v, what, 50); if (!Number.isFinite(Date.parse(s))) throw bad(what); return s; };
const list = (v: unknown, what: string, max: number): unknown[] => { if (!Array.isArray(v) || v.length > max) throw bad(what); return v; };

function rating(v: unknown, group: 'property' | 'user'): ProfileRating {
  const r = object(v, 'rating'); exact(r, ['count', 'average', 'distribution', 'tags'], 'rating');
  const c = count(r.count, 'rating count');
  const average = r.average === null ? null : typeof r.average === 'number' && Number.isFinite(r.average) && r.average >= 1 && r.average <= 5 ? r.average : undefined;
  if (average === undefined || (c === 0) !== (average === null)) throw bad('rating average');
  const dist = list(r.distribution, 'distribution', 5);
  if (dist.length !== 5 || dist.some(n => typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0)) throw bad('distribution');
  const tags: ProfileTag[] = [];
  for (const t of list(r.tags, 'tags', 8)) {
    const o = object(t, 'tag'); exact(o, ['tag', 'count'], 'tag');
    const n = count(o.count, 'tag count'), name = text(o.tag, 'tag', 40);
    if (n < 1) throw bad('tag count');
    if (knownTags(group, [name]).length === 1 && !tags.some(x => x.tag === name)) tags.push({ tag: name, count: n });  // unknown tags are dropped, never shown raw
  }
  return { count: c, average, distribution: dist as number[], tags };
}
function review(v: unknown, kind: ProfileRole): ProfileReview {
  const r = object(v, 'review');
  exact(r, kind === 'landlord' ? ['rating', 'text', 'tags', 'createdAt', 'reviewerRole', 'propertyTitle'] : ['rating', 'text', 'tags', 'createdAt', 'reviewerRole'], 'review');
  if (typeof r.rating !== 'number' || !Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) throw bad('review rating');
  if (r.reviewerRole !== (kind === 'landlord' ? 'tenant' : 'landlord')) throw bad('review role');
  const rawTags = list(r.tags, 'review tags', 20);
  if (rawTags.some(t => typeof t !== 'string')) throw bad('review tags');
  return {
    rating: r.rating, text: r.text === null ? null : text(r.text, 'review text', 2000), createdAt: stamp(r.createdAt, 'review date'),
    tags: knownTags(kind === 'landlord' ? 'property' : 'user', rawTags as string[]), reviewerRole: r.reviewerRole as ProfileRole,
    propertyTitle: kind === 'landlord' ? text(r.propertyTitle, 'property title', 200) : null,
  };
}
function listing(v: unknown): ProfileListing {
  const r = object(v, 'listing'); exact(r, ['listingId', 'propertyId', 'title', 'city', 'monthlyRent'], 'listing');
  if (!identityUuid(r.listingId) || !identityUuid(r.propertyId) || typeof r.monthlyRent !== 'number' || !Number.isFinite(r.monthlyRent) || r.monthlyRent < 0) throw bad('listing');
  return { listingId: r.listingId, propertyId: r.propertyId, title: text(r.title, 'listing title', 200), city: text(r.city, 'listing city', 60), monthlyRent: r.monthlyRent };
}

/** Strict: the id must be the one asked for, every key must be on the whitelist, every value must have its type. */
export function parsePublicProfile(value: unknown, expectedId: string): PublicProfile {
  const r = object(value, 'profile');
  exact(r, ['id', 'nickname', 'avatarPath', 'idVerified', 'roles', 'relationship', 'landlord', 'tenant'], 'profile');
  if (r.id !== expectedId || !identityUuid(r.id)) throw bad('profile id');
  if (typeof r.idVerified !== 'boolean' || typeof r.relationship !== 'boolean') throw bad('flags');
  const nickname = r.nickname === null ? null : text(r.nickname, 'nickname', 60).trim() || null;
  let avatarPath: string | null = null;
  if (r.avatarPath !== null) { try { avatarPath = publicAvatarPath(text(r.avatarPath, 'avatar', 200), r.id); } catch { throw bad('avatar'); } }
  const roles = list(r.roles, 'roles', 2);
  if (roles.some(x => x !== 'landlord' && x !== 'tenant') || new Set(roles).size !== roles.length) throw bad('roles');
  let landlord: LandlordBlock | null = null, tenant: TenantBlock | null = null;
  if (r.landlord !== null) {
    const l = object(r.landlord, 'landlord'); exact(l, ['activeListings', 'propertiesManaged', 'rating', 'listings', 'recentReviews'], 'landlord');
    landlord = {
      activeListings: count(l.activeListings, 'active listings'), propertiesManaged: count(l.propertiesManaged, 'properties managed'), rating: rating(l.rating, 'property'),
      listings: list(l.listings, 'listings', 5).map(listing), recentReviews: list(l.recentReviews, 'reviews', 10).map(x => review(x, 'landlord')),
    };
  }
  if (r.tenant !== null) {
    const t = object(r.tenant, 'tenant'); exact(t, ['completedStays', 'reviewerCount', 'rating', 'recentReviews'], 'tenant');
    tenant = { completedStays: count(t.completedStays, 'completed stays'), reviewerCount: count(t.reviewerCount, 'reviewer count'), rating: rating(t.rating, 'user'), recentReviews: list(t.recentReviews, 'reviews', 10).map(x => review(x, 'tenant')) };
  }
  if ((landlord && !roles.includes('landlord')) || (tenant && !roles.includes('tenant'))) throw bad('blocks and roles');
  return { id: r.id, nickname, avatarPath, idVerified: r.idVerified, roles: roles as ProfileRole[], relationship: r.relationship, landlord, tenant };
}

/** The name to show: the confirmed nickname, or "RentLease user". Never an empty title. */
export const profileName = (nickname: string | null | undefined): string => nickname?.trim() || FALLBACK_NAME;

export type BlockChoice = { kind: 'landlord'; block: LandlordBlock } | { kind: 'tenant'; block: TenantBlock } | { kind: 'identity' };
/** The entry point chooses the block; if that one is null the other is shown; if both are null, identity only. */
export function chooseBlock(p: PublicProfile, prefer: ProfileRole | null): BlockChoice {
  const order: ProfileRole[] = prefer === 'tenant' ? ['tenant', 'landlord'] : ['landlord', 'tenant'];
  for (const k of order) {
    if (k === 'landlord' && p.landlord) return { kind: 'landlord', block: p.landlord };
    if (k === 'tenant' && p.tenant) return { kind: 'tenant', block: p.tenant };
  }
  return { kind: 'identity' };
}

/** What small surfaces (owner row, chat header, applicant line) show. Only the block for the role the surface is about: a tenant line never borrows a landlord rating. */
export interface ProfileBadge { idVerified: boolean; rating: { average: number; count: number } | null; stays: number | null }
export function profileBadge(p: PublicProfile | null | undefined, role: ProfileRole): ProfileBadge | null {
  if (!p) return null;
  const block = role === 'landlord' ? p.landlord : p.tenant;
  const r = block && block.rating.count > 0 && block.rating.average !== null ? { average: block.rating.average, count: block.rating.count } : null;
  return { idVerified: p.idVerified, rating: r, stays: role === 'tenant' && p.tenant ? p.tenant.completedStays : null };
}
export const ratingText = (average: number): string => average.toFixed(1);
export const staysLabel = (n: number): string => `${n} ${n === 1 ? 'stay' : 'stays'}`;
