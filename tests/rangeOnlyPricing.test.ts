import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
  RANGE_DISCLAIMER, RANGE_HALF_WIDTH, RANGE_ROUNDING, RELATION_HELP, RELATION_TEXT, SLIDER_STEP, ballValue, fractionOfValue, listingRelationSentence, pickedAfterRentChange,
  rangeRelation, rangeRelationText, roundRangeOutward, snapToStep, stepSliderValue, valueAtFraction,
} from '../src/shared/models/RentalRange';
import { parseModelPrediction, parsePredictionReceipt } from '../src/shared/models/RentalPrediction';

const range = { minimum: 8500, maximum: 16000 };

// ---- 2. Rounding, one constant
test('the band half-width, the rounding and the step are single named constants', () => {
  assert.equal(RANGE_HALF_WIDTH, 0.3);
  assert.equal(RANGE_ROUNDING, 500);
  assert.equal(SLIDER_STEP, 500);
  assert.equal(RANGE_DISCLAIMER, 'Illustrative range from a model, not an appraisal.');
  const model = readFileSync('src/shared/models/RentalPrediction.ts', 'utf8');
  assert.ok(!/\.7\b|\*\s*1\.3\b|\*\.7|\*1\.3/.test(model.replace(/\/\/.*$/gm, '')), 'no literal 0.7 or 1.3 band left in the parse layer');
  assert.match(model, /1-RANGE_HALF_WIDTH/);
  assert.match(model, /1\+RANGE_HALF_WIDTH/);
});
test('range ends round outward to 500: the low end down, the high end up, exact multiples unchanged', () => {
  assert.deepEqual(roundRangeOutward(15703.35, 29163.36), { minimum: 15500, maximum: 29500 });
  assert.deepEqual(roundRangeOutward(8223.37, 15271.97), { minimum: 8000, maximum: 15500 });
  assert.deepEqual(roundRangeOutward(8500, 16000), { minimum: 8500, maximum: 16000 });
  assert.deepEqual(roundRangeOutward(8500.01, 15999.99), { minimum: 8500, maximum: 16000 });
  assert.deepEqual(roundRangeOutward(8499.99, 16000.01), { minimum: 8000, maximum: 16500 });
  assert.deepEqual(roundRangeOutward(70, 130), { minimum: 0, maximum: 500 });
  const r = roundRangeOutward(123456.78, 234567.89);
  assert.ok(r.minimum <= 123456.78 && r.maximum >= 234567.89, 'the shown range always contains the model band');
  assert.ok(r.minimum % 500 === 0 && r.maximum % 500 === 0);
});

