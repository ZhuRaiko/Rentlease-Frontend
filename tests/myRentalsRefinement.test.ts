/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { filterPortfolio, filterPortfolioByStatus, portfolioFilterCounts, type LandlordPortfolioItem, type PortfolioFilter } from '../src/features/property-listing/models/LandlordPortfolio';
import { portfolioCardActions, portfolioStatusChip, portfolioVerificationChip } from '../src/features/property-listing/models/PortfolioCardPresentation';
import { createLandlordPortfolioWorkflow } from '../src/features/property-listing/viewModels/landlordPortfolioWorkflow';
import { requestActivityLine, requestSummary } from '../src/features/messaging-viewing/models/RequestSummary';

// ---- Minimal recursive render harness: loads real .tsx files, keeps useState per render order, expands function components.
type Node = any;
function harness(viewport = { width: 411, height: 900, fontScale: 1 }) {
  const states: any[] = []; let cursor = 0; const cache = new Map<string, any>();
  const useState = (initial: any) => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; };
  const native: any = { StyleSheet: { create: (s: any) => s }, useWindowDimensions: () => viewport, Platform: { OS: 'android' } };
  for (const name of ['Image', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'TextInput', 'View']) native[name] = name;
  const load = (absolute: string): any => {
    if (cache.has(absolute)) return cache.get(absolute);
    const actual = createRequire(absolute), mod = { exports: {} as any }; cache.set(absolute, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
      if (name === 'react-native') return native;
      if (name.startsWith('.')) { const target = resolve(dirname(absolute), name); if (existsSync(target + '.tsx')) return load(target + '.tsx'); }
      return actual(name);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
    cache.set(absolute, mod.exports); return mod.exports;
  };
  const expand = (node: Node): Node => {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  return { render: (path: string, name: string, props: any) => { cursor = 0; return expand(load(resolve(path))[name](props)); } };
}
const flat = (node: Node): Node[] => Array.isArray(node) ? node.flatMap(flat) : node && typeof node === 'object' ? [node, ...flat(node.props?.children)] : typeof node === 'string' ? [node] : [];
const text = (tree: Node) => flat(tree).filter(n => typeof n === 'string').join('');
const nodes = (tree: Node) => flat(tree).filter(n => typeof n === 'object');
const dashboard = 'src/features/property-listing/views/PropertyDashboardView.tsx';
const cardPath = 'src/features/property-listing/components/PortfolioRentalCard.tsx';

// ---- Fixtures
const owner = '10000000-0000-4000-8000-000000000001';
function makeItem(id: string, listingStatus: string | null, tier: string = 'approved', extra: Partial<LandlordPortfolioItem> & { active?: boolean; title?: string; completeness?: number } = {}): LandlordPortfolioItem {
  const listing = listingStatus ? { id: `l-${id}`, property_id: id, title: extra.title ?? `Rental ${id}`, status: listingStatus, asking_rent_monthly: 9999, completeness_score: extra.completeness ?? 0.5, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } : null;
  return { propertyId: id, property: { id, landlord_id: owner, property_type: 'house', city: 'imus', barangay: 'Bayan Luma', is_active: extra.active ?? true }, listings: listing ? [listing] : [], currentListing: listing, coverPhoto: null, tier3: { status: tier, submissionId: null, updatedAt: null, ...(extra.tier3 ?? {}) }, ...('coverPhoto' in extra ? { coverPhoto: extra.coverPhoto } : {}) } as any;
}
const items = [makeItem('a', 'draft', 'not_submitted'), makeItem('b', 'active'), makeItem('c', 'active'), makeItem('d', 'rented'), makeItem('e', null, 'not_submitted')];

function viewModel(overrides: any = {}) {
  const calls: string[] = [];
  const all: LandlordPortfolioItem[] = overrides.items ?? items, filter: PortfolioFilter = overrides.filter ?? 'all', query = overrides.query ?? '';
  const vm: any = {
    portfolioState: { loaded: true, items: all, query, filter, refreshing: false, busy: false, error: null },
    portfolioItems: filterPortfolio(filterPortfolioByStatus(all, filter), query), portfolioFilterCounts: portfolioFilterCounts(all),
    portfolio: { load() {} }, portfolioActionsDisabled: overrides.disabled ?? false, notice: null, propertyVerificationState: null,
    setPortfolioFilter: (f: string) => calls.push(`filter:${f}`), setListingQuery: (q: string) => calls.push(`query:${q}`),
    openPortfolioItem: (id: string) => calls.push(`open:${id}`), openPortfolioProperty: (id: string) => calls.push(`editProperty:${id}`),
    editPortfolioListing: (id: string) => calls.push(`editRental:${id}`), openPortfolioVerification: async (id: string) => { calls.push(`verify:${id}`); },
    reviewPortfolioPublication: (id: string) => calls.push(`review:${id}`), openPostingType: () => calls.push('post'), startCreate: () => calls.push('post'),
  };
  return { vm, calls };
}
const press = (tree: Node, predicate: (n: Node) => boolean) => { const node = nodes(tree).find(predicate); assert.ok(node, 'target element not found'); node.props.onPress(); };
const labelled = (label: string) => (n: Node) => n.props?.accessibilityLabel === label;
// ListingButton expands to a Pressable, so buttons are found by their rendered text.
const byText = (label: string) => (n: Node) => typeof n.props?.onPress === 'function' && flat(n.props.children).includes(label);

// ---- Model: filtering and counts share one definition
test('filter tabs act on the current listing so counts always equal the cards a tab shows', () => {
  assert.deepEqual(portfolioFilterCounts(items), { all: 5, published: 2, drafts: 1, rented: 1 });
  for (const f of ['all', 'published', 'drafts', 'rented'] as const) assert.equal(filterPortfolioByStatus(items, f).length, portfolioFilterCounts(items)[f]);
  assert.deepEqual(filterPortfolioByStatus(items, 'drafts').map(i => i.propertyId), ['a']);
  // A property with a published listing and an older draft is one Published card, not also a Draft.
  const both = makeItem('f', 'active'); both.listings = [...both.listings, { ...both.currentListing!, id: 'older-draft', status: 'draft' }];
  assert.deepEqual(portfolioFilterCounts([both]), { all: 1, published: 1, drafts: 0, rented: 0 });
  // Properties without a listing belong only to All.
  assert.deepEqual(portfolioFilterCounts([makeItem('g', null)]), { all: 1, published: 0, drafts: 0, rented: 0 });
});

test('workflow owns the active filter: intersects with search, counts ignore the query, invalidation resets it', async () => {
  const service: any = { user: async () => owner, assertUser: async () => {}, load: async () => items };
  const flow = createLandlordPortfolioWorkflow(service); await flow.load();
  assert.equal(flow.getSnapshot().filter, 'all'); assert.equal(flow.filtered().length, 5);
  flow.setFilter('published'); assert.deepEqual(flow.filtered().map(i => i.propertyId), ['b', 'c']);
  flow.setQuery('Rental b'); assert.deepEqual(flow.filtered().map(i => i.propertyId), ['b']);
  assert.deepEqual(flow.filterCounts(), { all: 5, published: 2, drafts: 1, rented: 1 });
  flow.invalidate(); assert.equal(flow.getSnapshot().filter, 'all'); assert.equal(flow.getSnapshot().query, '');
});

test('Views contain no counting or status-filtering logic', () => {
  for (const file of [dashboard, cardPath, 'src/features/property-listing/components/PortfolioFilterTabs.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\.filter\(|\.reduce\(|\.length\s*[-+]|listings\.length|portfolioFilterCounts\(|getSupabaseClient|\.rpc\(/, file);
  }
});

// ---- Dashboard rendering
test('dashboard has no Post a Rental button; posting stays in the navbar and empty copy points to Post below', () => {
  const { vm } = viewModel(); const h = harness();
  const tree = h.render(dashboard, 'PropertyDashboardView', { viewModel: vm });
  assert.doesNotMatch(text(tree), /Post a Rental/); assert.ok(!nodes(tree).some(n => n.props?.label === 'Post a Rental'));
  const empty = harness().render(dashboard, 'PropertyDashboardView', { viewModel: viewModel({ items: [] }).vm });
  assert.match(text(empty), /No properties yet/); assert.match(text(empty), /Use Post below/); assert.doesNotMatch(text(empty), /Post a Rental/);
  assert.ok(!nodes(empty).some(n => n.props?.accessibilityRole === 'tab'), 'no tabs when the owner has no properties');
});

test('filter tabs show ViewModel counts, mark the active tab and report taps; the list is the ViewModel-filtered list', () => {
  const { vm, calls } = viewModel({ filter: 'drafts' }); const tree = harness().render(dashboard, 'PropertyDashboardView', { viewModel: vm });
  const tabs = nodes(tree).filter(n => n.props?.accessibilityRole === 'tab');
  assert.deepEqual(tabs.map(t => t.props.accessibilityLabel), ['All, 5', 'Published, 2', 'Drafts, 1', 'Rented, 1']);
  assert.deepEqual(tabs.map(t => t.props.accessibilityState.selected), [false, false, true, false]);
  assert.ok(tabs.every(t => t.props.hitSlop.top + t.props.hitSlop.bottom + 40 >= 48), 'tab hit area is at least 48dp tall');
  assert.equal(nodes(tree).filter(byText('Continue Editing')).length, 1, 'one card rendered for the single draft');
  tabs[1].props.onPress(); assert.deepEqual(calls, ['filter:published']);
});

test('empty filter and empty search results use distinct honest copy', () => {
  const none = [makeItem('x', 'active')];
  assert.match(text(harness().render(dashboard, 'PropertyDashboardView', { viewModel: viewModel({ items: none, filter: 'drafts' }).vm })), /No drafts\./);
  assert.match(text(harness().render(dashboard, 'PropertyDashboardView', { viewModel: viewModel({ items: none, filter: 'rented' }).vm })), /No rented listings yet\./);
  assert.match(text(harness().render(dashboard, 'PropertyDashboardView', { viewModel: viewModel({ items: none, query: 'zzz' }).vm })), /No matching properties or listings/);
});

test('search sits behind a header icon; opening reveals the input, closing clears the query', () => {
  const { vm, calls } = viewModel(); const h = harness();
  const closed = h.render(dashboard, 'PropertyDashboardView', { viewModel: vm });
  assert.ok(!nodes(closed).some(n => n.props?.accessibilityLabel === 'Search properties and listings'));
  const icon = nodes(closed).find(labelled('Search my rentals'))!; assert.equal(icon.props.accessibilityState.expanded, false); assert.equal(icon.props.style.width, 48); assert.equal(icon.props.style.height, 48);
  icon.props.onPress();
  const open = h.render(dashboard, 'PropertyDashboardView', { viewModel: vm });
  const input = nodes(open).find(labelled('Search properties and listings'))!; assert.ok(input, 'input revealed');
  input.props.onChangeText('imus'); assert.deepEqual(calls, ['query:imus']);
  press(open, labelled('Close search')); assert.deepEqual(calls, ['query:imus', 'query:']);
  assert.ok(!nodes(h.render(dashboard, 'PropertyDashboardView', { viewModel: vm })).some(labelled('Search properties and listings')));
  assert.ok(nodes(harness().render(dashboard, 'PropertyDashboardView', { viewModel: viewModel({ query: 'imus' }).vm })).some(labelled('Search properties and listings')), 'an active query keeps the input visible');
});

// ---- Card: actions
const actionLabels = (item: LandlordPortfolioItem) => { const a = portfolioCardActions(item); return [a.primary.label, a.secondary?.label ?? null, a.menu.map(m => m.label)]; };
test('one primary action, one secondary, the rest in the menu, using only existing actions', () => {
  assert.deepEqual(actionLabels(makeItem('1', 'draft', 'not_submitted')), ['Continue Editing', 'Verify This Property', []]);
  assert.deepEqual(actionLabels(makeItem('2', 'active', 'approved')), ['Manage Status', 'Edit Rental', []]);
  assert.deepEqual(actionLabels(makeItem('3', 'paused', 'pending')), ['Manage Status', 'Edit Rental', ['View Verification Status']]);
  assert.deepEqual(actionLabels(makeItem('4', null, 'not_submitted')), ['Create listing', 'Verify This Property', ['Edit Property']]);
  assert.deepEqual(actionLabels(makeItem('5', 'rented', 'rejected')), ['View listing', 'Edit Property', ['View Verification Feedback']]);
  assert.deepEqual(actionLabels(makeItem('6', 'draft', 'approved', { completeness: 0.9 })), ['Continue Editing', 'Review Publication', []]);
  assert.deepEqual(actionLabels(makeItem('7', 'draft', 'approved', { completeness: 0.5 })), ['Continue Editing', null, []]);
  assert.deepEqual(actionLabels(makeItem('8', 'active', 'approved', { active: false })), ['Manage Status', null, []]);
  for (const item of [...items, makeItem('9', 'removed'), makeItem('10', 'archived')]) {
    const a = portfolioCardActions(item), all = [a.primary, a.secondary, ...a.menu].filter(Boolean).map(x => x!.label);
    assert.ok(!all.some(label => /delete|remove draft/i.test(label)), 'no new delete behavior');
    assert.equal(new Set(all).size, all.length, 'no duplicated action');
  }
});

test('card buttons reach the existing ViewModel handlers with the property id', () => {
  const { vm, calls } = viewModel({ items: [makeItem('p1', 'draft', 'not_submitted')] }); const h = harness();
  const render = () => h.render(dashboard, 'PropertyDashboardView', { viewModel: vm });
  press(render(), byText('Continue Editing')); press(render(), byText('Verify This Property'));
  assert.deepEqual(calls, ['open:p1', 'verify:p1']);
  const { vm: vm2, calls: calls2 } = viewModel({ items: [makeItem('p2', 'active', 'approved')] });
  const h2 = harness(); const render2 = () => h2.render(dashboard, 'PropertyDashboardView', { viewModel: vm2 });
  press(render2(), byText('Manage Status')); press(render2(), byText('Edit Rental'));
  assert.deepEqual(calls2, ['open:p2', 'editRental:p2']);
});

test('portfolioActionsDisabled disables every card action and the menu button', () => {
  const { vm } = viewModel({ items: [makeItem('d1', 'draft', 'not_submitted')], disabled: true });
  const tree = harness().render(dashboard, 'PropertyDashboardView', { viewModel: vm });
  const buttons = ['Continue Editing', 'Verify This Property'].map(label => nodes(tree).find(byText(label))); assert.ok(buttons.every(Boolean)); assert.ok(buttons.every(b => b!.props.disabled === true));
  const { vm: vm2 } = viewModel({ items: [makeItem('d2', 'paused', 'pending')], disabled: true });
  const menu = nodes(harness().render(dashboard, 'PropertyDashboardView', { viewModel: vm2, requestActivity: () => ({ text: null, pending: false, error: null, onManage() {} }) })).find(n => n.props?.accessibilityLabel?.startsWith('More actions for'));
  assert.equal(menu!.props.disabled, true);
});

for (const status of ['not_submitted', 'pending', 'under_review', 'rejected', 'approved'] as const) test(`My Rentals draft card exposes ${status} verification directly while keeping Continue Editing`, () => {
  const item = makeItem('10000000-0000-4000-8000-000000000001', 'draft', status, { completeness: 1 }); const { vm, calls } = viewModel({ items: [item] }); const h = harness();
  const render = () => h.render(dashboard, 'PropertyDashboardView', { viewModel: vm });
  press(render(), byText('Continue Editing'));
  const tree = render(), verification = ['Verify This Property', 'View Verification Status', 'View Verification Feedback'].find(label => nodes(tree).some(byText(label)));
  if (status === 'approved') {
    assert.equal(verification, undefined); assert.match(text(tree), /Property verified/); press(tree, byText('Review Publication'));
    assert.deepEqual(calls, ['open:10000000-0000-4000-8000-000000000001', 'review:10000000-0000-4000-8000-000000000001']);
  } else {
    assert.ok(verification); press(tree, byText(verification!)); assert.ok(!nodes(tree).some(byText('Review Publication')));
    assert.deepEqual(calls, ['open:10000000-0000-4000-8000-000000000001', 'verify:10000000-0000-4000-8000-000000000001']);
  }
});

test('overflow menu opens inline, lists remaining actions plus Manage Requests, and its target is 48dp', () => {
  let managed = 0; const item = makeItem('m1', 'paused', 'pending');
  const { vm, calls } = viewModel({ items: [item] }); const h = harness();
  const request = () => ({ text: null, pending: false, error: null, onManage: () => { managed++; } });
  const render = () => h.render(dashboard, 'PropertyDashboardView', { viewModel: vm, requestActivity: request });
  const first = render(); const toggle = nodes(first).find(n => n.props?.accessibilityLabel?.startsWith('More actions for'))!;
  assert.equal(toggle.props.style.width, 48); assert.equal(toggle.props.style.height, 48); assert.equal(toggle.props.accessibilityState.expanded, false);
  assert.doesNotMatch(text(first), /Manage Requests/);
  toggle.props.onPress(); const open = render(); assert.match(text(open), /View Verification Status/); assert.match(text(open), /Manage Requests/);
  press(open, n => n.props?.accessibilityRole === 'button' && flat(n.props.children).includes('Manage Requests')); assert.equal(managed, 1);
  assert.doesNotMatch(text(render()), /Manage Requests/, 'menu closes after choosing');
  assert.deepEqual(calls, []);
});

// ---- Card: chips
test('status and verification chips come only from existing statuses', () => {
  assert.deepEqual(portfolioStatusChip(makeItem('1', 'draft')), { label: 'Draft', tone: 'neutral' });
  assert.deepEqual(portfolioStatusChip(makeItem('2', 'active')), { label: 'Published', tone: 'positive' });
  assert.deepEqual(portfolioStatusChip(makeItem('3', null)), { label: 'Not Listed', tone: 'neutral' });
  assert.deepEqual(portfolioVerificationChip(makeItem('4', 'draft', 'not_submitted')), { label: 'Ownership not verified', tone: 'attention' });
  assert.deepEqual(portfolioVerificationChip(makeItem('5', 'draft', 'approved')), { label: 'Property verified', tone: 'positive' });
  assert.deepEqual(portfolioVerificationChip(makeItem('6', 'draft', 'approved', { tier3: { identityBindingAvailable: false } as any })), { label: 'Approval history (identity check pending)', tone: 'attention' });
  assert.deepEqual(portfolioVerificationChip(makeItem('7', 'draft', 'pending')), { label: 'Verification pending', tone: 'neutral' });
  assert.deepEqual(portfolioVerificationChip(makeItem('8', 'draft', 'under_review')), { label: 'Verification under review', tone: 'neutral' });
  for (const status of ['rejected', 'cancelled', 'revoked']) assert.equal(portfolioVerificationChip(makeItem('9', 'draft', status)).tone, 'attention');
  assert.deepEqual(portfolioVerificationChip(makeItem('10', 'draft', 'approved', { tier3: { requiresRepair: true } as any })), { label: 'Identity data repair required', tone: 'attention' });
});

test('card renders both chips, rent and a checkmark only for a verified property', () => {
  const h = harness(); const render = (item: LandlordPortfolioItem) => text(h.render(cardPath, 'PortfolioRentalCard', { item, disabled: false, onAction() {} }));
  const verified = render(makeItem('v', 'active', 'approved')); assert.match(verified, /Published/); assert.match(verified, /✓ Property verified/); assert.match(verified, /9,999/);
  const unverified = render(makeItem('u', 'draft', 'not_submitted')); assert.match(unverified, /Draft/); assert.match(unverified, /Ownership not verified/); assert.doesNotMatch(unverified, /✓/);
});

// ---- Activity line
test('activity line lists only non-zero counts and is null when nothing needs attention', () => {
  const zero = { viewingsPending: 0, viewingsUpcoming: 0, reservationsPending: 0, reservationsApproved: 0 };
  assert.equal(requestActivityLine(zero), null);
  assert.deepEqual(requestActivityLine({ ...zero, reservationsApproved: 1 }), { text: '1 approved reservation', pending: false });
  assert.deepEqual(requestActivityLine({ ...zero, viewingsUpcoming: 2 }), { text: '2 upcoming viewings', pending: false });
  assert.deepEqual(requestActivityLine({ viewingsPending: 1, viewingsUpcoming: 0, reservationsPending: 2, reservationsApproved: 1 }), { text: '1 pending viewing, 2 pending reservations, 1 approved reservation', pending: true });
  assert.doesNotMatch(requestActivityLine({ ...zero, viewingsPending: 3 })!.text, /\b0\b/);
  assert.equal(requestSummary({ propertyId: 'p', listings: [] }, owner, [], []), 'Viewings: 0 pending, 0 upcoming. Reservations: 0 pending, 0 approved.', 'legacy summary string is unchanged');
});

test('card renders no activity line for zero activity, a quiet line for non-pending, and an accented line only when pending', () => {
  const item = makeItem('r', 'active'); const h = harness();
  const render = (request: any) => h.render(cardPath, 'PortfolioRentalCard', { item, disabled: false, onAction() {}, request });
  const dot = (tree: Node) => nodes(tree).some(n => n.props?.accessible === false && n.props?.style?.width === 8 && n.props?.style?.height === 8);
  for (const request of [undefined, null, { text: null, pending: false, error: null, onManage() {} }]) {
    const tree = render(request); assert.doesNotMatch(text(tree), /pending|upcoming|approved|Requests|\b0\b/i); assert.equal(dot(tree), false);
  }
  const quiet = render({ text: '1 approved reservation', pending: false, error: null, onManage() {} });
  assert.match(text(quiet), /1 approved reservation/); assert.match(text(quiet), /Requests/); assert.equal(dot(quiet), false);
  const pending = render({ text: '2 pending reservations', pending: true, error: null, onManage() {} });
  assert.match(text(pending), /2 pending reservations/); assert.equal(dot(pending), true);
  const failed = render({ text: null, pending: false, error: 'Request counts unavailable. Open Manage Requests to retry.', onManage() {} });
  assert.match(text(failed), /Request counts unavailable/); assert.equal(dot(failed), false);
});

// ---- Layout and text scaling
test('card row stacks at narrow widths and large text, and keeps full text without line limits', () => {
  const item = makeItem('n', 'active', 'not_submitted', { title: 'A very long rental title that must remain fully readable' });
  const row = (viewport: any) => nodes(harness(viewport).render(cardPath, 'PortfolioRentalCard', { item, disabled: false, onAction() {} })).find(n => Array.isArray(n.props?.style) && n.props.style.some((s: any) => s?.flexDirection === 'row' && s?.gap === 12));
  assert.ok(row({ width: 411, height: 900, fontScale: 1 }).props.style.every((s: any) => s?.flexDirection !== 'column'));
  assert.ok(row({ width: 320, height: 640, fontScale: 1.5 }).props.style.some((s: any) => s?.flexDirection === 'column'));
  const source = readFileSync(cardPath, 'utf8') + readFileSync('src/features/property-listing/components/PortfolioFilterTabs.tsx', 'utf8');
  assert.doesNotMatch(source, /numberOfLines|ellipsizeMode|allowFontScaling=\{false\}|maxFontSizeMultiplier/);
  assert.match(text(harness().render(cardPath, 'PortfolioRentalCard', { item, disabled: false, onAction() {} })), /A very long rental title that must remain fully readable/);
});

test('new My Rentals styling reuses theme tokens and introduces no hardcoded colors', () => {
  for (const file of [cardPath, dashboard, 'src/features/property-listing/components/PortfolioFilterTabs.tsx']) assert.doesNotMatch(readFileSync(file, 'utf8'), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, file);
});
