import test from 'node:test';
import assert from 'node:assert/strict';
import { missingLine } from '../src/features/property-listing/models/PropertyReadiness';
import { decisionKey, decisionStands } from '../src/features/property-listing/models/LocationConsent';

const issue = (field: string, kind: 'required' | 'invalid' = 'required', message = `msg ${field}`) => ({ field, section: 'address', kind, message }) as any;

// ---- The one footer line
test('the footer line names every missing required field once, in page order', () => {
  assert.equal(missingLine([issue('addressLine1'), issue('barangay'), issue('city'), issue('location')], true, true), 'Add floor area, city, barangay and street');
  assert.equal(missingLine([issue('propertyType'), issue('bedrooms'), issue('bathrooms')], false, true), 'Choose a property type', 'with no type chosen the footer asks for the type before anything else');
  assert.equal(missingLine([issue('bedrooms'), issue('bathrooms')], false, true), 'Add bedrooms and bathrooms');
  assert.equal(missingLine([issue('barangay')], false, true), 'Add barangay');
  assert.equal(missingLine([], true, false), 'Add floor area', 'a missing floor area the estimator needs counts even without an issue');
});
test('with nothing to add, the line asks for the location, then names a value that does not fit, then says nothing', () => {
  assert.equal(missingLine([issue('location')], false, true), 'Confirm the location to continue');
  assert.equal(missingLine([issue('floorNumber', 'invalid', 'Enter a valid rental floor.')], false, false), 'Enter a valid rental floor.');
  assert.equal(missingLine([], false, false), null);
  assert.equal(missingLine([issue('location')], false, false), null, 'a location that is decided is not a gap');
});


// ---- The consent decision
const draftOf = (over: any = {}) => ({ city: 'imus', barangay: ' B ', addressLine1: 'A', addressLine2: '', postalCode: '', exactLatitude: 14.4, exactLongitude: 120.9, publicLatitude: 14.41, publicLongitude: 120.91, ...over });
test('a decision stands only for the point and address it was made for', () => {
  const key = decisionKey(draftOf(), 3), snap = (over: any = {}, revision = 3, confirmed = true) => ({ confirmed, key: decisionKey(draftOf(over), revision) });
  const decision = { key, share: false };
  assert.equal(decisionStands(decision, snap()), true);
  assert.equal(decisionStands(decision, snap({ barangay: 'B' })), true, 'whitespace is not a change');
  for (const over of [{ barangay: 'Other' }, { addressLine1: 'Other' }, { addressLine2: 'Tower' }, { postalCode: '4103' }, { city: 'tagaytay' }, { publicLatitude: 14.5 }, { exactLongitude: 121 }])
    assert.equal(decisionStands(decision, snap(over)), false, JSON.stringify(over));
  assert.equal(decisionStands(decision, snap({}, 4)), false, 'the address revision counts');
  assert.equal(decisionStands(decision, snap({}, 3, false)), false, 'no pin, no decision');
  assert.equal(decisionStands(null, snap()), false);
  assert.equal(decisionStands(decision, { confirmed: true, key: decisionKey({ ...draftOf(), propertyType: 'house', floorNumber: '9' } as any, 3) }), true, "type and floor do not undo \"Confirm, don't share\"");
});

