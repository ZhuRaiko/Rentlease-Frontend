import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateBasis, estimateDetailCount, estimateNeedsFloorArea, missingEstimateDetails, floorAreaMissing, floorAreaRequired, rentComparison, validFloorArea, type EstimateInputs } from '../src/features/property-listing/models/PostingEstimate';
import { listingDetailsIssue, listingFieldIssue } from '../src/features/property-listing/models/PersistedListingDraft';
import { emptyListingDraft } from '../src/features/property-listing/models/PropertyListing';

const base: EstimateInputs = { propertyType: 'house', city: 'imus', furnishingStatus: 'semi_furnished', propertySubtype: '', floorAreaSqm: '', floorNumber: '', lotAreaSqm: '', parkingSpaces: '', bedrooms: '3', bathrooms: '2', amenityCount: 0 };

test('floor area is required only for a property the estimator can accept (shared eligibility rules)', () => {
  for (const type of ['house', 'apartment', 'condominium']) assert.equal(floorAreaRequired({ ...base, propertyType: type }), true, type);
  for (const type of ['boarding_house', 'room', 'studio', null]) assert.equal(floorAreaRequired({ ...base, propertyType: type }), false, String(type));
  for (const city of ['imus', 'dasmarinas', 'tagaytay']) assert.equal(floorAreaRequired({ ...base, city }), true, city);
  for (const city of ['manila', '', null]) assert.equal(floorAreaRequired({ ...base, city }), false, String(city));
  assert.equal(floorAreaRequired({ ...base, furnishingStatus: 'unknown' }), false);
  assert.equal(floorAreaRequired({ ...base, furnishingStatus: null }), false);
  assert.equal(estimateNeedsFloorArea(base), true);
});

test('floor area is missing only when required and not a positive number', () => {
  for (const area of ['', '  ', '0', '-5', 'abc', 'NaN']) assert.equal(floorAreaMissing({ ...base, floorAreaSqm: area }), true, area);
  for (const area of ['1', '85', '85.5', ' 40 ']) assert.equal(floorAreaMissing({ ...base, floorAreaSqm: area }), false, area);
  assert.equal(floorAreaMissing({ ...base, propertyType: 'boarding_house', floorAreaSqm: '' }), false, 'optional when the estimate is unavailable for the type');
  assert.equal(validFloorArea('0.5'), true);
  assert.equal(validFloorArea('0'), false);
});

test('the estimate-details count includes only fields the estimator reads, and never anything else', () => {
  assert.deepEqual(estimateDetailCount({ ...base, furnishingStatus: '' }), { filled: 2, total: 8 }, 'bedrooms and bathrooms only');
  assert.deepEqual(estimateDetailCount(base), { filled: 3, total: 8 });
  assert.deepEqual(estimateDetailCount({ ...base, floorAreaSqm: '85' }), { filled: 4, total: 8 });
  assert.deepEqual(estimateDetailCount({ ...base, floorAreaSqm: '0' }), { filled: 3, total: 8 }, 'zero area is not filled');
  assert.equal(estimateDetailCount({ ...base, floorNumber: '2' }).filled, 4);
  assert.equal(estimateDetailCount({ ...base, lotAreaSqm: '120' }).filled, 4);
  assert.equal(estimateDetailCount({ ...base, floorNumber: '2', lotAreaSqm: '120' }).filled, 4, 'floor number or lot area counts once');
  assert.equal(estimateDetailCount({ ...base, parkingSpaces: '0' }).filled, 4, 'an entered zero counts');
  assert.equal(estimateDetailCount({ ...base, propertySubtype: 'townhouse' }).filled, 4);
  assert.equal(estimateDetailCount({ ...base, amenityCount: 3 }).filled, 4);
  const all = estimateDetailCount({ ...base, floorAreaSqm: '85', floorNumber: '1', parkingSpaces: '1', propertySubtype: 'villa', amenityCount: 2 });
  assert.deepEqual(all, { filled: 8, total: 8 });
  // Fields that are not model inputs never move the count (the type has no occupants/floors fields on purpose).
  assert.deepEqual(Object.keys(base).sort(), ['amenityCount', 'bathrooms', 'bedrooms', 'city', 'floorAreaSqm', 'floorNumber', 'furnishingStatus', 'lotAreaSqm', 'parkingSpaces', 'propertySubtype', 'propertyType']);
});

test('rent comparison words, percent rounding and range boundaries', () => {
  const range = { minimum: 17150, maximum: 31850 };
  assert.equal(rentComparison(26000, 24500, range), 'PHP 1,500 (6%) above the estimate. Inside the range.');
  assert.equal(rentComparison(23000, 24500, range), 'PHP 1,500 (6%) below the estimate. Inside the range.');
  assert.equal(rentComparison(24500, 24500, range), 'Matches the estimate. Inside the range.');
  assert.equal(rentComparison(35000, 24500, range), 'PHP 10,500 (43%) above the estimate. Outside the range.');
  assert.equal(rentComparison(10000, 24500, range), 'PHP 14,500 (59%) below the estimate. Outside the range.');
  // Boundaries are inclusive; one centavo outside is outside.
  assert.match(rentComparison(17150, 24500, range)!, /Inside the range\.$/);
  assert.match(rentComparison(31850, 24500, range)!, /Inside the range\.$/);
  assert.match(rentComparison(17149.99, 24500, range)!, /Outside the range\.$/);
  assert.match(rentComparison(31850.01, 24500, range)!, /Outside the range\.$/);
  // No range: the first sentence only, never an invented range.
  assert.equal(rentComparison(26000, 24500), 'PHP 1,500 (6%) above the estimate.');
  assert.equal(rentComparison(26000, 24500, null), 'PHP 1,500 (6%) above the estimate.');
  // Percent rounds half up: 0.5% rounds to 1%, 0.4% to 0%.
  assert.match(rentComparison(10050, 10000)!, /\(1%\) above/);
  assert.match(rentComparison(10040, 10000)!, /\(0%\) above/);
  assert.equal(rentComparison(12345.5, 10000), 'PHP 2,345.5 (23%) above the estimate.');
});

