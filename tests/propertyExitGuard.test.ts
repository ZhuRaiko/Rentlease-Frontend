/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { derivePublicPropertyPoint } from '../src/features/property-listing/models/PropertyLocationPrivacy';
import type { PropertyListingViewModel } from '../src/features/property-listing/viewModels/usePropertyListingViewModel';

// Executes the actual hook + actual property/photo workflows + shared navigation guard.
// Only React's scheduling hooks and native/backend dependency composition are replaced.
// Explicit flush models the interval before React commits an external-store update.
function mountProperty(persistedProperty: string | null = null, draftService: any = {}, publicationService: any = { restore: async () => null }, lifecycleService?: any, locationService?: any, overrides: { amenities?: any; creation?: any; photos?: any; pickImages?: any; portfolio?: any; initialScreen?: 'dashboard' | 'postingType'; replayUpdaters?: boolean } = {}) {
  let cursor = 0, current: PropertyListingViewModel, mounted = true;
  const slots: any[] = [], effects: (() => void)[] = [], cache = new Map<string, any>();
  let writes = 0, tree: any, realHook: any, backAction: (() => void) | null = null;
  const destinations: string[] = [];
  const hooks = {
    useState(initial: any) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, (value: any) => { if(overrides.replayUpdaters&&typeof value==='function')value(slots[index].value); slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }]; },
    useRef(value: any) { const index = cursor++; return slots[index] ?? (slots[index] = { current: value }); },
    useMemo(fn: () => any, _deps: unknown[]) { cursor++; return fn(); },
    useEffect(fn: () => any, deps?: unknown[]) { const index = cursor++, previous = slots[index]; if (!previous || !deps || !previous.deps || deps.some((v, i) => !Object.is(v, previous.deps[i]))) { effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); } },
    useSyncExternalStore(subscribe: (fn: () => void) => () => void, snapshot: () => any) { const index = cursor++; if (!slots[index]) slots[index] = { cleanup: subscribe(() => {}) }; return snapshot(); },
  };
  const service = {
    getEligibleUserId: async () => 'test-owner', assertIdentity: async () => {}, restore: async () => persistedProperty ? { propertyId: persistedProperty, status: 'created' } : null,
    create: async () => { writes++; throw Error('No creation during navigation'); },
    recentOwned: async () => [], confirmOwned: async () => { throw Error('No confirmation during navigation'); }, beginNew: async () => {}, ...overrides.creation,
  };
  const load = (path: string): any => {
    const absolute = resolve(path); if (cache.has(absolute)) return cache.get(absolute);
    const module = { exports: {} }; cache.set(absolute, module.exports); const actualRequire = createRequire(absolute);
    const req = (name: string) => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
      if (name === 'react-native') return { StyleSheet: { create: (styles: any) => styles }, View: 'View', Text: 'Text', Modal: 'Modal', StatusBar: 'StatusBar' };
      if (name.endsWith('/usePropertyListingViewModel')) return { usePropertyListingViewModel: (...args: any[]) => { current = realHook(...args); return current; } };
      const presentation = ['AppButton', 'FeedbackNotice', 'ListingButton', 'NavigationConfirmation', 'RentLeaseBottomNavigation', 'ScreenContainer', 'CreateListingView', 'ListingComposerView', 'ListingDetailsView', 'ListingDraftSavedView', 'ListingDetailView', 'ListingManagementView', 'ListingPreviewView', 'PropertyDashboardView', 'PublishedListingStatusView', 'ListingWorkspaceFeedback', 'ListingWizardScaffold'];
      const component = presentation.find(value => name.endsWith('/' + value));
      if (component) return { [component]: component };
      if (name.endsWith('/landlordPortfolioDependencies')) return { landlordPortfolioService: overrides.portfolio ?? { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [] } };
      if (name.endsWith('/listingLifecycleDependencies')) return { listingLifecycleService: lifecycleService ?? { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row: current.publicationState.lastConfirmed, operations: [] }) } };
      if (name.endsWith('/listingPublicationDependencies')) return { listingPublicationService: publicationService };
      if (name.endsWith('/listingDraftDependencies')) return { listingDraftService: draftService };
      if (name.endsWith('/propertyLocationDependencies')) return { propertyLocationService: locationService ?? { searchAddress: async () => [], getMapStyleUrl: () => 'test-style' } };
      if (name.endsWith('/propertyAmenityDependencies')) return { propertyAmenityService: overrides.amenities ?? { load: async () => ({userId:'test-owner',catalog:[],selectedIds:[],hasPrivateLocation:false}), assertUser:async()=>{} } };
      if (name.endsWith('/propertyCreationDependencies')) return { propertyCreationService: service };
      if (name.endsWith('/propertyPhotoDependencies')) return { propertyPhotoService: overrides.photos ?? {}, selectPropertyPhotos: overrides.pickImages, selectPropertyPhoto: async () => { writes++; throw Error('No picker during navigation'); } };
      if (name.startsWith('.')) return load(resolve(absolute, '..', name + '.ts'));
      return actualRequire(name);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', code)(req, module, module.exports); cache.set(absolute, module.exports); return module.exports;
  };
  realHook = load('src/features/property-listing/viewModels/usePropertyListingViewModel.ts').usePropertyListingViewModel;
  const { PropertyListingFlowView } = load('src/features/property-listing/views/PropertyListingFlowView.tsx');
  const props = { initialScreen: overrides.initialScreen ?? 'dashboard', registerBackAction: (action: (() => void) | null) => { backAction = action; }, onRootBack: () => destinations.push('root'), onClose: () => destinations.push('Close'), onOpenDiscover: () => destinations.push('Discover'), onOpenChat: () => destinations.push('Chat'), onOpenMaintenance: () => destinations.push('Tenancy') };
  const flush = () => { assert.ok(mounted); cursor = 0; tree = PropertyListingFlowView(props); while (effects.length) effects.shift()!(); return current; };
  const componentProps = (name: string): any => {
    const visit = (node: any): any => node?.type === name ? node.props : (Array.isArray(node?.props?.children) ? node.props.children : [node?.props?.children]).filter(Boolean).map(visit).find(Boolean);
    return visit(tree);
  };
  flush();
  if (!overrides.initialScreen) { current!.navigate('postingType'); flush(); }
  return {
    vm: () => current!, flush,
    async settle() { for (let i = 0; i < 3; i++) { await new Promise<void>(resolve => setImmediate(resolve)); flush(); } },
    draftError: (message: string) => new (load('src/features/property-listing/models/PersistedListingDraft.ts').ListingDraftError)(message, 'uncertain'),
    composerView: () => componentProps('ListingComposerView'),
    statusView: () => load('src/features/property-listing/views/PublishedListingStatusView.tsx').PublishedListingStatusView({ viewModel: current, onClose: () => {} }), writes: () => writes, destinations,
    sharedDialog: (props: any) => load('src/shared/components/NavigationConfirmation.tsx').NavigationConfirmation(props),
    bottom: () => componentProps('RentLeaseBottomNavigation'), dialog: () => componentProps('NavigationConfirmation'),
    close: () => componentProps('CreateListingView').onClose(), hardwareBack: () => backAction?.(),
    async setup() { await current.propertyCreation.initialize(); flush(); await new Promise<void>(resolve => setImmediate(resolve)); flush(); current.navigate('propertySetup'); flush(); for (let i = 0; i < 4; i++) { await new Promise<void>(resolve => setImmediate(resolve)); flush(); } },
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
  const service = { context: async () => ({ userId: 'test-owner', propertyId }), assertContext: async () => {}, hasPending: async () => false, read: async () => existing ? row : null, reconcile: async () => row, save: async (_: unknown, fields: any) => { calls++; return { ...row, title: fields.title.trim(), description: fields.description.trim(), asking_rent_monthly: Number(fields.askingRent), house_rules: fields.houseRules || null, rental_term: fields.rentalTerm, security_deposit_months: Number(fields.securityDepositMonths), advance_rent_months: Number(fields.advanceRentMonths), minimum_stay_months: fields.minimumStayMonths ? Number(fields.minimumStayMonths) : null, available_from: fields.availableDate || null }; } };
  return { propertyId, listingId, service, calls: () => calls };
}
test('actual ViewModel saves valid listing details for the authoritative property and retains the real listing UUID', async () => {
  const backend = backendDraftService(), h = mountProperty(backend.propertyId, backend.service); await h.setup();
  h.vm().updateDraft('title', 'Owner title'); h.vm().updateDraft('description', 'Owner description'); h.vm().updateDraft('askingRent', '12000'); h.flush();
  assert.equal(h.vm().canPersistListing, true); await h.vm().saveDraft(); h.flush();
  assert.equal(h.vm().listingDraftState.listingId, backend.listingId); assert.equal(h.vm().propertyState.propertyId, backend.propertyId); assert.equal(h.vm().screen, 'draftSaved'); h.vm().openSavedDraft(); h.flush(); assert.equal(h.vm().screen,'preview');
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
test('actual complete confirmation preserves non-location fields, enables location validation, and is cleared on confirmed workspace exit', async () => {
  const candidate = { id: 'fixture', label: 'Example address', longitude: 120.9, latitude: 14.4 };
  const h = mountProperty(null, {}, undefined, undefined, { getMapStyleUrl: () => 'fixture-style', searchAddress: async () => [candidate] });
  await openPhysicalLocation(h); await h.settle(); const before = { ...h.vm().propertyCreation.getSnapshot().draft };
  const location = h.vm().propertyLocation; location.chooseCandidate(candidate.id); h.flush(); h.hardwareBack(); h.flush(); assert.equal(location.getSnapshot().confirmedPoint, null);
  h.vm().openPropertyLocation(); await h.settle(); location.chooseCandidate(candidate.id); location.mapLoaded(); location.movePoint([121, 14.5]); location.confirmExact(); h.flush();
  const { exactLatitude, exactLongitude, publicLatitude, publicLongitude, ...unchanged } = h.vm().propertyState.draft;
  const { exactLatitude: _a, exactLongitude: _b, publicLatitude: _c, publicLongitude: _d, ...expected } = before;
  assert.deepEqual(unchanged, expected); assert.ok(h.vm().locationState.confirmedPoint); assert.equal(h.vm().propertyCreation.locationReady(), true);
  assert.equal(exactLatitude, 14.5); assert.equal(exactLongitude, 121); assert.equal(typeof publicLatitude, 'number'); assert.equal(typeof publicLongitude, 'number');
  h.vm().propertyCreation.next(); assert.equal(h.writes(), 0);
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


test('actual revision-checked handoff includes all four coordinates and invalidates/reconfirms every address field', async () => {
  const candidate = { id: 'fixture', label: 'Synthetic address', longitude: 121, latitude: 14.5 };
  const h = mountProperty(null, {}, undefined, undefined, { getMapStyleUrl: () => 'fixture-style', searchAddress: async () => [candidate] });
  await openPhysicalLocation(h); await h.settle(); const creation = h.vm().propertyCreation, location = h.vm().propertyLocation;
  const received: any[] = [], provide = creation.provideConfirmedLocation;
  creation.provideConfirmedLocation = (point, revision) => { received.push({ point, revision }); provide(point, revision); };
  const confirm = (latitude: number) => { location.chooseCandidate(candidate.id); location.mapLoaded(); location.movePoint([121, latitude]); assert.equal(location.confirmExact(), true); h.flush(); };
  confirm(14.5);
  assert.deepEqual(received[0], { point: { exactLatitude: 14.5, exactLongitude: 121, publicLatitude: derivePublicPropertyPoint({ latitude: 14.5, longitude: 121 }).latitude, publicLongitude: derivePublicPropertyPoint({ latitude: 14.5, longitude: 121 }).longitude }, revision: creation.getSnapshot().locationRevision });
  let index = 0;
  for (const [field, value] of [['city', 'tagaytay'], ['barangay', 'Changed barangay'], ['addressLine1', 'Changed street'], ['addressLine2', 'Changed unit'], ['postalCode', '4101']] as const) {
    const oldToken = location.generationToken(), revision = creation.getSnapshot().locationRevision, count = received.length;
    creation.updateField(field, value); const draft = creation.getSnapshot().draft;
    assert.equal(creation.getSnapshot().locationRevision, revision + 1); assert.equal(draft.exactLatitude, null); assert.equal(draft.exactLongitude, null); assert.equal(draft.publicLatitude, null); assert.equal(draft.publicLongitude, null); assert.equal(location.getSnapshot().publicPoint, null);
    assert.equal(location.confirmExact(oldToken), false); assert.equal(received.length, count);
    h.flush(); h.vm().openPropertyLocation(); await h.settle(); confirm(14.51 + index++ * .01); assert.equal(creation.locationReady(), true); assert.equal(received.at(-1).revision, revision + 1);
  }
  assert.equal(h.writes(), 0); h.unmount();
});


for (const uncertain of [false, true]) test(`property save ${uncertain ? 'uncertainty stays in recovery' : 'opens composer with real UUID and loads media'}`, async () => {
  const backend = backendDraftService(); let creates = 0, photoLoads = 0;
  const h = mountProperty(null, backend.service, undefined, undefined, undefined, {
    creation: { create: async () => { creates++; if (uncertain) throw Object.assign(Error('unknown'), { code: 'property_creation_uncertain' }); return { propertyId: backend.propertyId, status: 'created' }; } },
    photos: { context: async () => ({ ownerId: 'test-owner', propertyId: backend.propertyId }), assertContext: async () => {}, list: async () => { photoLoads++; return []; }, hasPending: async () => false },
  });
  await h.setup(); const creation = h.vm().propertyCreation;
  creation.updateField('propertyType', 'apartment'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Buhay na Tubig'); creation.updateField('addressLine1', 'Private address');
  creation.provideConfirmedLocation({ exactLatitude: 14.4, exactLongitude: 120.9, publicLatitude: 14.401, publicLongitude: 120.901 }, creation.getSnapshot().locationRevision);
  creation.next(); creation.next(); await creation.submit(); await h.settle(); h.flush();
  assert.equal(creates, 1);
  if (uncertain) { assert.equal(h.vm().screen, 'propertySetup'); assert.equal(h.vm().propertyState.uncertain, true); assert.equal(photoLoads, 0); }
  else {
    assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().propertyState.propertyId, backend.propertyId); assert.ok(photoLoads > 0);
    assert.equal(h.vm().photoState.propertyId, backend.propertyId); assert.equal(h.vm().listingDraftState.propertyId, backend.propertyId);
    assert.equal(h.vm().propertySummary.location, 'Buhay na Tubig, Imus');
    h.vm().updateDraft('title', 'Rental title'); h.vm().updateDraft('description', 'Rental description'); h.vm().updateDraft('askingRent', '12000'); h.flush();
    h.hardwareBack(); h.flush(); assert.equal(h.vm().navigationConfirmation, true); h.vm().cancelNavigation(); h.flush(); assert.equal(h.vm().screen, 'listingComposer');
    h.vm().nextListingDetails(); await h.settle(); h.vm().openComposerPreview(); await h.settle(); assert.equal(h.vm().screen, 'preview'); h.vm().goBack(); h.flush(); assert.equal(h.vm().screen, 'listingDetails'); assert.equal(creates, 1);
    await h.settle(); await h.vm().saveDraft(); h.flush(); assert.equal(backend.calls(), 1); assert.equal(h.vm().listingDraftState.listingId, backend.listingId);
  }
  h.unmount();
});
test('no real property cannot open composer preview or start photo writes', async () => {
  const h = mountProperty(); await h.setup(); h.vm().openComposerPreview(); h.flush(); assert.equal(h.vm().screen, 'preview');
  await h.vm().propertyPhotos.addPhotos(); assert.equal(h.writes(), 0); h.unmount();
});


for (const status of [null, 'draft', 'active', 'paused', 'rented', 'archived', 'removed'] as const) test(`portfolio opens ${status ?? 'property only'} without recreating it, and Post detaches cleanly`, async () => {
  const backend = backendDraftService(!!status);
  const row = { ...(await backend.service.read())!, status: status ?? 'draft', published_at: status && status !== 'draft' ? '2026-10-28T00:00:00Z' : null, paused_at: status === 'paused' ? '2026-10-28T00:00:00Z' : null, archived_at: status === 'archived' ? '2026-10-28T00:00:00Z' : null, removed_at: null, removal_reason: null };
  const item = { propertyId: backend.propertyId, property: { id: backend.propertyId, landlord_id: 'test-owner', property_type: 'apartment', city: 'imus', barangay: 'Owner barangay', bedrooms: 2, bathrooms: 1, floor_area_sqm: 30, furnishing_status: 'furnished', is_active: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' }, listings: status ? [row] : [], currentListing: status ? row : null, coverPhoto: null, tier3: { status: 'pending', submissionId: 'submission', updatedAt: null } };
  let loads = 0;
  const h = mountProperty(null, backend.service, { restore: async (_: string, id?: string) => { if (status) assert.equal(id, backend.listingId); return status ? { row, pending: false } : null; } }, { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row, operations: [] }) }, undefined, {
    portfolio: { user: async () => 'test-owner', assertUser: async () => {}, load: async () => { loads++; return [item]; } },
    photos: { context: async () => ({ ownerId: 'test-owner', propertyId: backend.propertyId }), assertContext: async () => {}, list: async () => [], hasPending: async () => false },
  });
  await h.settle(); await h.vm().portfolio.load(); h.flush(); h.vm().openPortfolioItem(backend.propertyId); await h.settle();
  assert.equal(h.vm().workspacePropertyId, backend.propertyId); assert.equal(h.vm().propertyState.propertyId, null);
  assert.equal(h.vm().screen, !status ? 'listingComposer' : status === 'draft' ? 'listingDetails' : 'published');
  if (status === 'draft') { assert.equal(h.vm().draft.title, 'Loaded draft title'); h.vm().editComposerProperty(); h.flush(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().propertySummary.bedrooms, '2'); await h.settle(); h.vm().nextListingDetails(); await h.settle(); assert.equal(h.vm().screen, 'listingDetails'); }
  if (!status) { h.vm().nextListingDetails(); await h.settle(); assert.equal(h.vm().screen, 'listingDetails'); h.vm().goBack(); h.flush(); assert.equal(h.vm().screen, 'listingComposer'); }
  assert.equal(h.writes(), 0); assert.equal(backend.calls(), 0); assert.ok(loads > 0);
  h.bottom().onPost(); await h.settle(); assert.equal(h.vm().screen, 'postingType'); assert.equal(h.vm().workspacePropertyId, null); assert.equal(h.vm().workspaceListingId, null); assert.equal(h.vm().workspaceMode, 'create');
  assert.equal(h.vm().draft.title, ''); assert.equal(h.vm().photoState.photos.length, 0); assert.equal(h.vm().publicationState.error, null); assert.equal(h.vm().lifecycleState.row, null);
  h.unmount();
});
for (const tier3 of ['pending', 'rejected'] as const) test(`property-specific Tier 3 ${tier3} and uncertain publication do not block another Post or delete recovery`, async () => {
  const backend = backendDraftService(true), row = (await backend.service.read())!;
  const marker = new Map([[backend.listingId, 'pending']]);
  const item = { propertyId: backend.propertyId, property: { id: backend.propertyId, property_type: 'apartment', city: 'imus', barangay: 'A', bedrooms: 1, bathrooms: 1, furnishing_status: 'unfurnished', is_active: true }, currentListing: row, listings: [row], coverPhoto: null, tier3: { status: tier3, submissionId: 'a', updatedAt: null } };
  const h = mountProperty(null, backend.service, { restore: async () => ({ row, pending: marker.has(backend.listingId) }) }, undefined, undefined, { portfolio: { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [item] } });
  await h.settle(); await h.vm().portfolio.load(); h.flush(); h.vm().openPortfolioItem(backend.propertyId); await h.settle(); assert.equal(h.vm().publicationState.uncertain, true);
  h.bottom().onPost(); await h.settle(); assert.equal(h.vm().screen, 'postingType'); assert.equal(h.vm().publicationState.uncertain, false); assert.equal(marker.get(backend.listingId), 'pending');
  assert.equal(h.vm().screen, 'postingType'); assert.equal(h.vm().propertyState.propertyId, null); assert.equal(h.vm().draft.title, ''); assert.equal(marker.size, 1);
  h.unmount();
});


test('Post detaches an in-flight lifecycle operation without replaying it into the new workspace', async () => {
  const backend = backendDraftService(true); const row = { ...(await backend.service.read())!, status: 'active', completeness_score: 0.8, published_at: '2026-10-28T00:00:00Z', paused_at: null, archived_at: null, removed_at: null, removal_reason: null };
  const item = { propertyId: backend.propertyId, property: { id: backend.propertyId, property_type: 'apartment', city: 'imus', barangay: 'A', bedrooms: 1, bathrooms: 1, furnishing_status: 'unfurnished', is_active: true }, currentListing: row, listings: [row], coverPhoto: null, tier3: { status: 'approved', submissionId: 'a', updatedAt: null } };
  let release!: () => void, mutations = 0; const wait = new Promise<void>(r => { release = r; });
  const h = mountProperty(null, backend.service, { restore: async () => ({ row, pending: false }) }, { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row, operations: [] }), mutate: async () => { mutations++; await wait; return { ...row, status: 'paused', paused_at: '2026-10-29T00:00:00Z' }; } }, undefined, { portfolio: { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [item] } });
  await h.settle(); await h.vm().portfolio.load(); h.flush(); h.vm().openPortfolioItem(backend.propertyId); await h.settle();
  assert.equal(h.vm().lifecycle.request('pause'), true); const pending = h.vm().lifecycle.confirm(); await new Promise<void>(r => setImmediate(r)); h.flush(); assert.equal(h.vm().lifecycleState.busy, true);
  h.bottom().onPost(); await h.settle(); assert.equal(h.vm().screen, 'postingType'); assert.equal(h.vm().workspacePropertyId, null);
  release(); await pending; await h.settle(); assert.equal(mutations, 1); assert.equal(h.vm().screen, 'postingType'); assert.equal(h.vm().lifecycleState.row, null); assert.equal(h.vm().draft.title, ''); h.unmount();
});


function unifiedHarness(failure: 'none' | 'property' | 'uncertain-property' | 'photo' | 'draft' = 'none') {
  const backend = backendDraftService(), events: string[] = [], rows: any[] = [];
  const files = Array.from({ length: 3 }, (_, i) => ({ uri: `file:///cache/composer-${i}.jpg`, fileName: `${i}.jpg`, mimeType: 'image/jpeg', size: 100 }));
  let uncertainPhoto = false, pickerCalls = 0;
  const candidate = { id: 'real-candidate', label: 'Chosen address', longitude: 120.9, latitude: 14.4 };
  const h = mountProperty(null, { ...backend.service, save: async (c: any, form: any) => { events.push('draft'); if (failure === 'draft') throw h.draftError('Check draft status.'); return backend.service.save(c, form); } }, undefined, undefined, { getMapStyleUrl: () => 'fixture-style', searchAddress: async () => [candidate] }, {
    initialScreen: 'postingType', pickImages: async () => { pickerCalls++; return files; },
    creation: { create: async () => { events.push('property'); if (failure === 'property' || failure === 'uncertain-property') throw Object.assign(Error('rejected or unknown'), { code: failure === 'property' ? 'property_creation_rejected' : 'property_creation_uncertain' }); return { propertyId: backend.propertyId, status: 'created' }; } },
    photos: { context: async (propertyId: string) => { assert.equal(propertyId, backend.propertyId); return { ownerId: 'test-owner', propertyId }; }, assertContext: async () => {}, list: async () => [...rows], hasPending: async () => uncertainPhoto,
      upload: async (context: any, file: any) => { assert.equal(context.propertyId, backend.propertyId); events.push(`photo:${file.fileName}`); if (failure === 'photo' && file.fileName === '1.jpg') { uncertainPhoto = true; throw Error('Unknown photo result'); } rows.push({ id: file.fileName, property_id: backend.propertyId, publicUrl: 'https://example.test/photo', storage_path: '', sort_order: rows.length, is_cover: !rows.length, alt_text: null, created_at: '2026-10-29' }); },
    },
  });
  assert.equal(h.vm().screen, 'postingType'); h.vm().beginPropertySetup(); h.flush();
  const fields = () => {
    const creation = h.vm().propertyCreation;
    creation.updateField('propertyType', 'apartment'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Buhay na Tubig'); creation.updateField('addressLine1', 'Owner-entered address'); creation.updateField('floorAreaSqm', '42'); creation.updateField('maxOccupants', '3');
    h.vm().updateDraft('title', 'Before UUID title'); h.vm().updateDraft('description', 'Before UUID description'); h.vm().updateDraft('askingRent', '15000'); h.vm().updateDraft('minimumStayMonths', '6'); h.flush();
  };
  const confirmMap = async () => {
    h.vm().openPropertyLocation(); await h.settle(); assert.equal(h.vm().screen, 'listingComposer');
    const map = h.vm().propertyLocation; map.chooseCandidate(candidate.id); map.mapLoaded(); map.movePoint([120.91, 14.41]); assert.equal(map.confirmExact(), true); h.flush();
  };
  return { h, events, files, backend, fields, confirmMap, picks: () => pickerCalls };
}

test('Property Listing choice renders composer before any property, preserving local photos and all fields across map', async () => {
  const { h, events, fields, files, confirmMap } = unifiedHarness();
  assert.equal(h.vm().screen, 'listingComposer'); assert.ok(h.composerView()); assert.equal(h.vm().workspacePropertyId, null);
  await h.settle(); await h.vm().propertyPhotos.addPhotos(); h.flush(); assert.deepEqual(h.vm().photoState.pendingSelections, files); assert.deepEqual(events, []);
  fields(); await confirmMap(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().propertyState.draft.floorAreaSqm, '42'); assert.equal(h.vm().draft.title, 'Before UUID title'); assert.equal(h.vm().photoState.pendingSelections.length, 3); assert.equal(h.vm().propertyCreation.locationReady(), true);
  h.vm().propertyCreation.updateField('addressLine1', 'New address'); assert.equal(h.vm().propertyCreation.locationReady(), false); assert.equal(h.vm().propertyLocation.getSnapshot().publicPoint, null);
  h.flush(); h.hardwareBack(); h.flush(); assert.equal(h.vm().screen, 'postingType'); assert.equal(h.vm().navigationConfirmation, false); h.hardwareBack(); h.flush(); assert.equal(h.vm().navigationConfirmation, true); h.vm().cancelNavigation(); h.flush(); assert.equal(h.vm().screen, 'postingType'); assert.deepEqual(events, []); h.unmount();
});

test('root Post opens postingType first and Property Listing enters the existing composer without writes', async () => {
  const h=mountProperty(null,{},undefined,undefined,undefined,{initialScreen:'postingType'});await h.settle();assert.equal(h.vm().screen,'postingType');assert.equal(h.composerView(),undefined);assert.equal(h.writes(),0);
  h.vm().beginPropertySetup();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.ok(h.composerView());assert.equal(h.writes(),0);h.vm().goBack();h.flush();assert.equal(h.vm().screen,'postingType');h.unmount();
});
test('Post tab opens chooser; dirty composer Back preserves values and chooser exit stays guarded', async () => {
  const h=mountProperty();h.bottom().onPost();await h.settle();assert.equal(h.vm().screen,'postingType');h.vm().beginPropertySetup();await h.settle();h.vm().updateDraft('title','Keep my title');h.flush();h.hardwareBack();h.flush();assert.equal(h.vm().screen,'postingType');assert.equal(h.vm().draft.title,'Keep my title');assert.equal(h.vm().navigationConfirmation,false);
  h.vm().beginPropertySetup();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().draft.title,'Keep my title');h.hardwareBack();h.flush();h.hardwareBack();h.flush();assert.equal(h.vm().navigationConfirmation,true);h.vm().cancelNavigation();h.flush();assert.equal(h.vm().screen,'postingType');assert.equal(h.vm().draft.title,'Keep my title');assert.equal(h.writes(),0);h.unmount();
});
test('clean posting chooser hardware Back exits through the registered root callback once', async () => {
  const h=mountProperty(null,{},undefined,undefined,undefined,{initialScreen:'postingType'});await h.settle();h.hardwareBack();h.flush();assert.deepEqual(h.destinations,['root']);assert.equal(h.writes(),0);h.unmount();
});
test('direct dashboard property action still opens the existing composer without the root chooser detour', async () => {
  const h=mountProperty();h.vm().startCreate();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.writes(),0);h.unmount();
});
test('composer Save confirms persisted draft before success navigation without losing pre-UUID listing fields', async () => {
  const { h, events, fields, confirmMap, backend, picks } = unifiedHarness(); await h.settle(); await h.vm().propertyPhotos.addPhotos(); fields(); await confirmMap();
  h.vm().nextListingDetails(); await h.settle(); const save = h.vm().saveComposerDraft(); const duplicate = h.vm().saveComposerDraft(); const blockedPicker = h.vm().propertyPhotos.addPhotos(); await Promise.all([save, duplicate, blockedPicker]); assert.equal(picks(), 1); await h.settle();
  assert.deepEqual(events, ['property', 'photo:0.jpg', 'photo:1.jpg', 'photo:2.jpg', 'draft']); assert.equal(h.vm().screen, 'draftSaved');
  assert.equal(h.vm().workspacePropertyId, backend.propertyId); assert.equal(h.vm().listingDraftState.listingId, backend.listingId); assert.equal(h.vm().draft.title, 'Before UUID title'); assert.equal(h.vm().draft.minimumStayMonths, '6'); assert.match(h.vm().composerNotice ?? '', /Listing draft saved/);
  await h.vm().saveComposerDraft(); assert.equal(events.filter(e => e === 'draft').length, 1); assert.equal(events.filter(e => e === 'property').length, 1); h.vm().openSavedDraft(); h.flush(); assert.equal(h.vm().screen, 'preview'); h.unmount();
});
for (const failure of ['property', 'uncertain-property', 'photo', 'draft'] as const) test(`composer ${failure} failure preserves truthful partial state and stays on the same form`, async () => {
  const { h, events, fields, confirmMap, backend } = unifiedHarness(failure); await h.settle(); await h.vm().propertyPhotos.addPhotos(); fields(); await confirmMap(); h.vm().nextListingDetails(); await h.settle();
  await h.vm().saveComposerDraft(); await h.settle(); assert.equal(h.vm().screen, 'listingDetails'); assert.equal(h.vm().draft.title, 'Before UUID title');
  if (failure === 'property' || failure === 'uncertain-property') {
    assert.equal(h.vm().workspacePropertyId, null); assert.equal(h.vm().photoState.pendingSelections.length, 3); assert.deepEqual(events, ['property']);
    if (failure === 'uncertain-property') { await h.vm().saveComposerDraft(); assert.deepEqual(events, ['property']); assert.equal(h.vm().propertyState.uncertain, true); }
  } else {
    assert.equal(h.vm().workspacePropertyId, backend.propertyId);
    if (failure === 'photo') { assert.deepEqual(events, ['property', 'photo:0.jpg', 'photo:1.jpg']); assert.equal(h.vm().photoState.photos.length, 1); assert.equal(h.vm().photoState.needsReconcile, true); assert.equal(h.vm().photoState.pendingSelections.length, 1); await h.vm().saveComposerDraft(); assert.equal(events.filter(e => e === 'property').length, 1); }
    else { assert.equal(h.vm().listingDraftState.uncertain, true); assert.equal(h.vm().photoState.photos.length, 3); await h.vm().saveComposerDraft(); assert.equal(events.filter(e => e === 'draft').length, 1); }
    assert.doesNotMatch(h.vm().composerNotice ?? '', /^Listing draft saved/);
  }
  h.unmount();
});
test('incomplete listing still permits a valid physical property save with truthful local-only listing wording', async () => {
  const { h, events, fields, confirmMap } = unifiedHarness(); await h.settle(); fields(); h.vm().updateDraft('description', ''); h.flush(); await confirmMap(); h.vm().nextListingDetails(); await h.settle();
  await h.vm().saveComposerDraft(); await h.settle(); assert.deepEqual(events, ['property']); assert.equal(h.vm().screen, 'listingDetails'); assert.ok(h.vm().workspacePropertyId); assert.equal(h.vm().listingDraftState.listingId, null); assert.match(h.vm().composerNotice ?? '', /Listing details remain local/); h.unmount();
});
test('local composer preview does not persist or enter sample publication', async () => {
  const { h, events, fields } = unifiedHarness(); await h.settle(); fields(); await h.vm().propertyPhotos.addPhotos(); h.flush(); h.vm().openComposerPreview(); h.flush(); assert.equal(h.vm().screen, 'preview'); assert.equal(h.vm().composerPreview, true); assert.deepEqual(events, []); h.vm().goBack(); h.flush(); assert.equal(h.vm().screen, 'listingDetails'); await h.vm().confirmPublish(); h.flush(); assert.equal(h.vm().screen, 'listingDetails'); assert.deepEqual(events, []); h.unmount();
});


test('Property -> Listing Details -> Preview has exactly two local pages, no Next persistence, and shared dirty scope', async () => {
  const { h, events, fields, confirmMap } = unifiedHarness(); await h.settle(); await h.vm().propertyPhotos.addPhotos(); fields(); await confirmMap();
  h.vm().nextListingDetails(); await h.settle(); assert.equal(h.vm().screen, 'listingDetails'); assert.equal(h.vm().workspacePropertyId, null); assert.deepEqual(events, []); assert.equal(h.vm().navigationConfirmation, false);
  h.hardwareBack(); h.flush(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().navigationConfirmation, false); assert.equal(h.vm().draft.title, 'Before UUID title'); assert.equal(h.vm().photoState.pendingSelections.length, 3);
  h.vm().nextListingDetails(); await h.settle(); h.vm().openComposerPreview(); h.flush(); assert.equal(h.vm().screen, 'preview'); h.vm().goBack(); h.flush(); assert.equal(h.vm().screen, 'listingDetails');
  h.vm().editComposerProperty(); h.flush(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().propertyCreation.locationReady(), true);
  h.vm().requestNavigation(() => h.destinations.push('exit')); h.flush(); assert.equal(h.vm().navigationConfirmation, true); assert.deepEqual(events, []); h.vm().cancelNavigation(); h.flush(); assert.equal(h.vm().draft.minimumStayMonths, '6'); h.unmount();
});
test('Property gallery Android Back closes its viewer and leaves form/local files intact without exit confirmation', async () => {
  const { h, events, fields } = unifiedHarness(); await h.settle(); fields(); await h.vm().propertyPhotos.addPhotos(); h.vm().propertyPhotos.openMedia(2); h.flush();
  assert.equal(h.vm().photoState.mediaViewerOpen, true); h.hardwareBack(); h.flush(); assert.equal(h.vm().photoState.mediaViewerOpen, false); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().photoState.pendingSelections.length, 3); assert.equal(h.vm().draft.title, 'Before UUID title'); assert.equal(h.vm().navigationConfirmation, false); assert.deepEqual(events, []); h.unmount();
});

