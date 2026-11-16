import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { editPropertyDetailsPlan, firstIncompleteStep, newListingTarget, portfolioCardActions, portfolioCardLayout, type PortfolioActionKey } from '../src/features/property-listing/models/PortfolioCardPresentation';
import { LISTING_CHANGED_MESSAGE, LISTING_NOT_EDITABLE_MESSAGE, PROPERTY_CHANGED_MESSAGE, RELOAD_LABEL, TENANCY_BINDING_MESSAGE, TENANCY_FIELD_MESSAGE } from '../src/features/property-listing/models/RefusalMessages';
import type { LandlordPortfolioItem } from '../src/features/property-listing/models/LandlordPortfolio';

const item = (status: string | null, over: { active?: boolean; area?: number | null; tier?: string } = {}): LandlordPortfolioItem => ({
  propertyId: 'p', property: { id: 'p', landlord_id: 'o', property_type: 'apartment', city: 'imus', barangay: 'B', bedrooms: 1, bathrooms: 1, floor_area_sqm: over.area === undefined ? 30 : over.area, floor_number: null, total_floors: 2, max_occupants: 2, furnishing_status: 'unfurnished', is_active: over.active ?? true, created_at: '', updated_at: '' },
  currentListing: status ? { id: 'l', status, completeness_score: 1, available_from: null } : null, listings: [], coverPhoto: null, tier3: { status: over.tier ?? 'not_submitted', requiresRepair: false },
} as any);
const states: [string, string | null][] = [['no listing', null], ['draft', 'draft'], ['published', 'active'], ['paused', 'paused'], ['archived', 'archived'], ['rented', 'rented'], ['removed', 'removed']];
/** Keys that open the editor (the wizard). Everything else either opens the status screen, verification or publication review. */
const EDITORS: PortfolioActionKey[] = ['continuePosting', 'continueEditing', 'editListing', 'createListing', 'editPropertyDetails'];

