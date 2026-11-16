/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { bannerText, disputeMessage, ledgerSummary, parseRentLedger, parseRentWrite, payableRow, RentLedgerError, rentErrorText, rowChip, rowLine, RULE_LINE, validateRentOperation, type RentLedger, type RentOperation, type RentRow } from '../src/features/tenancy/models/RentLedger';
import { createRentLedgerService } from '../src/features/tenancy/services/rentLedgerService';
import { createRentLedgerWorkflow } from '../src/features/tenancy/viewModels/rentLedgerWorkflow';

const T = '10000000-0000-4000-8000-0000000000aa', L = '10000000-0000-4000-8000-0000000000bb', X = '10000000-0000-4000-8000-0000000000cc';
const TEN = '20000000-0000-4000-8000-000000000001', CONV = '30000000-0000-4000-8000-000000000001';
const R1 = '40000000-0000-4000-8000-000000000001', R2 = '40000000-0000-4000-8000-000000000002';
const NOW = Date.parse('2026-11-16T04:00:00Z');

const rowJson = (over: Record<string, unknown> = {}) => ({ dueDate: '2026-11-02', amount: 10000, storedStatus: null, displayStatus: 'past_due', revision: null, tenantMarkedPaidAt: null, landlordAcknowledgedAt: null, changedAt: null, canMarkPaid: false, canAcknowledge: false, canDispute: false, ...over });
const ledgerJson = (over: Record<string, unknown> = {}) => ({
  tenancyId: TEN, tenantId: T, landlordId: L, status: 'active', today: '2026-11-16', monthlyRent: 10000, dueDay: 2, hasMore: false, awaiting: null,
  rows: [rowJson({ dueDate: '2026-12-02', displayStatus: 'upcoming' }), rowJson({ dueDate: '2026-11-02', displayStatus: 'tenant_marked_paid', storedStatus: 'tenant_marked_paid', revision: R1, tenantMarkedPaidAt: '2026-11-01T02:00:00+00:00', changedAt: '2026-11-01T02:00:00+00:00' }), rowJson({ dueDate: '2026-10-02', displayStatus: 'landlord_acknowledged', storedStatus: 'landlord_acknowledged', revision: R2, tenantMarkedPaidAt: '2026-10-02T02:00:00+00:00', landlordAcknowledgedAt: '2026-10-02T03:00:00+00:00' })],
  ...over,
});
const asLandlord = (over: Record<string, unknown> = {}) => {
  const j = ledgerJson(over) as any;
  j.rows[1].canAcknowledge = true; j.rows[1].canDispute = true; j.awaiting = { dueDate: '2026-11-02', revision: R1 };
  return j;
};

// ---------------------------------------------------------------- model: parsing
test('a valid ledger parses for both parties; the landlord gets the waiting item, the tenant never does', () => {
  const l = parseRentLedger(asLandlord(), L, TEN);
  assert.equal(l.rows.length, 3); assert.deepEqual(l.awaiting, { dueDate: '2026-11-02', revision: R1 }); assert.equal(l.rows[0]!.dueDate, '2026-12-02');
  const t = parseRentLedger(ledgerJson(), T, TEN);
  assert.equal(t.awaiting, null); assert.equal(t.monthlyRent, 10000); assert.equal(t.dueDay, 2);
  assert.equal(parseRentLedger(ledgerJson({ monthlyRent: '10000.00' }), T, TEN).monthlyRent, 10000, 'numeric strings are accepted for money');
});

test('malformed ledger responses are rejected, never half-parsed', () => {
  const rejects = (over: Record<string, unknown>, actor = T, id = TEN) => assert.throws(() => parseRentLedger(ledgerJson(over), actor, id), (e: any) => e instanceof RentLedgerError && !e.uncertain);
  assert.throws(() => parseRentLedger(null, T, TEN), RentLedgerError); assert.throws(() => parseRentLedger([], T, TEN), RentLedgerError); assert.throws(() => parseRentLedger('x', T, TEN), RentLedgerError);
  rejects({}, X);                                       // the caller is not a party
  rejects({}, T, '20000000-0000-4000-8000-000000000009'); // not the tenancy that was asked for
  rejects({ landlordId: T });                           // tenant and landlord must differ
  rejects({ tenantId: 'nope' });
  rejects({ dueDay: 0 }); rejects({ dueDay: 29 }); rejects({ dueDay: 2.5 });
  rejects({ monthlyRent: 0 }); rejects({ monthlyRent: 'abc' });
  rejects({ hasMore: 'no' });
  rejects({ rows: 'x' }); rejects({ rows: Array.from({ length: 13 }, (_, i) => rowJson({ dueDate: `2025-${String(12 - (i % 12)).padStart(2, '0')}-02` })) });
  rejects({ rows: [rowJson({ displayStatus: 'overdue' })] });                  // unknown status
  rejects({ rows: [rowJson({ dueDate: '2026-02-30' })] });                     // not a calendar date
  rejects({ rows: [rowJson({ amount: -1 })] });
  rejects({ rows: [rowJson({ canMarkPaid: 'yes' })] });
  rejects({ rows: [rowJson({ storedStatus: 'disputed', revision: null })] });  // stored row without a revision
  rejects({ rows: [rowJson({ revision: R1 })] });                              // revision without a stored row
  rejects({ rows: [rowJson({ displayStatus: 'tenant_marked_paid', storedStatus: 'tenant_marked_paid', revision: R1 })] }); // paid with no time
  rejects({ rows: [rowJson({ displayStatus: 'landlord_acknowledged', storedStatus: 'landlord_acknowledged', revision: R1 })] });
  rejects({ rows: [rowJson({ dueDate: '2026-11-02' }), rowJson({ dueDate: '2026-12-02' })] }); // must be newest first
  rejects({ rows: [rowJson({ dueDate: '2026-11-02' }), rowJson({ dueDate: '2026-11-02' })] });
  const wrongRevision = asLandlord(); wrongRevision.awaiting = { dueDate: '2026-11-02', revision: R2 };
  assert.throws(() => parseRentLedger(wrongRevision, L, TEN), RentLedgerError, 'awaiting must match a row and its revision');
  const wrongMonth = asLandlord(); wrongMonth.awaiting = { dueDate: '2026-10-02', revision: R2 };
  assert.throws(() => parseRentLedger(wrongMonth, L, TEN), RentLedgerError, 'awaiting must point at a month the tenant marked');
  const t = asLandlord(); assert.throws(() => parseRentLedger(t, T, TEN), RentLedgerError, 'a tenant is never given an awaiting item');
});

