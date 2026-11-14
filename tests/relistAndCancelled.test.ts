/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import type { LandlordPortfolioItem } from '../src/features/property-listing/models/LandlordPortfolio';
import { ARCHIVED_LISTING_NOTE, newListingTarget, portfolioArchivedNote, portfolioCardActions, portfolioCardLayout } from '../src/features/property-listing/models/PortfolioCardPresentation';
import { lifecycleActions } from '../src/features/property-listing/models/ListingLifecycle';
import { cancelledRentalNotice, cancelledRentals, cancelledSetupNotices, OPEN_CONVERSATION_LABEL, REQUEST_AGAIN_LABEL, RENTAL_CANCELLED_LINE } from '../src/features/tenancy/models/CancelledRentals';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = U(1);
function makeItem(id: string, status: string | null, active = true): LandlordPortfolioItem {
  const listing = status ? { id: `l-${id}`, property_id: id, title: `Rental ${id}`, status, asking_rent_monthly: 9999, completeness_score: 1, published_at: null, available_from: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } : null;
  return { propertyId: id, property: { id, landlord_id: owner, property_type: 'house', city: 'imus', barangay: 'B', is_active: active }, listings: listing ? [listing] : [], currentListing: listing, coverPhoto: null, tier3: { status: 'approved', submissionId: null, updatedAt: null } } as any;
}
const labels = (item: LandlordPortfolioItem) => { const l = portfolioCardLayout(item); return [l.primary.label, l.secondary?.label ?? null, l.menu.map(a => a.label)]; };

// ---- A. Archived listing
test('archived listing on an active property: the primary action is "Create a new listing" and View listing moves to the menu', () => {
  const a = portfolioCardActions(makeItem('p', 'archived'));
  assert.deepEqual([a.primary.key, a.primary.label], ['createListing', 'Create a new listing']);
  assert.deepEqual(labels(makeItem('p', 'archived')), ['Create a new listing', 'Edit Property', ['View listing']]);
});
test('archived: one-line explanation, only where the new-listing action is offered', () => {
  assert.equal(ARCHIVED_LISTING_NOTE, 'This listing has ended. Create a new one to rent this place again.');
  assert.equal(portfolioArchivedNote(makeItem('p', 'archived')), ARCHIVED_LISTING_NOTE);
  for (const status of ['draft', 'active', 'paused', 'rented', 'removed', null]) assert.equal(portfolioArchivedNote(makeItem('p', status)), null, String(status));
  assert.equal(portfolioArchivedNote(makeItem('p', 'archived', false)), null, 'an inactive property cannot take a new listing');
});
test('archived on an inactive property keeps the old primary action (nothing to create)', () => {
  assert.equal(portfolioCardActions(makeItem('p', 'archived', false)).primary.label, 'View listing');
});
test('nothing else changed: paused keeps Manage Status, draft Continue Editing, none Create listing, removed View status', () => {
  assert.equal(portfolioCardActions(makeItem('p', 'paused')).primary.label, 'Manage Status');
  assert.equal(portfolioCardActions(makeItem('p', 'active')).primary.label, 'Manage Status');
  assert.equal(portfolioCardActions(makeItem('p', 'draft')).primary.label, 'Continue Editing');
  assert.equal(portfolioCardActions(makeItem('p', null)).primary.label, 'Create listing');
  assert.equal(portfolioCardActions(makeItem('p', 'removed')).primary.label, 'View status');
  assert.equal(portfolioCardActions(makeItem('p', 'rented')).primary.label, 'View listing');
  for (const status of ['draft', 'active', 'paused', 'rented', 'removed', null]) assert.notEqual(portfolioCardActions(makeItem('p', status)).primary.key, 'createListing', String(status));
});
test('Reactivate stays for paused only: an archived listing has no lifecycle action to reactivate', () => {
  assert.ok(lifecycleActions('paused').includes('reactivate'));
  assert.ok(!lifecycleActions('archived').includes('reactivate'));
  const every = ['archived', 'removed', 'rented', 'draft'].flatMap(s => portfolioCardLayout(makeItem('p', s)).menu.map(a => a.label));
  assert.ok(!every.some(l => /reactivate/i.test(l)), 'no card offers Reactivate');
});
test('"Create a new listing" opens the SAME property at the Listing step with no listing id, and only for an archived listing on an active property', () => {
  const item = makeItem('prop-1', 'archived');
  const t = newListingTarget(item)!;
  assert.deepEqual([t.listingId, t.mode, t.screen, t.history], [null, 'compose', 'listingDetails', ['dashboard', 'listingComposer']]);
  assert.equal(t.item.propertyId, 'prop-1'); assert.equal(t.item.property.id, 'prop-1'); assert.equal(t.item.currentListing, null);
  assert.equal(t.item.listings.length, 1, 'the archived row stays in the list, it is just not the one being edited');
  assert.equal(item.currentListing!.status, 'archived', 'the original item is not mutated');
  for (const status of ['draft', 'active', 'paused', 'rented', 'removed', null]) assert.equal(newListingTarget(makeItem('p', status)), null, String(status));
  assert.equal(newListingTarget(makeItem('p', 'archived', false)), null);
  assert.equal(newListingTarget(null), null); assert.equal(newListingTarget(undefined), null);
});
test('the dashboard routes the new-listing action to the ViewModel with the card\'s property id, and the ViewModel opens it as a fresh listing', () => {
  const dash = readFileSync('src/features/property-listing/views/PropertyDashboardView.tsx', 'utf8');
  assert.match(dash, /else if \(key === 'createListing'\) vm\.createListingForProperty\(propertyId\);/);
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /createListingForProperty:\(id:string\)=>\{if\(operationBusy\(\)\)return;requestNavigation\(\(\)=>openPortfolioItem\(id,false,false,true\),true\);\}/);
  assert.match(vm, /fresh=newListing\?newListingTarget\(picked\):null;\s*if\(newListing&&!fresh\)return;/);
  assert.match(vm, /setScreen\(fresh\?fresh\.screen:'listingComposer'\)/);
});

