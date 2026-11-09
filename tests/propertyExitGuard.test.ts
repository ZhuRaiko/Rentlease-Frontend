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
function mountProperty(persistedProperty: string | null = null, draftService: any = {}, publicationService: any = { restore: async () => null }, lifecycleService?: any, locationService?: any, overrides: { deletion?:any; identity?:any; routine?:any; published?:any; verification?: any; renderPropertyVerification?: any; amenities?: any; creation?: any; photos?: any; pickImages?: any; portfolio?: any; initialScreen?: 'dashboard' | 'postingType'; replayUpdaters?: boolean } = {}) {
  let cursor = 0, current: PropertyListingViewModel, mounted = true;
  const slots: any[] = [], effects: (() => void)[] = [], cache = new Map<string, any>();
  let writes = 0, tree: any, realHook: any, backAction: (() => void) | null = null;
  const destinations: string[] = [];
  const renderStates:{status:string;propertyEditAvailable:boolean}[]=[];
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
      const presentation = ['UnfinishedPostDeletionAction','RentalPriceGuidance','InlineRentalEstimate','PropertyModelAttributeFields','AppButton', 'FeedbackNotice', 'ListingButton', 'NavigationConfirmation', 'RentLeaseBottomNavigation', 'ScreenContainer', 'CreateListingView', 'ListingComposerView', 'ListingDetailsView', 'ListingDraftSavedView', 'PropertyRoutineEditView', 'PropertyIdentityEditView', 'ListingDetailView', 'ListingManagementView', 'ListingPreviewView', 'PropertyDashboardView', 'PublishedListingStatusView', 'ListingWorkspaceFeedback', 'ListingWizardScaffold'];
      const component = presentation.find(value => name.endsWith('/' + value));
      if (component) return { [component]: component };
      if(name.endsWith('/unfinishedPostDependencies'))return {unfinishedPostService:overrides.deletion??{inspect:async(id:string)=>({propertyId:id,state:'live',eligible:false,reason:null}),pending:async()=>[],remove:async()=>{throw Error('Not configured');}}};
      if (name.endsWith('/propertyVerificationDependencies')) return {propertyVerificationService:overrides.verification??{getEligibleUserId:async()=>'test-owner',fetchLatest:async()=>null}};
      if (name.endsWith('/landlordPortfolioDependencies')) return { landlordPortfolioService: overrides.portfolio ?? { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [] } };
      if (name.endsWith('/listingLifecycleDependencies')) return { listingLifecycleService: lifecycleService ?? { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row: current.publicationState.lastConfirmed, operations: [] }) } };
      if (name.endsWith('/listingPublicationDependencies')) return { listingPublicationService: publicationService };
      if(name.endsWith('/propertyIdentityDependencies'))return {propertyIdentityService:overrides.identity??{load:async()=>{throw Error('Identity read not configured');},hasPending:async()=>false}};
      if(name.endsWith('/propertyRoutineDependencies'))return {propertyRoutineService:overrides.routine??{load:async()=>{throw Error('Routine read not configured');},hasPending:async()=>false}};
      if(name.endsWith('/publishedListingDependencies'))return {publishedListingService:overrides.published??draftService};
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
  const props = { renderPropertyVerification:overrides.renderPropertyVerification, initialScreen: overrides.initialScreen ?? 'dashboard', registerBackAction: (action: (() => void) | null) => { backAction = action; }, onRootBack: () => destinations.push('root'), onClose: () => destinations.push('Close'), onOpenDiscover: () => destinations.push('Discover'), onOpenChat: () => destinations.push('Chat'), onOpenMaintenance: () => destinations.push('Tenancy') };
  const flush = () => { assert.ok(mounted); cursor = 0; tree = PropertyListingFlowView(props); renderStates.push({status:current!.draftHydration.status,propertyEditAvailable:current!.propertyEditAvailable}); while (effects.length) effects.shift()!(); return current; };
  const componentProps = (name: string): any => {
    const visit = (node: any): any => node?.type === name ? node.props : (Array.isArray(node?.props?.children) ? node.props.children : [node?.props?.children]).filter(Boolean).map(visit).find(Boolean);
    return visit(tree);
  };
  flush();
  if (!overrides.initialScreen) { current!.navigate('postingType'); flush(); }
  return {
    vm: () => current!, flush, renderStates,
    async settle() { for (let i = 0; i < 3; i++) { await new Promise<void>(resolve => setImmediate(resolve)); flush(); } },
    draftConflict: (message:string)=>new (load('src/features/property-listing/models/PersistedListingDraft.ts').ListingDraftError)(message,'conflict'),
    draftError: (message: string) => new (load('src/features/property-listing/models/PersistedListingDraft.ts').ListingDraftError)(message, 'uncertain'),
    contextModal:()=>componentProps('Modal'),
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
  const f = h.vm().propertyCreation; f.updateField('bedrooms','0'); f.updateField('bathrooms','0'); f.updateField('city', 'imus'); f.updateField('barangay', 'Example'); f.updateField('addressLine1', 'Example street'); f.next(); f.next(); h.flush();
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
  const row = { edit_version:'50000000-0000-4000-8000-000000000001', id: listingId, property_id: propertyId, landlord_id: 'test-owner', title: 'Loaded draft title', description: 'Loaded description', asking_rent_monthly: 12000, house_rules: null, rental_term: 'long_term', security_deposit_months: 1, advance_rent_months: 1, minimum_stay_months: null, available_from: null, status: 'draft', completeness_score: 0.5, created_at: '2026-10-24T00:00:00Z', updated_at: '2026-10-24T00:00:00Z' };
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
  creation.updateField('bedrooms', '0'); creation.updateField('bathrooms', '0'); creation.updateField('propertyType', 'studio'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Example barangay'); creation.updateField('addressLine1', 'Example street'); creation.next(); h.flush();
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
  creation.updateField('bedrooms', '0'); creation.updateField('bathrooms', '0'); creation.updateField('propertyType', 'apartment'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Buhay na Tubig'); creation.updateField('addressLine1', 'Private address');
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
    creation.updateField('bedrooms', '0'); creation.updateField('bathrooms', '0'); creation.updateField('propertyType', 'apartment'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Buhay na Tubig'); creation.updateField('addressLine1', 'Owner-entered address'); creation.updateField('floorAreaSqm', '42'); creation.updateField('maxOccupants', '3');
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
  if(failure!=='property'&&failure!=='uncertain-property')await h.vm().saveComposerDraft(); await h.settle(); assert.equal(h.vm().screen, failure==='property'||failure==='uncertain-property'?'listingComposer':'listingDetails'); assert.equal(h.vm().draft.title, 'Before UUID title');
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


test('Property -> Listing Details saves the physical property once, retains local listing fields and shared dirty scope', async () => {
  const { h, events, fields, confirmMap } = unifiedHarness(); await h.settle(); await h.vm().propertyPhotos.addPhotos(); fields(); await confirmMap();
  h.vm().nextListingDetails(); await h.settle(); assert.equal(h.vm().screen, 'listingDetails'); assert.ok(h.vm().workspacePropertyId); assert.deepEqual(events, ['property']); assert.equal(h.vm().navigationConfirmation, false);
  h.hardwareBack(); h.flush(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().navigationConfirmation, false); assert.equal(h.vm().draft.title, 'Before UUID title'); assert.equal(h.vm().photoState.pendingSelections.length, 3);
  h.vm().nextListingDetails(); await h.settle(); h.vm().openComposerPreview(); h.flush(); assert.equal(h.vm().screen, 'preview'); h.vm().goBack(); h.flush(); assert.equal(h.vm().screen, 'listingDetails');
  h.vm().editComposerProperty(); h.flush(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().propertyCreation.locationReady(), true);
  h.vm().requestNavigation(() => h.destinations.push('exit')); h.flush(); assert.equal(h.vm().navigationConfirmation, true); assert.deepEqual(events, ['property']); h.vm().cancelNavigation(); h.flush(); assert.equal(h.vm().draft.minimumStayMonths, '6'); h.unmount();
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
  await h.setup();const f=h.vm().propertyCreation;f.updateField('bedrooms','0');f.updateField('bathrooms','0');f.updateField('propertyType','studio');f.updateField('city','imus');f.updateField('barangay','Fixture');f.updateField('addressLine1','Fixture street');f.provideConfirmedLocation({exactLatitude:14.4,exactLongitude:120.9,publicLatitude:14.401,publicLongitude:120.901},f.getSnapshot().locationRevision);f.next();f.next();await f.submit();
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
 const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();
 h.vm().propertyCreation.updateField('floorNumber','8');h.vm().propertyCreation.updateField('totalFloors','2');h.flush();await h.vm().saveComposerDraft();h.flush();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().propertyValidationTarget?.section,'floors');assert.equal(h.vm().propertyValidationTarget?.field,'floorNumber');assert.equal(h.vm().draft.title,'Before UUID title');assert.equal(h.vm().propertyState.draft.floorNumber,'8');assert.deepEqual(events,[]);
 const first=h.vm().propertyValidationTarget!.requestId;h.vm().focusPropertyIssue(h.vm().propertyValidationIssues.find(i=>i.section==='floors')!);h.flush();assert.ok(h.vm().propertyValidationTarget!.requestId>first);
 h.vm().propertyCreation.updateField('propertyType','house');h.flush();assert.equal(h.vm().propertyState.draft.floorNumber,'8');assert.equal(h.vm().propertyFloorIssues.floorNumber,null);h.vm().propertyCreation.updateField('propertyType','apartment');h.flush();assert.ok(h.vm().propertyFloorIssues.floorNumber);assert.deepEqual(events,[]);h.unmount();
});
test('validation correction callbacks cannot navigate an unmounted account workspace',async()=>{
 const h=mountProperty();await h.setup();const old=h.vm(),issue=old.propertyValidationIssues[0]!;h.unmount();old.focusPropertyIssue(issue);assert.equal(old.propertyValidationTarget,null);assert.equal(h.writes(),0);
});


test('legacy Review Save navigates to invalid floor fields without clearing inputs or creating a property',async()=>{
 const h=mountProperty();await h.setup();const flow=h.vm().propertyCreation;flow.updateField('bedrooms','0');flow.updateField('bathrooms','0');flow.updateField('propertyType','apartment');flow.updateField('city','imus');flow.updateField('barangay','Fixture');flow.updateField('addressLine1','Fixture address');flow.provideConfirmedLocation({exactLatitude:14.4,exactLongitude:120.9,publicLatitude:14.401,publicLongitude:120.901},flow.getSnapshot().locationRevision);flow.next();flow.next();h.flush();assert.equal(h.vm().propertyState.step,'review');
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
 h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().propertyValidationTarget?.section,'location');assert.equal(h.vm().screen,'listingComposer');await confirmMap();assert.equal(h.vm().propertyFormReady,true);assert.equal(h.vm().propertyNextDisabled,false);assert.ok(h.vm().completeness.percent<80);assert.match(h.vm().propertyNextStatus,/Next saves/i);
 h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.ok(h.vm().workspacePropertyId);assert.deepEqual(events,['property']);h.unmount();
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

test('context verification preserves unsaved listing and workspace until read-only return refresh',async()=>{
 const backend=backendDraftService(true);const h=mountProperty(backend.propertyId,backend.service);await h.setup();h.vm().navigate('listingDetails');h.vm().updateDraft('title','Unsaved contextual title');h.flush();await h.settle();await h.vm().propertyVerification.open();h.flush();assert.equal(h.vm().propertyVerificationState.entryPropertyId,backend.propertyId);assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().draft.title,'Unsaved contextual title');assert.equal(h.vm().workspacePropertyId,backend.propertyId);h.bottom().onChat();h.flush();assert.deepEqual(h.destinations,[]);assert.equal(h.vm().navigationConfirmation,false);await h.vm().propertyVerification.close();h.flush();assert.equal(h.vm().propertyVerificationState.entryPropertyId,null);assert.equal(h.vm().draft.title,'Unsaved contextual title');assert.equal(h.vm().listingDraftState.listingId,backend.listingId);assert.equal(backend.calls(),0);h.unmount();
});

test('contextual verification modal hands off the physical UUID and delegates Android Back',async()=>{
 const backend=backendDraftService(true);let target:string|null=null,back=0,close:(()=>void)|null=null;const h=mountProperty(backend.propertyId,backend.service,undefined,undefined,undefined,{renderPropertyVerification:(id:string,onClose:()=>void,register:(fn:()=>void)=>void)=>{target=id;close=onClose;register(()=>back++);return{type:'ExistingVerification',props:{}};}});await h.setup();h.vm().navigate('listingDetails');await h.settle();h.vm().updateDraft('title','Retain me');h.flush();await h.vm().propertyVerification.open();h.flush();assert.equal(target,backend.propertyId);assert.notEqual(target,backend.listingId);h.contextModal().onRequestClose();assert.equal(back,1);assert.equal(h.vm().draft.title,'Retain me');assert.ok(close);(close as ()=>void)();await h.settle();assert.equal(h.vm().propertyVerificationState.entryPropertyId,null);assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().draft.title,'Retain me');assert.equal(backend.calls(),0);h.unmount();
});

test('My Listings verifies a physical property directly and refreshes the batch on return without entering the editor',async()=>{
 const backend=backendDraftService(true);const row=await backend.service.read();let status='not_submitted',loads=0;const item=()=>({propertyId:backend.propertyId,property:{id:backend.propertyId,property_type:'house',city:'imus',barangay:'A',is_active:true},currentListing:row,listings:[row],tier3:{status,submissionId:null,updatedAt:null},coverPhoto:null});const h=mountProperty(null,backend.service,undefined,undefined,undefined,{initialScreen:'dashboard',portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>{loads++;return[item()];}},verification:{getEligibleUserId:async()=>'test-owner',fetchLatest:async(_owner:string,id:string)=>status==='not_submitted'?null:{id:'submission',property_id:id,status}}});await h.settle();h.vm().setListingQuery('Loaded');h.flush();const before=loads;await h.vm().openPortfolioVerification(backend.propertyId);h.flush();assert.equal(h.vm().screen,'dashboard');assert.equal(h.vm().workspacePropertyId,null);assert.equal(h.vm().propertyVerificationState.entryPropertyId,backend.propertyId);status='pending';await h.vm().closePropertyVerification();await h.settle();assert.ok(loads>before);assert.equal(h.vm().portfolioState.items[0]?.tier3.status,'pending');assert.equal(h.vm().portfolioState.query,'Loaded');assert.equal(h.vm().screen,'dashboard');assert.equal(backend.calls(),0);h.unmount();
});
test('approved My Listings draft loads its exact persisted row before publication review without publishing',async()=>{
 const backend=backendDraftService(true),row=await backend.service.read();const item={propertyId:backend.propertyId,property:{id:backend.propertyId,property_type:'house',city:'imus',barangay:'A',is_active:true},currentListing:{...row,completeness_score:1},listings:[row],tier3:{status:'approved',submissionId:'submission',updatedAt:null},coverPhoto:null};let publishes=0;const h=mountProperty(null,backend.service,{restore:async()=>null,publish:async()=>{publishes++;}},undefined,undefined,{initialScreen:'dashboard',photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>[],hasPending:async()=>false},portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>[item]}});await h.settle();h.vm().reviewPortfolioPublication(backend.propertyId);await h.settle();await h.settle();assert.equal(h.vm().screen,'publishConfirmation');assert.equal(h.vm().listingDraftState.listingId,backend.listingId);assert.equal(h.vm().draft.title,row!.title);assert.equal(publishes,0);assert.equal(backend.calls(),0);h.unmount();
});

