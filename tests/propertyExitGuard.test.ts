/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import type { PropertyListingViewModel } from '../src/features/property-listing/viewModels/usePropertyListingViewModel';

// Executes the actual hook + actual property/photo workflows + shared navigation guard.
// Only React's scheduling hooks and native/backend dependency composition are replaced.
// Explicit flush models the interval before React commits an external-store update.
function mountProperty(persistedProperty: string | null = null, draftService: any = {}, publicationService: any = { restore: async () => null }, lifecycleService?: any, locationService?: any) {
  let cursor = 0, current: PropertyListingViewModel, mounted = true;
  const slots: any[] = [], effects: (() => void)[] = [], cache = new Map<string, any>();
  let writes = 0, tree: any, realHook: any, backAction: (() => void) | null = null;
  const destinations: string[] = [];
  const hooks = {
    useState(initial: any) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, (value: any) => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(value: any) { const index = cursor++; return slots[index] ?? (slots[index] = { current: value }); },
    useMemo(fn: () => any, _deps: unknown[]) { cursor++; return fn(); },
    useEffect(fn: () => any, deps?: unknown[]) { const index = cursor++, previous = slots[index]; if (!previous || !deps || !previous.deps || deps.some((v, i) => !Object.is(v, previous.deps[i]))) { effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); } },
    useSyncExternalStore(subscribe: (fn: () => void) => () => void, snapshot: () => any) { const index = cursor++; if (!slots[index]) slots[index] = { cleanup: subscribe(() => {}) }; return snapshot(); },
  };
  const service = {
    getEligibleUserId: async () => 'test-owner', assertIdentity: async () => {}, restore: async () => persistedProperty ? { propertyId: persistedProperty, status: 'created' } : null,
    create: async () => { writes++; throw Error('No creation during navigation'); },
    recentOwned: async () => [], confirmOwned: async () => { throw Error('No confirmation during navigation'); }, beginNew: async () => {},
  };
  const load = (path: string): any => {
    const absolute = resolve(path); if (cache.has(absolute)) return cache.get(absolute);
    const module = { exports: {} }; cache.set(absolute, module.exports); const actualRequire = createRequire(absolute);
    const req = (name: string) => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
      if (name === 'react-native') return { StyleSheet: { create: (styles: any) => styles }, View: 'View', Text: 'Text', Modal: 'Modal', StatusBar: 'StatusBar' };
      if (name.endsWith('/usePropertyListingViewModel')) return { usePropertyListingViewModel: (...args: any[]) => { current = realHook(...args); return current; } };
      const presentation = ['AppButton', 'FeedbackNotice', 'ListingButton', 'NavigationConfirmation', 'RentLeaseBottomNavigation', 'ScreenContainer', 'CreateListingView', 'ListingDetailView', 'ListingManagementView', 'ListingPreviewView', 'PropertyDashboardView', 'PublishedListingStatusView', 'ListingWizardScaffold'];
      const component = presentation.find(value => name.endsWith('/' + value));
      if (component) return { [component]: component };
      if (name.endsWith('/listingLifecycleDependencies')) return { listingLifecycleService: lifecycleService ?? { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row: current.publicationState.lastConfirmed, operations: [] }) } };
      if (name.endsWith('/listingPublicationDependencies')) return { listingPublicationService: publicationService };
      if (name.endsWith('/listingDraftDependencies')) return { listingDraftService: draftService };
      if (name.endsWith('/propertyLocationDependencies')) return { propertyLocationService: locationService ?? { searchAddress: async () => [], getMapStyleUrl: () => 'test-style' } };
      if (name.endsWith('/propertyCreationDependencies')) return { propertyCreationService: service };
      if (name.endsWith('/propertyPhotoDependencies')) return { propertyPhotoService: {}, selectPropertyPhoto: async () => { writes++; throw Error('No picker during navigation'); } };
      if (name.startsWith('.')) return load(resolve(absolute, '..', name + '.ts'));
      return actualRequire(name);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', code)(req, module, module.exports); cache.set(absolute, module.exports); return module.exports;
  };
  realHook = load('src/features/property-listing/viewModels/usePropertyListingViewModel.ts').usePropertyListingViewModel;
  const { PropertyListingFlowView } = load('src/features/property-listing/views/PropertyListingFlowView.tsx');
  const props = { initialScreen: 'postingType', registerBackAction: (action: (() => void) | null) => { backAction = action; }, onRootBack: () => destinations.push('root'), onClose: () => destinations.push('Close'), onOpenDiscover: () => destinations.push('Discover'), onOpenChat: () => destinations.push('Chat'), onOpenMaintenance: () => destinations.push('Tenancy') };
  const flush = () => { assert.ok(mounted); cursor = 0; tree = PropertyListingFlowView(props); while (effects.length) effects.shift()!(); return current; };
  const componentProps = (name: string): any => {
    const visit = (node: any): any => node?.type === name ? node.props : (Array.isArray(node?.props?.children) ? node.props.children : [node?.props?.children]).filter(Boolean).map(visit).find(Boolean);
    return visit(tree);
  };
  flush();
  return {
    vm: () => current!, flush,
    async settle() { for (let i = 0; i < 3; i++) { await new Promise<void>(resolve => setImmediate(resolve)); flush(); } },
    statusView: () => load('src/features/property-listing/views/PublishedListingStatusView.tsx').PublishedListingStatusView({ viewModel: current, onClose: () => {} }), writes: () => writes, destinations,
    sharedDialog: (props: any) => load('src/shared/components/NavigationConfirmation.tsx').NavigationConfirmation(props),
    bottom: () => componentProps('RentLeaseBottomNavigation'), dialog: () => componentProps('NavigationConfirmation'),
    close: () => componentProps('CreateListingView').onClose(), hardwareBack: () => backAction?.(),
    async setup() { await current.propertyCreation.initialize(); flush(); await new Promise<void>(resolve => setImmediate(resolve)); flush(); current.navigate('propertySetup'); flush(); },
    dirty() { current.propertyCreation.updateField('propertyType', 'studio'); },
    unmount() { mounted = false; for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('actual Property ViewModel guards a synchronous dirty-property exit before React rerenders', async () => {
  const h = mountProperty(); await h.setup(); assert.equal(h.vm().propertyCreation.dirty(), false);
  h.dirty(); assert.equal(h.vm().propertyCreation.dirty(), true); let exits = 0;
  h.vm().requestNavigation(() => exits++); h.flush();
  assert.equal(h.vm().navigationConfirmation, true); assert.equal(exits, 0);
  h.vm().cancelNavigation(); h.flush(); assert.equal(h.vm().navigationConfirmation, false);
  assert.equal(h.vm().propertyState.draft.propertyType, 'studio'); assert.equal(exits, 0);
  h.vm().requestNavigation(() => exits++); h.flush(); h.vm().confirmNavigation(); h.vm().confirmNavigation(); h.flush();
  assert.equal(exits, 1); assert.equal(h.vm().navigationConfirmation, false); assert.equal(h.writes(), 0); h.unmount();
});
test('review/address/details Back stays internal and preserves the physical draft', async () => {
  const h = mountProperty(); await h.setup(); h.dirty();
  const f = h.vm().propertyCreation; f.updateField('city', 'imus'); f.updateField('barangay', 'Example'); f.updateField('addressLine1', 'Example street'); f.next(); f.next(); h.flush();
  assert.equal(h.vm().propertyState.step, 'review'); h.vm().goBack(); h.flush(); assert.equal(h.vm().propertyState.step, 'address');
  h.vm().goBack(); h.flush(); assert.equal(h.vm().propertyState.step, 'details'); assert.equal(h.vm().navigationConfirmation, false);
  h.vm().goBack(); h.flush(); assert.equal(h.vm().screen, 'postingType'); assert.equal(h.vm().propertyCreation.dirty(), true); h.unmount();
});
test('Android Back at posting type guards the root exit; Back on its dialog cancels', async () => {
  const h = mountProperty(); await h.setup(); h.dirty(); h.flush(); let exits = 0;
  h.vm().backFromWorkspace(() => exits++); h.flush(); assert.equal(h.vm().screen, 'postingType');
  h.vm().backFromWorkspace(() => exits++); h.flush(); assert.equal(h.vm().navigationConfirmation, true); assert.equal(exits, 0);
  h.vm().cancelNavigation(); h.flush(); assert.equal(h.vm().propertyCreation.dirty(), true);
  h.vm().backFromWorkspace(() => exits++); h.flush(); h.vm().confirmNavigation(); h.flush(); assert.equal(exits, 1); h.unmount();
});
test('Listings root Leave discards only local edits and does not immediately prompt again', async () => {
  const h = mountProperty(); await h.setup(); h.dirty(); h.flush();
  h.bottom().onListing(); h.flush(); assert.equal(h.vm().navigationConfirmation, true); h.vm().confirmNavigation(); h.flush();
  assert.equal(h.vm().screen, 'dashboard'); assert.equal(h.vm().propertyCreation.dirty(), false);
  let exits = 0; h.vm().requestNavigation(() => exits++); h.flush(); assert.equal(exits, 1); assert.equal(h.writes(), 0); h.unmount();
});
for (const [destination, callback] of [['Discover', 'onDiscover'], ['Chat', 'onChat'], ['Tenancy', 'onTenancy'], ['Close', 'close']] as const) test(`${destination} actual FlowView exit prompts and preserves first pending destination`, async () => {
  const h = mountProperty(); await h.setup(); h.dirty(); h.flush();
  if (callback === 'close') h.close(); else h.bottom()[callback]();
  h.bottom().onChat(); h.flush();
  assert.equal(h.dialog().visible, true); assert.deepEqual(h.destinations, []);
  h.dialog().onCancel(); h.flush(); assert.equal(h.vm().propertyCreation.dirty(), true); assert.deepEqual(h.destinations, []);
  if (callback === 'close') h.close(); else h.bottom()[callback](); h.flush();
  h.dialog().onConfirm(); h.dialog().onConfirm(); h.flush(); assert.deepEqual(h.destinations, [destination]); assert.equal(h.writes(), 0); h.unmount();
});
test('clean property setup exits directly, while Android Back first traverses internal steps', async () => {
  const h = mountProperty(); await h.setup(); let exits = 0;
  h.vm().requestNavigation(() => exits++); h.flush(); assert.equal(exits, 1); assert.equal(h.vm().navigationConfirmation, false); h.unmount();
});
test('account/workspace unmount cancels pending intent and rejects stale exit callbacks', async () => {
  const h = mountProperty(); await h.setup(); h.dirty(); h.flush(); let exits = 0;
  h.vm().requestNavigation(() => exits++); h.flush(); const stale = h.vm(); h.unmount();
  stale.confirmNavigation(); stale.requestNavigation(() => exits++); stale.confirmNavigation(); assert.equal(exits, 0);
});

test('registered Android handler traverses details/posting before guarded root exit', async () => {
  const h = mountProperty(); await h.setup(); h.dirty(); h.flush(); h.hardwareBack(); h.flush();
  assert.equal(h.vm().screen, 'postingType'); assert.equal(h.dialog().visible, false);
  h.hardwareBack(); h.flush(); assert.equal(h.dialog().visible, true); assert.deepEqual(h.destinations, []);
  h.dialog().onCancel(); h.flush(); assert.equal(h.vm().propertyState.draft.propertyType, 'studio');
  h.hardwareBack(); h.flush(); h.dialog().onConfirm(); h.flush(); assert.deepEqual(h.destinations, ['root']); assert.equal(h.writes(), 0); h.unmount();
});


test('actual ViewModel keeps otherwise complete wizard fields local without a persisted property', async () => {
  const h = mountProperty(); await h.setup(); h.vm().updateDraft('title', 'Entered title'); h.vm().updateDraft('description', 'Entered description'); h.vm().updateDraft('askingRent', '12000'); h.flush();
  await h.vm().saveDraft(); h.flush(); assert.equal(h.vm().screen, 'dashboard'); assert.match(h.vm().notice ?? '', /not saved to your account/); assert.equal(h.vm().listingDraftState.listingId, null); assert.equal(h.writes(), 0); h.unmount();
});
function backendDraftService(existing = false) {
  const propertyId = '10000000-0000-4000-8000-000000000001', listingId = '20000000-0000-4000-8000-000000000001';
  let calls = 0;
  const row = { id: listingId, property_id: propertyId, landlord_id: 'test-owner', title: 'Loaded draft title', description: 'Loaded description', asking_rent_monthly: 12000, house_rules: null, rental_term: 'long_term', security_deposit_months: 1, advance_rent_months: 1, minimum_stay_months: null, available_from: null, status: 'draft', completeness_score: 0.5, created_at: '2026-10-24T00:00:00Z', updated_at: '2026-10-24T00:00:00Z' };
  const service = { context: async () => ({ userId: 'test-owner', propertyId }), assertContext: async () => {}, hasPending: async () => false, read: async () => existing ? row : null, reconcile: async () => row, save: async (_: unknown, fields: any) => { calls++; return { ...row, title: fields.title.trim(), description: fields.description.trim() }; } };
  return { propertyId, listingId, service, calls: () => calls };
}
test('actual ViewModel saves valid listing details for the authoritative property and retains the real listing UUID', async () => {
  const backend = backendDraftService(), h = mountProperty(backend.propertyId, backend.service); await h.setup();
  h.vm().updateDraft('title', 'Owner title'); h.vm().updateDraft('description', 'Owner description'); h.vm().updateDraft('askingRent', '12000'); h.flush();
  assert.equal(h.vm().canPersistListing, true); await h.vm().saveDraft(); h.flush();
  assert.equal(h.vm().listingDraftState.listingId, backend.listingId); assert.equal(h.vm().propertyState.propertyId, backend.propertyId); assert.match(h.vm().notice ?? '', /saved to your account/);
  h.vm().updateDraft('title', 'Corrected title'); h.flush(); await h.vm().saveDraft(); h.flush(); assert.equal(h.vm().listingDraftState.listingId, backend.listingId); assert.equal(backend.calls(), 2); h.unmount();
});
test('actual ViewModel restores an existing draft without changing the physical property reference', async () => {
  const backend = backendDraftService(true), h = mountProperty(backend.propertyId, backend.service); await h.setup();
  assert.equal(h.vm().draft.title, 'Loaded draft title'); assert.equal(h.vm().draft.askingRent, '12000'); assert.equal(h.vm().listingDraftState.listingId, backend.listingId); assert.equal(h.vm().propertyState.propertyId, backend.propertyId); assert.equal(backend.calls(), 0); h.unmount();
});


test('local-only listing remains guarded after dashboard: Stay retains fields, Leave restores baseline once', async () => {
  const h = mountProperty(); await h.setup(); const baseline = { ...h.vm().draft };
  assert.equal(h.vm().propertyCreation.dirty(), false);
  h.vm().updateDraft('title', 'Local rental title'); h.vm().updateDraft('description', 'Local description'); h.vm().updateDraft('askingRent', '15000'); h.flush();
  await h.vm().saveDraft(); h.flush(); assert.equal(h.vm().screen, 'dashboard'); assert.equal(h.vm().draft.title, 'Local rental title'); assert.equal(h.vm().listingDraftState.listingId, null);
  h.bottom().onDiscover(); h.flush(); assert.equal(h.dialog().visible, true); assert.deepEqual(h.destinations, []);
  h.dialog().onCancel(); h.flush(); assert.equal(h.vm().screen, 'dashboard'); assert.equal(h.vm().draft.description, 'Local description'); assert.equal(h.vm().draft.askingRent, '15000');
  h.bottom().onDiscover(); h.bottom().onChat(); h.flush(); h.dialog().onConfirm(); h.dialog().onConfirm(); h.flush();
  assert.deepEqual(h.destinations, ['Discover']); assert.deepEqual(h.vm().draft, baseline); assert.equal(h.writes(), 0); h.unmount();
});
test('confirmed backend draft stays clean on dashboard until edited again', async () => {
  const backend = backendDraftService(), h = mountProperty(backend.propertyId, backend.service); await h.setup();
  h.vm().updateDraft('title', 'Saved title'); h.vm().updateDraft('description', 'Saved description'); h.vm().updateDraft('askingRent', '12000'); h.flush();
  await h.vm().saveDraft(); h.flush(); h.bottom().onDiscover(); h.flush(); assert.equal(h.dialog().visible, false); assert.deepEqual(h.destinations, ['Discover']);
  h.vm().updateDraft('title', 'Unsaved edit on dashboard'); h.flush(); h.bottom().onChat(); h.flush(); assert.equal(h.dialog().visible, true);
  h.dialog().onCancel(); h.flush(); assert.equal(h.vm().draft.title, 'Unsaved edit on dashboard'); assert.equal(backend.calls(), 1); h.unmount();
});
test('publication preview does not mark unsaved backend-draft edits as confirmed', async () => {
  const backend = backendDraftService(), h = mountProperty(backend.propertyId, backend.service); await h.setup();
  h.vm().updateDraft('title', 'Saved title'); h.vm().updateDraft('description', 'Saved description'); h.vm().updateDraft('askingRent', '12000'); h.flush();
  await h.vm().saveDraft(); h.flush();
  h.vm().updateDraft('title', 'Unsaved publication edit'); h.flush(); h.vm().confirmPublish(); h.flush();
  h.bottom().onDiscover(); h.flush(); assert.equal(h.dialog().visible, true); assert.deepEqual(h.destinations, []);
  h.dialog().onCancel(); h.flush(); assert.equal(h.vm().draft.title, 'Unsaved publication edit');
  h.bottom().onDiscover(); h.flush(); h.dialog().onConfirm(); h.flush();
  assert.deepEqual(h.destinations, ['Discover']); assert.equal(h.vm().draft.title, 'Saved title'); assert.equal(backend.calls(), 1); h.unmount();
});
test('Save local changes does not mark unsaved backend-draft edits as confirmed', async () => {
  const backend = backendDraftService(), h = mountProperty(backend.propertyId, backend.service); await h.setup();
  h.vm().updateDraft('title', 'Saved title'); h.vm().updateDraft('description', 'Saved description'); h.vm().updateDraft('askingRent', '12000'); h.flush();
  await h.vm().saveDraft(); h.flush();
  h.vm().updateDraft('title', 'Unsaved management edit'); h.flush(); h.vm().finishEdit(); h.flush();
  h.bottom().onChat(); h.flush(); assert.equal(h.dialog().visible, true); assert.deepEqual(h.destinations, []);
  h.dialog().onCancel(); h.flush(); assert.equal(h.vm().draft.title, 'Unsaved management edit');
  h.bottom().onChat(); h.flush(); h.dialog().onConfirm(); h.flush();
  assert.deepEqual(h.destinations, ['Chat']); assert.equal(h.vm().draft.title, 'Saved title'); assert.equal(backend.calls(), 1); h.unmount();
});
test('Property Flow supplies contextual confirmation copy without changing shared defaults or Android cancel', () => {
  const h = mountProperty();
  assert.equal(h.dialog().title, 'Leave Property & Listing Management?');
  assert.equal(h.dialog().body, 'You have unsaved property, photo, or listing changes. Stay to continue editing, or leave without saving.');
  let cancels = 0;
  const render = (overrides: any = {}) => h.sharedDialog({ visible: true, onCancel: () => cancels++, onConfirm: () => {}, ...overrides });
  const text = (node: any): string[] => node?.type === 'Text' ? [node.props.children] : (Array.isArray(node?.props?.children) ? node.props.children : [node?.props?.children]).filter(Boolean).flatMap(text);
  const defaults = render(); assert.deepEqual(text(defaults), ['Leave this preview?', 'You have unsaved changes. Stay to continue editing, or leave without saving.']);
  const contextual = render({ title: h.dialog().title, body: h.dialog().body }); assert.equal(text(contextual)[0], h.dialog().title);
  contextual.props.onRequestClose(); assert.equal(cancels, 1); h.unmount();
});


test('real publication requires explicit confirmation, ignores preview checklist, and retains published ID without replacement save', async () => {
  const backend = backendDraftService(true); let publishes = 0;
  const row = await backend.service.read();
  const pub = { restore: async () => null, context: async () => ({ userId: 'test-owner', propertyId: backend.propertyId, listingId: backend.listingId }), assertContext: async () => {}, publish: async () => { publishes++; return { ...row, status: 'active', completeness_score: .8, published_at: '2026-10-25T00:00:00Z' }; } };
  const h = mountProperty(backend.propertyId, backend.service, pub); await h.setup();
  h.vm().requestPublish(); h.flush(); assert.equal(h.vm().screen, 'publishConfirmation'); assert.equal(publishes, 0);
  await h.vm().confirmPublish(); h.flush(); assert.equal(publishes, 1); assert.equal(h.vm().screen, 'published');
  assert.equal(h.vm().publicationState.publishedListingId, backend.listingId); assert.equal(h.vm().propertyState.propertyId, backend.propertyId);
  await h.vm().saveDraft(); await h.vm().listingDraftPersistence.save(h.vm().draft); assert.equal(backend.calls(), 0);
  assert.equal(h.vm().listingDraftState.lastConfirmed?.status, 'active'); h.unmount();
});

test('unsaved real listing edits block confirmation and publication', async () => {
  const backend = backendDraftService(true); let publishes = 0;
  const h = mountProperty(backend.propertyId, backend.service, { restore: async () => null, publish: async () => { publishes++; } }); await h.setup();
  h.vm().updateDraft('title', 'Unsaved correction'); h.flush(); h.vm().requestPublish(); h.flush();
  assert.notEqual(h.vm().screen, 'publishConfirmation'); assert.match(h.vm().publicationState.error ?? '', /Save your listing changes/);
  await h.vm().confirmPublish(); assert.equal(publishes, 0); h.unmount();
});

test('Figma-only publication has no backend publication action', async () => {
  let publishes = 0; const h = mountProperty(null, {}, { restore: async () => null, publish: async () => { publishes++; } }); await h.setup();
  await h.vm().confirmPublish(); h.flush(); assert.equal(h.vm().screen, 'published'); assert.match(h.vm().notice ?? '', /local preview only/); assert.equal(publishes, 0); h.unmount();
});


for (const status of ['paused', 'rented', 'archived', 'removed'] as const) test(`actual ViewModel reopens ${status} without draft loading/replacement or fake editing`, async () => {
  const backend = backendDraftService(true); const row = { ...await backend.service.read(), status, published_at: '2026-10-25T00:00:00Z' };
  let draftReads = 0;
  const h = mountProperty(backend.propertyId, { ...backend.service, read: async () => { draftReads++; return null; } }, { restore: async () => ({ row, pending: false }) }, { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row, operations: [] }) });
  await h.setup(); await h.settle(); assert.equal(h.vm().realListing?.status, status); assert.equal(h.vm().listingDraftReadOnly, true);
  h.vm().openPublishedListing(); h.flush(); assert.equal(h.vm().showRealPublication, true);
  h.vm().updateDraft('title', 'Not a real edit'); h.flush(); assert.equal(h.vm().draft.title, row.title);
  await h.vm().saveDraft(); assert.equal(draftReads, 0); assert.equal(backend.calls(), 0);
  const labels: string[] = [];
  const collect = (node: any) => { if (node?.props?.label) labels.push(node.props.label); for (const child of [node?.props?.children].flat(Infinity)) if (child && typeof child === 'object') collect(child); };
  collect(h.statusView());
  assert.equal(labels.includes('Mark unavailable'), false);
  if (status === 'paused') { assert.ok(labels.includes('Reactivate listing')); assert.ok(labels.includes('Archive listing')); }
  else { assert.equal(labels.some(label => /Pause listing|Reactivate listing|Archive listing/.test(label)), false); }
  h.unmount();
});