test('a write result must match the operation that was sent', () => {
  const op = (action: RentOperation['action']): RentOperation => ({ tenancyId: TEN, operationId: R1, action, dueDate: '2026-11-02', revision: null });
  assert.deepEqual(parseRentWrite({ dueDate: '2026-11-02', status: 'tenant_marked_paid', revision: R2 }, op('mark_paid')), { dueDate: '2026-11-02', status: 'tenant_marked_paid', revision: R2 });
  assert.equal(parseRentWrite({ dueDate: '2026-11-02', status: 'disputed', revision: R2 }, op('dispute')).status, 'disputed');
  for (const bad of [{ dueDate: '2026-11-03', status: 'tenant_marked_paid', revision: R2 }, { dueDate: '2026-11-02', status: 'landlord_acknowledged', revision: R2 }, null, []]) {
    assert.throws(() => parseRentWrite(bad, op('mark_paid')), (e: any) => e instanceof RentLedgerError && e.uncertain === true, 'a mismatch is treated as not confirmed');
  }
  assert.throws(() => parseRentWrite({ dueDate: '2026-11-02', status: 'tenant_marked_paid', revision: 'x' }, op('mark_paid')), (e: any) => e instanceof RentLedgerError && e.uncertain === true);
  assert.throws(() => validateRentOperation({ ...op('mark_paid'), operationId: 'x' }), RentLedgerError);
  assert.throws(() => validateRentOperation({ ...op('mark_paid'), action: 'waive' as any }), RentLedgerError, 'waive is not an action');
  assert.throws(() => validateRentOperation({ ...op('mark_paid'), revision: 'x' }), RentLedgerError);
});

// ---------------------------------------------------------------- model: presentation and the fixed texts
test('chips: blue upcoming, amber due, red past due, Confirm for the landlord, Waiting for the tenant, green Received, amber disputed', () => {
  const chip = (status: RentRow['status'], role: 'tenant' | 'landlord') => rowChip({ status }, role, 'Samuel');
  assert.deepEqual(chip('upcoming', 'tenant'), { label: 'Upcoming', tone: 'info' });
  assert.deepEqual(chip('due', 'tenant'), { label: 'Due', tone: 'warning' });
  assert.deepEqual(chip('past_due', 'landlord'), { label: 'Past due', tone: 'restricted' });
  assert.deepEqual(chip('tenant_marked_paid', 'landlord'), { label: 'Confirm', tone: 'warning' });
  assert.deepEqual(chip('tenant_marked_paid', 'tenant'), { label: 'Waiting for Samuel', tone: 'info' });
  assert.deepEqual(chip('landlord_acknowledged', 'tenant'), { label: 'Received', tone: 'positive' });
  assert.deepEqual(chip('disputed', 'landlord'), { label: 'Checking', tone: 'warning' });
  assert.deepEqual(chip('waived', 'tenant'), { label: 'Waived', tone: 'neutral' });
});

test('row lines are built only from the schedule and the stored timestamps, in Manila dates', () => {
  const l = parseRentLedger(asLandlord(), L, TEN), [dec, nov, oct] = l.rows as [RentRow, RentRow, RentRow];
  assert.equal(rowLine(dec, 'landlord', 'Samuel', NOW), 'in 16 days');
  assert.equal(rowLine(nov, 'landlord', 'Samuel', NOW), 'Samuel marked paid Nov 1');
  assert.equal(rowLine(nov, 'tenant', 'Maria', NOW), 'You marked paid Nov 1');
  assert.equal(rowLine(oct, 'tenant', 'Maria', NOW), 'Received Oct 2');
  const disputed = { ...nov, status: 'disputed' as const, changedAt: '2026-11-05T02:00:00+00:00' };
  assert.equal(rowLine(disputed, 'landlord', 'Samuel', NOW), 'You asked Samuel to check Nov 5');
  assert.equal(rowLine(disputed, 'tenant', 'Maria', NOW), 'Maria asked you to check Nov 5');
  assert.equal(rowLine({ ...dec, dueDate: '2026-11-02', status: 'past_due' }, 'tenant', 'Maria', NOW), '14 days ago');
  // 17:00 UTC on Nov 1 is already Nov 2 in Manila.
  assert.equal(rowLine({ ...nov, tenantMarkedPaidAt: '2026-11-01T17:00:00+00:00' }, 'landlord', 'Samuel', NOW), 'Samuel marked paid Nov 2');
});

test('the wireframe texts: summary line, waiting banner, rule line and the exact chat message', () => {
  assert.equal(ledgerSummary({ monthlyRent: 10000, dueDay: 2 }), '₱10,000 / month · due on the 2nd');
  assert.equal(ledgerSummary({ monthlyRent: 10000, dueDay: 22 }), '₱10,000 / month · due on the 22nd');
  const nov = parseRentLedger(asLandlord(), L, TEN).rows[1]!;
  assert.deepEqual(bannerText(nov, 'Samuel'), { title: 'Samuel says rent for Nov was paid on Nov 1', body: 'Confirm that you received it, or ask Samuel to check.' });
  assert.equal(RULE_LINE, 'This ledger records what each person says. It does not move money. Payments stay between landlord and tenant.');
  assert.equal(disputeMessage('2026-11-02'), "Rent ledger: I can't see the rent for Nov 2 on my side yet. Could you please check it? It may just be a delay. Thank you.");
  assert.doesNotMatch(disputeMessage('2026-11-02'), /₱|10,000|owe|late|unpaid|overdue/i, 'no amounts and no accusation');
});

