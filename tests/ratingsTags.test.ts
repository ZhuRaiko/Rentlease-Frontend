/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import {
  createRentalReviewService, createReviewJournal,
} from '../src/shared/services/rentalReviewService';
import { createRentalReviewWorkflow } from '../src/shared/viewModels/rentalReviewWorkflow';
import {
  parsePublishedReviews, parseReviewContext, parseReviewSummary, reviewScopeKey, reviewTargets, validateReviewOperation, ReviewError, type ReviewOperation, type ReviewSummary,
} from '../src/shared/models/RentalReview';
import {
  MAX_REVIEW_TAGS, PROPERTY_TAGS, TENANT_TAGS, knownTags, tagDisabled, tagLabel, tagLabels, tagsValidForSubmit, toggleTag,
} from '../src/shared/models/ReviewTags';
import {
  landlordRatingLine, publishedRowView, receivedLine, sentView, starWord, summaryView, WORD_CLOUD_UNAVAILABLE,
} from '../src/shared/models/ReviewPresentation';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TENANT = U(1), LANDLORD = U(2), TEN = U(4), PROP = U(5);
const row = (over: object = {}) => ({ id: U(50), kind: 'property', rating: 4, text: 'Nice', revision: U(60), createdAt: '2026-11-10T00:00:00Z', status: 'pending', propertyId: PROP, updatedAt: null, moderatedAt: null, ...over });
const context = (over: object = {}) => ({ tenancyId: TEN, propertyId: PROP, tenantId: TENANT, landlordId: LANDLORD, eligible: true, own: [], legacyUserReview: false, ...over });
const received = (over: object = {}) => ({ id: U(70), kind: 'user', rating: 5, text: 'Great tenant', tags: ['respectful'], createdAt: '2026-11-11T00:00:00Z', reviewerRole: 'landlord', ...over });
const summary = (over: object = {}) => ({ kind: 'property', targetId: PROP, count: 18, average: 4.6, distribution: [0, 1, 1, 4, 12], tags: [{ tag: 'clean', count: 12 }, { tag: 'good_wifi', count: 9 }], ...over });

// ---------------------------------------------------------------- tag lists
test('the tag lists are exactly the wireframe lists, with the wireframe wording', () => {
  assert.deepEqual(PROPERTY_TAGS.map(t => [t.code, t.label]), [['clean', 'Clean'], ['good_wifi', 'Good wifi'], ['quiet', 'Quiet'], ['safe_area', 'Safe area'], ['fair_price', 'Fair price'], ['well_maintained', 'Well maintained'], ['matches_listing', 'Matches the listing'], ['good_location', 'Good location']]);
  assert.deepEqual(TENANT_TAGS.map(t => [t.code, t.label]), [['communicated_well', 'Communicated well'], ['respectful', 'Respectful'], ['paid_on_time', 'Paid on time'], ['kept_clean', 'Kept the place clean'], ['followed_rules', 'Followed house rules'], ['reported_issues_early', 'Reported issues early']]);
  assert.equal(MAX_REVIEW_TAGS, 5);
});
test('tags: pick up to five, a sixth is not added, unselecting frees a slot, unknown and wrong-group tags are never added', () => {
  let sel: string[] = [];
  for (const code of ['clean', 'good_wifi', 'quiet', 'safe_area', 'fair_price']) sel = toggleTag('property', sel, code);
  assert.equal(sel.length, 5);
  assert.deepEqual(toggleTag('property', sel, 'well_maintained'), sel, 'a sixth tag is ignored');
  assert.deepEqual(toggleTag('property', sel, 'clean'), ['good_wifi', 'quiet', 'safe_area', 'fair_price'], 'tapping a selected tag unselects it');
  assert.deepEqual(toggleTag('property', [], 'made_up'), []);
  assert.deepEqual(toggleTag('property', [], 'respectful'), [], 'a tenant tag is not a property tag');
  assert.deepEqual(toggleTag('user', [], 'respectful'), ['respectful']);
});
test('tags: at five selected the rest are disabled, the selected ones stay enabled', () => {
  const five = ['clean', 'good_wifi', 'quiet', 'safe_area', 'fair_price'];
  assert.equal(tagDisabled(five, 'good_location'), true);
  assert.equal(tagDisabled(five, 'clean'), false);
  assert.equal(tagDisabled(five.slice(0, 4), 'good_location'), false);
});
test('server tags: unknown codes are ignored and never shown raw; labels come from the fixed list', () => {
  assert.deepEqual(knownTags('property', ['clean', 'DROP TABLE', 'clean', 'quiet', 'respectful']), ['clean', 'quiet']);
  assert.deepEqual(tagLabels('property', ['good_wifi', '<script>', 'matches_listing']), ['Good wifi', 'Matches the listing']);
  assert.equal(tagLabel('user', 'clean'), null);
  assert.equal(tagsValidForSubmit('property', ['clean', 'clean']), false);
  assert.equal(tagsValidForSubmit('property', ['clean', 'respectful']), false);
  assert.equal(tagsValidForSubmit('property', ['clean', 'good_wifi', 'quiet', 'safe_area', 'fair_price', 'well_maintained']), false);
  assert.equal(tagsValidForSubmit('user', []), true);
});

