/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { sharedStub } from './support/sharedStubs';

function load(path: string, name: string): any {
  const file = resolve(path), actual = createRequire(file), mod = { exports: {} as any };
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : { type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react-native') return { StyleSheet: { create: (x: any) => x }, Text: 'Text', View: 'View', Pressable: 'Pressable' };
    return sharedStub(file, key) ?? actual(key);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, mod, mod.exports);
  return mod.exports[name];
}
const all = (n: any): any[] => Array.isArray(n) ? n.flatMap(all) : n && typeof n === 'object' ? [n, ...all(n.props?.children)] : [];
const texts = (n: any) => all(n).filter(x => x.type === 'Text').map(x => [x.props.children].flat(Infinity).join(''));

test('Tags tenants picked: the title, the note, and a read-only chip per tag with how many reviews chose it', () => {
  const Card = load('src/shared/components/ReviewTagsCard.tsx', 'ReviewTagsCard');
  const tree = Card({ tags: [{ code: 'clean', label: 'Clean', count: 12 }, { code: 'wifi', label: 'Good wifi', count: 1 }] }), t = texts(tree);
  for (const s of ['Tags tenants picked', 'From the review form. The number is how many reviews chose it.', 'Clean', '12', 'Good wifi', '1']) assert.ok(t.includes(s), s);
  const chips = all(tree).filter(n => n.props?.accessibilityLabel);
  assert.deepEqual(chips.map(n => n.props.accessibilityLabel), ['Clean, chosen in 12 reviews', 'Good wifi, chosen in 1 review']);
  assert.ok(chips.every(n => n.props.accessible === true));
  assert.equal(all(tree).filter(n => n.type === 'Pressable').length, 0, 'the tags have no tap behavior, so they are not buttons');
});
test('Tags tenants picked: nothing is drawn when there are no tags', () => {
  assert.equal(load('src/shared/components/ReviewTagsCard.tsx', 'ReviewTagsCard')({ tags: [] }), null);
});
test('the cloud icons are SVG drawings hidden from screen readers (the text or button beside them carries the meaning)', () => {
  const file = 'src/shared/components/ReviewCloudIcons.tsx';
  for (const name of ['CheckIcon', 'CloseIcon', 'ChatIcon', 'OfflineIcon']) {
    const tree = load(file, name)({});
    assert.equal(tree.type, 'Svg', name); assert.equal(tree.props.accessible, false, name); assert.equal(tree.props.importantForAccessibility, 'no-hide-descendants', name); assert.equal(tree.props.viewBox, '0 0 24 24', name);
  }
});
