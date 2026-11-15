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
function mountProperty(persistedProperty: string | null = null, draftService: any = {}, publicationService: any = { restore: async () => null }, lifecycleService?: any, locationService?: any, overrides: { deletion?:any; identity?:any; routine?:any; published?:any; verification?: any; renderPropertyVerification?: any; amenities?: any; locationShare?: any; creation?: any; photos?: any; pickImages?: any; portfolio?: any; initialScreen?: 'dashboard' | 'postingType'; replayUpdaters?: boolean } = {}) {
  let cursor = 0, current: PropertyListingViewModel, mounted = true;
  const slots: any[] = [], effects: (() => void)[] = [], cache = new Map<string, any>();
  let writes = 0, tree: any, realHook: any, backAction: (() => void) | null = null;
  const destinations: string[] = [];
  const alerts:{title:string;buttons:any[]}[]=[];
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
      if (name === 'react-native') return { Alert:{alert:(title:string,_body:string,buttons:any[])=>alerts.push({title,buttons})}, StyleSheet: { create: (styles: any) => styles }, View: 'View', Text: 'Text', Modal: 'Modal', StatusBar: 'StatusBar' };
      if (name.endsWith('/usePropertyListingViewModel')) return { usePropertyListingViewModel: (...args: any[]) => { current = realHook(...args); return current; } };
      const presentation = ['PostingEstimateView','PostingPriceStep','PostingReviewView','UnfinishedPostDeletionAction','RentalPriceGuidance','InlineRentalEstimate','PropertyModelAttributeFields','AppButton', 'FeedbackNotice', 'ListingButton', 'NavigationConfirmation', 'RentLeaseBottomNavigation', 'ScreenContainer', 'CreateListingView', 'ListingComposerView', 'ListingDetailsView', 'ListingDraftSavedView', 'PropertyRoutineEditView', 'PropertyIdentityEditView', 'ListingDetailView', 'ListingManagementView', 'ListingPreviewView', 'PropertyDashboardView', 'PublishedListingStatusView', 'ListingWorkspaceFeedback', 'ListingWizardScaffold', 'PostingSection', 'PostingChoices', 'PostingProgress', 'PropertyVerificationAction', 'PropertyProgressFooter', 'CompletenessHint', 'AvailabilityDateField', 'ComposerRecoveryFeedback', 'ListingControls', 'ListingCheckLine'];
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
      if (name.endsWith('/locationShareDependencies')) return { locationShareService: overrides.locationShare ?? { load: async () => null, save: async () => { throw new Error('unexpected consent call'); } }, currentActorId: async () => 'test-owner' };
      if (name.endsWith('/propertyAmenityDependencies')) return { propertyAmenityService: overrides.amenities ?? { load: async () => ({userId:'test-owner',catalog:[],selectedIds:[],hasPrivateLocation:false}), assertUser:async()=>{} } };
      if (name.endsWith('/propertyCreationDependencies')) return { propertyCreationService: service };
      if (name.endsWith('/propertyPhotoDependencies')) return { propertyPhotoService: overrides.photos ?? {}, selectPropertyPhotos: overrides.pickImages, selectPropertyPhoto: async () => { writes++; throw Error('No picker during navigation'); } };
      if (name.startsWith('.')) return load(resolve(absolute, '..', name.endsWith('.ts') ? name : name + '.ts'));
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
    vm: () => current!, flush, renderStates, postingEstimateView:()=>componentProps('PostingEstimateView'), postingPriceStep:()=>componentProps('PostingPriceStep'), alerts:()=>alerts,
    async settle() { for (let i = 0; i < 3; i++) { await new Promise<void>(resolve => setImmediate(resolve)); flush(); } },
    draftConflict: (message:string)=>new (load('src/features/property-listing/models/PersistedListingDraft.ts').ListingDraftError)(message,'conflict'),
    draftError: (message: string) => new (load('src/features/property-listing/models/PersistedListingDraft.ts').ListingDraftError)(message, 'uncertain'),
    propertyEditError: (message: string, kind: string) => new (load('src/features/property-listing/models/PropertyRoutineEdit.ts').PropertyEditError)(message, kind),
    contextModal:()=>componentProps('Modal'),
    composerView: () => componentProps('ListingComposerView'),
    detailsView: () => load('src/features/property-listing/views/ListingDetailsView.tsx').ListingDetailsView({ viewModel: current, onClose: () => {} }),
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
  h.bottom().onPost(); await h.settle(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().workspacePropertyId, null); assert.equal(h.vm().workspaceListingId, null); assert.equal(h.vm().workspaceMode, 'create');
  assert.equal(h.vm().draft.title, ''); assert.equal(h.vm().photoState.photos.length, 0); assert.equal(h.vm().publicationState.error, null); assert.equal(h.vm().lifecycleState.row, null);
  h.unmount();
});
for (const tier3 of ['pending', 'rejected'] as const) test(`property-specific Tier 3 ${tier3} and uncertain publication do not block another Post or delete recovery`, async () => {
  const backend = backendDraftService(true), row = (await backend.service.read())!;
  const marker = new Map([[backend.listingId, 'pending']]);
  const item = { propertyId: backend.propertyId, property: { id: backend.propertyId, property_type: 'apartment', city: 'imus', barangay: 'A', bedrooms: 1, bathrooms: 1, furnishing_status: 'unfurnished', is_active: true }, currentListing: row, listings: [row], coverPhoto: null, tier3: { status: tier3, submissionId: 'a', updatedAt: null } };
  const h = mountProperty(null, backend.service, { restore: async () => ({ row, pending: marker.has(backend.listingId) }) }, undefined, undefined, { portfolio: { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [item] } });
  await h.settle(); await h.vm().portfolio.load(); h.flush(); h.vm().openPortfolioItem(backend.propertyId); await h.settle(); assert.equal(h.vm().publicationState.uncertain, true);
  h.bottom().onPost(); await h.settle(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().publicationState.uncertain, false); assert.equal(marker.get(backend.listingId), 'pending');
  assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().propertyState.propertyId, null); assert.equal(h.vm().draft.title, ''); assert.equal(marker.size, 1);
  h.unmount();
});


test('Post detaches an in-flight lifecycle operation without replaying it into the new workspace', async () => {
  const backend = backendDraftService(true); const row = { ...(await backend.service.read())!, status: 'active', completeness_score: 0.8, published_at: '2026-10-28T00:00:00Z', paused_at: null, archived_at: null, removed_at: null, removal_reason: null };
  const item = { propertyId: backend.propertyId, property: { id: backend.propertyId, property_type: 'apartment', city: 'imus', barangay: 'A', bedrooms: 1, bathrooms: 1, furnishing_status: 'unfurnished', is_active: true }, currentListing: row, listings: [row], coverPhoto: null, tier3: { status: 'approved', submissionId: 'a', updatedAt: null } };
  let release!: () => void, mutations = 0; const wait = new Promise<void>(r => { release = r; });
  const h = mountProperty(null, backend.service, { restore: async () => ({ row, pending: false }) }, { context: async () => ({}), assertContext: async () => {}, inspect: async () => ({ row, operations: [] }), mutate: async () => { mutations++; await wait; return { ...row, status: 'paused', paused_at: '2026-10-29T00:00:00Z' }; } }, undefined, { portfolio: { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [item] } });
  await h.settle(); await h.vm().portfolio.load(); h.flush(); h.vm().openPortfolioItem(backend.propertyId); await h.settle();
  assert.equal(h.vm().lifecycle.request('pause'), true); const pending = h.vm().lifecycle.confirm(); await new Promise<void>(r => setImmediate(r)); h.flush(); assert.equal(h.vm().lifecycleState.busy, true);
  h.bottom().onPost(); await h.settle(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().workspacePropertyId, null);
  release(); await pending; await h.settle(); assert.equal(mutations, 1); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().lifecycleState.row, null); assert.equal(h.vm().draft.title, ''); h.unmount();
});


function unifiedHarness(failure: 'none' | 'property' | 'uncertain-property' | 'photo' | 'draft' = 'none', opts: { routineFails?: boolean; areaMissing?: boolean; score?: number; locationShare?: any; routineGate?: Promise<void>; publication?: any } = {}) {
  const backend = backendDraftService(), events: string[] = [], rows: any[] = [];
  const files = Array.from({ length: 3 }, (_, i) => ({ uri: `file:///cache/composer-${i}.jpg`, fileName: `${i}.jpg`, mimeType: 'image/jpeg', size: 100 }));
  let uncertainPhoto = false, pickerCalls = 0;
  const candidate = { id: 'real-candidate', label: 'Chosen address', longitude: 120.9, latitude: 14.4 };
  const h = mountProperty(null, { ...backend.service, save: async (c: any, form: any) => { events.push('draft'); if (failure === 'draft') throw h.draftError('Check draft status.'); const saved = await backend.service.save(c, form); return opts.score === undefined ? saved : { ...saved, completeness_score: opts.score }; } }, opts.publication, undefined, { getMapStyleUrl: () => 'fixture-style', searchAddress: async () => [candidate] }, {
    initialScreen: 'postingType', locationShare: opts.locationShare, pickImages: async () => { pickerCalls++; return files; },
    // The saved-property editor reads back the property that was just created (as the real service does).
    routine: { load: async (id: string) => { if (opts.routineGate) await opts.routineGate; if (opts.routineFails) throw Error('Routine read failed'); const d = h.vm().propertyState.draft, n = (v: string) => v.trim() === '' ? null : Number(v); return { owner_id: 'test-owner', property_id: id, edit_version: '60000000-0000-4000-8000-000000000002', property_type: d.propertyType, city: d.city, barangay: d.barangay, floor_number: n(d.floorNumber), bedrooms: Number(d.bedrooms), bathrooms: Number(d.bathrooms), floor_area_sqm: opts.areaMissing ? null : n(d.floorAreaSqm), max_occupants: n(d.maxOccupants), total_floors: n(d.totalFloors), furnishing_status: d.furnishingStatus, access_instructions: null, amenity_ids: [], catalog: [], open_tenancy: false, property_subtype: d.propertySubtype || null, lot_area_sqm: n(d.lotAreaSqm ?? ''), parking_spaces: n(d.parkingSpaces ?? ''), model_attributes_version: 2 }; }, hasPending: async () => false, save: async (c: any, d: any) => ({ ...c, bedrooms: Number(d.bedrooms), bathrooms: Number(d.bathrooms), floor_area_sqm: d.floorAreaSqm.trim() ? Number(d.floorAreaSqm) : null, edit_version: '60000000-0000-4000-8000-000000000003' }), reconcile: async () => null },
    creation: { create: async () => { events.push('property'); if (failure === 'property' || failure === 'uncertain-property') throw Object.assign(Error('rejected or unknown'), { code: failure === 'property' ? 'property_creation_rejected' : 'property_creation_uncertain' }); return { propertyId: backend.propertyId, status: 'created' }; } },
    photos: { context: async (propertyId: string) => { assert.equal(propertyId, backend.propertyId); return { ownerId: 'test-owner', propertyId }; }, assertContext: async () => {}, list: async () => [...rows], hasPending: async () => uncertainPhoto,
      upload: async (context: any, file: any) => { assert.equal(context.propertyId, backend.propertyId); events.push(`photo:${file.fileName}`); if (failure === 'photo' && file.fileName === '1.jpg') { uncertainPhoto = true; throw Error('Unknown photo result'); } rows.push({ id: file.fileName, property_id: backend.propertyId, publicUrl: 'https://example.test/photo', storage_path: '', sort_order: rows.length, is_cover: !rows.length, alt_text: null, created_at: '2026-10-29' }); },
    },
  });
  assert.equal(h.vm().screen, 'listingComposer'); h.flush();
  const fields = () => {
    const creation = h.vm().propertyCreation;
    creation.updateField('bedrooms', '0'); creation.updateField('bathrooms', '0'); creation.updateField('propertyType', 'apartment'); creation.updateField('city', 'imus'); creation.updateField('barangay', 'Buhay na Tubig'); creation.updateField('addressLine1', 'Owner-entered address'); creation.updateField('floorAreaSqm', '42'); creation.updateField('maxOccupants', '3');
    h.vm().updateDraft('title', 'Before UUID title'); h.vm().updateDraft('description', 'Before UUID description'); h.vm().updateDraft('askingRent', '15000'); h.vm().updateDraft('minimumStayMonths', '6'); h.flush();
  };
  // A pin placed on the map, with no consent decision yet (the state the consent card asks about).
  const pinMap = async () => {
    h.vm().openPropertyLocation(); await h.settle(); assert.equal(h.vm().screen, 'listingComposer');
    const map = h.vm().propertyLocation; map.chooseCandidate(candidate.id); map.mapLoaded(); map.movePoint([120.91, 14.41]); assert.equal(map.confirmExact(), true); h.flush();
  };
  const confirmMap = async () => {
    await pinMap();
    // Either consent button confirms the location. The map helper records the choice the test already made (wish or none), as the card's buttons do.
    h.vm().setShareLocationWanted(h.vm().shareLocationWanted); h.flush();
  };
  return { h, events, files, backend, fields, confirmMap, pinMap, picks: () => pickerCalls };
}

