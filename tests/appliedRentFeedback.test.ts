import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { APPLIED_FLASH_MS, appliedAfterFieldChange, appliedAnnouncement, appliedFlashVisible, fieldRent, rentCardScrollTarget } from '../src/features/property-listing/models/PostingPrice';
import { appliedButtonShows } from '../src/shared/models/RentalRange';

// ---- Decision logic: when the applied state shows and when it clears
test('the applied flash lasts about two seconds', () => assert.equal(APPLIED_FLASH_MS, 2000));
test('fieldRent reads the asking-rent field as a number', () => {
  assert.equal(fieldRent('13000'), 13000);
  assert.equal(fieldRent('13,000'), 13000);
  assert.equal(fieldRent(' 13000.5 '), 13000.5);
  for (const bad of ['', '  ', 'abc', 'Infinity', '-Infinity']) assert.equal(fieldRent(bad), null, bad);
});
test('the flash shows only while its timer runs and the field still holds exactly the applied rent', () => {
  assert.equal(appliedFlashVisible(13000, true, '13000'), true);
  assert.equal(appliedFlashVisible(13000, true, '13,000'), true);
  assert.equal(appliedFlashVisible(13000, false, '13000'), false, 'after the timer');
  assert.equal(appliedFlashVisible(13000, true, '13001'), false, 'the user edited the field');
  assert.equal(appliedFlashVisible(13000, true, ''), false, 'the user cleared the field');
  assert.equal(appliedFlashVisible(null, true, '13000'), false, 'nothing was applied');
  assert.equal(appliedFlashVisible(null, false, ''), false);
  assert.equal(appliedFlashVisible(null, true, ''), false, 'nothing applied and an empty field are not a match');
  assert.equal(appliedFlashVisible(null, true, 'abc'), false);
});
test('an applied rent is forgotten as soon as the field holds something else', () => {
  assert.equal(appliedAfterFieldChange(13000, '13000'), 13000);
  assert.equal(appliedAfterFieldChange(13000, '13,000'), 13000);
  assert.equal(appliedAfterFieldChange(13000, '13500'), null);
  assert.equal(appliedAfterFieldChange(13000, ''), null);
  assert.equal(appliedAfterFieldChange(null, '13500'), null);
  assert.equal(appliedAfterFieldChange(13000, '13000.5'), null);
});
test('the Use button reads Applied only while the ball, the field and the applied rent are one value', () => {
  assert.equal(appliedButtonShows(13000, 13000, 13000), true);
  assert.equal(appliedButtonShows(13500, 13000, 13000), false, 'the ball moved');
  assert.equal(appliedButtonShows(13000, 13500, 13000), false, 'the field changed');
  assert.equal(appliedButtonShows(null, 13000, 13000), false, 'no ball');
  assert.equal(appliedButtonShows(13000, 13000, null), false, 'nothing applied');
  assert.equal(appliedButtonShows(13000, 13000, undefined), false);
  assert.equal(appliedButtonShows(13000, null, 13000), false);
});
test('the spoken line uses the shared currency formatter', () => {
  assert.equal(appliedAnnouncement(13000), 'Asking rent set to ₱13,000');
  assert.equal(appliedAnnouncement(13000.5), 'Asking rent set to ₱13,000.50');
});
test('the scroll target brings the rent card into view, and does nothing when it is already fully visible', () => {
  const base = { cardHeight: 200, viewTop: 100, viewHeight: 600, contentY: 900, margin: 16 };
  assert.equal(rentCardScrollTarget({ ...base, cardTop: 300 }), null, 'fully inside');
  assert.equal(rentCardScrollTarget({ ...base, cardTop: 100 }), null, 'flush with the top edge');
  assert.equal(rentCardScrollTarget({ ...base, cardTop: 500 }), null, 'flush with the bottom edge');
  assert.equal(rentCardScrollTarget({ ...base, cardTop: 501 }), 884, 'one pixel below the edge: scroll');
  assert.equal(rentCardScrollTarget({ ...base, cardTop: 650 }), 884, 'below the view: its top goes just under the top edge');
  assert.equal(rentCardScrollTarget({ ...base, cardTop: 99 }), 884, 'partly above the view');
  assert.equal(rentCardScrollTarget({ ...base, cardTop: -300 }), 884, 'far above the view');
  assert.equal(rentCardScrollTarget({ ...base, cardTop: 650, contentY: 5 }), 0, 'never a negative offset');
  const tall = { ...base, cardHeight: 900 };
  assert.equal(rentCardScrollTarget({ ...tall, cardTop: 150 }), null, 'taller than the view with its top showing (large text): leave it');
  assert.equal(rentCardScrollTarget({ ...tall, cardTop: 800 }), 884, 'taller than the view and below it: scroll to its top');
});

