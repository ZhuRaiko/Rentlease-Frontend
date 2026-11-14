import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { formatPeso } from '../src/shared/models/Currency';
import { askingRentLabel, currentEstimate, reviewPriceDetail } from '../src/features/property-listing/models/PostingPrice';
import { placeLabel, titleCasePlace } from '../src/features/property-listing/models/PlaceLabel';
import { DRAFT_SAVED_NOTICE } from '../src/features/property-listing/viewModels/listingDraftWorkflow';
import { sheetBottomPadding } from '../src/shared/components/sheetInset';

// ---- Harness: real money, theme and feedback modules; every other import is a named stub.
const realFiles: Record<string, string> = {
  Currency: 'src/shared/models/Currency.ts', PostingPrice: 'src/features/property-listing/models/PostingPrice.ts',
  RentalRange: 'src/shared/models/RentalRange.ts', colors: 'src/shared/theme/colors.ts', spacing: 'src/shared/theme/spacing.ts', radius: 'src/shared/theme/radius.ts',
  ListingWorkspaceFeedback: 'src/features/property-listing/components/ListingWorkspaceFeedback.tsx',
};
const cache: Record<string, any> = {};
function req(key: string): any {
  if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
  if (key === 'react-native') return { Text: 'Text', View: 'View', Image: 'Image', Pressable: 'Pressable', StyleSheet: { create: (s: any) => s } };
  const n = key.split('/').at(-1)!;
  if (n === 'listingDraftWorkflow') return { DRAFT_SAVED_NOTICE };
  if (n === 'ui') return { ui: {} };
  if (n === 'PersistedListingDraft') return { rentalTermOptions: [{ value: 'monthly', label: 'Monthly' }] };
  if (realFiles[n]) return cache[n] ??= load(realFiles[n]);
  return { [n]: n };
}
function load(file: string): any {
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  return m.exports;
}
/** Renders a view, then expands function components (real ListingWorkspaceFeedback) so their output can be inspected. */
const expand = (v: any): any => {
  if (v && typeof v === 'object') {
    if (typeof v.type === 'function') return expand(v.type(v.props));
    return { ...v, props: { ...v.props, children: [v.props?.children].flat(Infinity).map(expand) } };
  }
  return v;
};
function render(name: string, vm: any, extra: Record<string, unknown> = {}) {
  const view = load(`src/features/property-listing/views/${name}.tsx`);
  return expand(view[name]({ viewModel: vm, onClose() {}, ...extra }));
}
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const text = (tree: any) => nodes(tree).filter(n => n.type === 'Text' || n.type === 'FeedbackNotice').map(n => n.type === 'FeedbackNotice' ? String(n.props.message) : [n.props.children].flat(Infinity).join('')).join(' | ');
const flat = (style: any) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

// ---- 1. Raw escapes in JSX text
/** A backslash-u (or -x) escape in JSX text or a JSX attribute string. JSX does not decode these, so they show up literally on screen. */
export function findRawEscapes(source: string, fileName = 'x.tsx'): { line: number; text: string }[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), found: { line: number; text: string }[] = [];
  const bad = /\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}|\\x[0-9a-fA-F]{2}/;
  const visit = (node: ts.Node) => {
    const raw = ts.isJsxText(node) ? node.getText() : ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) ? node.initializer.getText() : '';
    if (raw && bad.test(raw)) found.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: raw.trim().slice(0, 80) });
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}
const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : []; });
test('no .tsx file under src has a raw backslash escape in JSX text or a JSX attribute string', () => {
  const hits = walk('src').flatMap(f => findRawEscapes(readFileSync(f, 'utf8'), f).map(h => `${f}:${h.line} ${h.text}`));
  assert.deepEqual(hits, []);
});
test('the escape scanner flags JSX text and attribute strings, and leaves expressions, comments and real characters alone', () => {
  assert.equal(findRawEscapes('const A=()=><Text>per month \\u00b7 model estimate</Text>;').length, 1);
  assert.equal(findRawEscapes('const A=()=><Text>range (\\u00b130%)</Text>;').length, 1);
  assert.equal(findRawEscapes('const A=()=><Text accessibilityLabel="a \\u00b7 b">x</Text>;').length, 1);
  assert.equal(findRawEscapes('const A=()=><Text>caf\\u00e9</Text>;').length, 1);
  assert.equal(findRawEscapes("const A=()=><Text>{'\\u00b7'}</Text>;").length, 0);
  assert.equal(findRawEscapes("const A=()=><Text>{`a \\u00b7 ${1}`}</Text>;").length, 0);
  assert.equal(findRawEscapes('const A=()=><Text>per month \u00b7 model estimate \u00b130%</Text>;').length, 0);
  assert.equal(findRawEscapes('// \\u00b7 in a comment\nconst A=()=><Text>ok</Text>;').length, 0);
});