// ---- Rendering helpers
function harness(stubs: Record<string, any>) {
  const native: any = { StyleSheet: { create: (s: any) => s, flatten: (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 411, height: 900, fontScale: 1 }) };
  for (const n of ['ActivityIndicator', 'Image', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'View']) native[n] = n;
  const cache = new Map<string, any>();
  const load = (abs: string): any => {
    if (cache.has(abs)) return cache.get(abs);
    const actual = createRequire(abs), mod = { exports: {} as any }; cache.set(abs, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState: (v: any) => [typeof v === 'function' ? v() : v, () => {}], useEffect: () => {} };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      for (const [k, v] of Object.entries(stubs)) if (name.endsWith(k)) return v;
      if (name.startsWith('.') && existsSync(resolve(dirname(abs), name) + '.tsx')) return load(resolve(dirname(abs), name) + '.tsx');
      return actual(name);
    };
    new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, mod, mod.exports);
    cache.set(abs, mod.exports); return mod.exports;
  };
  const expand = (n: any): any => Array.isArray(n) ? n.map(expand) : !n || typeof n !== 'object' ? n : typeof n.type === 'function' ? expand(n.type(n.props)) : { ...n, props: { ...n.props, children: expand(n.props?.children) } };
  return { render: (file: string, name: string, props: any) => expand(load(resolve(file))[name](props)) };
}
const flat = (n: any): any[] => Array.isArray(n) ? n.flatMap(flat) : n && typeof n === 'object' ? [n, ...flat(n.props?.children)] : typeof n === 'string' ? [n] : [];
const nodes = (t: any) => flat(t).filter(n => typeof n === 'object');
const text = (t: any) => flat(t).filter(n => typeof n === 'string').join('|');
const byText = (label: string) => (n: any) => typeof n.props?.onPress === 'function' && flat(n.props.children).includes(label);

test('archived card shows the explanation once and a Create a new listing button that runs the new-listing action', () => {
  const calls: string[] = [];
  const tree = harness({}).render('src/features/property-listing/components/PortfolioRentalCard.tsx', 'PortfolioRentalCard', { item: makeItem('p', 'archived'), disabled: false, onAction: (k: string) => calls.push(k) });
  assert.equal(text(tree).split(ARCHIVED_LISTING_NOTE).length - 1, 1);
  nodes(tree).find(byText('Create a new listing'))!.props.onPress();
  assert.deepEqual(calls, ['createListing']);
  assert.ok(!nodes(tree).some(byText('Reactivate')) && !/Reactivate/.test(text(tree)));
  const paused = text(harness({}).render('src/features/property-listing/components/PortfolioRentalCard.tsx', 'PortfolioRentalCard', { item: makeItem('p', 'paused'), disabled: false, onAction() {} }));
  assert.ok(!paused.includes(ARCHIVED_LISTING_NOTE) && !paused.includes('Create a new listing'));
});