// ---------------------------------------------------------------- parsing
test('own rows and published rows carry known tags; a missing tags field means none; a malformed one is an error', () => {
  const c = parseReviewContext(context({ own: [row({ tags: ['clean', 'mystery'] })] }), TENANT, TEN);
  assert.deepEqual(c.own[0]!.tags, ['clean']);
  assert.deepEqual(parseReviewContext(context({ own: [row()] }), TENANT, TEN).own[0]!.tags, [], 'an older response without tags');
  assert.throws(() => parseReviewContext(context({ own: [row({ tags: 'clean' })] }), TENANT, TEN), ReviewError);
  assert.throws(() => parseReviewContext(context({ own: [row({ tags: [1] })] }), TENANT, TEN), ReviewError);
  const page = parsePublishedReviews({ kind: 'property', targetId: PROP, count: 1, average: 4, rows: [row({ status: 'approved', tags: ['quiet', 'nope'] })] }, 'property', PROP);
  assert.deepEqual(page.rows[0]!.tags, ['quiet']);
});
test('received: the counterpart\'s approved reviews are parsed strictly; absent means none', () => {
  assert.deepEqual(parseReviewContext(context(), TENANT, TEN).received, []);
  const c = parseReviewContext(context({ received: [received({ tags: ['respectful', 'zzz'] })] }), TENANT, TEN);
  assert.deepEqual(c.received.map(r => [r.kind, r.rating, r.text, r.tags, r.reviewerRole]), [['user', 5, 'Great tenant', ['respectful'], 'landlord']]);
  assert.equal('reviewerId' in c.received[0]!, false);
  for (const bad of [{ rating: 6 }, { rating: 0 }, { kind: 'landlord' }, { id: 'nope' }, { createdAt: 'x' }, { text: 5 }]) assert.throws(() => parseReviewContext(context({ received: [received(bad)] }), TENANT, TEN), ReviewError, JSON.stringify(bad));
  assert.throws(() => parseReviewContext(context({ received: 'x' }), TENANT, TEN), ReviewError);
  assert.throws(() => parseReviewContext(context({ received: [null] }), TENANT, TEN), ReviewError);
});
test('summary parsing: strict, known tags only, and count zero means no average', () => {
  const s = parseReviewSummary(summary({ tags: [{ tag: 'clean', count: 12 }, { tag: 'mystery', count: 3 }, { tag: 'clean', count: 1 }] }), 'property', PROP);
  assert.deepEqual([s.count, s.average, s.distribution, s.tags], [18, 4.6, [0, 1, 1, 4, 12], [{ tag: 'clean', count: 12 }]]);
  const empty = parseReviewSummary(summary({ count: 0, average: null, distribution: [0, 0, 0, 0, 0], tags: [] }), 'property', PROP);
  assert.deepEqual([empty.count, empty.average, empty.tags], [0, null, []]);
  const tenant = parseReviewSummary(summary({ kind: 'tenant', tags: [{ tag: 'respectful', count: 2 }, { tag: 'clean', count: 5 }] }), 'tenant', PROP);
  assert.deepEqual(tenant.tags, [{ tag: 'respectful', count: 2 }], 'a tenant summary carries tenant tags');
  for (const bad of [{ count: 0 }, { count: 5, average: null }, { average: 6 }, { average: 0.5 }, { count: -1 }, { count: 1.5 }, { kind: 'tenant' }, { targetId: U(99) }, { distribution: [1, 2] }, { distribution: [1, 2, 3, 4, -5] }, { tags: [{ tag: 'clean', count: 0 }] }, { tags: 'clean' }, { tags: Array.from({ length: 9 }, () => ({ tag: 'clean', count: 1 })) }, { average: '4.6' }])
    assert.throws(() => parseReviewSummary(summary(bad), 'property', PROP), ReviewError, JSON.stringify(bad));
  assert.throws(() => parseReviewSummary(null, 'property', PROP), ReviewError);
  assert.throws(() => parseReviewSummary([], 'property', PROP), ReviewError);
});
test('scope keys: a summary of a kind and target has its own journal key', () => {
  assert.equal(reviewScopeKey({ mode: 'summary', kind: 'landlord', id: LANDLORD }), `summary:landlord:${LANDLORD}`);
  assert.notEqual(reviewScopeKey({ mode: 'summary', kind: 'property', id: PROP }), reviewScopeKey({ mode: 'property', id: PROP }));
});
test('the tenant can only rate the property and the landlord only the tenant', () => {
  const c = parseReviewContext(context(), TENANT, TEN);
  assert.deepEqual(reviewTargets(c, TENANT), ['property']);
  assert.deepEqual(reviewTargets(c, LANDLORD), ['user']);
});