// ---- 3. One money format
test('formatPeso: peso sign, thousands separators, centavos only when present', () => {
  assert.equal(formatPeso(12227), '\u20b112,227');
  assert.equal(formatPeso(12226.51), '\u20b112,226.51');
  assert.equal(formatPeso(11373.65), '\u20b111,373.65');
  assert.equal(formatPeso(1000), '\u20b11,000');
  assert.equal(formatPeso(0), '\u20b10');
  assert.equal(formatPeso(1234567.5), '\u20b11,234,567.50');
  assert.equal(formatPeso(12226.999), '\u20b112,227');
  assert.equal(formatPeso(-1500), '-\u20b11,500');
  assert.equal(formatPeso(NaN), '');
});
const reviewVm = (over: any = {}) => ({
  publishedEditing: false, listingDraftState: { busy: false, propertyId: 'p1', listingId: 'l1', error: null, notice: null, uncertain: false, conflict: false },
  publicationState: { propertyId: null }, lifecycleState: { propertyId: null }, workspacePropertyId: 'p1', workspaceListingId: null,
  composerPhase: null, draft: { title: 'Actual rental', askingRent: '12227', description: 'Real description', rentalTerm: 'monthly', securityDepositMonths: '1', advanceRentMonths: '0', availableDate: '2026-12-01', houseRules: '' },
  propertySummary: { type: 'Apartment', location: 'Imus', bedrooms: '1', bathrooms: '1', floorAreaSqm: '35' },
  photoState: { photos: [{ publicUrl: 'https://example.invalid/c', is_cover: true }], pendingSelections: [] },
  postingChecklist: [{ key: 'photos', done: true, label: 'Photos (1)', detail: null }, { key: 'verification', done: false, label: 'Property verification (Tier 3)', detail: 'Required to publish' }],
  postingDraftSaved: true, postingWithinRange: true, postingEstimate: { illustrativeRange: { minimum: 8500, maximum: 16000 } }, postingPublishReady: false, saveAndExitDisabled: false, goBack() {}, ...over,
});

// ---- 2. One saved notice on Review
const savedNotices = (tree: any) => nodes(tree).filter(n => (n.type === 'Text' || n.type === 'FeedbackNotice') && /Draft saved\.|saved to your account/i.test(n.type === 'FeedbackNotice' ? String(n.props.message) : [n.props.children].flat(Infinity).join(''))).length;
test('Review shows exactly one saved notice for a new draft and for a resumed draft', () => {
  const justSaved = { busy: false, propertyId: 'p1', listingId: 'l1', error: null, notice: DRAFT_SAVED_NOTICE, uncertain: false, conflict: false };
  assert.equal(savedNotices(render('PostingReviewView', reviewVm({ listingDraftState: justSaved }))), 1, 'new draft, just saved');
  assert.equal(savedNotices(render('PostingReviewView', reviewVm({ listingDraftState: justSaved, workspaceListingId: 'l1' }))), 1, 'resumed draft, saved again');
  assert.equal(savedNotices(render('PostingReviewView', reviewVm({ workspaceListingId: 'l1' }))), 1, 'resumed draft, nothing saved this session');
  assert.equal(savedNotices(render('PostingReviewView', reviewVm())), 1, 'new draft, no notice left behind');
});
test('Review still shows other draft notices and errors', () => {
  const t = text(render('PostingReviewView', reviewVm({ listingDraftState: { busy: false, propertyId: 'p1', listingId: 'l1', error: 'Save failed. Try again.', notice: null, uncertain: false, conflict: false } })));
  assert.match(t, /Save failed\. Try again\./);
  const loaded = text(render('PostingReviewView', reviewVm({ listingDraftState: { busy: false, propertyId: 'p1', listingId: 'l1', error: null, notice: 'Current backend draft loaded. Review it before saving again.', uncertain: false, conflict: false } })));
  assert.match(loaded, /Current backend draft loaded/);
});
test('the saved line on Review says one thing, and other screens keep the draft notice', () => {
  assert.match(text(render('PostingReviewView', reviewVm({ postingDraftSaved: true }))), /Draft saved\. Not published yet\./);
  assert.match(text(render('PostingReviewView', reviewVm({ postingDraftSaved: false }))), /Your latest changes are not saved yet/);
  const feedback = load('src/features/property-listing/components/ListingWorkspaceFeedback.tsx').ListingWorkspaceFeedback;
  const vm = reviewVm({ listingDraftState: { busy: false, propertyId: 'p1', listingId: 'l1', error: null, notice: DRAFT_SAVED_NOTICE, uncertain: false, conflict: false } });
  assert.match(text(expand(feedback({ viewModel: vm, scope: 'draft' }))), /saved to your account/);
  assert.ok(!/saved to your account/.test(text(expand(feedback({ viewModel: vm, scope: 'draft', hideSavedNotice: true })))));
});

