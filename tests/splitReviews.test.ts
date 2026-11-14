/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import {
  landlordExperienceView, LANDLORD_EXPERIENCE_TITLE, REVIEW_NOT_ELIGIBLE_FALLBACK, REVIEW_SUBMITTED_NOTICE, reviewNotEligibleText, reviewScreenFor, reviewStatusLabel, reviewSubmitErrorText,
  type PublishedReviews, type ReviewContext, type ReviewRow,
} from '../src/shared/models/RentalReview';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TENANT = U(1), LANDLORD = U(2), STRANGER = U(3), TEN = U(4);
const row = (kind: 'property' | 'user', over: Partial<ReviewRow> = {}): ReviewRow => ({ id: U(50 + (kind === 'user' ? 1 : 0)), kind, rating: 4, text: 'Nice place', revision: U(60), createdAt: '2026-11-10T00:00:00Z', status: 'pending', propertyId: kind === 'property' ? U(5) : null, updatedAt: null, moderatedAt: null, history: [], ...over });
const ctx = (over: Partial<ReviewContext> = {}): ReviewContext => ({ tenancyId: TEN, propertyId: U(5), tenantId: TENANT, landlordId: LANDLORD, eligible: true, own: [], legacyUserReview: false, ...over });

// ---- Who sees which screen
test('the tenant sees "Review the property" and can only submit a property review', () => {
  const s = reviewScreenFor(ctx(), TENANT)!;
  assert.deepEqual([s.role, s.kind, s.title, s.state, s.own], ['tenant', 'property', 'Review the property', 'form', null]);
});
test('the landlord sees "Rate your tenant" and submits a user review', () => {
  const s = reviewScreenFor(ctx(), LANDLORD)!;
  assert.deepEqual([s.role, s.kind, s.title, s.state, s.own], ['landlord', 'user', 'Rate your tenant', 'form', null]);
});
test('the tenant is never offered a rating of the landlord, in any state', () => {
  for (const own of [[], [row('property')], [row('user')], [row('property'), row('user')]])
    for (const eligible of [true, false]) for (const legacyUserReview of [true, false])
      assert.equal(reviewScreenFor(ctx({ own, eligible, legacyUserReview }), TENANT)!.kind, 'property');
});
test('a stranger gets no screen', () => {
  assert.equal(reviewScreenFor(ctx(), STRANGER), null);
});
test('landlord helper copy says where it appears, never "only" and never who else can see it', () => {
  const helper = reviewScreenFor(ctx(), LANDLORD)!.helper;
  assert.equal(helper, "Appears on this tenant's profile.");
  assert.doesNotMatch(helper, /only|tenant and|counterpart|other/i);
  assert.match(reviewScreenFor(ctx(), TENANT)!.helper, /property/i);
});

// ---- Read-only and not-yet-eligible states
test('already reviewed: read-only state with the person\'s own review, for each role', () => {
  const t = reviewScreenFor(ctx({ own: [row('property', { rating: 5, text: 'Great' })] }), TENANT)!;
  assert.equal(t.state, 'reviewed'); assert.equal(t.own!.rating, 5); assert.equal(t.own!.text, 'Great');
  const l = reviewScreenFor(ctx({ own: [row('user')] }), LANDLORD)!;
  assert.equal(l.state, 'reviewed'); assert.equal(l.own!.kind, 'user');
});
test('a landlord who already rated is not asked again, and an earlier tenant rating of the landlord shows read-only without blocking the property review', () => {
  assert.equal(reviewScreenFor(ctx({ own: [row('user')] }), LANDLORD)!.state, 'reviewed');
  const t = reviewScreenFor(ctx({ own: [row('user')] }), TENANT)!;
  assert.equal(t.state, 'form'); assert.deepEqual(t.earlier.map(r => r.kind), ['user']); assert.equal(t.own, null);
  assert.equal(reviewScreenFor(ctx({ own: [row('property')] }), LANDLORD)!.state, 'form', "another person's kind never counts as the landlord's own review");
  assert.deepEqual(reviewScreenFor(ctx({ own: [row('property')] }), TENANT)!.earlier, [], 'the main review is never listed twice');
  assert.deepEqual(reviewScreenFor(ctx({ own: [row('user')] }), LANDLORD)!.earlier, []);
});
test('not yet eligible: no form for either role, even with nothing submitted', () => {
  for (const actor of [TENANT, LANDLORD]) assert.equal(reviewScreenFor(ctx({ eligible: false }), actor)!.state, 'not_eligible');
  assert.equal(reviewScreenFor(ctx({ eligible: false, own: [row('property')] }), TENANT)!.state, 'reviewed', 'a review already sent still shows');
});
test('a legacy participant review blocks only the landlord form', () => {
  assert.equal(reviewScreenFor(ctx({ legacyUserReview: true }), LANDLORD)!.state, 'legacy');
  assert.equal(reviewScreenFor(ctx({ legacyUserReview: true }), TENANT)!.state, 'form');
});
test('"You can review after <date>" uses the tenancy end date in Manila time, else a plain fallback', () => {
  const now = Date.parse('2026-11-14T10:00:00Z');
  assert.equal(reviewNotEligibleText('2026-12-01', now), 'You can review after Dec 1, 2026.');
  assert.equal(reviewNotEligibleText('2026-11-14', now), 'You can review after Nov 14, 2026.', 'ends today: still after today');
  assert.equal(reviewNotEligibleText('2026-11-13', now), REVIEW_NOT_ELIGIBLE_FALLBACK, 'already past: no date to wait for');
  for (const bad of [null, undefined, '', 'soon', '2026-12-1']) assert.equal(reviewNotEligibleText(bad, now), REVIEW_NOT_ELIGIBLE_FALLBACK);
  const late = Date.parse('2026-11-14T17:00:00Z'); // already Nov 15 in Manila
  assert.equal(reviewNotEligibleText('2026-11-14', late), REVIEW_NOT_ELIGIBLE_FALLBACK);
  assert.equal(reviewNotEligibleText('2026-11-15', late), 'You can review after Nov 15, 2026.');
  assert.equal(REVIEW_NOT_ELIGIBLE_FALLBACK, 'You can review once the tenancy has ended.');
});