test('fresh approval discovered when tapping a stale card refreshes My Listings without opening or publishing',async()=>{
 const backend=backendDraftService(true),row=await backend.service.read();let status='not_submitted',loads=0;const h=mountProperty(null,backend.service,undefined,undefined,undefined,{initialScreen:'dashboard',portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>{loads++;return[{propertyId:backend.propertyId,property:{id:backend.propertyId,property_type:'house',city:'imus',barangay:'A',is_active:true},currentListing:row,listings:[row],tier3:{status},coverPhoto:null}];}},verification:{getEligibleUserId:async()=>'test-owner',fetchLatest:async(_user:string,id:string)=>{status='approved';return{property_id:id,status:'approved'};}}});await h.settle();const before=loads;await h.vm().openPortfolioVerification(backend.propertyId);await h.settle();assert.equal(h.vm().screen,'dashboard');assert.equal(h.vm().propertyVerificationState.entryPropertyId,null);assert.equal(h.vm().portfolioState.items[0]?.tier3.status,'approved');assert.ok(loads>before);assert.equal(backend.calls(),0);h.unmount();
});

test('draft conflict reload retains local edits and uses refreshed baseline without automatic retry',async()=>{
 const backend=backendDraftService(true);let latest=await backend.service.read(),attempts=0,fail=true;const h=mountProperty(backend.propertyId,{...backend.service,read:async()=>latest,reconcile:async()=>latest,save:async(c:any,f:any)=>{attempts++;if(fail)throw h.draftConflict('Draft changed. Load latest saved version.');return backend.service.save(c,f);}});await h.setup();h.vm().navigate('listingDetails');await h.settle();h.vm().updateDraft('title','Local title retained');h.flush();await h.vm().saveDraft();h.flush();assert.equal(h.vm().listingDraftState.conflict,true);assert.equal(h.vm().draft.title,'Local title retained');h.vm().requestPublish();h.flush();assert.equal(h.vm().screen,'listingDetails');assert.match(h.vm().publicationState.error??'',/Load the latest saved version/);latest={...latest!,title:'Other session title',description:'Other session description',edit_version:'50000000-0000-4000-8000-000000000099'};await h.vm().listingDraftPersistence.reconcile();h.flush();assert.equal(h.vm().draft.title,'Local title retained');assert.equal(h.vm().draft.description,'Other session description');assert.equal(h.vm().listingDraftState.conflict,false);assert.equal(attempts,1);fail=false;await h.vm().saveDraft();h.flush();assert.equal(h.vm().screen,'draftSaved');assert.equal(attempts,2);h.unmount();
});