// ---- 1. The parse layer drops the point value
const target = { propertyId: '10000000-0000-4000-8000-000000000001' };
const wire = (over: Record<string, unknown> = {}) => ({ target, estimatedMonthlyRent: 22433.35, currency: 'PHP', modelVersion: 'development-v1', askingRent: 22000, predictedAt: '2026-11-08T00:00:00Z', illustrativeRange: { minimum: 15703.35, maximum: 29163.36 }, ...over });
test('the app model of an estimate has no point value, and its range is rounded outward', () => {
  const ui = parsePredictionReceipt(wire(), target);
  assert.equal('estimatedMonthlyRent' in ui, false);
  assert.deepEqual(ui.illustrativeRange, { minimum: 15500, maximum: 29500 });
  assert.equal(ui.askingRent, 22000);
  const json = JSON.stringify(ui);
  assert.ok(!json.includes('22433') && !json.includes('estimatedMonthlyRent'), 'the point value is not anywhere in the model');
});
test('the point value is still checked against the range before it is dropped', () => {
  assert.equal(parsePredictionReceipt(wire({ illustrativeRange: { minimum: 1, maximum: 999999 } }), target).illustrativeRange, null);
  assert.equal(parsePredictionReceipt(wire({ illustrativeRange: { minimum: 15703.35, maximum: 29163.36 }, estimatedMonthlyRent: 10000 }), target).illustrativeRange, null, 'a band that is not the point plus and minus the half-width is refused');
  assert.equal(parsePredictionReceipt(wire({ illustrativeRange: undefined }), target).illustrativeRange, null);
  assert.throws(() => parsePredictionReceipt(wire({ estimatedMonthlyRent: -1 }), target));
  assert.throws(() => parsePredictionReceipt(wire({ estimatedMonthlyRent: undefined }), target));
});
test('the Edge function contract is untouched: the shared wire parser still returns the point and the exact band', () => {
  const wireModel = parseModelPrediction({ estimated_rent_monthly: 22433.35, range_min: 15703.35, range_max: 29163.36, currency: 'PHP', model_version: 'development-v1' });
  assert.equal(wireModel.estimatedMonthlyRent, 22433.35);
  assert.deepEqual(wireModel.illustrativeRange, { minimum: 15703.35, maximum: 29163.36 });
  const handler = readFileSync('supabase/functions/rental-price-estimate/handler.ts', 'utf8');
  assert.match(handler, /parseModelPrediction/);
  assert.match(readFileSync('src/shared/models/RentalPrediction.ts', 'utf8'), /from '\.\/RentalRange\.ts'/, 'Deno needs the explicit extension on the one new import');
});
const walk = (dir: string, ext: RegExp): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p, ext) : ext.test(p) ? [p] : []; });
test('no screen, ViewModel or component reads the point value, and its wording is gone from the screens', () => {
  const files = walk('src', /\.(ts|tsx)$/).filter(f => !f.endsWith('database.types.ts'));
  const readers = files.filter(f => /estimatedMonthlyRent|estimated_rent_monthly/.test(readFileSync(f, 'utf8'))).map(f => f.replace(/\\/g, '/'));
  assert.deepEqual(readers, ['src/shared/models/RentalPrediction.ts'], 'only the parse layer touches the point value');
  const screens = files.filter(f => f.endsWith('.tsx'));
  const bad = /Use estimate|model estimate|Model estimate|XGBoost estimated|Estimated monthly rent|Predicted monthly rent|point estimate|Model's point|above the estimate|below the estimate|Matches the estimate/;
  assert.deepEqual(screens.filter(f => bad.test(readFileSync(f, 'utf8'))), []);
  assert.deepEqual(screens.filter(f => /XGBoost/.test(readFileSync(f, 'utf8'))).map(f => f.replace(/\\/g, '/')), ['src/shared/components/RangeEstimateCard.tsx'], 'the model is named only in the "How is this estimated?" explanation');
});

// ---- 3. Relation text
test('relation text compares the rent only with the ends of the range, ends inclusive', () => {
  assert.equal(rangeRelation(13000, range), 'within');
  assert.equal(rangeRelation(8500, range), 'within');
  assert.equal(rangeRelation(16000, range), 'within');
  assert.equal(rangeRelation(8499.99, range), 'below');
  assert.equal(rangeRelation(16000.01, range), 'above');
  assert.equal(rangeRelationText(19500, range), 'Above the typical range');
  assert.equal(rangeRelationText(5000, range), 'Below the typical range');
  assert.equal(rangeRelationText(13000, range), 'Within the typical range');
  for (const bad of [0, -5, NaN, Infinity, null, undefined]) assert.equal(rangeRelation(bad as any, range), null, String(bad));
  assert.equal(rangeRelation(13000, null), null);
  assert.equal(rangeRelation(13000, undefined), null);
  assert.deepEqual(RELATION_TEXT, { within: 'Within the typical range', above: 'Above the typical range', below: 'Below the typical range' });
  assert.equal(RELATION_HELP.within, null);
  assert.match(RELATION_HELP.above!, /ask for more/);
});
test('the tenant sentence names the listing', () => {
  assert.equal(listingRelationSentence(13000, range), 'This listing is within the typical range');
  assert.equal(listingRelationSentence(19500, range), 'This listing is above the typical range');
  assert.equal(listingRelationSentence(5000, range), 'This listing is below the typical range');
  assert.equal(listingRelationSentence(null, range), null);
  assert.equal(listingRelationSentence(13000, null), null);
});

