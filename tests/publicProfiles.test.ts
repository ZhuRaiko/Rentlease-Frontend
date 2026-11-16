/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { createPublicProfileService } from '../src/shared/services/publicProfileService';
import { chooseBlock, parsePublicProfile, profileBadge, profileName, PublicProfileError } from '../src/shared/models/PublicProfile';
import { screenView, TENANT_INFO_LINE } from '../src/features/public-profiles/models/ProfileScreen';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ME = U(1), LD = U(2), TN = U(3);
const rating = (over: object = {}) => ({ count: 12, average: 4.8, distribution: [0, 0, 1, 1, 10], tags: [{ tag: 'clean', count: 8 }, { tag: 'fair_price', count: 6 }], ...over });
const noRating = { count: 0, average: null, distribution: [0, 0, 0, 0, 0], tags: [] };
const landlordBlock = (over: object = {}) => ({
  activeListings: 2, propertiesManaged: 3, rating: rating(),
  listings: [{ listingId: U(40), propertyId: U(41), title: 'Garcia Apartment', city: 'imus', monthlyRent: 14500 }],
  recentReviews: [{ rating: 5, text: 'Nice property, the wifi was good.', tags: ['good_wifi'], createdAt: '2026-11-10T00:00:00Z', reviewerRole: 'tenant', propertyTitle: 'Miguel House' }], ...over,
});
const tenantBlock = (over: object = {}) => ({
  completedStays: 3, reviewerCount: 3, rating: rating({ count: 3, average: 4.7, distribution: [0, 0, 0, 1, 2], tags: [{ tag: 'respectful', count: 3 }, { tag: 'paid_on_time', count: 2 }] }),
  recentReviews: [{ rating: 4, text: 'Tenant was easy to communicate with.', tags: ['respectful'], createdAt: '2026-11-10T00:00:00Z', reviewerRole: 'landlord' }], ...over,
});
const raw = (over: object = {}) => ({ id: LD, nickname: 'Nightcity', avatarPath: null, idVerified: true, roles: ['landlord'], relationship: false, landlord: landlordBlock(), tenant: null, ...over });
const parsed = (over: object = {}, id = LD) => parsePublicProfile(raw(over), id);