test('errors in plain words: stale and confirmed reload the ledger, unavailable does not, network says retry', () => {
  const server = (code: string, message = '') => new RentLedgerError(message, code);
  assert.deepEqual(rentErrorText(server('40001', 'Rent record changed. Reload.')), { message: 'This changed while you were looking. Updated.', reload: true });
  assert.deepEqual(rentErrorText(server('22023', 'Already confirmed')), { message: 'Already confirmed.', reload: true });
  assert.deepEqual(rentErrorText(server('22023', 'Transition unavailable')), { message: 'This changed while you were looking. Updated.', reload: true });
  assert.deepEqual(rentErrorText(server('22023', 'Rent date unavailable')), { message: 'This changed while you were looking. Updated.', reload: true });
  assert.deepEqual(rentErrorText(server('42501', 'Access unavailable')), { message: "This isn't available right now.", reload: false });
  assert.equal(rentErrorText(server('PGRST202')).reload, false);
  assert.match(rentErrorText(new RentLedgerError('x', null, true)).message, /retry/i);
  assert.match(rentErrorText(new Error('boom')).message, /retry/i);
});

test("the rent card offers I've paid only to the tenant, on an active rental, for a month that is already due", () => {
  const rows = parseRentLedger(ledgerJson({ rows: [rowJson({ dueDate: '2026-12-02', displayStatus: 'upcoming', canMarkPaid: true }), rowJson({ dueDate: '2026-11-02', displayStatus: 'due', canMarkPaid: true }), rowJson({ dueDate: '2026-10-02', canMarkPaid: true })] }), T, TEN).rows;
  assert.equal(payableRow(rows, 'tenant', 'active')?.dueDate, '2026-11-02', 'the newest month that is already due, not the upcoming one');
  assert.equal(payableRow(rows, 'landlord', 'active'), undefined); assert.equal(payableRow(rows, 'tenant', 'ended'), undefined); assert.equal(payableRow(rows, null, 'active'), undefined);
  assert.equal(payableRow(rows.map(r => ({ ...r, canMarkPaid: false })), 'tenant', 'active'), undefined, 'the flag decides, not the role');
  assert.equal(payableRow(rows.slice(0, 1), 'tenant', 'active'), undefined, 'an upcoming month alone is not offered on the card');
});

// ---------------------------------------------------------------- service
function fakeClient(opts: { user?: string | null; rpc?: (name: string, args: any) => any } = {}) {
  const calls: { name: string; args: any }[] = []; let users = 0;
  const client: any = {
    auth: { getUser: async () => { users++; return { data: { user: opts.user === null ? null : { id: opts.user ?? T } }, error: null }; } },
    rpc: (name: string, args: any) => { calls.push({ name, args }); const r = opts.rpc ? opts.rpc(name, args) : { data: null, error: null }; return { abortSignal: () => (r instanceof Error ? Promise.reject(r) : Promise.resolve(r)) }; },
  };
  return { client: () => client, calls, users: () => users };
}
const sig = () => new AbortController().signal;
const op = (action: RentOperation['action'], revision: string | null = null, operationId = R2): RentOperation => ({ tenancyId: TEN, operationId, action, dueDate: '2026-11-02', revision });

test('service read: calls get_rent_ledger with the tenancy and offset and returns a parsed ledger', async () => {
  const f = fakeClient({ rpc: () => ({ data: ledgerJson(), error: null }) });
  const l = await createRentLedgerService(f.client).read(T, TEN, 12, sig());
  assert.deepEqual(f.calls, [{ name: 'get_rent_ledger', args: { p_tenancy_id: TEN, p_offset: 12 } }]); assert.equal(l.rows.length, 3);
  assert.ok(f.users() >= 2, 'identity is checked around the call');
});

