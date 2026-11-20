/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {canMoveDown, canMoveUp, dragTarget, rankingTabs} from '../src/features/search-discovery/models/MatchingPreferenceForm';
import {recommendedMatchingPreferences as base} from '../src/features/search-discovery/models/SearchDiscovery';

// RankingList with stand-in children and a minimal hooks stub (no re-render: only the first render's tree and handlers are inspected).
function load() {
  const mod = {exports: {} as any};
  const mock = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : {type, props}); return {jsx, jsxs: jsx}; }
    if (key === 'react') return {useRef: (value: unknown) => ({current: value}), useState: (init: any) => [typeof init === 'function' ? init() : init, () => {}]};
    if (key === 'react-native') return new Proxy({StyleSheet: {create: (x: any) => x}, PanResponder: {create: (config: unknown) => ({panHandlers: {config}})}}, {get: (x: any, k) => x[k] ?? k});
    if (key.endsWith('/models/MatchingPreferenceForm')) return require('../src/features/search-discovery/models/MatchingPreferenceForm');
    if (/\/theme\//.test(key)) return new Proxy({}, {get: () => new Proxy({}, {get: () => 0})});
    return new Proxy({}, {get: (_x, k) => String(k)});
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(resolve('src/features/search-discovery/components/RankingList.tsx'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText)(mock, mod, mod.exports);
  return mod.exports;
}
const {RankingList} = load();
const nodes = (v: any): any[] => (v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : []);
function render(values: readonly string[]) {
  const moves: [number, number][] = [];
  return {all: nodes(RankingList({values, onMove: (index: number, direction: number) => moves.push([index, direction])})), moves};
}
const buttons = (all: any[], word: 'up' | 'down') => all.filter(n => n.type === 'Pressable' && n.props.accessibilityLabel?.endsWith(` ${word}`));

for (const tab of rankingTabs) {
  test(`${tab.label}: the first Up and the last Down are disabled, every other arrow works`, () => {
    const values = base[tab.field], h = render(values);
    const up = buttons(h.all, 'up'), down = buttons(h.all, 'down');
    assert.equal(up.length, values.length);
    assert.deepEqual(up.map(n => n.props.disabled), values.map((_, i) => i === 0));
    assert.deepEqual(down.map(n => n.props.disabled), values.map((_, i) => i === values.length - 1));
    assert.deepEqual(up.map(n => n.props.accessibilityLabel), values.map(v => `Move ${v} up`), 'the existing accessible labels');
    down[0].props.onPress(); up[1].props.onPress();
    assert.deepEqual(h.moves, [[0, 1], [1, -1]]);
  });
}

test('the three tabs are Factors, Unit specs and Amenities, each bound to its own ranking', () => {
  assert.deepEqual(rankingTabs.map(t => [t.label, t.field]), [['Factors', 'factorRanking'], ['Unit specs', 'unitSpecificationRanking'], ['Amenities', 'amenityRanking']]);
  assert.equal(canMoveUp(0), false); assert.equal(canMoveUp(1), true);
  assert.equal(canMoveDown(3, 4), false); assert.equal(canMoveDown(2, 4), true);
});

test('drag: a row lands where it was dragged to, stays inside the list, and a tiny drag moves nothing', () => {
  assert.equal(dragTarget(1, 130, 64, 4), 3);
  assert.equal(dragTarget(1, -70, 64, 4), 0);
  assert.equal(dragTarget(3, 500, 64, 4), 3, 'not past the last row');
  assert.equal(dragTarget(0, -500, 64, 4), 0, 'not above the first row');
  assert.equal(dragTarget(2, 20, 64, 4), 2);
});

test('releasing a dragged handle moves the row with the same adjacent moves the arrows use', () => {
  const moves: [number, number][] = [];
  const list = nodes(RankingList({values: base.factorRanking, onMove: (index: number, direction: number) => moves.push([index, direction])}));
  const configs = list.filter(n => n.props && n.props.config).map(n => n.props.config);
  assert.equal(configs.length, 4, 'every row has a drag handle');
  configs[0].onPanResponderRelease({}, {dy: 130});
  assert.deepEqual(moves, [[0, 1], [1, 1]], 'first row dragged two rows down');
  moves.length = 0;
  configs[3].onPanResponderRelease({}, {dy: -70});
  assert.deepEqual(moves, [[3, -1]]);
  moves.length = 0;
  configs[1].onPanResponderTerminate();
  assert.deepEqual(moves, [], 'a cancelled drag moves nothing');
});