// ---- 3. Slider value math
test('slider values clamp to the range and snap to 500 from the low end', () => {
  assert.equal(valueAtFraction(0, range), 8500);
  assert.equal(valueAtFraction(1, range), 16000);
  assert.equal(valueAtFraction(-3, range), 8500);
  assert.equal(valueAtFraction(7, range), 16000);
  assert.equal(valueAtFraction(NaN, range), 8500);
  assert.equal(valueAtFraction(0.5, range), 12500, '3750 along the track rounds to the nearest step');
  assert.equal(valueAtFraction(0.49, range), 12000);
  for (let f = 0; f <= 1.0001; f += 0.013) { const v = valueAtFraction(f, range); assert.ok(v >= 8500 && v <= 16000 && (v - 8500) % 500 === 0, String(f)); }
  const odd = { minimum: 8300, maximum: 15800 };
  assert.equal(valueAtFraction(0.5, odd), 12300, 'steps are measured from the low end of whatever range is shown');
  assert.equal(snapToStep(13111, range), 13000);
  assert.equal(snapToStep(99999, range), 16000);
  assert.equal(snapToStep(1, range), 8500);
  assert.equal(fractionOfValue(8500, range), 0);
  assert.equal(fractionOfValue(16000, range), 1);
  assert.equal(fractionOfValue(19500, range), 1, 'a typed rent above the range sits at the high end');
  assert.equal(fractionOfValue(100, range), 0);
  assert.equal(fractionOfValue(12250, range), 0.5);
});
test('the first step from an unset slider lands on a range end, never on the middle', () => {
  assert.equal(stepSliderValue(null, 1, range), 8500);
  assert.equal(stepSliderValue(null, -1, range), 16000);
  assert.equal(stepSliderValue(NaN, 1, range), 8500);
  assert.equal(stepSliderValue(12000, 1, range), 12500);
  assert.equal(stepSliderValue(12000, -1, range), 11500);
  assert.equal(stepSliderValue(16000, 1, range), 16000, 'clamped at the top');
  assert.equal(stepSliderValue(8500, -1, range), 8500, 'clamped at the bottom');
  assert.equal(stepSliderValue(12100, 1, range), 12500, 'an off-step value snaps first');
});
test('the ball: hidden with nothing, follows a typed rent, a trial value lasts only while it is the one being tried', () => {
  assert.equal(ballValue(null, null), null);
  assert.equal(ballValue(null, 0), null);
  assert.equal(ballValue(null, 13000), 13000);
  assert.equal(ballValue(14500, 13000), 14500);
  assert.equal(pickedAfterRentChange(14500, 14500), 14500, 'applying the trial value keeps it');
  assert.equal(pickedAfterRentChange(14500, 13000), null, 'typing something else hands the ball back');
  assert.equal(pickedAfterRentChange(null, 13000), null);
});

