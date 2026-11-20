/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {BUDGET_RANGE_MESSAGE, BUDGET_SAVE_HINT, budgetRangeError} from '../src/features/search-discovery/models/MatchingPreferenceForm';
import {recommendedMatchingPreferences as base} from '../src/features/search-discovery/models/SearchDiscovery';
import {render as renderScreen} from './matchingPreferencesView.test';

function load(path: string) {
  const mod = {exports: {} as any};
  const mock = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : {type, props}); return {jsx, jsxs: jsx}; }
    if (key === 'react-native') return new Proxy({StyleSheet: {create: (x: any) => x}}, {get: (x: any, k) => x[k] ?? k});
    if (key.endsWith('/models/MatchingPreferenceForm')) return require('../src/features/search-discovery/models/MatchingPreferenceForm');
    if (/\/theme\//.test(key)) return new Proxy({}, {get: () => new Proxy({}, {get: () => 0})});
    return new Proxy({}, {get: (_x, k) => String(k)});
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(resolve(path), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText)(mock, mod, mod.exports);
  return mod.exports;
}
const {BudgetPreferences} = load('src/features/search-discovery/components/BudgetPreferences.tsx');
const nodes = (v: any): any[] => (v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : []);
const backwards = {...base, budgetMode: 'own' as const, minimumRent: 65000, maximumRent: 15000};

function budget(over: Record<string, unknown> = {}) {
  const calls: [string, unknown][] = [];
  const props = {mode: 'own', minimum: 15000, maximum: 65000, error: null, onMode: (m: string) => calls.push(['mode', m]), onMinimum: (a: number) => calls.push(['min', a]), onMaximum: (a: number) => calls.push(['max', a]), ...over};
  return {all: nodes(BudgetPreferences(props)), calls};
}

test('From higher than To is an error only while "I will enter my own" is chosen; equal, empty or estimate mode are fine', () => {
  assert.equal(budgetRangeError(backwards), BUDGET_RANGE_MESSAGE);
  assert.equal(budgetRangeError({...backwards, minimumRent: 15000}), null, 'equal is allowed');
  assert.equal(budgetRangeError({...backwards, maximumRent: 0}), null, 'an empty To means no upper limit');
  assert.equal(budgetRangeError({...backwards, minimumRent: 0}), null);
  assert.equal(budgetRangeError({...backwards, budgetMode: 'estimate'}), null, 'the fields are hidden, so they are not checked');
  assert.equal(budgetRangeError(base), null);
});

test('a backwards range turns both fields red, shows the message, and keeps the stored amounts as typed', () => {
  const h = budget({error: BUDGET_RANGE_MESSAGE, minimum: 65000, maximum: 15000});
  const inputs = h.all.filter(n => n.type === 'TextInput');
  assert.deepEqual(inputs.map(n => n.props.value), ['65,000', '15,000']);
  assert.deepEqual(inputs.map(n => n.props.accessibilityLabel), ['Minimum preferred monthly rent', 'Maximum preferred monthly rent']);
  const frames = h.all.filter(n => Array.isArray(n.props?.style) && n.props.style.length === 2 && n.props.style[1] && n.props.style[1] !== false);
  assert.ok(frames.length >= 2, 'both amount frames get the error style');
  assert.ok(h.all.some(n => n.props?.accessibilityRole === 'alert'));
  assert.ok(nodes(budget().all).every(n => n.props?.accessibilityRole !== 'alert'), 'no message when the range is fine');
});

test('the peso fields appear only for "I will enter my own"; choosing a mode never touches the amounts', () => {
  assert.equal(budget({mode: 'estimate'}).all.filter(n => n.type === 'TextInput').length, 0);
  assert.equal(budget({mode: 'own'}).all.filter(n => n.type === 'TextInput').length, 2);
  const h = budget({mode: 'own'});
  const radios = h.all.filter(n => n.props?.accessibilityRole === 'radio');
  assert.deepEqual(radios.map(n => n.props.accessibilityState.selected), [false, true]);
  radios[0].props.onPress(); radios[1].props.onPress();
  assert.deepEqual(h.calls, [['mode', 'estimate'], ['mode', 'own']], 'only the mode changes');
});

test('typing digits stores a number; other characters are ignored', () => {
  const h = budget();
  const [from, to] = h.all.filter(n => n.type === 'TextInput');
  from.props.onChangeText('₱ 20,500'); to.props.onChangeText('abc'); to.props.onChangeText('70000');
  assert.deepEqual(h.calls, [['min', 20500], ['max', 0], ['max', 70000]]);
});

test('with a backwards range Save is disabled and the hint shows; fixed, Save is enabled and the hint is gone', () => {
  const bad = renderScreen('budget', {matchingPreferences: backwards, matchingBudgetError: budgetRangeError(backwards)});
  const save = nodes(bad).find(n => n.type === 'AppButton' && n.props.label === 'Save preferences');
  assert.equal(save.props.disabled, true);
  assert.ok(nodes(bad).some(n => n.props?.children === BUDGET_SAVE_HINT));
  assert.equal(nodes(bad).find(n => n.type === 'BudgetPreferences').props.error, BUDGET_RANGE_MESSAGE);
  const fixed = renderScreen('budget', {matchingPreferences: base, matchingBudgetError: null});
  assert.equal(nodes(fixed).find(n => n.type === 'AppButton' && n.props.label === 'Save preferences').props.disabled, false);
  assert.ok(!nodes(fixed).some(n => n.props?.children === BUDGET_SAVE_HINT));
});

// The view model has no hook harness in this repo; like marketplaceWiring.test.ts this reads the function body. The disabled button above is the visible rule; this is the guard behind it.
test('saveMatchingPreferences refuses a backwards range even if called directly', () => {
  const vm = readFileSync(resolve('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts'), 'utf8');
  const body = vm.slice(vm.indexOf('const saveMatchingPreferences'), vm.indexOf('const skipMatchingIntroduction'));
  assert.match(body, /budgetRangeError\(matchingPreferences\)\) return;[\s\S]*onSavePreferences/);
});
