import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { SHARE_BUTTON_LABEL, SHARE_SENTENCE, SHARE_SKIP_LINE, applyPendingLocationShare, pendingShareNotice, shareCardView, type ShareCardInput } from '../src/features/property-listing/models/LocationShare';
import { COMMON_AMENITY_NAMES, selectedCountLabel, visibleAmenities } from '../src/features/property-listing/models/AmenityChoices';
import { offeredSubtypeOptions, propertyModelAttributes, modelSubtypeOptions, subtypeLabel } from '../src/features/property-listing/models/PropertyModelAttributes';
import { postingValidationGroup } from '../src/features/property-listing/models/PostingPresentation';

// ---- The explicit button: every state the card can be in
const base: ShareCardInput = { saved: false, addressReady: true, confirmed: false, wanted: false, approval: null, approvalLoading: false, approvalError: false, busy: false };
const view = (over: Partial<ShareCardInput>) => shareCardView({ ...base, ...over });
test('the label, the sentence and the skip line are the specified words', () => {
  assert.equal(SHARE_BUTTON_LABEL, 'Confirm location and share it');
  assert.equal(SHARE_SENTENCE, 'Sharing this approximate point (never your exact address) makes the range more accurate. You can withdraw it anytime.');
  assert.equal(SHARE_SKIP_LINE, 'Skipping is fine. The range then uses the city only.');
  assert.ok(!/latitude|longitude|\d\.\d{4}/i.test(SHARE_SENTENCE + SHARE_SKIP_LINE));
});
test('new property, location not confirmed: the button opens the map and notes the wish; the skip path confirms without sharing', () => {
  const v = view({});
  assert.deepEqual(v.button, { action: 'openMapShare', disabled: false });
  assert.deepEqual(v.links, ['openMapOnly']);
  assert.equal(v.asking, true);
  assert.equal(v.mapPoint, null);
  assert.equal(view({ addressReady: false }).button!.disabled, true, 'no map without an address');
  assert.equal(view({ busy: true }).button!.disabled, true);
  const wanted = view({ wanted: true });
  assert.equal(wanted.button!.action, 'openMapShare');
  assert.deepEqual(wanted.links, ['clearWish']);
  assert.equal(wanted.asking, false);
  assert.match(wanted.status!, /Sharing is on/);
});
test('new property, location confirmed: the button notes the wish and the map point shows; once noted there is no second button', () => {
  const v = view({ confirmed: true });
  assert.deepEqual(v.button, { action: 'recordWish', disabled: false });
  assert.equal(v.mapPoint, 'draft');
  assert.deepEqual(v.links, ['reviewMap']);
  const wanted = view({ confirmed: true, wanted: true });
  assert.equal(wanted.button, null);
  assert.deepEqual(wanted.links, ['clearWish', 'reviewMap']);
  assert.match(wanted.status!, /recorded when you save the property/);
  assert.equal(wanted.mapPoint, 'draft');
});
test('saved property: the button records consent now; sharing can be withdrawn; every other state has no button', () => {
  const saved = { ...base, saved: true };
  const v = (over: Partial<ShareCardInput>) => shareCardView({ ...saved, ...over });
  assert.deepEqual(v({ approval: { approved: false, eligible: true } }).button, { action: 'saveConsent', disabled: false });
  assert.equal(v({ approval: { approved: false, eligible: true } }).mapPoint, 'approval');
  assert.equal(v({ approval: { approved: false, eligible: true }, busy: true }).button!.disabled, true);
  const approved = v({ approval: { approved: true, eligible: true } });
  assert.equal(approved.button, null);
  assert.deepEqual(approved.links, ['withdraw']);
  assert.match(approved.status!, /Shared with the model/);
  assert.equal(v({ approval: { approved: true, eligible: false } }).links[0], 'withdraw', 'a withdrawal is available even if the point is no longer eligible');
  const none = v({ approval: { approved: false, eligible: false } });
  assert.equal(none.button, null);
  assert.match(none.status!, /range uses the city only/);
  assert.equal(v({ approvalLoading: true }).button, null);
  assert.match(v({ approvalLoading: true }).status!, /Checking/);
  assert.deepEqual(v({ approvalError: true }).links, ['reload']);
  assert.equal(v({}).button, null, 'an unavailable feature asks nothing');
  assert.equal(v({ wanted: true, confirmed: true, approval: { approved: false, eligible: true } }).button!.action, 'saveConsent', 'a stale wish never changes the saved-property flow');
});
test('there is at most one explicit button in any state, and only the saved-property button writes straight away', () => {
  for (const saved of [false, true]) for (const confirmed of [false, true]) for (const wanted of [false, true]) for (const approved of [false, true]) for (const eligible of [false, true]) {
    const v = shareCardView({ ...base, saved, confirmed, wanted, approval: saved ? { approved, eligible } : null });
    if (v.button) assert.ok(['openMapShare', 'recordWish', 'saveConsent'].includes(v.button.action));
    if (v.button?.action === 'saveConsent') assert.equal(saved, true);
    if (!saved) assert.notEqual(v.button?.action, 'saveConsent');
  }
});