// ---- B. Cancelled rentals
const tenancy = (id: string, status: string, over: any = {}) => ({ id, property_id: U(40), listing_id: U(41), conversation_id: U(42), tenant_id: U(10), landlord_id: U(11), status, start_date: '2026-12-01', expected_end_date: null, actual_end_date: null, ...over });
test('cancelled notice: the tenant can request again, the owner can open the conversation, and with no conversation there is no dead button', () => {
  assert.deepEqual(cancelledRentalNotice(U(10), U(10), U(11), U(42)), { line: 'This rental was cancelled', actionLabel: 'Request again', conversationId: U(42) });
  assert.deepEqual(cancelledRentalNotice(U(11), U(10), U(11), U(42)), { line: 'This rental was cancelled', actionLabel: 'Open conversation', conversationId: U(42) });
  assert.deepEqual(cancelledRentalNotice(U(10), U(10), U(11), null), { line: RENTAL_CANCELLED_LINE, actionLabel: null, conversationId: null });
  assert.equal(cancelledRentalNotice(U(10), U(10), U(11), '').actionLabel, null);
  assert.equal(cancelledRentalNotice(U(10), U(10), U(10), U(42)).actionLabel, OPEN_CONVERSATION_LABEL, 'never "request again" from your own listing');
  assert.equal(REQUEST_AGAIN_LABEL, 'Request again');
});
test('cancelled rentals: only cancelled tenancies of this person, none of the other states', () => {
  const all = [tenancy('c1', 'cancelled'), tenancy('a1', 'active'), tenancy('e1', 'ended'), tenancy('p1', 'proposed'), tenancy('pc', 'pending_confirmation'), tenancy('c2', 'cancelled', { tenant_id: U(20), landlord_id: U(21) })] as any[];
  assert.deepEqual(cancelledRentals(U(10), all).map(c => c.tenancy.id), ['c1'], 'tenant');
  assert.deepEqual(cancelledRentals(U(11), all).map(c => c.tenancy.id), ['c1'], 'owner');
  assert.deepEqual(cancelledRentals(U(99), all), [], 'a stranger');
  assert.equal(cancelledRentals(U(10), all)[0]!.notice.actionLabel, 'Request again');
  assert.equal(cancelledRentals(U(11), all)[0]!.notice.actionLabel, 'Open conversation');
});
const reservation = (id: string, over: any = {}) => ({ id, conversationId: U(60), tenantId: U(10), landlordId: U(11), ...over }) as any;
test('an approved reservation whose setup was cancelled carries the notice; one with a live tenancy, no link, or no links data does not', () => {
  const ts = [tenancy('t-cancelled', 'cancelled'), tenancy('t-live', 'pending_confirmation')] as any[];
  const links = [{ reservation_id: 'r-cancelled', tenancy_id: 't-cancelled' }, { reservation_id: 'r-live', tenancy_id: 't-live' }, { reservation_id: 'r-both', tenancy_id: 't-cancelled' }, { reservation_id: 'r-both', tenancy_id: 't-live' }];
  const rs = [reservation('r-cancelled'), reservation('r-live'), reservation('r-both'), reservation('r-unlinked')];
  const tenantView = cancelledSetupNotices(U(10), ts, rs, links);
  assert.deepEqual(Object.keys(tenantView), ['r-cancelled']);
  assert.deepEqual(tenantView['r-cancelled'], { line: 'This rental was cancelled', actionLabel: 'Request again', conversationId: U(60) });
  assert.equal(cancelledSetupNotices(U(11), ts, rs, links)['r-cancelled']!.actionLabel, 'Open conversation');
  assert.deepEqual(cancelledSetupNotices(U(10), ts, rs, null), {}, 'without link data nothing is inferred');
  assert.deepEqual(cancelledSetupNotices(U(99), ts, rs, links), {}, 'a stranger');
});