test('rent comparison returns nothing without a usable rent or estimate', () => {
  for (const rent of [NaN, 0, -1, Infinity]) assert.equal(rentComparison(rent, 24500), null, String(rent));
  for (const estimate of [null, undefined, 0, -5, NaN, Infinity]) assert.equal(rentComparison(26000, estimate as number | null | undefined), null, String(estimate));
});

test('estimate basis lists saved values and skips unknown ones', () => {
  assert.equal(estimateBasis({ property_type: 'house', floor_area_sqm: 85, bedrooms: 3, city: 'imus', furnishing_status: 'semi_furnished' }), 'House · 85 sqm · 3 bd · Imus · Semi-furnished');
  assert.equal(estimateBasis({ property_type: 'house', floor_area_sqm: null, bedrooms: 0, city: 'imus' }), 'House · 0 bd · Imus');
  assert.equal(estimateBasis(null), '');
});

test('listing-step validation skips only the rent; the Price step still enforces the same rent rule and message', () => {
  const ok = { ...emptyListingDraft, title: 'Cozy house', description: 'A comfortable family house near the plaza.', askingRent: '', rentalTerm: 'long_term' as const, securityDepositMonths: '1', advanceRentMonths: '1', minimumStayMonths: '', availableDate: '' };
  assert.equal(listingDetailsIssue(ok), null, 'an empty rent no longer blocks the Listing step');
  assert.equal(listingFieldIssue(ok)?.field, 'askingRent');
  assert.equal(listingFieldIssue(ok)?.message, 'Enter monthly asking rent greater than zero.');
  assert.equal(listingFieldIssue({ ...ok, askingRent: '0' })?.message, 'Enter monthly asking rent greater than zero.');
  assert.equal(listingFieldIssue({ ...ok, askingRent: '26,000' }), null);
  // Every other listing rule is still enforced on the Listing step, even when the rent is empty.
  assert.equal(listingDetailsIssue({ ...ok, title: ' ' })?.field, 'title');
  assert.equal(listingDetailsIssue({ ...ok, description: '' })?.field, 'description');
  assert.equal(listingDetailsIssue({ ...ok, securityDepositMonths: '-1' })?.field, 'securityDepositMonths');
  assert.equal(listingDetailsIssue({ ...ok, advanceRentMonths: 'x' })?.field, 'advanceRentMonths');
  assert.equal(listingDetailsIssue({ ...ok, minimumStayMonths: '0' })?.field, 'minimumStayMonths');
  assert.equal(listingDetailsIssue({ ...ok, availableDate: '2026-13-40' })?.field, 'availableDate');
  assert.equal(listingDetailsIssue({ ...ok, askingRent: 'not a number' }), null, 'the Listing step ignores whatever the rent holds');
});

test('missing estimate details are named in form order and always agree with the count', () => {
  assert.deepEqual(missingEstimateDetails({ ...base, furnishingStatus: '' }), ['floor area', 'floor number or lot area', 'parking spaces', 'subtype', 'furnishing', 'amenities']);
  assert.deepEqual(missingEstimateDetails(base), ['floor area', 'floor number or lot area', 'parking spaces', 'subtype', 'amenities']);
  const near = { ...base, floorAreaSqm: '85', floorNumber: '1', propertySubtype: 'villa', amenityCount: 2 };
  assert.deepEqual(missingEstimateDetails(near), ['parking spaces'], 'seven of eight: only parking is named');
  assert.deepEqual(missingEstimateDetails({ ...near, parkingSpaces: '0' }), [], 'an entered zero is filled');
  assert.deepEqual(missingEstimateDetails({ ...near, parkingSpaces: '0', floorAreaSqm: '0' }), ['floor area'], 'zero area is still missing');
  assert.deepEqual(missingEstimateDetails({ ...base, floorNumber: '', lotAreaSqm: '120' }).includes('floor number or lot area'), false, 'either of floor number or lot area fills it');
  assert.deepEqual(missingEstimateDetails({ ...base, bedrooms: ' ', bathrooms: '' }).slice(-2), ['bedrooms', 'bathrooms']);
  for (const i of [base, near, { ...near, parkingSpaces: '1' }, { ...base, amenityCount: 3, lotAreaSqm: '5' }]) {
    const c = estimateDetailCount(i);
    assert.equal(missingEstimateDetails(i).length, c.total - c.filled, 'names and count never disagree');
  }
});
