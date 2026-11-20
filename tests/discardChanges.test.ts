/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
import {preferencesChanged} from '../src/features/search-discovery/models/MatchingPreferenceForm';
import {recommendedMatchingPreferences as base} from '../src/features/search-discovery/models/SearchDiscovery';
import {createNavigationConfirmation} from '../src/shared/viewModels/navigationConfirmation';
import {render as renderScreen} from './matchingPreferencesView.test';

function load(path: string, hooks: Record<string, unknown> = {}) {
  const mod = {exports: {} as any};
  const mock = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : {type, props}); return {jsx, jsxs: jsx}; }
    if (key === 'react-native') return new Proxy({StyleSheet: {create: (x: any) => x}}, {get: (x: any, k) => x[k] ?? k});
    if (key === 'react-native-safe-area-context') return {useSafeAreaInsets: () => ({bottom: 24, top: 0, left: 0, right: 0})};
    if (/\/theme\//.test(key)) return new Proxy({}, {get: () => new Proxy({}, {get: () => 0})});
    return new Proxy({}, {get: (_x, k) => String(k)});
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(resolve(path), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText)(mock, mod, mod.exports);
  return mod.exports;
}
const {DiscardSheet} = load('src/features/search-discovery/components/DiscardSheet.tsx');
const nodes = (v: any): any[] => (v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : []);
const texts = (tree: any[]) => tree.flatMap(n => [n.props?.children].flat(Infinity)).filter(c => typeof c === 'string');

// The same guard the screen uses (useNavigationConfirmation wraps it), with the same "changed" rule as the view model.
function screenGuard() {
  let current = base, saved = base;
  const guard = createNavigationConfirmation(() => preferencesChanged(current, saved));
  return {guard, edit: (change: Partial<typeof base>) => { current = {...current, ...change}; }, save: () => { saved = current; }};
}

test('Close with nothing changed closes right away, with no question', () => {
  const s = screenGuard(); let closed = 0;
  s.guard.request(() => closed++);
  assert.equal(closed, 1);
  assert.equal(s.guard.getSnapshot(), false);
});

test('Close after a change asks first: Keep editing stays, Discard changes goes on with the close', () => {
  const s = screenGuard(); let closed = 0;
  s.edit({minimumBedrooms: 3});
  s.guard.request(() => closed++);
  assert.equal(closed, 0);
  assert.equal(s.guard.getSnapshot(), true, 'the sheet is shown');
  s.guard.cancel();
  assert.deepEqual([closed, s.guard.getSnapshot()], [0, false], 'Keep editing: still here, sheet gone');
  s.guard.request(() => closed++);
  s.guard.confirm();
  assert.equal(closed, 1, 'Discard changes closes');
});

test('after a save, or after an edit is undone, nothing is "changed" any more', () => {
  const s = screenGuard(); let closed = 0;
  s.edit({city: 'Tagaytay'}); s.save();
  s.guard.request(() => closed++);
  assert.equal(closed, 1, 'saved: closes right away');
  s.edit({city: 'Imus'});
  s.edit({city: 'Tagaytay'});
  s.guard.request(() => closed++);
  assert.equal(closed, 2, 'back to the saved values: closes right away');
});

test('the sheet reads "Discard your changes?" with Keep editing and Discard changes, and both buttons are wired', () => {
  let kept = 0, discarded = 0;
  const tree = nodes(DiscardSheet({visible: true, onKeep: () => kept++, onDiscard: () => discarded++}));
  assert.ok(texts(tree).includes('Discard your changes?'));
  assert.ok(texts(tree).includes('You changed some preferences and haven’t saved them yet.'));
  assert.equal(tree.find(n => n.type === 'Modal').props.visible, true);
  tree.find(n => n.type === 'AppButton' && n.props.label === 'Keep editing').props.onPress();
  tree.find(n => n.type === 'Pressable' && nodes(n).some(c => c.props?.children === 'Discard changes')).props.onPress();
  assert.deepEqual([kept, discarded], [1, 1]);
  assert.equal(nodes(DiscardSheet({visible: false, onKeep() {}, onDiscard() {}})).find(n => n.type === 'Modal').props.visible, false);
});

test('the screen shows the sheet exactly when the view model has a pending close, and Back or a tap outside keeps editing', () => {
  let kept = 0, discarded = 0;
  const handlers = {cancelNavigation: () => kept++, confirmNavigation: () => discarded++};
  const shown = nodes(renderScreen('about', {...handlers, navigationConfirmation: true})).find(n => n.type === 'DiscardSheet');
  assert.equal(shown.props.visible, true);
  shown.props.onKeep(); shown.props.onDiscard();
  assert.deepEqual([kept, discarded], [1, 1]);
  assert.equal(nodes(renderScreen('about', {...handlers, navigationConfirmation: false})).find(n => n.type === 'DiscardSheet').props.visible, false);
});
