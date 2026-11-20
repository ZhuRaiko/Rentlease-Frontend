/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {recommendedMatchingPreferences as base} from '../src/features/search-discovery/models/SearchDiscovery';

// Renders MatchingPreferencesView with stand-in children: every imported component is an element named after itself, so the tree can be inspected.
export function render(open: string | null, over: Record<string, unknown> = {}, tight = false, tabField = 'factorRanking') {
  const file = resolve('src/features/search-discovery/views/MatchingPreferencesView.tsx'), mod = {exports: {} as any};
  const form = {open, toggle() {}, show() {}, tab: {id: tabField, label: tabField, field: tabField}, setTab() {}};
  const mock = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : {type, props}); return {jsx, jsxs: jsx}; }
    if (key === 'react') return {useRef: (value: unknown) => ({current: value}), useEffect() {}};
    if (key === 'react-native') return new Proxy({StyleSheet: {create: (x: any) => x}, useWindowDimensions: () => ({width: tight ? 320 : 411, fontScale: tight ? 1.5 : 1}), Platform: {OS: 'android'}}, {get: (x: any, k) => x[k] ?? k});
    if (key.endsWith('/useBottomClearance')) return {useBottomClearance: () => 40};
    if (key.endsWith('/useMatchingPreferencesForm')) return {useMatchingPreferencesForm: () => form};
    if (key.endsWith('/models/MatchingPreferenceForm')) return require('../src/features/search-discovery/models/MatchingPreferenceForm');
    if (key.endsWith('/models/SearchDiscovery')) return require('../src/features/search-discovery/models/SearchDiscovery');
    if (/\/theme\//.test(key)) return new Proxy({}, {get: () => new Proxy({}, {get: () => 0})});
    return new Proxy({}, {get: (_x, k) => String(k)});
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText)(mock, mod, mod.exports);
  const viewModel = {matchingPreferences: base, updateMatchingPreference() {}, notice: null, introductionError: null, introductionPending: false, isCompletingIntroduction: false, saveMatchingPreferences() {}, skipMatchingIntroduction() {}, ...over};
  return mod.exports.MatchingPreferencesView({viewModel, onClose() {}});
}
const nodes = (v: any): any[] => (v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : []);
const ofType = (tree: any, type: string) => nodes(tree).filter(n => n.type === type);

test('first open: About you shows its three questions; Property, Budget and What matters most are closed cards with their summaries', () => {
  const tree = render('about');
  assert.equal(ofType(tree, 'AboutFolded').length, 0);
  assert.deepEqual(ofType(tree, 'ChoicePill').map(n => n.props.label).slice(0, 4), ['Student', 'Working Professionally', 'Living with a Housemate', 'Family']);
  assert.equal(ofType(tree, 'StayChoice').length, 4);
  const cards = ofType(tree, 'PreferenceCard');
  assert.deepEqual(cards.map(c => [c.props.title, c.props.open]), [['Property', false], ['Budget', false], ['What matters most', false]]);
  assert.deepEqual(cards.map(c => c.props.summary), ['House, Apartment · 40 sqm · 1 bed · 1 bath', '₱15,000–₱65,000 a month', 'Location, Budget, Unit specifications']);
});

test('another card open: About you folds to one line with Change, and only that card is open', () => {
  const tree = render('property');
  assert.equal(ofType(tree, 'ChoicePill').length, 0, 'the About you questions are gone');
  assert.equal(ofType(tree, 'AboutFolded')[0].props.summary, 'Student · Long-term · Imus City');
  assert.deepEqual(ofType(tree, 'PreferenceCard').map(c => c.props.open), [true, false, false]);
});

test('the nearby-essentials switch is on every state, and the footer Save sits outside the scrolling area', () => {
  for (const open of ['about', 'property', 'budget', 'matters', null]) {
    const tree = render(open);
    assert.equal(ofType(tree, 'NearbySwitchRow').length, 1, String(open));
    const scroll = ofType(tree, 'ScrollView')[0];
    assert.ok(!nodes(scroll).some(n => n.type === 'AppButton'), 'Save is not inside the ScrollView');
    assert.ok(ofType(tree, 'AppButton').some(n => n.props.label === 'Save preferences'));
  }
});

test('tight layouts (320dp or large text) give each length-of-stay card its own line', () => {
  assert.ok(ofType(render('about', {}, true), 'StayChoice').every(n => n.props.full === true));
  assert.ok(ofType(render('about'), 'StayChoice').every(n => n.props.full === false));
});

test('What matters most: the card shows the ranking of the chosen tab, with the three tabs', () => {
  for (const field of ['factorRanking', 'unitSpecificationRanking', 'amenityRanking'] as const) {
    const tree = render('matters', {}, false, field);
    assert.deepEqual(ofType(tree, 'RankingList')[0].props.values, base[field], field);
  }
  assert.deepEqual(ofType(render('matters'), 'RankingTabs')[0].props.tabs.map((t: any) => t.label), ['Factors', 'Unit specs', 'Amenities']);
});

test('closed summaries use one line, or two on tight layouts so large text does not hide the values', () => {
  assert.deepEqual(ofType(render('about'), 'PreferenceCard').map(c => c.props.summaryLines), [1, 1, 1]);
  assert.deepEqual(ofType(render('about', {}, true), 'PreferenceCard').map(c => c.props.summaryLines), [2, 2, 2]);
});