function savedHydrationHarness(){
 const backend=backendDraftService(true);let row:any;let fail=false;let listingReads=0,restores=0,photoReads=0,amenityReads=0;let resolveRestore:()=>void=()=>{};let wait:Promise<void>|null=null;
 const init=async()=>{row=await backend.service.read();row={...row,available_from:'2026-12-20',description:'Saved description that has enough detail to pass completeness.'};};
 const item=()=>({propertyId:row.property_id,property:{id:row.property_id,landlord_id:'test-owner',property_type:'apartment',city:'imus',barangay:'Fixture',bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,is_active:true},currentListing:row,listings:[row],tier3:{status:'pending'}});
 const mount=(routine?:any,identity?:any)=>mountProperty(null,{...backend.service,context:async(propertyId:string)=>({userId:'test-owner',propertyId}),read:async()=>{listingReads++;return row;}},{restore:async()=>{restores++;if(fail)throw Error('read failure');const result={row:{...row},pending:false};if(wait)await wait;return result;}},undefined,undefined,{routine,identity,initialScreen:'dashboard',portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>[item()]},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>{photoReads++;return[];},hasPending:async()=>false},amenities:{load:async()=>{amenityReads++;return{userId:'test-owner',catalog:[],selectedIds:[],hasPrivateLocation:true};},assertUser:async()=>{}}});
 return {backend,init,mount,setRow(next:any){row=next;},getRow:()=>({...row}),fail(value:boolean){fail=value;},pause(){wait=new Promise<void>(r=>{resolveRestore=r;});},release(){wait=null;resolveRestore();},counts:()=>({listingReads,restores,photoReads,amenityReads})};
}
test('saved draft hydration blocks partial editor and preview, permits Back and restarts same listing',async()=>{
 const fixture=savedHydrationHarness();await fixture.init();fixture.pause();const h=fixture.mount();await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();
 assert.equal(h.vm().draftHydration.status,'loading');assert.equal(h.vm().composerSaveDisabled,true);h.vm().openComposerPreview();h.flush();assert.equal(h.vm().screen,'listingDetails');
 h.vm().goBack();h.flush();assert.equal(h.vm().screen,'dashboard');h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();fixture.release();await h.settle();await h.settle();
 assert.equal(h.vm().draftHydration.status,'ready');assert.equal(h.vm().draft.title,'Loaded draft title');assert.equal(h.vm().draft.availableDate,'2026-12-20');assert.equal(h.vm().listingDraftState.lastConfirmed?.edit_version,'50000000-0000-4000-8000-000000000001');assert.equal(fixture.counts().listingReads,0);h.unmount();
});
test('editor preview round trip retains edits without reloading saved photos and amenities',async()=>{
 const fixture=savedHydrationHarness();await fixture.init();const h=fixture.mount();await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();await h.settle();const before=fixture.counts();
 h.vm().updateDraft('title','Unsaved local title');h.flush();h.vm().openComposerPreview();await h.settle();h.vm().goBack();await h.settle();assert.equal(h.vm().draft.title,'Unsaved local title');assert.deepEqual(fixture.counts(),before);h.unmount();
});

