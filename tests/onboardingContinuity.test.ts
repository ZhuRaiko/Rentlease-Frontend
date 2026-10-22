/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AccountSnapshot } from '../src/features/authentication/models/AuthProfile';
import { createMarketplaceIntroductionService } from '../src/features/authentication/services/marketplaceIntroductionService';
import { createMarketplaceIntroduction } from '../src/features/authentication/viewModels/marketplaceIntroduction';
import { getWorkspaceDestination } from '../src/features/authentication/models/accountRouting';
import { propertiesWorkspace } from '../src/shared/models/marketplaceNavigation';

function fixture() {
  const values = new Map<string, string>(); let fail = false;
  const service = createMarketplaceIntroductionService({ getItem: async key => { if (fail) throw Error('native storage unavailable'); return values.get(key) ?? null; }, setItem: async (key, value) => { if (fail) throw Error('native storage unavailable'); values.set(key, value); } });
  const account: AccountSnapshot = { user: { id: 'new-account', aud: 'authenticated', created_at: 'irrelevant', app_metadata: {}, user_metadata: {}, email_confirmed_at: 'confirmed' }, profile: { id: 'new-account', display_name: null, bio: null, avatar_path: null, account_status: 'active', tier1_verified_at: 'confirmed', tier2_verified_at: null, tier3_verified_at: null, trust_score: null }, roles: ['landlord'] };
  return { service, values, account, fail: (value: boolean) => { fail = value; } };
}
test('Tier 1 landlord enters preview creation without an account Tier 3 timestamp; unverified accounts remain blocked', () => {
  const { account } = fixture();
  assert.deepEqual(propertiesWorkspace({ marketplace: getWorkspaceDestination(account) === 'discovery', admin: false, landlord: true, tenant: false }, 'postingType'), { type: 'properties', initialScreen: 'postingType' });
  account.profile.tier1_verified_at = null;
  assert.equal(propertiesWorkspace({ marketplace: getWorkspaceDestination(account) === 'discovery', admin: false, landlord: true, tenant: false }, 'postingType'), null);
});
test('restart during email/phone/role onboarding retains a pending account marker and offers only after real completion', async () => {
  const h = fixture(); let controller = createMarketplaceIntroduction(h.service); await controller.markCreated(h.account.user.id);
  delete h.account.user.email_confirmed_at; await controller.check(h.account); assert.equal(controller.getSnapshot().status, 'idle'); controller.dispose();
  controller = createMarketplaceIntroduction(h.service); h.account.user.email_confirmed_at = 'confirmed'; h.account.profile.tier1_verified_at = null;
  await controller.check(h.account); assert.equal(controller.getSnapshot().status, 'idle'); controller.dispose();
  controller = createMarketplaceIntroduction(h.service); h.account.profile.tier1_verified_at = 'confirmed'; h.account.roles = [];
  await controller.check(h.account); assert.equal(controller.getSnapshot().status, 'idle');
  h.account.roles = ['landlord']; await controller.check(h.account); assert.equal(controller.getSnapshot().status, 'required');
  assert.equal(await h.service.read(h.account.user.id), 'pending');
});
test('opening is not completion; logout/restart reoffers pending while explicit Save/Skip survives future sign-ins', async () => {
  for (const action of ['Save', 'Skip']) {
    const h = fixture(); const controller = createMarketplaceIntroduction(h.service); await controller.markCreated(h.account.user.id); await controller.check(h.account);
    controller.clear(); const resumed = createMarketplaceIntroduction(h.service); await resumed.check(h.account); assert.equal(resumed.getSnapshot().status, 'required');
    assert.equal(await resumed.complete(h.account.user.id), true, action);
    const returning = createMarketplaceIntroduction(h.service); await returning.check(h.account); assert.equal(returning.getSnapshot().status, 'complete');
    await h.service.markPending(h.account.user.id); assert.equal(await h.service.read(h.account.user.id), 'done');
    assert.deepEqual(new Set(h.values.values()), new Set(['done']));
  }
});
test('normal users without a marker, other identities, Admin and restrictions are not inferred to be new from dates', async () => {
  const h = fixture(); const controller = createMarketplaceIntroduction(h.service); await controller.check(h.account); assert.equal(controller.getSnapshot().status, 'notRequired');
  await controller.markCreated('different-account'); await controller.check(h.account, true); assert.equal(controller.getSnapshot().status, 'notRequired');
  await controller.markCreated(h.account.user.id); h.account.roles = ['admin', 'landlord']; await controller.check(h.account); assert.equal(controller.getSnapshot().status, 'idle');
  h.account.roles = ['landlord']; h.account.profile.account_status = 'restricted'; await controller.check(h.account); assert.equal(controller.getSnapshot().status, 'idle');
  assert.equal(await controller.complete(h.account.user.id), false);
});
test('storage failures are recoverable without repeating signup or falsely completing the introduction', async () => {
  const h = fixture(); const controller = createMarketplaceIntroduction(h.service); h.fail(true);
  assert.equal(await controller.markCreated(h.account.user.id), false); await controller.check(h.account); assert.equal(controller.getSnapshot().status, 'error');
  h.fail(false); await controller.check(h.account, true); assert.equal(controller.getSnapshot().status, 'required');
  h.fail(true); assert.equal(await controller.complete(h.account.user.id), false); assert.equal(controller.getSnapshot().status, 'required'); assert.ok(controller.getSnapshot().error);
  h.fail(false); assert.equal(await h.service.read(h.account.user.id), 'pending'); assert.equal(await controller.complete(h.account.user.id), true);
});
test('late local reads cannot offer another account setup after logout or account change', async () => {
  const h = fixture(); await h.service.markPending(h.account.user.id); let release!: () => void;
  const controller = createMarketplaceIntroduction({ ...h.service, read: async id => { await new Promise<void>(resolve => { release = resolve; }); return h.service.read(id); } });
  const read = controller.check(h.account); controller.clear(); release(); await read; assert.equal(controller.getSnapshot().userId, null);
});
test('concurrent completion is excluded and only a pending marker can become done', async () => {
  const h = fixture(); let release!: () => void;
  const controller = createMarketplaceIntroduction({ ...h.service, complete: async id => { await new Promise<void>(resolve => { release = resolve; }); await h.service.complete(id); } });
  await controller.markCreated(h.account.user.id); await controller.check(h.account);
  const first = controller.complete(h.account.user.id); assert.equal(await controller.complete(h.account.user.id), false);
  assert.equal(await controller.complete('other'), false); release(); assert.equal(await first, true);
  assert.equal(await controller.complete(h.account.user.id), false);
});