test('actual ViewModel prefers the saved server completeness even after local edits',async()=>{const backend=backendDraftService(true),h=mountProperty(backend.propertyId,backend.service);await h.setup();await h.vm().listingDraftPersistence.load();await h.settle();assert.equal(h.vm().completeness.source,'server');assert.equal(h.vm().completeness.percent,50);h.vm().updateDraft('description','x'.repeat(100));h.flush();assert.equal(h.vm().completeness.percent,50);h.unmount();});
test('actual catalogue selection updates DraftProperty IDs once and toggles off without backend writes',async()=>{const h=mountProperty(null,{},undefined,undefined,undefined,{amenities:{load:async()=>({userId:'test-owner',catalog:[{id:61,name:'Wi-Fi',category:'Connectivity',is_active:true}],selectedIds:[],hasPrivateLocation:false})}});await h.setup();h.vm().togglePropertyAmenity(61);h.flush();assert.deepEqual(h.vm().propertyState.draft.amenityIds,[61]);h.vm().togglePropertyAmenity(99);h.flush();assert.deepEqual(h.vm().propertyState.draft.amenityIds,[61]);h.vm().togglePropertyAmenity(61);h.flush();assert.deepEqual(h.vm().propertyState.draft.amenityIds,[]);assert.equal(h.writes(),0);h.unmount();});