test('failed saved hydration offers retry without creating a replacement or exposing partial data',async()=>{
 const fixture=savedHydrationHarness();await fixture.init();fixture.fail(true);const h=fixture.mount();await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();assert.equal(h.vm().draftHydration.status,'error');assert.equal(h.vm().composerSaveDisabled,true);await h.vm().saveComposerDraft();assert.equal(fixture.backend.calls(),0);
 fixture.fail(false);h.vm().retryDraftHydration();await h.settle();await h.settle();assert.equal(h.vm().draftHydration.status,'ready');assert.equal(h.vm().draft.title,'Loaded draft title');assert.equal(h.vm().workspaceListingId,fixture.backend.listingId);h.unmount();
});
test('late response from an abandoned entry cannot replace newer title date or version',async()=>{
 const fixture=savedHydrationHarness();await fixture.init();fixture.pause();const h=fixture.mount();await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();h.vm().goBack();h.flush();
 fixture.setRow({...fixture.getRow(),title:'New authoritative title',available_from:'2027-01-15',edit_version:'50000000-0000-4000-8000-000000000099'});h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();fixture.release();await h.settle();await h.settle();
 assert.equal(h.vm().draftHydration.status,'ready');assert.equal(h.vm().draft.title,'New authoritative title');assert.equal(h.vm().draft.availableDate,'2027-01-15');assert.equal(h.vm().listingDraftState.lastConfirmed?.edit_version,'50000000-0000-4000-8000-000000000099');h.vm().updateDraft('title','Keep local edit');h.flush();h.bottom().onChat();h.flush();assert.equal(h.dialog().visible,true);h.dialog().onCancel();h.flush();assert.equal(h.vm().draft.title,'Keep local edit');h.unmount();
});

