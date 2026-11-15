import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { missingLine, moreDetailsFields, moreDetailsSummary, MORE_FIELD_FEEDS_RANGE, MORE_LABELS } from '../src/features/property-listing/models/PropertyReadiness';
import { CONFIRM_NO_SHARE_LABEL, CONFIRM_SHARE_LABEL, CONSENT_HINT, confirmedPlace, confirmedStatus, decisionKey, decisionStands, newPropertyLocationView } from '../src/features/property-listing/models/LocationConsent';
import { offeredSubtypeOptions } from '../src/features/property-listing/models/PropertyModelAttributes';

const issue = (field: string, kind: 'required' | 'invalid' = 'required', message = `msg ${field}`) => ({ field, section: 'address', kind, message }) as any;

// ---- The one footer line
test('the footer line names every missing required field once, in page order', () => {
  assert.equal(missingLine([issue('addressLine1'), issue('barangay'), issue('city'), issue('location')], true, true), 'Add floor area, city, barangay and street');
  assert.equal(missingLine([issue('propertyType'), issue('bedrooms'), issue('bathrooms')], false, true), 'Add property type, bedrooms and bathrooms');
  assert.equal(missingLine([issue('barangay')], false, true), 'Add barangay');
  assert.equal(missingLine([], true, false), 'Add floor area', 'a missing floor area the estimator needs counts even without an issue');
});
test('with nothing to add, the line asks for the location, then names a value that does not fit, then says nothing', () => {
  assert.equal(missingLine([issue('location')], false, true), 'Confirm the location to continue');
  assert.equal(missingLine([issue('floorNumber', 'invalid', 'Enter a valid rental floor.')], false, false), 'Enter a valid rental floor.');
  assert.equal(missingLine([], false, false), null);
  assert.equal(missingLine([issue('location')], false, false), null, 'a location that is decided is not a gap');
});

// ---- The consent decision
const draftOf = (over: any = {}) => ({ city: 'imus', barangay: ' B ', addressLine1: 'A', addressLine2: '', postalCode: '', exactLatitude: 14.4, exactLongitude: 120.9, publicLatitude: 14.41, publicLongitude: 120.91, ...over });
test('the words are the specified words', () => {
  assert.equal(CONFIRM_SHARE_LABEL, 'Confirm and share approximate area');
  assert.equal(CONFIRM_NO_SHARE_LABEL, "Confirm, don't share");
  assert.equal(CONSENT_HINT, 'Sharing helps the range. Skipping is fine: the range then uses the city only.');
  assert.equal(confirmedPlace(' Anabu I-A ', 'Imus'), 'Barangay Anabu I-A, Imus');
  assert.equal(confirmedStatus(true), 'approximate area shared');
  assert.equal(confirmedStatus(false), 'approximate area not shared');
});
test('the card is hidden until the address is complete, offers the map next, asks only once a pin exists, then collapses', () => {
  assert.deepEqual(newPropertyLocationView({ addressReady: false, pinned: false, decided: false, shared: false }), { kind: 'hidden' });
  assert.deepEqual(newPropertyLocationView({ addressReady: true, pinned: false, decided: false, shared: false }), { kind: 'findOnMap' });
  assert.deepEqual(newPropertyLocationView({ addressReady: true, pinned: true, decided: false, shared: false }), { kind: 'ask' });
  assert.deepEqual(newPropertyLocationView({ addressReady: true, pinned: true, decided: true, shared: true }), { kind: 'confirmed', shared: true });
  assert.deepEqual(newPropertyLocationView({ addressReady: true, pinned: true, decided: true, shared: false }), { kind: 'confirmed', shared: false });
  assert.deepEqual(newPropertyLocationView({ addressReady: false, pinned: true, decided: false, shared: false }), { kind: 'ask' }, 'a pin that exists is never hidden by a later empty field');
});
test('a decision stands only for the point and address it was made for', () => {
  const key = decisionKey(draftOf(), 3), snap = (over: any = {}, revision = 3, confirmed = true) => ({ confirmed, key: decisionKey(draftOf(over), revision) });
  const decision = { key, share: false };
  assert.equal(decisionStands(decision, snap()), true);
  assert.equal(decisionStands(decision, snap({ barangay: 'B' })), true, 'whitespace is not a change');
  for (const over of [{ barangay: 'Other' }, { addressLine1: 'Other' }, { addressLine2: 'Tower' }, { postalCode: '4103' }, { city: 'tagaytay' }, { publicLatitude: 14.5 }, { exactLongitude: 121 }])
    assert.equal(decisionStands(decision, snap(over)), false, JSON.stringify(over));
  assert.equal(decisionStands(decision, snap({}, 4)), false, 'the address revision counts');
  assert.equal(decisionStands(decision, snap({}, 3, false)), false, 'no pin, no decision');
  assert.equal(decisionStands(null, snap()), false);
  assert.equal(decisionStands(decision, { confirmed: true, key: decisionKey({ ...draftOf(), propertyType: 'house', floorNumber: '9' } as any, 3) }), true, "type and floor do not undo \"Confirm, don't share\"");
});