test('immediate photo navigation adopts the confirmed UUID before the render handoff effect',async()=>{
  const backend=backendDraftService();let creates=0;
  const h=mountProperty(null,backend.service,undefined,undefined,undefined,{creation:{create:async()=>{creates++;return {propertyId:backend.propertyId,status:'created'};}},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>[],hasPending:async()=>false}});
  await h.setup();const f=h.vm().propertyCreation;f.updateField('propertyType','studio');f.updateField('city','imus');f.updateField('barangay','Fixture');f.updateField('addressLine1','Fixture street');f.provideConfirmedLocation({exactLatitude:14.4,exactLongitude:120.9,publicLatitude:14.401,publicLongitude:120.901},f.getSnapshot().locationRevision);f.next();f.next();await f.submit();
  // Deliberately navigate before React commits the created snapshot.
  h.vm().navigate('photoManager');await h.settle();assert.equal(h.vm().screen,'photoManager');assert.equal(h.vm().workspacePropertyId,backend.propertyId);assert.equal(h.vm().photoState.propertyId,backend.propertyId);assert.equal(h.vm().photoState.loaded,true);
  h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().workspacePropertyId,backend.propertyId);assert.equal(creates,1);h.unmount();
});

test('initial draft hydration retains locally entered listing fields and keeps backend baseline distinct',async()=>{
  const backend=backendDraftService(true),h=mountProperty(backend.propertyId,backend.service);
  h.vm().updateDraft('title','Keep the entered title');h.flush();await h.setup();await h.settle();
  assert.equal(h.vm().draft.title,'Keep the entered title');assert.equal(h.vm().draft.description,'Loaded description');assert.equal(h.vm().listingDraftState.lastConfirmed?.title,'Loaded draft title');
  h.vm().requestNavigation(()=>h.destinations.push('exit'));h.flush();assert.equal(h.vm().navigationConfirmation,true);h.vm().cancelNavigation();h.flush();assert.equal(h.vm().draft.title,'Keep the entered title');h.unmount();
});