test('switching saved listing UUIDs invalidates all old hydration results',async()=>{
 const fixture=savedHydrationHarness();await fixture.init();fixture.pause();const h=fixture.mount();await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();
 const propertyId='10000000-0000-4000-8000-000000000002',listingId='20000000-0000-4000-8000-000000000002';fixture.setRow({...fixture.getRow(),id:listingId,property_id:propertyId,title:'Second listing only',available_from:'2027-03-10',edit_version:'50000000-0000-4000-8000-000000000002'});await h.vm().portfolio.load();h.flush();h.vm().openPortfolioItem(propertyId);await h.settle();fixture.release();await h.settle();await h.settle();
 assert.equal(h.vm().draftHydration.status,'ready');assert.equal(h.vm().workspacePropertyId,propertyId);assert.equal(h.vm().workspaceListingId,listingId);assert.equal(h.vm().draft.title,'Second listing only');assert.equal(h.vm().draft.availableDate,'2027-03-10');assert.equal(h.vm().listingDraftState.lastConfirmed?.edit_version,'50000000-0000-4000-8000-000000000002');assert.equal(h.vm().photoState.propertyId,propertyId);assert.equal(fixture.backend.calls(),0);h.unmount();
});


for(const status of ['active','paused'])test(`actual editor hydrates and updates exact ${status} listing without a draft or photo mutation`,async()=>{
 const backend=backendDraftService(true);let row:any={...await backend.service.read(),status,completeness_score:1,published_at:'2026-11-01T01:00:00Z',available_from:'2027-02-28'};let contentCalls=0;
 const item=()=>({propertyId:backend.propertyId,property:{id:backend.propertyId,property_type:'apartment',city:'imus',barangay:'Fixture',bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,is_active:true},currentListing:row,listings:[row],tier3:{status:'approved'}});
 const published={...backend.service,read:async()=>row,reconcile:async()=>row,save:async(_c:any,fields:any,target:any)=>{contentCalls++;assert.equal(target.listingId,backend.listingId);assert.equal(target.editVersion,row.edit_version);row={...row,title:fields.title,asking_rent_monthly:Number(fields.askingRent),available_from:fields.availableDate||null,edit_version:'50000000-0000-4000-8000-000000000002'};return row;}};
 const h=mountProperty(null,backend.service,{restore:async()=>({row,pending:false})},undefined,undefined,{initialScreen:'dashboard',published,portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>[item()]},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>[],hasPending:async()=>false}});
 await h.settle();h.vm().editPortfolioListing(backend.propertyId);h.flush();assert.equal(h.vm().draftHydration.status,'loading');await h.settle();await h.settle();assert.equal(h.vm().draftHydration.status,'ready');assert.equal(h.vm().publishedEditing,true);assert.equal(h.vm().draft.title,'Loaded draft title');assert.equal(h.vm().draft.availableDate,'2027-02-28');assert.equal(h.vm().publicationReview.visible,false);
 h.vm().updateDraft('askingRent','9000');h.vm().updateDraft('availableDate','');h.flush();h.vm().goBack();h.flush();assert.equal(h.dialog().visible,true);h.dialog().onCancel();h.flush();assert.equal(h.vm().draft.askingRent,'9000');await h.vm().saveComposerDraft();await h.settle();assert.equal(contentCalls,1);assert.equal(backend.calls(),0);assert.equal(row.id,backend.listingId);assert.equal(row.property_id,backend.propertyId);assert.equal(row.status,status);assert.equal(row.published_at,'2026-11-01T01:00:00Z');assert.equal(row.available_from,null);assert.equal(h.vm().screen,'published');assert.match(h.vm().notice??'',/changes saved/);h.vm().editManagedListing();await h.settle();await h.settle();assert.equal(h.vm().composerSaveDisabled,true);await h.vm().saveComposerDraft();assert.equal(contentCalls,1);h.unmount();
});