test('Property Listing choice renders composer before any property, preserving local photos and all fields across map', async () => {
  const { h, events, fields, files, confirmMap } = unifiedHarness();
  assert.equal(h.vm().screen, 'listingComposer'); assert.ok(h.composerView()); assert.equal(h.vm().workspacePropertyId, null);
  await h.settle(); await h.vm().propertyPhotos.addPhotos(); h.flush(); assert.deepEqual(h.vm().photoState.pendingSelections, files); assert.deepEqual(events, []);
  fields(); await confirmMap(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().propertyState.draft.floorAreaSqm, '42'); assert.equal(h.vm().draft.title, 'Before UUID title'); assert.equal(h.vm().photoState.pendingSelections.length, 3); assert.equal(h.vm().propertyCreation.locationReady(), true);
  h.vm().propertyCreation.updateField('addressLine1', 'New address'); assert.equal(h.vm().propertyCreation.locationReady(), false); assert.equal(h.vm().propertyLocation.getSnapshot().publicPoint, null);
  h.flush(); h.hardwareBack(); h.flush(); assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().navigationConfirmation, true); h.vm().cancelNavigation(); h.flush(); assert.equal(h.vm().screen, 'listingComposer'); assert.deepEqual(events, []); h.unmount();
});

test('root Post opens Property directly without any backend writes',async()=>{const h=mountProperty(null,{},undefined,undefined,undefined,{initialScreen:'postingType'});await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.ok(h.composerView());assert.equal(h.writes(),0);h.vm().goBack();h.flush();assert.equal(h.vm().screen,'dashboard');h.unmount();});
test('Post tab opens Property; dirty hardware Back retains the form until explicit exit confirmation',async()=>{const h=mountProperty();h.bottom().onPost();await h.settle();assert.equal(h.vm().screen,'listingComposer');h.vm().updateDraft('title','Keep my title');h.flush();h.hardwareBack();h.flush();assert.equal(h.vm().navigationConfirmation,true);h.vm().cancelNavigation();h.flush();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().draft.title,'Keep my title');assert.equal(h.writes(),0);h.unmount();});
test('clean Property hardware Back returns to My Rentals without a chooser detour',async()=>{const h=mountProperty(null,{},undefined,undefined,undefined,{initialScreen:'postingType'});await h.settle();h.hardwareBack();h.flush();assert.equal(h.vm().screen,'dashboard');assert.equal(h.vm().navigationConfirmation,false);assert.equal(h.writes(),0);h.unmount();});

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
 flow.updateField('barangay','');h.flush();assert.deepEqual(h.vm().propertyVisibleValidationIssues,[],'typing alone shows nothing');h.vm().markPropertyFieldTouched('barangay');h.flush();assert.deepEqual(h.vm().propertyVisibleValidationIssues.map(i=>i.field),['barangay'],'leaving the field shows it');flow.updateField('barangay','Corrected barangay');h.flush();assert.equal(h.vm().propertyVisibleValidationIssues.length,0);assert.equal(h.vm().propertyNextDisabled,true);assert.deepEqual(events,[]);h.unmount();
});
test('Stage 1 Next uses physical readiness and confirmed location, independent of listing completeness',async()=>{
 const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();h.vm().updateDraft('title','');h.vm().updateDraft('description','');h.vm().updateDraft('askingRent','');h.flush();assert.equal(h.vm().propertyNextDisabled,true);
 h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().propertyValidationTarget?.section,'location');assert.equal(h.vm().screen,'listingComposer');await confirmMap();assert.equal(h.vm().propertyFormReady,true);assert.equal(h.vm().propertyNextDisabled,false);assert.ok(h.vm().completeness.percent<80);assert.match(h.vm().propertyNextStatus,/Next saves/i);
 h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.ok(h.vm().workspacePropertyId);assert.deepEqual(events,['property']);h.unmount();
});
test('Stage 1 optional floor inconsistency blocks Next, preserves entries and clears after correction',async()=>{
 const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();const flow=h.vm().propertyCreation;flow.updateField('floorNumber','8');flow.updateField('totalFloors','2');h.flush();assert.equal(h.vm().propertyNextDisabled,true);assert.equal(h.vm().propertyVisibleValidationIssues.length,0,'quiet while typing');h.vm().markPropertyFieldTouched('totalFloors');h.flush();assert.ok(h.vm().propertyVisibleValidationIssues.some(i=>i.section==='floors'&&i.kind==='invalid'));h.vm().nextListingDetails();h.flush();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().propertyState.draft.floorNumber,'8');assert.equal(h.vm().draft.title,'Before UUID title');
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
 const defaultRoutine={load:async()=>({owner_id:'test-owner',property_id:row.property_id,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:null,total_floors:2,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false}),hasPending:async()=>false};
 const mount=(routine?:any,identity?:any,published?:any)=>mountProperty(null,{...backend.service,context:async(propertyId:string)=>({userId:'test-owner',propertyId}),read:async()=>{listingReads++;return row;}},{restore:async()=>{restores++;if(fail)throw Error('read failure');const result={row:{...row},pending:false};if(wait)await wait;return result;}},undefined,undefined,{routine:routine??defaultRoutine,identity,published,initialScreen:'dashboard',portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>[item()]},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>{photoReads++;return[];},hasPending:async()=>false},amenities:{load:async()=>{amenityReads++;return{userId:'test-owner',catalog:[],selectedIds:[],hasPrivateLocation:true};},assertUser:async()=>{}}});
 return {backend,init,mount,setRow(next:any){row=next;},getRow:()=>({...row}),fail(value:boolean){fail=value;},pause(){wait=new Promise<void>(r=>{resolveRestore=r;});},release(){wait=null;resolveRestore();},counts:()=>({listingReads,restores,photoReads,amenityReads})};
}
test('saved draft hydration blocks partial editor and preview, permits Back and restarts same listing',async()=>{
 const fixture=savedHydrationHarness();await fixture.init();fixture.pause();const h=fixture.mount();await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();
 assert.equal(h.vm().draftHydration.status,'loading');assert.equal(h.vm().composerSaveDisabled,true);h.vm().openComposerPreview();h.flush();assert.equal(h.vm().screen,'listingComposer');
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
 h.vm().updateDraft('askingRent','9000');h.vm().updateDraft('availableDate','');h.flush();h.vm().goBack();h.flush();assert.equal(h.dialog().visible,true);h.dialog().onCancel();h.flush();assert.equal(h.vm().draft.askingRent,'9000');await h.vm().saveComposerDraft();await h.settle();assert.equal(contentCalls,1);assert.equal(backend.calls(),0);assert.equal(row.id,backend.listingId);assert.equal(row.property_id,backend.propertyId);assert.equal(row.status,status);assert.equal(row.published_at,'2026-11-01T01:00:00Z');assert.equal(row.available_from,null);assert.equal(h.vm().screen,'listingComposer');assert.match(h.vm().composerNotice??'',/changes saved/);h.vm().editManagedListing();await h.settle();await h.settle();assert.equal(h.vm().composerSaveDisabled,true);await h.vm().saveComposerDraft();assert.equal(contentCalls,1);h.unmount();
});


for(const status of ['active','paused'])test(`shared photos for ${status} listing preserve exact workspace and never publish or start Tier 3`,async()=>{
 const backend=backendDraftService(true);const row={...await backend.service.read(),status,completeness_score:1,published_at:'2026-11-01T01:00:00Z'};let additions=0,cover=0,loads=0;
 const item={propertyId:backend.propertyId,property:{id:backend.propertyId,is_active:true,property_type:'apartment',city:'imus',barangay:'Fixture'},currentListing:row,listings:[row],tier3:{status:'approved'}};
 const h=mountProperty(null,backend.service,{restore:async()=>({row,pending:false})},undefined,undefined,{initialScreen:'dashboard',portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>[item]},photos:{context:async(propertyId:string)=>({ownerId:'test-owner',propertyId}),assertContext:async()=>{},list:async()=>{loads++;return[];},hasPending:async()=>false,setCover:async(c:any)=>{assert.equal(c.propertyId,backend.propertyId);cover++;}},pickImages:async()=>{additions++;return[];}});
 await h.settle();h.vm().openPortfolioItem(backend.propertyId);await h.settle();h.vm().navigate('photoManager');await h.settle();assert.equal(h.vm().screen,'photoManager');assert.equal(h.vm().workspacePropertyId,backend.propertyId);assert.equal(h.vm().workspaceListingId,backend.listingId);assert.equal(h.vm().photoState.loaded,true);
 await h.vm().propertyPhotos.setCover('30000000-0000-4000-8000-000000000001');await h.settle();assert.equal(cover,1);h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'published');assert.equal(h.vm().realListing?.status,status);assert.equal(backend.calls(),0);assert.equal(h.vm().propertyVerificationState.entryPropertyId,null);assert.ok(loads>0);h.unmount();
});
for(const status of ['draft','active','paused'])test(`property details open in the wizard at Step 1 and preserve ${status} listing context and protect unsaved Back`,async()=>{
 const fixture=savedHydrationHarness();await fixture.init();fixture.setRow({...fixture.getRow(),status,completeness_score:1,published_at:status==='draft'?null:'2026-11-01T00:00:00Z'});
 let c:any={owner_id:'test-owner',property_id:fixture.backend.propertyId,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:2,total_floors:5,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false};let saves=0;
 const h=fixture.mount({load:async()=>c,hasPending:async()=>false,save:async(_c:any,d:any)=>{saves++;c={...c,bedrooms:Number(d.bedrooms),furnishing_status:d.furnishingStatus,edit_version:'60000000-0000-4000-8000-000000000002'};return c;}});
 await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();await h.settle();h.vm().openPropertyDetails();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().postingStep,1);assert.equal(h.vm().propertyRoutineState.status,'ready');
 h.vm().propertyRoutine.update('bedrooms','2');h.flush();h.hardwareBack();h.flush();assert.equal(h.vm().navigationConfirmation,true);h.vm().cancelNavigation();h.flush();assert.equal(h.vm().propertyRoutineState.draft?.bedrooms,'2');
 await h.vm().propertyRoutine.save();await h.settle();assert.equal(saves,1);assert.equal(h.vm().propertySummary.bedrooms,'2');assert.equal(h.vm().workspaceListingId,fixture.backend.listingId);assert.equal(fixture.backend.calls(),0);assert.equal(h.vm().propertyVerificationState.entryPropertyId,null);
 h.vm().goBack();await h.settle();assert.equal(h.vm().screen,status==='draft'?'dashboard':'published');h.unmount();
});

test('Back during slow routine hydration invalidates late private result without saving',async()=>{
 const fixture=savedHydrationHarness();await fixture.init();let release!:(c:any)=>void;const wait=new Promise<any>(r=>release=r);const h=fixture.mount({load:()=>wait,hasPending:async()=>false});await h.settle();h.vm().openPortfolioItem(fixture.backend.propertyId);await h.settle();assert.equal(h.vm().propertyRoutineState.status,'loading');h.vm().goBack();h.flush();release({property_id:fixture.backend.propertyId});await h.settle();assert.equal(h.vm().screen,'dashboard');assert.equal(h.vm().propertyRoutineState.status,'idle');assert.equal(fixture.backend.calls(),0);h.unmount();
});

