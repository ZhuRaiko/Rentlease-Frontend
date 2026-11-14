/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import type { LandlordPortfolioItem } from '../src/features/property-listing/models/LandlordPortfolio';
import { portfolioCardLayout, portfolioStatusPill, portfolioVerificationRow } from '../src/features/property-listing/models/PortfolioCardPresentation';
import { deleteBlockedReason, deleteDialogBody, deleteDialogTitle, editorMenuItems, offersUnfinishedDelete, postingEditorMenu, unfinishedPostName } from '../src/features/property-listing/models/UnfinishedPostMenu';

// Same recursive render approach as myRentalsRefinement: real .tsx files, function components expanded, native parts as strings.
function harness(viewport = { width: 411, height: 900, fontScale: 1 }) {
  const states: any[] = []; let cursor = 0; const cache = new Map<string, any>();
  const useState = (initial: any) => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; };
  const native: any = { StyleSheet: { create: (s: any) => s }, useWindowDimensions: () => viewport, Platform: { OS: 'android' } };
  for (const name of ['Image', 'Modal', 'Pressable', 'RefreshControl', 'ScrollView', 'Text', 'TextInput', 'View']) native[name] = name;
  const load = (absolute: string): any => {
    if (cache.has(absolute)) return cache.get(absolute);
    const actual = createRequire(absolute), mod = { exports: {} as any }; cache.set(absolute, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (name.endsWith('KeyboardAwareScrollView')) return { KeyboardAwareScrollView: 'ScrollView' };
      if (name.endsWith('PinnedFooter')) return { pinnedFooterStyle: {}, PinnedFooterGap: 'View', PinnedFooterShell: 'View' };
      if (name.startsWith('.') && name.endsWith('.png')) return 1;
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
const text = (tree: any) => flat(tree).filter(n => typeof n === 'string').join('');
const nodes = (tree: any) => flat(tree).filter(n => typeof n === 'object');
const byText = (label: string) => (n: any) => typeof n.props?.onPress === 'function' && flat(n.props.children).includes(label);
const card = 'src/features/property-listing/components/PortfolioRentalCard.tsx';
const dashboard = 'src/features/property-listing/views/PropertyDashboardView.tsx';
const dialog = 'src/features/property-listing/components/UnfinishedPostDeletionAction.tsx';
const scaffold = 'src/features/property-listing/components/ListingWizardScaffold.tsx';

const owner = '10000000-0000-4000-8000-000000000001';
function makeItem(id: string, listingStatus: string | null, tier = 'approved', extra: { title?: string; cover?: boolean; published?: boolean; completeness?: number; tier3?: any } = {}): LandlordPortfolioItem {
  const listing = listingStatus ? { id: `l-${id}`, property_id: id, title: extra.title ?? `Rental ${id}`, status: listingStatus, asking_rent_monthly: 9999, completeness_score: extra.completeness ?? 0.5, published_at: extra.published ? '2026-01-01T00:00:00Z' : null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } : null;
  return { propertyId: id, property: { id, landlord_id: owner, property_type: 'house', city: 'imus', barangay: 'Bayan Luma', is_active: true }, listings: listing ? [listing] : [], currentListing: listing, coverPhoto: extra.cover ? { id: 'c', publicUrl: 'https://example.test/c.jpg' } : null, tier3: { status: tier, submissionId: null, updatedAt: null, ...(extra.tier3 ?? {}) } } as any;
}
const render = (props: any, viewport?: any) => harness(viewport).render(card, 'PortfolioRentalCard', { disabled: false, onAction() {}, ...props });
const ellipsis = '…';

// ---- Card decisions: which action is a button, the verification row, or a menu entry
test('verification is never a second button or a menu entry: it is the status row', () => {
  for (const tier of ['not_submitted', 'pending', 'under_review', 'rejected']) for (const status of ['draft', 'active', 'paused', 'rented', null]) {
    const layout = portfolioCardLayout(makeItem('x', status, tier));
    assert.ok(layout.secondary?.key !== 'verification' && !layout.menu.some(a => a.key === 'verification'), `${tier}/${status}`);
  }
});
test('a second button appears only when its label is short; otherwise the action moves to the menu', () => {
  assert.equal(portfolioCardLayout(makeItem('1', 'draft', 'approved', { completeness: 0.9 })).secondary?.label, 'Review Publication');
  assert.equal(portfolioCardLayout(makeItem('2', 'active', 'approved')).secondary?.label, 'Edit Rental');
  assert.equal(portfolioCardLayout(makeItem('3', null, 'approved')).secondary?.label, 'Edit Property');
  assert.equal(portfolioCardLayout(makeItem('4', 'draft', 'not_submitted')).secondary, null, 'only verification was available');
  const paused = portfolioCardLayout(makeItem('5', 'paused', 'approved', { tier3: {} }));
  assert.deepEqual([paused.primary.label, paused.secondary?.label], ['Manage Status', 'Edit Rental']);
});
test('primary label is Create listing only when there is no listing', () => {
  assert.equal(portfolioCardLayout(makeItem('1', null)).primary.label, 'Create listing');
  assert.equal(portfolioCardLayout(makeItem('2', 'draft')).primary.label, 'Continue Editing');
  assert.equal(portfolioCardLayout(makeItem('3', 'active')).primary.label, 'Manage Status');
  assert.equal(portfolioCardLayout(makeItem('4', 'removed')).primary.label, 'View status');
});
test('status pill tone: draft neutral, active green, paused amber, rented blue, removed red; labels unchanged', () => {
  const pill = (s: string | null) => portfolioStatusPill(makeItem('p', s));
  assert.deepEqual([pill('draft'), pill('active'), pill('paused'), pill('rented'), pill('removed'), pill(null)], [
    { label: 'Draft', tone: 'neutral' }, { label: 'Published', tone: 'positive' }, { label: 'Paused', tone: 'attention' }, { label: 'Rented', tone: 'info' }, { label: 'Removed', tone: 'danger' }, { label: 'Not Listed', tone: 'neutral' }]);
});
test('verification row: label and action for every tier 3 status and for repair', () => {
  const row = (tier: string, extra: any = {}) => portfolioVerificationRow(makeItem('v', 'draft', tier, { tier3: extra }));
  assert.deepEqual(row('not_submitted'), { label: 'Ownership not verified', tone: 'attention', actionLabel: 'Verify This Property' });
  assert.deepEqual(row('pending'), { label: 'Verification pending', tone: 'neutral', actionLabel: 'View Verification Status' });
  assert.deepEqual(row('under_review'), { label: 'Verification under review', tone: 'neutral', actionLabel: 'View Verification Status' });
  assert.equal(row('rejected').actionLabel, 'View Verification Feedback');
  assert.equal(row('rejected').tone, 'attention');
  assert.deepEqual(row('approved'), { label: 'Property verified', tone: 'positive', actionLabel: null });
  assert.deepEqual(row('approved', { requiresRepair: true }), { label: 'Identity data repair required', tone: 'attention', actionLabel: null });
  assert.equal(row('not_submitted', { requiresRepair: true }).actionLabel, null, 'repair is not a verification the owner can start');
});

// ---- Card rendering
test('card: pill and 48dp round overflow button sit on the cover; the verification row is one tappable row', () => {
  const calls: string[] = [];
  const tree = render({ item: makeItem('c1', 'paused', 'not_submitted', { cover: true }), onAction: (k: string) => calls.push(k), request: { text: null, pending: false, error: null, onManage() {} } });
  assert.ok(nodes(tree).some(n => n.type === 'Image' && n.props.style.height === 150 && n.props.style.width === '100%'), 'full-width 150dp cover');
  assert.match(text(tree), /Paused/);
  const more = nodes(tree).find(n => n.props?.accessibilityLabel?.startsWith('More actions for'))!;
  assert.deepEqual([more.props.style.width, more.props.style.height, more.props.style.borderRadius], [48, 48, 24]);
  nodes(tree).find(byText('Verify This Property'))!.props.onPress();
  assert.deepEqual(calls, ['verification']);
  assert.equal(nodes(tree).filter(n => n.type === 'Pressable' && flat(n.props.children).includes('Verify This Property')).length, 1, 'one verification control, not chip plus button');
  assert.ok(nodes(tree).find(byText('Verify This Property'))!.props.style.some((s: any) => s?.minHeight === 44));
});
test('card: no photo shows Add photos, which runs the same action as the primary button', () => {
  const calls: string[] = [];
  const tree = render({ item: makeItem('c2', 'draft', 'approved'), onAction: (k: string) => calls.push(k) });
  assert.doesNotMatch(text(render({ item: makeItem('c3', 'draft', 'approved', { cover: true }) })), /Add photos/);
  nodes(tree).find(byText('Add photos'))!.props.onPress(); nodes(tree).find(byText('Continue Editing'))!.props.onPress();
  assert.deepEqual(calls, ['open', 'open']);
});
test('card: price only with a listing; a short secondary action sits beside the primary one', () => {
  assert.match(text(render({ item: makeItem('c4', 'active') })), /9,999/);
  assert.doesNotMatch(text(render({ item: makeItem('c5', null) })), /month/);
  const tree = render({ item: makeItem('c6', 'active') });
  assert.deepEqual(['Manage Status', 'Edit Rental'].map(l => !!nodes(tree).find(byText(l))), [true, true]);
});
test('card: row stacks buttons at narrow widths and large text only', () => {
  const rowOf = (viewport: any) => nodes(render({ item: makeItem('c7', 'active') }, viewport)).find(n => Array.isArray(n.props?.style) && n.props.style.some((s: any) => s?.flexDirection === 'row' && s?.gap === 12))!;
  assert.ok(rowOf({ width: 411, height: 900, fontScale: 1 }).props.style.every((s: any) => s?.flexDirection !== 'column'));
  assert.ok(rowOf({ width: 320, height: 640, fontScale: 1.5 }).props.style.some((s: any) => s?.flexDirection === 'column'));
});

// ---- Delete: where it lives, what it says
const liveState = (over: any = {}) => ({ propertyId: 'a', status: { propertyId: 'a', state: 'live', eligible: true, reason: null }, busy: false, confirming: false, error: null, pending: [], ...over });
const dialogVm = (items: any[], extra: any = {}): any => ({ screen: 'dashboard', unfinishedPostState: liveState({ confirming: true }), workspacePropertyId: null, portfolioState: { items }, draft: {}, portfolioActionsDisabled: false, resumeUnfinishedPostCleanup() {}, unfinishedPost: { cancel() {} }, confirmUnfinishedPostDeletion() {}, ...extra });
test('dashboard renders no delete control; the shared dialog host has none either', () => {
  assert.doesNotMatch(readFileSync(dashboard, 'utf8'), /UnfinishedPostDeletionAction|Delete Unfinished Post/);
  const tree = harness().render(dialog, 'UnfinishedPostDeletionAction', { viewModel: dialogVm([makeItem('a', 'draft')], { unfinishedPostState: liveState() }) });
  assert.ok(!nodes(tree).some(n => n.type === 'Pressable' && n.props.accessibilityLabel === 'Delete Unfinished Post'));
  assert.ok(!nodes(tree).some(n => n.type === 'Pressable' && flat(n.props.children).includes('Delete Unfinished Post')));
});
test('card menu: delete is last, separated, red and only for a post that offers it; it calls the card handler', () => {
  let deleted = 0;
  const open = (deletion: any) => {
    const h = harness(); const r = () => h.render(card, 'PortfolioRentalCard', { item: makeItem('d1', 'draft', 'approved', { completeness: 0.9 }), disabled: false, onAction() {}, deletion, request: { text: null, pending: false, error: null, onManage() {} } });
    nodes(r()).find(n => n.props?.accessibilityLabel?.startsWith('More actions for'))!.props.onPress(); return r();
  };
  const withDelete = open({ onDelete: () => { deleted++; }, reason: null });
  const items = nodes(withDelete).filter(n => n.type === 'Pressable' && n.props.style?.minHeight === 48 && n.props.style?.justifyContent === 'center' && n.props.accessibilityRole === 'button');
  assert.equal(flat(items.at(-1)!.props.children).filter(x => typeof x === 'string').join(''), `Delete unfinished post${ellipsis}`);
  nodes(withDelete).find(byText(`Delete unfinished post${ellipsis}`))!.props.onPress(); assert.equal(deleted, 1);
  const label = nodes(withDelete).find(n => n.type === 'Text' && flat(n.props.children).includes(`Delete unfinished post${ellipsis}`))!;
  assert.ok(flat(label.props.style).some((s: any) => s && typeof s === 'object' && s.color), 'red text style');
  assert.ok(nodes(withDelete).some(n => n.type === 'View' && n.props.style?.height === 1), 'divider above delete');
  assert.doesNotMatch(text(open(null)), /Delete unfinished post/);
});
test('not allowed: the existing reason shows on the card once, and only for the checked post', () => {
  const reason = 'This post has an active reservation.';
  assert.equal(text(render({ item: makeItem('d2', 'draft'), deletion: { onDelete() {}, reason } })).split(reason).length - 1, 1);
  const blocked = { propertyId: 'a', status: { propertyId: 'a', state: 'live' as const, eligible: false, reason } };
  assert.equal(deleteBlockedReason(blocked, 'a'), reason);
  assert.equal(deleteBlockedReason(blocked, 'b'), null, 'another card shows nothing');
  assert.equal(deleteBlockedReason({ propertyId: 'a', status: { propertyId: 'a', state: 'live', eligible: true, reason: null } }, 'a'), null);
  assert.equal(deleteBlockedReason(undefined, 'a'), null);
  assert.equal(deleteBlockedReason({ propertyId: 'a', status: { propertyId: 'a', state: 'live', eligible: true, reason: 'stale text' } }, 'a'), null, 'eligible means no reason');
  assert.equal(deleteBlockedReason({ propertyId: 'a', status: { propertyId: 'a', state: 'cleanup_pending', eligible: false, reason: 'gone' } }, 'a'), null, 'only a live post can be blocked');
});
test('dialog names the post, says what is removed, and keeps Delete Permanently and Cancel', () => {
  const named = harness().render(dialog, 'UnfinishedPostDeletionAction', { viewModel: dialogVm([makeItem('a', 'draft', 'approved', { title: 'Garden Flat' })]) });
  assert.match(text(named), /Delete "Garden Flat"\?/); assert.match(text(named), /unfinished property, its draft listing and its photos/); assert.match(text(named), /This cannot be undone/);
  assert.ok(nodes(named).some(byText('Delete Permanently')) && nodes(named).some(byText('Cancel')));
  assert.match(text(harness().render(dialog, 'UnfinishedPostDeletionAction', { viewModel: dialogVm([makeItem('a', null)]) })), /Delete "House in Imus"\?/, 'no title: Type in City');
  const wizard = harness().render(dialog, 'UnfinishedPostDeletionAction', { viewModel: dialogVm([], { workspacePropertyId: 'a', draft: { title: 'My draft' }, photoState: { photos: [1, 2, 3] } }) });
  assert.match(text(wizard), /Delete "My draft"\?/); assert.match(text(wizard), /its 3 photos/);
  const modal = (state: any) => nodes(harness().render(dialog, 'UnfinishedPostDeletionAction', { viewModel: dialogVm([makeItem('a', 'draft')], { unfinishedPostState: state }) })).find(n => n.type === 'Modal')!.props.visible;
  assert.equal(modal(liveState()), false);
  assert.equal(modal(liveState({ confirming: true })), true);
  assert.equal(modal(liveState({ confirming: true, status: { propertyId: 'a', state: 'live', eligible: false, reason: 'No.' } })), false, 'never confirm a post that cannot be deleted');
  assert.equal(modal(liveState({ confirming: true, status: null })), false);
});
test('names and body wording', () => {
  assert.equal(unfinishedPostName(makeItem('n', 'draft', 'approved', { title: '  Sunny studio ' })), 'Sunny studio');
  assert.equal(unfinishedPostName(makeItem('n', null)), 'House in Imus');
  assert.equal(unfinishedPostName(undefined, 'From draft'), 'From draft');
  assert.equal(unfinishedPostName(undefined, '  '), 'this unfinished post');
  assert.equal(deleteDialogTitle('A'), 'Delete "A"?');
  assert.match(deleteDialogBody(null), /its photos\.$/); assert.match(deleteDialogBody(1), /its 1 photo\.$/); assert.match(deleteDialogBody(0), /its 0 photos\.$/);
});
test('delete is offered only for posts that were never published', () => {
  assert.equal(offersUnfinishedDelete(makeItem('o', null)), true);
  assert.equal(offersUnfinishedDelete(makeItem('o', 'draft')), true);
  assert.equal(offersUnfinishedDelete(makeItem('o', 'draft', 'approved', { published: true })), false);
  assert.equal(offersUnfinishedDelete(makeItem('o', 'active')), false);
  assert.equal(offersUnfinishedDelete(makeItem('o', 'rented')), false);
});

// ---- Per-card cleanup banner
test('cleanup banner shows on its own card with Retry; it is absent otherwise', () => {
  let retried = 0;
  const tree = render({ item: makeItem('b1', 'draft'), cleanup: { busy: false, onRetry: () => { retried++; } } });
  assert.match(text(tree), /Some photos could not be removed\./);
  nodes(tree).find(byText('Retry'))!.props.onPress(); assert.equal(retried, 1);
  assert.doesNotMatch(text(render({ item: makeItem('b2', 'draft') })), /could not be removed/);
  const busy = nodes(render({ item: makeItem('b3', 'draft'), cleanup: { busy: true, onRetry() {} } })).find(n => n.props?.accessibilityLabel?.startsWith('Retry photo cleanup'))!;
  assert.equal(busy.props.disabled, true);
});

// ---- Posting editor header menu
test('editor menu: exit always, delete only for a live post, reason when blocked', () => {
  const live = { propertyId: 'p', state: 'live' as const, eligible: true, reason: null };
  const vm = (status: any, over: any = {}): any => ({ postingWizard: true, workspacePropertyId: 'p', unfinishedPostState: { status }, unfinishedPostDeletionDisabled: false, requestUnfinishedPostDeletion() {}, ...over });
  const exit = { label: 'Save and exit', onPress() {}, disabled: false };
  const items = postingEditorMenu(vm(live), () => {}, exit)!;
  assert.deepEqual(items.map(i => [i.key, i.label, !!i.danger, !!i.disabled]), [['exit', 'Save and exit', false, false], ['delete', `Delete this unfinished post${ellipsis}`, true, false]]);
  const blocked = postingEditorMenu(vm({ ...live, eligible: false, reason: 'Not now.' }), () => {}, exit)!;
  assert.deepEqual([blocked[1]!.disabled, blocked[1]!.note], [true, 'Not now.']);
  assert.equal(postingEditorMenu(vm(live, { unfinishedPostDeletionDisabled: true }), () => {}, exit)![1]!.disabled, true);
  assert.equal(postingEditorMenu(vm(null), () => {}), undefined, 'nothing to delete yet');
  assert.equal(postingEditorMenu(vm({ ...live, propertyId: 'other' }), () => {}), undefined, 'status belongs to another post');
  assert.equal(postingEditorMenu(vm(live, { postingWizard: false }), () => {}), undefined);
  assert.equal(postingEditorMenu(vm({ ...live, state: 'cleanup_pending' }), () => {}), undefined);
  let closed = 0; postingEditorMenu(vm(live), () => { closed++; })![0]!.onPress(); assert.equal(closed, 1);
  assert.equal(postingEditorMenu(vm(live), () => {})![0]!.label, 'Close posting', 'default exit label');
  let saved = 0; postingEditorMenu(vm(live), () => { closed++; }, { label: 'Save and exit', onPress: () => { saved++; }, disabled: true })!.find(i => i.key === 'exit')!.onPress(); assert.deepEqual([saved, closed], [1, 1], 'the supplied exit action runs, not close');
  assert.equal(postingEditorMenu(vm(live), () => {}, { label: 'x', onPress() {}, disabled: true })![0]!.disabled, true);
  assert.equal(editorMenuItems({ exitLabel: 'x', onExit() {}, status: null, deleteDisabled: false, onDelete() {} }).length, 1);
});
test('scaffold header: the more button opens the menu; a blocked delete is disabled and shows its reason', () => {
  const pressed: string[] = [];
  const h = harness();
  const menu = [{ key: 'exit', label: 'Save and exit', onPress: () => pressed.push('exit') }, { key: 'delete', label: `Delete this unfinished post${ellipsis}`, danger: true, disabled: true, note: 'Not now.', onPress: () => pressed.push('delete') }];
  const props = { onClose() {}, title: 'T', progress: { type: 'Progress', props: {} }, menu, children: null };
  const closed = h.render(scaffold, 'ListingWizardScaffold', props);
  assert.doesNotMatch(text(closed), /Save and exit/);
  const more = nodes(closed).find(n => n.props?.accessibilityLabel === 'More options')!; assert.equal(more.props.style.minHeight, 48); more.props.onPress();
  const open = h.render(scaffold, 'ListingWizardScaffold', props);
  nodes(open).find(byText('Save and exit'))!.props.onPress(); assert.deepEqual(pressed, ['exit']);
  assert.equal(nodes(open).find(byText(`Delete this unfinished post${ellipsis}`))!.props.disabled, true);
  assert.match(text(open), /Not now\./);
  assert.ok(!nodes(harness().render(scaffold, 'ListingWizardScaffold', { ...props, menu: undefined })).some(n => n.props?.accessibilityLabel === 'More options'));
});

// ---- Dashboard wiring: delete is offered per card, and only through the existing ViewModel entry
test('dashboard: only never-published cards offer delete; it passes that card id and the existing reason', () => {
  const calls: string[] = [];
  const items = [makeItem('draft1', 'draft'), makeItem('live1', 'active')];
  const vm: any = {
    portfolioState: { loaded: true, items, query: '', filter: 'all', refreshing: false, busy: false, error: null }, portfolioItems: items, portfolioFilterCounts: { all: 2, published: 1, drafts: 1, rented: 0 },
    portfolio: { load() {} }, portfolioActionsDisabled: false, notice: null, propertyVerificationState: null, setPortfolioFilter() {}, setListingQuery() {},
    requestPortfolioDeletion: async (id: string) => { calls.push(`delete:${id}`); }, resumeUnfinishedPostCleanup: (id: string) => calls.push(`cleanup:${id}`),
    unfinishedPostState: { propertyId: 'draft1', status: { propertyId: 'draft1', state: 'live', eligible: false, reason: 'Has a viewing.' }, busy: false, confirming: false, error: null, pending: [{ propertyId: 'live1', state: 'cleanup_pending', eligible: false, reason: null }] },
  };
  const h = harness(); const render = () => h.render(dashboard, 'PropertyDashboardView', { viewModel: vm });
  const more = (tree: any) => nodes(tree).filter(n => n.props?.accessibilityLabel?.startsWith('More actions for'));
  assert.equal(more(render()).length, 1, 'the published card has no overflow button; the draft card does');
  more(render())[0].props.onPress();
  const open = render(); nodes(open).find(byText(`Delete unfinished post${ellipsis}`))!.props.onPress();
  assert.deepEqual(calls, ['delete:draft1']);
  assert.equal(text(open).split('Has a viewing.').length - 1, 1, 'reason only on the checked card');
  assert.equal(text(open).split('Some photos could not be removed.').length - 1, 1, 'cleanup banner only on the card with a pending job');
  nodes(open).find(byText('Retry'))!.props.onPress(); assert.deepEqual(calls, ['delete:draft1', 'cleanup:live1']);
});