for(const status of ['active','paused'])test(`shared photos for ${status} listing preserve exact workspace and never publish or start Tier 3`,async()=>{
 const backend=backendDraftService(true);const row={...await backend.service.read(),status,completeness_score:1,published_at:'2026-11-01T01:00:00Z'};let additions=0,cover=0,loads=0;
 const item={propertyId:backend.propertyId,property:{id:backend.propertyId,is_active:true,property_type:'apartment',city:'imus',barangay:'Fixture'},currentListing:row,listings:[row],tier3:{status:'approved'}};
 const h=mountProperty(null,backend.service,{restore:async()=>({row,pending:false})},undefined,undefined,{initialScreen:'dashboard',portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>[item]},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>{loads++;return[];},hasPending:async()=>false,setCover:async(c:any)=>{assert.equal(c.propertyId,backend.propertyId);cover++;}},pickImages:async()=>{additions++;return[];}});
 await h.settle();h.vm().openPortfolioItem(backend.propertyId);await h.settle();h.vm().navigate('photoManager');await h.settle();assert.equal(h.vm().screen,'photoManager');assert.equal(h.vm().workspacePropertyId,backend.propertyId);assert.equal(h.vm().workspaceListingId,backend.listingId);assert.equal(h.vm().photoState.loaded,true);
 await h.vm().propertyPhotos.setCover('30000000-0000-4000-8000-000000000001');await h.settle();assert.equal(cover,1);h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'published');assert.equal(h.vm().realListing?.status,status);assert.equal(backend.calls(),0);assert.equal(h.vm().propertyVerificationState.entryPropertyId,null);assert.ok(loads>0);h.unmount();
});
for(const status of ['draft','active','paused'])test(`routine property editor preserves ${status} listing context and protects unsaved Back`,async()=>{
 const fixture=savedHydrationHarness();await fixture.init();fixture.setRow({...fixture.getRow(),status,completeness_score:1,published_at:status==='draft'?null:'2026-11-01T00:00:00Z'});
 let c:any={owner_id:'test-owner',property_id:fixture.backend.propertyId,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:2,total_floors:5,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false};let saves=0;
 const h=fixture.mount({load:async()=>c,hasPending:async()=>false,save:async(_c:any,d:any)=>{saves++;c={...c,bedrooms:Number(d.bedrooms),furnishing_status:d.furnishingStatus,edit_version:'60000000-0000-4000-8000-000000000002'};return c;}});
 await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();await h.settle();h.vm().openPropertyDetails();await h.settle();assert.equal(h.vm().screen,'propertyEdit');assert.equal(h.vm().propertyRoutineState.status,'ready');
 h.vm().propertyRoutine.update('bedrooms','2');h.flush();h.hardwareBack();h.flush();assert.equal(h.vm().navigationConfirmation,true);h.vm().cancelNavigation();h.flush();assert.equal(h.vm().propertyRoutineState.draft?.bedrooms,'2');
 await h.vm().propertyRoutine.save();await h.settle();assert.equal(saves,1);assert.equal(h.vm().propertySummary.bedrooms,'2');assert.equal(h.vm().workspaceListingId,fixture.backend.listingId);assert.equal(fixture.backend.calls(),0);assert.equal(h.vm().propertyVerificationState.entryPropertyId,null);
 h.vm().goBack();await h.settle();assert.equal(h.vm().screen,status==='draft'?'listingDetails':'published');h.unmount();
});

test('Back during slow routine hydration invalidates late private result without saving',async()=>{
 const fixture=savedHydrationHarness();await fixture.init();let release!:(c:any)=>void;const wait=new Promise<any>(r=>release=r);const h=fixture.mount({load:()=>wait,hasPending:async()=>false});await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();await h.settle();h.vm().openPropertyDetails();h.flush();assert.equal(h.vm().propertyRoutineState.status,'loading');h.vm().goBack();h.flush();release({property_id:fixture.backend.propertyId});await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().propertyRoutineState.status,'idle');assert.equal(fixture.backend.calls(),0);h.unmount();
});

for(const status of ['active','paused'])test(`Manage -> Edit Listing -> property/photos -> Back preserves ${status} context`,async()=>{
 const f=savedHydrationHarness();await f.init();f.setRow({...f.getRow(),status,published_at:'2026-11-01T00:00:00Z',completeness_score:1});const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();assert.equal(h.vm().screen,'published');h.vm().editManagedListing();await h.settle();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().publishedEditing,true);assert.equal(h.vm().composerSaveDisabled,true);
 h.vm().updateDraft('title','Unsaved listing edit');h.flush();assert.equal(h.vm().composerSaveDisabled,false);h.vm().openPropertyDetails();await h.settle();assert.equal(h.vm().navigationConfirmation,false);assert.equal(h.vm().screen,'propertyEdit');h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().draft.title,'Unsaved listing edit');h.vm().navigate('photoManager');await h.settle();h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().draft.title,'Unsaved listing edit');
 h.vm().updateDraft('title',f.getRow().title);h.flush();assert.equal(h.vm().composerSaveDisabled,true);h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'published');assert.equal(h.vm().realListing?.status,status);assert.equal(h.vm().workspaceListingId,f.backend.listingId);assert.equal(f.backend.calls(),0);h.unmount();
});
test('saved draft no-op and reverted saves are disabled without a request',async()=>{const f=savedHydrationHarness();await f.init();const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();await h.settle();assert.equal(h.vm().composerSaveDisabled,true);await h.vm().saveComposerDraft();assert.equal(f.backend.calls(),0);h.vm().updateDraft('askingRent','12,000.00');h.flush();assert.equal(h.vm().composerSaveDisabled,true);h.vm().updateDraft('title','Changed');h.flush();assert.equal(h.vm().composerSaveDisabled,false);h.vm().updateDraft('title','');h.flush();assert.equal(h.vm().composerSaveDisabled,true);h.vm().updateDraft('title',f.getRow().title);h.flush();assert.equal(h.vm().composerSaveDisabled,true);h.unmount();});

