/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { createTierThreeVerificationService } from '../src/features/user-verification/services/tierThreeVerificationService';

function fixture() {
  const calls: unknown[][] = []; let identity: string | null = 'owner'; let role = 'landlord'; let tierOne = true; let active = true; let propertyOwner = 'owner'; let fail = '';
  const property = () => ({ id: 'p', landlord_id: propertyOwner, property_type: 'apartment', barangay: 'Test', city: 'imus' });
  const submission = { id: 's', property_id: 'p', status: 'pending', rejection_reason: null, review_note: null, submitted_at: '', reviewed_at: null };
  const client = {
    auth: { getUser: async () => ({ data: { user: identity ? { id: identity } : null }, error: null }) },
    from: (table: string) => {
      calls.push(['from', table]); let inserted: unknown;
      const response = () => {
        if (fail === table) return { data: null, error: Error('denied') };
        const data = table === 'profiles' ? { account_status: active ? 'active' : 'suspended', tier1_verified_at: tierOne ? '2026-10-01' : null }
          : table === 'user_roles' ? [{ role }] : table === 'properties' ? [property()]
          : table === 'verification_submissions' ? inserted ? submission : { ...submission, verification_documents: [{ id: 'd' }] } : null;
        return { data, error: null };
      };
      const query = {
        select: (fields: string) => { calls.push(['select', table, fields]); return query; },
        eq: (column: string, value: string) => { calls.push(['eq', table, column, value]); return query; },
        order: (column: string, options: unknown) => { calls.push(['order', table, column, options]); return query; },
        limit: (count: number) => { calls.push(['limit', table, count]); return query; },
        insert: (payload: unknown) => { inserted = payload; calls.push(['insert', table, payload]); return query; },
        maybeSingle: async () => response(), single: async () => response(),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(response()).then(resolve),
      }; return query;
    },
  } as unknown as SupabaseClient<Database>;
  return { calls, service: createTierThreeVerificationService(() => client), noAuth: () => { identity = null; }, switchUser: () => { identity = 'another'; }, tenant: () => { role = 'tenant'; }, noTierOne: () => { tierOne = false; }, restricted: () => { active = false; }, foreignProperty: () => { propertyOwner = 'other'; }, fail: (table: string) => { fail = table; } };
}
test('service verifies Auth, own active Tier 1 profile and landlord role without requiring Tier 2', async () => {
  const h = fixture(); assert.equal(await h.service.getEligibleUserId(), 'owner');
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'profiles' && c[2] === 'id' && c[3] === 'owner'));
  assert.ok(!JSON.stringify(h.calls).includes('tier2_verified_at'));
  for (const deny of ['noAuth', 'tenant', 'noTierOne', 'restricted'] as const) { const denied = fixture(); denied[deny](); await assert.rejects(denied.service.getEligibleUserId()); }
});
test('property service explicitly filters landlord_id and excludes foreign rows even when RLS permits public reads', async () => {
  const h = fixture(); assert.equal((await h.service.fetchOwnedProperties('owner')).length, 1);
  assert.ok(h.calls.some(c => JSON.stringify(c) === JSON.stringify(['eq', 'properties', 'landlord_id', 'owner'])));
  h.foreignProperty(); assert.deepEqual(await h.service.fetchOwnedProperties('owner'), []);
  await assert.rejects(h.service.createSubmission('owner', 'p')); assert.ok(!h.calls.some(c => c[0] === 'insert'));
});
test('latest status query is scoped to user, Tier 3 and selected property, ordered and limited', async () => {
  const h = fixture(); const result = await h.service.fetchLatest('owner', 'p'); assert.equal(result?.hasDocument, true);
  for (const pair of [['user_id', 'owner'], ['tier', 'tier_3_property'], ['property_id', 'p']]) assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'verification_submissions' && c[2] === pair[0] && c[3] === pair[1]));
  assert.ok(h.calls.some(c => c[0] === 'limit' && c[2] === 1));
});
test('create writes only user_id, tier and property_id; no client review, profile or trust writes', async () => {
  const h = fixture(); const result = await h.service.createSubmission('owner', 'p'); assert.equal(result.hasDocument, false);
  assert.deepEqual(h.calls.filter(c => c[0] === 'insert'), [['insert', 'verification_submissions', { user_id: 'owner', tier: 'tier_3_property', property_id: 'p' }]]);
});
test('metadata uses created submission and existing private path with one of four qualifying enums', async () => {
  const h = fixture(); const uploaded = { storagePath: 'owner/s/uuid.jpeg', fileName: 'file.jpeg', mimeType: 'image/jpeg', size: 12 };
  await h.service.insertDocument('owner', 's', 'authorization_to_lease', uploaded);
  assert.deepEqual(h.calls.filter(c => c[0] === 'insert'), [['insert', 'verification_documents', { submission_id: 's', document_type: 'authorization_to_lease', storage_path: uploaded.storagePath, file_name: uploaded.fileName, mime_type: uploaded.mimeType }]]);
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'verification_submissions' && c[2] === 'user_id' && c[3] === 'owner'));
});
test('changed identity and query errors cannot become eligible empty state or create', async () => {
  const h = fixture(); h.switchUser(); await assert.rejects(h.service.fetchOwnedProperties('owner')); assert.ok(!h.calls.some(c => c[1] === 'properties'));
  const denied = fixture(); denied.fail('verification_submissions'); await assert.rejects(denied.service.fetchLatest('owner', 'p'));
  const noProperties = fixture(); noProperties.fail('properties'); await assert.rejects(noProperties.service.fetchOwnedProperties('owner'));
});
