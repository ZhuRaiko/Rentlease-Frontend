/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { filterPortfolioByStatus, portfolioFilterCounts, type LandlordPortfolioItem } from '../src/features/property-listing/models/LandlordPortfolio';
import { cardChips, cardLine, draftLine, emptyFacts, lifecycleSegments, managementPill, needsYou, onlyNeedingYou, portfolioSummary, stayDates, type ManagedFacts, type PropertyManagementPort } from '../src/features/property-listing/models/PropertyManagement';

// ---- Fixtures
const owner = '10000000-0000-4000-8000-000000000001';
function makeItem(id: string, status: string | null, extra: { title?: string } = {}): LandlordPortfolioItem {
  const listing = status ? { id: `l-${id}`, property_id: id, title: extra.title ?? `Rental ${id}`, status, asking_rent_monthly: 14500, completeness_score: 0.8, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } : null;
  return { propertyId: id, property: { id, landlord_id: owner, property_type: 'apartment', city: 'imus', barangay: 'Bayan Luma', is_active: true }, listings: listing ? [listing] : [], currentListing: listing, coverPhoto: null, tier3: { status: 'approved', submissionId: null, updatedAt: null } } as any;
}
const NOW = Date.parse('2026-11-16T10:00:00Z');
const stayFacts = (over: Partial<ManagedFacts> = {}): ManagedFacts => ({ ...emptyFacts(), stay: { tenancyId: 't1', tenantId: 'u2', tenantName: 'Samuel', startDate: '2026-11-12', endDate: '2026-12-12', rent: 10000, nextDue: '2026-12-02', conversationId: 'c1' }, ...over });
const urgent = { id: 'm1', title: 'Leaking faucet', createdAt: '2026-11-16T08:00:00Z' };

// ---- Summary and filters
test('summary counts occupied, vacant and what needs the landlord, and tiles use the same filters as the chips', () => {
  const items = [makeItem('a', 'rented'), makeItem('b', 'active'), makeItem('c', 'draft'), makeItem('d', 'paused')];
  const facts: Record<string, ManagedFacts> = {
    a: stayFacts({ maintenance: { open: 1, urgent: [urgent] }, endRequest: { tenancyId: 't1', fromTenant: true } }),
    b: { ...emptyFacts(), reservations: [{ id: 'r1', conversationId: 'c2', applicantName: null, moveInDate: '2026-11-25', endDate: '2026-12-25', applicantTier1: true }] },
  };
  const s = portfolioSummary(items, id => facts[id], NOW);
  assert.deepEqual(s, { occupied: 1, vacant: 1, needYou: 3 });
  assert.equal(filterPortfolioByStatus(items, 'rented').length, s.occupied, 'Occupied tile and chip agree');
  assert.equal(filterPortfolioByStatus(items, 'published').length, s.vacant, 'Vacant tile and Listed chip agree');
  assert.deepEqual(portfolioFilterCounts(items), { all: 4, published: 1, drafts: 1, rented: 1, unlisted: 0 });
  assert.deepEqual(onlyNeedingYou(items, id => facts[id], NOW).map(i => i.propertyId), ['a', 'b']);
});

test('summary shows zeros, not guesses, when nothing could be read', () => {
  assert.deepEqual(portfolioSummary([makeItem('a', 'rented')], () => undefined, NOW), { occupied: 1, vacant: 0, needYou: 0 });
  assert.deepEqual(onlyNeedingYou([makeItem('a', 'rented')], () => undefined, NOW), []);
});