function workspaceTree(vmOver: any, opened: string[], withHandler = true) {
  const vm = { busy: false, error: null, contextWarning: null, contexts: {}, identities: {}, links: [], upcoming: [], pending: [], active: [], history: [], cancelled: [], cancelledSetups: {}, refresh() {}, ...vmOver };
  const stubs = {
    '/useTenancyWorkspaceViewModel': { useTenancyWorkspaceViewModel: () => vm },
    '/ScreenContainer': { ScreenContainer: 'Screen' }, '/ScreenHeader': { ScreenHeader: 'Header' }, '/RentLeaseBottomNavigation': { RentLeaseBottomNavigation: 'Nav' },
    '/PublicIdentityBadge': { PublicIdentityBadge: 'Identity' }, '/PropertyPhotoThumbnail': { PropertyPhotoThumbnail: 'Thumb' }, '/TenancyDashboardIcon': { TenancyDashboardIcon: 'Icon' },
    '/TenancyDetailsView': { TenancyDetailsView: 'Details' }, '/TenancySetupView': { TenancySetupView: 'Setup' },
  };
  return harness(stubs).render('src/features/tenancy/views/TenancyWorkspaceView.tsx', 'TenancyWorkspaceView', { accountId: U(10), onBack() {}, onMaintenance() {}, onDiscover() {}, onListings() {}, onPost() {}, onChat() {}, registerBackAction() {}, ...(withHandler ? { onOpenConversation: (id: string) => opened.push(id) } : {}) });
}
test('Tenancy tab: a cancelled rental shows the line and Request again (tenant) that opens its conversation; nothing renders when there is none', () => {
  const opened: string[] = [];
  const c = cancelledRentals(U(10), [tenancy('c1', 'cancelled')] as any[]);
  const tree = workspaceTree({ cancelled: c }, opened), t = text(tree);
  assert.ok(t.includes('Cancelled Rentals') && t.includes('This rental was cancelled'));
  nodes(tree).find(byText('Request again'))!.props.onPress();
  assert.deepEqual(opened, [U(42)]);
  assert.ok(!text(workspaceTree({}, [])).includes('Cancelled Rentals'));
  const owner = workspaceTree({ cancelled: cancelledRentals(U(11), [tenancy('c1', 'cancelled')] as any[]) }, opened);
  assert.ok(nodes(owner).some(byText('Open conversation')) && !nodes(owner).some(byText('Request again')));
});
test('Tenancy tab: an approved reservation with a cancelled setup shows the notice instead of the Establish/Review tenancy setup button', () => {
  const opened: string[] = [];
  const r = { id: 'r1', listingTitle: 'Garden Flat', tenantId: U(10), landlordId: U(11), moveInDate: '2026-12-01', endDate: '2027-06-01', conversationId: U(60) };
  const setups = { r1: cancelledRentalNotice(U(10), U(10), U(11), U(60)) };
  const tree = workspaceTree({ upcoming: [r], cancelledSetups: setups }, opened), t = text(tree);
  assert.ok(t.includes('This rental was cancelled') && !t.includes('Awaiting explicit tenancy setup'));
  assert.ok(!nodes(tree).some(byText('Review tenancy setup')) && !nodes(tree).some(byText('Establish tenancy')));
  nodes(tree).find(byText('Request again'))!.props.onPress(); assert.deepEqual(opened, [U(60)]);
  const normal = workspaceTree({ upcoming: [r] }, []);
  assert.ok(nodes(normal).some(byText('Review tenancy setup')) && text(normal).includes('Awaiting explicit tenancy setup'), 'a normal approved reservation is unchanged');
});

test('without a way to open a conversation the cancelled notice shows no button that would do nothing', () => {
  const tree = workspaceTree({ cancelled: cancelledRentals(U(10), [tenancy('c1', 'cancelled')] as any[]) }, [], false);
  assert.ok(text(tree).includes('This rental was cancelled'));
  assert.ok(!nodes(tree).some(byText('Request again')));
});
test('the Tenancy tab ViewModel hands the model\'s cancelled rentals and cancelled setups to the view', () => {
  const src = readFileSync('src/features/tenancy/viewModels/useTenancyWorkspaceViewModel.ts', 'utf8');
  assert.match(src, /cancelled:cancelledRentals\(actor\?\?'',safe\.tenancies\),cancelledSetups:cancelledSetupNotices\(actor\?\?'',safe\.tenancies,safe\.reservations,safe\.links\)/);
});