for(const status of ['active','paused'])test(`Manage -> Edit Listing -> property/photos -> Back preserves ${status} context`,async()=>{
 const f=savedHydrationHarness();await f.init();f.setRow({...f.getRow(),status,published_at:'2026-11-01T00:00:00Z',completeness_score:1});const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();h.vm().editManagedListing();await h.settle();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().publishedEditing,true);await h.vm().nextListingDetails();await h.settle();
 h.vm().updateDraft('title','Unsaved listing edit');h.flush();h.vm().goBack();h.flush();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().draft.title,'Unsaved listing edit');h.vm().navigate('photoManager');await h.settle();h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().draft.title,'Unsaved listing edit');h.vm().updateDraft('title',f.getRow().title);h.flush();h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'published');assert.equal(h.vm().workspaceListingId,f.backend.listingId);assert.equal(f.backend.calls(),0);h.unmount();
});

test('saved draft no-op and reverted saves are disabled without a request',async()=>{const f=savedHydrationHarness();await f.init();const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();await h.settle();assert.equal(h.vm().composerSaveDisabled,true);await h.vm().saveComposerDraft();assert.equal(f.backend.calls(),0);h.vm().updateDraft('askingRent','12,000.00');h.flush();assert.equal(h.vm().composerSaveDisabled,true);h.vm().updateDraft('title','Changed');h.flush();assert.equal(h.vm().composerSaveDisabled,false);h.vm().updateDraft('title','');h.flush();assert.equal(h.vm().composerSaveDisabled,true);h.vm().updateDraft('title',f.getRow().title);h.flush();assert.equal(h.vm().composerSaveDisabled,true);h.unmount();});

test('returning from dirty property subeditor discards only property edits and keeps listing changes',async()=>{
 const f=savedHydrationHarness();await f.init();const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();await h.settle();h.vm().updateDraft('title','Keep listing edits');h.vm().propertyRoutine.update('bedrooms','2');h.flush();h.vm().reloadPropertyDetails();h.flush();assert.equal(h.dialog().visible,true);h.vm().confirmNavigation();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().propertyRoutineState.draft?.bedrooms,'1');assert.equal(h.vm().draft.title,'Keep listing edits');h.vm().propertyRoutine.update('bedrooms','2');h.flush();h.vm().goBack();h.flush();assert.equal(h.dialog().visible,true);h.vm().cancelNavigation();h.flush();assert.equal(h.vm().propertyRoutineState.draft?.bedrooms,'2');assert.equal(f.backend.calls(),0);h.unmount();
});
for(const status of ['active','paused'])test(`Back while opening Edit Listing returns to ${status} management and ignores stale hydration`,async()=>{const f=savedHydrationHarness();await f.init();f.setRow({...f.getRow(),status,published_at:'2026-11-01T00:00:00Z',completeness_score:1});const h=f.mount();await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();f.pause();h.vm().editManagedListing();await h.settle();assert.equal(h.vm().draftHydration.status,'loading');h.vm().goBack();h.flush();assert.equal(h.vm().screen,'published');f.release();await h.settle();await h.settle();assert.equal(h.vm().screen,'published');assert.equal(h.vm().realListing?.status,status);assert.equal(f.backend.calls(),0);h.unmount();});

test('property details with no listing open the wizard at Step 1 and need no listing or listing save',async()=>{const property='10000000-0000-4000-8000-000000000001';const c:any={owner_id:'test-owner',property_id:property,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'house',city:'imus',barangay:'Fixture',floor_number:null,total_floors:2,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false};const item={propertyId:property,property:{id:property,is_active:true},currentListing:null,listings:[],tier3:{status:'not_submitted'}};const h=mountProperty(null,{}, {restore:async()=>null},undefined,undefined,{initialScreen:'dashboard',portfolio:{user:async()=>'test-owner',assertUser:async()=>{},load:async()=>[item]},routine:{load:async()=>c,hasPending:async()=>false}});await h.settle();h.vm().editPortfolioPropertyDetails(property);await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().postingStep,1);assert.equal(h.vm().workspacePropertyId,property);assert.equal(h.vm().workspaceListingId,null);assert.equal(h.vm().propertyRoutine.canSave(),false);h.vm().goBack();await h.settle();assert.equal(h.vm().screen,'dashboard');assert.equal(h.writes(),0);h.unmount();});


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
  assert.equal(h.vm().draft.askingRent,'5000');for(const bad of [NaN,0,-500,Infinity])assert.equal(h.vm().applyRentFromRange(bad),false);h.flush();assert.equal(h.vm().draft.askingRent,'5000','an unusable rent from the range slider is ignored');
 assert.equal(h.vm().applyRentFromRange(18000),true);h.flush();assert.equal(h.vm().draft.askingRent,'18000');assert.equal(f.backend.calls(),0);assert.equal(h.writes(),0);
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
 h.vm().applyRentFromRange(18000);h.flush();assert.equal(h.vm().draft.askingRent,'18000');assert.deepEqual(events,['property']);
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


