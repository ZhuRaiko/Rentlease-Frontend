import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

// Same minimal module loader the other presentation tests use: native modules are stubs, tokens are the given numbers.
const SPACING = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24 };
function load(path: string, overrides: Record<string, any> = {}) {
  const absolute = resolve(path), actual = createRequire(absolute), mod = { exports: {} as any };
  const req = (k: string): any => {
    if (k in overrides) return overrides[k];
    if (k === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
    if (k === 'react-native') return { StyleSheet: { create: (s: any) => s }, View: 'View', Pressable: 'Pressable', Text: 'Text', Image: 'Image', ScrollView: 'ScrollView', Modal: 'Modal', useWindowDimensions: () => ({ width: 411, fontScale: 1, height: 850 }) };
    if (k === 'react') return { useState: (v: any) => [typeof v === 'function' ? v() : v, () => {}], useEffect: () => {} };
    if (k.endsWith('/spacing')) return { spacing: SPACING };
    if (k.endsWith('/colors')) return { colors: new Proxy({}, { get: (_t, name) => String(name) }) };
    if (k.endsWith('/ui')) return { ui: { supporting: {}, body: {}, sectionTitle: {} } };
    if (k.endsWith('/ListingControls')) return { ChoiceChip: 'ChoiceChip', ListingField: 'ListingField', EstimateMarker: 'EstimateMarker' };
    if (k.endsWith('/DraftProperty') || k.endsWith('/PropertyModelAttributes') || k.endsWith('/PostingPresentation') || k.endsWith('/PostingEstimate') || k.endsWith('/RentalEstimateEligibility') || k.endsWith('/RentalPrediction') || k.endsWith('/RentalModelAttributes.ts')) return actual(k);
    const name = k.split('/').at(-1)!; return { [name]: name };
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, mod, mod.exports);
  return mod.exports;
}
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const words = (v: any) => nodes(v).filter(n => n.type === 'Text').map(n => [n.props.children].flat(Infinity).filter(c => typeof c !== 'object').join('')).join(' ');
const style = (s: any): any => Object.assign({}, ...[s].flat(Infinity).filter(Boolean));

test('pinned footer: total space under the buttons is max(md, inset + sm) in gesture and 3-button modes, for the wizard scaffold and the shared footer alike', () => {
  for (const bottom of [0, 8, 10, 24, 34, 48]) {
    const expected = Math.max(SPACING.md, bottom + SPACING.sm);
    const scaffold = load('src/features/property-listing/components/ListingWizardScaffold.tsx', { 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom }) } }).ListingWizardScaffold;
    const tree = scaffold({ progress: { type: 'Progress' }, footer: { type: 'Continue' }, children: { type: 'Form' }, onClose() {} });
    const footerView = tree.props.children[1], strip = tree.props.children[2];
    const scaffoldTotal = style(footerView.props.style).paddingBottom + (strip ? style(strip.props.style).height : 0);
    const shared = load('src/shared/components/PinnedFooter.tsx', { 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom }) } }).PinnedFooter;
    const parts = [shared({ children: { type: 'Continue' } }).props.children].flat().filter(Boolean);
    const sharedTotal = style(parts[0].props.style).paddingBottom + (parts[1] ? style(parts[1].props.style).height : 0);
    assert.equal(scaffoldTotal, expected, `wizard scaffold, inset ${bottom}`);
    assert.equal(sharedTotal, expected, `shared footer, inset ${bottom}`);
    assert.ok(style(footerView.props.style).paddingBottom >= bottom, 'the buttons are never drawn behind the navigation bar');
    assert.equal(footerView.props.children.type, 'Continue');
  }
});
test('pinned footer look: hairline, subtle elevation, bounded width, 48dp buttons come from the caller', () => {
  const source = readFileSync('src/shared/components/PinnedFooter.tsx', 'utf8');
  for (const part of [/borderTopWidth:1/, /elevation:8/, /shadowOpacity:0\.08/, /maxWidth:412/, /Math\.max\(spacing\.md,inset\+spacing\.sm\)/]) assert.match(source, part);
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'theme tokens only');
  for (const path of ['src/features/property-listing/components/ListingWizardScaffold.tsx', 'src/features/admin-moderation/components/AdminScaffold.tsx']) assert.match(readFileSync(path, 'utf8'), /pinnedFooterStyle|<PinnedFooter>/, path + ' uses the shared footer treatment');
});
// The footer pass once replaced the library's safe-area context with bottom: 0 for a whole subtree, which also hit the bottom navigation.
// Real insets must reach everything; only the pinned footers may learn that a navigation bar covers the edge.
function walk(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []); }
test('the bottom navigation takes its height and padding from the REAL inset (0, 8, 24, 34, 48), whatever wraps it', () => {
  for (const bottom of [0, 8, 24, 34, 48]) {
    const nav = load('src/shared/components/RentLeaseBottomNavigation.tsx', { 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom, left: 0, right: 0 }) }, '../viewModels/useKeyboardVisibility': { useKeyboardVisibility: () => false } }).RentLeaseBottomNavigation;
    const tree = nav({ active: 'listing', onChat() {}, onDiscover() {}, onListing() {}, onPost() {}, onTenancy() {} });
    const s = style(tree.props.style);
    assert.equal(s.minHeight, 64 + bottom, `minHeight at inset ${bottom}`);
    assert.equal(s.paddingBottom, Math.max(8, bottom), `paddingBottom at inset ${bottom}`);
  }
});
test('nothing in src overrides the library safe-area context, and only the pinned footer parts read the footer context', () => {
  const files = walk('src');
  const using = (needle: RegExp) => files.filter(p => needle.test(readFileSync(p, 'utf8'))).map(p => p.replace(/\\/g, '/'));
  assert.deepEqual(using(/SafeAreaInsetsContext/), [], 'no Provider (or any use) of the library context: useSafeAreaInsets() stays real everywhere');
  assert.deepEqual(using(/SafeAreaProvider/), [], 'the single provider lives in the app root, outside src');
  assert.deepEqual(using(/FooterInsetContext/).sort(), ['src/shared/components/FooterInsetContext.ts', 'src/shared/components/PinnedFooter.tsx', 'src/shared/components/ScreenContainer.tsx'], 'only ScreenContainer sets it and only PinnedFooter reads it');
  assert.doesNotMatch(readFileSync('src/shared/components/ScreenContainer.tsx', 'utf8'), /useSafeAreaInsets|bottom:\s*0/);
});
test('ScreenContainer marks the footer context without touching insets, and only when a bottom navigation is below', () => {
  const stubs = { 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, './FooterInsetContext': { FooterInsetContext: { Provider: 'FooterProvider' } } };
  const { ScreenContainer } = load('src/shared/components/ScreenContainer.tsx', stubs);
  const owned = ScreenContainer({ children: { type: 'Child' }, includeBottomInset: false, padded: false, bottomChrome: true });
  const provider = nodes(owned).find(n => n.type === 'FooterProvider');
  assert.ok(provider && provider.props.value === true, 'covered footers learn that the navigation owns the edge');
  assert.ok(!nodes(ScreenContainer({ children: { type: 'Child' }, includeBottomInset: false, padded: false })).some(n => n.type === 'FooterProvider'), 'without a navigation the footer keeps the real inset');
  assert.deepEqual(owned.props.edges, ['top', 'right', 'left']);
});
test('a covered pinned footer drops to spacing.md and loses its gap strip; an uncovered one is untouched', () => {
  const rn = { StyleSheet: { create: (s: any) => s, flatten: (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean)) }, View: 'View' };
  const make = (covered: boolean) => load('src/shared/components/PinnedFooter.tsx', { 'react-native': rn, react: { useContext: () => covered }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 48 }) } });
  const box = [{ paddingTop: 12 }, { paddingBottom: 48 }];
  assert.equal(style(make(false).PinnedFooterShell({ style: box, children: 'x' }).props.style).paddingBottom, 48);
  assert.equal(style(make(true).PinnedFooterShell({ style: box, children: 'x' }).props.style).paddingBottom, SPACING.md);
  assert.equal(style(make(true).PinnedFooterShell({ style: box, children: 'x' }).props.style).paddingTop, 12, 'only the bottom padding changes');
  assert.equal(make(true).PinnedFooterGap({ style: { height: 12 } }), null);
  assert.deepEqual(make(false).PinnedFooterGap({ style: { height: 12 } }).props.style, { height: 12 });
});
test('property step: only fields the estimator reads are marked "Used in estimate"', () => {
  const d: any = { propertyType: 'apartment', furnishingStatus: 'unfurnished', city: 'imus', bedrooms: '2', bathrooms: '1', floorAreaSqm: '', maxOccupants: '', floorNumber: '', totalFloors: '', propertySubtype: '', lotAreaSqm: '', parkingSpaces: '', barangay: 'B', addressLine1: 'A', addressLine2: '', postalCode: '', accessInstructions: '' };
  const vm: any = { propertyState: { draft: d, loaded: true }, propertySummary: {}, propertyCreation: { updateField() {} }, propertyValidationIssues: [], propertyFloorIssues: {}, completeness: {}, floorAreaRequired: true, estimateDetails: { filled: 2, total: 8 }, estimateInputs: { propertyType: 'apartment', city: 'imus', furnishingStatus: 'unfurnished', propertySubtype: '', floorAreaSqm: '', floorNumber: '', lotAreaSqm: '', parkingSpaces: '', bedrooms: '2', bathrooms: '1', amenityCount: 0 } };
  const render = load('src/features/property-listing/components/ComposerPropertyFields.tsx').ComposerPropertyFields;
  const tree = render({ viewModel: vm, renderGroup: (group: string, children: any) => ({ type: 'Group', props: { group, children } }), afterLocation: null, children: { type: 'Amenities' } });
  const all = nodes(tree), field = (label: string) => all.find(n => n.type === 'ListingField' && n.props.label === label);
  for (const label of ['Bedrooms', 'Bathrooms', 'Floor area (sqm)']) assert.equal(field(label)?.props.usedInEstimate, true, label);
  assert.ok(!field('Maximum occupants (optional)')?.props.usedInEstimate, 'maximum occupants is not a model input');
  const floors = all.filter(n => n.type === 'PropertyFloorFields');
  assert.deepEqual(floors.map(n => [n.props.part, !!n.props.usedInEstimate]), [['floor', true], ['total', false]], 'rental floor counts, floors in building does not');
  assert.equal(all.find(n => n.type === 'PropertyModelAttributeFields').props.marker, true, 'subtype, lot area and parking');
  assert.equal(all.find(n => n.type === 'FieldLabel' && n.props.label === 'Furnishing').props.usedInEstimate, true);
  const more = all.find(n => n.type === 'PostingSection' && n.props.title === 'More');
  assert.ok(more && nodes(more).some(n => n.props?.label === 'Maximum occupants (optional)'), 'occupants stay under More');
  const order = all.filter(n => n.type === 'EstimateDetailsMeter' || n.props?.label === 'Floor area (sqm)' || n.type === 'PostingSection' && n.props.title === 'More').map(n => n.type === 'ListingField' ? 'area' : n.type === 'EstimateDetailsMeter' ? 'meter' : 'more');
  assert.deepEqual(order, ['area', 'meter', 'more'], 'floor area leads the card; the meter sits below the fields and above More');
  assert.deepEqual(all.find(n => n.type === 'EstimateDetailsMeter').props.missing, ['floor area', 'floor number or lot area', 'parking spaces', 'subtype', 'amenities']);
  const plain = render({ viewModel: vm, children: { type: 'Amenities' } });
  assert.ok(!nodes(plain).some(n => n.props?.usedInEstimate === true || n.props?.marker === true), 'the non-wizard form carries no estimate markers');
});
test('estimate meter names what is missing, and never claims accuracy', () => {
  const Meter = load('src/features/property-listing/components/EstimateDetailsMeter.tsx').EstimateDetailsMeter;
  assert.match(words(Meter({ filled: 7, total: 8, missing: ['parking spaces'] })), /7 of 8 filled\. Add parking spaces to complete\./);
  assert.match(words(Meter({ filled: 6, total: 8, missing: ['floor area', 'subtype'] })), /Add floor area and subtype to complete\./);
  assert.match(words(Meter({ filled: 5, total: 8, missing: ['a', 'b', 'c'] })), /Add a, b and c to complete\./);
  assert.match(words(Meter({ filled: 3, total: 8, missing: ['a', 'b', 'c', 'd', 'e'] })), /Add a, b, c and 2 more to complete\./);
  assert.match(words(Meter({ filled: 8, total: 8, missing: [] })), /Every estimate detail is filled\./);
  assert.doesNotMatch(words(Meter({ filled: 8, total: 8 })), /accura|confiden|guarantee/i);
  assert.equal(Meter({ filled: 3, total: 8 }).props.accessibilityLabel, '3 of 8 estimate details filled');
});
test('progress header: four bars, then "Step N of 4 · Name", with the unchanged spoken label', () => {
  const Progress = load('src/features/property-listing/components/PostingProgress.tsx').PostingProgress;
  for (const [step, name] of [[1, 'Property'], [2, 'Listing'], [3, 'Price'], [4, 'Review']] as const) {
    const tree = Progress({ step });
    assert.equal(tree.props.accessibilityLabel, `Posting step ${step} of 4: ${name}. Property, Listing, Price, Review.`);
    assert.equal(tree.props.children[1].props.children.length, 4);
    assert.equal(words(tree).replace(/\s+/g, ' ').trim(), `Step ${step} of 4 · ${name}`);
    const bars = tree.props.children[1].props.children.map((c: any) => style(c.props.children.props.style).backgroundColor);
    assert.deepEqual(bars, [0, 1, 2, 3].map(i => i < step ? 'primaryAction' : 'border'), 'filled up to the current step');
  }
});
