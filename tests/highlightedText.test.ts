/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { colors } from '../src/shared/theme/colors';
import { codePointToIndex, highlightSegments } from '../src/shared/models/ReviewWordCloud';

function load(): any {
  const mod = { exports: {} as any };
  const mock = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react-native') return { StyleSheet: { create: (x: any) => x }, Text: 'Text' };
    if (/\/theme\/(colors|ui)$/.test(key)) return require('../src/shared/theme/' + key.split('/').pop());
    throw new Error('unexpected import ' + key);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync('src/shared/components/HighlightedText.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(mock, mod, mod.exports);
  return mod.exports.HighlightedText;
}
const lum = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
const flat = (n: any): any[] => Array.isArray(n) ? n.flatMap(flat) : n && typeof n === 'object' ? [n, ...flat(n.props?.children)] : [];

test('the matched words are bold ink on the amber theme token, readable at 4.5:1 or better and clearly stronger than the old pale green', () => {
  const tree = load()({ segments: [{ text: 'Fast ', marked: false }, { text: 'wifi', marked: true }, { text: ', clean room', marked: false }] });
  const marked = flat(tree).filter(n => n.type === 'Text' && n.props.style?.backgroundColor)[0].props.style;
  assert.equal(marked.backgroundColor, colors.reviewOrange); assert.equal(marked.color, colors.ink); assert.equal(marked.fontWeight, '700', 'bold too, so the mark never relies on colour alone');
  assert.ok(contrast(marked.color, marked.backgroundColor) >= 4.5, `${contrast(marked.color, marked.backgroundColor).toFixed(2)}:1`);
  assert.ok(contrast(marked.backgroundColor, colors.background) > 1.5 * contrast(colors.primaryPale, colors.background), 'much easier to see on the white card than the old pale green');
  assert.doesNotMatch(readFileSync('src/shared/components/HighlightedText.tsx', 'utf8'), /#[0-9a-fA-F]{3,8}\b/, 'a theme token, not a hex value');
});
test('only the marked parts are shaded and the parts still join back to the exact text', () => {
  const segments = [{ text: 'Fast ', marked: false }, { text: 'wifi', marked: true }, { text: ', clean room', marked: false }];
  const shaded = flat(load()({ segments })).filter(n => n.type === 'Text' && n.props.style?.backgroundColor).map(n => n.props.children);
  assert.deepEqual(shaded, ['wifi']);
});
test('the span logic is unchanged: code point offsets still land on the right words after an emoji and a combining accent', () => {
  const text = '😀 cafe\u0301 wifi'; assert.equal(codePointToIndex(text, 8), 9);
  assert.deepEqual(highlightSegments(text, [{ start: 8, end: 12 }]).filter(p => p.marked).map(p => p.text), ['wifi']);
});