test('actual ViewModel lifecycle confirmation cancels on Android Back and blocks conflicting draft/publication actions', async () => {
  const backend = backendDraftService(true); const row = { ...await backend.service.read(), status: 'active', completeness_score: .8, published_at: '2026-10-25T00:00:00Z' };
  let calls = 0, publishing = 0, release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const lifecycle = { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row, operations: [] }), mutate: async () => { calls++; await wait; return { ...row, status: 'paused', paused_at: '2026-10-26T00:00:00Z' }; } };
  const h = mountProperty(backend.propertyId, backend.service, { restore: async () => ({ row, pending: false }), publish: async () => { publishing++; } }, lifecycle);
  await h.setup(); await h.settle(); h.vm().openPublishedListing(); h.flush(); assert.equal(h.vm().lifecycle.request('pause'), true); h.flush();
  h.hardwareBack(); h.flush(); assert.equal(h.vm().lifecycleState.confirmation, null); assert.equal(calls, 0); assert.equal(h.vm().screen, 'published');
  h.vm().lifecycle.request('pause'); const pending = h.vm().lifecycle.confirm(); await new Promise<void>(resolve => setImmediate(resolve)); h.flush();
  assert.equal(h.vm().lifecycleState.busy, true); await h.vm().saveDraft(); await h.vm().confirmPublish(); h.vm().setListingStatus('unavailable');
  assert.equal(backend.calls(), 0); assert.equal(publishing, 0); assert.equal(calls, 1); release(); await pending; h.flush();
  assert.equal(h.vm().realListing?.status, 'paused'); assert.equal(h.vm().propertyState.propertyId, backend.propertyId); h.unmount();
});

