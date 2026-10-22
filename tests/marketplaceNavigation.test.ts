import { createMarketplaceIntroductionService } from '../src/features/authentication/services/marketplaceIntroductionService';
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
test('persistent signup marker waits for authoritative completion and remains pending when merely opened', async () => {
  const values = new Map<string, string>();
  const service = createMarketplaceIntroductionService({ getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } });
  const intro = createMarketplaceIntroduction(service); const snapshot = account();
  await intro.check(snapshot); assert.equal(intro.getSnapshot().status, 'notRequired');
  await intro.markCreated('new'); intro.clear();
  delete snapshot.user.email_confirmed_at; await intro.check(snapshot); assert.equal(intro.getSnapshot().status, 'idle');
  snapshot.user.email_confirmed_at = 'date'; snapshot.profile.tier1_verified_at = null; await intro.check(snapshot); assert.equal(intro.getSnapshot().status, 'idle');
  snapshot.profile.tier1_verified_at = 'date'; snapshot.roles = []; await intro.check(snapshot); assert.equal(intro.getSnapshot().status, 'idle');
  snapshot.roles = ['tenant']; await intro.check(snapshot); assert.equal(intro.getSnapshot().status, 'required');
  assert.equal(await service.read('new'), 'pending');
});
test('completed users and Admin bypass do not receive a repeated introduction', async () => {
  const values = new Map<string, string>();
  const service = createMarketplaceIntroductionService({ getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } });
  const intro = createMarketplaceIntroduction(service); const snapshot = account();
  await intro.markCreated('new'); await intro.check(snapshot); await intro.complete('new');
  const restarted = createMarketplaceIntroduction(service); await restarted.check(snapshot); assert.equal(restarted.getSnapshot().status, 'complete');
  restarted.clear(); snapshot.roles = ['admin', 'landlord']; await restarted.check(snapshot); assert.equal(restarted.getSnapshot().status, 'idle');
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