// ---- 4. A stale estimate is dropped
test('an estimate is current only while the property details it was made for are unchanged', () => {
  const held = { result: { estimatedMonthlyRent: 11373.65 }, basis: '{"floor":30}' };
  assert.equal(currentEstimate(held, '{"floor":30}'), held.result);
  assert.equal(currentEstimate(held, '{"floor":45}'), null);
  assert.equal(currentEstimate(null, '{"floor":30}'), null);
});
test('the ViewModel keeps each estimate with its property basis and reads it through currentEstimate', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /useState<\{result:PredictionReceipt;basis:string\}\|null>\(null\)/);
  assert.match(vm, /postingEstimateResult=currentEstimate\(postingEstimateHeld,estimateBasisKey\)/);
  assert.match(vm, /setPostingEstimate:\(r:PredictionReceipt\|null\)=>setPostingEstimateHeld\(r\?\{result:r,basis:estimateBasisKey\}:null\)/);
  assert.match(vm, /postingRangeRelation:rangeRelation\(listingNumber\(draft\.askingRent\),postingEstimateResult\?\.illustrativeRange\)/);
});

// ---- 5. Tier 3 warning treatment
test('the Tier 3 item on Review uses the warning tokens, with the verify action inside it', () => {
  const tree = render('PostingReviewView', reviewVm());
  const warn = nodes(tree).find(n => n.type === 'View' && flat(n.props.style).backgroundColor === '#FFF7E8' && flat(n.props.style).borderWidth === 1);
  assert.ok(warn, 'a warning-surface block exists');
  const s = flat(warn.props.style);
  assert.equal(s.borderColor, '#9A6414');
  assert.ok(s.borderWidth >= 1);
  assert.ok(nodes(warn).some(n => n.type === 'PropertyVerificationAction'));
  const label = nodes(warn).find(n => n.type === 'Text' && [n.props.children].flat(Infinity).join('') === 'Property verification (Tier 3)');
  assert.equal(flat(label.props.style).color, '#9A6414');
  assert.equal(nodes(tree).filter(n => n.type === 'View' && flat(n.props.style).backgroundColor === '#FFF7E8' && flat(n.props.style).borderWidth === 1).length, 1, 'only the unmet Tier 3 item is a warning block');
});
test('a verified property gets no warning block, and the checklist card is green only when everything is ready', () => {
  const done = reviewVm({ postingChecklist: [{ key: 'verification', done: true, label: 'Property verification (Tier 3)', detail: null }], postingPublishReady: true });
  const tree = render('PostingReviewView', done);
  assert.ok(!nodes(tree).some(n => n.type === 'View' && flat(n.props.style).backgroundColor === '#FFF7E8'));
  assert.ok(!nodes(tree).some(n => n.type === 'PropertyVerificationAction'));
  const card = (t: any) => nodes(t).find(n => n.type === 'PostingCard' && nodes(n).some(c => c.type === 'Text' && [c.props.children].flat(Infinity).join('') === 'Ready to publish?'));
  assert.equal(card(tree).props.highlight, true);
  assert.equal(card(render('PostingReviewView', reviewVm())).props.highlight, false);
});
test('Verify This Property is a secondary (outline) button', () => {
  const src = readFileSync('src/features/property-listing/components/PropertyVerificationAction.tsx', 'utf8');
  assert.match(src, /<ListingButton label=\{state\.actionLabel\} tone="outline"/);
  assert.match(readFileSync('src/features/property-listing/models/PropertyVerificationPresentation.ts', 'utf8'), /'Verify This Property'/);
});