test('T8-A new posting traverses Property Listing Estimate Review with stable UUID and Back',async()=>{const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();const id=h.vm().workspacePropertyId;assert.equal(h.vm().postingWizard,true);h.vm().continuePostingEstimate();h.flush();assert.equal(h.vm().screen,'postingEstimate');await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingReview');h.hardwareBack();h.flush();assert.equal(h.vm().screen,'postingEstimate');h.hardwareBack();h.flush();assert.equal(h.vm().screen,'listingDetails');h.hardwareBack();h.flush();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().editorMode,'draft','Back to the property step shows the editable saved-property form, not the locked create form');assert.equal(h.vm().workspacePropertyId,id);assert.ok(h.vm().draft.askingRent);assert.deepEqual(events,['property','draft'],'one property save at step 1, one draft save when leaving Price');h.unmount();});
test('T8-A leaving Price saves one real draft; Review does not save it again and nothing is published',async()=>{const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().continuePostingEstimate();h.flush();assert.equal(events.filter(x=>x==='draft').length,0,'the Listing step saves nothing');await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingReview');assert.equal(events.filter(x=>x==='property').length,1);assert.equal(events.filter(x=>x==='draft').length,1);assert.equal(h.vm().postingDraftSaved,true);assert.equal(await h.vm().saveComposerDraft(true),true,'a clean saved draft counts as saved');await h.settle();assert.equal(events.filter(x=>x==='draft').length,1,'no second save');assert.equal(h.vm().postingPublishReady,false,'saving never publishes');h.unmount();});

test('T8-A Keep My Price restores the chosen rent after explicit adoption without saving',async()=>{const {h,fields,confirmMap,events,backend}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().continuePostingEstimate();h.flush();const chosen=h.vm().draft.askingRent;h.vm().applyRentFromRange(18000);h.flush();assert.equal(h.vm().draft.askingRent,'18000');h.vm().keepPostingPrice();h.flush();assert.equal(h.vm().draft.askingRent,chosen);assert.deepEqual(events,['property'],'adopting and keeping a price saves nothing');await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingReview');assert.deepEqual(events,['property','draft'],'only leaving Price saves, with the kept rent');assert.equal(h.vm().listingDraftState.lastConfirmed?.asking_rent_monthly,Number(chosen));h.unmount();});
test('T8-A invalid listing fields cannot advance and no listing writes occur',async()=>{const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().updateDraft('title','');h.flush();h.vm().continuePostingEstimate();h.flush();assert.equal(h.vm().screen,'listingDetails');assert.match(h.vm().composerNotice??'',/listing title/);assert.deepEqual(events,['property']);h.unmount();});
test('T8-A rent moved to Price: an empty rent does not block Listing, but cannot leave Price, and nothing is saved',async()=>{const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().updateDraft('askingRent','');h.flush();h.vm().continuePostingEstimate();h.flush();assert.equal(h.vm().screen,'postingEstimate','Listing step no longer requires rent');assert.ok(h.vm().priceIssue);assert.equal(h.vm().priceIssue!.message,'Enter monthly asking rent greater than zero.');await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingEstimate');assert.equal(h.vm().priceAttempted,true);assert.match(h.vm().composerNotice??'',/asking rent/);assert.deepEqual(events,['property']);h.vm().typeAskingRent('0');h.flush();await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingEstimate','zero is not a rent');assert.deepEqual(events,['property']);h.vm().typeAskingRent('26,000');h.flush();assert.equal(h.vm().priceIssue,null);await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingReview');assert.deepEqual(events,['property','draft']);h.unmount();});
test('T8-A a failed save at Price keeps the user on Price with the draft retained',async()=>{const {h,fields,confirmMap,events}=unifiedHarness('draft');await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().continuePostingEstimate();h.flush();await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingEstimate');assert.deepEqual(events,['property','draft']);assert.equal(h.vm().draft.askingRent,'15000');assert.ok(h.vm().listingDraftState.uncertain||h.vm().listingDraftState.error);h.unmount();});
test('T8-A edit links from Review return to Review after the edit and save the draft',async()=>{const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().continuePostingEstimate();h.flush();await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingReview');
 h.vm().editPostingStep('listing');h.flush();assert.equal(h.vm().screen,'listingDetails');h.vm().updateDraft('title','Edited from Review');h.flush();h.vm().continuePostingEstimate();h.flush();await h.settle();assert.equal(h.vm().screen,'postingReview','the edited step returns to Review');assert.equal(h.vm().draft.title,'Edited from Review');assert.equal(h.vm().listingDraftState.lastConfirmed?.title,'Edited from Review','and the draft is saved');assert.equal(h.vm().returnTo,null);
 h.vm().editPostingStep('price');h.flush();assert.equal(h.vm().screen,'postingEstimate');await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingReview');
 h.vm().editPostingStep('property');h.flush();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().editorMode,'draft','the property step opened from Review is the editable form');assert.equal(h.vm().propertyRoutineState.status,'ready');h.vm().propertyRoutine.update('bedrooms','2');h.flush();await h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'postingReview');assert.equal(h.vm().propertySummary.bedrooms,'2');h.unmount();});
test('T8-A leaving unsaved Review remains guarded and no verification is fabricated',async()=>{const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().continuePostingEstimate();h.flush();await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().postingPublishReady,false);h.vm().updateDraft('title','Unsaved edit on Review');h.flush();h.vm().requestNavigation(()=>assert.fail('unsaved navigation'));h.flush();assert.equal(h.vm().navigationConfirmation,true);h.vm().cancelNavigation();h.flush();assert.equal(h.vm().screen,'postingReview');assert.deepEqual(events,['property','draft']);const checklist=h.vm().postingChecklist;assert.equal(checklist.find(i=>i.key==='verification')!.done,false);assert.equal(checklist.find(i=>i.key==='listing')!.done,false,'unsaved edits are not a saved listing');h.unmount();});

test('T8-A a rent applied from the range slider fills the rent only, without saving; a range for another property is ignored',async()=>{const {h,fields,confirmMap,events,backend}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().continuePostingEstimate();h.flush();const chosen=h.vm().draft.askingRent;const step=h.postingPriceStep();assert.equal(step.viewModel.workspacePropertyId,backend.propertyId);const receipt:any={target:{propertyId:backend.propertyId},currency:'PHP',modelVersion:'fixture',askingRent:null,predictedAt:'2026-11-10T00:00:00Z',illustrativeRange:{minimum:13500,maximum:26000}};assert.equal(h.vm().postingEstimate,null,'no range in state yet');assert.equal(h.vm().postingRangeRelation,null);h.vm().setPostingEstimate(receipt);h.flush();assert.deepEqual(h.vm().postingEstimate!.illustrativeRange,{minimum:13500,maximum:26000});assert.equal('estimatedMonthlyRent' in h.vm().postingEstimate!,false);assert.equal(h.vm().draft.askingRent,chosen,'having a range changes nothing');h.vm().applyRentFromRange(19500);h.flush();assert.equal(h.vm().draft.askingRent,'19500');assert.equal(h.vm().postingRangeRelation,'within');assert.equal(h.vm().priceKeepAvailable,true);assert.deepEqual(events,['property'],'applying a rent fills the field and saves nothing');h.vm().applyRentFromRange(30000);h.flush();assert.equal(h.vm().postingRangeRelation,'above');h.vm().applyRentFromRange(9000);h.flush();assert.equal(h.vm().postingRangeRelation,'below');h.vm().keepPostingPrice();h.flush();assert.equal(h.vm().draft.askingRent,chosen);assert.equal(h.vm().priceKeepAvailable,false);const other:any={...receipt,target:{propertyId:'99999999-9999-4999-8999-999999999999'}};h.vm().setPostingEstimate(other);h.flush();assert.equal(h.vm().postingEstimate,null,'a range for another property is never used');h.unmount();});


test('Stage A: the first visit uses the create form; once saved, the property step is the editable saved-property form, also after Back from Listing, Price and Review',async()=>{
 const {h,fields,confirmMap,events}=unifiedHarness();await h.settle();fields();await confirmMap();
 assert.equal(h.vm().editorMode,'create');assert.equal(h.vm().propertyRoutineState.status,'idle');
 await h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().editorMode,'draft');assert.equal(h.vm().propertyRoutineState.status,'ready');assert.equal(h.vm().composerNotice,'Property saved','a visible confirmation');
 for(const via of ['listing','price','review']){
  if(via==='price'){h.vm().continuePostingEstimate();h.flush();assert.equal(h.vm().screen,'postingEstimate');}
  if(via==='review'){h.vm().continuePostingEstimate();h.flush();await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingReview');}
  while(h.vm().screen!=='listingComposer'){h.vm().goBack();h.flush();await h.settle();}
  assert.equal(h.vm().editorMode,'draft',`Back from ${via} lands on the editable form`);assert.equal(h.vm().propertyRoutineState.status,'ready');
  h.vm().propertyRoutine.update('bedrooms',via==='listing'?'1':via==='price'?'2':'3');h.flush();assert.equal(h.vm().propertyRoutineState.draft!.bedrooms,via==='listing'?'1':via==='price'?'2':'3','saved fields accept edits');
  await h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().propertySummary.bedrooms,via==='listing'?'1':via==='price'?'2':'3','the edit is saved when continuing');
 }
 assert.equal(events.filter(x=>x==='property').length,1,'the property is created once');h.unmount();
});
test('Stage A: a saved-property load that fails after creation never blocks Listing or Price, and the property step offers Retry on return',async()=>{
 const {h,fields,confirmMap,events}=unifiedHarness('none',{routineFails:true});await h.settle();fields();await confirmMap();
 await h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingDetails','the property is saved, so the wizard continues');assert.equal(h.vm().propertyRoutineState.status,'idle','the failed read is closed again');
 h.vm().updateDraft('title','Edited after a failed read');h.flush();assert.equal(h.vm().draft.title,'Edited after a failed read','listing edits are not blocked');h.vm().continuePostingEstimate();h.flush();assert.equal(h.vm().screen,'postingEstimate');
 h.vm().goBack();h.flush();h.vm().goBack();h.flush();await h.settle();assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().propertyRoutineState.status,'error');assert.equal(h.vm().editorMode,'draft');assert.equal(h.vm().propertyNextDisabled,true,'Continue waits for a successful load; Retry is on the form');
 assert.deepEqual(events,['property'],'no second property is ever created');h.unmount();
});
test('Stage B: floor area is required in the wizard only when the property can be estimated, and Continue says what is missing',async()=>{
 const {h,fields,confirmMap}=unifiedHarness();await h.settle();fields();await confirmMap();const c=h.vm().propertyCreation;
 const before=h.vm().estimateDetails;assert.equal(before.total,8);
 c.updateField('floorAreaSqm','');h.flush();assert.equal(h.vm().floorAreaRequired,true);assert.equal(h.vm().floorAreaMissing,true);assert.equal(h.vm().propertyNextDisabled,true);assert.equal(h.vm().propertyNextStatus,'Add floor area');
 assert.equal(h.vm().estimateDetails.filled,before.filled-1,'the count follows the field');
 await h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingComposer','the action itself refuses, not only the disabled button');assert.equal(h.vm().workspacePropertyId,null);
 for(const bad of ['0','-3','abc']){c.updateField('floorAreaSqm',bad);h.flush();assert.equal(h.vm().floorAreaMissing,true,bad);assert.equal(h.vm().propertyNextDisabled,true,bad);}
 c.updateField('floorAreaSqm','42');h.flush();assert.equal(h.vm().floorAreaMissing,false);assert.equal(h.vm().propertyNextDisabled,false);
 c.updateField('floorAreaSqm','');c.updateField('propertyType','boarding_house');h.flush();assert.equal(h.vm().floorAreaRequired,false,'not estimable: optional');assert.equal(h.vm().floorAreaMissing,false);assert.equal(h.vm().propertyNextDisabled,false);
 c.updateField('propertyType','house');h.flush();assert.equal(h.vm().floorAreaRequired,true);assert.equal(h.vm().propertyNextDisabled,true);
 c.updateField('city','tagaytay');h.flush();assert.equal(h.vm().floorAreaRequired,true);c.updateField('floorAreaSqm','90');h.flush();assert.equal(h.vm().floorAreaMissing,false,'B15: a city change re-opens location confirmation, so only the area rule is checked here');
 c.updateField('floorNumber','');c.updateField('lotAreaSqm','120');c.updateField('parkingSpaces','2');c.updateField('propertySubtype','villa');h.flush();assert.equal(h.vm().estimateDetails.filled,before.filled+3,'lot area, parking and subtype join the already counted area');
 c.updateField('maxOccupants','5');c.updateField('totalFloors','2');h.flush();assert.equal(h.vm().estimateDetails.filled,before.filled+3,'occupants and floors in building are not model inputs and do not count');
 h.unmount();
});
test('Stage B: the saved-property form applies the same rule and an edited area is saved on Continue',async()=>{
 const {h,fields,confirmMap}=unifiedHarness();await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();h.vm().goBack();h.flush();await h.settle();
 assert.equal(h.vm().editorMode,'draft');assert.equal(h.vm().floorAreaRequired,true);assert.equal(h.vm().floorAreaMissing,false);assert.equal(h.vm().estimateDetails.total,8);
 h.vm().propertyRoutine.update('floorAreaSqm','');h.flush();assert.equal(h.vm().floorAreaMissing,true);assert.equal(h.vm().propertyNextDisabled,true);assert.equal(h.vm().propertyNextStatus,'Add floor area to continue.');
 await h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingComposer');
 h.vm().propertyRoutine.update('floorAreaSqm','60');h.flush();assert.equal(h.vm().propertyNextDisabled,false);await h.vm().nextListingDetails();await h.settle();assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().estimationProperty?.floor_area_sqm,60);h.unmount();
});
test('Stage D: the Price page fixes a missing floor area with the existing versioned property save, and only on Price',async()=>{
 const {h,fields,confirmMap,events}=unifiedHarness('none',{areaMissing:true});await h.settle();fields();await confirmMap();await h.vm().nextListingDetails();await h.settle();
 assert.equal(await h.vm().savePostingFloorArea('85'),false,'not on the Price page');
 h.vm().continuePostingEstimate();h.flush();assert.equal(h.vm().screen,'postingEstimate');assert.equal(h.vm().floorAreaMissing,true,'the saved property has no floor area, so the estimate is blocked');assert.equal(h.vm().estimationProperty?.floor_area_sqm,null);
 for(const bad of ['','0','abc','-5']){assert.equal(await h.vm().savePostingFloorArea(bad),false,bad);assert.equal(h.vm().estimationProperty?.floor_area_sqm,null);h.vm().propertyRoutine.discard();h.flush();}
 assert.equal(await h.vm().savePostingFloorArea('85'),true);h.flush();assert.equal(h.vm().estimationProperty?.floor_area_sqm,85,'the estimator now sees the saved area');assert.equal(h.vm().floorAreaMissing,false);assert.match(h.vm().propertyRoutineState.notice??'',/saved/i);
 assert.deepEqual(events,['property'],'no listing save and no second property');h.unmount();
});

for (const [score, done] of [[0.79, false], [0.8, true], [0.85, true]] as const) test(`T8-A Review checklist: a saved listing at ${score} completeness is ${done ? '' : 'not '}ready, and Publish stays gated by verification`, async () => {
  const { h, fields, confirmMap } = unifiedHarness('none', { score }); await h.settle(); fields(); await confirmMap(); await h.vm().nextListingDetails(); await h.settle();
  h.vm().continuePostingEstimate(); h.flush(); await h.vm().continuePostingReview(); await h.settle(); assert.equal(h.vm().screen, 'postingReview');
  const items = Object.fromEntries(h.vm().postingChecklist.map(i => [i.key, i])) as Record<string, { done: boolean; detail: string | null }>;
  assert.equal(items.listing!.done, done); assert.equal(items.listing!.detail, done ? null : 'At least 80% is required to publish'); assert.equal(items.price!.done, true); assert.equal(items.verification!.done, false);
  assert.equal(h.vm().postingPublishReady, false, 'no Tier 3 approval, so never ready'); assert.ok(h.vm().postingChecklist.some(i => !i.done), 'Publish is gated while any item is open'); h.unmount();
});
for(const status of ['draft','active','paused'])test(`T8-B ${status} opens shared four-step editor and preserves original identity`,async()=>{
 const f=savedHydrationHarness();await f.init();f.setRow({...f.getRow(),status,completeness_score:1,published_at:status==='draft'?null:'2026-11-01T00:00:00Z'});
 const c:any={owner_id:'test-owner',property_id:f.backend.propertyId,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:null,total_floors:2,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false};let saves=0;
 const h=f.mount({load:async()=>c,hasPending:async()=>false,save:async(_c:any,d:any)=>{saves++;return{...c,bedrooms:Number(d.bedrooms)};}});
 await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();if(status!=='draft'){h.vm().editManagedListing();await h.settle();}await h.settle();
 assert.equal(h.vm().screen,'listingComposer');assert.equal(h.vm().postingWizard,true);assert.equal(h.vm().editorMode,status==='draft'?'draft':'published');assert.equal(h.vm().draftHydration.status,'ready',JSON.stringify(h.vm().draftHydration));assert.equal(h.vm().draft.title,f.getRow().title);
 h.vm().propertyRoutine.update('bedrooms','2');h.flush();await h.vm().nextListingDetails();await h.settle();assert.equal(saves,1);assert.equal(h.vm().screen,'listingDetails');assert.equal(h.vm().propertySummary.bedrooms,'2');
 h.vm().continuePostingEstimate();h.flush();assert.equal(h.vm().screen,'postingEstimate');await h.vm().continuePostingReview();await h.settle();assert.equal(h.vm().screen,'postingReview');h.vm().goBack();h.flush();assert.equal(h.vm().screen,'postingEstimate');
 assert.equal(h.vm().workspacePropertyId,f.backend.propertyId);assert.equal(h.vm().workspaceListingId,f.backend.listingId);assert.equal(f.backend.calls(),0);h.unmount();
});


for(const status of ['draft','active','paused'])test(`T8-B ${status} Review saves original listing and retains status`,async()=>{
 const f=savedHydrationHarness();await f.init();f.setRow({...f.getRow(),status,completeness_score:1,published_at:status==='draft'?null:'2026-11-01T00:00:00Z'});let writes=0;
 const c:any={owner_id:'test-owner',property_id:f.backend.propertyId,edit_version:'60000000-0000-4000-8000-000000000001',property_type:'apartment',city:'imus',barangay:'Fixture',floor_number:null,total_floors:2,bedrooms:1,bathrooms:1,floor_area_sqm:30,max_occupants:2,furnishing_status:'unfurnished',access_instructions:null,amenity_ids:[],catalog:[],open_tenancy:false};
 const service={...f.backend.service,read:async()=>f.getRow(),save:async(_context:any,d:any,expected:any)=>{writes++;assert.equal(expected.listingId,f.backend.listingId);const row={...f.getRow(),title:d.title};f.setRow(row);return row;}};
 const h=f.mount({load:async()=>c,hasPending:async()=>false},undefined,service);await h.settle();h.vm().openPortfolioItem(f.backend.propertyId);await h.settle();if(status!=='draft'){h.vm().editManagedListing();await h.settle();}await h.settle();await h.vm().nextListingDetails();await h.settle();h.vm().updateDraft('title','Updated rental title');h.flush();h.vm().continuePostingEstimate();h.flush();await h.vm().continuePostingReview();await h.settle();await h.vm().saveComposerDraft();await h.settle();
 assert.equal(h.vm().screen,'postingReview');assert.equal(h.vm().workspaceListingId,f.backend.listingId);assert.equal(h.vm().listingDraftState.lastConfirmed?.status,status);assert.equal(h.vm().draft.title,'Updated rental title');assert.equal(status==='draft'?f.backend.calls():writes,1);assert.equal(h.writes(),0);h.unmount();
});

// ---- Consent integrity: a sharing wish belongs to the point that was on screen when the owner pressed
import { shareCardView } from '../src/features/property-listing/models/LocationShare';
const CHANGED = 'Location changed. Confirm sharing again.';
const shareService = () => {
  const calls: any[] = [];
  return { calls, service: {
    load: async (actor: string, id: string) => { calls.push(['load', actor, id]); return { revision: '10000000-0000-4000-8000-000000000001', approved: false, eligible: true, policy: 'rental-public-location-v1', point: { latitude: 14.4, longitude: 120.9 } }; },
    save: async (actor: string, id: string, s: any, approve: boolean) => { calls.push(['save', actor, id, s.revision, s.policy, approve]); return { ...s, approved: approve }; },
  } };
};
const movePin = async (h: any, lng = 120.95, lat = 14.45) => {
  h.vm().openPropertyLocation(); await h.settle();
  const map = h.vm().propertyLocation; map.chooseCandidate('real-candidate'); map.mapLoaded(); map.movePoint([lng, lat]); assert.equal(map.confirmExact(), true);
};
const cardState = (h: any) => shareCardView({ saved: false, addressReady: true, confirmed: !!h.vm().propertyState.draft.publicLatitude, wanted: h.vm().shareLocationWanted, approval: null, approvalLoading: false, approvalError: false, busy: false });
test('a wish pressed on a confirmed point is applied once, after the first save, with exactly the two approval calls', async () => {
  const s = shareService(), { h, fields, confirmMap, backend } = unifiedHarness('none', { locationShare: s.service }); await h.settle(); fields(); await confirmMap();
  assert.equal(h.vm().shareLocationWanted, false);
  h.vm().setShareLocationWanted(true); h.flush();
  assert.equal(h.vm().shareLocationWanted, true); assert.equal(h.vm().shareLocationNotice, null);
  assert.deepEqual(s.calls, [], 'the press itself calls no service');
  await h.vm().nextListingDetails(); await h.settle();
  assert.deepEqual(s.calls, [['load', 'test-owner', backend.propertyId], ['save', 'test-owner', backend.propertyId, '10000000-0000-4000-8000-000000000001', 'rental-public-location-v1', true]]);
  assert.equal(h.vm().shareLocationWanted, false, 'spent');
  assert.equal(h.vm().screen, 'listingDetails'); h.unmount();
});
test('a press before the map is confirmed waits, binds to the point the owner then confirms, and is applied', async () => {
  const s = shareService(), { h, fields, confirmMap } = unifiedHarness('none', { locationShare: s.service }); await h.settle(); fields();
  h.vm().setShareLocationWanted(true); h.flush();
  assert.equal(h.vm().shareLocationWanted, true, 'waiting for the map');
  await confirmMap(); h.flush();
  assert.equal(h.vm().shareLocationWanted, true, 'bound to the confirmed point');
  await h.vm().nextListingDetails(); await h.settle();
  assert.deepEqual(s.calls.map(c => c[0]), ['load', 'save']); h.unmount();
});
const triggers: [string, (h: any) => Promise<void> | void][] = [
  ['the barangay is edited', h => h.vm().propertyCreation.updateField('barangay', 'Another barangay')],
  ['the street is edited', h => h.vm().propertyCreation.updateField('addressLine1', 'Another street')],
  ['the city changes', h => h.vm().propertyCreation.updateField('city', 'tagaytay')],
  ['the building is edited', h => h.vm().propertyCreation.updateField('addressLine2', 'Tower B')],
  ['the postal code is edited', h => h.vm().propertyCreation.updateField('postalCode', '4103')],
  ['the property type changes', h => h.vm().propertyCreation.updateField('propertyType', 'condominium')],
  ['the rental floor changes', h => h.vm().propertyCreation.updateField('floorNumber', '7')],
  ['the map pin moves and is confirmed again', h => movePin(h)],
];
for (const [name, change] of triggers) test(`the wish is cleared with a notice when ${name} before the first save, and is never applied`, async () => {
  const s = shareService(), { h, fields, confirmMap, events } = unifiedHarness('none', { locationShare: s.service }); await h.settle(); fields(); await confirmMap();
  h.vm().setShareLocationWanted(true); h.flush(); assert.equal(h.vm().shareLocationWanted, true);
  await change(h); h.flush(); await h.settle(); h.flush();
  assert.equal(h.vm().shareLocationWanted, false, 'cleared');
  assert.equal(h.vm().shareLocationNotice, CHANGED);
  assert.equal(cardState(h).button!.action, h.vm().propertyState.draft.publicLatitude ? 'recordWish' : 'openMapShare', 'the button is back to asking');
  assert.equal(cardState(h).asking, true);
  // The decision belonged to the old point, so the owner decides again before saving: here, without sharing.
  if (!h.vm().propertyState.draft.publicLatitude) await confirmMap(); else { h.vm().setShareLocationWanted(false); h.flush(); }
  await h.vm().nextListingDetails(); await h.settle();
  assert.deepEqual(events.slice(0, 1), ['property'], 'the property itself still saves');
  assert.deepEqual(s.calls, [], 'no consent call for a point the owner did not press on'); h.unmount();
});
test('a change that lands between the last render and the save is still caught, because the save compares the live point', async () => {
  const s = shareService(), { h, fields, confirmMap, events } = unifiedHarness('none', { locationShare: s.service }); await h.settle(); fields(); await confirmMap();
  h.vm().setShareLocationWanted(true); h.flush(); assert.equal(h.vm().shareLocationWanted, true);
  await movePin(h); // no flush: the wish in the last render is still bound to the old point
  await h.vm().nextListingDetails(); await h.settle();
  assert.deepEqual(events.slice(0, 1), ['property']);
  assert.deepEqual(s.calls, []); h.unmount();
});
test('pressing again clears the old "Location changed" notice, and binds to the point now on screen', async () => {
  const s = shareService(), { h, fields, confirmMap } = unifiedHarness('none', { locationShare: s.service }); await h.settle(); fields(); await confirmMap();
  h.vm().setShareLocationWanted(true); h.flush();
  await movePin(h); h.flush(); await h.settle(); h.flush();
  assert.equal(h.vm().shareLocationWanted, false); assert.equal(h.vm().shareLocationNotice, CHANGED);
  h.vm().setShareLocationWanted(true); h.flush();
  assert.equal(h.vm().shareLocationNotice, null, 'the notice goes when the owner presses again');
  assert.equal(h.vm().shareLocationWanted, true);
  await h.vm().nextListingDetails(); await h.settle();
  assert.deepEqual(s.calls.map(c => c[0]), ['load', 'save'], 'the new press is bound to the new point and applies'); h.unmount();
});
test('typing in a field that does not touch the point or the identity keeps the wish', async () => {
  const { h, fields, confirmMap } = unifiedHarness('none', { locationShare: shareService().service }); await h.settle(); fields(); await confirmMap();
  h.vm().setShareLocationWanted(true); h.flush();
  h.vm().propertyCreation.updateField('bedrooms', '3'); h.vm().propertyCreation.updateField('floorAreaSqm', '60'); h.vm().propertyCreation.updateField('maxOccupants', '4'); h.vm().propertyCreation.updateField('furnishingStatus', 'furnished'); h.flush();
  assert.equal(h.vm().shareLocationWanted, true); assert.equal(h.vm().shareLocationNotice, null); h.unmount();
});
test('the wish is cleared when the property save fails, and nothing is shared', async () => {
  const s = shareService(), { h, fields, confirmMap, events } = unifiedHarness('property', { locationShare: s.service }); await h.settle(); fields(); await confirmMap();
  h.vm().setShareLocationWanted(true); h.flush();
  await h.vm().nextListingDetails(); await h.settle(); h.flush();
  assert.deepEqual(events, ['property']); assert.equal(h.vm().workspacePropertyId, null); assert.equal(h.vm().screen, 'listingComposer');
  assert.equal(h.vm().shareLocationWanted, false, 'cleared by the failed save');
  assert.deepEqual(s.calls, []);
  assert.equal(cardState(h).button!.action, 'recordWish', 'the button asks again');
  h.unmount();
});
test('the wish is cleared when the save outcome is unknown too', async () => {
  const s = shareService(), { h, fields, confirmMap } = unifiedHarness('uncertain-property', { locationShare: s.service }); await h.settle(); fields(); await confirmMap();
  h.vm().setShareLocationWanted(true); h.flush();
  await h.vm().nextListingDetails(); await h.settle(); h.flush();
  assert.equal(h.vm().shareLocationWanted, false); assert.deepEqual(s.calls, []); h.unmount();
});
test('the wish is cleared when the owner presses Skip after confirming, and the save shares nothing', async () => {
  const s = shareService(), { h, fields, confirmMap, events } = unifiedHarness('none', { locationShare: s.service }); await h.settle(); fields(); await confirmMap();
  h.vm().setShareLocationWanted(true); h.flush(); assert.equal(h.vm().shareLocationWanted, true);
  h.vm().setShareLocationWanted(false); h.flush();
  assert.equal(h.vm().shareLocationWanted, false); assert.equal(h.vm().shareLocationNotice, null, 'a deliberate skip is not a change');
  await h.vm().nextListingDetails(); await h.settle();
  assert.deepEqual(events.slice(0, 1), ['property']); assert.deepEqual(s.calls, []); h.unmount();
});
test('the wish is cleared when the owner leaves the wizard, and a later visit starts with none', async () => {
  const s = shareService(), { h, fields, confirmMap } = unifiedHarness('none', { locationShare: s.service }); await h.settle(); fields(); await confirmMap();
  h.vm().setShareLocationWanted(true); h.flush(); assert.equal(h.vm().shareLocationWanted, true);
  h.vm().goBack(); h.flush(); if (h.vm().navigationConfirmation) { h.vm().confirmNavigation(); h.flush(); }
  await h.settle(); h.flush();
  assert.notEqual(h.vm().screen, 'listingComposer'); assert.equal(h.vm().shareLocationWanted, false);
  h.vm().startCreate(); await h.settle(); h.flush();
  assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().shareLocationWanted, false, 'a new visit never inherits a wish'); assert.deepEqual(s.calls, []); h.unmount();
});
test('a wish pressed on a saved property is not a wish: the card calls the approval hook directly', async () => {
  const { h, fields, confirmMap } = unifiedHarness('none', { locationShare: shareService().service }); await h.settle(); fields(); await confirmMap();
  await h.vm().nextListingDetails(); await h.settle();
  assert.ok(h.vm().workspacePropertyId);
  h.vm().setShareLocationWanted(true); h.flush(); await h.settle(); h.flush();
  assert.equal(h.vm().shareLocationWanted, false, 'once saved there is nothing to queue'); h.unmount();
});

// ---- Stage 3: one editor per state
import { LISTING_CHANGED_MESSAGE, LISTING_NOT_EDITABLE_MESSAGE, TENANCY_BINDING_MESSAGE } from '../src/features/property-listing/models/RefusalMessages';
const routineContext = (f: any) => ({ owner_id: 'test-owner', property_id: f.backend.propertyId, edit_version: '60000000-0000-4000-8000-000000000001', property_type: 'apartment', city: 'imus', barangay: 'Fixture', floor_number: null, total_floors: 2, bedrooms: 1, bathrooms: 1, floor_area_sqm: 30, max_occupants: 2, furnishing_status: 'unfurnished', access_instructions: null, amenity_ids: [], catalog: [], open_tenancy: false });
/** A saved listing in the given state, opened the way the card opens it, with a recording published-update service. */
async function editorFixture(status: 'draft' | 'active' | 'paused', over: { refuse?: string; routineRefuse?: string; routineSave?: (d: any) => Promise<any> } = {}) {
  const f = savedHydrationHarness(); await f.init();
  f.setRow({ ...f.getRow(), status, completeness_score: 1, published_at: status === 'draft' ? null : '2026-11-01T00:00:00Z', asking_rent_monthly: 15000 });
  const saved: any[] = []; let routine = routineContext(f); let H: any;
  const service = { ...f.backend.service, read: async () => f.getRow(), save: async (_c: any, d: any, expected: any) => { saved.push({ rent: d.askingRent, listingId: expected.listingId }); if (over.refuse) throw H.draftConflict(over.refuse); const row = { ...f.getRow(), title: d.title, asking_rent_monthly: Number(d.askingRent) }; f.setRow(row); return row; } };
  const h = f.mount({ load: async () => routine, hasPending: async () => false, save: async (_c: any, d: any) => { if (over.routineRefuse) throw H.propertyEditError(over.routineRefuse, 'rejected'); if (over.routineSave) return over.routineSave(d); routine = { ...routine, bedrooms: Number(d.bedrooms), edit_version: '60000000-0000-4000-8000-000000000002' }; return routine; } }, undefined, service);
  H = h; await h.settle();
  return { f, h, saved, id: f.backend.propertyId };
}
const settle2 = async (h: any) => { await h.settle(); await h.settle(); h.flush(); };

for (const status of ['draft', 'active', 'paused'] as const) test(`${status}: the card button and "Edit property details" both open the same wizard at Step 1, and nothing opens a property-only screen`, async () => {
  const open = async (action: 'primary' | 'details') => {
    const { h, id } = await editorFixture(status);
    if (action === 'details') h.vm().editPortfolioPropertyDetails(id);
    else if (status === 'draft') h.vm().openPortfolioItem(id);      // Continue editing
    else h.vm().editPortfolioListing(id);                            // Edit listing
    await settle2(h);
    const seen = { screen: h.vm().screen, wizard: h.vm().postingWizard, mode: h.vm().editorMode, step: h.vm().postingStep, listing: h.vm().workspaceListingId };
    h.unmount(); return seen;
  };
  const primary = await open('primary'), details = await open('details');
  assert.deepEqual(primary, details, 'one editor');
  assert.equal(primary.screen, 'listingComposer'); assert.equal(primary.wizard, true); assert.equal(primary.step, 1);
  assert.equal(primary.mode, status === 'draft' ? 'draft' : 'published');
  assert.ok(primary.listing, 'the original listing is the one being edited');
});
for (const status of ['active', 'paused'] as const) test(`${status}: "Manage status" opens the status screen, which is not an editor`, async () => {
  const { h, id } = await editorFixture(status); h.vm().openPortfolioItem(id); await settle2(h);
  assert.equal(h.vm().screen, 'published'); assert.equal(h.vm().postingWizard, false); h.unmount();
});
test('no listing: Continue posting resumes at the first incomplete step; Edit property details opens Step 1', async () => {
  const mk = (floor: number | null) => ({ propertyId: 'p-1', property: { id: 'p-1', is_active: true, property_type: 'apartment', city: 'imus', furnishing_status: 'unfurnished', floor_area_sqm: floor }, currentListing: null, listings: [], tier3: { status: 'not_submitted' } });
  const run = async (floor: number | null, action: 'continue' | 'details') => {
    const c: any = { owner_id: 'test-owner', property_id: 'p-1', edit_version: '60000000-0000-4000-8000-000000000001', property_type: 'apartment', city: 'imus', barangay: 'Fixture', floor_number: null, total_floors: 2, bedrooms: 1, bathrooms: 1, floor_area_sqm: floor, max_occupants: 2, furnishing_status: 'unfurnished', access_instructions: null, amenity_ids: [], catalog: [], open_tenancy: false };
    const h = mountProperty(null, {}, { restore: async () => null }, undefined, undefined, { initialScreen: 'dashboard', portfolio: { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [mk(floor)] }, routine: { load: async () => c, hasPending: async () => false } });
    await h.settle(); if (action === 'continue') h.vm().continuePortfolioPosting('p-1'); else h.vm().editPortfolioPropertyDetails('p-1'); await settle2(h);
    const seen = [h.vm().screen, h.vm().postingWizard, h.vm().workspaceListingId]; h.unmount(); return seen;
  };
  assert.deepEqual(await run(30, 'continue'), ['listingDetails', true, null], 'Step 1 is complete, so resume at the Listing step');
  assert.deepEqual(await run(null, 'continue'), ['listingComposer', true, null], 'a size the range needs is missing, so resume at Step 1');
  assert.deepEqual(await run(30, 'details'), ['listingComposer', true, null]);
});
test('archived: Create a new listing opens the Listing step and Edit property details opens Step 1, both on the same property with no listing id', async () => {
  const mk = () => ({ propertyId: 'p-2', property: { id: 'p-2', is_active: true, property_type: 'apartment', city: 'imus', furnishing_status: 'unfurnished', floor_area_sqm: 30 }, currentListing: { id: 'l-old', status: 'archived', property_id: 'p-2' }, listings: [], tier3: { status: 'not_submitted' } });
  const c: any = { owner_id: 'test-owner', property_id: 'p-2', edit_version: '60000000-0000-4000-8000-000000000001', property_type: 'apartment', city: 'imus', barangay: 'Fixture', floor_number: null, total_floors: 2, bedrooms: 1, bathrooms: 1, floor_area_sqm: 30, max_occupants: 2, furnishing_status: 'unfurnished', access_instructions: null, amenity_ids: [], catalog: [], open_tenancy: false };
  const run = async (action: 'create' | 'details') => {
    const h = mountProperty(null, {}, { restore: async () => null }, undefined, undefined, { initialScreen: 'dashboard', portfolio: { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [mk()] }, routine: { load: async () => c, hasPending: async () => false } });
    await h.settle(); if (action === 'create') h.vm().createListingForProperty('p-2'); else h.vm().editPortfolioPropertyDetails('p-2'); await settle2(h);
    const seen = [h.vm().screen, h.vm().postingWizard, h.vm().workspaceListingId, h.vm().workspacePropertyId]; h.unmount(); return seen;
  };
  assert.deepEqual(await run('create'), ['listingDetails', true, null, 'p-2']);
  assert.deepEqual(await run('details'), ['listingComposer', true, null, 'p-2']);
});

for (const status of ['active', 'paused'] as const) test(`${status}: the rent is changed on the Price step (typed or from the range) and saved once on Review through the published update`, async () => {
  for (const how of ['typed', 'slider'] as const) {
    const { h, saved, id } = await editorFixture(status);
    h.vm().editPortfolioListing(id); await settle2(h);
    await h.vm().nextListingDetails(); await settle2(h); assert.equal(h.vm().screen, 'listingDetails');
    h.vm().continuePostingEstimate(); h.flush(); assert.equal(h.vm().screen, 'postingEstimate');
    if (how === 'typed') h.vm().typeAskingRent('18000'); else assert.equal(h.vm().applyRentFromRange(18500), true);
    h.flush(); assert.equal(h.vm().draft.askingRent, how === 'typed' ? '18000' : '18500');
    await h.vm().continuePostingReview(); await settle2(h); assert.equal(h.vm().screen, 'postingReview');
    assert.equal(saved.length, 0, 'nothing is saved before Save changes');
    await h.vm().saveComposerDraft(); await settle2(h);
    assert.deepEqual(saved, [{ rent: how === 'typed' ? '18000' : '18500', listingId: h.vm().workspaceListingId }], 'one published update with the new rent');
    assert.equal(h.vm().listingDraftState.lastConfirmed?.status, status, 'the status is preserved');
    assert.equal(h.vm().listingDraftState.lastConfirmed?.asking_rent_monthly, how === 'typed' ? 18000 : 18500);
    h.unmount();
  }
});
test('in edit mode the Listing step no longer asks for rent; the Price step does, and refuses to continue without one', async () => {
  const { h, saved, id } = await editorFixture('active'); h.vm().editPortfolioListing(id); await settle2(h);
  await h.vm().nextListingDetails(); await settle2(h);
  h.vm().updateDraft('askingRent', ''); h.flush();
  h.vm().continuePostingEstimate(); h.flush();
  assert.equal(h.vm().screen, 'postingEstimate', 'Step 2 does not need the rent');
  assert.equal(h.vm().priceIssue?.field, 'askingRent');
  await h.vm().continuePostingReview(); await settle2(h);
  assert.equal(h.vm().screen, 'postingEstimate', 'Price blocks until the rent is usable'); assert.equal(h.vm().priceAttempted, true);
  h.vm().typeAskingRent('16000'); h.flush(); await h.vm().continuePostingReview(); await settle2(h);
  assert.equal(h.vm().screen, 'postingReview'); assert.deepEqual(saved, []); h.unmount();
});
test('a draft still saves through the draft path when leaving the Price step', async () => {
  const { f, h, id } = await editorFixture('draft'); h.vm().openPortfolioItem(id); await settle2(h);
  await h.vm().nextListingDetails(); await settle2(h); h.vm().continuePostingEstimate(); h.flush(); h.vm().typeAskingRent('17000'); h.flush();
  const before = f.backend.calls(); await h.vm().continuePostingReview(); await settle2(h);
  assert.equal(h.vm().screen, 'postingReview'); assert.equal(f.backend.calls() - before, 1, 'one draft save'); h.unmount();
});

const refusals: [string, string][] = [['changed elsewhere', LISTING_CHANGED_MESSAGE], ['no longer editable', LISTING_NOT_EDITABLE_MESSAGE]];
for (const [name, message] of refusals) test(`a published save refused because the listing ${name} keeps the owner's edits, shows the plain message and offers a reload`, async () => {
  const { h, id } = await editorFixture('active', { refuse: message });
  h.vm().editPortfolioListing(id); await settle2(h); await h.vm().nextListingDetails(); await settle2(h);
  h.vm().updateDraft('title', 'My new title'); h.flush(); h.vm().continuePostingEstimate(); h.flush(); h.vm().typeAskingRent('19000'); h.flush();
  await h.vm().continuePostingReview(); await settle2(h);
  await h.vm().saveComposerDraft(); await settle2(h);
  assert.equal(h.vm().screen, 'postingReview', 'the owner stays where they are');
  assert.equal(h.vm().draft.askingRent, '19000'); assert.equal(h.vm().draft.title, 'My new title', 'every edit is still on screen');
  assert.equal(h.vm().listingDraftState.error, message);
  assert.equal(h.vm().listingDraftState.conflict, true);
  assert.equal(h.vm().listingDraftState.lastConfirmed?.asking_rent_monthly, 15000, 'the saved version is untouched');
  h.unmount();
});
test('a property save refused by an active tenancy keeps the owner on Step 1 with the edits and the plain explanation', async () => {
  const { h, id } = await editorFixture('active', { routineRefuse: TENANCY_BINDING_MESSAGE });
  h.vm().editPortfolioListing(id); await settle2(h);
  h.vm().propertyRoutine.update('bedrooms', '3'); h.flush();
  await h.vm().nextListingDetails(); await settle2(h);
  assert.equal(h.vm().screen, 'listingComposer', 'the refused save does not move on');
  assert.equal(h.vm().propertyRoutineState.draft?.bedrooms, '3', 'the edit is still on screen');
  assert.equal(h.vm().propertyRoutineState.error, TENANCY_BINDING_MESSAGE);
  assert.match(TENANCY_BINDING_MESSAGE, /^Existing agreements remain binding/);
  h.unmount();
});

test('the step header reaches every step from every step, in edit mode and for a draft', async () => {
  for (const status of ['active', 'draft'] as const) {
    const { h, id, saved } = await editorFixture(status);
    if (status === 'draft') h.vm().openPortfolioItem(id); else h.vm().editPortfolioListing(id);
    await settle2(h); assert.equal(h.vm().postingStep, 1);
    let at = 1;
    for (const next of [2, 3, 4, 1, 3, 2, 4, 2, 1, 4, 3, 1]) {
      h.vm().goToPostingStep(next as 1 | 2 | 3 | 4); await settle2(h);
      assert.equal(h.vm().postingStep, next, `${status}: ${at} -> ${next}`); at = next;
    }
    if (status === 'active') assert.deepEqual(saved, [], 'moving between steps never saves the listing: only Save changes does');
    h.unmount();
  }
});
test('leaving Step 1 by the header saves property changes first, then lands on the tapped step', async () => {
  let saves = 0;
  const { h, id } = await editorFixture('active', { routineSave: async (d: any) => { saves++; return { owner_id: 'test-owner', property_id: id, edit_version: '60000000-0000-4000-8000-000000000002', property_type: 'apartment', city: 'imus', barangay: 'Fixture', floor_number: null, total_floors: 2, bedrooms: Number(d.bedrooms), bathrooms: 1, floor_area_sqm: 30, max_occupants: 2, furnishing_status: 'unfurnished', access_instructions: null, amenity_ids: [], catalog: [], open_tenancy: false }; } });
  h.vm().editPortfolioListing(id); await settle2(h);
  h.vm().propertyRoutine.update('bedrooms', '2'); h.flush();
  h.vm().goToPostingStep(3); await settle2(h);
  assert.equal(saves, 1, 'the property was saved before leaving Step 1'); assert.equal(h.vm().postingStep, 3); assert.equal(h.vm().propertySummary.bedrooms, '2'); h.unmount();
});
test('a refused property save on a header tap keeps the owner on Step 1, keeps the edits and drops the pending destination', async () => {
  const { h, id } = await editorFixture('active', { routineRefuse: TENANCY_BINDING_MESSAGE });
  h.vm().editPortfolioListing(id); await settle2(h);
  h.vm().propertyRoutine.update('bedrooms', '4'); h.flush();
  h.vm().goToPostingStep(3); await settle2(h);
  assert.equal(h.vm().postingStep, 1); assert.equal(h.vm().propertyRoutineState.draft?.bedrooms, '4'); assert.equal(h.vm().returnTo ?? null, null, 'no stale "Save and return"');
  h.vm().goToPostingStep(1); await settle2(h); assert.equal(h.vm().postingStep, 1); h.unmount();
});
test('the step header does nothing outside the wizard', async () => {
  const h = mountProperty(null, {}, undefined, undefined, undefined, { initialScreen: 'dashboard' }); await h.settle(); h.vm().goToPostingStep(3); h.flush(); assert.equal(h.vm().screen, 'dashboard'); h.unmount();
});

// ---- Stage 3: the header's checks, its no-ops, and the cards that cannot be edited
const atStep = async (h: any, id: string, step: 1 | 2 | 3 | 4, kind: 'published' | 'draft' = 'published') => {
  if (kind === 'draft') h.vm().openPortfolioItem(id); else h.vm().editPortfolioListing(id);
  await settle2(h);
  for (let s = 1; s < step; s++) { h.vm().goToPostingStep((s + 1) as 1 | 2 | 3 | 4); await settle2(h); }
  assert.equal(h.vm().postingStep, step);
};
test('tapping the step you are already on does nothing, on every step', async () => {
  for (const step of [1, 2, 3, 4] as const) {
    const { h, id, saved } = await editorFixture('active'); await atStep(h, id, step);
    const before = [h.vm().screen, h.vm().workspaceListingId, saved.length];
    h.vm().goToPostingStep(step); await settle2(h);
    assert.equal(h.vm().postingStep, step, `step ${step} stays`); assert.deepEqual([h.vm().screen, h.vm().workspaceListingId, saved.length], before); h.unmount();
  }
});
test('the header runs the Listing step checks before leaving it forward, and shows the reason', async () => {
  const { h, id } = await editorFixture('active'); await atStep(h, id, 2);
  h.vm().updateDraft('title', ''); h.flush();
  h.vm().goToPostingStep(3); await settle2(h);
  assert.equal(h.vm().postingStep, 2, 'blocked'); assert.ok(h.vm().composerNotice, 'with the reason');
  h.vm().goToPostingStep(4); await settle2(h);
  assert.equal(h.vm().postingStep, 2, 'blocked on the way to Review too'); h.unmount();
});
test('the header runs the Price checks before leaving it forward', async () => {
  const { h, id } = await editorFixture('active'); await atStep(h, id, 3);
  h.vm().typeAskingRent(''); h.flush();
  h.vm().goToPostingStep(4); await settle2(h);
  assert.equal(h.vm().postingStep, 3, 'no Review without a usable rent'); assert.equal(h.vm().priceAttempted, true); h.unmount();
});
test('the header cannot skip the rent: from the Listing step straight to Review needs a usable rent', async () => {
  const { h, id } = await editorFixture('active'); await atStep(h, id, 2);
  h.vm().updateDraft('askingRent', ''); h.flush();
  h.vm().goToPostingStep(4); await settle2(h);
  assert.equal(h.vm().postingStep, 2); assert.equal(h.vm().priceAttempted, true); assert.ok(h.vm().composerNotice);
  h.vm().updateDraft('askingRent', '16500'); h.flush(); h.vm().goToPostingStep(4); await settle2(h);
  assert.equal(h.vm().postingStep, 4, 'with a rent it goes through'); h.unmount();
});
test('the Listing step itself no longer reports a missing rent in edit mode', async () => {
  const { h, id } = await editorFixture('paused'); await atStep(h, id, 2);
  h.vm().updateDraft('askingRent', ''); h.flush();
  assert.equal(h.vm().listingStepIssue, null, 'the rent is the Price step job'); h.unmount();
});
test('going back by the header drops a pending "save and return" destination', async () => {
  const { h, id } = await editorFixture('draft'); await atStep(h, id, 4, 'draft');
  h.vm().editPostingStep('price'); await settle2(h); assert.equal(h.vm().postingStep, 3); assert.equal(h.vm().returnTo, 'postingReview');
  h.vm().goToPostingStep(2); await settle2(h);
  assert.equal(h.vm().postingStep, 2); assert.equal(h.vm().returnTo ?? null, null, 'Continue would otherwise jump back to Review'); h.unmount();
});
test('a header tap is ignored while a property save is running, so nothing saves twice', async () => {
  let release!: () => void, saves = 0;
  const gate = new Promise<void>(r => { release = r; });
  const { h, id } = await editorFixture('active', { routineSave: async (d: any) => { saves++; await gate; return { owner_id: 'test-owner', property_id: id, edit_version: '60000000-0000-4000-8000-000000000002', property_type: 'apartment', city: 'imus', barangay: 'Fixture', floor_number: null, total_floors: 2, bedrooms: Number(d.bedrooms), bathrooms: 1, floor_area_sqm: 30, max_occupants: 2, furnishing_status: 'unfurnished', access_instructions: null, amenity_ids: [], catalog: [], open_tenancy: false }; } });
  h.vm().editPortfolioListing(id); await settle2(h);
  h.vm().propertyRoutine.update('bedrooms', '2'); h.flush();
  const first = h.vm().nextListingDetails(); await h.settle(); h.flush();
  h.vm().goToPostingStep(3); h.vm().goToPostingStep(4); h.flush();
  release(); await first; await settle2(h);
  assert.equal(saves, 1, 'one save'); h.unmount();
});
test('Edit property details does nothing for a card that cannot be edited', async () => {
  const mk = (over: any) => ({ propertyId: 'p-9', property: { id: 'p-9', is_active: true, property_type: 'apartment', city: 'imus', furnishing_status: 'unfurnished', floor_area_sqm: 30, ...over.property }, currentListing: over.listing, listings: [], tier3: { status: 'not_submitted' } });
  const c: any = { owner_id: 'test-owner', property_id: 'p-9', edit_version: '60000000-0000-4000-8000-000000000001', property_type: 'apartment', city: 'imus', barangay: 'Fixture', floor_number: null, total_floors: 2, bedrooms: 1, bathrooms: 1, floor_area_sqm: 30, max_occupants: 2, furnishing_status: 'unfurnished', access_instructions: null, amenity_ids: [], catalog: [], open_tenancy: false };
  for (const over of [{ property: { is_active: false }, listing: null }, { property: {}, listing: { id: 'l', status: 'removed', property_id: 'p-9' } }, { property: {}, listing: { id: 'l', status: 'rented', property_id: 'p-9' } }]) {
    const h = mountProperty(null, {}, { restore: async () => null }, undefined, undefined, { initialScreen: 'dashboard', portfolio: { user: async () => 'test-owner', assertUser: async () => {}, load: async () => [mk(over)] }, routine: { load: async () => c, hasPending: async () => false } });
    await h.settle(); h.vm().editPortfolioPropertyDetails('p-9'); await settle2(h);
    assert.equal(h.vm().screen, 'dashboard'); assert.equal(h.vm().workspacePropertyId, null); h.unmount();
  }
});

// ---- Stage 0: typing on the Listing step never waits on a background check
const findAll = (tree: any, pred: (n: any) => boolean): any[] => {
  const out: any[] = [], seen = new Set<any>();
  const walk = (v: any) => { if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v); if (Array.isArray(v)) { v.forEach(walk); return; } if (v.props) { if (pred(v)) out.push(v); walk(v.props.children); walk(v.props.footer); walk(v.props.guidance); walk(v.props.helper); } };
  walk(tree); return out;
};
const footerAction = (h: any) => findAll(h.detailsView(), n => !!n.props?.action)[0].props.action;
const titleField = (h: any) => findAll(h.detailsView(), n => n.props?.label === 'Listing title')[0];
const arriveAtListing = async (opts: any = {}) => {
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  const fixture = unifiedHarness('none', { routineGate: gate, ...opts }); const { h, fields, confirmMap } = fixture; await h.settle(); fields(); await confirmMap();
  let done = false; const p = h.vm().nextListingDetails().then(() => { done = true; });
  // On a device React renders and runs effects while the first save is still waiting on the property read.
  for (let i = 0; i < 6; i++) { await new Promise<void>(r => setImmediate(r)); h.flush(); }
  release();
  while (!done) { await new Promise<void>(r => setImmediate(r)); h.flush(); }
  await p; await h.settle(); await h.settle(); h.flush();
  return fixture;
};
test('arriving at Listing after the first save: the title is editable and the saved-listing check has run', async () => {
  const { h } = await arriveAtListing();
  assert.equal(h.vm().screen, 'listingDetails');
  assert.equal(h.vm().publicationState.loaded, true, 'the check ran for the new property');
  assert.equal(h.vm().listingDraftReadOnly, false);
  assert.equal(titleField(h).props.editable, true, 'the title takes input');
  assert.equal(h.vm().listingCheck.state, 'ok');
  assert.equal(h.vm().listingEditExplanation, null); h.unmount();
});
test('typing never waits on the check: a check that never finishes leaves every field editable, and only Continue waits, with a reason', async () => {
  const { h } = await arriveAtListing({ publication: { restore: () => new Promise(() => {}) } });
  assert.equal(h.vm().screen, 'listingDetails');
  assert.equal(h.vm().publicationState.loaded, false, 'the check is still running');
  assert.equal(titleField(h).props.editable, true);
  assert.equal(findAll(h.detailsView(), n => n.props?.label === 'Description')[0].props.editable, true);
  h.vm().updateDraft('title', 'Typed while checking'); h.flush();
  assert.equal(h.vm().draft.title, 'Typed while checking', 'the text is kept');
  assert.equal(h.vm().listingCheck.state, 'checking');
  assert.equal(h.vm().listingWriteBlockedReason, 'Checking this listing…');
  assert.equal(footerAction(h).label, 'Continue to Price'); assert.equal(footerAction(h).disabled, true, 'a write waits');
  h.vm().continuePostingEstimate(); h.flush(); assert.equal(h.vm().screen, 'listingDetails', 'and does nothing while it waits');
  h.vm().goBack(); h.flush(); assert.notEqual(h.vm().screen, 'listingDetails', 'Back always works'); h.unmount();
});
test('a failed check shows "Couldn\'t check this listing", keeps typing open, and Retry runs the check again', async () => {
  let attempts = 0, fail = true;
  const { h } = await arriveAtListing({ publication: { restore: async () => { attempts++; if (fail) throw new Error('offline'); return null; } } });
  assert.equal(h.vm().publicationState.loaded, false);
  assert.equal(h.vm().listingCheck.state, 'failed'); assert.equal(h.vm().listingCheck.message, "Couldn't check this listing");
  assert.equal(titleField(h).props.editable, true);
  const before = attempts; fail = false;
  await h.vm().retryListingCheck(); await h.settle(); h.flush();
  assert.equal(attempts, before + 1, 'Retry actually re-ran the check');
  assert.equal(h.vm().publicationState.loaded, true); assert.equal(h.vm().listingCheck.state, 'ok');
  assert.equal(footerAction(h).disabled, false); h.unmount();
});
test('Retry also works when the check is stuck running: it abandons the stuck call and starts a new one', async () => {
  let calls = 0;
  const { h } = await arriveAtListing({ publication: { restore: () => { calls++; return calls === 1 ? new Promise(() => {}) : Promise.resolve(null); } } });
  assert.equal(h.vm().listingCheck.state, 'checking'); assert.equal(h.vm().publicationState.busy, true);
  await h.vm().retryListingCheck(); await h.settle(); h.flush();
  assert.equal(calls >= 2, true); assert.equal(h.vm().publicationState.loaded, true); assert.equal(h.vm().listingCheck.state, 'ok'); h.unmount();
});
test('the existing guards still hold: a listing that is no longer a draft is not editable, and an inactive property is not editable', async () => {
  const f = savedHydrationHarness(); await f.init(); f.setRow({ ...f.getRow(), status: 'archived' });
  const h = f.mount({ load: async () => routineContext(f), hasPending: async () => false }); await h.settle();
  h.vm().openPortfolioItem(f.backend.propertyId); await settle2(h);
  assert.equal(h.vm().screen, 'published'); assert.equal(h.vm().listingDraftReadOnly, true, 'archived stays locked'); h.unmount();
});
test('writes still refuse while a publish is uncertain, even though typing is open', async () => {
  const { h } = await arriveAtListing({ publication: { restore: async () => ({ pending: true, row: { id: 'l', property_id: '10000000-0000-4000-8000-000000000001', status: 'draft' } }) } });
  assert.equal(h.vm().publicationState.uncertain, true);
  assert.equal(h.vm().listingDraftReadOnly, false, 'the fields are open');
  assert.ok(h.vm().listingWriteBlockedReason, 'a write waits, with a reason');
  h.vm().continuePostingEstimate(); h.flush(); assert.equal(h.vm().screen, 'listingDetails'); h.unmount();
});

// ---- Stage 0 follow-ups: the heal effect cannot loop, and typed text survives a check that finds a non-draft listing
test('a failed check is not retried on its own: renders and effects do not re-fire it, only Retry does', async () => {
  let attempts = 0;
  const { h } = await arriveAtListing({ publication: { restore: async () => { attempts++; for (let i = 0; i < 3; i++) await new Promise<void>(r => setImmediate(r)); throw new Error('offline'); } } });
  // the failure arrives a tick later, so a render happens while it is busy and another after it fails (where a loop would start)
  for (let i = 0; i < 6; i++) { await new Promise<void>(r => setImmediate(r)); h.flush(); }
  assert.equal(h.vm().listingCheck.state, 'failed');
  const afterArrival = attempts;
  for (let i = 0; i < 25; i++) { await new Promise<void>(r => setImmediate(r)); h.flush(); h.vm().updateDraft('title', `Typing ${i}`); }
  await h.settle(); h.flush();
  assert.equal(attempts, afterArrival, 'no automatic retry after the failure, however many renders happen');
  assert.equal(h.vm().listingCheck.state, 'failed');
  const retrying = h.vm().retryListingCheck();
  for (let i = 0; i < 6; i++) { await new Promise<void>(r => setImmediate(r)); h.flush(); }
  await retrying; await h.settle(); h.flush();
  assert.equal(attempts, afterArrival + 1, 'Retry runs it exactly once');
  assert.equal(h.vm().listingCheck.state, 'failed', 'and a second failure stays failed without looping');
  for (let i = 0; i < 10; i++) { await new Promise<void>(r => setImmediate(r)); h.flush(); }
  assert.equal(attempts, afterArrival + 1); h.unmount();
});
test('typing while the check runs, then the check finds the listing is not a draft: the text is kept, the page locks, and says why', async () => {
  let release!: (v: any) => void; const gate = new Promise<any>(r => { release = r; });
  const { h, backend } = await arriveAtListing({ publication: { restore: () => gate } });
  assert.equal(h.vm().listingCheck.state, 'checking');
  h.vm().updateDraft('title', 'Typed while checking'); h.flush();
  const saved = await backend.service.read();
  assert.equal(h.vm().draft.title, 'Typed while checking');
  release({ row: { ...saved, status: 'archived' }, operations: [] });
  await h.settle(); await h.settle(); h.flush();
  assert.equal(h.vm().publicationState.status, 'archived');
  assert.equal(h.vm().draft.title, 'Typed while checking', 'nothing discarded');
  assert.equal(h.vm().listingDraftReadOnly, true, 'the page locks');
  assert.equal(h.vm().listingEditExplanation, 'This listing is no longer a draft. Content editing is unavailable; use its listing management actions.');
  h.vm().updateDraft('title', 'More typing'); h.flush();
  assert.equal(h.vm().draft.title, 'Typed while checking', 'further typing is refused once locked'); h.unmount();
});

// ---- Stage 1: quiet on arrival, one footer line, and the consent decision
test('Step 1 is quiet on arrival: no error is visible, and one plain footer line names what is missing', async () => {
  const { h } = unifiedHarness(); await h.settle();
  assert.deepEqual(h.vm().propertyVisibleValidationIssues, [], 'no red anywhere');
  assert.equal(h.vm().propertyValidationIssue, null);
  assert.match(h.vm().propertyNextStatus, /^Add /, 'one line that names what is missing');
  assert.equal(h.vm().propertyNextDisabled, true);
  for (let i = 0; i < 5; i++) { h.flush(); await new Promise<void>(r => setImmediate(r)); }
  assert.deepEqual(h.vm().propertyVisibleValidationIssues, [], 'and it stays quiet while nobody touches anything'); h.unmount();
});
test('an error shows only after its field was left, and only for that field', async () => {
  const { h } = unifiedHarness(); await h.settle(); const flow = h.vm().propertyCreation;
  flow.updateField('barangay', 'x'); flow.updateField('barangay', ''); flow.updateField('addressLine1', ''); h.flush();
  assert.deepEqual(h.vm().propertyVisibleValidationIssues, [], 'typing and clearing is not leaving');
  h.vm().markPropertyFieldTouched('barangay'); h.flush();
  assert.deepEqual(h.vm().propertyVisibleValidationIssues.map((i: any) => i.field), ['barangay'], 'only the field that was left');
  flow.updateField('barangay', 'Anabu'); h.flush();
  assert.deepEqual(h.vm().propertyVisibleValidationIssues, [], 'and it clears when corrected'); h.unmount();
});
test('the footer line follows the form: missing fields, then the location, then ready', async () => {
  const { h, fields, pinMap } = unifiedHarness(); await h.settle();
  fields(); h.flush();
  assert.equal(h.vm().propertyNextStatus, 'Confirm the location to continue', 'with every field filled, only the location is left');
  await pinMap();
  assert.equal(h.vm().propertyNextStatus, 'Confirm the location to continue', 'a pin alone is not the confirmation');
  h.vm().setShareLocationWanted(false); h.flush();
  assert.match(h.vm().propertyNextStatus, /Next saves the property/); h.unmount();
});
test('a pin is not enough: one of the two consent buttons must confirm it before Continue works', async () => {
  const { h, fields, pinMap, events } = unifiedHarness(); await h.settle(); fields(); await pinMap();
  assert.equal(h.vm().locationDecided, false); assert.equal(h.vm().propertyNextDisabled, true);
  await h.vm().nextListingDetails(); await h.settle();
  assert.equal(h.vm().screen, 'listingComposer'); assert.equal(h.vm().workspacePropertyId, null); assert.deepEqual(events, [], 'the action itself refuses, not only the disabled button');
  h.vm().setShareLocationWanted(false); h.flush();
  assert.equal(h.vm().locationDecided, true); assert.equal(h.vm().locationShared, false); assert.equal(h.vm().shareLocationWanted, false); assert.equal(h.vm().propertyNextDisabled, false);
  h.vm().changeLocationChoice(); h.flush();
  assert.equal(h.vm().locationDecided, false, 'Change asks again'); assert.equal(h.vm().propertyNextDisabled, true);
  h.vm().setShareLocationWanted(true); h.flush();
  assert.equal(h.vm().locationDecided, true); assert.equal(h.vm().locationShared, true); assert.equal(h.vm().shareLocationWanted, true, 'the wish is exactly what it was'); h.unmount();
});
test("a moved pin or an edited address asks again; the type or floor does not undo Confirm, don't share but does undo a share", async () => {
  const noShare = unifiedHarness(); await noShare.h.settle(); noShare.fields(); await noShare.pinMap(); noShare.h.vm().setShareLocationWanted(false); noShare.h.flush();
  assert.equal(noShare.h.vm().locationDecided, true);
  noShare.h.vm().propertyCreation.updateField('propertyType', 'condominium'); noShare.h.vm().propertyCreation.updateField('floorNumber', '4'); noShare.h.flush();
  assert.equal(noShare.h.vm().locationDecided, true, "type and floor do not change a don't-share choice");
  noShare.h.vm().propertyCreation.updateField('barangay', 'Another'); noShare.h.flush();
  assert.equal(noShare.h.vm().locationDecided, false, 'an edited address clears the pin and the decision');
  assert.equal(noShare.h.vm().propertyNextDisabled, true);
  await noShare.pinMap();
  assert.equal(noShare.h.vm().locationDecided, false, 'a new pin is a new question'); noShare.h.unmount();
  const share = unifiedHarness(); await share.h.settle(); share.fields(); await share.pinMap(); share.h.vm().setShareLocationWanted(true); share.h.flush();
  assert.equal(share.h.vm().locationDecided, true);
  share.h.vm().propertyCreation.updateField('propertyType', 'condominium'); share.h.flush(); await share.h.settle(); share.h.flush();
  assert.equal(share.h.vm().shareLocationWanted, false, 'the share wish is cleared by the identity change, as before');
  assert.equal(share.h.vm().locationDecided, false, 'so a share decision no longer stands');
  assert.equal(share.h.vm().shareLocationNotice, 'Location changed. Confirm sharing again.'); share.h.unmount();
});
test('once the location is confirmed the property saves, and nothing is left over', async () => {
  const { h, fields, pinMap, events } = unifiedHarness(); await h.settle(); fields(); await pinMap(); h.vm().setShareLocationWanted(false); h.flush();
  await h.vm().nextListingDetails(); await h.settle(); h.flush();
  assert.deepEqual(events.slice(0, 1), ['property'], 'it saves once the location is confirmed');
  assert.ok(h.vm().workspacePropertyId); h.flush();
  assert.equal(h.vm().shareLocationWanted, false); h.unmount();
});

// ---- Stage 1 follow-up: the consent decision belongs to a NEW unsaved property only
test('a saved property never needs a fresh location decision: Continue works, and the map and address are closed to edits', async () => {
  const { h, fields, confirmMap } = unifiedHarness(); await h.settle(); fields(); await confirmMap();
  await h.vm().nextListingDetails(); await h.settle(); h.flush();
  assert.ok(h.vm().workspacePropertyId);
  while (h.vm().screen !== 'listingComposer') { h.vm().goBack(); h.flush(); await h.settle(); }
  assert.equal(h.vm().editorMode, 'draft'); assert.equal(h.vm().propertyRoutineState.status, 'ready');
  assert.equal(h.vm().locationDecided, false, 'there is no decision in this session, and none is needed');
  assert.equal(h.vm().propertyNextDisabled, false, 'Continue is enabled without asking again');
  h.vm().openPropertyLocation(); await h.settle(); h.flush();
  assert.equal(h.vm().locationState.stage, 'closed', 'the pin cannot be moved on a saved property');
  const addressBefore = JSON.stringify(h.vm().propertyState.draft);
  h.vm().propertyCreation.updateField('barangay', 'Edited after saving'); h.flush();
  assert.equal(JSON.stringify(h.vm().propertyState.draft), addressBefore, 'the address cannot be edited on a saved property');
  await h.vm().nextListingDetails(); await h.settle(); h.flush();
  assert.equal(h.vm().screen, 'listingDetails', 'Continue proceeds'); h.unmount();
});
test('the consent gate is written for a new property only', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /\|\|\(postingWizard&&!workspace\.propertyId&&!locationDecided\);/, 'the disabled state');
  const next = vm.match(/nextListingDetails: async \(\) => \{[\s\S]*?\n    \},/)![0];
  assert.ok(next.indexOf('if(postingWizard&&!locationDecided)return;') > next.indexOf('if(!workspaceRef.current.propertyId){'), 'inside the new-property branch');
  assert.ok(next.indexOf('if(postingWizard&&!locationDecided)return;') < next.indexOf('propertyCreation.submit(true)'), 'before anything is saved');
});
