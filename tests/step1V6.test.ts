import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { SAVED_LOADING, SAVED_LOAD_FAILED, SHARED_NOTICE, WITHDRAWN_NOTICE, savedNotice, savedSwitchView, MAP_BOX_HEIGHT, MAP_PLACEHOLDER, MAP_SEARCHING, MAP_UNAVAILABLE, SWITCH_SUBTITLE, SWITCH_TITLE, SWITCH_WAITING, confirmedPlace, confirmedStatus, locationCardView, type LocationCardInput } from '../src/features/property-listing/models/LocationConsent';
import { FALLBACK_NOTE, PRECISE_PLACE_TYPES, candidatePrecise, pickPreviewCandidate } from '../src/features/property-listing/models/PinPrecision';
import { RANGE_ORDER, rangeCardView } from '../src/features/property-listing/models/RangeCard';
import { moreDetailsFields, unitFields } from '../src/features/property-listing/models/PropertyReadiness';
import { parseGeocodingCandidates } from '../src/shared/services/maps/geocoding/geocodingService';
import { routineDraft, type PropertyEditContext } from '../src/features/property-listing/models/PropertyRoutineEdit';

// ---- A small harness: real models and tokens, the named components under test, a stub for everything else.
const MODEL_DIRS = ['src/features/property-listing/models', 'src/shared/models', 'src/shared/theme'];
const COMPONENT_DIR = 'src/features/property-listing/components';
const cache: Record<string, any> = {};
let reactState: { on?: boolean } = {};
function load(file: string, realComponents: string[] = []): any {
  // './Name' is a component of the same folder; anything else is a model or a token (a model and a component can share a name).
  const real = (name: string, sibling: boolean): string | null => {
    if (sibling) { if (realComponents.includes(name)) for (const ext of ['.tsx', '.ts']) if (existsSync(join(COMPONENT_DIR, name + ext))) return join(COMPONENT_DIR, name + ext); return null; }
    for (const dir of MODEL_DIRS) if (existsSync(join(dir, name + '.ts'))) return join(dir, name + '.ts');
    return null;
  };
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react') return { useState: (init: unknown) => [reactState.on ?? init, () => {}], useRef: (init: unknown) => ({ current: init }), useEffect() {} };
    if (key === 'react-native') return { Text: 'Text', View: 'View', Pressable: 'Pressable', Switch: 'Switch', StyleSheet: { create: (s: any) => s, absoluteFill: { position: 'absolute' } }, useWindowDimensions: () => ({ width: 411, height: 800, fontScale: 1 }) };
    const name = key.split('/').at(-1)!;
    if (name === 'PublicLocationMap') return { PublicLocationMap: 'PublicLocationMap' };
    if (name === 'ListingControls') return { ChoiceChip: 'ChoiceChip', ListingField: 'ListingField' };
    if (name === 'useRentalLocationApproval') return { useRentalLocationApproval: () => ({}) };
    const path = real(name, key.startsWith('./') && file.split(String.fromCharCode(92)).join('/').includes('/components/'));
    if (path) return cache[path + realComponents.join()] ??= load(path, realComponents);
    return { [name]: name };
  };
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  return m.exports;
}
const expand = (v: any): any => (v && typeof v === 'object' ? (Array.isArray(v) ? v.map(expand) : typeof v.type === 'function' ? expand(v.type(v.props)) : { ...v, props: { ...v.props, children: [v.props?.children].flat(Infinity).map(expand) } }) : v);
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const deepText = (v: any): string => (v == null || typeof v === 'boolean' ? '' : typeof v === 'object' ? [v.props?.children].flat(Infinity).map(deepText).join('') : String(v));
const flatStyle = (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean));

// ---- Part 0: what a pin is derived from
test('the geocoder answer keeps its place type, and an answer without one stays without', () => {
  const parsed = parseGeocodingCandidates({ features: [
    { id: 'a', place_name: 'House', center: [120.9, 14.4], place_type: ['address'] },
    { id: 'b', place_name: 'Imus', center: [120.93, 14.43], place_type: ['municipality', 'place'] },
    { id: 'c', place_name: 'Odd', center: [120.9, 14.4] },
    { id: 'd', place_name: 'Bad types', center: [120.9, 14.4], place_type: [1, null, ''] },
  ] });
  assert.deepEqual(parsed.map(c => c.placeTypes), [['address'], ['municipality', 'place'], undefined, undefined]);
  assert.ok(!('placeTypes' in parsed[2]!), 'no key at all, so existing answers compare equal');
});
test('a pin derived from the address is precise; a place-level centre is a fallback; no type is not called a fallback', () => {
  assert.deepEqual([...PRECISE_PLACE_TYPES], ['address', 'street', 'poi']);
  for (const t of ['address', 'street', 'poi']) assert.equal(candidatePrecise({ placeTypes: [t] }), true, t);
  for (const t of ['municipality', 'neighbourhood', 'locality', 'place', 'county', 'region', 'country', 'postal_code']) assert.equal(candidatePrecise({ placeTypes: [t] }), false, t);
  assert.equal(candidatePrecise({ placeTypes: ['place', 'address'] }), true, 'any precise type counts');
  assert.equal(candidatePrecise({}), true); assert.equal(candidatePrecise({ placeTypes: [] }), true); assert.equal(candidatePrecise(null), false);
});
test('the best match: the first one derived from the address, else the first the geocoder gave', () => {
  const c = (id: string, placeTypes?: string[]) => ({ id, label: id, longitude: 120.9, latitude: 14.4, ...(placeTypes ? { placeTypes } : {}) });
  assert.equal(pickPreviewCandidate([c('centre', ['municipality']), c('house', ['address'])])!.id, 'house');
  assert.equal(pickPreviewCandidate([c('centre', ['municipality']), c('region', ['region'])])!.id, 'centre');
  assert.equal(pickPreviewCandidate([]), null);
  assert.equal(FALLBACK_NOTE, "We couldn't place this address precisely, so only the city is used");
});

// ---- The card's states
const base: LocationCardInput = { addressReady: false, decided: false, shared: false, pinInDraft: false, pinPrecise: false, preview: { status: 'idle', precise: null } };
const view = (over: Partial<LocationCardInput>) => locationCardView({ ...base, ...over });
test('the card in every state: placeholder, searching, map, unavailable, fallback, confirmed', () => {
  const a = view({}) as any;
  assert.deepEqual(a.box, { kind: 'placeholder' }); assert.equal(a.switchEnabled, false); assert.equal(a.confirmEnabled, false); assert.equal(a.switchNote, SWITCH_WAITING);
  const searching = view({ addressReady: true, preview: { status: 'searching', precise: null } }) as any;
  assert.deepEqual(searching.box, { kind: 'searching' }); assert.equal(searching.confirmEnabled, false); assert.equal(searching.switchEnabled, false);
  assert.deepEqual((view({ addressReady: true }) as any).box, { kind: 'searching' }, 'complete but not yet looked up: the box says it is looking');
  const ready = view({ addressReady: true, preview: { status: 'ready', precise: true } }) as any;
  assert.deepEqual(ready.box, { kind: 'map', source: 'preview' }); assert.equal(ready.switchEnabled, true); assert.equal(ready.confirmEnabled, true); assert.equal(ready.switchNote, SWITCH_SUBTITLE);
  const fallback = view({ addressReady: true, preview: { status: 'ready', precise: false } }) as any;
  assert.equal(fallback.switchEnabled, false, 'a fallback centre cannot be shared'); assert.equal(fallback.confirmEnabled, true, 'but the location can still be confirmed'); assert.equal(fallback.switchNote, FALLBACK_NOTE);
  for (const status of ['none', 'failed'] as const) { const u = view({ addressReady: true, preview: { status, precise: null } }) as any; assert.deepEqual(u.box, { kind: 'unavailable' }); assert.equal(u.confirmEnabled, false); assert.equal(u.switchEnabled, false); assert.equal(u.switchNote, FALLBACK_NOTE); }
  const draft = view({ addressReady: true, pinInDraft: true, pinPrecise: true }) as any; assert.deepEqual(draft.box, { kind: 'map', source: 'draft' }); assert.equal(draft.switchEnabled, true);
  assert.equal((view({ addressReady: true, pinInDraft: true, pinPrecise: false }) as any).switchEnabled, false, 'a draft pin of unknown or fallback origin is not shareable');
  assert.deepEqual(view({ decided: true, shared: true, addressReady: true, pinInDraft: true }), { mode: 'confirmed', shared: true });
  assert.deepEqual(view({ decided: true, shared: false }), { mode: 'confirmed', shared: false });
});
test('the confirmed row words', () => {
  assert.equal(confirmedPlace(' Anabu I-A ', 'Imus'), 'Anabu I-A, Imus');
  assert.equal(confirmedStatus(true), 'approximate area shared'); assert.equal(confirmedStatus(false), 'approximate area not shared');
  assert.equal(MAP_BOX_HEIGHT, 150);
});