for(const tier3 of ['pending','approved'] as const)test(`owned photos and listing draft remain editable with property Tier 3 ${tier3}`,async()=>{
  const backend=backendDraftService(true),row=(await backend.service.read())!;
  const item={propertyId:backend.propertyId,property:{id:backend.propertyId,property_type:'studio',city:'imus',barangay:'Fixture',bedrooms:1,bathrooms:1,furnishing_status:'unfurnished',floor_area_sqm:32,max_occupants:2,is_active:true},currentListing:row,listings:[row],tier3:{status:tier3}};
  let loads=0;const h=mountProperty(null,backend.service,undefined,undefined,undefined,{portfolio:{user:async()=> 'test-owner',assertUser:async()=>{},load:async()=>[item]},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>{loads++;return [];},hasPending:async()=>false}});
  await h.settle();await h.vm().portfolio.load();h.flush();h.vm().openPortfolioItem(backend.propertyId);await h.settle();assert.equal(h.vm().listingDraftReadOnly,false);assert.equal(h.vm().photoState.loaded,true);assert.ok(loads>0);
  h.vm().updateDraft('title','Corrected rental');h.flush();await h.vm().saveDraft();h.flush();assert.equal(backend.calls(),1);assert.equal(h.vm().workspacePropertyId,backend.propertyId);assert.equal(h.writes(),0);h.unmount();
});

