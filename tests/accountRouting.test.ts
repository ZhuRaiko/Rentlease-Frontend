/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AccountSnapshot } from '../src/features/authentication/models/AuthProfile';
import { getAccountDestination, getWorkspaceDestination } from '../src/features/authentication/models/accountRouting';

function existingAccount(): AccountSnapshot {
  return {
    user: {
      id: 'existing-user', aud: 'authenticated', created_at: '2026-01-01T00:00:00Z',
      app_metadata: {}, user_metadata: {}, email: 'test@example.com',
      email_confirmed_at: '2026-01-01T00:00:00Z', phone: '639171234567',
      phone_confirmed_at: '2026-01-01T00:00:00Z',
    },
    profile: {
      id: 'existing-user', display_name: 'Test User', bio: null, avatar_path: null,
      account_status: 'active', tier1_verified_at: '2026-01-01T00:00:00Z',
      tier2_verified_at: null, tier3_verified_at: null, trust_score: 0.4,
    },
    roles: ['tenant'],
  };
}

test('an existing Tier 1 account enters the app after sign-in or session restoration', () => {
  assert.equal(getAccountDestination(existingAccount()), 'profile');
  assert.equal(getWorkspaceDestination(existingAccount()), 'discovery');
});

test('an existing account without phone confirmation still requires verification', () => {
  const account = existingAccount();
  account.profile.tier1_verified_at = null;
  delete account.user.phone_confirmed_at;
  assert.equal(getAccountDestination(account), 'registrationPhone');
  assert.equal(getWorkspaceDestination(account), null);
});

test('a confirmed phone with missing Tier 1 status waits for account sync instead of requesting OTP again', () => {
  const account = existingAccount();
  account.profile.tier1_verified_at = null;
  assert.equal(getAccountDestination(account), 'verificationPending');
  assert.equal(getWorkspaceDestination(account), null);
});

test('a confirmation timestamp with no phone number does not pretend a phone is confirmed', () => {
  const account = existingAccount();
  account.profile.tier1_verified_at = null;
  account.user.phone = '';
  assert.equal(getAccountDestination(account), 'registrationPhone');
});

test('an unconfirmed email takes precedence over phone verification', () => {
  const account = existingAccount();
  delete account.user.email_confirmed_at;
  assert.equal(getAccountDestination(account), 'emailConfirmation');
  assert.equal(getWorkspaceDestination(account), null);
});

test('backend restrictions take precedence over completed onboarding', () => {
  for (const status of ['restricted', 'suspended', null]) {
    const account = existingAccount();
    account.profile.account_status = status;
    assert.equal(getAccountDestination(account), 'restricted');
    assert.equal(getWorkspaceDestination(account), null);
  }
});

test('role selection is required only after Tier 1 completes', () => {
  const account = existingAccount();
  account.roles = [];
  assert.equal(getAccountDestination(account), 'roleSelection');
  account.profile.tier1_verified_at = null;
  assert.equal(getAccountDestination(account), 'verificationPending');
});

test('Admin role takes priority over ordinary email, phone, and role onboarding', () => {
  for (const roles of [['admin'], ['admin', 'tenant'], ['admin', 'tenant', 'landlord']] as AccountSnapshot['roles'][]) {
    const account = existingAccount();
    account.roles = roles;
    account.profile.tier1_verified_at = null;
    account.user.phone = '';
    delete account.user.phone_confirmed_at;
    delete account.user.email_confirmed_at;
    assert.equal(getAccountDestination(account), 'profile');
    assert.equal(getWorkspaceDestination(account), 'adminModeration');
  }
});

test('restricted Admin accounts cannot enter Admin workspace', () => {
  const account = existingAccount();
  account.roles = ['admin'];
  account.profile.account_status = 'suspended';
  assert.equal(getAccountDestination(account), 'restricted');
  assert.equal(getWorkspaceDestination(account), null);
});

test('Tenant and Landlord without Admin still require Tier 1', () => {
  for (const roles of [['tenant'], ['landlord'], ['tenant', 'landlord']] as AccountSnapshot['roles'][]) {
    const account = existingAccount();
    account.roles = roles;
    account.profile.tier1_verified_at = null;
    assert.equal(getAccountDestination(account), 'verificationPending');
    assert.equal(getWorkspaceDestination(account), null);
  }
});
test('email and mobile continuation advance only from authoritative confirmation and Tier 1 facts', () => {
  const account = existingAccount(); account.roles = []; account.profile.tier1_verified_at = null;
  delete account.user.email_confirmed_at; delete account.user.phone_confirmed_at; account.user.phone = '';
  assert.equal(getAccountDestination(account), 'emailConfirmation');
  account.user.email_confirmed_at = '2026-10-22T00:00:00Z'; assert.equal(getAccountDestination(account), 'registrationPhone');
  account.user.phone = '+639171234567'; account.user.phone_confirmed_at = '2026-10-22T00:01:00Z';
  assert.equal(getAccountDestination(account), 'verificationPending'); assert.equal(getWorkspaceDestination(account), null);
  account.profile.tier1_verified_at = '2026-10-22T00:01:01Z'; assert.equal(getAccountDestination(account), 'roleSelection');
});
test('Tenant, Landlord and Both enter the marketplace only after backend role loading', () => {
  for (const roles of [['tenant'], ['landlord'], ['tenant', 'landlord']] as AccountSnapshot['roles'][]) {
    const account = existingAccount(); account.roles = [];
    assert.equal(getAccountDestination(account), 'roleSelection');
    account.roles = roles;
    assert.equal(getAccountDestination(account), 'profile'); assert.equal(getWorkspaceDestination(account), 'discovery');
  }
});
