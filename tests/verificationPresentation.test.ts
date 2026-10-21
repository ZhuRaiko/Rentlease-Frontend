/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountVerificationSummary, roleLabel } from '../src/features/authentication/models/accountPresentation';
import { verificationStatusPresentation, needsVerificationRecovery } from '../src/shared/models/verificationPresentation';

test('verification statuses retain exact meaning and distinct feedback tones', () => {
  assert.deepEqual(verificationStatusPresentation('pending'), { label: 'Pending', tone: 'warning' });
  assert.deepEqual(verificationStatusPresentation('under_review'), { label: 'Under Review', tone: 'info' });
  assert.deepEqual(verificationStatusPresentation('approved'), { label: 'Verified', tone: 'success' });
  assert.equal(verificationStatusPresentation('rejected').tone, 'error');
  assert.equal(verificationStatusPresentation('revoked').label, 'Revoked');
  assert.equal(verificationStatusPresentation('cancelled').label, 'Cancelled');
});
test('profile does not invent pending submissions or property approval from missing/account timestamps', () => {
  const summary = accountVerificationSummary({ tier1_verified_at: 'date', tier2_verified_at: null, tier3_verified_at: null }, ['tenant']);
  assert.deepEqual(summary.map(item => item.status.label), ['Verified', 'Not Verified', 'Not Applicable']);
  const landlord = accountVerificationSummary({ tier1_verified_at: 'date', tier2_verified_at: 'date', tier3_verified_at: 'date' }, ['tenant', 'landlord']);
  assert.equal(landlord[2]?.status.label, 'Verified');
  assert.match(landlord[2]?.detail ?? '', /individual property/i);
  assert.equal(accountVerificationSummary(null, ['admin'])[0]?.status.label, 'Not Applicable');
});
test('role labels capitalize display values without changing enum values', () => {
  assert.deepEqual(['tenant', 'landlord', 'admin'].map(role => roleLabel(role as 'tenant' | 'landlord' | 'admin')), ['Tenant', 'Landlord', 'Admin']);
});
test('ordinary verification screens hide redundant refresh while errors and uncertain writes retain recovery', () => {
  assert.equal(needsVerificationRecovery({ loaded: true, requiresRefresh: false, error: null }), false);
  for (const state of [{ loaded: false, requiresRefresh: false, error: null }, { loaded: true, requiresRefresh: true, error: null }, { loaded: true, requiresRefresh: false, error: 'Picker failed' }]) assert.equal(needsVerificationRecovery(state), true);
});
