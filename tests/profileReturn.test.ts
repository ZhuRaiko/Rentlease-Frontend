/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureProfileReturn, resolveProfileReturn } from '../src/shared/models/profileReturn';
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
  assert.equal(resolveProfileReturn(notifications, 'one', ordinary)?.workspace.type, 'notifications');
});