test('restored creation receipt hydrates physical summary through owned portfolio without recreating property',async()=>{
  const backend=backendDraftService(),item={propertyId:backend.propertyId,property:{id:backend.propertyId,property_type:'studio',city:'imus',barangay:'Saved barangay',bedrooms:2,bathrooms:1,furnishing_status:'furnished',floor_area_sqm:44,max_occupants:3,is_active:true},currentListing:null,listings:[],tier3:{status:'pending'}};
  const h=mountProperty(backend.propertyId,backend.service,undefined,undefined,undefined,{portfolio:{user:async()=> 'test-owner',assertUser:async()=>{},load:async()=>[item]},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>[],hasPending:async()=>false}});
  await h.setup();h.vm().continueListingPreview();await h.settle();assert.equal(h.vm().workspacePropertyId,backend.propertyId);assert.equal(h.vm().propertySummary.floorAreaSqm,'44');assert.equal(h.vm().propertySummary.location,'Saved barangay, Imus');assert.equal(h.vm().photoState.propertyId,backend.propertyId);assert.equal(h.writes(),0);assert.equal(backend.calls(),0);h.unmount();
});

test('property-only 40 percent and complete rental estimate use the same unchanged listing formula',async()=>{
  const backend=backendDraftService(),item={propertyId:backend.propertyId,property:{id:backend.propertyId,property_type:'studio',city:'imus',barangay:'Fixture',bedrooms:1,bathrooms:1,furnishing_status:'unfurnished',floor_area_sqm:32,max_occupants:2,is_active:true},currentListing:null,listings:[],tier3:{status:'pending'}};
  const h=mountProperty(null,backend.service,undefined,undefined,undefined,{portfolio:{user:async()=> 'test-owner',assertUser:async()=>{},load:async()=>[item]},amenities:{load:async()=>({userId:'test-owner',catalog:[{id:1,name:'Water',is_active:true}],selectedIds:[1],hasPrivateLocation:true}),assertUser:async()=>{}},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>[],hasPending:async()=>false}});
  await h.settle();await h.vm().portfolio.load();h.flush();h.vm().openPortfolioItem(backend.propertyId);await h.settle();assert.equal(h.vm().completeness.percent,40);assert.equal(h.vm().completeness.source,'estimate');
  h.vm().updateDraft('title','Rental');h.vm().updateDraft('description','A clear description of this property with enough detail.');h.vm().updateDraft('askingRent','12000');h.vm().updateDraft('availableDate','2026-11-01');h.flush();assert.equal(h.vm().completeness.percent,80);h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().completeness.percent,80);h.unmount();
});