// ---- Pending wording and errors
test('after submit the person is told the review will appear once it has been checked', () => {
  assert.equal(REVIEW_SUBMITTED_NOTICE, 'Thanks. Your review will appear once it has been checked.');
  assert.match(readFileSync('src/shared/viewModels/rentalReviewWorkflow.ts', 'utf8'), /input\.action==='submit'\?REVIEW_SUBMITTED_NOTICE:/);
  assert.doesNotMatch(readFileSync('src/shared/viewModels/rentalReviewWorkflow.ts', 'utf8'), /Review submitted for moderation/);
});
test('review status wording: pending waits, approved is published, the rest are not published', () => {
  assert.deepEqual((['pending', 'approved', 'rejected', 'hidden'] as const).map(reviewStatusLabel), ['Waiting to be checked', 'Published', 'Not published', 'Not published']);
});
test('submit errors: two refusals are plain; anything else keeps the generic message', () => {
  assert.equal(reviewSubmitErrorText({ message: 'Completed tenancy required' }), 'You can review once the tenancy has ended.');
  assert.equal(reviewSubmitErrorText({ message: 'ACTUAL TENANT REQUIRED' }), 'Only the tenant can review the property.');
  assert.equal(reviewSubmitErrorText({ message: 'Review already exists' }), 'Review already exists, changed, or this action is unavailable. Refresh.');
  assert.equal(reviewSubmitErrorText({}), 'Review already exists, changed, or this action is unavailable. Refresh.');
  assert.equal(reviewSubmitErrorText({ message: null }), 'Review already exists, changed, or this action is unavailable. Refresh.');
});

// ---- Profile section
const published = (over: Partial<PublishedReviews> = {}): PublishedReviews => ({ kind: 'user', targetId: TENANT, count: 3, average: 4.333, rows: [row('user', { id: U(70), createdAt: '2026-11-01T00:00:00Z', status: 'approved' }), row('user', { id: U(71), createdAt: '2026-11-09T00:00:00Z', status: 'approved' }), row('user', { id: U(72), createdAt: '2026-11-05T00:00:00Z', status: 'approved' })], ...over });
test('profile section: hidden at zero or without data; otherwise average, count and the latest rows, newest first', () => {
  assert.equal(landlordExperienceView(null), null);
  assert.equal(landlordExperienceView(undefined), null);
  assert.equal(landlordExperienceView(published({ count: 0, average: null, rows: [] })), null);
  assert.equal(landlordExperienceView(published({ rows: [] })), null);
  assert.equal(landlordExperienceView(published({ count: 0 })), null, 'count zero hides it even if rows came back');
  assert.equal(landlordExperienceView(published({ kind: 'property' })), null, 'property reviews never feed this section');
  assert.equal(landlordExperienceView(published({ average: null })), null);
  const v = landlordExperienceView(published())!;
  assert.deepEqual([v.title, v.average, v.countLabel], [LANDLORD_EXPERIENCE_TITLE, '4.3 / 5', '3 reviews']);
  assert.deepEqual(v.rows.map(r => r.id), [U(71), U(72), U(70)]);
  assert.equal(landlordExperienceView(published({ count: 1, average: 5, rows: [published().rows[0]!] }))!.countLabel, '1 review');
  const many = Array.from({ length: 6 }, (_, i) => row('user', { id: U(80 + i), createdAt: `2026-11-0${i + 1}T00:00:00Z`, status: 'approved' }));
  assert.deepEqual(landlordExperienceView(published({ count: 6, rows: many }))!.rows.map(r => r.id), [U(85), U(84), U(83)], 'latest three');
  assert.equal(LANDLORD_EXPERIENCE_TITLE, "Landlord's experience with this user");
});