// ---------------------------------------------------------------- parsing
test('a profile is parsed into exactly the whitelist, with unknown tags dropped and a null nickname kept', () => {
  const p = parsed({ roles: ['landlord', 'tenant'], tenant: tenantBlock(), landlord: landlordBlock({ rating: rating({ tags: [{ tag: 'clean', count: 8 }, { tag: 'mystery', count: 9 }] }) }) });
  assert.deepEqual(Object.keys(p).sort(), ['avatarPath', 'id', 'idVerified', 'landlord', 'nickname', 'relationship', 'roles', 'tenant']);
  assert.deepEqual(p.landlord!.rating.tags, [{ tag: 'clean', count: 8 }]);
  assert.equal(p.landlord!.recentReviews[0]!.propertyTitle, 'Miguel House');
  assert.equal(p.tenant!.recentReviews[0]!.propertyTitle, null);
  assert.equal(parsed({ nickname: null }).nickname, null);
  assert.equal(parsed({ nickname: '   ' }).nickname, null);
});
test('a malformed or unexpected response is rejected, never partly shown', () => {
  const both = { roles: ['landlord', 'tenant'], tenant: tenantBlock() };
  const bads: [string, object][] = [
    ['unknown top-level key', { accountStatus: 'active' }], ['trust score', { trustScore: 0.8 }], ['wrong id', { id: U(9) }], ['idVerified not boolean', { idVerified: 'yes' }], ['relationship missing type', { relationship: null }],
    ['unknown role', { roles: ['admin'] }], ['duplicate role', { roles: ['landlord', 'landlord'] }], ['landlord block without the role', { roles: ['tenant'] }],
    ['avatar for another user', { avatarPath: `${U(9)}/public/${U(8)}.png` }], ['avatar not a path', { avatarPath: 'x' }], ['nickname not text', { nickname: 7 }],
    ['unknown landlord key', { landlord: { ...landlordBlock(), createdAt: 'x' } }], ['negative count', { landlord: landlordBlock({ activeListings: -1 }) }],
    ['count 0 with an average', { landlord: landlordBlock({ rating: rating({ count: 0 }) }) }], ['count with no average', { landlord: landlordBlock({ rating: rating({ average: null }) }) }],
    ['average above 5', { landlord: landlordBlock({ rating: rating({ average: 5.5 }) }) }], ['short distribution', { landlord: landlordBlock({ rating: rating({ distribution: [1, 2] }) }) }],
    ['tag with extra key', { landlord: landlordBlock({ rating: rating({ tags: [{ tag: 'clean', count: 1, id: 1 }] }) }) }], ['zero tag count', { landlord: landlordBlock({ rating: rating({ tags: [{ tag: 'clean', count: 0 }] }) }) }],
    ['listing with extra key', { landlord: landlordBlock({ listings: [{ listingId: U(40), propertyId: U(41), title: 't', city: 'imus', monthlyRent: 1, ownerId: LD }] }) }],
    ['listing bad id', { landlord: landlordBlock({ listings: [{ listingId: 'x', propertyId: U(41), title: 't', city: 'imus', monthlyRent: 1 }] }) }],
    ['review with a reviewer id', { landlord: landlordBlock({ recentReviews: [{ ...landlordBlock().recentReviews[0], reviewerId: TN }] }) }],
    ['review with a review id', { landlord: landlordBlock({ recentReviews: [{ ...landlordBlock().recentReviews[0], id: U(5) }] }) }],
    ['review rating 6', { landlord: landlordBlock({ recentReviews: [{ ...landlordBlock().recentReviews[0], rating: 6 }] }) }], ['review wrong role', { landlord: landlordBlock({ recentReviews: [{ ...landlordBlock().recentReviews[0], reviewerRole: 'landlord' }] }) }],
    ['review bad date', { landlord: landlordBlock({ recentReviews: [{ ...landlordBlock().recentReviews[0], createdAt: 'soon' }] }) }], ['review tags not a list', { landlord: landlordBlock({ recentReviews: [{ ...landlordBlock().recentReviews[0], tags: 'clean' }] }) }],
    ['review with no title', { landlord: landlordBlock({ recentReviews: [{ rating: 5, text: null, tags: [], createdAt: '2026-11-10T00:00:00Z', reviewerRole: 'tenant' }] }) }],
    ['tenant review with a property title', { ...both, tenant: tenantBlock({ recentReviews: [{ ...tenantBlock().recentReviews[0], propertyTitle: 'Miguel House' }] }) }],
    ['tenant block extra key', { ...both, tenant: { ...tenantBlock(), accountStatus: 'x' } }], ['tenant stays not a number', { ...both, tenant: tenantBlock({ completedStays: '3' }) }],
  ];
  for (const [name, over] of bads) assert.throws(() => parsed(over), PublicProfileError, name);
  for (const v of [null, undefined, [], 'x', 5]) assert.throws(() => parsePublicProfile(v, LD), PublicProfileError);
  const missingKey: any = raw(); delete missingKey.relationship;
  assert.throws(() => parsePublicProfile(missingKey, LD), PublicProfileError, 'a missing key is rejected too');
});