test('returning from dirty property subeditor discards only property edits and keeps listing changes',async()=>{
 const f=savedHydrationHarness();await f.init();const c:any={owner_id:'test-owner',property_id:f.backend.propertyId,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:2,total_floors:5,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false};const h=f.mount({load:async()=>c,hasPending:async()=>false});await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();await h.settle();h.vm().updateDraft('title','Keep listing edits');h.flush();h.vm().openPropertyDetails();await h.settle();h.vm().propertyRoutine.update('bedrooms','2');h.flush();h.vm().reloadPropertyDetails();h.flush();assert.equal(h.dialog().visible,true);h.vm().confirmNavigation();await h.settle();assert.equal(h.vm().screen,'propertyEdit');assert.equal(h.vm().propertyRoutineState.draft?.bedrooms,'1');assert.equal(h.vm().draft.title,'Keep listing edits');h.vm().propertyRoutine.update('bedrooms','2');h.flush();h.vm().goBack();h.flush();assert.equal(h.dialog().visible,true);assert.equal(h.vm().propertyReturnConfirmation,true);h.vm().cancelNavigation();h.flush();assert.equal(h.vm().propertyRoutineState.draft?.bedrooms,'2');h.vm().goBack();h.flush();h.vm().confirmNavigation();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().draft.title,'Keep listing edits');h.bottom().onChat();h.flush();assert.equal(h.dialog().visible,true);h.vm().cancelNavigation();assert.equal(f.backend.calls(),0);h.unmount();
});
for(const status of ['active','paused'])test(`Back while opening Edit Listing returns to ${status} management and ignores stale hydration`,async()=>{const f=savedHydrationHarness();await f.init();f.setRow({...f.getRow(),status,published_at:'2026-11-01T00:00:00Z',completeness_score:1});const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();f.pause();h.vm().editManagedListing();await h.settle();assert.equal(h.vm().draftHydration.status,'loading');h.vm().goBack();h.flush();assert.equal(h.vm().screen,'published');f.release();await h.settle();await h.settle();assert.equal(h.vm().screen,'published');assert.equal(h.vm().realListing?.status,status);assert.equal(f.backend.calls(),0);h.unmount();});

test('independent physical-property editing needs no listing or listing save',async()=>{const property='10000000-0000-4000-8000-000000000001';const c:any={owner_id:'test-owner',property_id:property,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'house',city:'imus',barangay:'Fixture',floor_number:null,total_floors:2,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false};const item={propertyId:property,property:{id:property,is_active:true},currentListing:null,listings:[],tier3:{status:'not_submitted'}};const h=mountProperty(null,{}, {restore:async()=>null},undefined,undefined,{initialScreen:'dashboard',portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>[item]},routine:{load:async()=>c,hasPending:async()=>false}});await h.settle();h.vm().openPortfolioProperty(property);await h.settle();assert.equal(h.vm().screen,'propertyEdit');assert.equal(h.vm().workspacePropertyId,property);assert.equal(h.vm().workspaceListingId,null);assert.equal(h.vm().propertyRoutine.canSave(),false);h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'dashboard');assert.equal(h.writes(),0);h.unmount();});


test('identity correction nested Back protects proposal and retains unsaved listing context',async()=>{
 const f=savedHydrationHarness();await f.init();const id=f.backend.propertyId;
 const c:any={owner_id:'test-owner',property_id:id,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:2,total_floors:5,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false};
 const identity:any={property_id:id,owner_id:'test-owner',edit_version:c.edit_version,total_floors:5,current_revision_id:c.edit_version,verified:true,requires_repair:false,open_tenancy:false,correction:null,current:{property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:2,address_line_1:'Fixture',address_line_2:null,postal_code:null,exact_lat:14.4,exact_lng:120.9,public_lat:14.4,public_lng:120.9}};
 const h=f.mount({load:async()=>c,hasPending:async()=>false},{load:async()=>identity,hasPending:async()=>false});await h.settle();h.vm().openPortfolioItem(id);await h.settle();await h.settle();h.vm().updateDraft('title','Keep listing edits');h.flush();h.vm().openPropertyDetails();await h.settle();h.vm().openIdentityCorrection();await h.settle();assert.equal(h.vm().screen,'identityEdit');assert.equal(h.vm().workspacePropertyId,id);assert.equal(h.vm().workspaceListingId,f.backend.listingId);
 h.vm().propertyIdentity.update('floorNumber','3');h.flush();h.hardwareBack();h.flush();assert.equal(h.dialog().visible,true);h.dialog().onCancel();h.flush();assert.equal(h.vm().propertyIdentityState.draft?.floorNumber,'3');h.hardwareBack();h.flush();h.dialog().onConfirm();await h.settle();assert.equal(h.vm().screen,'propertyEdit');assert.equal(h.vm().propertyRoutineState.status,'ready');assert.equal(h.vm().draft.title,'Keep listing edits');h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().draft.title,'Keep listing edits');assert.equal(f.backend.calls(),0);h.unmount();
});


test('first ready render exposes property editing without waiting for a later unrelated render',async()=>{
 const f=savedHydrationHarness();await f.init();f.pause();const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();
 assert.equal(h.vm().draftHydration.status,'loading');assert.equal(h.vm().propertyEditAvailable,false);
 h.renderStates.length=0;f.release();await h.settle();await h.settle();
 const first=h.renderStates.find(r=>r.status==='ready');assert.ok(first);assert.equal(first.propertyEditAvailable,true);assert.equal(f.backend.calls(),0);h.unmount();
});


test('saved optional model edits change estimator identity while unsaved edits keep the saved snapshot',async()=>{
 const f=savedHydrationHarness();await f.init();let c:any={owner_id:'test-owner',property_id:f.backend.propertyId,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:null,total_floors:null,bedrooms:1,bathrooms:1,floor_area_sqm:35,max_occupants:null,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false,model_attributes_version:2,property_subtype:'studio',lot_area_sqm:null,parking_spaces:0};
 const h=f.mount({load:async()=>c,hasPending:async()=>false,save:async(_c:any,d:any)=>{c={...c,lot_area_sqm:Number(d.lotAreaSqm),parking_spaces:Number(d.parkingSpaces),edit_version:'60000000-0000-4000-8000-000000000002'};return c;}});
 await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();await h.settle();h.vm().openPropertyDetails();await h.settle();const before=JSON.stringify(h.vm().estimationProperty);
 h.vm().propertyRoutine.update('lotAreaSqm','50');h.vm().propertyRoutine.update('parkingSpaces','1');h.flush();assert.equal(JSON.stringify(h.vm().estimationProperty),before);
 await h.vm().propertyRoutine.save();await h.settle();assert.notEqual(JSON.stringify(h.vm().estimationProperty),before);assert.equal(h.vm().estimationProperty?.lot_area_sqm,50);assert.equal(h.vm().estimationProperty?.parking_spaces,1);assert.equal(h.vm().estimationProperty?.property_subtype,'studio');assert.ok(!('exact_location' in h.vm().estimationProperty!));h.unmount();
});