// ---------------------------------------------------------------- operations, service and workflow
const op = (over: object = {}): ReviewOperation => ({ operationId: U(90), action: 'submit', tenancyId: TEN, kind: 'property', rating: 4, text: 'Nice', tags: ['clean', 'quiet'], ...over } as ReviewOperation);
test('an operation needs stars, valid tags for its kind, and at most five', () => {
  validateReviewOperation(op());
  validateReviewOperation(op({ tags: [] }));
  for (const bad of [{ rating: 0 }, { rating: 6 }, { tags: ['respectful'] }, { tags: ['clean', 'clean'] }, { tags: ['clean', 'good_wifi', 'quiet', 'safe_area', 'fair_price', 'well_maintained'] }, { tags: undefined }, { kind: 'user', tags: ['clean'] }])
    assert.throws(() => validateReviewOperation(op(bad)), ReviewError, JSON.stringify(bad));
  validateReviewOperation(op({ kind: 'user', tags: ['respectful'] }));
});
const client = (calls: any[], result: any = { data: null, error: null }) => ({ auth: { getUser: async () => ({ data: { user: { id: TENANT } }, error: null }) }, rpc: (name: string, args: any) => { calls.push({ name, args }); return { abortSignal: async () => result }; } } as any);
test('submit sends the 6-argument payload: tenancy, operation id, kind, stars, text and tags', async () => {
  const calls: any[] = [];
  const service = createRentalReviewService(() => client(calls, { data: context({ own: [row()] }), error: null }));
  await service.write(TENANT, op(), new AbortController().signal);
  assert.deepEqual(calls, [{ name: 'submit_tenancy_review', args: { p_tenancy_id: TEN, p_operation_id: U(90), p_kind: 'property', p_rating: 4, p_text: 'Nice', p_tags: ['clean', 'quiet'] } }]);
});
test('the summary read calls get_review_summary with the kind and target, and parses the answer', async () => {
  const calls: any[] = [];
  const service = createRentalReviewService(() => client(calls, { data: summary(), error: null }));
  const r = await service.read(TENANT, { mode: 'summary', kind: 'property', id: PROP }, 0, new AbortController().signal);
  assert.deepEqual(calls, [{ name: 'get_review_summary', args: { p_kind: 'property', p_target_id: PROP } }]);
  assert.ok(r.type === 'summary' && r.value.count === 18);
  await assert.rejects(createRentalReviewService(() => client([], { data: summary({ average: 9 }), error: null })).read(TENANT, { mode: 'summary', kind: 'property', id: PROP }, 0, new AbortController().signal), ReviewError);
  await assert.rejects(createRentalReviewService(() => client([], { data: null, error: { code: '42501', message: 'Access unavailable' } })).read(TENANT, { mode: 'summary', kind: 'landlord', id: LANDLORD }, 0, new AbortController().signal), /could not load/);
});
test('an unknown outcome keeps the same operation id, text and tags for Retry, also after reopening; an old saved operation without tags still reads', async () => {
  const rows = new Map<string, string>();
  const storage = { getItem: async (k: string) => rows.get(k) ?? null, setItem: async (k: string, v: string) => { rows.set(k, v); }, removeItem: async (k: string) => { rows.delete(k); } };
  const journal = createReviewJournal(storage), scope = { mode: 'tenancy', id: TEN } as const;
  const sent: ReviewOperation[] = [];
  let fail = true;
  const service = { read: async () => ({ type: 'context' as const, value: parseReviewContext(context(), TENANT, TEN) }), write: async (_a: string, o: ReviewOperation) => { sent.push(o); if (fail) throw new ReviewError('Unknown', true); } };
  const first = createRentalReviewWorkflow(service, journal, TENANT, scope, () => U(91));
  await first.load();
  await first.submit({ action: 'submit', tenancyId: TEN, kind: 'property', rating: 5, text: 'Great', tags: ['clean', 'good_wifi'] });
  first.dispose();
  const second = createRentalReviewWorkflow(service, journal, TENANT, scope, () => { throw new Error('no new id on retry'); });
  await second.load();
  fail = false;
  await second.retry();
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], sent[1]);
  assert.deepEqual([sent[1]!.operationId, (sent[1] as any).tags], [U(91), ['clean', 'good_wifi']]);
  second.dispose();
  rows.set(`rentlease.reviews.v1:${TENANT}:tenancy:${TEN}`, JSON.stringify({ operationId: U(92), action: 'submit', tenancyId: TEN, kind: 'property', rating: 3, text: null }));
  assert.deepEqual((await journal.read(TENANT, scope) as any).tags, []);
});

