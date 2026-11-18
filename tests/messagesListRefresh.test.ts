/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conversationFilters, filterConversations, messageDay, showInboxSkeleton} from '../src/features/messaging-viewing/models/ConversationFilter';
import type {Conversation} from '../src/features/messaging-viewing/models/PersistentMessaging';
import {indexByConversation, parseActiveTenancyLinks, tenancyRoleTag} from '../src/shared/models/TenancyLink';
import {createTenancyLinkService} from '../src/shared/services/tenancyLinkService';

const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ME = id(1), OTHER = id(2), THIRD = id(3), PROP = id(10);
const row = (n: number, landlordId: string, tenantId: string): Conversation => ({id: id(100 + n), listingId: id(200 + n), listingTitle: 'T' + n, tenantId, landlordId, participantName: null, status: 'open', activityAt: '2026-11-18T01:00:00Z', latestBody: 'hi', latestType: 'text'});
const rows = [row(1, ME, OTHER), row(2, OTHER, ME), row(3, THIRD, OTHER), row(4, ME, THIRD)];

test('filter pills: All keeps every loaded row, My listings the rows where I am the owner, Others’ the rest', () => {
  assert.deepEqual(conversationFilters.map(f => f.label), ['All', 'My listings', 'Others’']);
  assert.equal(filterConversations(rows, 'all', ME).length, 4);
  assert.deepEqual(filterConversations(rows, 'mine', ME).map(r => r.id), [id(101), id(104)]);
  assert.deepEqual(filterConversations(rows, 'others', ME).map(r => r.id), [id(102), id(103)]);
});

test('filter pills never invent an owner: without a signed-in user nothing is "mine"', () => {
  assert.equal(filterConversations(rows, 'mine', null).length, 0);
  assert.equal(filterConversations(rows, 'others', undefined).length, 4);
});

test('placeholder rows show only on the first open: never over cached rows, never with an error', () => {
  assert.equal(showInboxSkeleton(true, 0, false), true);
  assert.equal(showInboxSkeleton(true, 3, false), false);
  assert.equal(showInboxSkeleton(false, 0, false), false);
  assert.equal(showInboxSkeleton(true, 0, true), false);
});

test('the card shows the day only', () => assert.equal(messageDay('2026-11-18T12:00:00Z'), 'Nov 18'));

const link = (conversation: string | null, tenant = OTHER, landlord = ME, tenancy = id(50)) => ({id: tenancy, conversation_id: conversation, tenant_id: tenant, landlord_id: landlord, property_id: PROP});

test('relationship tag: the owner sees "Your tenant", the renter sees "Your landlord", a stranger or no link sees nothing', () => {
  const [l] = parseActiveTenancyLinks([link(id(101))], ME);
  assert.equal(tenancyRoleTag(l, ME), 'Your tenant');
  assert.equal(tenancyRoleTag(l, OTHER), 'Your landlord');
  assert.equal(tenancyRoleTag(l, THIRD), null);
  assert.equal(tenancyRoleTag(undefined, ME), null);
  assert.equal(tenancyRoleTag(l, null), null);
});

test('tenancies without a conversation link are skipped; a row the user is not part of is refused', () => {
  assert.equal(parseActiveTenancyLinks([link(null)], ME).length, 0);
  assert.throws(() => parseActiveTenancyLinks([link(id(101), THIRD, OTHER)], ME));
  assert.throws(() => parseActiveTenancyLinks([link('not-a-uuid')], ME));
  assert.throws(() => parseActiveTenancyLinks({}, ME));
});

test('two active tenancies on one conversation: the newest (first) one wins', () => {
  const links = parseActiveTenancyLinks([link(id(101), OTHER, ME, id(51)), link(id(101), OTHER, ME, id(52))], ME);
  assert.equal(indexByConversation(links)[id(101)]!.tenancyId, id(51));
});

function client(data: unknown, user = ME) {
  const calls: unknown[][] = [];
  const q: any = {select: (...a: unknown[]) => (calls.push(['select', ...a]), q), or: (...a: unknown[]) => (calls.push(['or', ...a]), q), eq: (...a: unknown[]) => (calls.push(['eq', ...a]), q), order: () => q, limit: () => q, abortSignal: () => Promise.resolve({data, error: null})};
  return {calls, client: {auth: {getUser: async () => ({data: {user: {id: user}}, error: null})}, from: (t: string) => (calls.push(['from', t]), q)} as any};
}

test('one read: active tenancies of this user only, with the conversation link', async () => {
  const h = client([link(id(101))]);
  const result = await createTenancyLinkService(() => h.client).activeLinks(ME, new AbortController().signal);
  assert.equal(result[0]!.conversationId, id(101));
  assert.deepEqual(h.calls.filter(c => c[0] === 'from'), [['from', 'tenancies']]);
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'status' && c[2] === 'active'));
  assert.ok(h.calls.some(c => c[0] === 'or' && String(c[1]).includes(ME)));
});

test('a different signed-in account refuses the read', async () => {
  await assert.rejects(createTenancyLinkService(() => client([], OTHER).client).activeLinks(ME, new AbortController().signal));
});