// ---- 6. Bottom sheets inside a Modal clear the navigation bar
test('sheetBottomPadding clears the system navigation bar in 3-button and gesture navigation', () => {
  assert.equal(sheetBottomPadding(0), 24, 'no inset: the base padding');
  assert.equal(sheetBottomPadding(24), 36, 'gesture bar');
  assert.equal(sheetBottomPadding(48), 60, 'three-button bar');
  assert.ok(sheetBottomPadding(48) >= 48 && sheetBottomPadding(24) >= 24);
  assert.equal(sheetBottomPadding(0, 16), 16);
});
test('every Modal with a bottom-aligned sheet reads the bottom inset', () => {
  const offenders = walk('src').filter(f => { const s = readFileSync(f, 'utf8'); return /<Modal\b/.test(s) && /justifyContent:\s*'flex-end'/.test(s) && !/useSheetBottomInset|useSafeAreaInsets/.test(s); });
  assert.deepEqual(offenders, []);
});
test('the estimator consent sheet applies the shared inset and keeps its text', () => {
  const src = readFileSync('src/features/property-listing/components/PostingLocationApproval.tsx', 'utf8');
  assert.match(src, /useSheetBottomInset\(\)/);
  assert.match(src, /style=\{\[styles\.sheet,\{maxHeight:height\*\.85,paddingBottom:sheetPadBottom\}\]\}/);
  assert.ok(src.includes("What's shared with the estimator"));
  assert.ok(src.includes('RentLease sends only this property'));
});
test('the shared inset hook leaves the protected layout components alone', () => {
  const hook = readFileSync('src/shared/components/useSheetBottomInset.ts', 'utf8');
  assert.ok(!/FooterInsetContext|ScreenContainer|PinnedFooter|RentLeaseBottomNavigation/.test(hook.replace(/\/\*[\s\S]*?\*\//g, '')));
});

// ---- 8. Place labels
test('titleCasePlace capitalizes lowercase words and leaves ones that already have capitals', () => {
  assert.equal(titleCasePlace('imus'), 'Imus');
  assert.equal(titleCasePlace('  las  pinas '), 'Las Pinas');
  assert.equal(titleCasePlace('Alapan II-B'), 'Alapan II-B');
  assert.equal(titleCasePlace('brgy. san jose'), 'Brgy. San Jose');
  assert.equal(titleCasePlace('buhay na tubig'), 'Buhay na Tubig', 'Filipino particles stay lowercase inside a name');
  assert.equal(titleCasePlace('na'), 'Na', 'but a name that starts with one still starts with a capital');
  assert.equal(titleCasePlace('Buhay na Tubig'), 'Buhay na Tubig', 'typed capitals are respected');
  assert.equal(titleCasePlace('Saved barangay'), 'Saved barangay');
  assert.equal(titleCasePlace('SM'), 'SM');
  assert.equal(titleCasePlace(''), '');
});
test('placeLabel title-cases, skips empty parts and shows a repeated part once', () => {
  assert.equal(placeLabel(['imus', 'Imus']), 'Imus');
  assert.equal(placeLabel(['Alapan II-B', 'imus']), 'Alapan II-B, Imus');
  assert.equal(placeLabel(['Alapan', 'Alapan']), 'Alapan');
  assert.equal(placeLabel(['IMUS', 'Imus']), 'IMUS', 'a repeat that differs only by case is still a repeat');
  assert.equal(placeLabel(['', null, undefined, 'Imus']), 'Imus');
  assert.equal(placeLabel(['Alapan, imus', 'Imus']), 'Alapan, Imus');
  assert.equal(placeLabel(['  ', undefined]), '');
  assert.equal(placeLabel(['tagaytay', 'Tagaytay City']), 'Tagaytay, Tagaytay City');
});
test('the card, the Review chips and the property summary all build the location with placeLabel', () => {
  assert.match(readFileSync('src/features/property-listing/models/LandlordPortfolio.ts', 'utf8'), /portfolioLocation = \(p: PortfolioProperty\) => placeLabel\(/);
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.equal(vm.split('location: placeLabel(').length - 1, 2);
  assert.match(readFileSync('src/features/property-listing/views/PropertyRoutineEditView.tsx', 'utf8'), /placeLabel\(\[c\.barangay,c\.city\]\)/);
});

// ---- 3 (range-only): the Review price line and the peso text
test('Review price line: rent per month with its relation to the typical range; no estimate figure', () => {
  const range = { minimum: 8500, maximum: 16000 };
  assert.equal(reviewPriceDetail('13000', range), '₱13,000 per month · Within the typical range');
  assert.equal(reviewPriceDetail('19500', range), '₱19,500 per month · Above the typical range');
  assert.equal(reviewPriceDetail('8000', range), '₱8,000 per month · Below the typical range');
  assert.equal(reviewPriceDetail('13,000', range), '₱13,000 per month · Within the typical range');
  assert.equal(reviewPriceDetail('13000.5', range), '₱13,000.50 per month · Within the typical range');
  assert.equal(reviewPriceDetail('13000', null), '₱13,000 per month');
  assert.equal(reviewPriceDetail('', range), 'Not entered');
  assert.equal(reviewPriceDetail('abc', range), 'Not entered');
  assert.equal(askingRentLabel('12000'), '₱12,000');
});
test('Review shows peso text from the shared formatter, the relation, and no PHP amount or estimate figure', () => {
  const t = text(render('PostingReviewView', reviewVm({ draft: { ...reviewVm().draft, askingRent: '13000' } })));
  assert.match(t, /₱13,000 \/ month/);
  assert.match(t, /₱13,000 per month · Within the typical range/);
  assert.ok(!/PHP|estimate PHP|Matches the estimate|Within estimate range/.test(t));
  assert.match(text(render('PostingReviewView', reviewVm({ draft: { ...reviewVm().draft, askingRent: '19500' } }))), /₱19,500 per month · Above the typical range/);
});
