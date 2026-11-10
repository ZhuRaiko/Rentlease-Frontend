import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import type { AccountSnapshot } from '../src/features/authentication/models/AuthProfile';
import { getAccountDestination } from '../src/features/authentication/models/accountRouting';
import { defaultMarketplaceMode, defaultPreviewActor, initialMarketplaceWorkspace, propertiesWorkspace } from '../src/shared/models/marketplaceNavigation';
import { hasProfileChanges, accountVerificationSummary } from '../src/features/authentication/models/accountPresentation';
import { parseExperiencePreference } from '../src/features/authentication/models/AuthProfile';
import { canEnterTierThree } from '../src/features/user-verification/models/TierThreeVerification';

test('eligible role-free and legacy accounts share discovery and first-property entry', () => {
  for (const roles of [[], ['tenant'], ['landlord'], ['tenant','landlord']] as AccountSnapshot['roles'][]) {
    const account = { user: { email_confirmed_at: 'confirmed' }, profile: { account_status: 'active', tier1_verified_at: 'verified' }, roles } as AccountSnapshot;
    assert.equal(getAccountDestination(account), 'profile');
    const access = { marketplace: true, admin: false, tenant: roles.includes('tenant'), landlord: roles.includes('landlord') };
    assert.equal(propertiesWorkspace(access, 'postingType')?.type, 'properties');
    assert.equal(propertiesWorkspace(access, 'dashboard')?.type, 'properties');
    assert.equal(initialMarketplaceWorkspace(access, 'tenant')?.type, 'discovery');
  }
});

test('display preferences affect the default destination and never marketplace eligibility', () => {
  const access = { marketplace: true, admin: false };
  for (const preference of [null, undefined, 'rent', 'list', 'both', 'admin']) {
    const mode = defaultMarketplaceMode(preference);
    assert.equal(initialMarketplaceWorkspace(access, mode)?.type, preference === 'list' ? 'properties' : 'discovery');
    assert.equal(propertiesWorkspace(access, 'postingType')?.type, 'properties');
    assert.equal(initialMarketplaceWorkspace({ ...access, marketplace: false }, mode), null);
    assert.equal(initialMarketplaceWorkspace({ ...access, admin: true }, mode)?.type, 'adminModeration');
  }
  assert.equal(parseExperiencePreference('admin'), null);
  assert.equal(parseExperiencePreference('both'), 'both');
});

test('display preference never selects a different actor for existing Chat/Tenancy previews', () => {
  assert.equal(defaultPreviewActor(['landlord']), 'landlord');
  assert.equal(defaultPreviewActor(['tenant', 'landlord']), 'tenant');
  assert.equal(defaultPreviewActor([]), 'tenant');
  const app = readFileSync('App.tsx','utf8');
  assert.match(app, /setActivityMode\(defaultPreviewActor\(auth.roles\)\)/);
  assert.doesNotMatch(app, /setActivityMode\(mode\)/);
});

test('profile Save recognizes normalized changes, reverts, optional preference and empty names', () => {
  const profile = { display_name: 'Ada', bio: null, experience_preference: null } as AccountSnapshot['profile'];
  assert.equal(hasProfileChanges(profile, ' Ada ', ' ', null), false);
  assert.equal(hasProfileChanges(profile, 'Ada', '', 'list'), true);
  assert.equal(hasProfileChanges(profile, '', '', 'list'), false);
  assert.equal(hasProfileChanges(profile, 'Ada', 'New bio', null), true);
  assert.equal(hasProfileChanges({ ...profile, experience_preference: 'both' }, 'Ada', '', 'both'), false);
  assert.equal(hasProfileChanges(null, 'Ada', '', 'list'), false);
});

test('Tier 3 profile status never treats a global timestamp or normal membership as property approval', () => {
  for (const roles of [[], ['tenant'], ['landlord']] as AccountSnapshot['roles'][]) {
    assert.equal(accountVerificationSummary({ tier1_verified_at: 'date', tier2_verified_at: null, tier3_verified_at: 'date' }, roles)[2]?.status.label, 'Checked per Property');
  }
});

test('all toolbar consumers use account eligibility and empty Listings directs first owners to Post', () => {
  const app = readFileSync('App.tsx', 'utf8');
  assert.equal((app.match(/canPostProperty=\{canEnterMarketplace\}/g) ?? []).length, 6);
  const portfolio = readFileSync('src/features/property-listing/views/PropertyDashboardView.tsx','utf8');
  assert.match(portfolio, /No properties yet/);
  assert.match(portfolio, /Use Post below/);
  assert.doesNotMatch(portfolio, /onPress=\{vm.startCreate\}/);
  const navbar = readFileSync('src/shared/components/RentLeaseBottomNavigation.tsx','utf8');
  assert.deepEqual([...navbar.matchAll(/label: '(Discover|Listings|Post|Tenancy|Chat)'/g)].map(m => m[1]), ['Discover','Listings','Post','Tenancy','Chat']);
});

test('Tier 3 account entry requires Tier 1; owned-property selection remains in its service', () => {
  assert.equal(canEnterTierThree(true), true);
  assert.equal(canEnterTierThree(false), false);
  const service = readFileSync('src/features/user-verification/services/tierThreeVerificationService.ts', 'utf8');
  assert.doesNotMatch(service, /from\('user_roles'\)/);
  assert.match(service, /eq\('landlord_id', userId\)/);
  assert.match(service, /begin_property_identity_verification/);
});

test('normal onboarding never writes memberships or offers an account role selection', () => {
  const vm = readFileSync('src/features/authentication/viewModels/useAuthProfilesViewModel.ts', 'utf8');
  const view = readFileSync('src/features/authentication/views/RegistrationView.tsx', 'utf8');
  assert.doesNotMatch(vm, /saveUserRoles|submitRoles|selectedRoles/);
  assert.doesNotMatch(view, /toggleRole|submitRoles|selectedRoles/);
  const app = readFileSync('App.tsx', 'utf8');
  assert.doesNotMatch(app, /hasTenantRole|hasLandlordRole/);
  assert.match(app, /onPost=\{/);
});
