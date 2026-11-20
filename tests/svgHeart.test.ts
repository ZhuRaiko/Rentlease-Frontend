/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {sharedStub} from './support/sharedStubs';

function load(path: string) {
  const file = resolve(path), actual = createRequire(file), m = {exports: {} as any};
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => (typeof type === 'function' ? type(props) : {type, props}); return {jsx, jsxs: jsx}; }
    if (/\/theme\/colors$/.test(key)) return actual(key);
    return sharedStub(file, key) ?? actual(key);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX}}).outputText)(req, m, m.exports);
  return m.exports;
}
const nodes = (v: any): any[] => (v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : []);
const {HeartIcon, HEART_PATH} = load('src/shared/components/HeartIcon.tsx');
const {StarMark, STAR_PATH} = load('src/features/search-discovery/components/ListingIcons.tsx');
const {colors} = load('src/shared/theme/colors.ts');
const path = (tree: any) => nodes(tree).find(n => n.type === 'Path').props;

test('the heart is the design pack shape on a 24 grid, and it is a real SVG', () => {
  const design = readFileSync('docs/design/discover-foryou/screens/HeartIcon.dc.html', 'utf8');
  assert.ok(design.includes(`d="${HEART_PATH}"`), 'same path as the design source');
  const tree = HeartIcon({}); assert.equal(tree.type, 'Svg'); assert.equal(tree.props.viewBox, '0 0 24 24');
  assert.doesNotMatch(readFileSync('src/shared/components/HeartIcon.tsx', 'utf8'), /rotate|borderRadius/, 'no View drawing left');
});
test('not saved: an ink outline with no fill; saved: filled green', () => {
  const outline = path(HeartIcon({filled: false, color: colors.ink})), saved = path(HeartIcon({filled: true, color: colors.primaryAction}));
  assert.deepEqual([outline.fill, outline.stroke, outline.strokeWidth], ['none', colors.ink, 1.8]);
  assert.deepEqual([saved.fill, saved.stroke], [colors.primaryAction, colors.primaryAction]);
  assert.equal(path(HeartIcon({})).fill, 'none', 'the default is the outline');
});
test('the heart scales with its size prop and stays out of the accessibility tree', () => {
  for (const size of [20, 24, 28, 32]) { const tree = HeartIcon({size}); assert.deepEqual([tree.props.width, tree.props.height], [size, size]); }
  const tree = HeartIcon({}); assert.equal(tree.props.accessible, false); assert.equal(tree.props.importantForAccessibility, 'no-hide-descendants');
});
test('the header heart is the outline in ink and the card heart switches on the saved state', () => {
  const header = readFileSync('src/features/search-discovery/views/TenantDiscoveryView.tsx', 'utf8');
  assert.match(header, /<HeartIcon color=\{colors\.ink\}\/>/);
  assert.doesNotMatch(header, /<HeartIcon filled/);
  const button = readFileSync('src/features/search-discovery/components/SaveListingButton.tsx', 'utf8');
  assert.match(button, /<HeartIcon filled=\{control\.saved===true\} color=\{disabled\?colors\.textMuted:control\.saved\?colors\.primaryAction:colors\.ink\}\/>/);
});
test('the Top match star is the design pack star, as an SVG', () => {
  const design = readFileSync('docs/design/discover-foryou/screens/ForYouRanked.dc.html', 'utf8');
  assert.ok(design.includes(`d="${STAR_PATH}"`)); const tree = StarMark({}); assert.equal(tree.type, 'Svg'); assert.equal(path(tree).fill, colors.white);
});