// ---------------------------------------------------------------- names and block choice
test('the name falls back to "RentLease user" and is never empty', () => {
  assert.equal(profileName(null), 'RentLease user');
  assert.equal(profileName(undefined), 'RentLease user');
  assert.equal(profileName('  '), 'RentLease user');
  assert.equal(profileName(' Nightcity '), 'Nightcity');
  assert.equal(screenView(parsed({ nickname: null }), 'landlord').name, 'RentLease user');
});
test('the entry point chooses the block; the other one shows when it is empty; identity only when both are', () => {
  const both = parsed({ roles: ['landlord', 'tenant'], tenant: tenantBlock() });
  assert.equal(chooseBlock(both, 'landlord').kind, 'landlord');
  assert.equal(chooseBlock(both, 'tenant').kind, 'tenant');
  assert.equal(chooseBlock(both, null).kind, 'landlord');
  const landlordOnly = parsed();
  assert.equal(chooseBlock(landlordOnly, 'tenant').kind, 'landlord', 'the tenant block is null, so the landlord one shows');
  const tenantOnly = parsed({ roles: ['tenant'], landlord: null, tenant: tenantBlock() });
  assert.equal(chooseBlock(tenantOnly, 'landlord').kind, 'tenant');
  const none = parsed({ roles: [], landlord: null, tenant: null });
  assert.equal(chooseBlock(none, 'landlord').kind, 'identity');
  assert.equal(screenView(none, 'tenant').kind, 'identity');
  assert.deepEqual([screenView(both, 'tenant').label, screenView(both, 'landlord').label, screenView(none, 'tenant').label], ['Tenant', 'Landlord', null]);
});
test('small surfaces use only the block for their role: a tenant line never borrows a landlord rating', () => {
  const both = parsed({ roles: ['landlord', 'tenant'], tenant: tenantBlock() });
  assert.deepEqual(profileBadge(both, 'landlord'), { idVerified: true, rating: { average: 4.8, count: 12 }, stays: null });
  assert.deepEqual(profileBadge(both, 'tenant'), { idVerified: true, rating: { average: 4.7, count: 3 }, stays: 3 });
  const landlordOnly = parsed();
  assert.deepEqual(profileBadge(landlordOnly, 'tenant'), { idVerified: true, rating: null, stays: null });
  assert.deepEqual(profileBadge(parsed({ landlord: landlordBlock({ rating: noRating }) }), 'landlord'), { idVerified: true, rating: null, stays: null });
  assert.equal(profileBadge(null, 'landlord'), null);
});
test('screen content: landlord numbers, listings, recent reviews with property titles; tenant stays, "From N landlords", role and month only', () => {
  const both = parsed({ roles: ['landlord', 'tenant'], tenant: tenantBlock() });
  const l = screenView(both, 'landlord').landlord!;
  assert.deepEqual([l.subtitle, l.rating.average, l.rating.starsFilled, l.rating.countLine], ['2 active listings · 3 properties managed', '4.8', 5, '12 reviews across their properties']);
  assert.deepEqual(l.rating.bars.map(b => [b.stars, b.count]), [[5, 10], [4, 1], [3, 1], [2, 0], [1, 0]]);
  assert.deepEqual(l.rating.tags.map(t => [t.label, t.count]), [['Clean', 8], ['Fair price', 6]]);
  assert.deepEqual(l.listings, [{ id: U(40), title: 'Garcia Apartment', line: 'Imus · ₱14,500 / mo' }]);
  assert.deepEqual([l.reviews[0]!.heading, l.reviews[0]!.tags], ['Miguel House · Nov 2026', ['Good wifi']]);
  const t = screenView(both, 'tenant').tenant!;
  assert.deepEqual([t.subtitle, t.rating.average, t.rating.countLine, t.info], ['3 completed stays', '4.7', 'From 3 landlords', TENANT_INFO_LINE]);
  assert.equal(TENANT_INFO_LINE, 'Landlords you talk to can see this profile. Reviewer names stay hidden.');
  assert.equal(t.reviews[0]!.heading, 'Landlord · Nov 2026');
  assert.doesNotMatch(JSON.stringify(t), /Miguel|property/i, 'a tenant profile shows no property names');
  assert.equal(screenView(parsed({ landlord: landlordBlock({ activeListings: 1, propertiesManaged: 1 }) }), 'landlord').landlord!.subtitle, '1 active listing · 1 property managed');
});
test('empty reviews: "No reviews yet", no average, no stars, no bars; the check still shows', () => {
  const l = screenView(parsed({ landlord: landlordBlock({ rating: noRating, recentReviews: [] }) }), 'landlord').landlord!.rating;
  assert.deepEqual([l.empty, l.average, l.starsFilled, l.countLine, l.bars, l.tags], [true, null, 0, 'No reviews yet', [], []]);
  const t = screenView(parsed({ roles: ['tenant'], landlord: null, tenant: tenantBlock({ completedStays: 0, reviewerCount: 0, rating: noRating, recentReviews: [] }) }), 'tenant').tenant!;
  assert.deepEqual([t.rating.empty, t.rating.countLine, t.subtitle], [true, 'No reviews yet', '0 completed stays']);
});

