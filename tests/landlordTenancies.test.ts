import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLandlordTenanciesService, LANDLORD_TENANCY_LIMIT, OPEN_STATUSES } from '../src/features/tenancy/services/landlordTenanciesService';

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
function fake(user: string | null, rows: any[], error: any = null) {
  const calls: any = {};
  const builder: any = {
    select: (cols: string) => { calls.select = cols; return builder; }, eq: (k: string, v: string) => { calls.eq = [k, v]; return builder; }, in: (k: string, v: string[]) => { calls.in = [k, v]; return builder; },
    order: (k: string, o: any) => { calls.order = [k, o]; return builder; }, range: (a: number, b: number) => { calls.range = [a, b]; return builder; },
    abortSignal: () => Promise.resolve({ data: error ? null : rows, error }),
  };
  const client: any = { auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) }, from: (table: string) => { calls.table = table; return builder; } };
  return { client: () => client, calls };
}

test("reads only the landlord's own open tenancies, newest first, bounded", async () => {
  const f = fake(A, [{ id: 't1', landlord_id: A, status: 'active' }]);
  const rows = await createLandlordTenanciesService(f.client).open(A, new AbortController().signal);
  assert.equal(rows.length, 1); assert.equal(f.calls.table, 'tenancies');
  assert.deepEqual(f.calls.eq, ['landlord_id', A]); assert.deepEqual(f.calls.in, ['status', [...OPEN_STATUSES]]);
  assert.deepEqual(OPEN_STATUSES, ['active', 'proposed', 'pending_confirmation']);
  assert.deepEqual(f.calls.range, [0, LANDLORD_TENANCY_LIMIT - 1]); assert.deepEqual(f.calls.order, ['created_at', { ascending: false }]);
  assert.match(f.calls.select, /property_id/); assert.match(f.calls.select, /rent_due_day/); assert.doesNotMatch(f.calls.select, /\*/);
});

test('refuses a different signed-in account, a failed read, an aborted read and a row that names another landlord', async () => {
  const signal = new AbortController().signal;
  await assert.rejects(createLandlordTenanciesService(fake(B, []).client).open(A, signal), (e: any) => e.identity === true);
  await assert.rejects(createLandlordTenanciesService(fake(null, []).client).open(A, signal), (e: any) => e.identity === true);
  await assert.rejects(createLandlordTenanciesService(fake(A, [], { code: '42501' }).client).open(A, signal), /could not load/);
  await assert.rejects(createLandlordTenanciesService(fake(A, [{ id: 't', landlord_id: B, status: 'active' }]).client).open(A, signal), (e: any) => e.identity === true);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(createLandlordTenanciesService(fake(A, []).client).open(A, aborted.signal), (e: any) => e.identity === true);
});
