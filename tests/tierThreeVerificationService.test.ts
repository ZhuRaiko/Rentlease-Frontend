/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { createTierThreeVerificationService } from '../src/features/user-verification/services/tierThreeVerificationService';

function fixture() {
  const calls: unknown[][] = []; let identity: string | null = 'owner'; let role = 'landlord'; let tierOne = true; let active = true; let propertyOwner = 'owner'; let fail = ''; let missingContract=false;
  const property = () => ({ id: 'p', landlord_id: propertyOwner, property_type: 'apartment', barangay: 'Test', city: 'imus' });
  const submission = { id: 's', property_id: 'p', status: 'pending', rejection_reason: null, review_note: null, submitted_at: '', reviewed_at: null };
  const client = {
    auth: { getUser: async () => ({ data: { user: identity ? { id: identity } : null }, error: null }) },
    rpc:async(name:string,args:unknown)=>{calls.push(['rpc',name,args]);if(fail==='verification_submissions')return {data:null,error:Error('denied')};if(missingContract)return {data:null,error:{code:'PGRST202'}};return {data:name==='get_property_identity_context'?{property_id:'p',owner_id:'owner',current_revision_id:'revision'}:name==='attach_property_identity_document'?null:{...submission,hasDocument:name==='get_property_identity_submission',ready_for_review_at:null},error:null};},
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
  return { missingContract:()=>{missingContract=true;}, calls, service: createTierThreeVerificationService(() => client), noAuth: () => { identity = null; }, switchUser: () => { identity = 'another'; }, tenant: () => { role = 'tenant'; }, noTierOne: () => { tierOne = false; }, restricted: () => { active = false; }, foreignProperty: () => { propertyOwner = 'other'; }, fail: (table: string) => { fail = table; } };
}
test('service verifies Auth, own active Tier 1 profile without requiring normal roles or Tier 2', async () => {
  const h = fixture(); assert.equal(await h.service.getEligibleUserId(), 'owner');
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'profiles' && c[2] === 'id' && c[3] === 'owner'));
  assert.ok(!JSON.stringify(h.calls).includes('tier2_verified_at'));
  h.tenant(); assert.equal(await h.service.getEligibleUserId(), 'owner');
  assert.equal(h.calls.some(c => c[1] === 'user_roles'), false);
  for (const deny of ['noAuth', 'noTierOne', 'restricted'] as const) { const denied = fixture(); denied[deny](); await assert.rejects(denied.service.getEligibleUserId()); }
});
test('property service explicitly filters landlord_id and excludes foreign rows even when RLS permits public reads', async () => {
  const h = fixture(); assert.equal((await h.service.fetchOwnedProperties('owner')).length, 1);
  assert.ok(h.calls.some(c => JSON.stringify(c) === JSON.stringify(['eq', 'properties', 'landlord_id', 'owner'])));
  h.foreignProperty(); assert.deepEqual(await h.service.fetchOwnedProperties('owner'), []);
  await assert.rejects(h.service.createSubmission('owner', 'p')); assert.ok(!h.calls.some(c => c[0] === 'insert'));
});
test('before deployment read-only fallback remains scoped to user, Tier 3 and selected property', async () => {
  const h = fixture();h.missingContract(); const result = await h.service.fetchLatest('owner', 'p'); assert.equal(result?.hasDocument, true);
  for (const pair of [['user_id', 'owner'], ['tier', 'tier_3_property'], ['property_id', 'p']]) assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'verification_submissions' && c[2] === pair[0] && c[3] === pair[1]));
  assert.ok(h.calls.some(c => c[0] === 'limit' && c[2] === 1));
});
test('controlled start passes physical property UUID only; no direct review or trust writes', async () => {
  const h = fixture(); const result = await h.service.createSubmission('owner', 'p'); assert.equal(result.hasDocument, false);
  assert.deepEqual(h.calls.filter(c=>c[0]==='rpc'),[['rpc','get_property_identity_context',{p_property_id:'p'}],['rpc','begin_property_identity_verification',{p_property_id:'p',p_expected_revision:'revision'}]]);assert.equal(h.calls.some(c=>c[0]==='insert'),false);
});
test('metadata uses created submission and existing private path with one of four qualifying enums', async () => {
  const h = fixture(); const uploaded = { storagePath: 'owner/s/uuid.jpeg', fileName: 'file.jpeg', mimeType: 'image/jpeg', size: 12 };
  await h.service.insertDocument('owner', 's', 'authorization_to_lease', uploaded);
  assert.deepEqual(h.calls.filter(c=>c[0]==='rpc'),[['rpc','attach_property_identity_document',{p_submission_id:'s',p_document_type:'authorization_to_lease',p_storage_path:uploaded.storagePath,p_file_name:uploaded.fileName,p_mime_type:uploaded.mimeType}]]);assert.equal(h.calls.some(c=>c[0]==='insert'),false);
  assert.ok(h.calls.some(c => c[0] === 'eq' && c[1] === 'verification_submissions' && c[2] === 'user_id' && c[3] === 'owner'));
});
test('changed identity and query errors cannot become eligible empty state or create', async () => {
  const h = fixture(); h.switchUser(); await assert.rejects(h.service.fetchOwnedProperties('owner')); assert.ok(!h.calls.some(c => c[1] === 'properties'));
  const denied = fixture(); denied.fail('verification_submissions'); await assert.rejects(denied.service.fetchLatest('owner', 'p'));
  const noProperties = fixture(); noProperties.fail('properties'); await assert.rejects(noProperties.service.fetchOwnedProperties('owner'));
});

test('Tier 3 picker reads physical properties without listing-status or submission-existence filters',async()=>{
 const h=fixture();const properties=await h.service.fetchOwnedProperties('owner');assert.equal(properties[0]?.id,'p');assert.ok(h.calls.some(c=>c[0]==='eq'&&c[1]==='properties'&&c[2]==='landlord_id'&&c[3]==='owner'));assert.equal(h.calls.some(c=>c[0]==='from'&&(c[1]==='listings'||c[1]==='verification_submissions')),false);assert.equal(h.calls.some(c=>c[0]==='insert'),false);assert.equal(h.calls.some(c=>c[0]==='eq'&&c[2]==='status'),false);
});


test('revision-aware status uses server target selection without trusting a listing ID or account badge',async()=>{const h=fixture();const result=await h.service.fetchLatest('owner','p');assert.equal(result?.property_id,'p');assert.deepEqual(h.calls.filter(c=>c[0]==='rpc'),[['rpc','get_property_identity_submission',{p_property_id:'p'}]]);});


test('canonical verification reads are separate from proposed evidence targeting',async()=>{const h=fixture();await h.service.fetchCurrent('owner','p');assert.deepEqual(h.calls.filter(c=>c[0]==='rpc'),[['rpc','get_property_identity_submission',{p_property_id:'p',p_current_only:true}]]);});
