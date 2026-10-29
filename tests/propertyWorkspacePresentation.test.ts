/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

function presentation(path: string, exports: string) {
  const absolute = resolve(path), actual = createRequire(absolute);
  const req = (name: string): any => {
    if (name === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
    if (name === 'react-native') return { Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', TextInput: 'TextInput', RefreshControl: 'RefreshControl', StyleSheet: { create: (x: any) => x } };
    const part = ['FullscreenDocumentImage', 'PropertyMediaSection', 'PropertyMediaViewer', 'ComposerRecoveryFeedback', 'ComposerPropertyFields', 'PropertyLocationToolView', 'FeedbackNotice', 'ListingButton', 'ListingWorkspaceFeedback', 'ListingWizardScaffold', 'ListingField', 'ChoiceChip'].find(p => name.endsWith('/' + p));
    if (part) return { [part]: part };
    if (name.endsWith('/ListingControls')) return { ChoiceChip: 'ChoiceChip', ListingField: 'ListingField' };
    return actual(name);
  };
  const mod = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
  return mod.exports[exports];
}
const feedback = () => presentation('src/features/property-listing/components/ListingWorkspaceFeedback.tsx', 'ListingWorkspaceFeedback');
function vm() { return { workspacePropertyId: 'B', workspaceListingId: 'B-listing', listingDraftState: { propertyId: 'A', listingId: 'A-listing', error: 'A draft error' }, publicationState: { propertyId: 'A', listingId: 'A-listing', error: 'A publication error', uncertain: true }, lifecycleState: { propertyId: 'A', listingId: 'A-listing', error: 'A lifecycle error', uncertain: true } }; }
for (const scope of ['draft', 'publication', 'management']) test(`${scope} feedback never shows another property/listing's notices`, () => {
  const render = feedback(); assert.doesNotMatch(JSON.stringify(render({ viewModel: vm(), scope })), /A draft error|A publication error|A lifecycle error/);
});
test('creation without selection has no listing feedback, and matching draft excludes lifecycle', () => {
  const render = feedback(); assert.equal(render({ viewModel: { ...vm(), workspacePropertyId: null }, scope: 'draft' }), null);
  const current = vm(); current.listingDraftState.propertyId = 'B'; current.listingDraftState.listingId = 'B-listing';
  assert.match(JSON.stringify(render({ viewModel: current, scope: 'draft' })), /A draft error/);
  assert.doesNotMatch(JSON.stringify(render({ viewModel: current, scope: 'draft' })), /A lifecycle error/);
});
test('same-property different-listing status is not displayed as the selected listing', () => {
  const current = vm(); current.publicationState.propertyId = 'B'; current.lifecycleState.propertyId = 'B';
  assert.doesNotMatch(JSON.stringify(feedback()({ viewModel: current, scope: 'management' })), /A publication error|A lifecycle error/);
});
test('composer renders before persistence with local media and physical/location controls', () => {
  const render = presentation('src/features/property-listing/views/ListingComposerView.tsx', 'ListingComposerView');
  const tree = render({ viewModel: { workspacePropertyId: null, propertyState: { draft: {}, loaded: true, recent: [] }, photoState: { photos: [], pendingSelections: [] }, propertyPhotos: {}, propertyLocation: {}, locationState: { stage: 'closed' }, draft: { amenities: [] }, listingDraftState: {} }, onClose() {} });
  assert.match(JSON.stringify(tree), /ComposerPropertyFields/); assert.match(JSON.stringify(tree), /PropertyMediaSection/); assert.doesNotMatch(JSON.stringify(tree), /Property saved\. Continue/);
});
test('dashboard empty state comes from loaded owned-property data rather than a fixture route', () => {
  const render = presentation('src/features/property-listing/views/PropertyDashboardView.tsx', 'PropertyDashboardView');
  const viewModel = { screen: 'dashboard', portfolioState: { loaded: true, items: [], query: '', refreshing: false }, portfolioItems: [], portfolioStatistics: { properties: 0, published: 0, drafts: 0, rented: 0 }, portfolio: { load() {} } };
  const tree = JSON.stringify(render({ viewModel })); assert.match(tree, /No properties yet/); assert.doesNotMatch(tree, /UC-06|TENANTED|OVERDUE/);
});
test('unified composer keeps media first, every physical/address field, a mounted scroll surface and temporary map modal', () => {
  const composer = readFileSync('src/features/property-listing/views/ListingComposerView.tsx', 'utf8');
  const fields = readFileSync('src/features/property-listing/components/ComposerPropertyFields.tsx', 'utf8');
  assert.ok(composer.indexOf('<PropertyMediaSection') < composer.indexOf('<ComposerPropertyFields'));
  for (const label of ['Property type', 'Bedrooms', 'Bathrooms', 'Floor area', 'Floor number', 'Total floors', 'Maximum occupants', 'Furnishing', 'City', 'Barangay', 'Address line 1', 'Address line 2', 'Postal code', 'Access instructions']) assert.ok(fields.includes(label), label);
  assert.match(composer, /<Modal visible=\{mapOpen\} onRequestClose=\{vm\.propertyLocation\.cancel\}/);
  assert.match(composer, /<ListingWizardScaffold/); assert.match(composer, /<PropertyLocationToolView/);
  assert.doesNotMatch(fields, /getSupabaseClient|\.rpc\(|\/services\//);
  const tool = readFileSync('src/features/property-listing/views/PropertyLocationToolView.tsx', 'utf8');
  assert.match(tool, /locationFlow\.confirmExact\(token\)/); assert.match(tool, /PropertyLocationMapView/);
  const flow = readFileSync('src/features/property-listing/views/PropertyListingFlowView.tsx', 'utf8');
  assert.match(flow, /viewModel\.screen === 'listingComposer'\) \{/);
});
test('Property media has a large active preview, selectable thumbnails, explicit cover action and inert interior 360 control', () => {
  const open: number[] = [], covers: string[] = [];
  const viewModel = { mediaItems: [{ key: 'saved:a', uri: 'https://example.test/a', label: 'Room', status: 'Saved', cover: false, photoId: 'a' }, { key: 'selected:0', uri: 'file:///cache/b.jpg', label: 'Kitchen', status: 'Selected', cover: false, pendingIndex: 0 }], photoState: { activeMediaIndex: 0, busy: false, loaded: true, pendingSelections: [], batch: { status: 'idle' } }, workspacePropertyId: 'property', propertyPhotos: { openMedia: (index: number) => open.push(index), setCover: (id: string) => covers.push(id) } };
  const tree = presentation('src/features/property-listing/components/PropertyMediaSection.tsx', 'PropertyMediaSection')({ viewModel });
  const nodes = (value: any): any[] => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : [];
  const all = nodes(tree);
  all.find(n => n.props?.accessibilityLabel === 'View photo 2, Selected').props.onPress(); assert.deepEqual(open, [1]); assert.deepEqual(covers, []);
  all.find(n => n.props?.accessibilityLabel === 'Open photo 1 fullscreen, Saved').props.onPress(); assert.deepEqual(open, [1, 0]);
  const large = all.find(n => n.type === 'Image' && n.props.style?.aspectRatio === 4 / 3); assert.equal(large.props.source.uri, 'https://example.test/a');
  const interior = all.find(n => n.props?.label === 'Add 360° interior'); assert.equal(interior.props.disabled, true); interior.props.onPress(); assert.deepEqual(covers, []);
  const cover = all.find(n => n.type === 'Pressable' && nodes(n.props.children).some(child => child.props?.children === 'Set as cover'));
  cover.props.onPress(); assert.deepEqual(covers, ['a']);
});
test('property viewer uses the shared zoom image for local/saved sources with bounded next/previous and Close', () => {
  const render = presentation('src/features/property-listing/components/PropertyMediaViewer.tsx', 'PropertyMediaViewer');
  let closed = 0, next = 0;
  const viewModel = { photoState: { activeMediaIndex: 0, mediaViewerOpen: true }, mediaItems: [{ uri: 'file:///cache/a.jpg', status: 'Selected' }, { uri: 'https://example.test/b.jpg', status: 'Saved' }], propertyPhotos: { closeMedia: () => closed++, nextMedia: () => next++, previousMedia() {} } };
  const tree = render({ viewModel }); assert.equal(tree.props.uri, 'file:///cache/a.jpg'); assert.equal(tree.props.title, 'Photo 1 of 2'); assert.equal(tree.props.onPrevious, undefined); tree.props.onNext(); tree.props.onClose(); assert.equal(closed, 1); assert.equal(next, 1);
  viewModel.photoState.activeMediaIndex = 1; const saved = render({ viewModel }); assert.equal(saved.props.uri, 'https://example.test/b.jpg'); assert.equal(saved.props.onNext, undefined); assert.equal(saved.props.description, 'Saved');
});
test('Listing Details keeps every rental field and a compact property summary without physical inputs or media manager', () => {
  const source = readFileSync('src/features/property-listing/views/ListingDetailsView.tsx', 'utf8');
  for (const field of ['title', 'askingRent', 'description', 'rentalTerm', 'securityDepositMonths', 'advanceRentMonths', 'minimumStayMonths', 'houseRules', 'availableDate']) assert.match(source, new RegExp(`draft\\.${field}`));
  assert.match(source, /label="Edit property"/); assert.doesNotMatch(source, /ComposerPropertyFields|PropertyMediaSection|updateField\(|label="Address|label="Bedrooms|label="Amenities/);
  const property = readFileSync('src/features/property-listing/views/ListingComposerView.tsx', 'utf8'); assert.match(property, /Next: Listing details/); assert.doesNotMatch(property, /Save draft|Listing title|Monthly asking rent/);
});
test('gallery swipe navigation reuses existing pinch/pan implementation and numeric-source reset', () => {
  const shared = readFileSync('src/shared/components/FullscreenDocumentImage.tsx', 'utf8');
  assert.match(shared, /Gesture\.Pinch\(\)/); assert.match(shared, /panImage\(/); assert.match(shared, /imageGallerySwipe\(/); assert.match(shared, /key=\{source.version\}/); assert.match(shared, /onRequestClose=\{props.onClose\}/);
});
