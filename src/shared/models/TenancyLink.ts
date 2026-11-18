/** One ACTIVE tenancy that is linked to a conversation (tenancies.conversation_id). Ids only: no names, amounts or dates. */
export interface ActiveTenancyLink {tenancyId: string; conversationId: string; tenantId: string; landlordId: string; propertyId: string}
export type TenancyRoleTag = 'Your tenant' | 'Your landlord';

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Rows without a conversation link are skipped (the column can be empty); a malformed row is an error, never a guess. */
export function parseActiveTenancyLinks(data: unknown, me: string): ActiveTenancyLink[] {
  if (!Array.isArray(data) || data.length > 100) throw new Error('Tenancy links could not be verified.');
  const links: ActiveTenancyLink[] = [];
  for (const raw of data) {
    const r = raw as Record<string, unknown> | null;
    if (!r || !uuid(r.id) || !uuid(r.tenant_id) || !uuid(r.landlord_id) || !uuid(r.property_id) || ![r.tenant_id, r.landlord_id].includes(me)) throw new Error('Tenancy links could not be verified.');
    if (r.conversation_id === null || r.conversation_id === undefined) continue;
    if (!uuid(r.conversation_id)) throw new Error('Tenancy links could not be verified.');
    links.push({tenancyId: r.id, conversationId: r.conversation_id, tenantId: r.tenant_id, landlordId: r.landlord_id, propertyId: r.property_id});
  }
  return links;
}

/** The newest link wins when two active tenancies share a conversation (the list arrives newest first). */
export function indexByConversation(links: readonly ActiveTenancyLink[]): Record<string, ActiveTenancyLink> {
  const out: Record<string, ActiveTenancyLink> = {};
  for (const link of links) if (!Object.hasOwn(out, link.conversationId)) out[link.conversationId] = link;
  return out;
}

/** What the signed-in user calls the other person: the owner sees "Your tenant", the renter sees "Your landlord". */
export function tenancyRoleTag(link: ActiveTenancyLink | undefined, me: string | null | undefined): TenancyRoleTag | null {
  if (!link || !me) return null;
  if (link.landlordId === me) return 'Your tenant';
  if (link.tenantId === me) return 'Your landlord';
  return null;
}