// ---- The calls: exactly what the button makes
const state = (over: any = {}) => ({ revision: '10000000-0000-4000-8000-000000000001', approved: false, eligible: true, policy: 'rental-public-location-v1', point: { latitude: 14.4, longitude: 120.9 }, ...over });
const fakeService = (loadResult: any, opts: { saveThrows?: boolean; loadThrows?: boolean } = {}) => {
  const calls: any[] = [];
  return { calls, service: {
    async load(actor: string, propertyId: string, signal: AbortSignal) { calls.push(['load', actor, propertyId, signal instanceof AbortSignal]); if (opts.loadThrows) throw new Error('x'); return loadResult; },
    async save(actor: string, propertyId: string, s: any, approve: boolean, signal: AbortSignal) { calls.push(['save', actor, propertyId, s.revision, s.policy, approve, signal instanceof AbortSignal]); if (opts.saveThrows) throw new Error('x'); return { ...s, approved: approve }; },
  } };
};
test('the pending share makes exactly two calls with the revision and policy the first call returned, approve = true', async () => {
  const f = fakeService(state());
  assert.equal(await applyPendingLocationShare(f.service, 'owner-1', 'prop-1', new AbortController().signal), 'shared');
  assert.deepEqual(f.calls, [['load', 'owner-1', 'prop-1', true], ['save', 'owner-1', 'prop-1', '10000000-0000-4000-8000-000000000001', 'rental-public-location-v1', true, true]]);
});
test('the pending share never records twice, never records an ineligible point, and never throws', async () => {
  const signal = new AbortController().signal;
  const already = fakeService(state({ approved: true }));
  assert.equal(await applyPendingLocationShare(already.service, 'o', 'p', signal), 'already');
  assert.deepEqual(already.calls.map(c => c[0]), ['load']);
  const ineligible = fakeService(state({ eligible: false }));
  assert.equal(await applyPendingLocationShare(ineligible.service, 'o', 'p', signal), 'unavailable');
  assert.deepEqual(ineligible.calls.map(c => c[0]), ['load']);
  const missing = fakeService(null);
  assert.equal(await applyPendingLocationShare(missing.service, 'o', 'p', signal), 'unavailable');
  assert.equal(await applyPendingLocationShare(fakeService(state(), { saveThrows: true }).service, 'o', 'p', signal), 'failed');
  assert.equal(await applyPendingLocationShare(fakeService(state(), { loadThrows: true }).service, 'o', 'p', signal), 'failed');
});
test('the outcome notice says what happened, and stays quiet when nothing changed', () => {
  assert.equal(pendingShareNotice('shared'), 'Property saved. Sharing recorded.');
  assert.equal(pendingShareNotice('already'), null);
  assert.match(pendingShareNotice('unavailable')!, /Property saved\. Sharing is not available yet/);
  assert.match(pendingShareNotice('failed')!, /Property saved\. Sharing could not be recorded/);
});
test('the consent service, its policy version and its hook are unchanged', () => {
  const service = readFileSync('src/shared/services/rentalLocationApprovalService.ts', 'utf8');
  assert.match(service, /rpc\('get_rental_location_approval',\{p_property_id:propertyId\}\)/);
  assert.match(service, /rpc\('set_rental_location_approval',\{p_property_id:propertyId,p_revision:state\.revision,p_policy:state\.policy,p_approve:approve\}\)/);
  assert.match(readFileSync('src/shared/models/RentalCoordinateProjection.ts', 'utf8'), /rentalLocationPolicy\s*=\s*'rental-public-location-v1'/);
  assert.match(readFileSync('src/shared/viewModels/useRentalLocationApproval.ts', 'utf8'), /service\.save\(actor,propertyId,state,approve,c\.signal\)/);
  assert.match(readFileSync('src/features/property-listing/services/locationShareDependencies.ts', 'utf8'), /createRentalLocationApprovalService\(getSupabaseClient\)/);
});
test('the pending share runs once, only after a new property is saved, from the wish bound before the save', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  const next = vm.match(/nextListingDetails: async \(\) => \{[\s\S]*?\n    \},/)![0];
  assert.match(next, /const shareWanted=wishApplies\(shareWish,/);
  assert.ok(next.indexOf('const shareWanted') < next.indexOf('propertyCreation.submit(true)'), 'the wish is read before the save, not after the workspace switch');
  assert.ok(next.indexOf('adoptCreatedProperty()') < next.indexOf('applyPendingLocationShare('), 'only after the property exists');
  assert.ok(next.indexOf('setShareWish(null)') > 0 && next.indexOf('setShareWish(null)') < next.indexOf('propertyCreation.submit(true)'), 'spent before the save, so it cannot repeat and a failed save leaves none');
  assert.match(next, /if\(shareWanted\)\{\s*const actor=/);
  assert.equal((vm.match(/applyPendingLocationShare\(/g) ?? []).length, 1);
  assert.match(next, /const actor=await currentActorId\(\)/);
  assert.match(next, /if\(active\.current\)setComposerNotice\(pendingShareNotice\(outcome\)\?\?'Property saved'\)/, 'the outcome is reported');
  assert.ok(vm.includes('shareLocationWanted:shareWish!==null,shareLocationNotice,'), 'the card can read the wish and its notice');
  assert.match(vm, /setShareLocationWanted:\(on:boolean\)=>\{setShareLocationNotice\(null\);setShareWish\(on\?wishAfterPress\(wishSnapshot\):null\);setLocationDecision\(/);
});
test('the long consent sheet is gone from the Price step; the estimate still refreshes when the approval changes', () => {
  assert.equal(existsSync('src/features/property-listing/components/PostingLocationApproval.tsx'), false);
  const price = readFileSync('src/features/property-listing/views/PostingPriceStep.tsx', 'utf8');
  assert.ok(!/PostingLocationApproval|What's shared|locationSection/.test(price));
  assert.match(price, /key=\{`\$\{approval\.state\?\.revision\}:\$\{approval\.state\?\.approved\}:\$\{approval\.ready\}`\}/);
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
  assert.deepEqual(walk('src/features/property-listing').filter(f => /What's shared with the estimator/.test(readFileSync(f, 'utf8'))), []);
});

// ---- Subtype chips are valid for the chosen type
test('an apartment is never offered "room"; each type offers only values that fit it', () => {
  assert.deepEqual(offeredSubtypeOptions('apartment'), ['apartment', 'studio', 'loft', 'penthouse']);
  assert.deepEqual(offeredSubtypeOptions('condominium'), ['condominium', 'studio', 'loft', 'penthouse', 'condotel']);
  assert.deepEqual(offeredSubtypeOptions('house'), ['house', 'townhouse', 'beach_house', 'villa']);
  for (const type of ['apartment', 'condominium', 'house']) assert.ok(!offeredSubtypeOptions(type).includes('room'), type);
  for (const type of [null, 'boarding_house', 'bedspace', 'room', 'studio', 'other']) assert.deepEqual(offeredSubtypeOptions(type), [], String(type));
  assert.ok(!offeredSubtypeOptions('apartment').includes('condominium') && !offeredSubtypeOptions('condominium').includes('apartment'));
  assert.ok(!offeredSubtypeOptions('apartment').includes('townhouse'));
  assert.equal(subtypeLabel('beach_house'), 'beach house');
});
test('saved data never becomes invalid: validation still accepts the older, broader list', () => {
  assert.ok(modelSubtypeOptions('apartment').includes('room'));
  assert.equal(propertyModelAttributes('apartment', { propertySubtype: 'room' }).p_property_subtype, 'room');
  assert.throws(() => propertyModelAttributes('apartment', { propertySubtype: 'villa' }));
  for (const type of ['apartment', 'condominium', 'house']) for (const value of offeredSubtypeOptions(type)) assert.ok(modelSubtypeOptions(type).includes(value), `${type}/${value} is accepted by validation`);
});
test('the postingValidationGroup sends each field to the card that holds it', () => {
  for (const f of ['floorAreaSqm', 'bedrooms', 'bathrooms', 'furnishingStatus', 'floorNumber', 'lotAreaSqm', 'parkingSpaces', 'propertySubtype', 'amenityIds']) assert.equal(postingValidationGroup({ field: f } as any), 'details', f);
  for (const f of ['maxOccupants', 'totalFloors', 'accessInstructions']) assert.equal(postingValidationGroup({ field: f } as any), 'more', f);
  assert.equal(postingValidationGroup({ field: 'propertyType' } as any), 'about');
  assert.equal(postingValidationGroup(null), null);
});

// ---- Amenities: common first, Show all, selected always visible
// The real catalog, in its real order (ids are positions).
const catalogNames = ['Wi-Fi', 'Air Conditioning', 'Parking', 'Kitchen', 'Laundry Area', 'Balcony', 'Swimming Pool', 'Gym', 'Elevator', 'CCTV', '24/7 Security', 'Gated Property', 'Water Heater', 'Backup Generator', 'Pet Friendly', 'Common Area'];
const catalog = catalogNames.map((name, i) => ({ id: i + 1, name }));
const idOf = (name: string) => catalog.find(a => a.name === name)!.id;
test('the six common amenities are matched by exact catalog name, in a fixed order, and the rest wait behind Show all', () => {
  assert.deepEqual([...COMMON_AMENITY_NAMES], ['Wi-Fi', 'Air Conditioning', 'Parking', 'Laundry Area', 'Balcony', '24/7 Security']);
  for (const name of COMMON_AMENITY_NAMES) assert.ok(catalogNames.includes(name), `${name} is in the real catalog`);
  const closed = visibleAmenities(catalog, [], false);
  assert.deepEqual(closed.visible.map(a => a.name), ['Wi-Fi', 'Air Conditioning', 'Parking', 'Laundry Area', 'Balcony', '24/7 Security']);
  assert.equal(closed.hidden, 10);
  assert.ok(!closed.visible.some(a => a.name === 'Kitchen' || a.name === 'Water Heater'), 'the earlier list is gone');
  const chosen = visibleAmenities(catalog, [idOf('Swimming Pool'), idOf('Gym')], false);
  assert.deepEqual(chosen.visible.map(a => a.name), ['Wi-Fi', 'Air Conditioning', 'Parking', 'Laundry Area', 'Balcony', '24/7 Security', 'Swimming Pool', 'Gym'], 'a chosen amenity is always visible, after the common ones');
  assert.equal(chosen.hidden, 8);
  const open = visibleAmenities(catalog, [], true);
  assert.equal(open.visible.length, 16);
  assert.equal(open.hidden, 0);
  assert.equal(visibleAmenities(catalog, [idOf('Wi-Fi')], false).visible.filter(a => a.name === 'Wi-Fi').length, 1, 'a chosen common amenity is not listed twice');
});
test('matching is exact: a differently written name is not guessed at, and nothing falls back to the first entries', () => {
  const near = visibleAmenities([{ id: 1, name: 'Wifi' }, { id: 2, name: 'Aircon' }, { id: 3, name: 'Security' }, { id: 4, name: 'parking' }, { id: 5, name: '24/7 security' }, { id: 6, name: 'Wi-Fi ' }], [], false);
  assert.deepEqual(near.visible, [], 'none of these is an exact catalog name');
  assert.equal(near.hidden, 6);
  const odd = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Thing ${i + 1}` }));
  assert.deepEqual(visibleAmenities(odd, [], false), { visible: [], hidden: 12 }, 'no first-six fallback');
  assert.deepEqual(visibleAmenities(odd, [9], false).visible.map(a => a.id), [9], 'a chosen one still shows');
  assert.deepEqual(visibleAmenities([], [], false), { visible: [], hidden: 0 });
  assert.deepEqual(visibleAmenities([], [3], true), { visible: [], hidden: 0 });
  assert.equal(visibleAmenities([{ id: 1, name: 'Wi-Fi' }], [], false).hidden, 0);
});
test('the counter reads "N selected"', () => {
  assert.equal(selectedCountLabel(0), '0 selected');
  assert.equal(selectedCountLabel(4), '4 selected');
});

// ---- Rendering harness: real models and tokens, named stubs for the rest
const realFiles: Record<string, string> = {
  Currency: 'src/shared/models/Currency.ts', colors: 'src/shared/theme/colors.ts', spacing: 'src/shared/theme/spacing.ts', radius: 'src/shared/theme/radius.ts',
  LocationShare: 'src/features/property-listing/models/LocationShare.ts', AmenityChoices: 'src/features/property-listing/models/AmenityChoices.ts',
  LocationConsent: 'src/features/property-listing/models/LocationConsent.ts', PropertyReadiness: 'src/features/property-listing/models/PropertyReadiness.ts',
  PropertyModelAttributes: 'src/features/property-listing/models/PropertyModelAttributes.ts', FieldLabel: 'src/features/property-listing/components/FieldLabel.tsx',
};
const cache: Record<string, any> = {};
let hookStub: any = null;
let reactStub: any = { useState: (init: unknown) => [init, () => {}], useRef: (init: unknown) => ({ current: init }), useEffect() {} };
function load(file: string, extra: Record<string, any> = {}): any {
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react') return reactStub;
    if (key === 'react-native') return { Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', StyleSheet: { create: (s: any) => s }, useWindowDimensions: () => ({ height: 800, width: 360 }) };
    const n = key.split('/').at(-1)!;
    if (n in extra) return extra[n];
    if (n === 'ui') return { ui: {} };
    if (n === 'typography') return { typography: { family: 'Roboto' } };
    if (n === 'useRentalLocationApproval') return { useRentalLocationApproval: () => hookStub };
    if (n === 'PublicLocationMap') return { PublicLocationMap: 'PublicLocationMap' };
    if (n === 'DraftProperty') return { propertyCityOptions: [{ value: 'imus', label: 'Imus' }], hasConfirmedPropertyLocation: (d: any) => [d.exactLatitude, d.exactLongitude, d.publicLatitude, d.publicLongitude].every(v => typeof v === 'number') };
    if (realFiles[n]) return cache[n] ??= load(realFiles[n]);
    return { [n]: n };
  };
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  return m.exports;
}
const expand = (v: any): any => (v && typeof v === 'object' ? (typeof v.type === 'function' ? expand(v.type(v.props)) : { ...v, props: { ...v.props, children: [v.props?.children].flat(Infinity).map(expand) } }) : v);
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const textOf = (tree: any) => nodes(tree).filter(n => n.type === 'Text').map(n => [n.props.children].flat(Infinity).join('')).join(' | ');
const LC = { ListingControls: { ChoiceChip: 'ChoiceChip', ListingField: 'ListingField' } };
const point = { latitude: 14.41234, longitude: 120.91234 };
const draft = (over: any = {}) => ({ city: 'imus', barangay: 'B', addressLine1: 'A', exactLatitude: null, exactLongitude: null, publicLatitude: null, publicLongitude: null, ...over });
const confirmedDraft = draft({ exactLatitude: 14.4123, exactLongitude: 120.9123, publicLatitude: point.latitude, publicLongitude: point.longitude });
const makeVm = (over: any = {}) => { const log: string[] = []; return { log, vm: { workspacePropertyId: null, estimationProperty: null, shareLocationWanted: false, locationDecided: false, locationShared: false, propertyState: { draft: draft(), loaded: true }, setShareLocationWanted: (v: boolean) => log.push(`wanted:${v}`), changeLocationChoice: () => log.push('change'), openPropertyLocation: () => log.push('map'), ...over } }; };
const model = (over: any = {}) => { const log: string[] = []; return { log, model: { state: null, busy: false, error: null, ready: true, save: (v: boolean) => { log.push(`save:${v}`); return Promise.resolve(); }, reload: () => log.push('reload'), ...over } }; };
const card = (vm: any, m: any, props: any = {}) => { hookStub = m; return expand(load('src/features/property-listing/components/LocationShareCard.tsx').LocationShareCard({ viewModel: vm, accountId: 'owner', editable: true, ...props })); };
// Text of a node including nested Text (textOf only joins each Text's own children).
const deepText = (v: any): string => (v == null || typeof v === 'boolean' ? '' : typeof v === 'object' ? [v.props?.children].flat(Infinity).map(deepText).join('') : String(v));
const brandButtons = (tree: any) => nodes(tree).filter(n => n.type === 'ListingButton');
const link = (tree: any, label: string) => nodes(tree).find(n => n.type === 'Pressable' && textOf(n) === label);

test('saved property: the button records consent through the existing hook; withdrawal and reload stay available', () => {
  const saved = { workspacePropertyId: 'prop-1', estimationProperty: { edit_version: 'v1' } };
  const eligible = model({ state: { approved: false, eligible: true, point } });
  const t = card(makeVm(saved).vm, eligible.model);
  assert.equal(brandButtons(t).length, 1);
  brandButtons(t)[0].props.onPress();
  assert.deepEqual(eligible.log, ['save:true']);
  assert.equal(nodes(t).find(n => n.type === 'PublicLocationMap').props.latitude, point.latitude);
  const approved = model({ state: { approved: true, eligible: true, point } }), t2 = card(makeVm(saved).vm, approved.model);
  assert.equal(brandButtons(t2).length, 0);
  link(t2, 'Stop sharing')!.props.onPress();
  assert.deepEqual(approved.log, ['save:false']);
  const broken = model({ error: 'x' }), t3 = card(makeVm(saved).vm, broken.model);
  link(t3, 'Reload sharing status')!.props.onPress();
  assert.deepEqual(broken.log, ['reload']);
  const ineligible = model({ state: { approved: false, eligible: false, point: null } });
  assert.equal(brandButtons(card(makeVm(saved).vm, ineligible.model)).length, 0);
  const busy = model({ state: { approved: false, eligible: true, point }, busy: true });
  const t4 = card(makeVm(saved).vm, busy.model);
  assert.equal(brandButtons(t4)[0].props.disabled, true);
  assert.equal(brandButtons(t4)[0].props.label, 'Updating...');
});
test('no state writes coordinates out, in text or in spoken labels', () => {
  const states: [any, any][] = [
    [{ workspacePropertyId: 'p', estimationProperty: { edit_version: 'v' } }, model({ state: { approved: true, eligible: true, point } }).model],
    [{ workspacePropertyId: 'p', estimationProperty: { edit_version: 'v' } }, model({ state: { approved: false, eligible: true, point } }).model],
  ];
  for (const [over, m] of states) {
    const t = card(makeVm(over).vm, m), spoken = JSON.stringify(nodes(t).map(n => [n.type === 'Text' ? n.props.children : null, n.props.accessibilityLabel]));
    assert.ok(!/14\.4|120\.9|latitude|longitude/i.test(spoken), spoken);
  }
});
test('every link is a 48dp target, and the long privacy paragraph is gone from every state', () => {
  const states: [any, any][] = [
    [{ workspacePropertyId: 'p', estimationProperty: { edit_version: 'v' } }, model({ state: { approved: true, eligible: true, point } }).model],
    [{ workspacePropertyId: 'p', estimationProperty: { edit_version: 'v' } }, model({ error: 'x' }).model],
  ];
  for (const [over, m] of states) {
    const t = card(makeVm(over).vm, m);
    for (const p of nodes(t).filter(n => n.type === 'Pressable')) { assert.ok(Object.assign({}, ...[p.props.style].flat()).minHeight >= 48); assert.equal(p.props.accessibilityRole, 'button'); }
    assert.ok(!/exact pin stays private/i.test(textOf(t)));
  }
});
// ---- Amenities card body, subtype chips and field tags
test('the amenity chips: Show all reveals the rest, a tap toggles through the parent, saving is unchanged', () => {
  const toggled: number[] = [];
  const render = (expanded: boolean) => { reactStub = { ...reactStub, useState: () => [expanded, () => {}] }; return expand(load('src/features/property-listing/components/AmenityChoices.tsx', LC).AmenityChoices({ catalog, selectedIds: [idOf('Swimming Pool')], onToggle: (id: number) => toggled.push(id), disabled: false })); };
  try {
    const closed = render(false), chips = nodes(closed).filter(n => n.type === 'ChoiceChip');
    assert.equal(chips.length, 7, 'six common plus the chosen one');
    chips[0].props.onPress();
    assert.deepEqual(toggled, [idOf('Wi-Fi')]);
    assert.equal(chips.find(c => c.props.label === 'Swimming Pool').props.selected, true);
    const showAll = nodes(closed).find(n => n.type === 'Pressable');
    assert.equal(textOf(showAll), 'Show all');
    assert.equal(showAll.props.accessibilityLabel, 'Show all amenities, 9 more');
    assert.ok(Object.assign({}, ...[showAll.props.style].flat()).minHeight >= 48);
    const open = render(true);
    assert.equal(nodes(open).filter(n => n.type === 'ChoiceChip').length, 16);
    assert.equal(textOf(nodes(open).find(n => n.type === 'Pressable')), 'Show fewer');
    reactStub = { ...reactStub, useState: () => [false, () => {}] };
    const none = expand(load('src/features/property-listing/components/AmenityChoices.tsx', LC).AmenityChoices({ catalog: [{ id: 1, name: 'Wi-Fi' }], selectedIds: [], onToggle() {}, disabled: true }));
    assert.ok(!nodes(none).some(n => n.type === 'Pressable'), 'no Show all chip when nothing is hidden');
    assert.equal(nodes(none).find(n => n.type === 'ChoiceChip').props.disabled, true);
  } finally { reactStub = { useState: (init: unknown) => [init, () => {}], useRef: (init: unknown) => ({ current: init }), useEffect() {} }; }
});
const attrs = (type: string | null, subtype = '') => expand(load('src/features/property-listing/components/PropertyModelAttributeFields.tsx', { ListingControls: { ChoiceChip: 'ChoiceChip', ListingField: 'ListingField', EstimateMarker: 'EstimateMarker' } }).PropertyModelAttributeFields({ type, draft: { propertySubtype: subtype, lotAreaSqm: '', parkingSpaces: '' }, disabled: false, onChange() {}, compact: true, marker: true }));
test('the subtype chips offer only values valid for the chosen type', () => {
  const labels = (t: any) => nodes(t).filter(n => n.type === 'ChoiceChip').map(n => n.props.label);
  assert.deepEqual(labels(attrs('apartment')), ['Not specified', 'apartment', 'studio', 'loft', 'penthouse']);
  assert.ok(!labels(attrs('apartment')).includes('room'));
  assert.deepEqual(labels(attrs('condominium')), ['Not specified', 'condominium', 'studio', 'loft', 'penthouse', 'condotel']);
  assert.deepEqual(labels(attrs('house')), ['Not specified', 'house', 'townhouse', 'beach house', 'villa']);
  assert.deepEqual(labels(attrs('bedspace')), []);
  assert.ok(labels(attrs('apartment', 'room')).includes('room'), 'a stored value that no longer fits stays visible so it can be changed');
  assert.equal(nodes(attrs('apartment', 'room')).find(n => n.type === 'ChoiceChip' && n.props.label === 'room').props.selected, true);
  assert.equal(nodes(attrs('apartment', 'studio')).find(n => n.type === 'ChoiceChip' && n.props.label === 'studio').props.selected, true);
  const fields = (type: string) => nodes(attrs(type)).filter(n => n.type === 'ListingField').map(n => n.props.label);
  assert.deepEqual(fields('apartment'), ['Parking spaces (optional)'], 'lot area never appears for an apartment');
  assert.deepEqual(fields('condominium'), ['Parking spaces (optional)']);
  assert.deepEqual(fields('house'), ['Lot area (sqm, optional)', 'Parking spaces (optional)']);
});
test('changing the property type drops a subtype that does not fit the new one, and keeps one that does', () => {
  const run = (from: string, subtype: string, to: string) => {
    const changes: any[][] = [];
    const vm: any = { propertyState: { draft: { propertyType: from, propertySubtype: subtype, furnishingStatus: 'unfurnished', city: 'imus', barangay: 'B', addressLine1: 'A', bedrooms: '', bathrooms: '' }, loaded: true }, propertySummary: {}, propertyCreation: { updateField: (...a: any[]) => changes.push(a) }, propertyValidationIssues: [], propertyFloorIssues: {}, completeness: {}, estimateDetails: { filled: 0, total: 8 }, shareLocationWanted: false, setShareLocationWanted() {}, openPropertyLocation() {} };
    const tree = expand(load('src/features/property-listing/components/ComposerPropertyFields.tsx', { ...LC, RangeCard: { rangeCardView: () => ({}) }, DraftProperty: { propertyTypeOptions: [{ value: 'apartment', label: 'Apartment' }, { value: 'house', label: 'House' }, { value: 'condominium', label: 'Condominium' }, { value: 'boarding_house', label: 'Boarding house' }], propertyCityOptions: [], furnishingOptions: [], hasConfirmedPropertyLocation: () => false } }).ComposerPropertyFields({ viewModel: vm, renderGroup: (group: string, children: any) => ({ type: 'Group', props: { group, children } }), afterLocation: null, children: null }));
    nodes(tree).find(n => n.type === 'PostingChoices' && n.props.label === 'Property type').props.onChange(to);
    return changes;
  };
  assert.deepEqual(run('condominium', 'condotel', 'apartment'), [['propertyType', 'apartment'], ['propertySubtype', '']]);
  assert.deepEqual(run('apartment', 'studio', 'condominium'), [['propertyType', 'condominium']]);
  assert.deepEqual(run('house', 'villa', 'apartment'), [['propertyType', 'apartment'], ['propertySubtype', '']]);
  assert.deepEqual(run('apartment', '', 'house'), [['propertyType', 'house']]);
});
// ---- Order and the collapsed More details
test('More details is collapsed ("Optional · doesn\'t change your range", Add / Hide) and opens only when a field inside it needs attention; every other card is always open', () => {
  const src = readFileSync('src/features/property-listing/views/ListingComposerView.tsx', 'utf8');
  assert.match(src, /more:\{title:'More details',summary:MORE_DETAILS_SUMMARY\}/, 'no open flag: collapsed by default');
  assert.match(src, /if\(key==='photos'\|\|key==='more'\)return <PostingSection key=\{key\}[^>]*initiallyOpen=\{item\.open\?\?false\} revealId=\{targetGroup===key\?target\?\.requestId:hasError\?-1:undefined\} toggleWords=\{key==='more'\?\['Add','Hide'\]:undefined\}>/);
  assert.match(src, /about:\{title:'Property type'/);
  assert.match(src, /location:\{title:'Where is it\?'/);
  assert.match(src, /details:\{title:'Details that set your range'/);
  assert.match(src, /tag=\{key==='location'\?LOCATION_TAG:undefined\} message=\{nonField\?'Needs attention':null\}/, 'a card never repeats a field error in red; the location card carries its tag');
  assert.match(src, /if\(key==='details'\)return <View key=\{key\}>\{body\}<\/View>;/, 'the range card is its own frame, not wrapped in a second card');
  assert.ok(!/message=\{fieldError\?\.message/.test(src) && !/summary=\{fieldError\?\.message/.test(src), 'no group-level copy of a field message');
  assert.match(src, /usePropertyFormFocus\(target,vm\.postingWizard&&!String\(target\?\.section\)\.startsWith\('detail:'\)&&\(targetGroup==='details'\|\|targetGroup==='more'\)\?targetGroup:undefined\)/);
  assert.match(src, /<ComposerPropertyFields accountId=\{accountId\}/);
  assert.match(src, /<SavedPropertyFields accountId=\{accountId\}/);
  assert.match(readFileSync('src/features/property-listing/views/PropertyListingFlowView.tsx', 'utf8'), /<ListingComposerView accountId=\{accountId\}/);
});
test('the saved-property editor uses the same order and keeps amenities on the existing routine update', () => {
  const src = readFileSync('src/features/property-listing/components/SavedPropertyFields.tsx', 'utf8');
  const order = ['group(\'about\'', 'group(\'location\'', 'group(\'details\'', '{photos}', 'group(\'more\''].map(s => src.indexOf(s));
  assert.ok(order.every(i => i > 0) && order.every((v, i) => i === 0 || v > order[i - 1]!), 'type, where, the range card, photos, more details');
  assert.ok(!src.includes('group(\'amenities\''), 'amenities live inside the range card');
  assert.match(src, /<LocationShareCard viewModel=\{vm\} accountId=\{accountId\} editable=\{!disabled\}\/>/);
  assert.match(src, /onToggle=\{id=>flow\.update\('amenityIds',/);
  assert.match(src, /label="Entrance instructions \(private\)"/);
});
test('amenities still save with the property: the new property toggles through the existing handler', () => {
  const src = readFileSync('src/features/property-listing/components/PropertyAmenitiesFields.tsx', 'utf8');
  assert.match(src, /<AmenityChoices comfortable=\{compact\}/);
  assert.match(src, /onToggle=\{vm\.togglePropertyAmenity\}/);
  assert.match(src, /selectedIds=\{vm\.selectedAmenityIds\}/);
});