test('every card state has one button, named for the state', () => {
  const expected: Record<string, string> = { 'no listing': 'Continue posting', draft: 'Continue editing', published: 'Manage', paused: 'Manage', archived: 'Create a new listing', rented: 'Manage', removed: 'Manage' };
  for (const [name, status] of states) {
    const a = portfolioCardActions(item(status));
    assert.equal(a.primary.label, expected[name], name); assert.equal(a.secondary, null, `${name}: no second button`);
    assert.deepEqual(portfolioCardLayout(item(status)).secondary, null);
  }
});
test('no card offers the old Edit Property or Edit Rental, and "Edit property details" is in the menu where the property can be edited', () => {
  for (const [name, status] of states) for (const active of [true, false]) {
    const a = portfolioCardActions(item(status, { active })), all = [a.primary, ...a.menu];
    assert.ok(!all.some(x => /^Edit Property$|^Edit Rental$/.test(x.label) || (x.key as string) === 'editProperty' || (x.key as string) === 'editRental'), `${name}/${active}`);
    const hasDetails = a.menu.some(x => x.key === 'editPropertyDetails');
    assert.equal(hasDetails, active && ['no listing', 'draft', 'published', 'paused', 'archived'].includes(name), `${name}/${active}: menu entry`);
    if (hasDetails) assert.equal(a.menu.find(x => x.key === 'editPropertyDetails')!.label, 'Edit property details');
  }
});
test('every state resolves to exactly one editor: the primary button is the only editor-opening action besides "Edit property details", and both open the wizard', () => {
  for (const [name, status] of states) {
    const a = portfolioCardActions(item(status)), opening = [a.primary, ...a.menu].filter(x => EDITORS.includes(x.key));
    const primaryOpens = EDITORS.includes(a.primary.key);
    const others = opening.filter(x => x !== a.primary);
    assert.ok(others.every(x => x.key === 'editPropertyDetails' || x.key === 'editListing'), `${name}: nothing else opens an editor`);
    assert.ok(others.length <= 2, `${name}: at most Edit listing and Edit property details in the menu`);
    if (status && status !== 'archived' && ['removed', 'rented'].includes(status)) assert.equal(primaryOpens, false, `${name}: not editable, so no editor button`);
    assert.equal(new Set([a.primary, ...a.menu].map(x => x.key)).size, [a.primary, ...a.menu].length, `${name}: no repeated action`);
  }
});
test('Edit property details: where it opens the wizard, per state', () => {
  assert.equal(editPropertyDetailsPlan(item(null)), 'compose');
  assert.equal(editPropertyDetailsPlan(item('draft')), 'compose');
  assert.equal(editPropertyDetailsPlan(item('active')), 'published');
  assert.equal(editPropertyDetailsPlan(item('paused')), 'published');
  assert.equal(editPropertyDetailsPlan(item('archived')), 'fresh');
  for (const status of ['rented', 'removed']) assert.equal(editPropertyDetailsPlan(item(status)), null, status);
  for (const status of [null, 'draft', 'active', 'paused', 'archived']) assert.equal(editPropertyDetailsPlan(item(status, { active: false })), null, `inactive property, ${status}`);
  assert.equal(editPropertyDetailsPlan(null), null); assert.equal(editPropertyDetailsPlan(undefined), null);
});
test('Manage is the primary button for published and paused listings (it holds the status control), and is not repeated in the menu', () => {
  for (const status of ['active', 'paused']) {
    const a = portfolioCardActions(item(status)); assert.deepEqual([a.primary.key, a.primary.label], ['open', 'Manage']);
    assert.ok(!a.menu.some(x => x.key === 'manageStatus' || /status/i.test(x.label)), 'not repeated in the menu');
    const inactive = portfolioCardActions(item(status, { active: false }));
    assert.deepEqual([inactive.primary.key, inactive.primary.label], ['open', 'Manage']);
    assert.ok(!inactive.menu.some(x => x.key === 'editListing'), 'an inactive property cannot be edited from its card');
  }
});
test('Continue posting resumes at the first incomplete step', () => {
  assert.equal(firstIncompleteStep(item(null)), 'listing');
  assert.equal(firstIncompleteStep(item(null, { area: null })), 'property', 'a floor area the range needs is missing');
  assert.equal(firstIncompleteStep(item(null, { area: 0 })), 'property');
  const t = newListingTarget(item(null))!, r = newListingTarget(item(null, { area: null }), 'resume')!;
  assert.deepEqual([t.screen, t.history, t.listingId, t.mode], ['listingDetails', ['dashboard', 'listingComposer'], null, 'compose']);
  assert.deepEqual([r.screen, r.history], ['listingComposer', ['dashboard']]);
  assert.equal(newListingTarget(item(null, { area: null }), 'details')!.screen, 'listingDetails', 'the explicit start wins');
  assert.equal(newListingTarget(item(null), 'property')!.screen, 'listingComposer');
  assert.equal(newListingTarget(item(null, { active: false })), null);
  assert.equal(newListingTarget(item('draft')), null);
});
test('the dashboard sends each button to its handler with the property id', () => {
  const dash = readFileSync('src/features/property-listing/views/PropertyDashboardView.tsx', 'utf8');
  assert.match(dash, /key === 'open' \|\| key === 'continueEditing' \|\| key === 'manageStatus'\) vm\.openPortfolioItem\(propertyId\)/);
  assert.match(dash, /key === 'continuePosting'\) vm\.continuePortfolioPosting\(propertyId\)/);
  assert.match(dash, /key === 'editListing'\) vm\.editPortfolioListing\(propertyId\)/);
  assert.match(dash, /key === 'editPropertyDetails'\) vm\.editPortfolioPropertyDetails\(propertyId\)/);
});