test('draft hydration remains deterministic when development React replays state updaters',async()=>{
  const backend=backendDraftService(true),h=mountProperty(backend.propertyId,backend.service,undefined,undefined,undefined,{replayUpdaters:true});
  h.vm().updateDraft('title','Keep local title');h.flush();await h.setup();await h.settle();assert.equal(h.vm().draft.title,'Keep local title');assert.equal(h.vm().draft.description,'Loaded description');assert.equal(h.vm().draft.askingRent,'12000');h.unmount();
});


test('invalid property Save returns to the first incorrect section without RPC and retains every draft',async()=>{
 const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();h.vm().nextListingDetails();await h.settle();
 h.vm().propertyCreation.updateField('floorNumber','8');h.vm().propertyCreation.updateField('totalFloors','2');h.flush();await h.vm().saveComposerDraft();h.flush();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().propertyValidationTarget?.section,'floors');assert.equal(h.vm().propertyValidationTarget?.field,'floorNumber');assert.equal(h.vm().draft.title,'Before UUID title');assert.equal(h.vm().propertyState.draft.floorNumber,'8');assert.deepEqual(events,[]);
 const first=h.vm().propertyValidationTarget!.requestId;h.vm().focusPropertyIssue(h.vm().propertyValidationIssues.find(i=>i.section==='floors')!);h.flush();assert.ok(h.vm().propertyValidationTarget!.requestId>first);
 h.vm().propertyCreation.updateField('propertyType','house');h.flush();assert.equal(h.vm().propertyState.draft.floorNumber,'8');assert.equal(h.vm().propertyFloorIssues.floorNumber,null);h.vm().propertyCreation.updateField('propertyType','apartment');h.flush();assert.ok(h.vm().propertyFloorIssues.floorNumber);assert.deepEqual(events,[]);h.unmount();
});
test('validation correction callbacks cannot navigate an unmounted account workspace',async()=>{
 const h=mountProperty();await h.setup();const old=h.vm(),issue=old.propertyValidationIssues[0]!;h.unmount();old.focusPropertyIssue(issue);assert.equal(old.propertyValidationTarget,null);assert.equal(h.writes(),0);
});