// ---- Type-aware More details
test('More details offers only the fields a type has', () => {
  assert.deepEqual(moreDetailsFields('apartment'), ['propertySubtype', 'parkingSpaces', 'floorNumber', 'totalFloors', 'maxOccupants']);
  assert.deepEqual(moreDetailsFields('condominium'), ['propertySubtype', 'parkingSpaces', 'floorNumber', 'totalFloors', 'maxOccupants']);
  assert.deepEqual(moreDetailsFields('house'), ['propertySubtype', 'lotAreaSqm', 'parkingSpaces', 'totalFloors', 'maxOccupants']);
  for (const type of ['apartment', 'condominium', 'bedspace', 'room', 'studio', 'boarding_house', null]) assert.ok(!moreDetailsFields(type).includes('lotAreaSqm'), `${type}: never lot area`);
  for (const type of ['apartment', 'condominium', 'bedspace', 'room', 'studio', 'boarding_house', null]) assert.ok(moreDetailsFields(type).includes('floorNumber'), `${type}: unit floor`);
  assert.ok(!moreDetailsFields('house').includes('floorNumber'), 'a house never sees Unit floor');
  assert.ok(!moreDetailsFields('bedspace').includes('propertySubtype'), 'no subtype chips where there are none to offer');
  for (const type of ['apartment', 'condominium', 'house']) assert.ok(!offeredSubtypeOptions(type).includes('room'), `${type}: never "room"`);
});
test('the dot marks exactly the fields the model reads; floors in building, stories and occupants carry none', () => {
  assert.deepEqual(Object.entries(MORE_FIELD_FEEDS_RANGE).filter(([, v]) => v).map(([k]) => k), ['propertySubtype', 'lotAreaSqm', 'parkingSpaces', 'floorNumber']);
  assert.equal(MORE_FIELD_FEEDS_RANGE.totalFloors, false); assert.equal(MORE_FIELD_FEEDS_RANGE.maxOccupants, false);
  assert.equal(MORE_LABELS('apartment').totalFloors, 'Floors in building'); assert.equal(MORE_LABELS('house').totalFloors, 'Stories');
});
test('the summary reads "Optional · none added" until something is entered, and counts only fields the type offers', () => {
  assert.equal(moreDetailsSummary('apartment', {}), 'Optional · none added');
  assert.equal(moreDetailsSummary('apartment', { parkingSpaces: ' ', maxOccupants: '' }), 'Optional · none added');
  assert.equal(moreDetailsSummary('apartment', { parkingSpaces: '1', maxOccupants: '3' }), 'Optional · 2 added');
  assert.equal(moreDetailsSummary('apartment', { lotAreaSqm: '120' }), 'Optional · none added', 'a stale lot area on an apartment is not counted');
  assert.equal(moreDetailsSummary('house', { lotAreaSqm: '120', floorNumber: '3' }), 'Optional · 1 added');
});

