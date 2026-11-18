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

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = U(1);
function makeItem(id: string, status: string | null, active = true): LandlordPortfolioItem {
  const listing = status ? { id: `l-${id}`, property_id: id, title: `Rental ${id}`, status, asking_rent_monthly: 9999, completeness_score: 1, published_at: null, available_from: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } : null;
  return { propertyId: id, property: { id, landlord_id: owner, property_type: 'house', city: 'imus', barangay: 'B', is_active: active }, listings: listing ? [listing] : [], currentListing: listing, coverPhoto: null, tier3: { status: 'approved', submissionId: null, updatedAt: null } } as any;
}
const labels = (item: LandlordPortfolioItem) => { const l = portfolioCardLayout(item); return [l.primary.label, l.secondary, l.menu.map(a => a.label)]; };

// ---- A. Archived listing
test('archived listing on an active property: the primary action is "List again" and View listing moves to the menu', () => {
  const a = portfolioCardActions(makeItem('p', 'archived'));
  assert.deepEqual([a.primary.key, a.primary.label], ['createListing', 'List again']);
  assert.deepEqual(labels(makeItem('p', 'archived')), ['List again', null, ['View listing', 'Edit property details']]);
});
test('archived: one-line explanation, only where the new-listing action is offered', () => {
  assert.equal(ARCHIVED_LISTING_NOTE, 'This listing has ended. Its reviews and rating stay with this property.');
  assert.equal(portfolioArchivedNote(makeItem('p', 'archived')), ARCHIVED_LISTING_NOTE);
  for (const status of ['draft', 'active', 'paused', 'rented', 'removed', null]) assert.equal(portfolioArchivedNote(makeItem('p', status)), null, String(status));
  assert.equal(portfolioArchivedNote(makeItem('p', 'archived', false)), null, 'an inactive property cannot take a new listing');
});
test('archived on an inactive property keeps the old primary action (nothing to create)', () => {
  assert.equal(portfolioCardActions(makeItem('p', 'archived', false)).primary.label, 'View listing');
});
test('one button per state: paused, active, rented and removed Manage, draft Continue editing, none Continue posting', () => {
  assert.equal(portfolioCardActions(makeItem('p', 'paused')).primary.label, 'Manage');
  assert.equal(portfolioCardActions(makeItem('p', 'active')).primary.label, 'Manage');
  assert.equal(portfolioCardActions(makeItem('p', 'draft')).primary.label, 'Continue editing');
  assert.equal(portfolioCardActions(makeItem('p', null)).primary.label, 'Create listing');
  assert.equal(portfolioCardActions(makeItem('p', 'removed')).primary.label, 'Manage');
  assert.equal(portfolioCardActions(makeItem('p', 'rented')).primary.label, 'Manage');
  for (const status of ['draft', 'active', 'paused', 'rented', 'removed', null]) assert.notEqual(portfolioCardActions(makeItem('p', status)).primary.key, 'createListing', String(status));
});
test('Reactivate stays for paused only: an archived listing has no lifecycle action to reactivate', () => {
  assert.ok(lifecycleActions('paused').includes('reactivate'));
  assert.ok(!lifecycleActions('archived').includes('reactivate'));
  const every = ['archived', 'removed', 'rented', 'draft'].flatMap(s => portfolioCardLayout(makeItem('p', s)).menu.map(a => a.label));
  assert.ok(!every.some(l => /reactivate/i.test(l)), 'no card offers Reactivate');
});
test('"List again" opens the SAME property at the Listing step with no listing id, and only for an archived listing on an active property', () => {
  const item = makeItem('prop-1', 'archived');
  const t = newListingTarget(item)!;
  assert.deepEqual([t.listingId, t.mode, t.screen, t.history], [null, 'compose', 'listingDetails', ['dashboard', 'listingComposer']]);
  assert.equal(t.item.propertyId, 'prop-1'); assert.equal(t.item.property.id, 'prop-1'); assert.equal(t.item.currentListing, null);
  assert.equal(t.item.listings.length, 1, 'the archived row stays in the list, it is just not the one being edited');
  assert.equal(item.currentListing!.status, 'archived', 'the original item is not mutated');
  for (const status of ['draft', 'active', 'paused', 'rented', 'removed']) assert.equal(newListingTarget(makeItem('p', status)), null, String(status));
  assert.equal(newListingTarget(makeItem('p', null))!.screen, 'listingDetails', 'a property with no listing can start one too (Continue posting)');
  const atProperty = newListingTarget(item, 'property')!;
  assert.deepEqual([atProperty.screen, atProperty.history, atProperty.listingId, atProperty.mode], ['listingComposer', ['dashboard'], null, 'compose'], 'Edit property details on an ended listing opens Step 1');
  assert.equal(newListingTarget(makeItem('p', 'archived', false)), null);
  assert.equal(newListingTarget(null), null); assert.equal(newListingTarget(undefined), null);
});
test('the dashboard routes the new-listing action to the ViewModel with the card\'s property id, and the ViewModel opens it as a fresh listing', () => {
  const dash = readFileSync('src/features/property-listing/views/PropertyDashboardView.tsx', 'utf8');
  assert.match(dash, /else if \(key === 'createListing'\) vm\.createListingForProperty\(propertyId\);/);
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /createListingForProperty:\(id:string\)=>\{if\(operationBusy\(\)\)return;requestNavigation\(\(\)=>openPortfolioItem\(id,false,false,'details'\),true\);\}/);
  assert.match(vm, /fresh=newListing\?newListingTarget\(picked,newListing\):null;\s*if\(newListing&&!fresh\)\{setNotice\(relistBlockedMessage\(picked\)[^;]*;return;\}/); // a blocked relist says why; it is never a silent return
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

test('archived card shows the explanation once and a List again button that runs the new-listing action', () => {
  const calls: string[] = [];
  const tree = harness({}).render('src/features/property-listing/components/PortfolioRentalCard.tsx', 'PortfolioRentalCard', { item: makeItem('p', 'archived'), disabled: false, onAction: (k: string) => calls.push(k) });
  assert.equal(text(tree).split(ARCHIVED_LISTING_NOTE).length - 1, 1);
  nodes(tree).find(byText('List again'))!.props.onPress();
  assert.deepEqual(calls, ['createListing']);
  assert.ok(!nodes(tree).some(byText('Reactivate')) && !/Reactivate/.test(text(tree)));
  const paused = text(harness({}).render('src/features/property-listing/components/PortfolioRentalCard.tsx', 'PortfolioRentalCard', { item: makeItem('p', 'paused'), disabled: false, onAction() {} }));
  assert.ok(!paused.includes(ARCHIVED_LISTING_NOTE) && !paused.includes('List again'));
});
// The cancelled-rental behavior (one card under Past, Start a new request / Release it, the confirmation sheet) is covered in tenancyScreens.test.ts.

import { relistBlockedMessage, relistDraft, startsNewListing } from '../src/features/property-listing/models/PortfolioCardPresentation';
import { emptyListingDraft } from '../src/features/property-listing/models/PropertyListing';
test('relistDraft fills the new draft from the ended listing and leaves the availability date blank', () => {
  const old = { ...makeItem('p', 'archived').currentListing!, title: 'Old title', description: 'Old description', asking_rent_monthly: 12500, house_rules: 'No smoking', rental_term: 'short_term', security_deposit_months: 2, advance_rent_months: 3, minimum_stay_months: 6, available_from: '2026-11-03' } as any;
  const d = relistDraft(emptyListingDraft, old);
  assert.deepEqual([d.title, d.description, d.askingRent, d.rentalTerm, d.securityDepositMonths, d.advanceRentMonths, d.minimumStayMonths, d.availableDate], ['Old title', 'Old description', '12500', 'short_term', '2', '3', '6', '']);
  assert.match(d.houseRules, /No smoking/); assert.equal(relistDraft(emptyListingDraft, null), emptyListingDraft);
});
test('relistBlockedMessage names the reason in plain words; null only where a new listing can start', () => {
  assert.equal(relistBlockedMessage(makeItem('p', 'archived')), null); assert.equal(relistBlockedMessage(makeItem('p', null)), null);
  assert.match(relistBlockedMessage(makeItem('p', 'archived', false))!, /inactive/); assert.match(relistBlockedMessage(makeItem('p', 'removed'))!, /removed after a review/);
  for (const status of ['active', 'paused', 'rented', 'draft']) assert.match(relistBlockedMessage(makeItem('p', status))!, /already has a current listing/, status);
  assert.match(relistBlockedMessage(null)!, /could not be found/);
});
test('a compose workspace with no listing id starts a NEW listing; every other workspace names its listing', () => {
  assert.equal(startsNewListing({ mode: 'compose', listingId: null }), true);
  assert.equal(startsNewListing({ mode: 'compose', listingId: 'l-1' }), false); assert.equal(startsNewListing({ mode: 'manage', listingId: 'l-1' }), false);
  assert.equal(startsNewListing({ mode: 'editPublished', listingId: 'l-1' }), false); assert.equal(startsNewListing({ mode: 'none', listingId: null }), false);
});
test('relistDraft with an incomplete listing row copies only what exists and never writes undefined into the form', () => {
  const d = relistDraft(emptyListingDraft, { id: 'l', property_id: 'p', status: 'archived' } as any);
  assert.deepEqual([d.title, d.description, d.askingRent, d.rentalTerm, d.securityDepositMonths, d.advanceRentMonths, d.availableDate], [emptyListingDraft.title, emptyListingDraft.description, emptyListingDraft.askingRent, emptyListingDraft.rentalTerm, emptyListingDraft.securityDepositMonths, emptyListingDraft.advanceRentMonths, '']);
  for (const value of Object.values(d)) assert.notEqual(value, undefined);
});