test('legacy Review Save navigates to invalid floor fields without clearing inputs or creating a property',async()=>{
 const h=mountProperty();await h.setup();const flow=h.vm().propertyCreation;flow.updateField('propertyType','apartment');flow.updateField('city','imus');flow.updateField('barangay','Fixture');flow.updateField('addressLine1','Fixture address');flow.provideConfirmedLocation({exactLatitude:14.4,exactLongitude:120.9,publicLatitude:14.401,publicLongitude:120.901},flow.getSnapshot().locationRevision);flow.next();flow.next();h.flush();assert.equal(h.vm().propertyState.step,'review');
 flow.updateField('floorNumber','8');flow.updateField('totalFloors','2');h.flush();await h.vm().submitProperty();h.flush();assert.equal(h.vm().propertyState.step,'details');assert.equal(h.vm().propertyValidationTarget?.section,'floors');assert.equal(h.vm().propertyState.draft.floorNumber,'8');assert.equal(h.vm().propertyState.draft.addressLine1,'Fixture address');assert.equal(h.writes(),0);h.unmount();
});


test('Stage 1 untouched Property form is neutral, incomplete, disabled and never advances',async()=>{
 const {h,events}=unifiedHarness();await h.settle();assert.equal(h.vm().propertyNextDisabled,true);assert.equal(h.vm().propertyFormReady,false);assert.deepEqual(h.vm().propertyVisibleValidationIssues,[]);assert.match(h.vm().propertyNextStatus,/property type/i);
 h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.ok(h.vm().propertyVisibleValidationIssues.length>0);assert.deepEqual(events,[]);h.unmount();
});
test('Stage 1 required errors follow interaction and disappear when corrected',async()=>{
 const {h,events}=unifiedHarness();await h.settle();const flow=h.vm().propertyCreation;
 flow.updateField('barangay','');h.flush();assert.deepEqual(h.vm().propertyVisibleValidationIssues.map(i=>i.field),['barangay']);flow.updateField('barangay','Corrected barangay');h.flush();assert.equal(h.vm().propertyVisibleValidationIssues.length,0);assert.equal(h.vm().propertyNextDisabled,true);assert.deepEqual(events,[]);h.unmount();
});
test('Stage 1 Next uses physical readiness and confirmed location, independent of listing completeness',async()=>{
 const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();h.vm().updateDraft('title','');h.vm().updateDraft('description','');h.vm().updateDraft('askingRent','');h.flush();assert.equal(h.vm().propertyNextDisabled,true);
 h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().propertyValidationTarget?.section,'location');assert.equal(h.vm().screen,'listingComposer');await confirmMap();assert.equal(h.vm().propertyFormReady,true);assert.equal(h.vm().propertyNextDisabled,false);assert.ok(h.vm().completeness.percent<80);assert.match(h.vm().propertyNextStatus,/not saved/i);
 h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().workspacePropertyId,null);assert.deepEqual(events,[]);h.unmount();
});
test('Stage 1 optional floor inconsistency blocks Next, preserves entries and clears after correction',async()=>{
 const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();const flow=h.vm().propertyCreation;flow.updateField('floorNumber','8');flow.updateField('totalFloors','2');h.flush();assert.equal(h.vm().propertyNextDisabled,true);assert.ok(h.vm().propertyVisibleValidationIssues.some(i=>i.section==='floors'&&i.kind==='invalid'));h.vm().nextListingDetails();h.flush();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().propertyState.draft.floorNumber,'8');assert.equal(h.vm().draft.title,'Before UUID title');
 flow.updateField('floorNumber','2');h.flush();assert.equal(h.vm().propertyFloorIssues.floorNumber,null);assert.equal(h.vm().propertyNextDisabled,false);assert.deepEqual(events,[]);h.unmount();
});

 test('confirmed draft success hardware Back returns to My Listings without resaving', async () => {
 const {h,events,fields,confirmMap}=unifiedHarness(); await h.settle();fields();await confirmMap();h.vm().nextListingDetails();await h.settle();await h.vm().saveComposerDraft();await h.settle();assert.equal(h.vm().screen,'draftSaved');h.hardwareBack();h.flush();assert.equal(h.vm().screen,'dashboard');assert.equal(h.vm().navigationConfirmation,false);assert.deepEqual(events,['property','draft']);h.unmount();
 });