// ---- The old property-only screen is gone
const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
test('the property-only screen, its route and the unused sheet-inset helpers are gone', () => {
  for (const gone of ['src/features/property-listing/views/PropertyRoutineEditView.tsx', 'src/shared/components/useSheetBottomInset.ts', 'src/shared/components/sheetInset.ts', 'src/features/property-listing/components/PostingLocationApproval.tsx']) assert.equal(existsSync(gone), false, gone);
  const hits = walk('src').filter(f => /'propertyEdit'|PropertyRoutineEditView|openPortfolioProperty|useSheetBottomInset|sheetBottomPadding/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
  assert.deepEqual(walk('src').filter(f => /label="Edit Property"|'Edit Property'|'Edit Rental'/.test(readFileSync(f, 'utf8'))), [], 'no second Edit Property button anywhere');
  assert.ok(!/propertyEdit/.test(readFileSync('src/features/property-listing/models/PropertyListing.ts', 'utf8')));
  assert.ok(!/propertyEdit/.test(readFileSync('src/features/property-listing/models/listingNavigation.ts', 'utf8')));
});
test('identity correction is still reachable, and returns to the wizard', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /setScreen\('listingComposer'\);if\(id\)void propertyRoutine\.open\(id\);/);
  assert.match(readFileSync('src/features/property-listing/components/SavedPropertyFields.tsx', 'utf8'), /label="Request Identity Correction"/);
});
test('the estimate card still offers "Review property details", and it now opens the wizard at Step 1', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  const open = vm.match(/openPropertyDetails:\(\)=>\{[\s\S]*?\n    reloadPropertyDetails/)![0];
  assert.doesNotMatch(open, /propertyEdit/);
  assert.match(open, /openPortfolioItem\(id,true,true\)/);
  assert.match(open, /navigate\('listingComposer'\)/);
});

// ---- Plain-language refusals
test('every refusal has a plain sentence that says what to do', () => {
  assert.equal(LISTING_CHANGED_MESSAGE, 'This listing changed. Reload to see the latest version.');
  assert.match(LISTING_NOT_EDITABLE_MESSAGE, /^This listing can no longer be edited/);
  assert.equal(PROPERTY_CHANGED_MESSAGE, 'This property changed. Reload to see the latest version.');
  assert.match(TENANCY_BINDING_MESSAGE, /^Existing agreements remain binding/);
  assert.match(TENANCY_FIELD_MESSAGE, /^Existing agreements remain binding/);
  assert.equal(RELOAD_LABEL, 'Reload latest version');
  for (const m of [LISTING_CHANGED_MESSAGE, LISTING_NOT_EDITABLE_MESSAGE, PROPERTY_CHANGED_MESSAGE, TENANCY_BINDING_MESSAGE, TENANCY_FIELD_MESSAGE]) assert.ok(!/40001|22023|P0001|PGRST|rpc|edit_version|elsewhere/i.test(m), m);
});
test('the old wording is gone from the services', () => {
  for (const f of ['publishedListingService.ts', 'propertyRoutineService.ts', 'listingDraftService.ts']) {
    const s = readFileSync(`src/features/property-listing/services/${f}`, 'utf8');
    if (f !== 'listingDraftService.ts') assert.ok(!/changed elsewhere|Load the latest saved version|Reload the saved version|Material property details/.test(s), f);
  }
  assert.match(readFileSync('src/features/property-listing/components/ListingWorkspaceFeedback.tsx', 'utf8'), /draft\.conflict \? RELOAD_LABEL/);
});