// ---- Needs you
test('Needs you is assembled in a fixed order from urgent repairs, the tenant early-end request, setup and reservation requests', () => {
  const facts = stayFacts({ maintenance: { open: 2, urgent: [urgent] }, endRequest: { tenancyId: 't1', fromTenant: true }, setup: { tenancyId: 't2' }, reservations: [{ id: 'r1', conversationId: 'c2', applicantName: 'Em Cee', moveInDate: '2026-11-25', endDate: '2026-12-25', applicantTier1: true }] });
  const items = needsYou(facts, NOW);
  assert.deepEqual(items.map(i => [i.chip, i.tone, i.text, i.target.kind]), [
    ['Urgent', 'danger', 'Leaking faucet reported 2h ago', 'care'],
    ['Reply', 'attention', "Samuel's early-end request", 'lifecycle'],
    ['Setup', 'attention', 'Tenancy setup is waiting for confirmation', 'setup'],
    ['Request', 'attention', 'Em Cee asked to reserve', 'requests'],
  ]);
  assert.deepEqual(items[0]!.target, { kind: 'care', tenancyId: 't1' });
});

test('Needs you leaves out what does not wait on the landlord: normal repairs, an end request the landlord made, and an empty read', () => {
  assert.deepEqual(needsYou(stayFacts({ maintenance: { open: 3, urgent: [] }, endRequest: { tenancyId: 't1', fromTenant: false } }), NOW), []);
  assert.deepEqual(needsYou(emptyFacts(), NOW), []);
  // An urgent repair needs a tenancy to open; without one it is not offered as a row that goes nowhere.
  assert.deepEqual(needsYou({ ...emptyFacts(), maintenance: { open: 1, urgent: [urgent] } }, NOW), []);
});

// ---- Cards: one line, chips, pill
test('card line and chips appear only for data that was read', () => {
  const occupied = makeItem('a', 'rented');
  assert.equal(cardLine(occupied, stayFacts()), 'Samuel · rent due Dec 2');
  assert.equal(cardLine(occupied, stayFacts({ stay: { ...stayFacts().stay!, tenantName: null, nextDue: null } })), 'Tenant');
  assert.equal(cardLine(occupied, emptyFacts()), null, 'no tenancy read, no line');
  assert.equal(cardLine(makeItem('b', 'active'), stayFacts()), null, 'a listed card has no tenant line');
  assert.deepEqual(cardChips(occupied, stayFacts({ maintenance: { open: 1, urgent: [] }, endRequest: { tenancyId: 't1', fromTenant: true } })).map(c => c.label), ['1 maintenance', 'Ending request']);
  assert.deepEqual(cardChips(occupied, stayFacts()), []);
  assert.deepEqual(cardChips(makeItem('b', 'active'), stayFacts({ maintenance: { open: 4, urgent: [] } })), [], 'maintenance chip is for occupied cards only');
  assert.equal(managementPill(occupied).label, 'Occupied');
  assert.deepEqual([managementPill(makeItem('b', 'active')), managementPill(makeItem('c', 'paused')), managementPill(makeItem('d', null))].map(p => `${p.label}:${p.tone}`), ['Listed:info', 'Paused:attention', 'No listing yet:neutral']);
  assert.equal(draftLine(makeItem('c', 'draft')), 'Draft · 80% complete');
  assert.equal(draftLine(makeItem('b', 'active')), null);
});

test('stay dates are the recorded dates; a missing end date reads From', () => {
  assert.equal(stayDates(stayFacts().stay!), 'Nov 12 – Dec 12');
  assert.equal(stayDates({ ...stayFacts().stay!, endDate: null }), 'From Nov 12');
});

// ---- Listing status segments keep the lifecycleActions rules
test('Listed / Paused / Archived follow lifecycleActions exactly and explain every disabled state', () => {
  const ops = (status: any, occupied = false) => lifecycleSegments(status, occupied).segments.map(s => [s.key, s.selected, s.operation]);
  assert.deepEqual(ops('active'), [['listed', true, null], ['paused', false, 'pause'], ['archived', false, 'archive']]);
  assert.deepEqual(ops('paused'), [['listed', false, 'reactivate'], ['paused', true, null], ['archived', false, 'archive']]);
  assert.equal(lifecycleSegments('active', false).reason, null);
  for (const status of ['rented', 'archived', 'removed', 'draft'] as const) {
    const { segments, reason } = lifecycleSegments(status, false);
    assert.ok(segments.every(s => s.operation === null), status); assert.ok(reason && reason.length > 0, status);
  }
  // A tenancy beats the listing status: pause and archive stay off while it is active.
  const occupied = lifecycleSegments('active', true);
  assert.ok(occupied.segments.every(s => s.operation === null)); assert.match(occupied.reason!, /while a tenancy is active/);
});

