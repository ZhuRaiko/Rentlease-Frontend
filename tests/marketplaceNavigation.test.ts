/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialMarketplaceWorkspace, propertiesWorkspace, switchMarketplaceMode } from '../src/shared/models/marketplaceNavigation';
import { createMarketplaceIntroduction } from '../src/features/authentication/viewModels/marketplaceIntroduction';
import { createNavigationConfirmation as createListingNavigationGuard } from '../src/shared/viewModels/navigationConfirmation';
import type { AccountSnapshot } from '../src/features/authentication/models/AuthProfile';
import { leavesListingEditor, listingActiveTab } from '../src/features/property-listing/models/listingNavigation';
import { matchingPreferenceFilters, recommendedMatchingPreferences } from '../src/features/search-discovery/models/SearchDiscovery';

const tenant = { marketplace: true, admin: false, tenant: true, landlord: false };
const dual = { ...tenant, landlord: true };
const account = (): AccountSnapshot => ({ user: { id: 'new', aud: 'authenticated', created_at: '', app_metadata: {}, user_metadata: {}, email_confirmed_at: 'date' }, profile: { id: 'new', display_name: null, bio: null, avatar_path: null, tier1_verified_at: 'date', tier2_verified_at: null, tier3_verified_at: null, trust_score: null, account_status: 'active' }, roles: ['tenant'] });

test('Listings and My Properties share dashboard entry; Post uses creation and role membership, not active mode or Tier 3', () => {
  assert.deepEqual(propertiesWorkspace(dual, 'dashboard'), { type: 'properties', initialScreen: 'dashboard' });
  assert.deepEqual(propertiesWorkspace(dual, 'postingType'), { type: 'properties', initialScreen: 'postingType' });
  assert.equal(propertiesWorkspace(tenant, 'dashboard'), null);
  assert.equal(propertiesWorkspace({ ...dual, marketplace: false }, 'postingType'), null);
});
test('dual roles switch predictably without changing membership; landlord-only can still browse', () => {
  assert.deepEqual(switchMarketplaceMode(dual, 'landlord'), { mode: 'landlord', workspace: { type: 'properties', initialScreen: 'dashboard' } });
  assert.deepEqual(switchMarketplaceMode(dual, 'tenant'), { mode: 'tenant', workspace: { type: 'discovery', initialScreen: 'home' } });
  assert.equal(switchMarketplaceMode(tenant, 'landlord'), null);
  assert.equal(switchMarketplaceMode({ ...dual, tenant: false }, 'tenant'), null);
  assert.equal(dual.landlord, true);
});
test('Admin and restricted routing take precedence over ordinary modes', () => {
  assert.deepEqual(initialMarketplaceWorkspace({ ...dual, admin: true, marketplace: false }, 'landlord'), { type: 'adminModeration' });
  assert.equal(switchMarketplaceMode({ ...dual, admin: true }, 'landlord'), null);
  assert.equal(propertiesWorkspace({ ...dual, admin: true }, 'dashboard'), null);
  assert.equal(initialMarketplaceWorkspace({ ...dual, marketplace: false }, 'tenant'), null);
});
test('only a successful signup marker and authoritative completion offer preferences once', () => {
  const intro = createMarketplaceIntroduction(); const snapshot = account();
  assert.equal(intro.consume(snapshot), false); intro.markCreated('new');
  delete snapshot.user.email_confirmed_at; assert.equal(intro.consume(snapshot), false);
  snapshot.user.email_confirmed_at = 'date'; snapshot.profile.tier1_verified_at = null; assert.equal(intro.consume(snapshot), false);
  snapshot.profile.tier1_verified_at = 'date'; snapshot.roles = []; assert.equal(intro.consume(snapshot), false);
  snapshot.roles = ['tenant']; assert.equal(intro.consume(snapshot), true); assert.equal(intro.consume(snapshot), false);
});
test('returning users, restart, sign-out, other identities and Admin never receive the new-account offer', () => {
  const snapshot = account(); const intro = createMarketplaceIntroduction();
  intro.markCreated('new'); intro.clear(); assert.equal(intro.consume(snapshot), false);
  intro.markCreated('other'); assert.equal(intro.consume(snapshot), false);
  intro.markCreated('new'); snapshot.roles = ['admin', 'landlord']; assert.equal(intro.consume(snapshot), false);
  assert.equal(createMarketplaceIntroduction().consume(account()), false);
});
test('Skip and completion return to the eligible mode destination without changing roles or making a write', () => {
  assert.deepEqual(initialMarketplaceWorkspace(tenant, 'tenant'), { type: 'discovery', initialScreen: 'home' });
  assert.deepEqual(initialMarketplaceWorkspace(dual, 'landlord'), { type: 'properties', initialScreen: 'dashboard' });
});
test('unfinished listing navigation requires explicit confirmation; Cancel and repeated confirms cannot discard twice', () => {
  let dirty = true; let exits = 0; const guard = createListingNavigationGuard(() => dirty);
  guard.request(() => exits++); assert.equal(guard.getSnapshot(), true); assert.equal(exits, 0);
  guard.cancel(); assert.equal(guard.getSnapshot(), false); assert.equal(exits, 0);
  guard.request(() => exits++); guard.request(() => { exits += 10; }); guard.confirm(); guard.confirm(); assert.equal(exits, 1);
  dirty = false; guard.request(() => exits++); assert.equal(exits, 2); assert.equal(guard.getSnapshot(), false);
});

test('listing tab reflects dashboard/management while creation and its confirmation select Post', () => {
  for (const screen of ['dashboard', 'management', 'published', 'empty'] as const) assert.equal(listingActiveTab(screen), 'listing');
  for (const screen of ['postingType', 'basicInfo', 'preview', 'publishConfirmation'] as const) assert.equal(listingActiveTab(screen), 'post');
});
test('saved preference projection retains the existing local filters without activating ranking or nearby services', () => {
  const preferences = { ...recommendedMatchingPreferences, city: 'Imus', minimumRent: 5000, prioritizeNearbyPlaces: true };
  const filters = matchingPreferenceFilters(preferences);
  assert.equal(filters.city, 'Imus'); assert.equal(filters.minimumRent, 5000);
  assert.equal('prioritizeNearbyPlaces' in filters, false); assert.equal('factorRanking' in filters, false);
  assert.equal(preferences.prioritizeNearbyPlaces, true);
});
test('Back guards every editor exit including editListing to management, while wizard Back retains the draft', () => {
  assert.equal(leavesListingEditor('editListing', 'management'), true);
  assert.equal(leavesListingEditor('basicInfo', 'published'), true);
  assert.equal(leavesListingEditor('postingType', 'dashboard'), true);
  assert.equal(leavesListingEditor('specifications', 'basicInfo'), false);
  assert.equal(leavesListingEditor('management', 'dashboard'), false);
});