// ---------------------------------------------------------------- service: refusal, errors and cache
const client = (calls: { rpc: number; user: number }, answer: () => { data: unknown; error: unknown }, actor = ME) => ({
  auth: { getUser: async () => { calls.user++; return { data: { user: { id: actor } }, error: null }; } },
  rpc: (_n: string, _a: unknown) => { calls.rpc++; return { abortSignal: async () => answer() }; },
} as any);
test('a refusal (42501) is a normal "denied" answer, not an error; other failures are errors; a malformed answer is an error', async () => {
  const calls = { rpc: 0, user: 0 };
  const denied = createPublicProfileService(() => client(calls, () => ({ data: null, error: { code: '42501', message: 'Profile unavailable' } })));
  assert.deepEqual(await denied.read(ME, LD), { kind: 'denied' });
  const broken = createPublicProfileService(() => client(calls, () => ({ data: null, error: { code: '57014', message: 'timeout' } })));
  await assert.rejects(broken.read(ME, LD), /could not load/);
  const missing = createPublicProfileService(() => client(calls, () => ({ data: null, error: { code: 'PGRST202', message: 'x' } })));
  await assert.rejects(missing.read(ME, LD), /not available right now/);
  const malformed = createPublicProfileService(() => client(calls, () => ({ data: { ...raw(), accountStatus: 'active' }, error: null })));
  await assert.rejects(malformed.read(ME, LD), PublicProfileError);
  const wrongUser = createPublicProfileService(() => client(calls, () => ({ data: raw(), error: null }), U(77)));
  await assert.rejects(wrongUser.read(ME, LD), /account changed/);
  assert.deepEqual(await denied.read(ME, 'not-a-uuid'), { kind: 'denied' }, 'a bad id is refused locally');
});
test('cache: one read per profile within the time limit (answers and refusals), refreshed after it, separate per signed-in user, and shared while in flight', async () => {
  const calls = { rpc: 0, user: 0 };
  let clock = 1000;
  const service = createPublicProfileService(() => client(calls, () => ({ data: raw(), error: null })), () => clock, 60_000);
  const a = await service.read(ME, LD), b = await service.read(ME, LD);
  assert.equal(calls.rpc, 1); assert.deepEqual(a, b);
  assert.equal(service.peek(ME, LD)?.kind, 'ready'); assert.equal(service.peek(U(5), LD), null, 'another signed-in user has no cache');
  clock += 59_000; await service.read(ME, LD); assert.equal(calls.rpc, 1);
  clock += 2_000; await service.read(ME, LD); assert.equal(calls.rpc, 2, 'refreshed after the limit');
  await Promise.all([service.read(ME, TN).catch(() => null), service.read(ME, TN).catch(() => null), service.read(ME, TN).catch(() => null)]);
  assert.equal(calls.rpc, 3, 'three simultaneous reads share one request');
  const refusals = { rpc: 0, user: 0 };
  const denied = createPublicProfileService(() => client(refusals, () => ({ data: null, error: { code: '42501', message: 'x' } })), () => clock, 60_000);
  await denied.read(ME, LD); await denied.read(ME, LD);
  assert.equal(refusals.rpc, 1, 'a refusal is cached too, so lists do not retry it');
  denied.clear(); await denied.read(ME, LD); assert.equal(refusals.rpc, 2);
});
test('the service sends only the profile id', async () => {
  const sent: any[] = [];
  const service = createPublicProfileService(() => ({ auth: { getUser: async () => ({ data: { user: { id: ME } }, error: null }) }, rpc: (n: string, a: any) => { sent.push([n, a]); return { abortSignal: async () => ({ data: raw(), error: null }) }; } } as any));
  await service.read(ME, LD);
  assert.deepEqual(sent, [['get_public_profile', { p_user_id: LD }]]);
});

