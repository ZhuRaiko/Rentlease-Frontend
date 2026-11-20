/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {recommendedMatchingPreferences as base} from '../src/features/search-discovery/models/SearchDiscovery';

let cardsModule: any;
// Loads a component file with stand-in children: react-native pieces and icons are elements named after themselves.
function load(path: string) {
  const mod = {exports: {} as any};
  const mock = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : {type, props}); return {jsx, jsxs: jsx}; }
    if (key === 'react-native') return new Proxy({StyleSheet: {create: (x: any) => x}}, {get: (x: any, k) => x[k] ?? k});
    if (key.endsWith('/PreferenceCards')) return (cardsModule ??= load('src/features/search-discovery/components/PreferenceCards.tsx'));
    if (key.endsWith('/models/MatchingPreferenceForm')) return require('../src/features/search-discovery/models/MatchingPreferenceForm');
    if (key.endsWith('/models/SearchDiscovery')) return require('../src/features/search-discovery/models/SearchDiscovery');
    if (/\/theme\//.test(key)) return new Proxy({}, {get: () => new Proxy({}, {get: () => 0})});
    return new Proxy({}, {get: (_x, k) => String(k)});
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(resolve(path), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText)(mock, mod, mod.exports);
  return mod.exports;
}
const nodes = (v: any): any[] => (v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : []);
const section = load('src/features/search-discovery/components/PropertyPreferences.tsx');
const cards = cardsModule;

function render(preferences = base) {
  const changes: [string, unknown][] = [], kinds: string[] = [], amenities: string[] = [];
  const tree = section.PropertyPreferences({preferences, onChange: (f: string, v: unknown) => changes.push([f, v]), onToggleKind: (k: string) => kinds.push(k), onToggleAmenity: (a: string) => amenities.push(a)});
  return {all: nodes(tree), changes, kinds, amenities};
}
const press = (all: any[], label: string) => all.find(n => n.props?.accessibilityLabel === label).props.onPress();

test('the steppers keep today’s steps (land area 10, bedrooms 1, bathrooms 1) and never go below Any', () => {
  const h = render();
  press(h.all, 'Increase Land Area (sqm)'); press(h.all, 'Decrease Land Area (sqm)');
  press(h.all, 'Increase Bedrooms'); press(h.all, 'Increase Bathrooms');
  assert.deepEqual(h.changes, [['minimumLandArea', 50], ['minimumLandArea', 30], ['minimumBedrooms', 2], ['minimumBathrooms', 2]]);
  const zero = render({...base, minimumBedrooms: 0});
  press(zero.all, 'Decrease Bedrooms');
  assert.deepEqual(zero.changes, [['minimumBedrooms', 0]]);
  assert.ok(nodes(section.Stepper({label: 'Bedrooms', value: 0, step: 1, onChange() {}})).some(n => n.type === 'Text' && n.props.children === 'Any'));
});

test('every stepper button is 48dp, so the touch target is met', () => {
  const source = readFileSync(resolve('src/features/search-discovery/components/PropertyPreferences.tsx'), 'utf8');
  assert.match(source, /button: \{width: 48, height: 48/);
});

test('property types and amenities are multi-select pills (checkbox role, check when chosen) with the existing labels', () => {
  const h = render();
  const pills = h.all.filter(n => n.type === 'Pressable' && n.props.accessibilityRole === 'checkbox');
  assert.deepEqual(pills.map(n => n.props.accessibilityLabel), ['House For Rent', 'Apartment', 'Condominium', 'Studio', 'Wi-fi', 'Parking Space', 'Airconditioning', 'Pet friendly']);
  assert.deepEqual(pills.map(n => n.props.accessibilityState.checked), [true, true, false, false, true, true, false, false]);
  pills[2].props.onPress(); pills[7].props.onPress();
  assert.deepEqual([h.kinds, h.amenities], [['Condominium'], ['Pet friendly']]);
});

test('single choice and multi-select look different: single is a radio role with no check, multi is a checkbox role', () => {
  const single = nodes(cards.ChoicePill({label: 'Student', selected: true, onPress() {}}));
  const multi = nodes(cards.ChoicePill({label: 'Wi-fi', multi: true, selected: true, onPress() {}}));
  assert.equal(single[0].props.accessibilityRole, 'radio');
  assert.equal(multi[0].props.accessibilityRole, 'checkbox');
  assert.ok(!single.some(n => n.type === 'CheckMark'));
  assert.ok(multi.some(n => n.type === 'CheckMark'));
  assert.ok(!nodes(cards.ChoicePill({label: 'Wi-fi', multi: true, selected: false, onPress() {}})).some(n => n.type === 'CheckMark'), 'no check until chosen');
});
