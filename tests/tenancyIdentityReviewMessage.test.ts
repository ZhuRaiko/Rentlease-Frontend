/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { createTenancyEstablishmentService } from '../src/features/tenancy/services/tenancyEstablishmentService';
import { TenancySetupError } from '../src/features/tenancy/models/TenancyEstablishment';

const A = '00000000-0000-4000-8000-000000000001';
const ctx = { reservationId: '00000000-0000-4000-8000-000000000002', propertyVersion: '00000000-0000-4000-8000-000000000003', identityRevision: '00000000-0000-4000-8000-000000000004', tenancy: null, setupRevision: null } as never;
async function propose(error: { code: string; message: string }) {
  const service = createTenancyEstablishmentService(() => ({ auth: { getUser: async () => ({ data: { user: { id: A } }, error: null }) }, rpc: () => ({ abortSignal: async () => ({ data: null, error }) }) }) as unknown as SupabaseClient<Database>);
  try { await service.write(A, { context: ctx, action: 'create', operationId: '00000000-0000-4000-8000-000000000005', draft: { rent: '10000', dueDay: '5' } }, new AbortController().signal); } catch (e) { return e as TenancySetupError; }
  throw new Error('Expected the proposal to fail');
}
const GENERIC = 'This tenancy action is not permitted for the current rental. Reload its status.';
const PENDING = 'Finish or withdraw the pending identity review for this property, then propose the tenancy again.';

test('the landlord sees a plain-language message when a pending identity review blocks a proposal', async () => {
  const error = await propose({ code: '22023', message: 'Resolve the pending identity review first.' });
  assert.ok(error instanceof TenancySetupError); assert.equal(error.message, PENDING);
  assert.equal(error.uncertain, false, 'a definitive refusal, not an uncertain outcome that would invite blind retries');
  assert.doesNotMatch(error.message, /22023|SQL|exception|Resolve the pending/i, 'raw backend text is not shown');
});

test('provider wrapping and case differences still match, but only for SQLSTATE 22023', async () => {
  assert.equal((await propose({ code: '22023', message: 'ERROR: resolve the PENDING identity review first. (hint)' })).message, PENDING);
  assert.equal((await propose({ code: '42501', message: 'Resolve the pending identity review first.' })).message, GENERIC);
  assert.equal((await propose({ code: '40001', message: 'Resolve the pending identity review first.' })).message, 'The rental or property changed. Reload tenancy setup before continuing.');
});

test('every other landlord failure keeps its existing message', async () => {
  for (const [code, message, expected] of [
    ['22023', 'Check rent and due day (1-28)', GENERIC], ['22023', 'Identity cannot change while a tenancy is open', GENERIC],
    ['42501', 'Only actual owner can propose tenancy', GENERIC], ['23514', 'anything', GENERIC],
    ['40001', 'Property changed. Review again.', 'The rental or property changed. Reload tenancy setup before continuing.'],
    ['23505', 'duplicate', 'The rental or property changed. Reload tenancy setup before continuing.'],
    ['PGRST202', 'missing function', 'This feature is not available right now. Try again later.'],
    ['57014', 'statement timeout', 'Outcome not confirmed. Retry the same operation.'],
  ] as const) assert.equal((await propose({ code, message })).message, expected, `${code} ${message}`);
});

test('the text matches the literal the migration raises, and the workflow shows the service message unchanged', () => {
  assert.ok(readFileSync('supabase/migrations/20261112164000_identity_tenancy_gate.sql', 'utf8').includes("raise exception 'Resolve the pending identity review first.'"));
  assert.match(readFileSync('src/features/tenancy/viewModels/tenancyEstablishmentWorkflow.ts', 'utf8'), /error:e instanceof TenancySetupError\?e\.message/);
});