// ---------------------------------------------------------------- presentation
test('stars use the five words, and tell the person to tap before one is chosen', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(starWord), ['Bad', 'Poor', 'OK', 'Good', 'Excellent']);
  assert.equal(starWord(null), 'Tap a star to rate');
});
test('Review sent: pending, approved and rejected come from the stored status; rejected is a plain "Not published"', () => {
  const p = sentView('pending', 'landlord', 'Samuel', 'Today');
  assert.deepEqual([p.heading, p.chip.label, p.steps.map(s => [s.label, s.detail, s.state])], ["Thanks, Samuel's review is in", 'Pending review', [['Sent', 'Today', 'done'], ['Admin check', 'Pending', 'current'], ["Published on Samuel's profile", 'After approval', 'upcoming']]]);
  assert.equal(p.body, 'An admin checks it first, usually within a day. It appears once approved.');
  const a = sentView('approved', 'tenant', 'Samuel', 'Nov 12');
  assert.deepEqual([a.chip.label, a.steps.every(s => s.state === 'done')], ['Published', true]);
  for (const status of ['rejected', 'hidden'] as const) {
    const r = sentView(status, 'tenant', 'Samuel', 'Nov 12');
    assert.equal(r.chip.label, 'Not published');
    assert.doesNotMatch(JSON.stringify(r), /reason|spam|policy|notify|resubmit/i);
  }
  assert.doesNotMatch(JSON.stringify([p, a]), /notify/i);
});
test('summary view: average, count "from past tenants" and tag counts; with no reviews: "No reviews yet", no average, no stars', () => {
  const v = summaryView(parseReviewSummary(summary(), 'property', PROP));
  assert.deepEqual([v.empty, v.average, v.starsFilled, v.countLine, v.tags], [false, '4.6', 5, '18 reviews from past tenants', [{ code: 'clean', label: 'Clean', count: 12 }, { code: 'good_wifi', label: 'Good wifi', count: 9 }]]);
  assert.equal(summaryView(parseReviewSummary(summary({ count: 1, average: 3, distribution: [0, 0, 1, 0, 0], tags: [] }), 'property', PROP)).countLine, '1 review from past tenants');
  const e = summaryView(parseReviewSummary(summary({ count: 0, average: null, distribution: [0, 0, 0, 0, 0], tags: [] }), 'property', PROP));
  assert.deepEqual([e.empty, e.average, e.starsFilled, e.countLine, e.tags], [true, null, 0, 'No reviews yet', []]);
});
test('owner rating: "★ 4.8 landlord" only for a landlord summary with reviews, otherwise hidden', () => {
  const l = (over: object) => parseReviewSummary(summary({ kind: 'landlord', targetId: LANDLORD, ...over }), 'landlord', LANDLORD);
  assert.equal(landlordRatingLine(l({ average: 4.78 })), '★ 4.8 landlord');
  assert.equal(landlordRatingLine(l({ count: 0, average: null, distribution: [0, 0, 0, 0, 0], tags: [] })), null);
  assert.equal(landlordRatingLine(null), null);
  assert.equal(landlordRatingLine(undefined), null);
  assert.equal(landlordRatingLine(parseReviewSummary(summary(), 'property', PROP)), null, 'a property summary is never shown as a landlord rating');
});
test('published and received rows: role, month, text and tag labels; names come from the tenancy people, never from the review', () => {
  const p = parsePublishedReviews({ kind: 'property', targetId: PROP, count: 1, average: 4, rows: [row({ status: 'approved', reviewerRole: 'tenant', tags: ['clean', 'x'] })] }, 'property', PROP);
  assert.deepEqual(publishedRowView(p.rows[0]!), { key: U(50), stars: 4, role: 'Tenant', month: 'Nov 2026', text: 'Nice', tags: ['Clean'] });
  const c = parseReviewContext(context({ received: [received(), received({ id: U(71), kind: 'property', tags: ['quiet'] })] }), TENANT, TEN);
  assert.deepEqual(c.received.map(r => receivedLine(r, 'Samuel')).map(l => [l.label, l.status, l.tags]), [["Samuel's review of you", null, ['Respectful']], ["Samuel's review of this property", null, ['Quiet']]]);
});

