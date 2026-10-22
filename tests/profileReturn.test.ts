/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureProfileReturn, resolveProfileReturn, profileAfterDismissal, profileBackTarget } from '../src/shared/models/profileReturn';
import type { MarketplaceAccess } from '../src/shared/models/marketplaceNavigation';

const ordinary: MarketplaceAccess = { marketplace: true, admin: false, tenant: true, landlord: true };
test('Profile remembers a single owner-scoped Discovery return and its workspace context', () => {
  const target = captureProfileReturn('one', { type: 'discovery', initialScreen: 'home' }, 'tenant', ordinary);
  assert.deepEqual(resolveProfileReturn(target, 'one', ordinary), target);
  assert.equal(resolveProfileReturn(target, 'two', ordinary), null);
  assert.equal(resolveProfileReturn(target, 'one', { ...ordinary, tenant: false }), null);
  assert.equal(resolveProfileReturn(target, null, ordinary), null);
});
test('property and actor return targets cannot survive lost membership, restrictions or Admin precedence', () => {
  const target = captureProfileReturn('one', { type: 'properties', initialScreen: 'dashboard' }, 'landlord', ordinary);
  assert.ok(resolveProfileReturn(target, 'one', ordinary));
  assert.equal(resolveProfileReturn(target, 'one', { ...ordinary, landlord: false }), null);
  assert.equal(resolveProfileReturn(target, 'one', { ...ordinary, marketplace: false }), null);
  assert.equal(resolveProfileReturn(target, 'one', { ...ordinary, admin: true }), null);
  const chat = captureProfileReturn('one', { type: 'messages', initialScreen: 'inbox' }, 'landlord', ordinary);
  assert.equal(resolveProfileReturn(chat, 'one', { ...ordinary, landlord: false }), null);
});
test('Admin return requires current Admin eligibility and other workspace entries remain distinct', () => {
  const access = { ...ordinary, marketplace: false, admin: true };
  const admin = captureProfileReturn('one', { type: 'adminModeration' }, 'tenant', access);
  assert.ok(resolveProfileReturn(admin, 'one', access));
  assert.equal(resolveProfileReturn(admin, 'one', ordinary), null);
  assert.equal(captureProfileReturn('one', null, 'tenant', ordinary), null);
  const notifications = captureProfileReturn('one', { type: 'notifications' }, 'tenant', ordinary);
  assert.equal(notifications, null);
});

test('dismissed Profile child flows cannot become Profile Back history', () => {
  for (const workspace of [{ type: 'verification' }, { type: 'ratingsReports' }, { type: 'notifications' }, { type: 'discovery', initialScreen: 'matchingPreferences' }] as const) {
    assert.equal(captureProfileReturn('one', workspace, 'tenant', ordinary), null);
  }
});
test('Profile predecessors are canonical top-level entries rather than discarded nested screens', () => {
  assert.deepEqual(captureProfileReturn('one', { type: 'properties', initialScreen: 'postingType' }, 'landlord', ordinary)?.workspace, { type: 'properties', initialScreen: 'dashboard' });
  assert.deepEqual(captureProfileReturn('one', { type: 'messages', initialScreen: 'newInquiry' }, 'tenant', ordinary)?.workspace, { type: 'messages', initialScreen: 'inbox' });
});

for (const child of [{ type: 'verification' }, { type: 'ratingsReports' }, { type: 'discovery', initialScreen: 'matchingPreferences' }] as const) {
  test(`Profile -> ${child.type} -> Profile -> Back consumes no dismissed tool`, () => {
    let target = profileAfterDismissal(null, 'one', { type: 'discovery', initialScreen: 'home' }, 'tenant', ordinary);
    target = profileAfterDismissal(target, 'one', child, 'tenant', ordinary);
    assert.deepEqual(profileBackTarget(target, 'one', 'tenant', ordinary)?.workspace, { type: 'discovery', initialScreen: 'home' });
    assert.deepEqual(profileBackTarget(null, 'one', 'tenant', ordinary)?.workspace, { type: 'discovery', initialScreen: 'home' });
  });
}
test('Listings -> Profile returns to canonical dashboard and a different tab replaces its predecessor', () => {
  let target = profileAfterDismissal(null, 'one', { type: 'properties', initialScreen: 'postingType' }, 'landlord', ordinary);
  assert.deepEqual(profileBackTarget(target, 'one', 'landlord', ordinary)?.workspace, { type: 'properties', initialScreen: 'dashboard' });
  target = profileAfterDismissal(target, 'one', { type: 'messages', initialScreen: 'inbox' }, 'landlord', ordinary);
  assert.equal(profileBackTarget(target, 'one', 'landlord', ordinary)?.workspace.type, 'messages');
});
test('stale account, role and restriction targets cannot restore an unauthorized destination', () => {
  const target = profileAfterDismissal(null, 'old', { type: 'properties', initialScreen: 'dashboard' }, 'landlord', ordinary);
  assert.equal(profileBackTarget(target, 'new', 'tenant', ordinary)?.workspace.type, 'discovery');
  assert.equal(profileBackTarget(target, 'old', 'tenant', { ...ordinary, landlord: false })?.workspace.type, 'discovery');
  assert.equal(profileBackTarget(target, 'old', 'tenant', { ...ordinary, marketplace: false }), null);
  assert.equal(profileBackTarget(target, null, 'tenant', ordinary), null);
  assert.equal(profileBackTarget(target, 'old', 'tenant', { ...ordinary, marketplace: false, admin: true })?.workspace.type, 'adminModeration');
});
