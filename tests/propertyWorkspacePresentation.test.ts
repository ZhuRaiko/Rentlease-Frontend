import { listingCompleteness, type CompletenessInput } from '../src/features/property-listing/models/ListingCompleteness';
/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { propertiesWorkspace } from '../src/shared/models/marketplaceNavigation';

function presentation(path: string, exports: string) {
  const absolute = resolve(path), actual = createRequire(absolute);
  const hookStates:any[]=[];let hookCursor=0;const announcements:string[]=[];const viewport={width:360,height:800,fontScale:1};
  const req = (name: string): any => {
    if(name==='react')return {useState:(initial:any)=>{const index=hookCursor++;if(!(index in hookStates))hookStates[index]=typeof initial==='function'?initial():initial;return [hookStates[index],(value:any)=>{hookStates[index]=typeof value==='function'?value(hookStates[index]):value;}];}};
    if(name.endsWith('.png'))return 1;
    if (name === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
    if(name.endsWith('/PropertyProgressFooter')&&!absolute.endsWith('PropertyProgressFooter.tsx'))return {PropertyProgressFooter:'PropertyProgressFooter',PropertyReadinessNotice:'PropertyReadinessNotice'};
  if(name.endsWith('/usePropertyFormFocus'))return {usePropertyFormFocus:()=>({scrollRef:{current:null},contentRef:{current:null},section:()=>()=>{},field:()=>()=>{}})};
  if (name === 'react-native') return {AccessibilityInfo:{announceForAccessibility:(text:string)=>announcements.push(text)},useWindowDimensions:()=>viewport, Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', TextInput: 'TextInput', RefreshControl: 'RefreshControl', StyleSheet: { create: (x: any) => x } };
    const part = ['PropertyVerificationAction', 'PropertyValidationSummary', 'PropertyFloorFields', 'CompletenessHint', 'ListingCompletenessSummary', 'PropertyAmenitiesFields', 'FieldLabel', 'AvailabilityDateField', 'ScreenHeader', 'PropertyPhotosView', 'PropertySetupView', 'FigmaReferenceCrop', 'FullscreenDocumentImage', 'PropertyMediaSection', 'PropertyMediaViewer', 'ComposerRecoveryFeedback', 'ComposerPropertyFields', 'PropertyLocationToolView', 'FeedbackNotice', 'ListingButton', 'ListingWorkspaceFeedback', 'ListingWizardScaffold', 'ListingField', 'ChoiceChip'].find(p => name.endsWith('/' + p));
    if (part && !absolute.endsWith('/'+part+'.tsx') && !absolute.endsWith('\\'+part+'.tsx')) return { [part]: part };
    if (name.endsWith('/ListingControls')) return { ChoiceChip: 'ChoiceChip', ListingField: 'ListingField' };
    return actual(name);
  };
  const mod = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
  return Object.assign((...args:any[])=>{hookCursor=0;if(exports==='ListingDetailsView'&&args[0]?.viewModel&&!args[0].viewModel.draftHydration)args[0].viewModel.draftHydration={status:'idle',error:null};return mod.exports[exports](...args);},{announcements,viewport});
}
const feedback = () => presentation('src/features/property-listing/components/ListingWorkspaceFeedback.tsx', 'ListingWorkspaceFeedback');
test('posting chooser routes only Property Listing; Community Post is visibly disabled and Close delegates safely', () => {
  const render=presentation('src/features/property-listing/views/CreateListingView.tsx','CreateListingView');let properties=0,closed=0;
  const tree=render({viewModel:{screen:'postingType',draft:{},propertyState:{busy:false},beginPropertySetup:()=>properties++},onClose:()=>closed++});
  const visit=(node:any):any[]=>node&&typeof node==='object'?[node,...[node.props?.children].flat(Infinity).flatMap(visit)]:[];const all=visit(tree),text=JSON.stringify(tree);
  assert.match(text,/Property Listing/);assert.match(text,/List a property for rent/);assert.match(text,/Community Post/);assert.match(text,/Share with the RentLease community/);assert.match(text,/Coming soon/);
  const community=all.find(n=>n.props?.accessibilityLabel?.startsWith('Community Post'));assert.equal(community.props.disabled,true);assert.equal(community.props.accessibilityState.disabled,true);assert.equal(community.props.onPress,undefined);
  all.find(n=>n.props?.accessibilityLabel?.startsWith('Property Listing')).props.onPress();assert.equal(properties,1);all.find(n=>n.type==='ScreenHeader').props.onClose();assert.equal(closed,1);
});
test('Tenant-only cannot enter the Landlord property posting workspace; Tier 3 never grants that role', () => {
  const tenant={marketplace:true,admin:false,tenant:true,landlord:false};assert.equal(propertiesWorkspace(tenant,'postingType'),null);
  assert.deepEqual(propertiesWorkspace({...tenant,landlord:true},'postingType'),{type:'properties',initialScreen:'postingType'});assert.equal(propertiesWorkspace({...tenant,admin:true,landlord:true},'postingType'),null);
});
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
  const tree = render({ viewModel: { workspacePropertyId: null, propertyState: { draft: {}, loaded: true, recent: [] }, propertyFloorIssues:{floorNumber:null,totalFloors:null}, photoState: { photos: [], pendingSelections: [] }, propertyPhotos: {}, propertyLocation: {}, locationState: { stage: 'closed' }, draft: { amenities: [] }, listingDraftState: {} }, onClose() {} });
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
  for (const label of ['Property type', 'Bedrooms', 'Bathrooms', 'Floor area', 'Maximum occupants', 'Furnishing', 'City', 'Barangay', 'Address line 1', 'Address line 2', 'Postal code', 'Access instructions']) assert.ok(fields.includes(label), label);
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
  const viewModel = { mediaItems: [{ key: 'saved:a', uri: 'https://example.test/a', label: 'Room', status: 'Saved', cover: false, photoId: 'a' }, { key: 'selected:0', uri: 'file:///cache/b.jpg', label: 'Kitchen', status: 'Selected', cover: false, pendingIndex: 0 }], propertyFloorIssues:{floorNumber:null,totalFloors:null}, photoState: { activeMediaIndex: 0, busy: false, loaded: true, pendingSelections: [], batch: { status: 'idle' } }, workspacePropertyId: 'property', propertyPhotos: { openMedia: (index: number) => open.push(index), setCover: (id: string) => covers.push(id) } };
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
  const viewModel = { propertyFloorIssues:{floorNumber:null,totalFloors:null}, photoState: { activeMediaIndex: 0, mediaViewerOpen: true }, mediaItems: [{ uri: 'file:///cache/a.jpg', status: 'Selected' }, { uri: 'https://example.test/b.jpg', status: 'Saved' }], propertyPhotos: { closeMedia: () => closed++, nextMedia: () => next++, previousMedia() {} } };
  const tree = render({ viewModel }); assert.equal(tree.props.uri, 'file:///cache/a.jpg'); assert.equal(tree.props.title, 'Photo 1 of 2'); assert.equal(tree.props.onPrevious, undefined); tree.props.onNext(); tree.props.onClose(); assert.equal(closed, 1); assert.equal(next, 1);
  viewModel.photoState.activeMediaIndex = 1; const saved = render({ viewModel }); assert.equal(saved.props.uri, 'https://example.test/b.jpg'); assert.equal(saved.props.onNext, undefined); assert.equal(saved.props.description, 'Saved');
});
test('Listing Details keeps every rental field and a compact property summary without physical inputs or media manager', () => {
  const source = readFileSync('src/features/property-listing/views/ListingDetailsView.tsx', 'utf8');
  for (const field of ['title', 'askingRent', 'description', 'rentalTerm', 'securityDepositMonths', 'advanceRentMonths', 'minimumStayMonths', 'houseRules', 'availableDate']) assert.match(source, new RegExp(`draft\\.${field}`));
  assert.match(source, /"Edit property"/); assert.doesNotMatch(source, /ComposerPropertyFields|PropertyMediaSection|updateField\(|label="Address|label="Bedrooms|label="Amenities/);
  const property = readFileSync('src/features/property-listing/views/ListingComposerView.tsx', 'utf8'); assert.match(property, /footer=\{<PropertyProgressFooter/);assert.match(readFileSync('src/features/property-listing/components/PropertyProgressFooter.tsx','utf8'),/Next: Listing/); assert.doesNotMatch(property, /Save draft|Listing title|Monthly asking rent/);
});
test('gallery swipe navigation reuses existing pinch/pan implementation and numeric-source reset', () => {
  const shared = readFileSync('src/shared/components/FullscreenDocumentImage.tsx', 'utf8');
  assert.match(shared, /Gesture\.Pinch\(\)/); assert.match(shared, /panImage\(/); assert.match(shared, /imageGallerySwipe\(/); assert.match(shared, /key=\{source.version\}/); assert.match(shared, /onRequestClose=\{props.onClose\}/);
});

function flatten(node:any):any[]{return node&&typeof node==='object'?[node,...[node.props?.children].flat(Infinity).flatMap(flatten)]:[];}
test('physical composer marks only actively required fields and locates first validation issue',()=>{const render=presentation('src/features/property-listing/components/ComposerPropertyFields.tsx','ComposerPropertyFields');const vm:any={workspacePropertyId:null,propertyState:{draft:{amenityIds:[],propertyType:null},loaded:true},propertyCreation:{},propertySummary:{},propertyValidationIssue:{field:'barangay',message:'Enter the property barangay.'}};const nodes=flatten(render({viewModel:vm}));const labels=nodes.filter(n=>n.type==='FieldLabel'&&n.props.required).map(n=>n.props.label);assert.deepEqual(labels,['Property type','City','Location']);const requiredInputs=nodes.filter(n=>n.type==='ListingField'&&n.props.required).map(n=>n.props.label);assert.deepEqual(requiredInputs,['Barangay','Address line 1']);assert.equal(nodes.find(n=>n.type==='ListingField'&&n.props.label==='Barangay').props.error,'Enter the property barangay.');assert.equal(nodes.some(n=>n.props.required&&String(n.props.label).includes('optional')),false);});
test('listing details required title/rent/description preserve optional date and short-description hint',()=>{const render=presentation('src/features/property-listing/views/ListingDetailsView.tsx','ListingDetailsView');const tree=render({viewModel:{draft:{},propertySummary:{},mediaItems:[],propertyState:{draft:{}},photoState:{},listingDraftState:{},listingValidationIssue:{field:'title',message:'Enter a listing title.'}},onClose(){}});const nodes=flatten(tree);assert.deepEqual(nodes.filter(n=>n.type==='ListingField'&&n.props.required).map(n=>n.props.label),['Listing title','Monthly asking rent','Description']);assert.equal(nodes.find(n=>n.props.label==='Description').props.helper.props.factor,'description');assert.equal(nodes.find(n=>n.type==='AvailabilityDateField').props.required,undefined);assert.equal(nodes.find(n=>n.props.label==='House rules (optional)').props.required,undefined);});
test('required label is accessible and asterisk is a separate semantic error color',()=>{const render=presentation('src/features/property-listing/components/FieldLabel.tsx','FieldLabel');const required=render({label:'City',required:true});assert.equal(required.props.accessibilityLabel,'City, required');assert.match(JSON.stringify(required),/\*/);assert.equal(render({label:'Bedrooms'}).props.accessibilityLabel,'Bedrooms');});
test('completeness presentation distinguishes server score and local estimate without ranking claims',()=>{const render=presentation('src/features/property-listing/components/ListingCompletenessSummary.tsx','ListingCompletenessSummary');const local=JSON.stringify(render({value:{percent:75,meetsThreshold:false,source:'estimate',next:[]}}));assert.match(local,/Local estimate/);assert.match(local,/80%/);const server=JSON.stringify(render({value:{percent:80,meetsThreshold:true,source:'server',next:[]}}));assert.match(server,/Saved listing score/);assert.match(server,/other checks still apply/);assert.doesNotMatch(server,/boost|Match Score|ranking/);});

const missingCompleteness:CompletenessInput={title:'',description:'',rent:0,availableDate:false,floorArea:false,maxOccupants:false,location:false,photoCount:0,amenityCount:0};
function contextualHint(factor:keyof CompletenessInput,input:CompletenessInput=missingCompleteness,hidden=false){return presentation('src/features/property-listing/components/CompletenessHint.tsx','CompletenessHint')({value:listingCompleteness(input),factor,hidden});}
test('compact completeness summary keeps percent but never prints detached contribution tasks',()=>{const render=presentation('src/features/property-listing/components/ListingCompletenessSummary.tsx','ListingCompletenessSummary');const tree=JSON.stringify(render({value:listingCompleteness(missingCompleteness)}));assert.match(tree,/Listing completeness/);assert.match(tree,/0/);assert.doesNotMatch(tree,/Add property photos|Write at least 30|Confirm the property location|\+20%/);});
test('location hint is at the location controls and disappears after confirmed handoff',()=>{const render=presentation('src/features/property-listing/components/ComposerPropertyFields.tsx','ComposerPropertyFields');const tree=render({viewModel:{propertyState:{draft:{},loaded:true},propertyCreation:{},propertySummary:{},completeness:listingCompleteness(missingCompleteness)}});const nodes=flatten(tree);const label=nodes.findIndex(n=>n.type==='FieldLabel'&&n.props.label==='Location'),hint=nodes.findIndex(n=>n.type==='CompletenessHint'&&n.props.factor==='location');assert.ok(label>=0&&hint>label);assert.match(JSON.stringify(contextualHint('location')),/15% completeness/);assert.equal(contextualHint('location',{...missingCompleteness,location:true}),null);});
test('description hint uses existing thirty-character completion and is supplied by its field',()=>{const render=presentation('src/features/property-listing/views/ListingDetailsView.tsx','ListingDetailsView');const tree=render({viewModel:{draft:{},propertySummary:{},mediaItems:[],propertyState:{draft:{}},photoState:{},listingDraftState:{},completeness:listingCompleteness(missingCompleteness)},onClose(){}});const field=flatten(tree).find(n=>n.props?.label==='Description');assert.equal(field.props.helper.type,'CompletenessHint');assert.equal(field.props.helper.props.factor,'description');assert.match(JSON.stringify(contextualHint('description',{...missingCompleteness,description:'x'.repeat(29)})),/30.*15% completeness/);assert.equal(contextualHint('description',{...missingCompleteness,description:'x'.repeat(30)}),null);});
test('photo hint appears in the actual media section and local selection completes the action',()=>{const render=presentation('src/features/property-listing/components/PropertyMediaSection.tsx','PropertyMediaSection');const tree=render({viewModel:{photoState:{activeMediaIndex:0,pendingSelections:[],batch:{}},propertyPhotos:{},mediaItems:[],completeness:listingCompleteness(missingCompleteness)}});assert.ok(flatten(tree).some(n=>n.type==='CompletenessHint'&&n.props.factor==='photoCount'));assert.match(JSON.stringify(contextualHint('photoCount')),/20% completeness/);assert.equal(contextualHint('photoCount',{...missingCompleteness,photoCount:1}),null);});
test('all optional/context hints share weights and read-only physical guidance can be hidden',()=>{for(const [factor,weight] of [['title',10],['rent',10],['floorArea',10],['maxOccupants',5],['availableDate',5],['amenityCount',10]] as const){assert.match(JSON.stringify(contextualHint(factor)),new RegExp(weight+'% completeness'));assert.equal(contextualHint(factor,missingCompleteness,true),null);}});
test('server score never falsely determines which individual local field is complete',()=>{const render=presentation('src/features/property-listing/components/CompletenessHint.tsx','CompletenessHint');const value=listingCompleteness(missingCompleteness,1);assert.equal(value.percent,100);assert.match(JSON.stringify(render({value,factor:'description'})),/15% completeness/);assert.equal(contextualHint('description',{...missingCompleteness,description:'x'.repeat(30)}),null);});


test('saved physical property is a read-only summary instead of disabled creation controls',()=>{
  const render=presentation('src/features/property-listing/components/ComposerPropertyFields.tsx','ComposerPropertyFields');
  const tree=render({viewModel:{workspacePropertyId:'saved',propertyState:{draft:{propertyType:'studio'}},propertySummary:{type:'Studio',bedrooms:'1',bathrooms:'1',furnishing:'Furnished',floorAreaSqm:'32',location:'Imus'}},children:'Saved amenities'});
  assert.equal(flatten(tree).filter(n=>n.type==='ListingField'||n.type==='ChoiceChip').length,0);
  assert.match(JSON.stringify(tree),/read-only/);assert.match(JSON.stringify(tree),/Property editing is not connected/);assert.match(JSON.stringify(tree),/32/);
});

test('photo reconciliation has visible success feedback and only offers recovery when needed',()=>{
  const render=presentation('src/features/property-listing/components/PropertyMediaSection.tsx','PropertyMediaSection');let checks=0;
  const vm:any={workspacePropertyId:'saved',mediaItems:[],photoState:{busy:false,loaded:true,needsReconcile:false,pendingSelections:[],batch:{status:'idle'},notice:'Photo status refreshed.'},propertyPhotos:{checkStatus:()=>checks++}};
  let nodes=flatten(render({viewModel:vm}));assert.ok(nodes.some(n=>n.type==='FeedbackNotice'&&n.props.message==='Photo status refreshed.'));assert.equal(nodes.some(n=>n.props.label==='Check saved photos'),false);
  vm.photoState.needsReconcile=true;nodes=flatten(render({viewModel:vm}));nodes.find(n=>n.props.label==='Check saved photos').props.onPress();assert.equal(checks,1);
});


test('shared optional floor inputs show cross-field errors without defaults or unit-number confusion',()=>{
  const render=presentation('src/features/property-listing/components/PropertyFloorFields.tsx','PropertyFloorFields');let changed:any;
  const nodes=flatten(render({propertyType:'apartment',floorNumber:'6',totalFloors:'5',errors:{floorNumber:'Invalid floor relationship',totalFloors:'Invalid floor relationship'},onChange:(...args:any[])=>changed=args}));
  const fields=nodes.filter(n=>n.type==='ListingField');assert.deepEqual(fields.map(n=>n.props.label),["Unit's floor (optional)",'Floors in building (optional)']);assert.deepEqual(fields.map(n=>n.props.value),['6','5']);assert.ok(fields.every(n=>n.props.invalid===true&&!n.props.error&&!n.props.required));fields[0].props.onChangeText('2');assert.deepEqual(changed,['floorNumber','2']);assert.match(JSON.stringify(nodes),/2nd floor of a 5-story/);assert.match(JSON.stringify(nodes),/Unit numbers belong in the address/);
  const empty=flatten(render({propertyType:'apartment',floorNumber:'',totalFloors:'',errors:{floorNumber:null,totalFloors:null},onChange:()=>{}})).filter(n=>n.type==='ListingField');assert.ok(empty.every(n=>n.props.value===''&&n.props.placeholder.startsWith('e.g.')));
});


test('floor section renders its shared relationship error once and whole-house stories without a unit field',()=>{
 const render=presentation('src/features/property-listing/components/PropertyFloorFields.tsx','PropertyFloorFields');
 const nodes=flatten(render({propertyType:'apartment',floorNumber:'8',totalFloors:'2',errors:{floorNumber:'Invalid pair',totalFloors:'Invalid pair'},onChange:()=>{}}));assert.equal(nodes.filter(n=>n.props.children==='Invalid pair').length,1);assert.equal(nodes.filter(n=>n.props.invalid).length,2);
 const house=flatten(render({propertyType:'house',floorNumber:'8',totalFloors:'2',errors:{floorNumber:null,totalFloors:null},onChange:()=>{}}));assert.deepEqual(house.filter(n=>n.type==='ListingField').map(n=>n.props.label),['Number of stories (optional)']);assert.match(JSON.stringify(house),/kept locally/);
});
test('validation summary groups real invalid sections and invokes the corresponding correction action',()=>{
 const render=presentation('src/features/property-listing/components/PropertyValidationSummary.tsx','PropertyValidationSummary');let selected:any;
 const issues=[{section:'address',field:'barangay',kind:'required',message:'Enter barangay'},{section:'address',field:'city',kind:'required',message:'Choose city'},{section:'floors',field:'floorNumber',kind:'invalid',message:'Invalid pair'}];
 const nodes=flatten(render({issues,onSelect:(issue:any)=>selected=issue}));const actions=nodes.filter(n=>n.type==='Pressable');assert.equal(actions.length,2);actions[1].props.onPress();assert.equal(selected,issues[2]);assert.match(JSON.stringify(nodes),/Required information missing/);assert.match(JSON.stringify(nodes),/Check entered information/);assert.equal(render({issues:[],onSelect:()=>{}}),null);
});
for(const stale of [false,true])test(`native correction focus scrolls safely and rejects stale measurement: ${stale}`,()=>{
 const perform=presentation('src/features/property-listing/components/usePropertyFormFocus.ts','performPropertyFocus');let callback:any;const events:any[]=[];let active=true;
 perform({section:'floors',field:'floorNumber',message:'Invalid pair',requestId:1},{measureLayout:(_content:any,done:any)=>callback=done},{},{scrollTo:(point:any)=>events.push(point)},{focus:()=>events.push('focus')},()=>active,(message:string)=>events.push(message));if(stale)active=false;callback(0,240);assert.deepEqual(events,stale?[]:[{y:224,animated:true},'focus','Invalid pair']);
});


test('the primary recovery notice does not repeat a current section validation message',()=>{
 const render=presentation('src/features/property-listing/components/ComposerRecoveryFeedback.tsx','ComposerRecoveryFeedback');
 const vm:any={workspacePropertyActive:true,workspacePropertyId:null,propertyState:{error:'Invalid floor pair',loaded:true,uncertain:false},propertyValidationIssues:[{message:'Invalid floor pair'}]};
 assert.equal(flatten(render({viewModel:vm})).some(n=>n.type==='FeedbackNotice'&&n.props.message==='Invalid floor pair'),false);
 vm.propertyState.error='A backend operation failed';assert.ok(flatten(render({viewModel:vm})).some(n=>n.props.message==='A backend operation failed'));
});


for(const disabled of [true,false])test(`Stage 1 footer binds the real Next readiness and disabled state: ${disabled}`,()=>{
 const render=presentation('src/features/property-listing/components/PropertyProgressFooter.tsx','PropertyProgressFooter');let next=0;const vm:any={completeness:listingCompleteness(missingCompleteness),propertyNextDisabled:disabled,nextListingDetails:()=>next++};
 const nodes=flatten(render({viewModel:vm}));const button=nodes.find(n=>n.type==='ListingButton');assert.equal(button.props.label,'Next: Listing');assert.equal(button.props.disabled,disabled);if(!disabled)button.props.onPress();assert.equal(next,disabled?0:1);assert.equal(nodes.some(n=>n.type==='PropertyValidationSummary'),false);
});
test('Stage 1 readiness explanation is accessible while Next is disabled without another checklist',()=>{
 const render=presentation('src/features/property-listing/components/PropertyProgressFooter.tsx','PropertyReadinessNotice');let reviews=0;const vm:any={propertyReadinessReviewAvailable:true,propertyNextStatus:'Enter the property barangay.',reviewPropertyReadiness:()=>reviews++};
 const tree=render({viewModel:vm});assert.equal(tree.type,'Pressable');assert.equal(tree.props.accessibilityRole,'button');assert.match(tree.props.accessibilityLabel,/barangay.*Review the first field/);tree.props.onPress();assert.equal(reviews,1);assert.doesNotMatch(JSON.stringify(tree),/Before saving the property/);vm.propertyReadinessReviewAvailable=false;assert.equal(render({viewModel:vm}).type,'Text');
});
test('Stage 1 action footer remains outside the scroll content and does not overlay form controls',()=>{
 const render=presentation('src/features/property-listing/components/ListingWizardScaffold.tsx','ListingWizardScaffold');const marker={type:'Text',props:{children:'Persistent action'}};
 const tree=render({footer:marker,onClose:()=>{},children:{type:'Text',props:{children:'Last property field'}}});const scroll=flatten(tree).find(n=>n.type==='ScrollView');assert.ok(scroll);assert.doesNotMatch(JSON.stringify(scroll),/Persistent action/);assert.match(JSON.stringify(tree),/Persistent action/);assert.equal(scroll.props.keyboardShouldPersistTaps,'handled');
});
test('Stage 1 ordinary Property presentation has no validation checklist or action inside the scroll body',()=>{
 const render=presentation('src/features/property-listing/views/ListingComposerView.tsx','ListingComposerView');const vm:any={workspacePropertyId:null,propertyState:{draft:{},loaded:true},photoState:{},locationState:{stage:'closed'},propertyLocation:{}};
 const tree=render({viewModel:vm,onClose:()=>{}}),scaffold=flatten(tree).find(n=>n.type==='ListingWizardScaffold');assert.equal(scaffold.props.footer.type,'PropertyProgressFooter');assert.equal(flatten(scaffold).some(n=>n.type==='PropertyValidationSummary'),false);assert.equal(flatten(scaffold).some(n=>n.type==='ListingButton'&&String(n.props.label).startsWith('Next:')),false);
});
test('Stage 1 contextual field errors respect visible interaction metadata and clear without red untouched fields',()=>{
 const render=presentation('src/features/property-listing/components/ComposerPropertyFields.tsx','ComposerPropertyFields');const vm:any={workspacePropertyId:null,propertyState:{draft:{propertyType:null},loaded:true},propertyCreation:{},propertySummary:{},propertyValidationIssue:null,propertyVisibleValidationIssues:[],propertyValidationIssues:[{field:'barangay',message:'Enter the property barangay.'}],propertyFloorIssues:{floorNumber:null,totalFloors:null}};
 const field=()=>flatten(render({viewModel:vm})).find(n=>n.type==='ListingField'&&n.props.label==='Barangay');assert.equal(field().props.error,null);vm.propertyVisibleValidationIssues=vm.propertyValidationIssues;assert.equal(field().props.error,'Enter the property barangay.');vm.propertyVisibleValidationIssues=[];assert.equal(field().props.error,null);
});


for(const source of ['estimate','server'] as const)test(`Stage 2 footer displays the exact ${source} completeness without changing readiness`,()=>{
 const render=presentation('src/features/property-listing/components/PropertyProgressFooter.tsx','PropertyProgressFooter');const value={...listingCompleteness(missingCompleteness),percent:source==='server'?87:25,source};
 const vm:any={completeness:value,propertyNextDisabled:false,nextListingDetails:()=>{}};const nodes=flatten(render({viewModel:vm}));assert.ok(nodes.some(n=>n.props.children===`${value.percent}%`));const progress=nodes.find(n=>n.props.accessibilityRole==='progressbar');assert.equal(progress.props.accessibilityValue.now,value.percent);assert.match(progress.props.accessibilityValue.text,source==='server'?/backend/:/local/);assert.equal(nodes.find(n=>n.type==='ListingButton').props.disabled,false);
});
test('Stage 2 information panel expands and collapses without changing form values or invoking persistence',()=>{
 const render=presentation('src/features/property-listing/components/PropertyProgressFooter.tsx','PropertyProgressFooter');let writes=0;const vm:any={completeness:listingCompleteness(missingCompleteness),propertyNextDisabled:true,propertyReadinessReviewAvailable:true,propertyNextStatus:'Choose a supported property type.',draft:{title:'Retained title'},propertyState:{draft:{floorNumber:'2'}},saveComposerDraft:()=>writes++,nextListingDetails:()=>writes++};const before=JSON.stringify(vm);
 const info=(tree:any)=>flatten(tree).find(n=>n.props.accessibilityLabel==='About listing completeness');let tree=render({viewModel:vm});assert.equal(info(tree).props.accessibilityState.expanded,false);assert.doesNotMatch(JSON.stringify(tree),/Property-specific Tier 3/);info(tree).props.onPress();tree=render({viewModel:vm});assert.equal(info(tree).props.accessibilityState.expanded,true);const text=JSON.stringify(flatten(tree).find(n=>n.type==='ScrollView'));assert.match(text,/local estimate/i);assert.match(text,/80%/);assert.match(text,/Property-specific Tier 3/);assert.doesNotMatch(text,/Add a listing title|Write at least 30|Add maximum occupants/);info(tree).props.onPress();tree=render({viewModel:vm});assert.equal(info(tree).props.accessibilityState.expanded,false);assert.equal(JSON.stringify(vm),before);assert.equal(writes,0);assert.deepEqual(render.announcements,['Completeness information expanded.','Completeness information collapsed.']);
});
test('Stage 2 Property has no large inline completeness block and keeps contextual field hints',()=>{
 const render=presentation('src/features/property-listing/views/ListingComposerView.tsx','ListingComposerView');const vm:any={workspacePropertyId:null,propertyState:{},locationState:{stage:'closed'},propertyLocation:{}};const nodes=flatten(render({viewModel:vm,onClose:()=>{}}));assert.equal(nodes.some(n=>n.type==='ListingCompletenessSummary'),false);assert.doesNotMatch(JSON.stringify(nodes),/score above covers/);assert.ok(nodes.some(n=>n.type==='ComposerPropertyFields'));const fields=readFileSync('src/features/property-listing/components/ComposerPropertyFields.tsx','utf8');assert.match(fields,/CompletenessHint/);
});


test('Stage 2 expanded panel honors backend authority and excludes unsaved local changes from its claim',()=>{
 const render=presentation('src/features/property-listing/components/PropertyProgressFooter.tsx','PropertyProgressFooter');const vm:any={completeness:listingCompleteness(missingCompleteness,0.87),propertyNextDisabled:false,nextListingDetails:()=>{}};let tree=render({viewModel:vm});flatten(tree).find(n=>n.props.accessibilityLabel==='About listing completeness').props.onPress();tree=render({viewModel:vm});const text=JSON.stringify(tree);assert.match(text,/Backend-confirmed score/);assert.match(text,/Unsaved changes are not included/);assert.doesNotMatch(text,/This is a local estimate/);assert.ok(flatten(tree).some(n=>n.props.children==='87%'));
});
test('Stage 2 high completeness cannot enable invalid Next and unnecessary readiness guidance is omitted',()=>{
 const render=presentation('src/features/property-listing/components/PropertyProgressFooter.tsx','PropertyProgressFooter');const vm:any={completeness:{...listingCompleteness(missingCompleteness),percent:100},propertyNextDisabled:true,nextListingDetails:()=>{}};
 let nodes=flatten(render({viewModel:vm}));assert.equal(nodes.find(n=>n.type==='ListingButton').props.disabled,true);assert.ok(nodes.some(n=>typeof n.type==='function'&&n.type.name==='PropertyReadinessNotice'));vm.propertyNextDisabled=false;nodes=flatten(render({viewModel:vm}));assert.equal(nodes.some(n=>typeof n.type==='function'&&n.type.name==='PropertyReadinessNotice'),false);
});
test('Stage 2 expanded explanation is bounded for a smaller keyboard viewport while the primary action stays outside it',()=>{
 const render=presentation('src/features/property-listing/components/PropertyProgressFooter.tsx','PropertyProgressFooter');const vm:any={completeness:listingCompleteness(missingCompleteness),propertyNextDisabled:false,nextListingDetails:()=>{}};render.viewport.height=320;render.viewport.width=320;render.viewport.fontScale=2;
 let tree=render({viewModel:vm});const toggle=flatten(tree).find(n=>n.props.accessibilityLabel==='About listing completeness');assert.ok(toggle.props.style.minHeight>=48);toggle.props.onPress();tree=render({viewModel:vm});const panel=flatten(tree).find(n=>n.type==='ScrollView');assert.equal(panel.props.style.maxHeight,80);assert.equal(panel.props.keyboardDismissMode,'none');assert.equal(panel.props.keyboardShouldPersistTaps,'handled');assert.equal(flatten(panel).some(n=>n.type==='ListingButton'),false);assert.ok(flatten(tree).some(n=>n.type==='ListingButton'));
});

 test('draft saved destination clearly separates saved from published and delegates both actions',()=>{
 let opened=0,portfolio=0;const render=presentation('src/features/property-listing/views/ListingDraftSavedView.tsx','ListingDraftSavedView');
 const tree=render({viewModel:{openSavedDraft:()=>opened++,goDashboard:()=>portfolio++},onClose:()=>{}});assert.equal(tree.props.title,'Listing Draft Saved!');assert.match(JSON.stringify(tree),/not published/);
 const nodes=(n:any):any[]=>n&&typeof n==='object'?[n,...[n.props?.children].flat(Infinity).flatMap(nodes)]:[];const all=nodes(tree);all.find(n=>n.props?.label==='Open saved listing').props.onPress();all.find(n=>n.props?.label==='My Listings').props.onPress();assert.equal(opened,1);assert.equal(portfolio,1);
 });
 test('draft feedback retries known save failures but reconciles unknown outcomes without saving',()=>{
 let saved=0,reconciled=0;const render=feedback();const current:any=vm();current.listingDraftState={propertyId:'B',listingId:'B-listing',loaded:true,error:'Save failed',errorSource:'save',uncertain:false,busy:false};current.publicationState.uncertain=false;current.saveComposerDraft=()=>saved++;current.listingDraftPersistence={reconcile:()=>reconciled++};
 const nodes=(n:any):any[]=>n&&typeof n==='object'?[n,...[n.props?.children].flat(Infinity).flatMap(nodes)]:[];nodes(render({viewModel:current,scope:'draft'})).find(n=>n.props?.label==='Retry saving draft').props.onPress();assert.equal(saved,1);current.listingDraftState.uncertain=true;nodes(render({viewModel:current,scope:'draft'})).find(n=>n.props?.label==='Check draft save status').props.onPress();assert.equal(reconciled,1);assert.equal(saved,1);
 });

 test('Listing Details shares the persistent completeness footer and retains field hints and Stage 3 save',()=>{
 const render=presentation('src/features/property-listing/views/ListingDetailsView.tsx','ListingDetailsView');let saves=0;const vm:any={draft:{},propertySummary:{},mediaItems:[],propertyState:{draft:{}},photoState:{},listingDraftState:{},completeness:listingCompleteness(missingCompleteness),composerSaveDisabled:false,saveComposerDraft:()=>saves++};
 const tree=render({viewModel:vm,onClose(){}});const footer=tree.props.footer;assert.equal(footer.type,'PropertyProgressFooter');assert.equal(footer.props.action.label,'Save Draft');assert.equal(footer.props.action.disabled,false);footer.props.action.onPress();assert.equal(saves,1);
 const body=flatten(tree);assert.equal(body.some(n=>n.type==='ListingCompletenessSummary'),false);assert.equal(body.some(n=>n.type==='ListingButton'&&n.props.label==='Save draft'),false);assert.equal(body.find(n=>n.props.label==='Description').props.helper.type,'CompletenessHint');
 vm.composerPhase='draft';vm.composerSaveDisabled=true;const pending=render({viewModel:vm,onClose(){}}).props.footer;assert.equal(pending.props.action.label,'Saving listing draft...');assert.equal(pending.props.action.disabled,true);
 });
 test('shared footer custom action preserves low completeness and opens the existing information panel',()=>{
 const render=presentation('src/features/property-listing/components/PropertyProgressFooter.tsx','PropertyProgressFooter');let saves=0;const value={...listingCompleteness(missingCompleteness),percent:10};const props={viewModel:{completeness:value,propertyNextDisabled:true},action:{label:'Save Draft',disabled:false,onPress:()=>saves++},guidance:{type:'Text',props:{children:'Check draft status'}}};
 let tree=render(props);let all=flatten(tree);const button=all.find(n=>n.type==='ListingButton');assert.equal(button.props.disabled,false);assert.equal(button.props.label,'Save Draft');button.props.onPress();assert.equal(saves,1);all.find(n=>n.props.accessibilityLabel==='About listing completeness').props.onPress();tree=render(props);assert.match(JSON.stringify(tree),/About completeness/);assert.match(JSON.stringify(tree),/Check draft status/);flatten(tree).find(n=>n.props.accessibilityLabel==='About listing completeness').props.onPress();assert.doesNotMatch(JSON.stringify(render(props)),/About completeness/);
 });

for(const visible of [true,false])test(`Listing Details directly exposes Review Publication only for a saved draft: ${visible}`,()=>{
 const render=presentation('src/features/property-listing/views/ListingDetailsView.tsx','ListingDetailsView');let requested=0;const vm:any={draft:{},propertySummary:{},mediaItems:[],propertyState:{draft:{}},photoState:{},listingDraftState:{},publicationReview:{visible,state:'Draft',message:'Save your listing changes before publishing.'},requestPublish:()=>requested++,publicationReviewDisabled:false};
 const tree=render({viewModel:vm,onClose(){}});const action=flatten(tree).find(n=>n.props.label==='Review Publication');assert.equal(!!action,visible);if(visible){action.props.onPress();assert.equal(requested,1);assert.match(JSON.stringify(tree),/Save your listing changes/);}assert.ok(tree.props.footer);
});

test('direct publication review blockers are visible on Listing Details draft feedback',()=>{
 const render=feedback();const current:any=vm();current.listingDraftState={propertyId:'B',listingId:'B-listing'};current.publicationState={propertyId:'B',listingId:'B-listing',error:'This property must have approved Tier 3 ownership verification before it can be published.',uncertain:false};const tree=render({viewModel:current,scope:'draft'});assert.match(JSON.stringify(tree),/approved Tier 3/);
});

for(const status of ['not_submitted','pending','under_review','rejected','approved']as const)test(`context property action renders ${status} without duplicating approved verification`,()=>{
 const render=presentation('src/features/property-listing/components/PropertyVerificationAction.tsx','PropertyVerificationAction');let opened=0;const label=status==='approved'?null:status==='not_submitted'?'Verify This Property':status==='rejected'?'View Verification Feedback':'View Verification Status';const tree=render({viewModel:{workspacePropertyId:'property',propertyVerificationState:{propertyId:'property',loaded:true,status,actionLabel:label},openPropertyVerification:()=>opened++}});const button=flatten(tree).find(n=>n.type==='ListingButton');assert.equal(!!button,status!=='approved');if(button){button.props.onPress();assert.equal(opened,1);}else assert.match(JSON.stringify(tree),/Property ownership verified/);
});

for(const status of ['not_submitted','pending','under_review','rejected','approved']as const)test(`My Listings card exposes direct ${status} verification while retaining Continue draft`,()=>{
 const render=presentation('src/features/property-listing/views/PropertyDashboardView.tsx','PropertyDashboardView');const propertyId='10000000-0000-4000-8000-000000000001';let target='',review='',continued='';const item={propertyId,property:{property_type:'house',city:'imus',barangay:'A',is_active:true},currentListing:{id:'different-listing-uuid',title:'Rental',status:'draft',asking_rent_monthly:12000,completeness_score:1},tier3:{status},coverPhoto:null};const tree=render({viewModel:{portfolioState:{loaded:true,items:[item]},portfolioStatistics:{},portfolioItems:[item],portfolio:{load(){}},openPortfolioVerification:(id:string)=>target=id,reviewPortfolioPublication:(id:string)=>review=id,openPortfolioItem:(id:string)=>continued=id}});const all=flatten(tree);all.find(n=>n.props.label==='Continue draft').props.onPress();assert.equal(continued,propertyId);const verification=all.find(n=>['Verify This Property','View Verification Status','View Verification Feedback'].includes(n.props.label));if(status==='approved'){assert.equal(verification,undefined);assert.match(JSON.stringify(tree),/Property Verified/);all.find(n=>n.props.label==='Review Publication').props.onPress();assert.equal(review,propertyId);}else{assert.ok(verification);verification.props.onPress();assert.equal(target,propertyId);assert.equal(all.some(n=>n.props.label==='Review Publication'),false);}
});

for(const status of ['loading','error'])test(`saved draft ${status} presentation hides fields, completeness and submit actions`,()=>{
 const render=presentation('src/features/property-listing/views/ListingDetailsView.tsx','ListingDetailsView');let retry=0,back=0;
 const tree=render({viewModel:{draftHydration:{status,error:status==='error'?'Could not load saved details':null},goBack:()=>back++,retryDraftHydration:()=>retry++,listingDraftState:{},publicationState:{},lifecycleState:{}},onClose(){}});
 const nodes=flatten(tree);assert.equal(tree.props.footer,undefined);assert.equal(nodes.some(n=>n.type==='ListingField'||n.type==='PropertyProgressFooter'),false);assert.equal(nodes.some(n=>n.props.label==='Save Draft'||n.props.label==='Preview listing'),false);
 assert.match(JSON.stringify(tree),status==='loading'?/Loading saved details/:/Could not load saved details/);const action=nodes.find(n=>n.props.label==='Retry loading');assert.equal(!!action,status==='error');if(action){action.props.onPress();assert.equal(retry,1);}nodes.find(n=>n.props.label==='Back to My Listings').props.onPress();assert.equal(back,1);
});

test('published editor reuses fields and footer with Save Changes while excluding property media and publication actions',()=>{
 const render=presentation('src/features/property-listing/views/ListingDetailsView.tsx','ListingDetailsView');let saved=0;const vm:any={publishedEditing:true,draftHydration:{status:'ready'},draft:{},propertySummary:{},mediaItems:[],propertyState:{draft:{}},photoState:{},listingDraftState:{lastConfirmed:{status:'active'}},composerSaveDisabled:false,saveComposerDraft:()=>saved++};
 const tree=render({viewModel:vm,onClose(){}});assert.equal(tree.props.footer.props.action.label,'Save Changes');tree.props.footer.props.action.onPress();assert.equal(saved,1);const nodes=flatten(tree);assert.ok(nodes.some(n=>n.props.label==='Monthly asking rent'));assert.equal(nodes.some(n=>n.props.label==='Property and photos'||n.props.label==='Preview listing'||n.props.label==='Review Publication'),false);assert.ok(nodes.some(n=>Array.isArray(n.props.children)&&n.props.children.join('').startsWith('Editing Published')));
});