test('sample Mark unavailable remains explicitly local and calls no lifecycle service', async () => {
  let calls = 0; const h = mountProperty(null, {}, { restore: async () => null }, { mutate: async () => { calls++; } }); await h.setup();
  h.vm().setListingStatus('unavailable'); h.flush(); assert.equal(h.vm().listing.status, 'unavailable'); assert.match(h.vm().notice ?? '', /local preview state only/); assert.equal(calls, 0); h.unmount();
});


test('opening fixture management after a real status view keeps sample actions local and usable', async () => {
  const backend = backendDraftService(true); const row = { ...await backend.service.read(), status: 'active', completeness_score: .8, published_at: '2026-10-25T00:00:00Z' }; let calls = 0;
  const h = mountProperty(backend.propertyId, backend.service, { restore: async () => ({ row, pending: false }) }, { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row, operations: [] }), mutate: async () => { calls++; } });
  await h.setup(); await h.settle(); h.vm().openPublishedListing(); h.flush(); assert.equal(h.vm().showRealPublication, true);
  h.vm().goDashboard(); h.flush(); h.vm().openManagement(); h.flush(); assert.equal(h.vm().showRealPublication, false);
  h.vm().setListingStatus('unavailable'); h.flush(); assert.equal(h.vm().listing.status, 'unavailable'); assert.equal(h.vm().realListing?.status, 'active'); assert.equal(calls, 0); h.unmount();
});


