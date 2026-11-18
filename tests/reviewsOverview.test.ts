/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildOverview, OVERVIEW_LIMIT, PENDING_NOTE, reviewDay, reviewStatusLabel, stayEndedText} from '../src/shared/models/ReviewsOverview';
import {parseReviewContext, type ReviewContext, type ReviewRow} from '../src/shared/models/RentalReview';
import {createReviewsOverviewService} from '../src/shared/services/reviewsOverviewService';

const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const RENTER = id(1), OWNER = id(2);
const stay = (n: number) => ({id: id(10 + n), title: 'Stay ' + n, ended: '2026-11-0' + n});
const own = (n: number, kind: 'property' | 'user', status: ReviewRow['status'], createdAt = `2026-11-1${n}T05:00:00Z`): ReviewRow => ({id: id(100 + n), kind, rating: 4, text: null, revision: id(200 + n), createdAt, status, propertyId: null, updatedAt: null, moderatedAt: null, history: [], tags: []});
const context = (n: number, over: Partial<ReviewContext> = {}): ReviewContext => ({tenancyId: id(10 + n), propertyId: id(50), tenantId: RENTER, landlordId: OWNER, eligible: true, own: [], received: [], legacyUserReview: false, ...over});

test('an ended stay with no property review yet is "waiting for your review"', () => {
  const o = buildOverview([stay(1)], [context(1)], RENTER);
  assert.deepEqual(o.waiting, [{tenancyId: id(11), title: 'Stay 1', ended: '2026-11-01'}]);
  assert.deepEqual(o.reviews, []);
});

test('a stay that already has a property review is not waiting, and the review is listed with its status', () => {
  const o = buildOverview([stay(1)], [context(1, {own: [own(1, 'property', 'pending')]})], RENTER);
  assert.equal(o.waiting.length, 0);
  assert.deepEqual(o.reviews.map(r => [r.tenancyId, r.title, r.status, r.rating]), [[id(11), 'Stay 1', 'pending', 4]]);
});

test('a stay that is not eligible yet is not offered', () => {
  assert.equal(buildOverview([stay(1)], [context(1, {eligible: false})], RENTER).waiting.length, 0);
});

test('the participant review (kind "user") is left out of both lists', () => {
  const o = buildOverview([stay(1), stay(2)], [context(1, {own: [own(1, 'property', 'approved'), own(2, 'user', 'approved')]}), context(2, {own: [own(3, 'user', 'pending')]})], RENTER);
  assert.deepEqual(o.reviews.map(r => r.id), [id(101)]);
  assert.deepEqual(o.waiting.map(w => w.tenancyId), [id(12)], 'stay 2 still waits for the property review');
});

test('a stay where the user is not the renter, or whose read failed, is skipped, never guessed', () => {
  const o = buildOverview([stay(1), stay(2)], [null, context(2, {tenantId: OWNER, landlordId: RENTER})], RENTER);
  assert.deepEqual([o.waiting.length, o.reviews.length], [0, 0]);
  assert.equal(o.stays, 2);
});

test('reviews are listed newest first', () => {
  const o = buildOverview([stay(1), stay(2)], [context(1, {own: [own(1, 'property', 'approved', '2026-11-10T05:00:00Z')]}), context(2, {own: [own(2, 'property', 'pending', '2026-11-13T05:00:00Z')]})], RENTER);
  assert.deepEqual(o.reviews.map(r => r.id), [id(102), id(101)]);
});

test('status words: Published, Pending approval, Not published; the pending note says where it appears', () => {
  assert.deepEqual((['approved', 'pending', 'rejected', 'hidden'] as const).map(reviewStatusLabel), ['Published', 'Pending approval', 'Not published', 'Not published']);
  assert.equal(PENDING_NOTE, 'It appears on the listing after an admin approves it.');
});

test('stay and review dates read like the design', () => {
  assert.equal(stayEndedText('2027-02-17'), 'Stay ended Feb 17, 2027');
  assert.equal(reviewDay('2026-11-12T20:00:00Z'), 'Nov 13', 'Philippine time');
});

function client(tenancies: any[], contexts: Record<string, unknown>, opts: {user?: string; failContext?: string[]} = {}) {
  const calls: string[] = [];
  const q: any = {select: () => q, eq: () => q, order: () => q, range: () => q, abortSignal: () => Promise.resolve({data: tenancies, error: null, count: tenancies.length})};
  return {calls, client: {
    auth: {getUser: async () => ({data: {user: {id: opts.user ?? RENTER}}, error: null})},
    from: (table: string) => { calls.push('from:' + table); return q; },
    rpc: (name: string, args: any) => { calls.push(name); return {abortSignal: () => Promise.resolve(opts.failContext?.includes(args.p_tenancy_id) ? {data: null, error: {code: 'X'}} : {data: contexts[args.p_tenancy_id], error: null})}; },
  } as any};
}
const row = (n: number) => ({id: id(10 + n), tenant_id: RENTER, landlord_id: OWNER, status: 'ended', actual_end_date: '2026-11-0' + n, ended_at: '2026-11-0' + n + 'T01:00:00Z', listings: {title: 'Stay ' + n}});
const raw = (n: number, over: object = {}) => ({tenancyId: id(10 + n), propertyId: id(50), tenantId: RENTER, landlordId: OWNER, eligible: true, own: [], legacyUserReview: false, ...over});

test('the service reads my ended stays once and each stay’s review context with the existing read; it writes nothing', async () => {
  const h = client([row(1), row(2)], {[id(11)]: raw(1), [id(12)]: raw(2)});
  const o = await createReviewsOverviewService(() => h.client).overview(RENTER, new AbortController().signal);
  assert.deepEqual(h.calls.filter(c => c.startsWith('from:')), ['from:tenancies']);
  assert.deepEqual(h.calls.filter(c => !c.startsWith('from:')), ['get_tenancy_reviews', 'get_tenancy_reviews']);
  assert.equal(o.waiting.length, 2);
  assert.ok(OVERVIEW_LIMIT >= 2);
  assert.ok(parseReviewContext(raw(1), RENTER, id(11)).eligible);
});

test('one failed review read leaves that stay out; every read failing is an error', async () => {
  const some = client([row(1), row(2)], {[id(11)]: raw(1)}, {failContext: [id(12)]});
  assert.deepEqual((await createReviewsOverviewService(() => some.client).overview(RENTER, new AbortController().signal)).waiting.map(w => w.tenancyId), [id(11)]);
  const all = client([row(1)], {}, {failContext: [id(11)]});
  await assert.rejects(createReviewsOverviewService(() => all.client).overview(RENTER, new AbortController().signal), /Reviews could not load/);
});

test('a different signed-in account, or a stay that is not mine, refuses the read', async () => {
  await assert.rejects(createReviewsOverviewService(() => client([], {}, {user: OWNER}).client).overview(RENTER, new AbortController().signal));
  await assert.rejects(createReviewsOverviewService(() => client([{...row(1), tenant_id: OWNER}], {}).client).overview(RENTER, new AbortController().signal));
});