for (const outcome of ['success','rejected','unmount'] as const) test(`draft Save delayed ${outcome} preserves payload, blocks Back and excludes duplicates`, async () => {
 const backend=backendDraftService(true);let release!:()=>void;const wait=new Promise<void>(r=>release=r);let attempts=0;
 const h=mountProperty(backend.propertyId,{...backend.service,save:async(c:any,f:any)=>{attempts++;await wait;if(outcome==='rejected')throw Error('private failure');return backend.service.save(c,f);}});
 await h.setup();h.vm().navigate('listingDetails');h.flush();h.vm().updateDraft('title','Keep entered title');h.flush();const save=h.vm().saveDraft();h.flush();
 assert.equal(h.vm().listingDraftState.busy,true);assert.equal(h.vm().screen,'listingDetails');h.vm().updateDraft('title','Changed while saving');h.hardwareBack();h.bottom().onChat();h.flush();assert.equal(h.vm().draft.title,'Keep entered title');assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().navigationConfirmation,false);assert.deepEqual(h.destinations,[]);
 await h.vm().saveDraft();await new Promise<void>(r=>setImmediate(r));assert.equal(attempts,1);
 if(outcome==='unmount')h.unmount();release();await save;
 if(outcome==='unmount'){assert.notEqual(h.vm().screen,'draftSaved');return;}
 await h.settle();assert.equal(h.vm().screen,outcome==='success'?'draftSaved':'listingDetails');assert.equal(h.vm().draft.title,'Keep entered title');
 if(outcome==='rejected'){assert.equal(h.vm().listingDraftState.errorSource,'save');assert.equal(h.vm().listingDraftState.uncertain,false);assert.doesNotMatch(h.vm().listingDraftState.error??'',/private failure/);}
 h.unmount();
});
 test('known save failure can explicitly retry the same entered draft then open confirmation',async()=>{
 const backend=backendDraftService(true);let fail=true;let attempts=0;const h=mountProperty(backend.propertyId,{...backend.service,save:async(c:any,f:any)=>{attempts++;if(fail)throw Error('private');return backend.service.save(c,f);}});await h.setup();h.vm().navigate('listingDetails');h.vm().updateDraft('title','Corrected saved title');h.flush();await h.vm().saveDraft();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().draft.title,'Corrected saved title');fail=false;await h.vm().saveDraft();await h.settle();assert.equal(h.vm().screen,'draftSaved');assert.equal(attempts,2);h.vm().goDashboard();h.flush();assert.equal(h.vm().screen,'dashboard');h.unmount();
 });
 test('uncertain draft reconciliation never navigates to save success or resends',async()=>{
 const {h,events,fields,confirmMap}=unifiedHarness('draft');await h.settle();fields();await confirmMap();h.vm().nextListingDetails();await h.settle();await h.vm().saveComposerDraft();await h.settle();assert.equal(h.vm().listingDraftState.uncertain,true);await h.vm().listingDraftPersistence.reconcile();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().listingDraftState.uncertain,false);assert.equal(events.filter(e=>e==='draft').length,1);h.unmount();
 });

test('Listing Details Review Publication uses explicit confirmation and preserves unsaved edits',async()=>{
 const backend=backendDraftService(true);let published=0;const row=await backend.service.read();const h=mountProperty(backend.propertyId,backend.service,{restore:async()=>null,context:async()=>({userId:'test-owner',propertyId:backend.propertyId,listingId:backend.listingId}),assertContext:async()=>{},publish:async()=>{published++;return{...row,status:'active',completeness_score:.8,published_at:'2026-11-01T00:00:00Z'};}});await h.setup();h.vm().navigate('listingDetails');h.flush();assert.equal(h.vm().publicationReview.visible,true);h.vm().updateDraft('title','Unsaved corrected title');h.flush();h.vm().requestPublish();h.flush();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().draft.title,'Unsaved corrected title');assert.match(h.vm().publicationReview.message,/Save your listing changes/);assert.equal(published,0);
 await h.vm().saveDraft();h.flush();assert.equal(h.vm().screen,'draftSaved');h.vm().openSavedDraft();h.flush();h.vm().navigate('listingDetails');h.flush();h.vm().requestPublish();h.flush();assert.equal(h.vm().screen,'publishConfirmation');assert.ok(!h.vm().publicationState.error);assert.equal(published,0);await h.vm().confirmPublish();await h.settle();assert.equal(published,1);assert.equal(h.vm().screen,'published');assert.equal(h.vm().publicationReview.state,'Active');assert.equal(h.vm().publicationReview.visible,false);h.unmount();
});
