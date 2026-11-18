/// <reference types="node" />
import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '../src/shared/services/supabase/database.types';
import {getSessionUserId,readSessionUser} from '../src/shared/services/supabase/sessionUser';
import {createManualSearchService} from '../src/features/search-discovery/services/manualSearchService';
import {createMessagingService} from '../src/features/messaging-viewing/services/messagingService';
import {createSavedListingsService} from '../src/features/search-discovery/services/savedListingsService';
import {createTenancyExtensionService} from '../src/features/tenancy/services/tenancyExtensionService';
import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {resolve} from 'node:path';import ts from 'typescript';
import {createLandlordPortfolioService} from '../src/features/property-listing/services/landlordPortfolioService';

/** The identity service imports the real client module (React Native); load it with that import stubbed, as tests/publicIdentity.test.ts does. */
function loadIdentityService(){const file=resolve('src/shared/services/publicIdentityService.ts'),actual=createRequire(file),mod={exports:{} as any};new Function('require','module','exports',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)((key:string)=>key==='./supabase/client'?{getSupabaseClient:()=>{throw Error('No real backend');}}:actual(key),mod,mod.exports);return mod.exports as {createPublicIdentityService:(c:()=>SupabaseClient<Database>)=>any};}
const A = '10000000-0000-4000-8000-00000000000a', B = '10000000-0000-4000-8000-00000000000b', C = '30000000-0000-4000-8000-00000000000c';
/** A client that counts both ways of asking who is signed in. `session` is what the local session says (null = none); `network` is what the Auth server says. */
function counting(session: () => string | null, network: () => string | null = () => A) {
  const counts = { getSession: 0, getUser: 0 };
  const rpcs: string[] = [];
  const builder = (value: unknown): any => new Proxy({}, { get(_t, key) { if (key === 'then') return (ok: any, no: any) => Promise.resolve(value).then(ok, no); return () => builder(value); } });
  const client = {
    auth: {
      getSession: async () => { counts.getSession++; const id = session(); return { data: { session: id ? { user: { id } } : null }, error: null }; },
      getUser: async () => { counts.getUser++; const id = network(); return id ? { data: { user: { id } }, error: null } : { data: { user: null }, error: new Error('no user') }; },
    },
    from: () => builder({ data: [], error: null }),
    rpc: (name: string) => { rpcs.push(name); return builder({ data: [], error: null }); },
    functions: { invoke: async () => ({ data: null, error: null }) },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://example.test/x' } }) }) },
  } as unknown as SupabaseClient<Database>;
  return { client, counts, rpcs };
}
const signal = () => new AbortController().signal;

// ---- the helper -----------------------------------------------------------------------------------------------------------------------------
test('the helper reads the user from the local session and never asks the network', async () => {
  const h = counting(() => A);
  assert.equal(await getSessionUserId(h.client), A); const full = await readSessionUser(h.client);
  assert.deepEqual(full.data.user, { id: A }); assert.equal(full.error, null);
  assert.equal(h.counts.getUser, 0); assert.equal(h.counts.getSession, 2);
});
test('no session gives no user and an error, as getUser would', async () => {
  const h = counting(() => null); const r = await readSessionUser(h.client);
  assert.equal(r.data.user, null); assert.ok(r.error); assert.equal(await getSessionUserId(h.client), null);
});
test('a session store that throws gives no user and an error', async () => {
  const client = { auth: { getSession: async () => { throw new Error('storage unavailable'); }, getUser: async () => ({ data: { user: { id: A } }, error: null }) } };
  const r = await readSessionUser(client); assert.equal(r.data.user, null); assert.ok(r.error);
});
test('a client with no local session store (only getUser) still works through getUser', async () => {
  const client = { auth: { getUser: async () => ({ data: { user: { id: A } }, error: null }) } };
  assert.equal(await getSessionUserId(client), A);
});

