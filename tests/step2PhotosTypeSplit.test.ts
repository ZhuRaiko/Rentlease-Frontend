import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RANGE_PROPERTY_TYPES, rentalEstimateEligibility } from '../src/shared/models/RentalEstimateEligibility';
import { GROUP_OWN_PRICE_LABEL, GROUP_RANGE_LABEL, NO_RANGE_FOOTER, NO_RANGE_PRICE_LINE, RANGE_ONLY_FIELDS, rangeInfoLine, rangeSupport, withoutRangeOnlyValues } from '../src/features/property-listing/models/PostingEstimate';
import { propertyTypeOptions } from '../src/features/property-listing/models/DraftProperty';
import { PHOTOS_ATTENTION_MESSAGE, PHOTOS_UPLOADING_MESSAGE, photoWait, thumbVeil } from '../src/features/property-listing/models/PropertyMedia';
import { PHOTOS_ATTENTION_HINT, PHOTOS_WAITING_SUFFIX, TYPING_HINT, waitingView } from '../src/features/property-listing/models/ListingCheck';
import { postingValidationGroup } from '../src/features/property-listing/models/PostingPresentation';

// ---- Property type split (option A)
test('one list decides which types get a range: the estimator, the type groups and the range card all read it', () => {
  assert.deepEqual([...RANGE_PROPERTY_TYPES], ['apartment', 'house', 'condominium']);
  for (const type of RANGE_PROPERTY_TYPES) assert.equal(rentalEstimateEligibility({ property_type: type, city: 'imus', furnishing_status: 'unfurnished', floor_area_sqm: 30 }).eligible, true, type);
  for (const o of propertyTypeOptions.filter(o => !RANGE_PROPERTY_TYPES.includes(o.value))) assert.equal(rentalEstimateEligibility({ property_type: o.value, city: 'imus', furnishing_status: 'unfurnished', floor_area_sqm: 30 }).eligible, false, o.value);
  const groups = readFileSync('src/features/property-listing/components/PropertyTypeGroups.tsx', 'utf8');
  assert.match(groups, /RANGE_PROPERTY_TYPES/); assert.ok(!/'boarding_house'|'bedspace'|'dormitory'/.test(groups), 'no second list of types in the picker');
});
test('rangeSupport: no type yet, a type without a range, a city without one, or a range', () => {
  assert.equal(rangeSupport({ propertyType: null, city: 'imus' }), 'none');
  for (const type of ['boarding_house', 'bedspace', 'room', 'studio', 'dormitory', 'other']) assert.equal(rangeSupport({ propertyType: type, city: 'imus' }), 'type', type);
  for (const type of ['apartment', 'house', 'condominium']) assert.equal(rangeSupport({ propertyType: type, city: 'imus' }), 'range', type);
  assert.equal(rangeSupport({ propertyType: 'apartment', city: null }), 'range', 'a city that is not chosen yet does not take the range away');
  assert.equal(rangeSupport({ propertyType: 'apartment', city: 'bacoor' }), 'city', 'a city the estimator does not cover');
});
test('the two groups are labeled with the wireframe words, and the info lines name the type', () => {
  assert.equal(GROUP_RANGE_LABEL, 'Typical-rent range available'); assert.equal(GROUP_OWN_PRICE_LABEL, 'You set your own price');
  assert.equal(rangeInfoLine('type', 'Boarding house', 'Imus'), 'A typical-rent range is available for apartments, houses and condominiums. For a boarding house you set your own price.');
  assert.match(rangeInfoLine('type', 'Apartment', null)!, /For an apartment you set/, 'a vowel takes "an"');
  assert.equal(rangeInfoLine('type', 'Other', null), 'A typical-rent range is available for apartments, houses and condominiums. For this type you set your own price.');
  assert.equal(rangeInfoLine('city', 'Apartment', 'Bacoor'), 'Bacoor is not covered by typical-rent ranges yet. You set your own price.');
  assert.equal(rangeInfoLine('range', 'Apartment', 'Imus'), null); assert.equal(rangeInfoLine('none', null, null), null);
  assert.equal(NO_RANGE_FOOTER.type, 'No range for this type · saves your property');
  assert.equal(NO_RANGE_PRICE_LINE.type, 'A typical-rent range is not available for this type');
});
test('range-only details are blanked for a type or city without a range, never for one with a range, and shared fields are untouched', () => {
  const draft = { propertyType: 'apartment', city: 'imus', propertySubtype: 'studio', lotAreaSqm: '50', parkingSpaces: '2', floorNumber: '4', bedrooms: '2', floorAreaSqm: '30', furnishingStatus: 'furnished' };
  assert.deepEqual([...RANGE_ONLY_FIELDS], ['propertySubtype', 'lotAreaSqm', 'parkingSpaces', 'floorNumber']);
  assert.equal(withoutRangeOnlyValues(draft), draft, 'a range type is returned as is');
  const own = withoutRangeOnlyValues({ ...draft, propertyType: 'room' });
  assert.deepEqual([own.propertySubtype, own.lotAreaSqm, own.parkingSpaces, own.floorNumber], ['', '', '', '']);
  assert.deepEqual([own.bedrooms, own.floorAreaSqm, own.furnishingStatus, own.city], ['2', '30', 'furnished', 'imus'], 'shared details stay');
  assert.equal(draft.propertySubtype, 'studio', 'the form itself is not changed: values come back when the type does');
  assert.equal(withoutRangeOnlyValues({ ...draft, city: 'bacoor' }).floorNumber, '');
  assert.equal(withoutRangeOnlyValues({ ...draft, propertyType: null }).parkingSpaces, '');
});
test('every range-only field belongs to the details card, and the group split never puts photos on Step 1', () => {
  for (const field of RANGE_ONLY_FIELDS) assert.equal(postingValidationGroup({ field } as any), 'details', field);
  const sources = ['components/ComposerPropertyFields.tsx', 'components/SavedPropertyFields.tsx', 'views/ListingComposerView.tsx'].map(f => readFileSync(`src/features/property-listing/${f}`, 'utf8'));
  const [composerFields, savedFields, composerView] = sources as [string, string, string];
  assert.ok(!/afterLocation|photos=/.test(composerFields + savedFields), 'no photo slot left in the Step 1 editors');
  assert.ok(!/<PropertyMediaSection compact|group\('photos'|'photos'/.test(composerView), 'Step 1 renders no photo card');
  assert.ok(!/photos/.test(readFileSync('src/features/property-listing/models/PostingPresentation.ts', 'utf8').split('\n').find(l => l.includes('PostingGroup'))!), 'photos are not a Step 1 card group');
});

// ---- Photos on Step 2
const media = (status: any, extra: any = {}) => ({ status, ...extra });
test('a thumbnail shows a light veil while it uploads and an amber one that offers Retry when it did not upload', () => {
  assert.equal(thumbVeil(media('Saved'), false), null);
  assert.deepEqual(thumbVeil(media('Uploading'), true), { kind: 'uploading', text: 'Uploading…' });
  assert.deepEqual(thumbVeil(media('Selected'), true), { kind: 'uploading', text: 'Uploading…' }, 'waiting in the running queue');
  assert.deepEqual(thumbVeil(media('Selected'), false), { kind: 'failed', text: 'Couldn’t upload', retry: true }, 'a queue that stopped');
  assert.deepEqual(thumbVeil(media('Needs attention'), false), { kind: 'failed', text: 'Check this photo', retry: false });
});
test('only an upload in progress, a failed upload or an unknown outcome holds Continue; a plain photo load never does', () => {
  const s = (over: any = {}) => ({ busy: false, needsReconcile: false, pendingSelections: [] as unknown[], ...over });
  assert.equal(photoWait(s(), true), null); assert.equal(photoWait(s({ busy: true }), true), null, 'loading photos is a background check');
  assert.equal(photoWait(s({ busy: true, pendingSelections: [1] }), true), 'uploading');
  assert.equal(photoWait(s({ pendingSelections: [1] }), true), 'attention'); assert.equal(photoWait(s({ needsReconcile: true }), true), 'attention');
  assert.equal(photoWait(s({ busy: true, pendingSelections: [1] }), false), null, 'no property saved yet: nothing to wait for');
});
test('Continue to Price waits for photos with a plain button label and the typing hint, never a red message', () => {
  assert.deepEqual(waitingView(PHOTOS_UPLOADING_MESSAGE, 'Continue to Price'), { label: 'Continue to Price' + PHOTOS_WAITING_SUFFIX, hint: TYPING_HINT });
  assert.equal(PHOTOS_WAITING_SUFFIX, ' · waiting for photos'); assert.equal(TYPING_HINT, 'You can keep typing. Only saving waits.');
  assert.deepEqual(waitingView(PHOTOS_ATTENTION_MESSAGE, 'Continue to Price'), { label: 'Continue to Price · waiting for photos', hint: PHOTOS_ATTENTION_HINT });
  assert.match(PHOTOS_ATTENTION_HINT, /You can keep typing\.$/);
});
test('photos are optional to continue and required to publish: the Review checklist still lists them, and nothing on Step 2 requires one', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.match(vm, /key:'photos' as const,done:photosSaved/, 'the Review checklist item stays');
  const details = readFileSync('src/features/property-listing/views/ListingDetailsView.tsx', 'utf8');
  assert.match(details, /vm\.postingWizard\?<ListingPhotosCard viewModel=\{vm\}\/>:null/, 'the card is the first thing on the Listing step');
  assert.ok(details.indexOf('<ListingPhotosCard') < details.indexOf('Listing details</Text>'), 'photos come before the title and description');
  assert.ok(!/photoState\.photos\.length\s*[=<>]/.test(details), 'no photo count gates Continue');
});