// ---------------------------------------------------------------- rendering
function harness(vmFor: (scope: any) => any, preset: any[] = []) {
  let cursor = 0;
  const native: any = { StyleSheet: { create: (s: any) => s, flatten: (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) }, Platform: { OS: 'android' } };
  for (const n of ['ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'View']) native[n] = n;
  native.Alert = { alert() {} };
  const cache = new Map<string, any>();
  const load = (abs: string): any => {
    if (cache.has(abs)) return cache.get(abs);
    const actual = createRequire(abs), mod = { exports: {} as any }; cache.set(abs, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState: (v: any) => { const i = cursor++; return [i < preset.length ? preset[i] : v, () => {}]; }, useEffect: () => {} };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      if (name.endsWith('/useRentalReviews')) return { useRentalReviews: (_a: any, scope: any) => vmFor(scope) };
      if (name.endsWith('/useReviewWordCloud')) return { useReviewWordCloud: () => vmFor({ mode: 'cloud' }) };
      if (name.endsWith('/AppButton')) return { AppButton: 'Button' };
      if (name.startsWith('.') && existsSync(resolve(dirname(abs), name) + '.tsx')) return load(resolve(dirname(abs), name) + '.tsx');
      return actual(name);
    };
    new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, mod, mod.exports);
    cache.set(abs, mod.exports); return mod.exports;
  };
  const expand = (n: any): any => Array.isArray(n) ? n.map(expand) : !n || typeof n !== 'object' ? n : typeof n.type === 'function' ? expand(n.type(n.props)) : { ...n, props: { ...n.props, children: expand(n.props?.children) } };
  return { render: (file: string, name: string, props: any) => { cursor = 0; return expand(load(resolve(file))[name](props)); } };
}
const flat = (n: any): any[] => Array.isArray(n) ? n.flatMap(flat) : n && typeof n === 'object' ? [n, ...flat(n.props?.children)] : typeof n === 'string' ? [n] : [];
const nodes = (t: any) => flat(t).filter(n => typeof n === 'object');
const text = (t: any) => flat(t).filter(n => typeof n === 'string').join('|');
const styleOf = (n: any) => Object.assign({}, ...[n.props?.style].flat(Infinity).filter(Boolean));
const idle = { busy: false, saving: false, ready: true, pending: null, error: null, notice: null, offset: 0, workflow: {} };
const section = (summaryValue: ReviewSummary | null, rows: any[], over: { summary?: object; rows?: object; cloud?: object } = {}, preset: any[] = []) => harness(scope => scope.mode === 'summary'
  ? { ...idle, data: summaryValue ? { type: 'summary', value: summaryValue } : null, ...over.summary }
  : scope.mode === 'cloud' ? { status: 'success', error: null, cloud: null, corpus: null, selected: null, workflow: {}, ...over.cloud }
  : { ...idle, data: { type: 'public', value: { kind: 'property', targetId: PROP, count: summaryValue?.count ?? 0, average: summaryValue?.average ?? null, rows } }, ...over.rows }, preset)
  .render('src/shared/components/RentalFeedbackSection.tsx', 'RentalFeedbackSection', { accountId: TENANT, propertyId: PROP });