// ---- Rendering harness: real range model, money, tokens and the real components, with named stubs for the rest
const realFiles: Record<string, string> = { Currency: 'src/shared/models/Currency.ts', RentalRange: 'src/shared/models/RentalRange.ts', colors: 'src/shared/theme/colors.ts', spacing: 'src/shared/theme/spacing.ts', radius: 'src/shared/theme/radius.ts' };
const cache: Record<string, any> = {};
function load(file: string, reactStub: any): any {
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react') return reactStub;
    if (key === 'react-native') return { Text: 'Text', View: 'View', Pressable: 'Pressable', Modal: 'Modal', ScrollView: 'ScrollView', StyleSheet: { create: (s: any) => s, absoluteFill: {} }, useWindowDimensions: () => ({ height: 800, width: 360 }), PanResponder: { create: (cfg: any) => ({ panHandlers: cfg }) } };
    const n = key.split('/').at(-1)!;
    if (n === 'ui') return { ui: {} };
    if (n === 'RangeSlider') return { RangeSlider: 'RangeSlider' };
    if (realFiles[n]) return cache[n] ??= load(realFiles[n], reactStub);
    return { [n]: n };
  };
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  return m.exports;
}
const expand = (v: any): any => (v && typeof v === 'object' ? (typeof v.type === 'function' ? expand(v.type(v.props)) : { ...v, props: { ...v.props, children: [v.props?.children].flat(Infinity).map(expand) } }) : v);
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const textOf = (tree: any) => nodes(tree).filter(n => n.type === 'Text').map(n => [n.props.children].flat(Infinity).join('')).join(' | ');
const flat = (style: any) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
const sliderReact = { useState: (init: unknown) => [typeof init === 'number' ? 300 : init, () => {}], useRef: (init: unknown) => ({ current: init }), useEffect() {} };
const cardReact = { useState: (init: unknown) => [init, () => {}], useRef: (init: unknown) => ({ current: init }), useEffect() {} };
const slider = (props: any) => load('src/shared/components/RangeSlider.tsx', sliderReact).RangeSlider({ range, onChange() {}, onUse() {}, ...props });
const card = (props: any) => expand(load('src/shared/components/RangeEstimateCard.tsx', cardReact).RangeEstimateCard({ range, ...props }));

