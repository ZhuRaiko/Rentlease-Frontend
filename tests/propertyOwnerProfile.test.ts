import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as presentation from '../src/features/authentication/models/accountPresentation';
import type { AccountSnapshot } from '../src/features/authentication/models/AuthProfile';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { readAccountOwnership } from '../src/features/authentication/services/accountOwnershipService';
import { readFileSync } from 'node:fs';

test('actual property ownership is recognized independently of preference, memberships and Tier 3', () => {
  const labels = presentation.accountIdentityLabels;
  for (const roles of [[], ['tenant'], ['landlord']] as AccountSnapshot['roles'][]) {
    for (const preference of [null, 'rent','list','both'] as const) {
      const account = { roles, ownsProperty: true, profile: { experience_preference: preference, tier3_verified_at: null } } as AccountSnapshot;
      assert.ok(labels(account).includes('Property Owner'));
      assert.equal(labels(account).some((label: string) => /verified/i.test(label)), false);
      assert.equal(labels({ ...account, ownsProperty: false }).includes('Property Owner'), false);
      assert.equal(labels({ ...account, ownsProperty: undefined }).includes('Property Owner'), false);
    }
  }
});

test('Admin label remains separate and ownership never changes property-specific verification', () => {
  const labels = presentation.accountIdentityLabels;
  assert.deepEqual(labels({ roles: ['admin'], ownsProperty: true, profile: { experience_preference: 'list' } } as AccountSnapshot), ['Admin','Property Owner']);
  assert.equal(presentation.accountVerificationSummary({ tier1_verified_at:'date',tier2_verified_at:null,tier3_verified_at:null },[])[2]?.status.label,'Checked per Property');
});

function fixture(data: Array<{id:string;landlord_id:string}> | null, error: unknown = null) {
  const calls: unknown[][] = [];
  const query = {
    select: (...args: unknown[]) => { calls.push(['select',...args]);return query; },
    eq: (...args: unknown[]) => { calls.push(['eq',...args]);return query; },
    limit: async (...args: unknown[]) => { calls.push(['limit',...args]);return { data, error }; },
  };
  const client = { from: (table:string) => { calls.push(['from',table]);return query; } } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

test('ownership lookup projects one owner row without portfolio, verification or membership requests', async () => {
  const h=fixture([{id:'property',landlord_id:'owner'}]);
  assert.equal(await readAccountOwnership(h.client,'owner'),true);
  assert.deepEqual(h.calls,[['from','properties'],['select','id,landlord_id'],['eq','landlord_id','owner'],['limit',1]]);
  assert.equal(await readAccountOwnership(fixture([]).client,'owner'),false);
});

test('ownership query errors and foreign results stay unknown instead of asserting ownership or blocking Auth', async () => {
  for (const h of [fixture(null,Error('offline')),fixture(null),fixture([{id:'foreign',landlord_id:'another'}]),fixture([{id:'one',landlord_id:'owner'},{id:'two',landlord_id:'owner'}])]) {
    assert.equal(await readAccountOwnership(h.client,'owner'),undefined);
  }
  assert.equal(await readAccountOwnership({from:()=>{throw Error('offline');}} as unknown as SupabaseClient<Database>,'owner'),undefined);
});

test('Profile entry refresh uses the account coordinator, not a second portfolio owner or View query', () => {
  const app=readFileSync('App.tsx','utf8');
  const vm=readFileSync('src/features/authentication/viewModels/useAuthProfilesViewModel.ts','utf8');
  assert.match(app,/void auth.refreshProfile\(\)/);
  assert.match(vm,/refreshProfile:[\s\S]*?syncRef.current\?\.refresh\('background'\)\.catch\(\(\) => null\)/);
  const profile=readFileSync('src/features/authentication/views/ProfileView.tsx','utf8');
  assert.doesNotMatch(profile,/supabase|readAccountOwnership|landlordPortfolioService/);
});