// ---- Rendering
function harness(vm: any, preset: any[] = [], alerts: any[] = [], scopes: any[] = []) {
  let cursor = 0;
  const native: any = { StyleSheet: { create: (s: any) => s, flatten: (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) }, Platform: { OS: 'android' } };
  for (const n of ['ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'View']) native[n] = n;
  native.Alert = { alert: (title: string, message: string, buttons: any[]) => alerts.push({ title, message, buttons }) };
  const cache = new Map<string, any>();
  const load = (abs: string): any => {
    if (cache.has(abs)) return cache.get(abs);
    const actual = createRequire(abs), mod = { exports: {} as any }; cache.set(abs, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState: (v: any) => { const i = cursor++; return [i < preset.length ? preset[i] : v, () => {}]; }, useEffect: () => {} };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      if (name.endsWith('/useRentalReviews')) return { useRentalReviews: (_a: any, scope: any) => { scopes.push(scope); return vm; } };
      if (name.endsWith('/PropertyReviewWordCloud')) return { PropertyReviewWordCloud: 'WordCloud' };
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
const panel = (context: ReviewContext, actor: string, extra: any = {}, vmOver: any = {}) => {
  const vm = { data: { type: 'context', value: context }, ready: true, busy: false, saving: false, pending: null, error: null, notice: null, workflow: {}, ...vmOver };
  return harness(vm).render('src/shared/components/RentalReviews.tsx', 'TenancyReviewPanel', { accountId: actor, tenancyId: TEN, ...extra });
};
test('tenant form: title, helper, rating scale, text box and a disabled Submit review; nothing about rating the landlord', () => {
  const tree = panel(ctx(), TENANT), t = text(tree);
  assert.ok(t.includes('Review the property') && t.includes("Appears on the property's reviews after it has been checked."));
  assert.equal(nodes(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityRole === 'radio').length, 5);
  assert.ok(nodes(tree).some(n => n.type === 'TextInput'));
  assert.equal(nodes(tree).find(n => n.type === 'Button' && n.props.label === 'Submit review')!.props.disabled, true);
  assert.doesNotMatch(t, /landlord|Tenant feedback|review target/i);
});
test('landlord form: "Rate your tenant", the profile helper and Submit rating', () => {
  const tree = panel(ctx(), LANDLORD), t = text(tree);
  assert.ok(t.includes('Rate your tenant') && t.includes("Appears on this tenant's profile."));
  assert.ok(nodes(tree).some(n => n.type === 'Button' && n.props.label === 'Submit rating'));
  assert.doesNotMatch(t, /only/i);
});
test('reviewed: "Your review" read-only with the rating, text and status; no form', () => {
  const tree = panel(ctx({ own: [row('property', { rating: 5, text: 'Loved it' })] }), TENANT), t = text(tree);
  assert.ok(t.includes('Your review') && t.includes('Waiting to be checked') && t.includes(' / 5') && nodes(tree).some(n => n.type === 'Text' && [n.props.children].flat().includes(5)) && t.includes('Loved it'));
  assert.equal(nodes(tree).filter(n => n.type === 'Pressable' && n.props.accessibilityRole === 'radio').length, 0);
  assert.ok(!nodes(tree).some(n => n.type === 'TextInput') && !nodes(tree).some(n => n.type === 'Button' && /^Submit/.test(n.props.label)));
  assert.ok(text(panel(ctx({ own: [row('property', { status: 'approved' })] }), TENANT)).includes('Published'));
});
test('not eligible: the date when it is known, the fallback when it is not, and no form', () => {
  const tree = panel(ctx({ eligible: false }), TENANT, { endDate: '2999-01-01' }), t = text(tree);
  assert.ok(t.includes('You can review after Jan 1, 2999.'));
  assert.ok(!nodes(tree).some(n => n.type === 'TextInput') && nodes(tree).filter(n => n.props?.accessibilityRole === 'radio').length === 0);
  assert.ok(text(panel(ctx({ eligible: false }), LANDLORD)).includes('You can review once the tenancy has ended.'));
});
test('the thank-you notice shows after a submit', () => {
  assert.ok(text(panel(ctx({ own: [row('property')] }), TENANT, {}, { notice: REVIEW_SUBMITTED_NOTICE })).includes('Thanks. Your review will appear once it has been checked.'));
});
test('profile section renders nothing at zero and the section with rows otherwise; no reviewer names', () => {
  const render = (value: PublishedReviews) => harness({ data: { type: 'public', value } }).render('src/shared/components/LandlordExperienceSection.tsx', 'LandlordExperienceSection', { accountId: TENANT });
  assert.equal(render(published({ count: 0, average: null, rows: [] })), null);
  const t = text(render(published()));
  for (const s of [LANDLORD_EXPERIENCE_TITLE, '4.3 / 5 · 3 reviews', '4 / 5', 'Nice place']) assert.ok(t.includes(s), s);
});
test('the profile uses the new section, and the tenancy screen passes its end date', () => {
  const profile = readFileSync('src/features/authentication/views/ProfileView.tsx', 'utf8');
  assert.match(profile, /<LandlordExperienceSection /); assert.doesNotMatch(profile, /PublishedRentalReviews/);
  assert.match(readFileSync('src/features/tenancy/views/TenancyDetailsView.tsx', 'utf8'), /endDate=\{t\.actual_end_date\?\?t\.expected_end_date\}/);
});

// ---- Submit wiring, locking, scope and error mapping
const submitFlow = (actor: string) => {
  const calls: any[] = [], alerts: any[] = [];
  const vm = { data: { type: 'context', value: ctx() }, ready: true, busy: false, saving: false, pending: null, error: null, notice: null, workflow: { submit: (d: any) => { calls.push(d); } } };
  const tree = harness(vm, [4, 'Quiet building'], alerts).render('src/shared/components/RentalReviews.tsx', 'TenancyReviewPanel', { accountId: actor, tenancyId: TEN });
  const button = nodes(tree).find(n => n.type === 'Button' && /^Submit/.test(n.props.label))!;
  return { calls, alerts, button };
};
test('submitting asks for confirmation and then sends the role\'s own kind with the rating and text', () => {
  for (const [actor, kind, label] of [[TENANT, 'property', 'Submit review'], [LANDLORD, 'user', 'Submit rating']] as const) {
    const f = submitFlow(actor);
    assert.equal(f.button.props.label, label); assert.equal(f.button.props.disabled, false, 'enabled once a rating is chosen');
    f.button.props.onPress();
    assert.equal(f.alerts.length, 1); assert.deepEqual(f.calls, [], 'nothing is sent before the confirmation');
    f.alerts[0].buttons.find((b: any) => b.text === 'Send').onPress();
    assert.deepEqual(f.calls, [{ action: 'submit', tenancyId: TEN, kind, rating: 4, text: 'Quiet building' }]);
  }
});
test('while saving or busy the rating scale and the text box are disabled', () => {
  const tree = panel(ctx(), TENANT, {}, { saving: true });
  assert.ok(nodes(tree).filter(n => n.props?.accessibilityRole === 'radio').every(n => n.props.disabled === true));
  assert.equal(nodes(tree).find(n => n.type === 'TextInput')!.props.editable, false);
});
test('the profile section reads the signed-in user\'s published USER reviews', () => {
  const scopes: any[] = [];
  harness({ data: { type: 'public', value: published() } }, [], [], scopes).render('src/shared/components/LandlordExperienceSection.tsx', 'LandlordExperienceSection', { accountId: TENANT });
  assert.deepEqual(scopes, [{ mode: 'user', id: TENANT }]);
});
test('the service shows the plain text for the two refused submits', async () => {
  const { createRentalReviewService } = await import('../src/shared/services/rentalReviewService');
  const make = (message: string) => createRentalReviewService(() => ({ auth: { getUser: async () => ({ data: { user: { id: TENANT } }, error: null }) }, rpc: () => ({ abortSignal: async () => ({ data: null, error: { code: '22023', message } }) }) } as any));
  const op = { operationId: U(90), action: 'submit', tenancyId: TEN, kind: 'property', rating: 4, text: null } as const;
  await assert.rejects(make('Completed tenancy required').write(TENANT, op, new AbortController().signal), /You can review once the tenancy has ended\./);
  await assert.rejects(make('Actual tenant required').write(TENANT, { ...op, kind: 'property' }, new AbortController().signal), /Only the tenant can review the property\./);
  await assert.rejects(make('Something else').write(TENANT, op, new AbortController().signal), /Review already exists, changed, or this action is unavailable/);
});