test('the slider starts unset: no ball and no bubble, so its start cannot hint at the middle', () => {
  const t = slider({ value: null });
  assert.ok(!nodes(t).some(n => n.type === 'View' && flat(n.props.style).borderRadius === 16 && flat(n.props.style).position === 'absolute' && flat(n.props.style).width === 32), 'no thumb');
  assert.ok(!/₱\d/.test(textOf(t).replace(/₱8,500|₱16,000/g, '')), 'no bubble value, only the two ends');
  const set = slider({ value: 12500 });
  assert.match(textOf(set), /₱12,500/);
  assert.ok(nodes(set).some(n => n.type === 'View' && flat(n.props.style).width === 32 && flat(n.props.style).height === 32));
});
test('the slider is adjustable for TalkBack, with 500-peso increment and decrement and 48dp targets', () => {
  const changes: number[] = [];
  const t = slider({ value: 12500, onChange: (v: number) => changes.push(v) }), touch = nodes(t).find(n => n.props?.testID === 'range-slider-touch');
  assert.equal(touch.props.accessibilityRole, 'adjustable');
  assert.deepEqual(touch.props.accessibilityValue, { min: 8500, max: 16000, text: '₱12,500', now: 12500 });
  assert.deepEqual(touch.props.accessibilityActions.map((a: any) => a.name), ['increment', 'decrement']);
  touch.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
  touch.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
  assert.deepEqual(changes, [13000, 12000]);
  assert.ok(flat(touch.props.style).height >= 48);
  const unset = nodes(slider({ value: null })).find(n => n.props?.testID === 'range-slider-touch');
  assert.deepEqual(unset.props.accessibilityValue, { min: 8500, max: 16000, text: 'Not set' });
  const buttons = nodes(t).filter(n => n.type === 'Pressable');
  assert.equal(buttons.length, 3);
  for (const b of buttons) assert.ok(flat(b.props.style).minHeight >= 48, b.props.accessibilityLabel);
  assert.ok(flat(buttons[0].props.style).width >= 48 && flat(buttons[2].props.style).width >= 48);
});
test('minus and plus step the value; Use applies it; Use is disabled until a value exists', () => {
  const changes: number[] = [], used: number[] = [];
  const t = slider({ value: 12500, onChange: (v: number) => changes.push(v), onUse: (v: number) => used.push(v) }), [minus, use, plus] = nodes(t).filter(n => n.type === 'Pressable');
  minus.props.onPress(); plus.props.onPress(); use.props.onPress();
  assert.deepEqual(changes, [12000, 13000]);
  assert.deepEqual(used, [12500]);
  assert.equal(use.props.accessibilityLabel, 'Use ₱12,500');
  const none: number[] = [], u2: number[] = [];
  const s = slider({ value: null, onChange: (v: number) => none.push(v), onUse: (v: number) => u2.push(v) }), [m2, use2, p2] = nodes(s).filter(n => n.type === 'Pressable');
  assert.equal(use2.props.disabled, true);
  assert.match(textOf(s), /Slide to pick a rent/);
  m2.props.onPress(); p2.props.onPress(); use2.props.onPress?.();
  assert.deepEqual(none, [16000, 8500], 'the first minus goes to the top end, the first plus to the bottom end');
  assert.deepEqual(u2, []);
  const off = slider({ value: 12500, disabled: true, onChange: (v: number) => none.push(v) });
  nodes(off).filter(n => n.type === 'Pressable')[0].props.onPress();
  assert.equal(none.length, 2, 'a disabled slider changes nothing');
});
test('dragging maps the touch to a clamped, stepped rent', () => {
  const changes: number[] = [];
  const t = slider({ value: null, onChange: (v: number) => changes.push(v) }), h = nodes(t).find(n => n.props?.testID === 'range-slider-touch').props;
  assert.equal(typeof h.onPanResponderGrant, 'function');
  assert.equal(h.onPanResponderTerminationRequest(), false);
  h.onPanResponderGrant({ nativeEvent: { locationX: 16 } }); // the left end of the track (the touch area starts 16 before it)
  h.onPanResponderGrant({ nativeEvent: { locationX: 16 + 300 } }); // the right end
  h.onPanResponderGrant({ nativeEvent: { locationX: 0 } }); // left of the track
  h.onPanResponderGrant({ nativeEvent: { locationX: 600 } }); // right of the track
  assert.deepEqual(changes, [8500, 16000, 8500, 16000]);
  changes.length = 0;
  h.onPanResponderGrant({ nativeEvent: { locationX: 16 } });
  h.onPanResponderMove({}, { dx: 150 });
  h.onPanResponderMove({}, { dx: 900 });
  h.onPanResponderMove({}, { dx: -900 });
  assert.deepEqual(changes, [8500, 12500, 16000, 8500]);
  changes.length = 0;
  h.onPanResponderGrant({ nativeEvent: { locationX: 16 + 150 } }); // start mid-track: a drag moves from where it began
  h.onPanResponderMove({}, { dx: 75 });
  h.onPanResponderMove({}, { dx: -150 });
  assert.deepEqual(changes, [12500, valueAtFraction(225 / 300, range), 8500]);
});
test('a disabled slider ignores touches', () => {
  const changes: number[] = [];
  const h = nodes(slider({ value: null, disabled: true, onChange: (v: number) => changes.push(v) })).find(n => n.props?.testID === 'range-slider-touch').props;
  assert.equal(h.onStartShouldSetPanResponder(), false);
  assert.equal(h.onMoveShouldSetPanResponder(), false);
});

