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
function mountProperty(persistedProperty: string | null = null, draftService: any = {}) {
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
      const presentation = ['AppButton', 'FeedbackNotice', 'ListingButton', 'NavigationConfirmation', 'RentLeaseBottomNavigation', 'ScreenContainer', 'CreateListingView', 'ListingDetailView', 'ListingManagementView', 'ListingPreviewView', 'PropertyDashboardView'];
      const component = presentation.find(value => name.endsWith('/' + value));
      if (component) return { [component]: component };
      if (name.endsWith('/listingDraftDependencies')) return { listingDraftService: draftService };
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
    vm: () => current!, flush, writes: () => writes, destinations,
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