test('service read: refusals and bad data become plain errors', async () => {
  const run = (rpc: any, user: string | null = T) => createRentLedgerService(fakeClient({ user, rpc }).client).read(T, TEN, 0, sig());
  await assert.rejects(run(() => ({ data: null, error: { code: '42501', message: 'Access unavailable' } })), (e: any) => e.code === '42501' && /isn't available/.test(e.message));
  await assert.rejects(run(() => ({ data: null, error: { code: '', message: 'Network request failed' } })), /connection/i);
  await assert.rejects(run(() => new Error('offline')), /connection/i);
  await assert.rejects(run(() => ({ data: { rows: 'x' }, error: null })), /could not be read/);
  await assert.rejects(run(() => ({ data: ledgerJson(), error: null }), X), /account changed/i, 'a different signed-in account is refused');
  await assert.rejects(run(() => ({ data: ledgerJson({ tenancyId: '20000000-0000-4000-8000-000000000009' }), error: null })), /could not be read/);
});

test('service write: sends the revision only when there is one, and returns the parsed result', async () => {
  const f = fakeClient({ rpc: (_n, a) => ({ data: { dueDate: a.p_due_date, status: a.p_action === 'dispute' ? 'disputed' : a.p_action === 'acknowledge' ? 'landlord_acknowledged' : 'tenant_marked_paid', revision: R1 }, error: null }) });
  const s = createRentLedgerService(f.client);
  await s.write(T, op('mark_paid'), sig());
  await s.write(T, op('acknowledge', R1), sig());
  assert.deepEqual(f.calls[0], { name: 'write_rent_ledger', args: { p_tenancy_id: TEN, p_operation_id: R2, p_action: 'mark_paid', p_due_date: '2026-11-02' } });
  assert.equal('p_revision' in f.calls[0]!.args, false, 'a month with no stored row sends no revision (null)');
  assert.deepEqual(f.calls[1]!.args, { p_tenancy_id: TEN, p_operation_id: R2, p_action: 'acknowledge', p_due_date: '2026-11-02', p_revision: R1 });
});

test('service write: server refusals keep their code; anything else is "not confirmed" so the same operation can be retried', async () => {
  const fail = (rpc: any, user: string | null = T) => createRentLedgerService(fakeClient({ user, rpc }).client).write(T, op('mark_paid'), sig());
  for (const code of ['40001', '22023', '42501', 'PGRST202']) await assert.rejects(fail(() => ({ data: null, error: { code, message: 'm' } })), (e: any) => e.code === code && e.uncertain === false, code);
  await assert.rejects(fail(() => ({ data: null, error: { code: '', message: 'Network request failed' } })), (e: any) => e.uncertain === true);
  await assert.rejects(fail(() => ({ data: null, error: { code: '57014', message: 'timeout' } })), (e: any) => e.uncertain === true);
  await assert.rejects(fail(() => new Error('abort')), (e: any) => e.uncertain === true);
  await assert.rejects(fail(() => ({ data: { dueDate: '2026-11-02', status: 'disputed', revision: R1 }, error: null })), (e: any) => e.uncertain === true, 'a result that does not match the action is not trusted');
  const f = fakeClient({ user: X }); await assert.rejects(createRentLedgerService(f.client).write(T, op('mark_paid'), sig()), /account changed/i); assert.equal(f.calls.length, 0, 'a different account never reaches the RPC');
  await assert.rejects(createRentLedgerService(fakeClient().client).write(T, { ...op('mark_paid'), action: 'waive' as any }, sig()), RentLedgerError);
});

// ---------------------------------------------------------------- workflow
type Call = { op: RentOperation } | { read: number };
function flow(opts: { actor?: string; conversationId?: string | null; ledgers?: any[]; writes?: any[]; sends?: any[]; counter?: { n: number } } = {}) {
  const actor = opts.actor ?? L, ledgers = [...(opts.ledgers ?? [])], writes = [...(opts.writes ?? [])], sends = [...(opts.sends ?? [])];
  const calls: Call[] = [], chatCalls: { conversationId: string; messageId: string; body: string }[] = [], counter = opts.counter ?? { n: 0 };
  const id = () => `50000000-0000-4000-8000-${String(++counter.n).padStart(12, '0')}`;
  const service: any = {
    read: async (_a: string, _t: string, offset: number) => { calls.push({ read: offset }); const next = ledgers.length > 1 ? ledgers.shift() : ledgers[0]; if (next instanceof Error) throw next; return parseRentLedger(next, actor, TEN); },
    write: async (_a: string, o: RentOperation) => { calls.push({ op: o }); const next = writes.shift(); if (next instanceof Error) throw next; return next ?? { dueDate: o.dueDate, status: o.action === 'dispute' ? 'disputed' : o.action === 'acknowledge' ? 'landlord_acknowledged' : 'tenant_marked_paid', revision: R2 }; },
  };
  const chat = { send: async (conversationId: string, messageId: string, body: string) => { chatCalls.push({ conversationId, messageId, body }); const next = sends.shift(); if (next instanceof Error) throw next; } };
  const wf = createRentLedgerWorkflow(service, chat, { actor, tenancyId: TEN, conversationId: opts.conversationId === undefined ? CONV : opts.conversationId, counterpart: 'Samuel' }, id);
  return { wf, calls, chatCalls, writes: () => calls.filter((c): c is { op: RentOperation } => 'op' in c).map(c => c.op), state: () => wf.getSnapshot() };
}
const tenantLedger = () => ledgerJson({ rows: [rowJson({ dueDate: '2026-12-02', displayStatus: 'upcoming' }), rowJson({ dueDate: '2026-11-02', displayStatus: 'past_due', canMarkPaid: true })] });
const server = (code: string, message = '') => new RentLedgerError(message, code);
const uncertain = () => new RentLedgerError('Outcome not confirmed. Retry the same action.', null, true);

test("workflow: I've paid writes once with a fresh operation id, reloads, and a later tap gets a new id", async () => {
  const f = flow({ actor: T, ledgers: [tenantLedger()] });
  await f.wf.load();
  assert.equal(await f.wf.act('mark_paid', '2026-11-02'), true);
  assert.equal(f.writes().length, 1); assert.deepEqual([f.writes()[0]!.action, f.writes()[0]!.dueDate, f.writes()[0]!.revision], ['mark_paid', '2026-11-02', null]);
  assert.equal(f.state().notice, 'Marked as paid. Waiting for Samuel to confirm.'); assert.equal(f.state().pending, null);
  assert.deepEqual(f.calls.filter(c => 'read' in c).length, 2, 'the ledger is read again after the write');
  await f.wf.act('mark_paid', '2026-11-02');
  assert.notEqual(f.writes()[0]!.operationId, f.writes()[1]!.operationId, 'a new tap after success is a new intent');
});

test('workflow: what a button may do comes from the row flags, not the role', async () => {
  const f = flow({ actor: L, ledgers: [asLandlord()] });
  await f.wf.load();
  assert.equal(await f.wf.act('mark_paid', '2026-11-02'), false, 'canMarkPaid is false: nothing is sent');
  assert.equal(await f.wf.act('acknowledge', '2026-12-02'), false, 'the horizon row has canAcknowledge false in this fixture');
  assert.equal(await f.wf.act('acknowledge', '2026-01-01'), false, 'unknown month');
  f.wf.openDispute('2026-12-02'); assert.equal(f.state().dispute, null, 'canDispute false: the sheet does not open');
  assert.equal(f.writes().length, 0);
  assert.equal(await f.wf.act('acknowledge', '2026-11-02'), true); assert.equal(f.writes()[0]!.revision, R1, 'the row revision is passed');
});

test('workflow: no double submit while a write is in flight', async () => {
  const gate: { release?: () => void } = {};
  const f = flow({ actor: T, ledgers: [tenantLedger()] });
  const slow = (f.wf as any);
  await slow.load();
  // Replace the service write with one that waits, through a fresh flow sharing the same pieces.
  const g = (() => { const base = flow({ actor: T, ledgers: [tenantLedger()] }); return base; })();
  await g.wf.load();
  const first = g.wf.act('mark_paid', '2026-11-02'); const second = g.wf.act('mark_paid', '2026-11-02');
  assert.equal(await second, false, 'the second tap while saving is ignored'); await first;
  assert.equal(g.writes().length, 1); void gate;
});

test('workflow: an unknown outcome keeps the same operation id for Retry; the retry sends it unchanged and never runs by itself', async () => {
  const f = flow({ actor: T, ledgers: [tenantLedger()], writes: [uncertain()] });
  await f.wf.load();
  assert.equal(await f.wf.act('mark_paid', '2026-11-02'), false);
  assert.ok(f.state().pending); assert.match(f.state().error!, /retry/i); assert.equal(f.writes().length, 1, 'nothing retried by itself');
  const firstId = f.writes()[0]!.operationId;
  assert.equal(await f.wf.act('acknowledge', '2026-11-02'), false, 'a different action is refused while one is unresolved');
  assert.equal(await f.wf.retry(), true);
  assert.equal(f.writes().length, 2); assert.equal(f.writes()[1]!.operationId, firstId, 'the same operation id is reused'); assert.deepEqual(f.writes()[1], f.writes()[0]);
  assert.equal(f.state().pending, null);
  await f.wf.act('mark_paid', '2026-11-02'); assert.notEqual(f.writes()[2]!.operationId, firstId, 'new intent, new id');
});

test('workflow: stale and confirmed answers reload the ledger and say so; unavailable does not reload', async () => {
  const stale = flow({ actor: T, ledgers: [tenantLedger()], writes: [server('40001', 'Rent record changed. Reload.')] });
  await stale.wf.load(); await stale.wf.act('mark_paid', '2026-11-02');
  assert.equal(stale.state().notice, 'This changed while you were looking. Updated.'); assert.equal(stale.state().pending, null); assert.equal(stale.state().error, null);
  assert.equal(stale.calls.filter(c => 'read' in c).length, 2, 'reloaded');
  const done = flow({ actor: L, ledgers: [asLandlord()], writes: [server('22023', 'Already confirmed')] });
  await done.wf.load(); await done.wf.act('acknowledge', '2026-11-02');
  assert.equal(done.state().notice, 'Already confirmed.'); assert.equal(done.calls.filter(c => 'read' in c).length, 2);
  const denied = flow({ actor: T, ledgers: [tenantLedger()], writes: [server('42501', 'Access unavailable')] });
  await denied.wf.load(); await denied.wf.act('mark_paid', '2026-11-02');
  assert.equal(denied.state().error, "This isn't available right now."); assert.equal(denied.state().pending, null); assert.equal(denied.calls.filter(c => 'read' in c).length, 1, 'no reload');
});

test('workflow: a failed load shows one plain line, and Show older appends the next page by offset', async () => {
  const f = flow({ actor: T, ledgers: [new RentLedgerError('The rent ledger could not load. Check your connection and retry.')] });
  await f.wf.load(); assert.match(f.state().error!, /connection/i); assert.equal(f.state().ready, false);
  const page1 = ledgerJson({ hasMore: true }), page2 = ledgerJson({ hasMore: false, awaiting: null, rows: [rowJson({ dueDate: '2026-09-02' }), rowJson({ dueDate: '2026-08-02' })] });
  const g = flow({ actor: T, ledgers: [page1, page2] });
  await g.wf.load(); assert.equal(g.state().ledger!.hasMore, true);
  await g.wf.older(); assert.deepEqual(g.calls.filter(c => 'read' in c), [{ read: 0 }, { read: 12 }]);
  assert.deepEqual(g.state().rows.map(r => r.dueDate), ['2026-12-02', '2026-11-02', '2026-10-02', '2026-09-02', '2026-08-02']); assert.equal(g.state().ledger!.hasMore, false);
  await g.wf.older(); assert.equal(g.calls.filter(c => 'read' in c).length, 2, 'no more pages, no more reads');
});

// ---- dispute then send
test('dispute: records first, then sends the exact text into the tenancy conversation with one message id', async () => {
  const f = flow({ ledgers: [asLandlord()] });
  await f.wf.load(); f.wf.openDispute('2026-11-02'); assert.deepEqual(f.state().dispute, { dueDate: '2026-11-02' });
  const order: string[] = [];
  const orig = f.calls; void orig;
  assert.equal(await f.wf.confirmDispute(), true);
  const kinds = f.calls.map(c => ('op' in c ? `write:${c.op.action}` : `read:${c.read}`));
  assert.deepEqual(kinds, ['read:0', 'write:dispute', 'read:0'], 'the dispute is written before anything else happens'); void order;
  assert.deepEqual(f.chatCalls, [{ conversationId: CONV, messageId: f.chatCalls[0]!.messageId, body: "Rent ledger: I can't see the rent for Nov 2 on my side yet. Could you please check it? It may just be a delay. Thank you." }]);
  assert.equal(f.state().dispute, null); assert.equal(f.state().chat, null); assert.equal(f.state().notice, 'Marked not received. Message sent.');
  assert.equal(f.writes()[0]!.revision, R1);
});

test('dispute: if the chat send fails the dispute stands, one amber line offers Retry, and Retry resends only the message with the same id', async () => {
  const f = flow({ ledgers: [asLandlord()], sends: [new Error('network')] });
  await f.wf.load(); f.wf.openDispute('2026-11-02'); await f.wf.confirmDispute();
  assert.equal(f.writes().length, 1); assert.ok(f.state().chat && f.state().chat!.error, 'the failure is shown'); assert.equal(f.state().chat!.error, "The message to Samuel wasn't sent.");
  assert.equal(f.state().pending, null, 'the dispute is recorded and nothing about it is pending'); assert.equal(f.state().notice, 'Marked not received.'); assert.equal(f.state().dispute, null);
  assert.equal(f.chatCalls.length, 1, 'nothing retried by itself');
  const firstId = f.chatCalls[0]!.messageId;
  await f.wf.retryChat();
  assert.equal(f.chatCalls.length, 2); assert.equal(f.chatCalls[1]!.messageId, firstId, 'the message id is stable across retries'); assert.equal(f.chatCalls[1]!.body, f.chatCalls[0]!.body);
  assert.equal(f.writes().length, 1, 'Retry never writes the dispute again'); assert.equal(f.state().chat, null); assert.equal(f.state().notice, 'Message sent.');
  await f.wf.retryChat(); assert.equal(f.chatCalls.length, 2, 'nothing left to retry');
});

test('dispute: a second chat failure keeps the same Retry; the id never changes', async () => {
  const f = flow({ ledgers: [asLandlord()], sends: [new Error('a'), new Error('b')] });
  await f.wf.load(); f.wf.openDispute('2026-11-02'); await f.wf.confirmDispute(); await f.wf.retryChat();
  assert.ok(f.state().chat!.error); assert.equal(f.chatCalls.length, 2); assert.equal(f.chatCalls[0]!.messageId, f.chatCalls[1]!.messageId);
  await f.wf.retryChat(); assert.equal(f.chatCalls.length, 3); assert.equal(f.state().chat, null);
});

test('dispute: with no conversation the dispute still stands, no message is sent and the notice says so', async () => {
  const f = flow({ ledgers: [asLandlord()], conversationId: null });
  await f.wf.load(); f.wf.openDispute('2026-11-02'); assert.equal(await f.wf.confirmDispute(), true);
  assert.equal(f.writes().length, 1); assert.equal(f.chatCalls.length, 0); assert.equal(f.state().chat, null);
  assert.match(f.state().notice!, /No chat conversation was found, so no message was sent/);
  await f.wf.retryChat(); assert.equal(f.chatCalls.length, 0);
});

test('dispute: an unknown outcome keeps the sheet and Retry; the retry reuses the operation id and the message id, and sends once', async () => {
  const f = flow({ ledgers: [asLandlord()], writes: [uncertain()] });
  await f.wf.load(); f.wf.openDispute('2026-11-02');
  assert.equal(await f.wf.confirmDispute(), false);
  assert.deepEqual(f.state().dispute, { dueDate: '2026-11-02' }, 'the sheet stays open'); assert.ok(f.state().pending); assert.equal(f.chatCalls.length, 0, 'no message until the dispute is confirmed');
  assert.equal(await f.wf.retry(), true);
  assert.equal(f.writes().length, 2); assert.equal(f.writes()[1]!.operationId, f.writes()[0]!.operationId); assert.equal(f.writes()[1]!.revision, R1);
  assert.equal(f.chatCalls.length, 1); assert.equal(f.state().dispute, null); assert.equal(f.state().pending, null);
});

test('dispute: a refusal closes nothing silently - stale reloads and the sheet can be cancelled; cancelling never writes', async () => {
  const stale = flow({ ledgers: [asLandlord()], writes: [server('40001', 'Rent record changed. Reload.')] });
  await stale.wf.load(); stale.wf.openDispute('2026-11-02'); await stale.wf.confirmDispute();
  assert.equal(stale.chatCalls.length, 0, 'no message when the dispute was refused'); assert.equal(stale.state().notice, 'This changed while you were looking. Updated.'); assert.equal(stale.state().pending, null);
  const cancel = flow({ ledgers: [asLandlord()] });
  await cancel.wf.load(); cancel.wf.openDispute('2026-11-02'); cancel.wf.closeDispute();
  assert.equal(cancel.state().dispute, null); assert.equal(cancel.writes().length, 0); assert.equal(cancel.chatCalls.length, 0);
  const wrongRole = flow({ actor: T, ledgers: [tenantLedger()] });
  await wrongRole.wf.load(); wrongRole.wf.openDispute('2026-11-02'); assert.equal(wrongRole.state().dispute, null, 'a tenant has no Not received');
});

// ---------------------------------------------------------------- rendering (real .tsx, function components expanded)
function harness() {
  const states: any[] = []; let cursor = 0; const cache = new Map<string, any>();
  const useState = (initial: any) => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], (v: any) => { states[index] = typeof v === 'function' ? v(states[index]) : v; }]; };
  const native: any = { StyleSheet: { create: (s: any) => s }, useWindowDimensions: () => ({ width: 411, height: 900, fontScale: 1 }), Platform: { OS: 'android' } };
  for (const name of ['Image', 'Modal', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View', 'ActivityIndicator']) native[name] = name;
  const load = (absolute: string): any => {
    if (cache.has(absolute)) return cache.get(absolute);
    const actual = createRequire(absolute), mod = { exports: {} as any }; cache.set(absolute, mod.exports);
    const req = (name: string): any => {
      if (name === 'react') return { useState, useEffect: () => {} };
      if (name === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx, Fragment: 'Fragment' }; }
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (name.startsWith('.')) { const target = resolve(dirname(absolute), name); if (existsSync(target + '.tsx')) return load(target + '.tsx'); }
      return actual(name);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
    cache.set(absolute, mod.exports); return mod.exports;
  };
  const expand = (node: any): any => {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  return { render: (path: string, name: string, props: any, viewport?: any) => { cursor = 0; if (viewport) native.useWindowDimensions = () => viewport; return expand(load(resolve(path))[name](props)); } };
}
const flat = (node: any): any[] => Array.isArray(node) ? node.flatMap(flat) : node && typeof node === 'object' ? [node, ...flat(node.props?.children)] : typeof node === 'string' ? [node] : [];
const text = (tree: any) => flat(tree).filter(n => typeof n === 'string').join(' ');
const nodes = (tree: any) => flat(tree).filter(n => typeof n === 'object');
const byText = (label: string) => (n: any) => typeof n.props?.onPress === 'function' && flat(n.props.children).includes(label);
const labelled = (label: string) => (n: any) => n.props?.accessibilityLabel === label;
const PANEL = 'src/features/tenancy/views/RentLedgerPanel.tsx';

function panel(actor: string, ledgerJ: any, over: Record<string, unknown> = {}, viewport?: any) {
  const calls: string[] = [], ledger = parseRentLedger(ledgerJ, actor, TEN);
  const workflow = { act: async (a: string, d: string) => { calls.push(`act:${a}:${d}`); return true; }, openDispute: (d: string) => calls.push(`open:${d}`), closeDispute: () => calls.push('close'), confirmDispute: async () => { calls.push('confirm'); return true; }, retry: async () => { calls.push('retry'); return true; }, retryChat: async () => { calls.push('retryChat'); }, older: async () => { calls.push('older'); return true; }, load: async () => { calls.push('load'); return true; } };
  const rent: any = { ledger, rows: ledger.rows, offset: 0, busy: false, saving: false, ready: true, error: null, notice: null, pending: null, dispute: null, chat: null, workflow, ...over };
  return { calls, render: () => harness().render(PANEL, 'RentLedgerPanel', { accountId: actor, counterpart: 'Samuel', hasConversation: true, rent }, viewport) };
}
const press = (tree: any, p: (n: any) => boolean) => { const n = nodes(tree).find(p); assert.ok(n, 'target element not found'); n.props.onPress(); };

test('landlord screen: summary, months newest first with chips and lines, the waiting banner with both buttons, and the rule line', () => {
  const p = panel(L, asLandlord()), tree = p.render(), t = text(tree);
  assert.match(t, /Rent ledger/); assert.match(t, /₱10,000 \/ month · due on the 2nd/);
  assert.ok(t.indexOf('Due Dec 2') < t.indexOf('Due Nov 2') && t.indexOf('Due Nov 2') < t.indexOf('Due Oct 2'), 'horizon month on top, newest first');
  assert.match(t, /Samuel marked paid Nov 1/); assert.match(t, /Received Oct 2/); assert.match(t, /Upcoming/); assert.match(t, /Confirm/); assert.match(t, /Received/);
  assert.match(t, /Samuel says rent for Nov was paid on Nov 1/); assert.match(t, /Confirm that you received it, or ask Samuel to check\./);
  assert.match(t, /This ledger records what each person says\. It does not move money\. Payments stay between landlord and tenant\./);
  assert.ok(!nodes(tree).some(byText("I've paid")), 'a landlord never sees I\'ve paid');
  press(tree, byText('Mark received')); press(tree, byText('Not received'));
  assert.deepEqual(p.calls, ['act:acknowledge:2026-11-02', 'open:2026-11-02']);
});

test('tenant screen: I\'ve paid on a due month, Waiting chip after, no banner, no landlord buttons', () => {
  const j = ledgerJson({ rows: [rowJson({ dueDate: '2026-12-02', displayStatus: 'upcoming' }), rowJson({ dueDate: '2026-11-02', displayStatus: 'past_due', canMarkPaid: true }), rowJson({ dueDate: '2026-10-02', displayStatus: 'tenant_marked_paid', storedStatus: 'tenant_marked_paid', revision: R1, tenantMarkedPaidAt: '2026-10-01T02:00:00+00:00' })] });
  const p = panel(T, j), tree = p.render(), t = text(tree);
  assert.match(t, /Past due/); assert.match(t, /Waiting for Samuel/); assert.match(t, /You marked paid Oct 1/);
  assert.ok(!/says rent for/.test(t), 'no landlord banner'); assert.ok(!nodes(tree).some(byText('Not received')) && !nodes(tree).some(byText('Mark received')));
  press(tree, labelled("I've paid for Nov")); assert.deepEqual(p.calls, ['act:mark_paid:2026-11-02']);
  assert.equal(nodes(tree).filter(byText("I've paid")).length, 1, 'only the month whose flag is true');
});

test('landlord rows add Mark received only where there is no tenant statement to answer (cash and checked months)', () => {
  const j = asLandlord(); j.rows[0].canAcknowledge = true; j.rows[2].displayStatus = 'disputed'; j.rows[2].storedStatus = 'disputed'; j.rows[2].canAcknowledge = true; j.rows[2].landlordAcknowledgedAt = null; j.rows[2].changedAt = '2026-10-05T02:00:00+00:00';
  const tree = panel(L, j).render();
  assert.ok(nodes(tree).some(labelled('Mark received for Dec')), 'a cash month'); assert.ok(nodes(tree).some(labelled('Mark received for Oct')), 'a checked month');
  assert.ok(!nodes(tree).some(labelled('Mark received for Nov')), 'the waiting month uses the banner, not a second button');
  assert.match(text(tree), /You asked Samuel to check Oct 5/);
});

test('buttons are disabled while a write is in flight, and Show older appears only when there is more', () => {
  const busy = panel(L, asLandlord(), { saving: true }).render();
  assert.ok(nodes(busy).filter(n => n.type === 'Pressable' && n.props.accessibilityRole === 'button').every(n => n.props.disabled === true || n.props.accessibilityState?.disabled === true), 'every button is disabled');
  assert.ok(!nodes(panel(L, asLandlord()).render()).some(byText('Show older')));
  const more = panel(L, asLandlord({ hasMore: true })); const tree = more.render(); press(tree, byText('Show older')); assert.deepEqual(more.calls, ['older']);
});

test('errors, retry lines and the chat retry line are amber with a 48dp Retry; nothing retries on its own', () => {
  const pend = panel(T, tenantLedger(), { error: "We couldn't confirm that. Check your connection and retry.", pending: { operationId: R1 } }), tree = pend.render();
  assert.match(text(tree), /couldn't confirm that/); press(tree, labelled('Retry')); assert.deepEqual(pend.calls, ['retry']);
  assert.deepEqual(nodes(tree).filter(n => n.props?.accessibilityLabel === 'Retry').map(n => n.props.style.minHeight), [48]);
  const chat = panel(L, asLandlord(), { chat: { dueDate: '2026-11-02', messageId: R1, text: 'x', error: "The message to Samuel wasn't sent.", sending: false } }), t2 = chat.render();
  assert.match(text(t2), /The message to Samuel wasn't sent\./); press(t2, labelled('Retry sending the message')); assert.deepEqual(chat.calls, ['retryChat']);
  assert.ok(!text(panel(L, asLandlord(), { notice: 'Marked as received.' }).render()).includes("wasn't sent"));
  assert.match(text(panel(L, asLandlord(), { notice: 'Marked not received. Message sent.' }).render()), /Marked not received\. Message sent\./);
});

test('the Not received sheet shows the exact message before sending, and the right buttons; with no conversation it says so', () => {
  const open = panel(L, asLandlord(), { dispute: { dueDate: '2026-11-02' } }), tree = open.render(), t = text(tree);
  assert.match(t, /Rent for Nov 2 not received\?/);
  assert.ok(t.includes("Rent ledger: I can't see the rent for Nov 2 on my side yet. Could you please check it? It may just be a delay. Thank you."));
  press(tree, byText('Send and mark not received')); press(tree, byText('Cancel')); assert.deepEqual(open.calls, ['confirm', 'close']);
  const none = harness().render(PANEL, 'RentLedgerPanel', { accountId: L, counterpart: 'Samuel', hasConversation: false, rent: { ...(open as any), ledger: parseRentLedger(asLandlord(), L, TEN), rows: parseRentLedger(asLandlord(), L, TEN).rows, ready: true, busy: false, saving: false, error: null, notice: null, pending: null, chat: null, dispute: { dueDate: '2026-11-02' }, workflow: { act() {}, openDispute() {}, closeDispute() {}, confirmDispute() {}, retry() {}, retryChat() {}, older() {}, load() {} } } });
  assert.match(text(none), /No chat conversation was found for this rental/); assert.ok(!text(none).includes("Rent ledger: I can't see"), 'no message text when none will be sent');
});

test('the sheet shows its own error with Retry only while there is something to retry, and the buttons lock while saving', () => {
  const err = panel(L, asLandlord(), { dispute: { dueDate: '2026-11-02' }, error: "We couldn't confirm that. Check your connection and retry.", pending: { operationId: R1 } }), tree = err.render();
  press(tree, labelled('Retry')); assert.deepEqual(err.calls, ['retry']);
  const refused = panel(L, asLandlord(), { dispute: { dueDate: '2026-11-02' }, error: "This isn't available right now.", pending: null }).render();
  assert.ok(!nodes(refused).some(labelled('Retry')), 'nothing to retry after a refusal');
  const saving = panel(L, asLandlord(), { dispute: { dueDate: '2026-11-02' }, saving: true }).render();
  assert.ok(nodes(saving).filter(n => byText('Saving…')(n) || byText('Cancel')(n)).every(n => n.props.disabled === true));
});

test('large text: the chip moves under the month text instead of squeezing it', () => {
  const chipBeside = (viewport: any) => { const tree = panel(L, asLandlord(), {}, viewport).render(); const row = nodes(tree).find(n => n.type === 'View' && n.props.style?.flexDirection === 'row' && n.props.style?.alignItems === 'center' && flat(n.props.children).includes('Due Dec 2'))!; return [row.props.children].flat(Infinity).some((c: any) => c?.props?.accessibilityLabel?.startsWith('Status:')); };
  assert.equal(chipBeside({ width: 411, height: 900, fontScale: 1 }), true); assert.equal(chipBeside({ width: 411, height: 900, fontScale: 1.5 }), false); assert.equal(chipBeside({ width: 320, height: 640, fontScale: 1 }), false);
});

// ---------------------------------------------------------------- source rules
test('rent ledger files use theme tokens and shared parts, no raw queries in the ViewModel, no hardcoded colors, and the View imports no other feature', () => {
  const files = ['src/features/tenancy/models/RentLedger.ts', 'src/features/tenancy/services/rentLedgerService.ts', 'src/features/tenancy/viewModels/rentLedgerWorkflow.ts', 'src/features/tenancy/viewModels/useRentLedgerViewModel.ts', 'src/features/tenancy/views/RentLedgerPanel.tsx', 'src/features/tenancy/components/DisputeSheet.tsx'];
  for (const file of files) assert.doesNotMatch(readFileSync(file, 'utf8'), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, file);
  for (const file of files.filter(f => /viewModels|views|components/.test(f))) assert.doesNotMatch(readFileSync(file, 'utf8'), /\.from\(|\.rpc\(|getSupabaseClient\(\)\.|features\/(messaging|property)/, file);
  assert.doesNotMatch(readFileSync('src/features/tenancy/models/RentLedger.ts', 'utf8'), /messaging-viewing\/(views|viewModels)/);
});