// ---- 3. Warning tokens, read-only bar, the explanation
test('above and below the range use the warning tokens, within uses the brand color, and nothing uses an error color', () => {
  const color = (rent: number) => { const t = card({ rent }); const n = nodes(t).find(x => x.type === 'Text' && /typical range$/.test([x.props.children].flat().join(''))); return flat(n.props.style).color; };
  assert.equal(color(19500), '#9A6414');
  assert.equal(color(5000), '#9A6414');
  assert.equal(color(13000), '#32743C');
  const src = readFileSync('src/shared/components/RangeEstimateCard.tsx', 'utf8') + readFileSync('src/shared/components/RangeSlider.tsx', 'utf8');
  assert.ok(!/colors\.restricted|restrictedSurface/.test(src));
  const marker = nodes(card({ rent: 19500 })).find(n => n.props?.testID === 'range-rent-marker');
  assert.equal(flat(marker.props.style).backgroundColor, '#9A6414');
  assert.equal(flat(nodes(card({ rent: 13000 })).find(n => n.props?.testID === 'range-rent-marker').props.style).backgroundColor, '#32743C');
});
test('the card: read-only bar without an apply action, slider with one, relation sentence, disclaimer and the explanation link', () => {
  const ro = card({ rent: 13000 });
  assert.ok(!nodes(ro).some(n => n.type === 'RangeSlider'));
  assert.match(textOf(ro), /Typical rent for similar places/);
  assert.match(textOf(ro), /Within the typical range/);
  assert.match(textOf(ro), /Illustrative range from a model, not an appraisal\./);
  assert.match(textOf(ro), /How is this estimated\?/);
  const marker = nodes(ro).find(n => n.props?.testID === 'range-rent-marker');
  assert.equal(flat(marker.props.style).left, `${fractionOfValue(13000, range) * 100}%`);
  const used: number[] = [], owner = card({ rent: 19500, onUseRent: (r: number) => used.push(r) });
  const s = nodes(owner).find(n => n.type === 'RangeSlider');
  assert.deepEqual(s.props.range, range);
  assert.equal(s.props.value, 19500, 'the ball follows the typed rent');
  s.props.onUse(14500);
  assert.deepEqual(used, [14500]);
  assert.match(textOf(owner), /Above the typical range/);
  assert.match(textOf(owner), /ask for more/);
  assert.equal(s.props.tone, 'warning');
  const tenant = card({ rent: 13000, subject: 'listing' });
  assert.match(textOf(tenant), /This listing is within the typical range/);
  assert.ok(!/ask for more/.test(textOf(card({ rent: 19500, subject: 'listing' }))), 'the owner advice is not shown to tenants');
  const none = card({ rent: null });
  assert.ok(!/typical range$/.test(textOf(none).split(' | ').filter(x => /^(Within|Above|Below)/.test(x)).join('')), 'no relation without a rent');
  assert.ok(!nodes(none).some(n => n.props?.testID === 'range-rent-marker'));
  const link = nodes(ro).find(n => n.props?.accessibilityLabel === 'How is this estimated?');
  assert.ok(flat(link.props.style).minHeight >= 48);
});
test('the "How is this estimated?" explanation names the model type and the inputs, and keeps the disclaimers', () => {
  const m = load('src/shared/components/RangeEstimateCard.tsx', cardReact);
  assert.equal(m.HOW_ESTIMATED_TITLE, 'How is this estimated?');
  const copy = m.HOW_ESTIMATED_LINES.join(' ');
  assert.match(copy, /XGBoost/);
  assert.match(copy, /gradient-boosted/);
  assert.match(copy, /type, size, rooms, furnishing, amenities and city/);
  assert.match(copy, /not an appraisal/);
  assert.match(copy, /confidence interval/);
  assert.match(copy, /asking rent stays your choice/);
});
test('the Price step wires the slider to the asking-rent field without saving, and the Review line has no estimate figure', () => {
  const step = readFileSync('src/features/property-listing/views/PostingPriceStep.tsx', 'utf8');
  assert.match(step, /onUseRent=\{vm\.applyRentFromRange\}/);
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /applyRentFromRange:\(rent:number\)=>\{[\s\S]*?updateDraft\('askingRent',String\(Math\.round\(rent\)\)\);/);
  const review = readFileSync('src/features/property-listing/views/PostingReviewView.tsx', 'utf8');
  assert.match(review, /reviewPriceDetail\(d\.askingRent,vm\.postingEstimate\?\.illustrativeRange\)/);
  assert.match(readFileSync('src/features/property-listing/views/PostingEstimateView.tsx', 'utf8'), /Or type your own price\. Any amount is allowed\./);
});