test('only explicit current-property price guidance adoption changes asking rent and never saves',async()=>{
 const f=savedHydrationHarness();await f.init();const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();await h.settle();h.vm().updateDraft('askingRent','5000');h.flush();
 const result:any={target:{propertyId:f.backend.propertyId},estimatedMonthlyRent:18000.25,currency:'PHP',modelVersion:'fixture',askingRent:null,predictedAt:'2026-11-10T00:00:00Z'};
 assert.equal(h.vm().draft.askingRent,'5000');h.vm().applyRentalEstimate({...result,target:{propertyId:'10000000-0000-4000-8000-000000000099'}});h.flush();assert.equal(h.vm().draft.askingRent,'5000');
 h.vm().applyRentalEstimate({...result,estimatedMonthlyRent:NaN});h.vm().applyRentalEstimate({...result,currency:'USD'});h.flush();assert.equal(h.vm().draft.askingRent,'5000');
 h.vm().applyRentalEstimate(result);h.flush();assert.equal(h.vm().draft.askingRent,'18000.25');assert.equal(f.backend.calls(),0);assert.equal(h.writes(),0);
 h.vm().updateDraft('askingRent','7000');h.flush();assert.equal(h.vm().draft.askingRent,'7000');h.unmount();
});


test('first listing rent page receives saved-property eligibility and optional zero without saving a listing or duplicating creation',async()=>{
 const {h,events,fields,confirmMap,backend}=unifiedHarness();await h.settle();fields();
 const f=h.vm().propertyCreation;f.updateField('propertyType','condominium');f.updateField('propertySubtype','studio');f.updateField('floorAreaSqm','35');f.updateField('parkingSpaces','0');
 h.vm().updateDraft('askingRent','');h.flush();await confirmMap();
 const first=h.vm().nextListingDetails();const duplicate=h.vm().nextListingDetails();await Promise.all([first,duplicate]);await h.settle();
 assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().workspacePropertyId,backend.propertyId);assert.deepEqual(events,['property']);assert.equal(h.vm().workspaceListingId,null);
 assert.equal(h.vm().estimationProperty?.property_subtype,'studio');assert.equal(h.vm().estimationProperty?.floor_area_sqm,35);assert.equal(h.vm().estimationProperty?.lot_area_sqm,null);assert.equal(h.vm().estimationProperty?.parking_spaces,0);
 assert.equal(h.vm().draft.askingRent,'');assert.ok(!JSON.stringify(h.vm().estimationProperty).includes('Latitude'));
 h.vm().applyRentalEstimate({target:{propertyId:backend.propertyId},currency:'PHP',estimatedMonthlyRent:18000} as any);h.flush();assert.equal(h.vm().draft.askingRent,'18000');assert.deepEqual(events,['property']);
 h.vm().goBack();h.flush();await h.vm().nextListingDetails();await h.settle();assert.deepEqual(events,['property']);assert.equal(h.vm().screen,'listingDetails');h.unmount();
});


test('unfinished post completion returns the selected workspace to My Rentals without another create or listing save',async()=>{
 const backend=backendDraftService(),id=backend.propertyId;
 const deletion={inspect:async()=>({propertyId:id,state:'live',eligible:true,reason:null}),pending:async()=>[],remove:async()=>({propertyId:id,state:'completed',eligible:false,reason:null})};
 const h=mountProperty(id,backend.service,undefined,undefined,undefined,{deletion,photos:{context:async()=>({ownerId:'test-owner',propertyId:id}),assertContext:async()=>{},list:async()=>[],hasPending:async()=>false}});await h.setup();await h.settle();h.vm().navigate('listingDetails');await h.settle();
 h.vm().requestUnfinishedPostDeletion();h.flush();assert.equal(h.vm().unfinishedPostState.confirming,true);await h.vm().unfinishedPost.confirm();await h.settle();assert.equal(h.vm().screen,'dashboard');assert.equal(h.vm().workspacePropertyId,null);assert.equal(h.writes(),0);assert.equal(backend.calls(),0);assert.match(h.vm().notice??'',/deleted/);h.unmount();
});


test('unfinished post pending cleanup removes the editor and blocks stale save actions without claiming completion',async()=>{
 const backend=backendDraftService(),id=backend.propertyId;
 const deletion={inspect:async()=>({propertyId:id,state:'live',eligible:true,reason:null}),pending:async()=>[],remove:async()=>({propertyId:id,state:'cleanup_pending',eligible:false,reason:null})};
 const h=mountProperty(id,backend.service,undefined,undefined,undefined,{deletion,photos:{context:async()=>({ownerId:'test-owner',propertyId:id}),assertContext:async()=>{},list:async()=>[],hasPending:async()=>false}});await h.setup();await h.settle();h.vm().navigate('listingDetails');await h.settle();
 h.vm().requestUnfinishedPostDeletion();h.flush();await h.vm().unfinishedPost.confirm();await h.settle();assert.equal(h.vm().workspacePropertyId,id);assert.equal(h.vm().unfinishedPostState.status?.state,'cleanup_pending');assert.equal(h.vm().listingDraftReadOnly,true);assert.equal(h.vm().composerSaveDisabled,true);await h.vm().saveComposerDraft();assert.equal(backend.calls(),0);assert.doesNotMatch(h.vm().notice??'',/deleted/);h.unmount();
});