// ---- Manage screen rendering (real .tsx, function components expanded)
function harness() {
  const states: any[] = []; let cursor = 0; const cache = new Map<string, any>();
  const useState = (initial: any) => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; };
  const native: any = { StyleSheet: { create: (s: any) => s }, useWindowDimensions: () => ({ width: 411, height: 900, fontScale: 1 }), Platform: { OS: 'android' } };
  for (const name of ['Image', 'Modal', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'TextInput', 'View', 'ActivityIndicator']) native[name] = name;
  const load = (absolute: string): any => {
    if (cache.has(absolute)) return cache.get(absolute);
    const actual = createRequire(absolute), mod = { exports: {} as any }; cache.set(absolute, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState, useEffect: () => {} };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (name.endsWith('ManagePriceCheck')) return { ManagePriceCheck: 'PriceCheck' };
      if (name.endsWith('PublicIdentityBadge')) return { PublicIdentityBadge: 'Badge' };
      if (name.startsWith('.')) { const target = resolve(dirname(absolute), name); if (existsSync(target + '.tsx')) return load(target + '.tsx'); }
      return actual(name);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
    cache.set(absolute, mod.exports); return mod.exports;
  };
  const expand = (node: any): any => {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  return { render: (path: string, name: string, props: any) => { cursor = 0; return expand(load(resolve(path))[name](props)); } };
}
const flat = (node: any): any[] => Array.isArray(node) ? node.flatMap(flat) : node && typeof node === 'object' ? [node, ...flat(node.props?.children)] : typeof node === 'string' ? [node] : [];
const text = (tree: any) => flat(tree).filter(n => typeof n === 'string').join(' ');
const nodes = (tree: any) => flat(tree).filter(n => typeof n === 'object');
const byText = (label: string) => (n: any) => typeof n.props?.onPress === 'function' && flat(n.props.children).includes(label);
const labelled = (label: string) => (n: any) => n.props?.accessibilityLabel === label;
const MANAGE = 'src/features/property-listing/views/ManagePropertyView.tsx';

function manage(status: string, facts: ManagedFacts, over: { reviews?: { average: number; count: number } | null; decline?: PropertyManagementPort['decline'] } = {}) {
  const item = makeItem('p1', status, { title: 'Garcia Apartment' }), calls: any[] = [];
  const vm: any = {
    portfolioState: { items: [item] }, workspacePropertyId: 'p1', realListing: item.currentListing, notice: null,
    lifecycleState: { confirmation: null, error: null, busy: false }, lifecycleBlocked: false, lifecycleLabel: { pause: 'Pause listing', reactivate: 'Reactivate listing', archive: 'Archive listing' },
    lifecycle: { request: (op: string) => calls.push(`request:${op}`), confirm() {}, cancel() {} },
    goBack() {}, goDashboard() {}, editManagedListing: () => calls.push('editListing'), editPortfolioPropertyDetails: (id: string) => calls.push(`editDetails:${id}`), estimationProperty: null,
  };
  const management: PropertyManagementPort = {
    factsOf: () => facts, loading: false, error: null, refresh: () => calls.push('refresh'),
    openTarget: (id, target) => calls.push(`target:${target.kind}`), openTenancy: (id, panel) => calls.push(`tenancy:${id}:${panel ?? ''}`), message: id => calls.push(`message:${id}`),
    reviewRequests: i => calls.push(`requests:${i.propertyId}`), loadReviews() {}, decline: over.decline ?? (async () => null),
    reviewsFor: () => over.reviews ?? null,
  };
  const h = harness();
  return { calls, render: () => h.render(MANAGE, 'ManagePropertyView', { viewModel: vm, management, accountId: owner }) };
}
const press = (tree: any, predicate: (n: any) => boolean) => { const node = nodes(tree).find(predicate); assert.ok(node, 'target element not found'); node.props.onPress(); };