// ---- The card, rendered
const draftOf = (over: any = {}) => ({ city: 'imus', barangay: 'Anabu I-A', addressLine1: '12 Mabini St', exactLatitude: null, exactLongitude: null, publicLatitude: null, publicLongitude: null, ...over });
const pinned = { exactLatitude: 14.4123, exactLongitude: 120.9123, publicLatitude: 14.41, publicLongitude: 120.91 };
function card(over: any = {}, on?: boolean) {
  const log: string[] = [];
  reactState = on === undefined ? {} : { on };
  const vm: any = { propertyState: { draft: draftOf(), loaded: true }, locationDecided: false, locationShared: false, locationPinPrecise: false, locationPreview: { status: 'idle', precise: null, candidate: null }, shareLocationNotice: null,
    confirmLocation: (share: boolean) => { log.push(`confirm:${share}`); return true; }, changeLocationChoice: () => log.push('change'), openPropertyLocation: () => log.push('map'), ...over };
  const mod = load('src/features/property-listing/components/LocationConfirmCard.tsx');
  const tree = expand(mod.LocationConfirmCard({ viewModel: vm, editable: true }));
  reactState = {};
  return { tree, log, buttons: nodes(tree).filter(n => n.type === 'ListingButton'), sw: nodes(tree).find(n => n.type === 'Switch'), box: nodes(tree).find(n => flatStyle(n.props?.style).height === MAP_BOX_HEIGHT && flatStyle(n.props?.style).overflow === 'hidden') };
}
const previewReady = (precise = true) => ({ propertyState: { draft: draftOf(), loaded: true }, locationPreview: { status: 'ready', precise, candidate: { id: 'x', label: 'x', latitude: 14.41, longitude: 120.91 } } });
const STATES: [string, any][] = [
  ['address incomplete', { propertyState: { draft: draftOf({ addressLine1: '' }), loaded: true } }],
  ['looking it up', { locationPreview: { status: 'searching', precise: null, candidate: null } }],
  ['match found (address)', previewReady(true)],
  ['match found (fallback)', previewReady(false)],
  ['nothing found', { locationPreview: { status: 'none', precise: null, candidate: null } }],
  ['lookup failed', { locationPreview: { status: 'failed', precise: null, candidate: null } }],
  ['pin from the map tool', { propertyState: { draft: draftOf(pinned), loaded: true }, locationPinPrecise: true }],
];
test('the map box has the same fixed height in every state, so nothing moves while the person types', () => {
  for (const [name, over] of STATES) {
    const c = card(over); assert.ok(c.box, name);
    assert.equal(flatStyle(c.box.props.style).height, MAP_BOX_HEIGHT, name);
    assert.equal(nodes(c.tree).filter(n => flatStyle(n.props?.style).height === MAP_BOX_HEIGHT).length, 1, `${name}: one box, no second sized element`);
    const heights = nodes(c.tree).map(n => flatStyle(n.props?.style).height).filter(h => typeof h === 'number');
    assert.deepEqual(heights, [MAP_BOX_HEIGHT], `${name}: nothing else on the card has a changing height`);
  }
  const src = readFileSync('src/features/property-listing/components/LocationConfirmCard.tsx', 'utf8');
  assert.match(src, /box:\{height:MAP_BOX_HEIGHT,/);
});
test('the box says why it is empty, and the switch row is there but dimmed and disabled until the address is complete', () => {
  const a = card(STATES[0]![1]);
  assert.ok(nodes(a.tree).some(n => n.type === 'Text' && deepText(n) === MAP_PLACEHOLDER)); assert.ok(!nodes(a.tree).some(n => n.type === 'PublicLocationMap'));
  assert.equal(a.sw.props.disabled, true); assert.equal(a.sw.props.value, false);
  assert.equal(flatStyle(nodes(a.tree).find(n => n.type === 'View' && n.props.style && [n.props.style].flat().some((s: any) => s?.opacity === 0.55))?.props.style).opacity, 0.55, 'dimmed');
  assert.ok(nodes(a.tree).some(n => n.type === 'Text' && deepText(n) === SWITCH_WAITING));
  assert.equal(a.buttons.length, 1); assert.equal(a.buttons[0].props.disabled, true, 'Confirm location is disabled');
  assert.ok(nodes(card(STATES[1]![1]).tree).some(n => n.type === 'Text' && deepText(n) === MAP_SEARCHING));
  const u = card(STATES[4]![1]); assert.ok(nodes(u.tree).some(n => n.type === 'Text' && deepText(n) === MAP_UNAVAILABLE));
  const place = nodes(u.tree).find(n => n.type === 'Pressable'); assert.ok(flatStyle(place.props.style).minHeight >= 48); place.props.onPress(); assert.deepEqual(u.log, ['map'], 'the map tool is still the way to place a pin');
});
test('one primary button and one switch: the two old buttons and their words are gone', () => {
  for (const [name, over] of STATES) {
    const c = card(over);
    assert.deepEqual(c.buttons.map(b => b.props.label), ['Confirm location'], name); assert.equal(c.buttons[0].props.tone, 'brand', name);
    assert.equal(nodes(c.tree).filter(n => n.type === 'Switch').length, 1, name);
    const t = nodes(c.tree).filter(n => n.type === 'Text').map(n => deepText(n)).join(' | ');
    assert.ok(!/Confirm and share approximate area|Confirm, don't share|Do not share|Review location on the map|exact pin stays private/.test(t), name);
    assert.equal(c.sw.props.accessibilityLabel, SWITCH_TITLE); assert.ok(t.includes(SWITCH_TITLE), name);
  }
  const src = readFileSync('src/features/property-listing/components/LocationConfirmCard.tsx', 'utf8');
  assert.ok(!/CONFIRM_SHARE_LABEL|CONFIRM_NO_SHARE_LABEL/.test(src));
});
test('the switch starts OFF, and an address-derived match makes it available', () => {
  const c = card(previewReady(true));
  assert.equal(c.sw.props.value, false, 'off by default'); assert.equal(c.sw.props.disabled, false);
  assert.ok(nodes(c.tree).some(n => n.type === 'Text' && deepText(n) === SWITCH_SUBTITLE));
  assert.ok(nodes(c.tree).some(n => n.type === 'PublicLocationMap'), 'the map fills the box'); assert.ok(nodes(c.tree).some(n => n.type === 'Text' && deepText(n) === 'approximate area only'));
});
test('Confirm location with the switch OFF confirms without sharing; with it ON it shares', () => {
  const off = card(previewReady(true)); off.buttons[0].props.onPress(); assert.deepEqual(off.log, ['confirm:false'], 'untouched, the switch is off');
  const on = card(previewReady(true), true); assert.equal(on.sw.props.value, true); on.buttons[0].props.onPress(); assert.deepEqual(on.log, ['confirm:true']);
});
test('a fallback pin: the switch is disabled with the note, stays off even if it was left on, and Confirm records "not shared"', () => {
  const c = card(previewReady(false), true);
  assert.equal(c.sw.props.disabled, true); assert.equal(c.sw.props.value, false, 'shown off');
  assert.ok(nodes(c.tree).some(n => n.type === 'Text' && deepText(n) === FALLBACK_NOTE));
  assert.equal(c.buttons[0].props.disabled, false); c.buttons[0].props.onPress(); assert.deepEqual(c.log, ['confirm:false'], 'the switch value passed on is off');
});
test('the map shows the approximate point only: never the exact pin, never a coordinate in words', () => {
  for (const [name, over] of STATES) {
    const c = card(over), maps = nodes(c.tree).filter(n => n.type === 'PublicLocationMap');
    const spoken = JSON.stringify(nodes(c.tree).map(n => [n.type === 'Text' ? deepText(n) : null, n.props?.accessibilityLabel]));
    assert.ok(!/14\.41|120\.91|latitude|longitude/i.test(spoken), name);
    for (const m of maps) assert.ok(![m.props.latitude, m.props.longitude].some(v => v === 14.4123 || v === 120.9123), `${name}: not the exact pin`);
  }
  const draft = card({ propertyState: { draft: draftOf(pinned), loaded: true }, locationPinPrecise: true }); const m = nodes(draft.tree).find(n => n.type === 'PublicLocationMap');
  assert.deepEqual([m.props.latitude, m.props.longitude], [14.41, 120.91], 'the public point of the draft');
});
test('confirmed: one row naming the place and whether the area is shared, with Change; the form and the map are gone', () => {
  for (const shared of [true, false]) {
    const c = card({ locationDecided: true, locationShared: shared, propertyState: { draft: draftOf(pinned), loaded: true } });
    const texts = nodes(c.tree).filter(n => n.type === 'Text').map(n => deepText(n));
    assert.deepEqual(texts, ['✓ Location confirmed', `Anabu I-A, Imus · approximate area ${shared ? 'shared' : 'not shared'}`, 'Change']);
    assert.equal(c.buttons.length, 0); assert.equal(c.sw, undefined); assert.ok(!nodes(c.tree).some(n => n.type === 'PublicLocationMap'));
    const change = nodes(c.tree).find(n => n.type === 'Pressable'); assert.ok(flatStyle(change.props.style).minHeight >= 48);
    change.props.onPress(); assert.deepEqual(c.log, ['change', 'map'], 'Change asks again and reopens the map tool, where the pin can be adjusted');
  }
});

// ---- The range card
const inputs = (over: any = {}) => ({ propertyType: 'apartment', city: 'imus', furnishingStatus: 'unfurnished', propertySubtype: '', floorAreaSqm: '', floorNumber: '', lotAreaSqm: '', parkingSpaces: '', bedrooms: '', bathrooms: '', amenityCount: 0, ...over });
test('the range card view: the count and the names come from the existing estimate model, in card order', () => {
  const v = rangeCardView(inputs({ bedrooms: '1', bathrooms: '1' }));
  assert.equal(v.total, 8); assert.equal(v.filled, 3); assert.equal(v.allFilled, false);
  assert.deepEqual(v.pips.map(p => p.key), [...RANGE_ORDER]); assert.deepEqual(v.pips.filter(p => p.filled).map(p => p.key), ['bedrooms', 'bathrooms', 'furnishing']);
  assert.deepEqual(v.missing.map(m => m.label), ['Floor area', 'Unit floor', 'Parking', 'Subtype', 'Amenities']);
  assert.deepEqual(v.missing.map(m => m.field), ['floorAreaSqm', 'floorNumber', 'parkingSpaces', 'propertySubtype', 'amenityIds']);
  assert.equal(v.unitGroupLabel, 'The unit');
});
test('a house says "The lot", wants lot area, and never a unit floor', () => {
  const v = rangeCardView(inputs({ propertyType: 'house' }));
  assert.equal(v.unitGroupLabel, 'The lot'); assert.ok(v.missing.some(m => m.label === 'Lot area' && m.field === 'lotAreaSqm')); assert.ok(!v.missing.some(m => m.label === 'Unit floor'));
  assert.deepEqual(unitFields('house'), ['lotAreaSqm', 'parkingSpaces', 'propertySubtype']);
  for (const type of ['apartment', 'condominium']) assert.deepEqual(unitFields(type), ['floorNumber', 'parkingSpaces', 'propertySubtype'], type);
  for (const type of ['apartment', 'condominium', 'bedspace', 'room', 'studio', 'boarding_house', null]) assert.ok(!unitFields(type).includes('lotAreaSqm'), `${type}: never lot area`);
  assert.ok(!unitFields('house').includes('floorNumber'), 'a house never sees Unit floor');
  assert.ok(!unitFields('bedspace').includes('propertySubtype'), 'no subtype where none is offered');
});
test('all eight filled: nothing missing and the card says so; a filled detail leaves the chips at once', () => {
  const full = rangeCardView(inputs({ floorAreaSqm: '40', bedrooms: '1', bathrooms: '1', floorNumber: '5', parkingSpaces: '1', propertySubtype: 'studio', amenityCount: 3 }));
  assert.equal(full.filled, 8); assert.equal(full.allFilled, true); assert.deepEqual(full.missing, []); assert.ok(full.pips.every(p => p.filled));
  const almost = rangeCardView(inputs({ floorAreaSqm: '40', bedrooms: '1', bathrooms: '1', floorNumber: '5', parkingSpaces: '1', propertySubtype: 'studio' }));
  assert.deepEqual(almost.missing.map(m => m.label), ['Amenities']);
});
test('a subtype chip is only offered where there is a subtype to choose', () => {
  const v = rangeCardView(inputs({ propertyType: 'bedspace' }));
  assert.ok(!v.missing.some(m => m.key === 'subtype')); assert.equal(v.total, 8, 'the count is the existing one');
});
function rangeCard(view: any, onFocus: (f: string, l: string) => void = () => {}) {
  const mod = load('src/features/property-listing/components/RangeDetailsCard.tsx');
  return expand(mod.RangeDetailsCard({ view, onFocus, size: { type: 'SizeFields', props: {} }, unit: { type: 'UnitFields', props: {} }, comfort: { type: 'ComfortFields', props: {} } }));
}
test('the range card: title, subtitle, "N of 8", eight pips, the missing chips, and three short groups', () => {
  const view = rangeCardView(inputs({ floorAreaSqm: '40', bedrooms: '1', bathrooms: '1' }));
  const tree = rangeCard(view), texts = nodes(tree).filter(n => n.type === 'Text').map(n => deepText(n));
  assert.ok(texts.includes('Details that set your range')); assert.ok(texts.includes('Every field here moves the typical-rent range'));
  assert.ok(texts.includes(`${view.filled} of 8`));
  const bar = nodes(tree).find(n => n.props?.accessibilityRole === 'progressbar'); assert.equal(bar.props.accessibilityLabel, `${view.filled} of 8 range details filled`);
  const pips = bar.props.children.flat(Infinity); assert.equal(pips.length, 8);
  assert.equal(pips.filter((p: any) => [p.props.style].flat().filter(Boolean).length === 2).length, view.filled, 'filled pips carry the filled style');
  assert.ok(texts.includes('Add:'));
  const groups = nodes(tree).filter(n => n.props?.accessibilityRole === 'header' && n.type === 'Text').map(n => deepText(n)).slice(1);
  assert.deepEqual(groups, ['Size', 'The unit', 'Comfort'], 'only three short labels');
  assert.ok(nodes(tree).some(n => n.type === 'SizeFields') && nodes(tree).some(n => n.type === 'UnitFields') && nodes(tree).some(n => n.type === 'ComfortFields'));
  const card = nodes(tree)[0]; const s = flatStyle(card.props.style);
  // A normal pale-green card with a regular green border: same radius and padding as the other cards, and no dominant left rail.
  assert.equal(s.backgroundColor, '#EDF8EE'); assert.equal(s.borderColor, '#32743C'); assert.equal(s.borderWidth, 1); assert.equal(s.borderRadius, 12); assert.equal(s.padding, 16);
  assert.ok(!nodes(tree).some((n: any) => flatStyle(n.props?.style).width === 6), 'no rail'); assert.ok(!Object.keys(s).some(k => /^border(Left|Start)/.test(k)), 'no thicker left edge'); assert.ok(!/rail/.test(readFileSync('src/features/property-listing/components/RangeDetailsCard.tsx', 'utf8')), 'no rail style in the component');
});
test('a missing-detail chip is a 48dp button that scrolls to and focuses its field; only missing details appear', () => {
  const calls: string[][] = [], view = rangeCardView(inputs({ floorAreaSqm: '40', bedrooms: '1', bathrooms: '1', floorNumber: '5', propertySubtype: 'studio' }));
  const tree = rangeCard(view, (f, l) => calls.push([f, l]));
  const chips = nodes(tree).filter(n => n.type === 'Pressable'); assert.deepEqual(chips.map(c => deepText(c)), ['+ Parking', '+ Amenities']);
  for (const c of chips) { assert.equal(c.props.accessibilityRole, 'button'); const st = flatStyle(c.props.style); assert.ok(st.minHeight >= 48); assert.equal(st.borderStyle, 'dashed'); }
  chips[0].props.onPress(); chips[1].props.onPress(); assert.deepEqual(calls, [['parkingSpaces', 'Parking'], ['amenityIds', 'Amenities']]);
  assert.deepEqual(chips.map(c => c.props.accessibilityLabel), ['Add parking', 'Add amenities']);
});
test('at 8 of 8 the chips are replaced by one line; the structure does not change', () => {
  const full = rangeCardView(inputs({ floorAreaSqm: '40', bedrooms: '1', bathrooms: '1', floorNumber: '5', parkingSpaces: '1', propertySubtype: 'studio', amenityCount: 3 }));
  const tree = rangeCard(full), texts = nodes(tree).filter(n => n.type === 'Text').map(n => deepText(n));
  assert.ok(texts.includes('✓ All 8 filled. Your range is as sharp as it gets.')); assert.ok(!texts.includes('Add:')); assert.equal(nodes(tree).filter(n => n.type === 'Pressable').length, 0);
  assert.ok(texts.includes('8 of 8')); assert.deepEqual(texts.filter(t => ['Size', 'The unit', 'Comfort'].includes(t)), ['Size', 'The unit', 'Comfort'], 'same groups, same order');
  const house = rangeCard(rangeCardView(inputs({ propertyType: 'house' }))); assert.ok(nodes(house).some(n => n.type === 'Text' && deepText(n) === 'The lot'));
});

// ---- The unit and more-details fields
const fullDraft = (over: any = {}) => ({ propertyType: 'apartment', propertySubtype: '', lotAreaSqm: '', parkingSpaces: '', floorNumber: '', totalFloors: '', maxOccupants: '', accessInstructions: '', ...over });
const RC = ['FieldLabel'];
function fields(file: string, name: string, over: any = {}, extra: any = {}) {
  const changes: any[] = [], blurs: string[] = [];
  const tree = expand(load(file, RC)[name]({ draft: fullDraft(over), disabled: false, error: () => null, onChange: (...a: any[]) => changes.push(a), onBlur: (f: string) => blurs.push(f), ...extra }));
  return { tree, changes, blurs, list: nodes(tree).filter(n => n.type === 'ListingField'), chips: nodes(tree).filter(n => n.type === 'ChoiceChip').map(c => c.props.label) };
}
const unit = (over?: any, extra?: any) => fields('src/features/property-listing/components/UnitDetailFields.tsx', 'UnitDetailFields', over, extra);
const more = (over?: any, extra?: any) => fields('src/features/property-listing/components/MoreDetailsFields.tsx', 'MoreDetailsFields', over, extra);
test('the unit group: an apartment or condominium has unit floor, parking and subtype chips, and never lot area', () => {
  const a = unit({ propertyType: 'apartment' });
  assert.deepEqual(a.list.map(f => f.props.label), ['Unit floor', 'Parking spaces']); assert.deepEqual(a.chips, ['Not specified', 'apartment', 'studio', 'loft', 'penthouse']);
  assert.deepEqual(unit({ propertyType: 'condominium' }).chips, ['Not specified', 'condominium', 'studio', 'loft', 'penthouse', 'condotel']);
  for (const t of ['apartment', 'condominium']) assert.ok(!unit({ propertyType: t }).list.some(f => /lot/i.test(f.props.label)), t);
});
test('the lot group: a house has lot area, parking and subtype chips, and never a unit floor; "room" is never a chip', () => {
  const h = unit({ propertyType: 'house' });
  assert.deepEqual(h.list.map(f => f.props.label), ['Lot area (sqm)', 'Parking spaces']); assert.deepEqual(h.chips, ['Not specified', 'house', 'townhouse', 'beach house', 'villa']);
  assert.ok(!h.list.some(f => /unit floor/i.test(f.props.label)));
  for (const t of ['apartment', 'condominium', 'house']) assert.ok(!unit({ propertyType: t }).chips.includes('room'), t);
  const stale = unit({ propertyType: 'apartment', propertySubtype: 'room' }); assert.ok(stale.chips.includes('room'), 'a stored value that no longer fits stays so it can be cleared');
});
test('the unit group: no chips where the type offers no subtype; typing, leaving and choosing report the field; no dots anywhere', () => {
  assert.deepEqual(unit({ propertyType: 'bedspace' }).chips, []);
  const u = unit({ propertyType: 'apartment' }); const parking = u.list.find(f => f.props.label === 'Parking spaces');
  parking.props.onChangeText('2'); parking.props.onBlur(); assert.deepEqual(u.changes, [['parkingSpaces', '2']]); assert.deepEqual(u.blurs, ['parkingSpaces']);
  nodes(u.tree).find(n => n.type === 'ChoiceChip' && n.props.label === 'loft').props.onPress(); assert.deepEqual(u.changes.at(-1), ['propertySubtype', 'loft']);
  assert.ok(u.list.every(f => f.props.usedInEstimate === undefined), 'no dot prop');
  const err = unit({ propertyType: 'apartment' }, { error: (f: string) => (f === 'parkingSpaces' ? 'Enter a whole number.' : null) }); assert.equal(err.list.find(f => f.props.label === 'Parking spaces').props.error, 'Enter a whole number.');
  assert.ok(unit({ propertyType: 'apartment' }, { disabled: true }).list.every(f => f.props.editable === false));
});
test('the unit group gives each field its own scroll target, so a chip lands on the field itself', () => {
  const seen: string[] = []; const focus = { field: () => () => {}, section: (k: string) => { seen.push(k); return () => {}; } };
  unit({ propertyType: 'apartment' }, { focus }); assert.deepEqual(seen, ['detail:floorNumber', 'detail:parkingSpaces', 'detail:propertySubtype']);
  seen.length = 0; unit({ propertyType: 'house' }, { focus }); assert.deepEqual(seen, ['detail:lotAreaSqm', 'detail:parkingSpaces', 'detail:propertySubtype']);
});
test('More details holds only what does not change the range, with its one helper line', () => {
  const a = more({ propertyType: 'apartment' }), texts = nodes(a.tree).filter(n => n.type === 'Text').map(n => deepText(n));
  assert.deepEqual(a.list.map(f => f.props.label), ['Floors in building', 'Max occupants', 'Entrance instructions (private)']);
  assert.ok(texts.includes('Nothing here changes your range.')); assert.deepEqual(moreDetailsFields('apartment'), ['totalFloors', 'maxOccupants']);
  assert.deepEqual(more({ propertyType: 'house' }).list.map(f => f.props.label), ['Stories', 'Max occupants', 'Entrance instructions (private)']);
  for (const t of ['apartment', 'house']) { const labels = more({ propertyType: t }).list.map(f => f.props.label).join(); assert.ok(!/lot|unit floor|parking|subtype/i.test(labels), t); }
  assert.equal(more({}).chips.length, 0, 'no subtype chips here');
  const m = more({ propertyType: 'apartment' }); m.list[0].props.onChangeText('5'); m.list[0].props.onBlur(); assert.deepEqual(m.changes, [['totalFloors', '5']]); assert.deepEqual(m.blurs, ['totalFloors']);
});

// ---- The page, composed
const RANGE_PARTS = ['RangeDetailsCard', 'UnitDetailFields', 'MoreDetailsFields', 'FieldLabel'];
function composer(over: any = {}, children: any = { type: 'AmenitiesStub', props: {} }) {
  reactState = {};
  const vm: any = { propertyState: { draft: { ...fullDraft(), propertyType: 'apartment', furnishingStatus: 'unfurnished', city: 'imus', barangay: 'B', addressLine1: 'A', bedrooms: '1', bathrooms: '1', floorAreaSqm: '' }, loaded: true }, propertySummary: {}, propertyCreation: { updateField() {} }, propertyValidationIssues: [], propertyFloorIssues: {}, completeness: {},
    floorAreaRequired: true, estimateInputs: inputs({ bedrooms: '1', bathrooms: '1' }), locationDecided: false, focusRangeDetail() {}, markPropertyFieldTouched() {}, ...over };
  const mod = load('src/features/property-listing/components/ComposerPropertyFields.tsx', RANGE_PARTS);
  const tree = expand(mod.ComposerPropertyFields({ viewModel: vm, renderGroup: (group: string, body: any) => ({ type: 'Group', props: { group, children: body } }), children }));
  return { tree, groups: nodes(tree).filter(n => n.type === 'Group') };
}
test('page order for a new property: Property type, Where is it?, the range card, More details (photos are on the Listing step)', () => {
  const { groups } = composer(); assert.deepEqual(groups.map(g => g.props.group), ['about', 'location', 'details', 'more']);
});
test('the range card holds all eight details: floor area, bedrooms, bathrooms, unit floor, parking, subtype, furnishing, amenities', () => {
  const { groups } = composer(), details = groups.find(g => g.props.group === 'details')!;
  const labels = nodes(details).filter(n => n.type === 'ListingField').map(n => n.props.label);
  assert.deepEqual(labels, ['Floor area (sqm)', 'Bedrooms', 'Bathrooms', 'Unit floor', 'Parking spaces']);
  assert.ok(nodes(details).some(n => n.type === 'ChoiceChip' && n.props.label === 'studio'), 'subtype chips'); assert.ok(nodes(details).some(n => n.type === 'PostingChoices' && n.props.label === 'Furnishing'));
  assert.ok(nodes(details).some(n => n.type === 'AmenitiesStub'), 'amenities'); assert.ok(!groups.some(g => g.props.group === 'amenities'), 'no card of their own');
  const more = groups.find(g => g.props.group === 'more')!; assert.ok(nodes(more).some(n => n.type === 'ListingField' && n.props.label === 'Floors in building')); assert.ok(!nodes(more).some(n => n.type === 'AmenitiesStub'));
  const count = nodes(details).find(n => n.type === 'Text' && /^\d of 8$/.test(deepText(n))); assert.ok(count);
  assert.ok(!nodes(details).some(n => /feeds your range|Used in the range|of 8 filled/.test(deepText(n))), 'no legend, no tag, no old bar');
});
test('floor area is the only required star in the range card when the estimator can handle the property', () => {
  const required = (over: any) => nodes(composer(over).groups.find(g => g.props.group === 'details')!).filter(n => n.type === 'ListingField' && n.props.required).map(n => n.props.label);
  assert.deepEqual(required({ floorAreaRequired: true }), ['Floor area (sqm)', 'Bedrooms', 'Bathrooms'], 'bedrooms and bathrooms are still required to save, so they keep their stars');
  assert.deepEqual(required({ floorAreaRequired: false }), ['Bedrooms', 'Bathrooms']);
  const optional = nodes(composer({ floorAreaRequired: false }).groups.find(g => g.props.group === 'details')!).find(n => n.type === 'ListingField' && n.props.label === 'Floor area (sqm)');
  assert.ok(optional.props.helper, 'it says why floor area is optional');
});
test('a house gets the lot group in the same card', () => {
  const draft = { ...fullDraft({ propertyType: 'house' }), furnishingStatus: 'unfurnished', city: 'imus', barangay: 'B', addressLine1: 'A', bedrooms: '1', bathrooms: '1', floorAreaSqm: '' };
  const { groups } = composer({ propertyState: { draft, loaded: true }, estimateInputs: inputs({ propertyType: 'house' }) }), details = groups.find(g => g.props.group === 'details')!;
  assert.deepEqual(nodes(details).filter(n => n.type === 'ListingField').map(n => n.props.label), ['Floor area (sqm)', 'Bedrooms', 'Bathrooms', 'Lot area (sqm)', 'Parking spaces']);
  assert.ok(nodes(details).some(n => n.type === 'Text' && deepText(n) === 'The lot'));
});
test('every range detail has its own scroll target for the chips, and the card keeps the "details" anchor', () => {
  const seen: string[] = []; const focus = { field: () => () => {}, section: (k: string) => { seen.push(k); return () => {}; } };
  const vm: any = { propertyState: { draft: { ...fullDraft(), furnishingStatus: 'unfurnished', city: 'imus', barangay: 'B', addressLine1: 'A', bedrooms: '', bathrooms: '', floorAreaSqm: '' }, loaded: true }, propertySummary: {}, propertyCreation: { updateField() {} }, propertyValidationIssues: [], propertyFloorIssues: {}, completeness: {}, floorAreaRequired: true, estimateInputs: inputs(), locationDecided: false, focusRangeDetail() {}, markPropertyFieldTouched() {} };
  const mod = load('src/features/property-listing/components/ComposerPropertyFields.tsx', RANGE_PARTS);
  expand(mod.ComposerPropertyFields({ viewModel: vm, focus, renderGroup: (g: string, b: any) => ({ type: 'Group', props: { group: g, children: b } }), afterLocation: null, children: null }));
  for (const key of ['details', 'detail:floorAreaSqm', 'detail:bedrooms', 'detail:bathrooms', 'detail:floorNumber', 'detail:parkingSpaces', 'detail:propertySubtype', 'detail:furnishingStatus', 'detail:amenityIds', 'more']) assert.ok(seen.includes(key), key);
});
test('once the location is confirmed the address form folds away; Change brings it back', () => {
  const open = composer(), folded = composer({ locationDecided: true });
  const where = (c: any) => nodes(c.groups.find((g: any) => g.props.group === 'location')!);
  assert.ok(where(open).some(n => n.type === 'ListingField' && n.props.label === 'Barangay')); assert.ok(where(open).some(n => n.type === 'PostingChoices' && n.props.label === 'City'));
  assert.ok(!where(folded).some(n => n.type === 'ListingField') && !where(folded).some(n => n.type === 'PostingChoices'), 'no address fields once confirmed'); assert.ok(!where(folded).some(n => n.type === 'PostingSection'));
  assert.ok(where(folded).some(n => n.type === 'LocationShareCard'), 'the confirmed row is still there');
  assert.ok(where(open).some(n => n.type === 'LocationShareCard'));
});
test('the address fields report when they are left, and the legacy composer path has no range card', () => {
  const fieldsIn = nodes(composer().groups.find(g => g.props.group === 'location')!).filter(n => n.type === 'ListingField' && ['Barangay', 'Street address'].includes(n.props.label));
  assert.equal(fieldsIn.length, 2); for (const f of fieldsIn) assert.equal(typeof f.props.onBlur, 'function', f.props.label);
  const plain = expand(load('src/features/property-listing/components/ComposerPropertyFields.tsx', RANGE_PARTS).ComposerPropertyFields({ viewModel: { ...composer().tree && { propertyState: { draft: { ...fullDraft(), furnishingStatus: 'unfurnished' }, loaded: true }, propertySummary: {}, propertyCreation: {}, propertyValidationIssues: [], propertyFloorIssues: {}, completeness: {} } } as any, children: null }));
  assert.ok(!nodes(plain).some(n => n.type === 'RangeDetailsCard' || n.props?.accessibilityRole === 'header' && deepText(n) === 'Details that set your range'));
});

// ---- The saved-property editor uses the same cards
const ID = '10000000-0000-4000-8000-000000000001';
const savedContext = (over: Partial<PropertyEditContext> = {}): PropertyEditContext => ({ owner_id: '30000000-0000-4000-8000-000000000001', property_id: ID, edit_version: '20000000-0000-4000-8000-000000000001', property_type: 'apartment', city: 'imus', barangay: 'Barangay', floor_number: 5, bedrooms: 1, bathrooms: 1, floor_area_sqm: 40, max_occupants: null, total_floors: null, furnishing_status: 'unfurnished', access_instructions: null, amenity_ids: [], catalog: [], open_tenancy: false, model_attributes_version: 2, ...over } as PropertyEditContext);
function saved(over: any = {}, contextOver: Partial<PropertyEditContext> = {}) {
  reactState = {};
  const groups: string[] = [], update: string[][] = [];
  const context = savedContext(contextOver), draft = routineDraft(context);
  const vm: any = { propertyRoutineState: { status: 'ready', context, draft, busy: false, uncertain: false, conflict: false, notice: null, error: null, attempted: false }, propertyRoutine: { update: (...a: any[]) => update.push(a.map(String)), reload() {}, reconcile() {} }, propertySummary: { type: 'Apartment', location: 'Imus' }, floorAreaRequired: true, estimateInputs: inputs({ floorAreaSqm: '40', bedrooms: '1', bathrooms: '1', floorNumber: '5' }), focusRangeDetail() {}, reloadPropertyDetails() {}, openIdentityCorrection() {}, ...over };
  const focus = { field: () => () => {}, section: () => () => {} };
  const mod = load('src/features/property-listing/components/SavedPropertyFields.tsx', ['RangeDetailsCard', 'FieldLabel']);
  const tree = expand(mod.SavedPropertyFields({ viewModel: vm, focus, accountId: 'a', group: (key: string, body: any) => { groups.push(key); return { type: 'Group', props: { group: key, children: body } }; } }));
  const top = (tree.props.children as any[]).flat(Infinity).filter((n: any) => n && typeof n === 'object').map((n: any) => n.type === 'Group' ? n.props.group : n.type);
  return { tree, groups, top, update, vm };
}
test('saved-property editor parity: the same cards in the same order, with the range card and no card of its own for amenities', () => {
  const { top, tree } = saved(); const ordered = top.filter((k: string) => ['about', 'location', 'details', 'PhotosMarker', 'more'].includes(k));
  assert.deepEqual(ordered, ['about', 'location', 'details', 'more']); assert.ok(!top.includes('amenities'));
  const details = nodes(tree).find(n => n.type === 'Group' && n.props.group === 'details')!;
  assert.ok(nodes(details).some(n => n.type === 'Text' && deepText(n) === 'Details that set your range')); assert.ok(nodes(details).some(n => n.type === 'Text' && deepText(n) === '4 of 8' || /^\d of 8$/.test(deepText(n))));
  const labels = nodes(details).filter(n => n.type === 'ListingField').map(n => n.props.label); assert.deepEqual(labels.slice(0, 3), ['Floor area (sqm)', 'Bedrooms', 'Bathrooms']);
  assert.ok(nodes(details).some(n => n.type === 'Text' && deepText(n) === 'Unit floor: 5'), 'the saved unit floor is shown, not edited'); assert.ok(nodes(details).some(n => n.type === 'AmenityChoices'), 'amenities keep the existing routine update');
  assert.ok(nodes(details).some(n => n.type === 'PostingChoices' && n.props.label === 'Furnishing'));
  const more = nodes(tree).find(n => n.type === 'Group' && n.props.group === 'more')!;
  assert.deepEqual(nodes(more).filter(n => n.type === 'ListingField').map(n => n.props.label), ['Floors in building', 'Max occupants', 'Entrance instructions (private)']); assert.ok(nodes(more).some(n => n.type === 'Text' && deepText(n) === 'Nothing here changes your range.'));
});
test('saved-property editor: a house shows "The lot" and Stories, and the floor area star follows floorAreaRequired', () => {
  const house = saved({ estimateInputs: inputs({ propertyType: 'house' }) }, { property_type: 'house', floor_number: null, floor_area_sqm: null, bedrooms: null as any });
  const details = nodes(house.tree).find(n => n.type === 'Group' && n.props.group === 'details')!;
  assert.ok(nodes(details).some(n => n.type === 'Text' && deepText(n) === 'The lot')); assert.ok(!nodes(details).some(n => n.type === 'Text' && /^Unit floor/.test(deepText(n))), 'a house never sees Unit floor');
  const more = nodes(house.tree).find(n => n.type === 'Group' && n.props.group === 'more')!; assert.ok(nodes(more).some(n => n.type === 'ListingField' && n.props.label === 'Stories'));
  assert.equal(nodes(details).find(n => n.type === 'ListingField' && n.props.label === 'Floor area (sqm)').props.required, true);
  const optional = saved({ floorAreaRequired: false }); assert.equal(nodes(optional.tree).find(n => n.type === 'ListingField' && n.props.label === 'Floor area (sqm)').props.required, false);
});

// ---- What is gone, and the rules for the source
const SRC = 'src/features/property-listing';
const stepOneFiles = ['components/ComposerPropertyFields.tsx', 'components/SavedPropertyFields.tsx', 'components/LocationConfirmCard.tsx', 'components/LocationShareCard.tsx', 'components/RangeDetailsCard.tsx', 'components/UnitDetailFields.tsx', 'components/MoreDetailsFields.tsx', 'components/FieldLabel.tsx', 'components/ListingControls.tsx', 'components/PostingCard.tsx', 'views/ListingComposerView.tsx'];
test('the dots, the legend, the "N of 8 filled" bar and the two consent buttons are gone from the code', () => {
  for (const f of stepOneFiles) { const src = readFileSync(join(SRC, f), 'utf8'); assert.ok(!/RangeLegend|EstimateMarker|feedsRange|usedInEstimate|EstimateDetailsMeter|feeds your range|Used in the range/.test(src), f); }
  assert.equal(existsSync(join(SRC, 'components/EstimateDetailsMeter.tsx')), false);
  const all = readdirSync(join(SRC, 'components')).map(f => readFileSync(join(SRC, 'components', f), 'utf8')).join('\n'); assert.ok(!/Confirm, don't share|CONFIRM_NO_SHARE_LABEL/.test(all));
});
test('real characters in JSX text, never \\u escapes: Step 1 files carry none in text or braces', () => {
  for (const f of stepOneFiles.filter(f => f.endsWith('.tsx'))) {
    const src = readFileSync(join(SRC, f), 'utf8');
    const jsxText = [...src.matchAll(/>([^<>{}\n]*\\u[0-9a-fA-F]{4}[^<>{}\n]*)</g)].map(m => m[1]);
    assert.deepEqual(jsxText, [], `${f}: an escape in JSX text`);
    const braced = [...src.matchAll(/\{\s*['"`][^'"`\n]*\\u[0-9a-fA-F]{4}[^'"`\n]*['"`]\s*\}/g)].map(m => m[0]);
    assert.deepEqual(braced, [], `${f}: an escape in a braced string used as text`);
  }
});
test('the consent logic files are untouched in this change', () => {
  const sw = readFileSync('src/features/property-listing/models/ShareWish.ts', 'utf8'), ls = readFileSync('src/features/property-listing/models/LocationShare.ts', 'utf8');
  assert.match(sw, /export const wishAfterPress = /); assert.match(sw, /export function reconcileWish/); assert.match(sw, /export const wishApplies = /);
  assert.match(ls, /export function shareCardView/); assert.match(ls, /export async function applyPendingLocationShare/);
  assert.ok(!/placeTypes|precise|confirmLocation|locationDecided/.test(sw + ls), 'neither file knows about the pin type or the new button');
});

// ---- The lookup never outlives the address it was for
test('a lookup that finishes after the address changed is ignored: no stale match appears', async () => {
  const { createPropertyLocationWorkflow } = await import('../src/features/property-listing/viewModels/propertyLocationWorkflow');
  let release!: (v: any[]) => void; const calls: string[] = [];
  const flow = createPropertyLocationWorkflow({ searchAddress: (q: string) => { calls.push(q); return new Promise<any[]>(r => { release = r; }); }, getMapStyleUrl: () => 'x' } as any);
  const first = flow.previewAddress({ addressRevision: 1, setupId: 's', query: 'old address' });
  assert.equal(flow.getSnapshot().preview.status, 'searching');
  flow.syncContext({ addressRevision: 2, setupId: 's', query: 'new address' });
  assert.equal(flow.getSnapshot().preview.status, 'idle', 'the address changed: nothing is shown for the old one');
  release([{ id: 'old', label: 'Old', latitude: 14.4, longitude: 120.9, placeTypes: ['address'] }]); await first;
  assert.equal(flow.getSnapshot().preview.status, 'idle', 'and the late answer does not bring it back'); assert.equal(flow.getSnapshot().preview.candidate, null);
  assert.equal(flow.confirmPreview({ addressRevision: 1, setupId: 's', query: 'old address' }), false);
});
test('a preview only confirms for the revision it was made for, and clearing it removes it', async () => {
  const { createPropertyLocationWorkflow } = await import('../src/features/property-listing/viewModels/propertyLocationWorkflow');
  const accepted: number[] = [];
  const flow = createPropertyLocationWorkflow({ searchAddress: async () => [{ id: 'a', label: 'A', latitude: 14.4, longitude: 120.9, placeTypes: ['address'] }], getMapStyleUrl: () => 'x' } as any, (_loc, rev) => { accepted.push(rev); return true; });
  await flow.previewAddress({ addressRevision: 3, setupId: 's', query: 'q' });
  assert.equal(flow.getSnapshot().preview.status, 'ready'); assert.equal(flow.confirmPreview({ addressRevision: 4, setupId: 's', query: 'q' }), false, 'another revision'); assert.deepEqual(accepted, []);
  assert.equal(flow.confirmPreview({ addressRevision: 3, setupId: 's', query: 'q' }), true); assert.deepEqual(accepted, [3]); assert.equal(flow.getSnapshot().confirmedPrecise, true);
  flow.clearPreview(); assert.equal(flow.getSnapshot().preview.status, 'idle');
  assert.equal(flow.confirmPreview({ addressRevision: 3, setupId: 's', query: 'q' }), false, 'nothing left to confirm');
});

// ---- The saved property's switch
test('the saved-property switch: on shares, off withdraws, a usable approval can always be withdrawn, an unusable point is the fallback note', () => {
  const v = (approval: any, over: any = {}) => savedSwitchView({ approval, loading: false, error: false, busy: false, ...over });
  assert.deepEqual(v({ approved: false, eligible: true }), { on: false, enabled: true, note: SWITCH_SUBTITLE, reload: false, showMap: true });
  assert.deepEqual(v({ approved: true, eligible: true }), { on: true, enabled: true, note: SWITCH_SUBTITLE, reload: false, showMap: true });
  const stale = v({ approved: true, eligible: false }); assert.equal(stale.enabled, true); assert.equal(stale.on, true);
  const fallback = v({ approved: false, eligible: false }); assert.equal(fallback.enabled, false); assert.equal(fallback.on, false); assert.equal(fallback.note, FALLBACK_NOTE); assert.equal(fallback.showMap, false);
  assert.equal(v({ approved: false, eligible: true }, { busy: true }).enabled, false);
  assert.deepEqual(v(null, { loading: true }), { on: false, enabled: false, note: SAVED_LOADING, reload: false, showMap: false });
  assert.deepEqual(v(null, { error: true }), { on: false, enabled: false, note: SAVED_LOAD_FAILED, reload: true, showMap: false });
});
test('the line after a change appears only once the server has confirmed it, and says which way it went', () => {
  assert.equal(savedNotice('share', true, false, false), 'Approximate area shared'); assert.equal(SHARED_NOTICE, 'Approximate area shared');
  assert.equal(savedNotice('withdraw', false, false, false), 'Approximate area no longer shared'); assert.equal(WITHDRAWN_NOTICE, 'Approximate area no longer shared');
  assert.equal(savedNotice('share', false, false, false), null, 'not yet: the approval is still off');
  assert.equal(savedNotice('share', true, true, false), null, 'not while it is running'); assert.equal(savedNotice('share', true, false, true), null, 'not after an error');
  assert.equal(savedNotice(null, true, false, false), null, 'nothing before the person changes anything'); assert.equal(savedNotice('share', null, false, false), null);
  const card = readFileSync('src/features/property-listing/components/LocationShareCard.tsx', 'utf8');
  assert.match(card, /const toggle=\(next:boolean\)=>\{setIntent\(next\?'share':'withdraw'\);void model\.save\(next\);\};/, 'the switch calls the existing approval save: on approves, off withdraws');
});
test('no "Confirm and share approximate area" label remains anywhere in the app', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : []);
  const hits = walk('src').filter(f => /Confirm and share approximate area|CONFIRM_SHARE_LABEL/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});

// ---- Part C: the details card follows the property type, and photos are the first card on the Listing step
const noRangeComposer = (rangeSupport: string, type: string, over: any = {}) => composer({ rangeSupport, propertyState: { draft: { ...fullDraft(), propertyType: type, furnishingStatus: 'unfurnished', city: 'imus', barangay: 'B', addressLine1: 'A', bedrooms: '1', bathrooms: '1', floorAreaSqm: '' }, loaded: true }, estimateInputs: inputs({ propertyType: type }), floorAreaRequired: false, ...over });
test('a type without a range gets a plain Details card: the info line, then floor area (optional), bedrooms, bathrooms, furnishing, amenities', () => {
  const { groups } = noRangeComposer('type', 'boarding_house'), details = groups.find(g => g.props.group === 'details')!;
  assert.ok(!nodes(details).some(n => n.type === 'Text' && deepText(n) === 'Details that set your range'), 'no range card');
  const card = nodes(details).find(n => n.type === 'PostingCard'); assert.equal(card.props.title, 'Details');
  assert.ok(nodes(details).some(n => n.type === 'Text' && deepText(n) === 'A typical-rent range is available for apartments, houses and condominiums. For a boarding house you set your own price.'));
  assert.deepEqual(nodes(details).filter(n => n.type === 'ListingField').map(n => n.props.label), ['Floor area (sqm, optional)', 'Bedrooms', 'Bathrooms']);
  assert.ok(nodes(details).some(n => n.type === 'PostingChoices' && n.props.label === 'Furnishing')); assert.ok(nodes(details).some(n => n.type === 'AmenitiesStub'));
  assert.ok(!nodes(details).some(n => n.type === 'ListingField' && /Unit floor|Parking|Lot area/.test(n.props.label)), 'range-only fields are hidden');
  assert.ok(!nodes(details).some(n => n.type === 'ChoiceChip'), 'no subtype chips');
  assert.ok(!nodes(details).some(n => n.type === 'ListingField' && n.props.required && /Floor area/.test(n.props.label)), 'floor area is not required without a range');
});
test('the range card shows only for a type with a range; no type yet shows no details card; a city without a range shows the plain card with the city line', () => {
  const kinds = (g: any) => nodes(g).some(n => n.type === 'Text' && deepText(n) === 'Details that set your range') ? 'range' : nodes(g).some(n => n.type === 'PostingCard') ? 'plain' : 'none';
  const pick = (support: string, type: string) => kinds(noRangeComposer(support, type).groups.find(g => g.props.group === 'details')!);
  assert.equal(pick('range', 'apartment'), 'range'); assert.equal(pick('range', 'house'), 'range'); assert.equal(pick('range', 'condominium'), 'range');
  assert.equal(pick('type', 'dormitory'), 'plain'); assert.equal(pick('none', ''), 'none');
  const city = noRangeComposer('city', 'apartment', { propertyState: { draft: { ...fullDraft(), propertyType: 'apartment', city: 'bacoor', furnishingStatus: 'unfurnished', barangay: 'B', addressLine1: 'A', bedrooms: '1', bathrooms: '1', floorAreaSqm: '' }, loaded: true } });
  const details = city.groups.find(g => g.props.group === 'details')!; assert.equal(kinds(details), 'plain');
  assert.ok(nodes(details).some(n => n.type === 'Text' && /is not covered by typical-rent ranges yet\. You set your own price\.$/.test(deepText(n))));
});
test('the saved-property editor follows the same rule: plain Details card for a type without a range', () => {
  const { tree } = saved({ rangeSupport: 'type', estimateInputs: inputs({ propertyType: 'room' }), floorAreaRequired: false }, { property_type: 'room', floor_number: null });
  const details = nodes(tree).find(n => n.type === 'Group' && n.props.group === 'details')!;
  assert.equal(nodes(details).find(n => n.type === 'PostingCard').props.title, 'Details');
  assert.deepEqual(nodes(details).filter(n => n.type === 'ListingField').map(n => n.props.label), ['Floor area (sqm, optional)', 'Bedrooms', 'Bathrooms']);
  assert.ok(nodes(details).some(n => n.type === 'PostingChoices' && n.props.label === 'Furnishing')); assert.ok(nodes(details).some(n => n.type === 'AmenityChoices'));
  assert.ok(!nodes(details).some(n => n.type === 'Text' && /^Unit floor/.test(deepText(n))), 'no unit floor');
  assert.ok(!nodes(details).some(n => n.type === 'RangeDetailsCard'));
});
const photoVm = (over: any = {}, items: any[] = []) => {
  const log: string[] = [];
  const vm: any = { workspacePropertyId: 'p', composerPhase: null, navigate: (s: string) => log.push(`go:${s}`), mediaItems: items, photoState: { busy: false, loaded: true, needsReconcile: false, pendingSelections: [], error: null, notice: null, removeId: null, batch: { status: 'idle', completed: 0, total: 0 } },
    propertyPhotos: { addPhotos: () => log.push('add'), openMedia: (i: number) => log.push(`open:${i}`), resumeQueue: () => log.push('resume'), checkStatus: () => log.push('check'), confirmRemove() {}, cancelRemove() {} }, ...over };
  const tree = expand(load('src/features/property-listing/components/ListingPhotosCard.tsx').ListingPhotosCard({ viewModel: vm }));
  const texts = nodes(tree).filter(n => n.type === 'Text').map(n => deepText(n));
  return { tree, log, texts, buttons: nodes(tree).filter(n => n.type === 'ListingButton') };
};
const item = (key: string, status: string, over: any = {}) => ({ key, uri: `file:///${key}.jpg`, label: key, status, cover: false, photoId: status === 'Saved' ? key : undefined, ...over });
const photoState = (over: any) => ({ photoState: { busy: false, loaded: true, needsReconcile: false, pendingSelections: [], error: null, notice: null, removeId: null, batch: { status: 'idle', completed: 0, total: 0 }, ...over } });
test('photos card, empty: one large dashed Add photos target with the cover sentence, and 0 of 10', () => {
  const { tree, texts, log } = photoVm();
  assert.ok(texts.includes('Photos') && texts.includes('0 of 10') && texts.includes('Add photos') && texts.includes('The first photo is your cover. You can add up to 10.'));
  const target = nodes(tree).find(n => n.type === 'Pressable' && /Add photos/.test(n.props.accessibilityLabel ?? ''))!, s = flatStyle(target.props.style);
  assert.equal(s.borderStyle, 'dashed'); assert.equal(s.borderRadius, 24); assert.ok(s.minHeight >= 160); target.props.onPress(); assert.deepEqual(log, ['add']);
  assert.ok(!nodes(tree).some(n => n.type === 'Image'), 'no picture yet');
});
test('photos card, filled: a 24dp cover with the Cover badge and its count, 18dp thumbnails, Manage photos and Add more, with no 360° control', () => {
  const { tree, texts, buttons, log } = photoVm({}, [item('a', 'Saved', { cover: true }), item('b', 'Saved'), item('c', 'Saved')]);
  assert.ok(texts.includes('3 of 10') && texts.includes('Cover') && texts.includes('1 of 3'));
  const hero = nodes(tree).find(n => n.type === 'Pressable' && /Cover photo/.test(n.props.accessibilityLabel ?? ''))!; assert.equal(flatStyle(hero.props.style).borderRadius, 24);
  const thumbs = nodes(tree).filter(n => n.type === 'Pressable' && /View photo \d/.test(n.props.accessibilityLabel ?? '')); assert.equal(thumbs.length, 3);
  assert.ok(thumbs.every(t => flatStyle(t.props.style).borderRadius === 18 && flatStyle(t.props.style).width >= 48));
  assert.deepEqual(buttons.map(b => b.props.label), ['Manage photos', 'Add more']);
  assert.ok(!JSON.stringify(tree).includes('360'), '360° was never functional in this app, so nothing mentions it here');
  buttons[0]!.props.onPress(); buttons[1]!.props.onPress(); thumbs[1]!.props.onPress(); assert.deepEqual(log, ['go:photoManager', 'add', 'open:1']);
});
test('photos card: an uploading thumbnail has a light veil, a failed one an amber veil with Retry that resumes the queue', () => {
  const items = [item('a', 'Saved', { cover: true }), item('b', 'Uploading', { pendingIndex: 0 }), item('c', 'Selected', { pendingIndex: 1 })];
  const up = photoVm(photoState({ busy: true, pendingSelections: [1, 2], batch: { status: 'running', completed: 0, total: 2 } }), items);
  assert.equal(up.texts.filter(t => t === 'Uploading…').length, 2, 'the running photo and the one queued behind it'); assert.ok(up.texts.includes('Uploading 1 of 2…'));
  assert.ok(!up.texts.some(t => /Retry|Couldn’t/.test(t)), 'a normal wait shows no failure wording');
  const queued = [item('a', 'Saved', { cover: true }), item('b', 'Selected', { pendingIndex: 0 }), item('c', 'Selected', { pendingIndex: 1 })]; // nothing is running: the queue stopped
  const stopped = photoVm(photoState({ pendingSelections: [1, 2], batch: { status: 'idle', completed: 1, total: 2 } }), queued);
  assert.equal(stopped.texts.filter(t => t === 'Couldn’t upload').length, 2); assert.ok(stopped.texts.includes('Retry') && stopped.texts.includes('Some photos didn’t upload.'));
  const retry = nodes(stopped.tree).find(n => n.type === 'Pressable' && /Retry upload of photo 2/.test(n.props.accessibilityLabel ?? ''))!; retry.props.onPress();
  stopped.buttons.find(b => b.props.label === 'Retry failed')!.props.onPress(); assert.deepEqual(stopped.log, ['resume', 'resume']);
  assert.ok(nodes(stopped.tree).some(n => flatStyle(n.props?.style).backgroundColor === 'rgba(255,247,232,0.94)'), 'the failed veil is amber');
});
test('photos card: the existing photo recovery stays: Check saved photos after an unknown outcome, Retry loading photos when the list did not load', () => {
  const unknown = photoVm(photoState({ needsReconcile: true }), [item('a', 'Saved', { cover: true })]);
  unknown.buttons.find(b => b.props.label === 'Check saved photos')!.props.onPress(); assert.deepEqual(unknown.log, ['check']);
  assert.ok(unknown.buttons.find(b => b.props.label === 'Add more')!.props.disabled, 'no new pick while the outcome is unknown');
  const notLoaded = photoVm(photoState({ loaded: false }), []); assert.ok(notLoaded.buttons.some(b => b.props.label === 'Retry loading photos'));
  assert.equal(nodes(notLoaded.tree).find(n => n.type === 'Pressable' && /Add photos/.test(n.props.accessibilityLabel ?? ''))!.props.disabled, true);
});
