/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {sharedStub} from './support/sharedStubs';

// The card heart (SaveListingButton) rendered with stand-in children: HeartIcon is an element named after itself, so its props can be read.
function load() {
  const file = resolve('src/features/search-discovery/components/SaveListingButton.tsx'), actual = createRequire(file), m = {exports: {} as any};
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : {type, props}); return {jsx, jsxs: jsx}; }
    if (key === 'react-native') return {ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View'};
    if (key.endsWith('/HeartIcon')) return {HeartIcon: 'HeartIcon'};
    return sharedStub(file, key) ?? actual(key);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText)(req, m, m.exports);
  return m.exports.SaveListingButton;
}
const SaveListingButton = load();
const nodes = (v: any): any[] => (v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : []);
const control = (over: object) => ({saved: false, busy: false, locked: false, retry: false, desired: undefined, onPress() {}, ...over});
const render = (over: object) => { const tree = SaveListingButton({control: control(over)}); return {button: tree, heart: nodes(tree).find(n => n.type === 'HeartIcon')}; };

test('not saved: outline heart, "Save listing", not selected', () => {
  const {button, heart} = render({saved: false});
  assert.equal(button.props.accessibilityLabel, 'Save listing'); assert.equal(button.props.accessibilityState.selected, false);
  assert.equal(heart.props.filled, false); assert.notEqual(heart.props.color, undefined);
});
test('saved: filled green heart, "Remove from Saved Listings", selected', () => {
  const unsaved = render({saved: false}).heart, {button, heart} = render({saved: true});
  assert.equal(button.props.accessibilityLabel, 'Remove from Saved Listings'); assert.equal(button.props.accessibilityState.selected, true);
  assert.equal(heart.props.filled, true); assert.notEqual(heart.props.color, unsaved.props.color, 'saved is green, not the ink outline colour');
});
test('unknown, busy, locked and retry states keep their own labels and disable the target', () => {
  assert.equal(render({saved: undefined}).button.props.accessibilityLabel, 'Checking saved status'); assert.equal(render({saved: undefined}).button.props.disabled, true);
  assert.equal(render({saved: false, busy: true}).button.props.disabled, true);
  assert.equal(render({saved: false, locked: true}).button.props.disabled, true);
  assert.equal(render({saved: false, retry: true, desired: true}).button.props.accessibilityLabel, 'Retry saving listing');
  assert.equal(render({saved: true, retry: true, desired: false}).button.props.accessibilityLabel, 'Retry removing saved listing');
});
test('the card heart keeps a 48dp target and the white circle; the header heart is always the outline and opens Saved listings', () => {
  const {button} = render({saved: true}); assert.equal(button.props.style.minWidth, 48); assert.equal(button.props.style.minHeight, 48); assert.equal(button.props.style.borderRadius, 24); assert.ok(button.props.style.backgroundColor);
  const header = readFileSync('src/features/search-discovery/views/TenantDiscoveryView.tsx', 'utf8');
  assert.match(header, /accessibilityLabel="Open Saved Listings"[^>]*onPress=\{viewModel\.openSavedListings\}[^>]*><HeartIcon color=\{colors\.ink\}\/>/);
  assert.doesNotMatch(header, /<HeartIcon filled/);
});