// ---- Rendering: real components, named stubs for the rest
const realFiles: Record<string, string> = {
  Currency: 'src/shared/models/Currency.ts', RentalRange: 'src/shared/models/RentalRange.ts', PostingPrice: 'src/features/property-listing/models/PostingPrice.ts',
  colors: 'src/shared/theme/colors.ts', spacing: 'src/shared/theme/spacing.ts', radius: 'src/shared/theme/radius.ts', AppliedChip: 'src/features/property-listing/components/AppliedChip.tsx',
};
const cache: Record<string, any> = {};
let pickedStub: number | null = null; // the slider's trial value, which the real card keeps in state
const reactStub = { useState: (init: unknown) => [init === null ? pickedStub : typeof init === 'number' ? 300 : init, () => {}], useRef: (init: unknown) => ({ current: init }), useEffect() {} };
function load(file: string): any {
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react') return reactStub;
    if (key === 'react-native') return { Text: 'Text', View: 'View', Pressable: 'Pressable', TextInput: 'TextInput', Modal: 'Modal', ScrollView: 'ScrollView', Image: 'Image', StyleSheet: { create: (s: any) => s, absoluteFill: {} }, useWindowDimensions: () => ({ height: 800, width: 360 }), PanResponder: { create: (cfg: any) => ({ panHandlers: cfg }) } };
    const n = key.split('/').at(-1)!;
    if (n === 'ui') return { ui: {} };
    if (n === 'RangeSlider') return { RangeSlider: 'RangeSlider' };
    if (n === 'PersistedListingDraft') return { rentalTermOptions: [] };
    if (realFiles[n]) return cache[n] ??= load(realFiles[n]);
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
const range = { minimum: 8500, maximum: 16000 };
const slider = (props: any) => expand(load('src/shared/components/RangeSlider.tsx').RangeSlider({ range, onChange() {}, onUse() {}, ...props }));
const card = (props: any) => expand(load('src/shared/components/RangeEstimateCard.tsx').RangeEstimateCard({ range, ...props }));

test('the Use button reads "✓ Applied" while applied, with the applied look and a spoken label, and "Use ₱X" otherwise', () => {
  const on = nodes(slider({ value: 12500, applied: true })).filter(n => n.type === 'Pressable')[1];
  assert.equal(textOf(on), '✓ Applied');
  assert.equal(on.props.accessibilityLabel, 'Applied. Asking rent set to ₱12,500');
  assert.equal(on.props.accessibilityState.selected, true);
  assert.equal(flat(on.props.style).backgroundColor, '#EDF8EE');
  assert.equal(flat(on.props.style).borderColor, '#32743C');
  assert.ok(flat(on.props.style).minHeight >= 48);
  const off = nodes(slider({ value: 12500, applied: false })).filter(n => n.type === 'Pressable')[1];
  assert.equal(textOf(off), 'Use ₱12,500');
  assert.equal(off.props.accessibilityLabel, 'Use ₱12,500');
  assert.equal(off.props.accessibilityState.selected, false);
  const unset = nodes(slider({ value: null, applied: true })).filter(n => n.type === 'Pressable')[1];
  assert.match(textOf(unset), /Slide to pick a rent/, 'nothing to apply while unset');
});
test('the range card tells the slider to read Applied only while ball, field and applied rent agree', () => {
  const s = (props: any) => nodes(card({ onUseRent() {}, ...props })).find(n => n.type === 'RangeSlider').props;
  assert.equal(s({ rent: 12500, appliedRent: 12500 }).applied, true);
  assert.equal(s({ rent: 13000, appliedRent: 12500 }).applied, false, 'the field changed');
  assert.equal(s({ rent: 12500, appliedRent: null }).applied, false);
  assert.equal(s({ rent: 12500 }).applied, false);
  assert.equal(s({ rent: null, appliedRent: 12500 }).applied, false);
  pickedStub = 12000;
  try {
    assert.equal(s({ rent: 12500, appliedRent: 12500 }).applied, false, 'the ball moved away from the applied rent');
    pickedStub = 12500;
    assert.equal(s({ rent: 12500, appliedRent: 12500 }).applied, true);
  } finally { pickedStub = null; }
});
test('the asking-rent field shows the primary border and an Applied chip beside its label only while applied', () => {
  const field = (applied?: boolean) => expand(load('src/features/property-listing/components/ListingControls.tsx').ListingField({ label: 'Monthly asking rent', value: '13000', placeholder: 'x', onChangeText() {}, ...(applied === undefined ? {} : { applied }) }));
  const on = field(true), shell = nodes(on).find(n => n.type === 'View' && Array.isArray(n.props.style) && nodes(n).some(c => c.type === 'TextInput'));
  assert.equal(flat(shell.props.style).borderColor, '#32743C');
  assert.equal(flat(shell.props.style).borderWidth, 2);
  assert.match(textOf(on), /✓ Applied/);
  const chip = nodes(on).find(n => n.type === 'Text' && [n.props.children].flat().join('') === '✓ Applied');
  assert.equal(chip.props.accessible, false, 'screen readers get the announcement instead');
  for (const off of [field(false), field()]) {
    assert.ok(!/Applied/.test(textOf(off)));
    assert.notEqual(flat(nodes(off).find(n => n.type === 'View' && Array.isArray(n.props.style) && nodes(n).some(c => c.type === 'TextInput')).props.style).borderColor, '#32743C');
  }
  const bad = expand(load('src/features/property-listing/components/ListingControls.tsx').ListingField({ label: 'x', value: '', placeholder: '', onChangeText() {}, applied: true, error: 'Enter a rent' }));
  assert.equal(flat(nodes(bad).find(n => n.type === 'View' && Array.isArray(n.props.style) && nodes(n).some(c => c.type === 'TextInput')).props.style).borderColor, '#9B2C2C', 'an error still wins over the applied border');
});
const priceVm = (over: any = {}) => ({ publishedEditing: false, composerPhase: null, listingDraftState: { busy: false }, listingDraftReadOnly: false, draft: { askingRent: '13000' }, priceIssue: null, priceAttempted: false, postingEstimate: null, priceKeepAvailable: false, goBack() {}, ...over });
const priceView = (feedback: any) => {
  const view = load('src/features/property-listing/views/PostingEstimateView.tsx');
  return expand(view.PostingEstimateView({ viewModel: priceVm(), onClose() {}, estimateSection: null, rentFeedback: feedback }));
};
test('the Price view marks the rent field applied, hands its refs to the scaffold, and wraps the rent card so it can be scrolled to', () => {
  const refs = () => ({ cardRef: { current: null }, scrollRef: { current: null }, contentRef: { current: null } });
  const r = refs(), tree = priceView({ applied: true, ...r });
  assert.equal(nodes(tree).find(n => n.props?.label === 'Monthly asking rent').props.applied, true);
  assert.equal(tree.props.formFocus.scrollRef, r.scrollRef);
  assert.equal(tree.props.formFocus.contentRef, r.contentRef);
  const wrapper = nodes(tree).find(n => n.type === 'View' && n.props.ref === r.cardRef);
  assert.ok(wrapper && nodes(wrapper).some(n => n.props?.label === 'Monthly asking rent'), 'the ref wraps the whole rent card');
  assert.equal(wrapper.props.collapsable, false);
  assert.equal(nodes(priceView({ applied: false, ...refs() })).find(n => n.props?.label === 'Monthly asking rent').props.applied, false);
  const plain = expand(load('src/features/property-listing/views/PostingEstimateView.tsx').PostingEstimateView({ viewModel: priceVm(), onClose() {}, estimateSection: null }));
  assert.equal(plain.props.formFocus, undefined);
  assert.equal(nodes(plain).find(n => n.props?.label === 'Monthly asking rent').props.applied, false);
});

// ---- The Price step wiring (hooks, timer, scroll, announcement)
const step = readFileSync('src/features/property-listing/views/PostingPriceStep.tsx', 'utf8');
test('Use applies through the ViewModel first, and only then flashes, scrolls and announces', () => {
  const use = step.match(/const useRent=\(rent:number\)=>\{[\s\S]*?\n  \};/)![0];
  assert.match(use, /if\(!vm\.applyRentFromRange\(rent\)\)return;/);
  assert.ok(use.indexOf('applyRentFromRange') < use.indexOf('setApplied(value)'));
  assert.match(use, /setFlashOn\(true\)/);
  assert.match(use, /revealRentCard\(\)/);
  assert.match(use, /AccessibilityInfo\.announceForAccessibility\(appliedAnnouncement\(value\)\)/);
  assert.match(use, /const value=Math\.round\(rent\)/);
  assert.match(step, /onUseRent=\{useRent\} appliedRent=\{applied\}/);
});
test('the flash ends on its own after APPLIED_FLASH_MS, and an applied rent is forgotten when the field changes', () => {
  assert.match(step, /setTimeout\(\(\)=>setFlashOn\(false\),APPLIED_FLASH_MS\)/);
  assert.match(step, /return\(\)=>clearTimeout\(id\)/);
  assert.match(step, /useEffect\(\(\)=>\{setApplied\(a=>appliedAfterFieldChange\(a,vm\.draft\.askingRent\)\);\},\[vm\.draft\.askingRent\]\)/);
  assert.match(step, /applied:appliedFlashVisible\(applied,flashOn,vm\.draft\.askingRent\)/);
});
test('revealing the rent card only scrolls: no focus, no keyboard, and the scroll is skipped when the card is already visible', () => {
  const reveal = step.match(/const revealRentCard=\(\)=>\{[\s\S]*?\n  \};/)![0];
  assert.ok(!/\.focus\(|focus\(|Keyboard\./.test(reveal));
  assert.match(reveal, /scroll\.scrollTo\(\{y:target,animated:true\}\)/);
  assert.match(reveal, /if\(target!==null\)/);
  assert.match(reveal, /rentCardScrollTarget\(\{cardTop,cardHeight,viewTop,viewHeight,contentY,margin:16\}\)/);
  assert.match(reveal, /getNativeScrollRef\(\)/);
});
test('the ViewModel says whether a rent was applied, so nothing is announced for a refused one', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /applyRentFromRange:\(rent:number\):boolean=>\{[\s\S]*?\)return false;\s*updateDraft\('askingRent',String\(Math\.round\(rent\)\)\);\s*return true;/);
});
test('the standalone estimate flow has no apply action, so it has no applied state', () => {
  const view = readFileSync('src/features/rental-price-estimation/views/RentalPriceEstimationView.tsx', 'utf8');
  assert.ok(!/onUseRent|appliedRent|Use ₱/.test(view));
  assert.match(view, /<RangeEstimateCard range=\{result\.illustrativeRange\} rent=\{result\.askingRent\} subject="listing"\/>/);
});