async function openPhysicalLocation(h: ReturnType<typeof mountProperty>) {
  await h.setup(); const creation = h.vm().propertyCreation;
  creation.updateField('propertyType', 'studio'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Example barangay'); creation.updateField('addressLine1', 'Example street'); creation.next(); h.flush();
  h.vm().openPropertyLocation(); h.flush();
}
test('actual property/location composition synchronously aborts an old address search before React renders', async () => {
  let release!: (value: any[]) => void, signal!: AbortSignal;
  const h = mountProperty(null, {}, undefined, undefined, { getMapStyleUrl: () => 'fixture-style', searchAddress: async (_: string, next: AbortSignal) => { signal = next; return new Promise(resolve => { release = resolve; }); } });
  await openPhysicalLocation(h); const revision = h.vm().propertyCreation.getSnapshot().locationRevision;
  h.vm().propertyCreation.updateField('addressLine1', 'Changed street');
  assert.equal(signal.aborted, true); assert.equal(h.vm().propertyLocation.getSnapshot().context?.addressRevision, revision + 1); assert.equal(h.vm().propertyLocation.getSnapshot().stage, 'closed');
  release([{ id: 'old', label: 'Old result', longitude: 120.9, latitude: 14.4 }]); await h.settle(); assert.deepEqual(h.vm().locationState.candidates, []); h.unmount();
});
test('actual exact-only confirmation preserves property fields, keeps save blocked, and is cleared on confirmed workspace exit', async () => {
  const candidate = { id: 'fixture', label: 'Example address', longitude: 120.9, latitude: 14.4 };
  const h = mountProperty(null, {}, undefined, undefined, { getMapStyleUrl: () => 'fixture-style', searchAddress: async () => [candidate] });
  await openPhysicalLocation(h); await h.settle(); const before = { ...h.vm().propertyCreation.getSnapshot().draft };
  const location = h.vm().propertyLocation; location.chooseCandidate(candidate.id); h.flush(); h.hardwareBack(); h.flush(); assert.equal(location.getSnapshot().confirmedPoint, null);
  h.vm().openPropertyLocation(); await h.settle(); location.chooseCandidate(candidate.id); location.mapLoaded(); location.movePoint([121, 14.5]); location.confirmExact(); h.flush();
  assert.deepEqual(h.vm().propertyState.draft, before); assert.ok(h.vm().locationState.confirmedPoint); assert.equal(h.vm().propertyCreation.locationReady(), false);
  h.vm().propertyCreation.next(); await h.vm().propertyCreation.submit(); assert.equal(h.writes(), 0);
  h.vm().requestNavigation(() => h.destinations.push('exit')); h.flush(); h.vm().confirmNavigation(); h.flush();
  assert.equal(location.getSnapshot().confirmedPoint, null); assert.deepEqual(h.destinations, ['exit']); h.unmount();
});
test('account/workspace disposal aborts location requests and cannot populate a replacement workspace', async () => {
  let release!: (value: any[]) => void, signal!: AbortSignal;
  const h = mountProperty(null, {}, undefined, undefined, { getMapStyleUrl: () => 'fixture-style', searchAddress: async (_: string, next: AbortSignal) => { signal = next; return new Promise(resolve => { release = resolve; }); } });
  await openPhysicalLocation(h); const oldLocation = h.vm().propertyLocation; h.unmount(); assert.equal(signal.aborted, true);
  release([{ id: 'old', label: 'Old result', longitude: 120.9, latitude: 14.4 }]); await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(oldLocation.getSnapshot().context, null); assert.equal(oldLocation.getSnapshot().confirmedPoint, null); assert.deepEqual(oldLocation.getSnapshot().candidates, []);
});