// ---- The tappable step header
const load = (file: string): any => {
  const req = (key: string): any => key === 'react/jsx-runtime' ? { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) } : key === 'react-native' ? { Text: 'Text', View: 'View', Pressable: 'Pressable' } : (() => { const n = key.split('/').at(-1)!; return n === 'colors' ? { colors: { primaryAction: '#32743C', border: '#D9D9D9' } } : n === 'ui' ? { ui: {} } : { [n]: n }; })();
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  return m.exports;
};
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const flat = (style: any) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
test('the step header: every step but the current one is a 48dp button that reports its number', () => {
  const PostingProgress = load('src/features/property-listing/components/PostingProgress.tsx').PostingProgress, picked: number[] = [];
  for (const step of [1, 2, 3, 4] as const) {
    const tree = PostingProgress({ step, onSelect: (n: number) => picked.push(n) });
    const buttons = nodes(tree).filter(n => n.type === 'Pressable');
    assert.deepEqual(buttons.map(b => b.props.accessibilityLabel), [1, 2, 3, 4].filter(n => n !== step).map(n => `Go to step ${n} of 4, ${['Property', 'Listing', 'Price', 'Review'][n - 1]}`), `from step ${step}`);
    for (const b of buttons) { assert.equal(b.props.accessibilityRole, 'button'); assert.ok(flat(b.props.style).minHeight >= 48); }
    buttons.forEach(b => b.props.onPress());
  }
  assert.deepEqual(picked, [2, 3, 4, 1, 3, 4, 1, 2, 4, 1, 2, 3]);
});
test('without onSelect the header is the plain, non-interactive one it was before', () => {
  const PostingProgress = load('src/features/property-listing/components/PostingProgress.tsx').PostingProgress, tree = PostingProgress({ step: 2 });
  assert.equal(nodes(tree).filter(n => n.type === 'Pressable').length, 0);
  assert.equal(tree.props.children[1].props.children.length, 4, 'the four segments stay the second child');
  assert.match(tree.props.accessibilityLabel, /Posting step 2 of 4: Listing/);
});
test('all four wizard steps pass the header handler', () => {
  for (const [file, step] of [['ListingComposerView', 1], ['ListingDetailsView', 2], ['PostingEstimateView', 3], ['PostingReviewView', 4]] as const) {
    assert.match(readFileSync(`src/features/property-listing/views/${file}.tsx`, 'utf8'), new RegExp(`<PostingProgress step=\\{${step}\\} onSelect=\\{vm\\.goToPostingStep\\}/>`), file);
  }
});
test('the rent field is on the Price step only (Listing step has it just outside the wizard) and edit mode saves on Review', () => {
  assert.match(readFileSync('src/features/property-listing/views/ListingDetailsView.tsx', 'utf8'), /\{!vm\.postingWizard\?<ListingField editable=\{editable\} required error=\{issueNow\?\.field==='askingRent'/);
  const price = readFileSync('src/features/property-listing/views/PostingEstimateView.tsx', 'utf8');
  assert.ok(!/rentHere|Edit it on the Listing step/.test(price));
  assert.match(price, /label="Your monthly asking rent"/);
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /priceIssue:postingWizard\?listingValidationIssue:null/);
  assert.match(vm, /listingStepIssue:postingWizard\?listingDetailsIssue\(draft\):listingValidationIssue/);
  assert.match(vm, /continuePostingReview:async\(\)=>\{if\(!postingWizard\|\|screen!=='postingEstimate'\|\|operationBusy\(\)\)return;const issue=listingFieldIssue\(draft\);if\(issue\)\{setPriceAttempted\(true\);setComposerNotice\(issue\.message\);return;\}if\(editingPublished\)\{navigate\('postingReview'\);return;\}/);
  assert.match(readFileSync('src/features/property-listing/views/PostingReviewView.tsx', 'utf8'), /label=\{saving\?'Saving\.\.\.':'Save Changes'\}/);
});
test('the header never saves the listing in edit mode: reaching Review from Step 1 navigates after the property save', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  const go = vm.match(/goToPostingStep:\(target:1\|2\|3\|4\):void=>\{[\s\S]*?\r?\n    \},\r?\n    editPostingStep/)![0];
  assert.match(go, /const viaReview=target===4&&editingPublished,dest=viaReview\|\|target===2\?null:names\[target\]/);
  assert.match(go, /if\(viaReview&&workspaceRef\.current\.propertyId&&!propertyRoutine\.dirty\(\)&&!r\.error&&!r\.conflict&&!r\.uncertain\)navigate\('postingReview'\)/);
  assert.match(go, /returnToRef\.current=dest;setReturnTo\(dest\)/);
  assert.match(go, /if\(target<from\)\{setReturnTo\(null\);navigate\(names\[target\]\);return;\}/);
  assert.match(go, /if\(!postingWizard\|\|operationBusy\(\)\|\|initialHydrationPending\(\)\)return;/);
});
