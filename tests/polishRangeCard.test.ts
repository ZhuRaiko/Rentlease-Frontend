import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { LISTING_DISCLAIMER, RANGE_DISCLAIMER, SHOW_RANGE_LABEL, SLIDE_HINT } from '../src/shared/models/RentalRange';

const real: Record<string, string> = { Currency: 'src/shared/models/Currency.ts', RentalRange: 'src/shared/models/RentalRange.ts', colors: 'src/shared/theme/colors.ts', radius: 'src/shared/theme/radius.ts', spacing: 'src/shared/theme/spacing.ts' };
const cache: Record<string, any> = {};
function load(file: string): any {
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react') return { useState: (v: unknown) => [v, () => {}], useEffect() {} };
    if (key === 'react-native') return { Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (s: any) => s, absoluteFill: {} }, Text: 'Text', View: 'View', useWindowDimensions: () => ({ height: 800, width: 360 }) };
    const n = key.split('/').at(-1)!;
    if (n === 'ui') return { ui: {} };
    if (n === 'RangeSlider') return { RangeSlider: 'RangeSlider' };
    if (real[n]) return cache[n] ??= load(real[n]);
    return { [n]: n };
  };
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  return m.exports;
}
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const deepText = (v: any): string => (v == null || typeof v === 'boolean' ? '' : typeof v === 'object' ? [v.props?.children].flat(Infinity).map(deepText).join('') : String(v));
const Card = load('src/shared/components/RangeEstimateCard.tsx').RangeEstimateCard;
const range = { minimum: 8500, maximum: 16000 };
const texts = (tree: any) => nodes(tree).filter(n => n.type === 'Text').map(n => deepText(n));

test('the words', () => {
  assert.equal(SHOW_RANGE_LABEL, 'Show typical rent range');
  assert.equal(SLIDE_HINT, 'Slide along the range to try a price. It is an illustrative range from a model, not an appraisal.');
  assert.equal(LISTING_DISCLAIMER, 'An illustrative range from a model, not an appraisal or a guarantee.');
  assert.ok(SLIDE_HINT.includes(RANGE_DISCLAIMER.replace('Illustrative', 'illustrative').replace(/\.$/, '')), 'the hint carries the same disclaimer, in the same words');
});
test('the owner card (slider): one hint line, "Slide along the range…", instead of a second disclaimer line', () => {
  const t = texts(Card({ range, rent: null, onUseRent() {} }));
  assert.equal(t.filter(x => x === SLIDE_HINT).length, 1);
  assert.ok(!t.includes(RANGE_DISCLAIMER), 'not both');
});
test('a card without a slider keeps the short disclaimer; the tenant listing card says "or a guarantee"', () => {
  assert.ok(texts(Card({ range, rent: 13000 })).includes(RANGE_DISCLAIMER));
  const listing = texts(Card({ range, rent: 13000, subject: 'listing' }));
  assert.ok(listing.includes(LISTING_DISCLAIMER)); assert.ok(!listing.includes(RANGE_DISCLAIMER));
  assert.ok(!texts(Card({ range, rent: 13000, subject: 'listing' })).includes(SLIDE_HINT), 'a tenant is not told to slide');
});
test('the card heading can be left to the screen that already shows it', () => {
  const heading = (t: any) => nodes(t).filter(n => n.type === 'Text' && n.props.accessibilityRole === 'header').map(n => deepText(n));
  assert.deepEqual(heading(Card({ range, rent: 1 })), ['Typical rent for similar places']);
  assert.deepEqual(heading(Card({ range, rent: 1, showTitle: false })), []);
});
test('the on-demand button says the same thing in every variant, and nothing says "Estimate rental price" or "fairly priced"', () => {
  const src = readFileSync('src/shared/components/InlineRentalEstimate.tsx', 'utf8');
  assert.equal((src.match(/SHOW_RANGE_LABEL/g) ?? []).length, 5, 'the import and the four places it is used: tenant button, guidance and posting label and text, details button');
  assert.ok(!/Get Rental Price Estimate|Estimate Rental Price|Estimate rental price|Get typical rent range|Rental intelligence|fairly priced/.test(src));
  assert.match(src, /Retry estimate/, 'a retry keeps its own wording');
});
