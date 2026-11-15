import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCATION_CHANGED_NOTICE, reconcileWish, shareBindingKey, wishAfterPress, wishApplies, type BindingDraft, type ShareWish } from '../src/features/property-listing/models/ShareWish';

const draft = (over: Partial<BindingDraft> = {}): BindingDraft => ({ propertyType: 'apartment', city: 'imus', barangay: 'Buhay na Tubig', addressLine1: '12 Main St', addressLine2: '', postalCode: '', floorNumber: '', exactLatitude: 14.4123, exactLongitude: 120.9123, publicLatitude: 14.41, publicLongitude: 120.91, ...over });
const key = (over: Partial<BindingDraft> = {}, rev = 3) => shareBindingKey(draft(over), rev);
const snap = (over: Partial<{ inStep1: boolean; confirmed: boolean; key: string }> = {}) => ({ inStep1: true, confirmed: true, key: key(), ...over });

test('the notice is the specified sentence', () => assert.equal(LOCATION_CHANGED_NOTICE, 'Location changed. Confirm sharing again.'));
test('the binding is compared by value: every input that defines the point or the identity changes it', () => {
  const base = key();
  assert.equal(key(), base, 'the same values give the same key');
  const changes: [string, Partial<BindingDraft>][] = [
    ['property type', { propertyType: 'house' }], ['city', { city: 'tagaytay' }], ['barangay', { barangay: 'Other' }], ['street', { addressLine1: '99 Other St' }],
    ['building', { addressLine2: 'Tower B' }], ['postal code', { postalCode: '4103' }], ['rental floor', { floorNumber: '3' }],
    ['exact latitude', { exactLatitude: 14.4124 }], ['exact longitude', { exactLongitude: 120.9124 }], ['public latitude', { publicLatitude: 14.42 }], ['public longitude', { publicLongitude: 120.92 }],
    ['exact pin cleared', { exactLatitude: null, exactLongitude: null }], ['public point cleared', { publicLatitude: null, publicLongitude: null }],
  ];
  for (const [name, over] of changes) assert.notEqual(key(over), base, name);
  assert.notEqual(key({}, 4), base, 'an address revision counts: the same coordinates confirmed again after an edit are a change');
});
test('whitespace around typed text is not a change', () => {
  assert.equal(key({ barangay: '  Buhay na Tubig ' }), key());
  assert.equal(key({ addressLine1: '12 Main St  ' }), key());
  assert.equal(key({ postalCode: ' ' }), key());
});
test('a press with a confirmed point on screen binds to it; without one it waits', () => {
  assert.deepEqual(wishAfterPress(snap()), { phase: 'bound', key: key() });
  assert.deepEqual(wishAfterPress(snap({ confirmed: false })), { phase: 'awaiting' });
  assert.deepEqual(wishAfterPress(snap({ inStep1: false })), { phase: 'awaiting' }, 'outside Step 1 it cannot bind (and is dropped at once)');
});
test('reconcile: a waiting wish binds to the point confirmed next, and stays put until then', () => {
  const awaiting: ShareWish = { phase: 'awaiting' };
  assert.equal(reconcileWish(awaiting, snap({ confirmed: false })).wish, awaiting);
  assert.deepEqual(reconcileWish(awaiting, snap()), { wish: { phase: 'bound', key: key() }, notice: null });
});
test('reconcile: a bound wish survives while the point and identity are unchanged', () => {
  const bound: ShareWish = { phase: 'bound', key: key() };
  const r = reconcileWish(bound, snap());
  assert.equal(r.wish, bound);
  assert.equal(r.notice, null);
});
test('reconcile: any change to the point or identity clears a bound wish and says so', () => {
  const bound: ShareWish = { phase: 'bound', key: key() };
  for (const k of [key({ barangay: 'X' }), key({ propertyType: 'house' }), key({ publicLatitude: 14.5 }), key({}, 9)]) assert.deepEqual(reconcileWish(bound, snap({ key: k })), { wish: null, notice: LOCATION_CHANGED_NOTICE });
  assert.deepEqual(reconcileWish(bound, snap({ confirmed: false })), { wish: null, notice: LOCATION_CHANGED_NOTICE }, 'the confirmed point went away');
});
test('reconcile: leaving Step 1 or saving the property drops any wish quietly', () => {
  assert.deepEqual(reconcileWish({ phase: 'bound', key: key() }, snap({ inStep1: false })), { wish: null, notice: null });
  assert.deepEqual(reconcileWish({ phase: 'awaiting' }, snap({ inStep1: false })), { wish: null, notice: null });
  assert.deepEqual(reconcileWish(null, snap()), { wish: null, notice: null });
});
test('a wish applies only when it is bound to exactly the point being saved', () => {
  const bound: ShareWish = { phase: 'bound', key: key() };
  assert.equal(wishApplies(bound, snap()), true);
  assert.equal(wishApplies(bound, snap({ key: key({ city: 'dasmarinas' }) })), false);
  assert.equal(wishApplies(bound, snap({ key: key({ publicLongitude: 121 }) })), false);
  assert.equal(wishApplies(bound, snap({ key: key({}, 4) })), false);
  assert.equal(wishApplies(bound, snap({ confirmed: false })), false);
  assert.equal(wishApplies({ phase: 'awaiting' }, snap()), false, 'a wish still waiting for a point never applies');
  assert.equal(wishApplies(null, snap()), false);
});