// ---- The grid as rendered
const real: Record<string, string> = {
  colors: 'src/shared/theme/colors.ts', spacing: 'src/shared/theme/spacing.ts', PropertyModelAttributes: 'src/features/property-listing/models/PropertyModelAttributes.ts',
  PropertyReadiness: 'src/features/property-listing/models/PropertyReadiness.ts', FieldLabel: 'src/features/property-listing/components/FieldLabel.tsx',
};
const cache: Record<string, any> = {};
function load(file: string): any {
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react-native') return { Text: 'Text', View: 'View', StyleSheet: { create: (s: any) => s } };
    const n = key.split('/').at(-1)!;
    if (n === 'ui') return { ui: {} };
    if (n === 'ListingControls') return { ChoiceChip: 'ChoiceChip', ListingField: 'ListingField' };
    if (n === 'DraftProperty') return {};
    if (real[n]) return cache[n] ??= load(real[n]);
    return { [n]: n };
  };
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  return m.exports;
}
const expand = (v: any): any => (v && typeof v === 'object' ? (typeof v.type === 'function' ? expand(v.type(v.props)) : { ...v, props: { ...v.props, children: [v.props?.children].flat(Infinity).map(expand) } }) : v);
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const deepText = (v: any): string => (v == null || typeof v === 'boolean' ? '' : typeof v === 'object' ? [v.props?.children].flat(Infinity).map(deepText).join('') : String(v));
const fullDraft = (over: any = {}) => ({ propertyType: 'apartment', propertySubtype: '', lotAreaSqm: '', parkingSpaces: '', floorNumber: '', totalFloors: '', maxOccupants: '', accessInstructions: '', ...over });
function grid(over: any = {}, extra: any = {}) {
  const changes: any[] = [], blurs: any[] = [];
  const tree = expand(load('src/features/property-listing/components/MoreDetailsFields.tsx').MoreDetailsFields({ draft: fullDraft(over), disabled: false, error: () => null, onChange: (...a: any[]) => changes.push(a), onBlur: (f: string) => blurs.push(f), ...extra }));
  return { tree, changes, blurs, fields: nodes(tree).filter(n => n.type === 'ListingField'), chips: nodes(tree).filter(n => n.type === 'ChoiceChip').map(c => c.props.label) };
}
const labels = (g: ReturnType<typeof grid>) => g.fields.map(f => f.props.label);
test('an apartment sees subtype, parking, unit floor, floors in building and max occupants, and never lot area', () => {
  const g = grid({ propertyType: 'apartment' });
  assert.deepEqual(labels(g), ['Parking spaces', 'Unit floor', 'Floors in building', 'Max occupants', 'Entrance instructions (private)']);
  assert.ok(!labels(g).some(l => /lot/i.test(l)));
  assert.deepEqual(g.chips, ['Not specified', 'apartment', 'studio', 'loft', 'penthouse']);
  assert.ok(!g.chips.includes('room'));
});
test('a condominium adds condotel, a house sees lot area and stories and never a unit floor', () => {
  assert.deepEqual(grid({ propertyType: 'condominium' }).chips, ['Not specified', 'condominium', 'studio', 'loft', 'penthouse', 'condotel']);
  const house = grid({ propertyType: 'house' });
  assert.deepEqual(labels(house), ['Lot area (sqm)', 'Parking spaces', 'Stories', 'Max occupants', 'Entrance instructions (private)']);
  assert.ok(!labels(house).some(l => /unit floor/i.test(l)));
  assert.deepEqual(house.chips, ['Not specified', 'house', 'townhouse', 'beach house', 'villa']);
  assert.ok(!house.chips.includes('room'));
});
test('a type with no subtype to offer shows no chips; a stored subtype that no longer fits stays visible so it can be cleared', () => {
  assert.deepEqual(grid({ propertyType: 'bedspace' }).chips, []);
  const stale = grid({ propertyType: 'apartment', propertySubtype: 'room' });
  assert.ok(stale.chips.includes('room'));
  assert.equal(nodes(stale.tree).find(n => n.type === 'ChoiceChip' && n.props.label === 'room').props.selected, true);
});
test('the number fields sit in a wrapping two-column grid with short labels and one helper line', () => {
  const g = grid({ propertyType: 'apartment' });
  const gridNode = nodes(g.tree).find(n => Array.isArray(n.props?.style) ? false : n.props?.style?.flexWrap === 'wrap' && n.props.style.flexDirection === 'row' && n.props.style.gap === 12);
  assert.ok(gridNode, 'a wrapping row');
  const cells = nodes(gridNode).filter(n => n.type === 'View' && n.props.style?.flexBasis === 130 && n.props.style?.flexGrow === 1);
  assert.equal(cells.length, 4, 'four cells: parking, unit floor, floors, occupants');
  assert.ok(g.fields.filter(f => f.props.keyboardType === 'numeric').every(f => !/optional|\(/.test(f.props.label)), 'short labels, no "(optional)" on every row');
  const helpers = nodes(g.tree).filter(n => n.type === 'Text').map(n => deepText(n));
  assert.deepEqual(helpers.filter(t => /Leave blank/.test(t)), ['Leave blank if unknown. Unit numbers belong in the address.']);
  assert.ok(!helpers.some(t => /do not change your listing price|Enter 0 only when confirmed|Subtype describes/.test(t)), 'no paragraph under any field');
});
test('the dot shows on the fields the model reads and not on floors, stories or occupants', () => {
  const dotted = (g: ReturnType<typeof grid>) => Object.fromEntries(g.fields.map(f => [f.props.label, !!f.props.usedInEstimate]));
  assert.deepEqual(dotted(grid({ propertyType: 'apartment' })), { 'Parking spaces': true, 'Unit floor': true, 'Floors in building': false, 'Max occupants': false, 'Entrance instructions (private)': false });
  assert.deepEqual(dotted(grid({ propertyType: 'house' })), { 'Lot area (sqm)': true, 'Parking spaces': true, Stories: false, 'Max occupants': false, 'Entrance instructions (private)': false });
  const subtype = nodes(grid({ propertyType: 'apartment' }).tree).find(n => n.type === 'Text' && n.props.accessibilityLabel === 'Subtype, feeds your range');
  assert.ok(subtype, 'the subtype label is dotted and spoken that way');
});
test('typing and leaving a field are reported with the field name', () => {
  const g = grid({ propertyType: 'apartment' });
  const parking = g.fields.find(f => f.props.label === 'Parking spaces');
  parking.props.onChangeText('2'); parking.props.onBlur();
  assert.deepEqual(g.changes, [['parkingSpaces', '2']]); assert.deepEqual(g.blurs, ['parkingSpaces']);
  g.fields.find(f => f.props.label === 'Floors in building').props.onBlur(); assert.deepEqual(g.blurs, ['parkingSpaces', 'totalFloors']);
  nodes(g.tree).find(n => n.type === 'ChoiceChip' && n.props.label === 'loft').props.onPress();
  assert.deepEqual(g.changes.at(-1), ['propertySubtype', 'loft']);
});
test('an error shows on its own field, and a disabled form disables every control', () => {
  const g = grid({ propertyType: 'apartment' }, { error: (f: string) => (f === 'totalFloors' ? 'Enter a valid number of floors in the building.' : null), disabled: true });
  assert.equal(g.fields.find(f => f.props.label === 'Floors in building').props.error, 'Enter a valid number of floors in the building.');
  assert.ok(g.fields.every(f => f.props.editable === false));
  assert.ok(nodes(g.tree).filter(n => n.type === 'ChoiceChip').every(c => c.props.disabled === true));
});