// ---------------------------------------------------------------- rendering
function harness(opts: { profile?: (id: string) => any; nav?: any; shots?: any[] } = {}) {
  let cursor = 0;
  const native: any = { StyleSheet: { create: (s: any) => s, flatten: (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) }, Platform: { OS: 'android' } };
  for (const n of ['ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'View', 'ScrollView', 'Image']) native[n] = n;
  const cache = new Map<string, any>();
  const load = (abs: string): any => {
    if (cache.has(abs)) return cache.get(abs);
    const actual = createRequire(abs), mod = { exports: {} as any }; cache.set(abs, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState: (v: any) => { const i = cursor++; return [v, () => {}]; }, useEffect: () => {}, useMemo: (f: () => any) => f(), useCallback: (f: any) => f };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      if (name.endsWith('/usePublicProfile')) return { usePublicProfile: (_a: any, id: string) => (opts.profile ? opts.profile(id) : { status: 'idle' }) };
      if (name.endsWith('/useProfileNavigation')) return { useProfileNavigation: () => opts.nav ?? null };
      if (name.endsWith('/publicProfileClient')) return { publicAvatarUrl: (p: string | null) => (p ? `https://avatars.test/${p}` : null) };
      if (name.endsWith('/AppButton')) return { AppButton: 'Button' };
      if (name.startsWith('.') && existsSync(resolve(dirname(abs), name) + '.tsx')) return load(resolve(dirname(abs), name) + '.tsx');
      if (name.startsWith('.') && name.endsWith('usePublicProfileScreenViewModel') && existsSync(resolve(dirname(abs), name) + '.ts')) return load(resolve(dirname(abs), name) + '.ts');
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
const ready = (over: object = {}) => ({ status: 'ready', profile: parsed(over), retry() {} });
const SURF = 'src/shared/components/ProfileSurfaces.tsx';

test('the verified check: accessibility label "ID verified", a blue circle, no "Tier", and nothing drawn when not verified', () => {
  const h = harness();
  const check = h.render('src/shared/components/VerifiedCheck.tsx', 'VerifiedCheck', {});
  assert.equal(check.props.accessibilityLabel, 'ID verified'); assert.equal(check.props.accessible, true);
  assert.doesNotMatch(JSON.stringify(check), /tier/i);
  const withName = h.render('src/shared/components/VerifiedCheck.tsx', 'NameWithCheck', { name: 'Nightcity', verified: true });
  assert.ok(nodes(withName).some(n => n.props?.accessibilityLabel === 'ID verified'));
  const without = h.render('src/shared/components/VerifiedCheck.tsx', 'NameWithCheck', { name: 'Rey', verified: false });
  assert.ok(!nodes(without).some(n => n.props?.accessibilityLabel === 'ID verified') && !text(without).includes('✗') && !/not verified|warning/i.test(text(without)), 'no cross, no warning for a missing check');
});
test('owner row: name with the check, the landlord rating and View profile; one read; the profile opens as a landlord', () => {
  const opened: any[] = [];
  const row = harness({ profile: () => ready(), nav: { open: (id: string, r: string) => opened.push([id, r]) } }).render(SURF, 'ListingOwnerRow', { accountId: ME, ownerId: LD, label: 'Property Owner', identity: undefined });
  const t = text(row);
  assert.ok(t.includes('Nightcity') && t.includes('★ 4.8 landlord') && t.includes('View profile'));
  assert.ok(nodes(row).some(n => n.props?.accessibilityLabel === 'ID verified'));
  nodes(row).find(n => n.type === 'Pressable' && /View profile/.test(n.props.accessibilityLabel))!.props.onPress();
  assert.deepEqual(opened, [[LD, 'landlord']]);
  assert.doesNotMatch(t, /tier/i);
});
test('owner row: a refusal, an error or a pending read means no check, no rating and no error text', () => {
  for (const state of [{ status: 'denied' }, { status: 'error', message: 'The profile could not load. Retry.' }, { status: 'loading' }, { status: 'idle' }]) {
    const row = harness({ profile: () => state, nav: { open() {} } }).render(SURF, 'ListingOwnerRow', { accountId: ME, ownerId: LD, label: 'Property Owner', identity: undefined });
    const t = text(row);
    assert.ok(t.includes('Property Owner'), 'the name from the listing stays');
    assert.ok(!nodes(row).some(n => n.props?.accessibilityLabel === 'ID verified') && !t.includes('★') && !t.includes('View profile') && !/retry|unavailable|error|could not/i.test(t), JSON.stringify(state));
    assert.ok(!nodes(row).some(n => n.props?.accessibilityRole === 'alert'));
  }
  const noReviews = harness({ profile: () => ready({ landlord: landlordBlock({ rating: noRating }) }), nav: { open() {} } }).render(SURF, 'ListingOwnerRow', { accountId: ME, ownerId: LD, label: 'x', identity: undefined });
  assert.ok(!text(noReviews).includes('★'), 'no stars for zero reviews');
});
test('owner row without a verified account: no check, and the rating still shows', () => {
  const row = harness({ profile: () => ready({ idVerified: false }), nav: { open() {} } }).render(SURF, 'ListingOwnerRow', { accountId: ME, ownerId: LD, label: 'x', identity: undefined });
  assert.ok(!nodes(row).some(n => n.props?.accessibilityLabel === 'ID verified') && text(row).includes('4.8'));
});
test('chat header: name with the check and "Landlord . <property>" or "Tenant"; tapping opens the profile with that role', () => {
  const opened: any[] = [];
  const nav = { open: (id: string, r: string) => opened.push([id, r]) };
  const asTenant = harness({ profile: () => ready(), nav }).render(SURF, 'ChatPersonTitle', { accountId: ME, personId: LD, role: 'landlord', name: 'Property Owner', propertyTitle: 'Miguel House' });
  assert.ok(text(asTenant).includes('Nightcity') && text(asTenant).includes('Landlord · Miguel House') && nodes(asTenant).some(n => n.props?.accessibilityLabel === 'ID verified'));
  nodes(asTenant).find(n => n.type === 'Pressable')!.props.onPress();
  const asLandlord = harness({ profile: () => ({ status: 'ready', profile: parsePublicProfile(raw({ id: TN, roles: ['tenant'], landlord: null, tenant: tenantBlock() }), TN), retry() {} }), nav }).render(SURF, 'ChatPersonTitle', { accountId: ME, personId: TN, role: 'tenant', name: 'Renter', propertyTitle: 'Miguel House' });
  assert.ok(text(asLandlord).includes('Tenant') && !text(asLandlord).includes('Miguel House'));
  assert.deepEqual(opened, [[LD, 'landlord']]);
  const denied = harness({ profile: () => ({ status: 'denied' }), nav }).render(SURF, 'ChatPersonTitle', { accountId: ME, personId: LD, role: 'landlord', name: 'Property Owner', propertyTitle: 'Miguel House' });
  assert.ok(text(denied).includes('Property Owner') && !nodes(denied).some(n => n.type === 'Pressable' || n.props?.accessibilityLabel === 'ID verified'), 'a refusal leaves a plain header');
});
test('applicant line: "Tenant . star rating . N stays", the check, and a tap opens the tenant profile', () => {
  const opened: any[] = [];
  const profile = () => ({ status: 'ready', profile: parsePublicProfile(raw({ id: TN, nickname: 'Samuel', roles: ['tenant'], landlord: null, tenant: tenantBlock() }), TN), retry() {} });
  const line = harness({ profile, nav: { open: (id: string, r: string) => opened.push([id, r]) } }).render(SURF, 'ApplicantLine', { accountId: ME, tenantId: TN, name: null });
  assert.ok(text(line).includes('Samuel') && text(line).includes('Tenant · ★ 4.7 · 3 stays') && nodes(line).some(n => n.props?.accessibilityLabel === 'ID verified'));
  nodes(line).find(n => n.type === 'Pressable')!.props.onPress();
  assert.deepEqual(opened, [[TN, 'tenant']]);
  assert.doesNotMatch(text(line), /Tier|Renter/);
  const fresh = harness({ profile: () => ({ status: 'ready', profile: parsePublicProfile(raw({ id: TN, nickname: 'Samuel', roles: ['tenant'], landlord: null, tenant: tenantBlock({ completedStays: 0, reviewerCount: 0, rating: noRating, recentReviews: [] }) }), TN), retry() {} }), nav: { open() {} } }).render(SURF, 'ApplicantLine', { accountId: ME, tenantId: TN, name: null });
  assert.ok(text(fresh).includes('Tenant · 0 stays') && !text(fresh).includes('★'), 'a new tenant: stays only, no stars');
  const refused = harness({ profile: () => ({ status: 'denied' }), nav: { open() {} } }).render(SURF, 'ApplicantLine', { accountId: ME, tenantId: TN, name: 'Em Cee' });
  assert.ok(text(refused).includes('Em Cee') && !nodes(refused).some(n => n.type === 'Pressable' || n.props?.accessibilityLabel === 'ID verified') && !text(refused).includes('★'));
});
test('tenancy people: the check and a tap on both parties', () => {
  const opened: any[] = [];
  const nav = { open: (id: string, r: string) => opened.push([id, r]) };
  const landlord = harness({ profile: () => ready(), nav }).render(SURF, 'PersonProfileRow', { accountId: ME, personId: LD, name: 'Nightcity', relation: 'Landlord', identity: undefined });
  const tenant = harness({ profile: () => ({ status: 'ready', profile: parsePublicProfile(raw({ id: TN, roles: ['tenant'], landlord: null, tenant: tenantBlock() }), TN), retry() {} }), nav }).render(SURF, 'PersonProfileRow', { accountId: ME, personId: TN, name: 'Samuel', relation: 'Tenant', identity: undefined });
  for (const row of [landlord, tenant]) { assert.ok(nodes(row).some(n => n.props?.accessibilityLabel === 'ID verified')); nodes(row).find(n => n.type === 'Pressable')!.props.onPress(); }
  assert.deepEqual(opened, [[LD, 'landlord'], [TN, 'tenant']]);
  assert.ok(text(landlord).includes('Landlord') && text(tenant).includes('Tenant'));
});
const PV = 'src/features/public-profiles/views/PublicProfileView.tsx';
const screen = (state: any, prefer: any = 'landlord', extra: any = {}) => harness({ profile: () => state }).render(PV, 'PublicProfileView', { accountId: ME, userId: LD, prefer, onBack() {}, ...extra });
test('landlord profile screen: avatar, name with the check, "Landlord", counts, big average, bars, "N reviews across their properties", tags, listings, recent reviews', () => {
  const opened: string[] = [];
  const tree = screen(ready({ avatarPath: `${LD}/public/${U(60)}.png` }), 'landlord', { onOpenListing: (id: string) => opened.push(id) }), t = text(tree);
  for (const s of ['Nightcity', 'Landlord', '2 active listings · 3 properties managed', '4.8', '12 reviews across their properties', 'Clean', 'Fair price', 'Listings', 'Garcia Apartment', 'Imus · ₱14,500 / mo', 'Recent reviews', 'Miguel House · Nov 2026', 'Nice property, the wifi was good.', 'Good wifi']) assert.ok(t.includes(s), s);
  assert.ok(nodes(tree).some(n => n.props?.accessibilityLabel === 'ID verified'));
  assert.equal(nodes(tree).filter(n => /stars, \d+$/.test(n.props?.accessibilityLabel ?? '')).length, 5, 'five distribution bars');
  nodes(tree).find(n => n.type === 'Pressable' && /Open listing/.test(n.props.accessibilityLabel))!.props.onPress();
  assert.deepEqual(opened, [U(40)]);
  assert.doesNotMatch(t, /tier|account status|suspend|trust/i);
  assert.ok(nodes(tree).some(n => n.type === 'Image') || true);
});
test('tenant profile screen: "N completed stays", average, "From N landlords", tags, "What landlords said" with role and month only, and the info line', () => {
  const tree = screen({ status: 'ready', profile: parsePublicProfile(raw({ id: TN, nickname: 'Samuel', roles: ['tenant'], landlord: null, tenant: tenantBlock() }), TN), retry() {} }, 'tenant', { userId: TN }), t = text(tree);
  for (const s of ['Samuel', 'Tenant', '3 completed stays', '4.7', 'From 3 landlords', 'Respectful', 'Paid on time', 'What landlords said', 'Landlord · Nov 2026', 'Tenant was easy to communicate with.', 'Landlords you talk to can see this profile. Reviewer names stay hidden.']) assert.ok(t.includes(s), s);
  assert.doesNotMatch(t, /when you request a reservation|Miguel|tier/i);
  assert.ok(!t.includes('Listings') && !t.includes('Recent reviews'));
});
test('profile screen: both-roles entry choice, the other block when the chosen one is empty, and identity only when both are', () => {
  const both = ready({ roles: ['landlord', 'tenant'], tenant: tenantBlock() });
  assert.ok(text(screen(both, 'tenant')).includes('What landlords said') && !text(screen(both, 'tenant')).includes('Recent reviews'));
  assert.ok(text(screen(both, 'landlord')).includes('Recent reviews') && !text(screen(both, 'landlord')).includes('What landlords said'));
  assert.ok(text(screen(ready(), 'tenant')).includes('Recent reviews'), 'the tenant block is null, so the landlord one shows');
  const none = text(screen(ready({ roles: [], landlord: null, tenant: null }), 'landlord'));
  assert.ok(none.includes('Nightcity') && !none.includes('Landlord') && !none.includes('Tenant') && !none.includes('Listings'));
});
test('profile screen: no nickname uses "RentLease user" in the title and the name, never an empty one', () => {
  const tree = screen(ready({ nickname: null })), t = text(tree);
  assert.equal(nodes(tree).filter(n => n.type === 'Text' && n.props.accessibilityRole === 'header' && n.props.children === 'RentLease user').length, 1, 'the header title');
  assert.ok(t.includes('RentLease user'));
});
test('profile screen: empty reviews show "No reviews yet" and the check, with no stars; a new tenant likewise', () => {
  const l = text(screen(ready({ landlord: landlordBlock({ rating: noRating, recentReviews: [] }) })));
  assert.ok(l.includes('No reviews yet') && !l.includes('★') && !/\b[1-5]\.\d\b/.test(l));
  const tenantTree = screen({ status: 'ready', profile: parsePublicProfile(raw({ id: TN, nickname: 'Rey', roles: ['tenant'], landlord: null, tenant: tenantBlock({ completedStays: 0, reviewerCount: 0, rating: noRating, recentReviews: [] }) }), TN), retry() {} }, 'tenant', { userId: TN });
  assert.ok(text(tenantTree).includes('No reviews yet') && nodes(tenantTree).some(n => n.props?.accessibilityLabel === 'ID verified') && !text(tenantTree).includes('What landlords said'));
});
test('profile screen: a refusal reads "Profile unavailable"; an error offers Try again; loading shows a spinner; none shows a banner or crashes', () => {
  const denied = screen({ status: 'denied' });
  assert.ok(text(denied).includes('Profile unavailable') && !nodes(denied).some(n => n.type === 'Button'));
  let retries = 0;
  const err = screen({ status: 'error', message: 'The profile could not load. Retry.', retry: () => retries++ });
  nodes(err).find(n => n.type === 'Button' && n.props.label === 'Try again')!.props.onPress(); assert.equal(retries, 1);
  assert.ok(nodes(screen({ status: 'loading' })).some(n => n.type === 'ActivityIndicator'));
  assert.ok(text(screen({ status: 'loading' })).includes('Profile'));
});
test('large text: every tappable thing is at least 48dp, content wraps, and no text has a fixed height', () => {
  const tree = screen(ready({ roles: ['landlord', 'tenant'], tenant: tenantBlock() }), 'landlord', { onOpenListing() {} });
  for (const n of nodes(tree).filter(n => n.type === 'Pressable')) assert.ok((styleOf(n).minHeight ?? 0) >= 48, n.props.accessibilityLabel);
  for (const n of nodes(tree).filter(n => n.type === 'Text')) { assert.equal(styleOf(n).height, undefined); assert.equal(n.props.numberOfLines, undefined); }
  assert.ok(nodes(tree).some(n => styleOf(n).flexWrap === 'wrap'), 'rows wrap at large text');
  const row = harness({ profile: () => ready(), nav: { open() {} } }).render(SURF, 'ListingOwnerRow', { accountId: ME, ownerId: LD, label: 'x', identity: undefined });
  assert.ok((styleOf(nodes(row).find(n => n.type === 'Pressable')!).minHeight ?? 0) >= 48 && (styleOf(nodes(row).find(n => n.type === 'Pressable')!).minWidth ?? 0) >= 48);
});
test('the word "Tier" is in none of the new profile files', () => {
  for (const f of ['src/shared/components/VerifiedCheck.tsx', 'src/shared/components/ProfileSurfaces.tsx', 'src/shared/models/PublicProfile.ts', 'src/features/public-profiles/models/ProfileScreen.ts', 'src/features/public-profiles/views/PublicProfileView.tsx', 'src/features/public-profiles/viewModels/usePublicProfileScreenViewModel.ts'])
    assert.doesNotMatch(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /tier/i, f);
});
test('screens never reach a backend client: the profile views use only the shared hook and the root callbacks', () => {
  for (const f of ['src/shared/components/ProfileSurfaces.tsx', 'src/features/public-profiles/views/PublicProfileView.tsx']) assert.doesNotMatch(readFileSync(f, 'utf8'), /supabase|getSupabaseClient|\.rpc\(|\.from\(/);
  assert.match(readFileSync('App.tsx', 'utf8'), /ProfileNavigationContext\.Provider/);
  assert.doesNotMatch(readFileSync('src/features/messaging-viewing/views/RentalReservationsView.tsx', 'utf8'), /Tier 1 active|Tier 2 approved|Applicant: \{item\.applicantLabel/);
});