test('Manage (occupied): tenant, real stay dates, next rent only, and no payment actions', () => {
  const { render, calls } = manage('rented', stayFacts({ maintenance: { open: 1, urgent: [] } }), { reviews: { average: 4.6, count: 5 } });
  const tree = render(), t = text(tree);
  assert.match(t, /Current tenant/); assert.match(t, /Samuel/); assert.match(t, /Nov 12 – Dec 12/); assert.match(t, /Next Dec 2/);
  assert.doesNotMatch(t, /Mark received|I've paid|Not received|ID verified|stays\b/, 'payments are Feature 3, checks and ratings Feature 5');
  assert.doesNotMatch(t, /Needs you/, 'nothing waits, so no Needs you card');
  assert.match(t, /1 open/); assert.match(t, /★ 4\.6 · 5 reviews/);
  press(tree, labelled('Message Samuel')); press(tree, labelled('Open tenancy'));
  press(tree, labelled('Maintenance. 1 open'));
  assert.deepEqual(calls, ['message:c1', 'tenancy:t1:', 'tenancy:t1:care']);
});

test('Manage (occupied): Needs you appears only when something waits and each row opens its existing screen', () => {
  const { render, calls } = manage('rented', stayFacts({ maintenance: { open: 1, urgent: [urgent] }, endRequest: { tenancyId: 't1', fromTenant: true } }));
  const tree = render(); assert.match(text(tree), /Needs you · 2/);
  // The age is read from the real clock inside the View, so match the stable part of the label.
  press(tree, n => String(n.props?.accessibilityLabel ?? '').startsWith('Urgent: Leaking faucet reported ')); press(tree, labelled("Reply: Samuel's early-end request"));
  assert.deepEqual(calls.filter(c => c.startsWith('target')), ['target:care', 'target:lifecycle']);
});

test('Manage hides what could not be read: reviews tile, Edit details while occupied, and views and saved always', () => {
  const none = text(manage('rented', stayFacts()).render());
  assert.doesNotMatch(none, /Reviews/); assert.doesNotMatch(none, /Edit details/); assert.doesNotMatch(none, /Views this week|Saved/);
  const vacant = text(manage('active', emptyFacts()).render());
  assert.doesNotMatch(vacant, /Views this week|Saved|\bviews\b/i, 'no landlord-readable source exists for views or saves');
  assert.doesNotMatch(vacant, /reservation request/i, 'no waiting request, no card');
  assert.doesNotMatch(vacant, /Rating/, 'rating hidden until the review read answers');
  assert.match(text(manage('active', emptyFacts(), { reviews: { average: 0, count: 0 } }).render()), /No reviews yet/);
});

test('Manage (vacant): waiting request with Review request and a confirmed Decline that uses the existing action', async () => {
  const declined: string[][] = [];
  const facts: ManagedFacts = { ...emptyFacts(), reservations: [{ id: 'r1', conversationId: 'c2', applicantName: 'Em Cee', moveInDate: '2026-11-25', endDate: '2026-12-25', applicantTier1: true }] };
  const { render, calls } = manage('active', facts, { decline: async (p, r) => { declined.push([p, r]); return null; } });
  let tree = render(); assert.match(text(tree), /1 reservation request is waiting/); assert.match(text(tree), /Em Cee/); assert.match(text(tree), /Nov 25 – Dec 25/);
  assert.doesNotMatch(text(tree), /ID verified|stays\b/);
  press(tree, byText('Review request')); assert.deepEqual(calls.filter(c => c.startsWith('requests')), ['requests:p1']);
  press(tree, labelled('Decline request from Em Cee')); tree = render();
  assert.match(text(tree), /Decline this request\?/); assert.deepEqual(declined, [], 'a tap alone declines nothing');
  press(tree, byText('Keep request')); tree = render(); assert.doesNotMatch(text(tree), /Decline this request\?/);
  press(tree, labelled('Decline request from Em Cee')); tree = render(); press(tree, byText('Decline request'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(declined, [['p1', 'r1']]); assert.ok(calls.includes('refresh'));
});

test('Manage (vacant): a failed decline keeps the confirmation open with one sentence', async () => {
  const facts: ManagedFacts = { ...emptyFacts(), reservations: [{ id: 'r1', conversationId: 'c2', applicantName: null, moveInDate: '2026-11-25', endDate: '2026-12-25', applicantTier1: false }] };
  const { render } = manage('active', facts, { decline: async () => 'This request is no longer available.' });
  let tree = render(); press(tree, byText('Decline')); tree = render(); press(tree, byText('Decline request'));
  await new Promise(resolve => setTimeout(resolve, 0)); tree = render();
  assert.match(text(tree), /no longer available/); assert.match(text(tree), /Decline this request\?/);
});

test('Manage: the segmented control sends the lifecycle operation and disables itself while a tenancy is active', () => {
  const live = manage('active', emptyFacts()), tree = live.render();
  assert.equal(nodes(tree).find(labelled('Listed'))!.props.accessibilityState.selected, true);
  press(tree, labelled('Paused')); press(tree, labelled('Archived'));
  assert.deepEqual(live.calls, ['request:pause', 'request:archive']);
  assert.match(text(tree), /Paused listings are hidden from search/);
  const rented = manage('rented', stayFacts()), rentedTree = rented.render();
  assert.ok(['Listed', 'Paused', 'Archived'].every(label => nodes(rentedTree).find(labelled(label))!.props.disabled === true));
  assert.match(text(rentedTree), /Pause and archive are unavailable while a tenancy is active/);
});

test('Manage: the price check is not drawn for an occupied property and edit tiles follow the listing rules', () => {
  assert.ok(!nodes(manage('rented', stayFacts()).render()).some(n => n.type === 'PriceCheck'));
  const vacant = manage('active', emptyFacts()), tree = vacant.render();
  assert.ok(nodes(tree).some(n => n.type === 'PriceCheck'));
  press(tree, labelled('Edit listing. Photos, price, info')); assert.deepEqual(vacant.calls, ['editListing']);
  assert.ok(!nodes(manage('archived', emptyFacts()).render()).some(labelled('Edit listing. Photos, price, info')), 'an archived listing offers no edit');
});

// ---- Source rules for the new files
test('new management files use theme tokens, no hardcoded colors, and never call a backend client from a View', () => {
  for (const file of [MANAGE, 'src/features/property-listing/components/ManagePriceCheck.tsx', 'src/features/property-listing/models/PropertyManagement.ts']) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, file);
    assert.doesNotMatch(source, /getSupabaseClient|\.rpc\(|\.from\(/, file);
  }
});

// ---- Properties with no listing are not drafts
import { portfolioFilters, portfolioFilterEmptyText } from '../src/features/property-listing/models/LandlordPortfolio';
import { portfolioCardLayout } from '../src/features/property-listing/models/PortfolioCardPresentation';
import { isDraftCard, isUnlisted } from '../src/features/property-listing/models/PropertyManagement';

test('a property with no listing has its own filter and count and is never counted under Drafts', () => {
  const items = [makeItem('a', 'draft'), makeItem('b', null), makeItem('c', null), makeItem('d', 'active'), makeItem('e', 'archived')];
  assert.deepEqual(portfolioFilterCounts(items), { all: 5, published: 1, drafts: 1, rented: 0, unlisted: 2 });
  assert.deepEqual(filterPortfolioByStatus(items, 'unlisted').map(i => i.propertyId), ['b', 'c']);
  assert.deepEqual(filterPortfolioByStatus(items, 'drafts').map(i => i.propertyId), ['a']);
  assert.deepEqual(portfolioFilters.map(f => f.label), ['All', 'Occupied', 'Listed', 'Drafts', 'No listing']);
  assert.equal(portfolioFilterEmptyText.unlisted, 'Every property has a listing.');
  assert.deepEqual(portfolioFilterCounts([]), { all: 0, published: 0, drafts: 0, rented: 0, unlisted: 0 });
});

test('no-listing card model: chip "No listing yet", primary "Create listing" on the existing posting flow, and not a draft card', () => {
  const none = makeItem('b', null), draft = makeItem('a', 'draft');
  assert.deepEqual([isUnlisted(none), isDraftCard(none), isUnlisted(draft), isDraftCard(draft)], [true, false, false, true]);
  assert.deepEqual(managementPill(none), { label: 'No listing yet', tone: 'neutral' });
  const layout = portfolioCardLayout(none);
  assert.deepEqual([layout.primary.key, layout.primary.label], ['continuePosting', 'Create listing']);
  assert.equal(draftLine(none), null, 'no draft percentage for a property without a listing');
});

test('no-listing card renders the chip, the Create listing button and no Draft wording; a draft still renders as a draft', () => {
  const calls: string[] = [], h = harness(), card = 'src/features/property-listing/components/PortfolioRentalCard.tsx';
  const render = (item: LandlordPortfolioItem) => h.render(card, 'PortfolioRentalCard', { item, disabled: false, onAction: (k: string) => calls.push(k) });
  const tree = render(makeItem('b', null)), t = text(tree);
  assert.match(t, /No listing yet/); assert.match(t, /Create listing/); assert.doesNotMatch(t, /Draft|Continue posting/);
  assert.ok(nodes(tree).some(labelled('Status: No listing yet')));
  press(tree, byText('Create listing')); assert.deepEqual(calls, ['continuePosting']);
  const draft = text(render(makeItem('a', 'draft')));
  assert.match(draft, /Draft/); assert.match(draft, /Continue posting/); assert.doesNotMatch(draft, /No listing yet|Create listing/);
});

// ---- Back returns to the screen Manage was opened from
import { manageBack, nextOrigin, type ManageOrigin } from '../src/features/property-listing/models/PropertyManagement';

test('Back from Manage returns to Tenancy only for a Manage opened from Tenancy, and only until the list is shown again', () => {
  // Opened from Tenancy: pending while the list is still showing, shown once Manage appears, back goes to the origin.
  let origin: ManageOrigin = 'pending';
  origin = nextOrigin(origin, 'dashboard'); assert.equal(origin, 'pending', 'the open has not rendered yet: the origin survives the list frame');
  assert.equal(manageBack(origin, 'published'), 'origin');
  origin = nextOrigin(origin, 'published'); assert.equal(origin, 'shown'); assert.equal(manageBack(origin, 'published'), 'origin');
  // Edit listing and back to Manage keeps the origin.
  origin = nextOrigin(origin, 'listingComposer'); assert.equal(origin, 'shown');
  origin = nextOrigin(origin, 'published'); assert.equal(manageBack(origin, 'published'), 'origin');
  // Once the list is shown, a later Manage opened from the list goes back to the list.
  origin = nextOrigin(origin, 'dashboard'); assert.equal(origin, 'none');
  assert.equal(manageBack(origin, 'published'), 'list');
  // Opened from the list: never an origin. Other screens never use it.
  assert.equal(nextOrigin('none', 'published'), 'none'); assert.equal(manageBack('none', 'published'), 'list');
  assert.equal(manageBack('shown', 'listingComposer'), 'list');
});

test('the Manage header Back uses the given origin Back, and falls back to the ViewModel Back', () => {
  const item = makeItem('p1', 'active', { title: 'Garcia Apartment' }); const calls: string[] = [];
  const vm: any = { portfolioState: { items: [item] }, workspacePropertyId: 'p1', realListing: item.currentListing, notice: null, lifecycleState: { confirmation: null, error: null, busy: false }, lifecycleBlocked: false, lifecycleLabel: {}, lifecycle: {}, goBack: () => calls.push('vmBack'), goDashboard() {}, editManagedListing() {}, editPortfolioPropertyDetails() {}, estimationProperty: null };
  const management: PropertyManagementPort = { factsOf: () => emptyFacts(), loading: false, error: null, refresh() {}, openTarget() {}, openTenancy() {}, message() {}, reviewRequests() {}, loadReviews() {}, decline: async () => null, reviewsFor: () => null };
  const render = (onBack?: () => void) => harness().render(MANAGE, 'ManagePropertyView', { viewModel: vm, management, accountId: owner, onBack });
  press(render(() => calls.push('toTenancy')), labelled('Back')); press(render(), labelled('Back'));
  assert.deepEqual(calls, ['toTenancy', 'vmBack']);
});

test('the vacant Manage screen has no Back to My properties button (header Back stays); occupied keeps it', () => {
  assert.ok(!nodes(manage('active', emptyFacts()).render()).some(byText('Back to My properties')));
  assert.ok(nodes(manage('active', emptyFacts()).render()).some(labelled('Back')));
  assert.ok(nodes(manage('rented', stayFacts()).render()).some(byText('Back to My properties')));
});

// ---- Shared helpers moved out of tenancy keep their behavior
import { dateRange as sharedDateRange, dueLabel as sharedDueLabel, pesos as sharedPesos, ago as sharedAgo } from '../src/shared/utils/rentalDates';
import { CHIP_COLORS as sharedChipColors } from '../src/shared/theme/statusColors';
import { CHIP } from '../src/features/tenancy/models/TenancyPresentation';

test('shared date helpers and chip colors give the same output the tenancy screens had', () => {
  assert.equal(sharedDateRange('2026-11-12', '2026-12-12'), 'Nov 12 \u2013 Dec 12');
  assert.equal(sharedDateRange('2026-12-12', '2027-01-12'), 'Dec 12, 2026 \u2013 Jan 12, 2027');
  assert.equal(sharedDateRange('2026-11-12', null), 'From Nov 12');
  assert.equal(sharedDueLabel('2026-12-02', Date.parse('2026-11-16T04:00:00Z')), 'Dec 2 \u00b7 in 16 days');
  assert.equal(sharedPesos(10000), '\u20b110,000'); assert.equal(sharedPesos(null), '\u2014');
  assert.equal(sharedAgo('2026-11-16T08:00:00Z', Date.parse('2026-11-16T10:00:00Z')), '2h ago');
  for (const chip of Object.values(CHIP)) assert.ok(sharedChipColors[chip.tone], chip.label);
  assert.deepEqual(Object.keys(sharedChipColors).sort(), ['info', 'neutral', 'positive', 'restricted', 'urgent', 'warning']);
});

test('shared parts hold no tenancy imports, and the models hold no theme colors', () => {
  for (const file of ['src/shared/components/StatusParts.tsx', 'src/shared/components/DashboardIcon.tsx', 'src/shared/utils/rentalDates.ts', 'src/shared/models/StatusChip.ts', 'src/shared/theme/statusColors.ts']) assert.doesNotMatch(readFileSync(file, 'utf8'), /features\/tenancy|features\/property-listing/, file);
  for (const file of ['src/features/tenancy/models/TenancyPresentation.ts', 'src/features/property-listing/models/PropertyManagement.ts']) assert.doesNotMatch(readFileSync(file, 'utf8'), /theme\/colors|CHIP_COLORS|TILE_COLORS/, file);
  const manage = readFileSync(MANAGE, 'utf8') + readFileSync('src/features/property-listing/components/ManagePriceCheck.tsx', 'utf8') + readFileSync('src/features/property-listing/models/PropertyManagement.ts', 'utf8');
  assert.doesNotMatch(manage, /features\/tenancy/, 'property-listing imports nothing from the tenancy feature');
});