const approvedRow = (n: number, over: object = {}) => parsePublishedReviews({ kind: 'property', targetId: PROP, count: 1, average: 4, rows: [row({ id: U(100 + n), status: 'approved', reviewerRole: 'tenant', ...over })] }, 'property', PROP).rows[0]!;

test('listing ratings: the summary, top tags with counts and the published reviews with role, month and tags', () => {
  const tree = section(parseReviewSummary(summary(), 'property', PROP), [approvedRow(1, { text: 'Nice property, the wifi was good.', tags: ['clean', 'good_wifi'] })]), t = text(tree);
  for (const s of ['Ratings and reviews', 'Reviews', 'Themes', '4.6', '18 reviews from past tenants', 'Clean', 'Good wifi', '12', '9', 'Tenant · Nov 2026', 'Nice property, the wifi was good.']) assert.ok(t.includes(s), s);
  assert.deepEqual(nodes(tree).filter(n => n.props?.accessibilityRole === 'tab').map(n => text(n)), ['Reviews', 'Themes'], 'two tabs, no Landlord tab');
  assert.doesNotMatch(t, /Landlord(?! fixes)|Property\b.*tab/);
});
test('listing ratings: with no reviews the section says "No reviews yet", draws no stars and hides the average', () => {
  const tree = section(parseReviewSummary(summary({ count: 0, average: null, distribution: [0, 0, 0, 0, 0], tags: [] }), 'property', PROP), []), t = text(tree);
  assert.ok(t.includes('No reviews yet'));
  assert.ok(!t.includes('★') && !/\b[1-5]\.\d\b/.test(t) && !t.includes('from past tenants'));
});
test('listing ratings: only the first three reviews show, then "See all N reviews"', () => {
  const rows = [1, 2, 3, 4, 5].map(n => approvedRow(n, { text: `Review ${n}` }));
  const tree = section(parseReviewSummary(summary(), 'property', PROP), rows), t = text(tree);
  assert.ok(t.includes('Review 1') && t.includes('Review 3') && !t.includes('Review 4'));
  assert.ok(nodes(tree).some(n => n.type === 'Button' && n.props.label === 'See all 18 reviews'));
  const expanded = text(section(parseReviewSummary(summary(), 'property', PROP), rows, {}, [ 'Reviews', true ]));
  assert.ok(expanded.includes('Review 5'));
});
test('listing ratings, Themes: tag counts show first and without the word-cloud service; the cloud is a quiet secondary view', () => {
  const tree = section(parseReviewSummary(summary(), 'property', PROP), [], { cloud: { status: 'unavailable', error: null } }, ['Themes']), t = text(tree);
  assert.ok(t.includes('What tenants mention') && t.includes('Clean') && t.includes('12') && t.includes('Good wifi'));
  assert.ok(t.indexOf('Clean') < t.indexOf(WORD_CLOUD_UNAVAILABLE), 'tag counts come before the word cloud');
  assert.ok(t.includes('Not available right now'));
  assert.doesNotMatch(t, /not connected yet|Frequently mentioned|failed|error/i);
  const failed = text(section(parseReviewSummary(summary(), 'property', PROP), [], { cloud: { status: 'error', error: 'Review themes could not load.' } }, ['Themes']));
  assert.ok(failed.includes('Not available right now') && failed.includes('Clean') && !failed.includes('could not load'), 'a service failure becomes the quiet line, never a raw error');
});
test('listing ratings: a failed summary read keeps the reviews and offers Retry; a failed list read offers Retry', () => {
  const t1 = section(null, [approvedRow(1, { text: 'Still here' })], { summary: { error: 'Reviews could not load. Retry.', ready: true } });
  assert.ok(text(t1).includes('Ratings are not available right now.') && text(t1).includes('Still here'));
  assert.ok(nodes(t1).some(n => n.type === 'Button' && n.props.label === 'Retry'));
});
test('large text: stars, tags and tabs are at least 48dp, wrap instead of clipping, and nothing has a fixed height', () => {
  const panelTree = harness(() => ({ ...idle, data: { type: 'context', value: parseReviewContext(context(), TENANT, TEN) } })).render('src/shared/components/TenancyReviewPanel.tsx', 'TenancyReviewPanel', { accountId: TENANT, tenancyId: TEN, otherName: 'Samuel' });
  for (const n of nodes(panelTree).filter(n => n.type === 'Pressable')) assert.ok((styleOf(n).minHeight ?? 0) >= 48, `${n.props.accessibilityLabel} is at least 48dp tall`);
  const tagWrap = nodes(panelTree).find(n => n.type === 'View' && styleOf(n).flexWrap === 'wrap');
  assert.ok(tagWrap, 'tags wrap onto the next line');
  for (const n of nodes(panelTree).filter(n => n.type === 'Text')) { const s = styleOf(n); assert.ok(s.height === undefined, 'no fixed text height'); assert.ok(n.props.numberOfLines === undefined, 'no truncation'); }
  const tabTree = section(parseReviewSummary(summary(), 'property', PROP), []);
  for (const n of nodes(tabTree).filter(n => n.props?.accessibilityRole === 'tab')) assert.ok((styleOf(n).minHeight ?? 0) >= 48);
});
test('the tenant never gets the tenant form and the landlord never gets the property form', () => {
  const render = (actor: string) => harness(() => ({ ...idle, data: { type: 'context', value: parseReviewContext(context(), actor, TEN) } })).render('src/shared/components/TenancyReviewPanel.tsx', 'TenancyReviewPanel', { accountId: actor, tenancyId: TEN, otherName: 'Samuel' });
  const t = text(render(TENANT)), l = text(render(LANDLORD));
  assert.ok(t.includes('Good wifi') && !t.includes('Communicated well') && !t.includes('as a tenant'));
  assert.ok(l.includes('Communicated well') && !l.includes('Good wifi') && !l.includes('How was your stay'));
});
test('Back to tenancy is offered only when the screen is given a way back, and the unused old review UI is gone', () => {
  const panel = readFileSync('src/shared/components/TenancyReviewPanel.tsx', 'utf8');
  assert.doesNotMatch(panel, /Choose the review target|Refresh reviews|Alert\.alert\('Send/);
  assert.doesNotMatch(readFileSync('src/shared/components/RentalReviews.tsx', 'utf8'), /TenancyReviewPanel/);
});