// ---- read paths: local session, same protection ---------------------------------------------------------------------------------------------
test('search results: reads use the local session only; an account switch in the middle still throws', async () => {
  const h = counting(() => A);
  const service = createManualSearchService(() => h.client);
  await service.user(); assert.equal(h.counts.getUser, 0); assert.ok(h.counts.getSession >= 1);
  let who = A; const switching = counting(() => who);
  const s2 = createManualSearchService(() => switching.client);
  const detail = s2.detail(A, '00000000-0000-4000-8000-000000000001', signal()); who = B;
  await assert.rejects(detail, /account changed|no longer available/i);
  assert.equal(switching.counts.getUser, 0, 'no network identity call on a read');
});
test('search results: a missing or expired session gives the same sign-in error as before', async () => {
  const h = counting(() => null); const service = createManualSearchService(() => h.client);
  await assert.rejects(service.user(), (e: any) => /Sign in again to search rentals/.test(e.message) && e.identity === true);
  assert.equal(h.counts.getUser, 0);
});
test('Messages list reads use the local session; sending a message still asks the Auth server first', async () => {
  const read = counting(() => A), service = createMessagingService(() => read.client);
  await service.inbox(A, 0, signal()); assert.equal(read.counts.getUser, 0); assert.ok(read.counts.getSession >= 1);
  const write = counting(() => A, () => B), sender = createMessagingService(() => write.client);
  await assert.rejects(sender.send(A, '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Hello'), /account changed/i);
  assert.ok(write.counts.getUser >= 1, 'the network check ran'); assert.equal(write.counts.getSession, 0, 'a write does not trust the local session');
  assert.ok(!write.rpcs.includes('send_property_message'), 'and nothing was sent');
});
test('saved listings: a page read uses the local session; setting a bookmark still uses the network check', async () => {
  const read = counting(() => A), service = createSavedListingsService(() => read.client);
  await service.page(A, 0, 'recent' as any, signal()).catch(() => {}); assert.equal(read.counts.getUser, 0); assert.ok(read.counts.getSession >= 1);
  const write = counting(() => A, () => B), setter = createSavedListingsService(() => write.client);
  await assert.rejects(setter.set(A, '50000000-0000-4000-8000-000000000001', true, signal()), /account changed/i);
  assert.ok(write.counts.getUser >= 1); assert.equal(write.counts.getSession, 0);
});
test('tenancy extension: the read uses the local session; a request, accept or decline still asks the Auth server', async () => {
  const read = counting(() => A), service = createTenancyExtensionService(() => read.client);
  await service.read(A, '60000000-0000-4000-8000-000000000001', signal()).catch(() => {}); assert.equal(read.counts.getUser, 0); assert.ok(read.counts.getSession >= 1);
  const write = counting(() => A, () => B), writer = createTenancyExtensionService(() => write.client);
  await assert.rejects(writer.write(A, { operationId: '60000000-0000-4000-8000-000000000002', tenancyId: '60000000-0000-4000-8000-000000000001', action: 'withdraw', payload: { requestId: '60000000-0000-4000-8000-000000000003', revision: 'r1' } } as any, signal()), /account changed/i);
  assert.ok(write.counts.getUser >= 1); assert.equal(write.counts.getSession, 0); assert.ok(!write.rpcs.includes('write_tenancy_extension'));
});
test('public identity: reading uses the local session; saving the profile still asks the Auth server', async () => {
  const read = counting(() => A), service = loadIdentityService().createPublicIdentityService(() => read.client);
  await service.read(A, [B]).catch(() => {}); assert.equal(read.counts.getUser, 0); assert.ok(read.counts.getSession >= 1);
  const write = counting(() => A, () => B), saver = loadIdentityService().createPublicIdentityService(() => write.client);
  await assert.rejects(saver.save(A, '70000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', 'Nick', null, true), /account changed/i);
  assert.ok(write.counts.getUser >= 1); assert.equal(write.counts.getSession, 0);
});
test('My properties: the list read uses the local session', async () => {
  const h = counting(() => A), service = createLandlordPortfolioService(() => h.client, () => {});
  assert.equal(await service.user(), A); assert.equal(h.counts.getUser, 0); assert.ok(h.counts.getSession >= 1);
  await assert.rejects(createLandlordPortfolioService(() => counting(() => null).client, () => {}).user());
});
test('a different account in the local session is caught the same way as before (identity mismatch)', async () => {
  const h = counting(() => A), service = createMessagingService(() => h.client);
  await assert.rejects(service.inbox(C, 0, signal()), /account changed/i);
});
