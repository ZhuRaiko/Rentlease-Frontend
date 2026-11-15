/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { AdminOperationError } from '../src/shared/models/AdminOperationError';
import { createAdminActionsService } from '../src/features/admin-moderation/services/adminActionsService';

const U = '11111111-1111-4111-8111-111111111111', R = '44444444-4444-4444-8444-444444444444', L = '33333333-3333-4333-8333-333333333333';
function client(reply: (name: string, args: unknown) => { data?: unknown; error?: unknown }) {
  const calls: { name: string; args: unknown }[] = [];
  const fake = { rpc: async (name: string, args?: unknown) => { calls.push({ name, args }); const r = reply(name, args); return { data: r.data ?? null, error: r.error ?? null }; } };
  return { service: createAdminActionsService(() => fake as unknown as SupabaseClient<Database>), calls };
}
const input = { operationId: R, action: 'remove_listing' as const, targetUserId: null, targetListingId: L, reportId: R, reason: 'Removed after review', endsAt: null };
const rejects = async (p: Promise<unknown>) => { try { await p; } catch (e) { assert.ok(e instanceof AdminOperationError, String(e)); return e as AdminOperationError; } throw new Error('expected rejection'); };

test('the three RPCs are called with the exact argument names the SQL declares', async () => {
  const { service, calls } = client((name) => name === 'get_admin_restrictions' ? { data: { count: 0, rows: [] } } : name === 'get_admin_audit_log' ? { data: { count: 0, rows: [] } }
    : { data: { id: U, action: 'remove_listing', status: 'removed', targetUserId: null, targetListingId: L, reportId: R, endsAt: null } });
  await service.fetchRestrictions(); await service.fetchAuditLog('reports', 25); await service.applyAction(input);
  assert.deepEqual(calls, [
    { name: 'get_admin_restrictions', args: undefined },
    { name: 'get_admin_audit_log', args: { p_kind: 'reports', p_offset: 25 } },
    { name: 'apply_admin_moderation_action', args: { p_operation_id: R, p_action: 'remove_listing', p_target_user_id: null, p_target_listing_id: L, p_report_id: R, p_reason: 'Removed after review', p_ends_at: null } },
  ]);
});

test('backend refusals become typed plain-language errors, never raw SQL', async () => {
  const { service } = client(() => ({ error: { code: '22023', message: 'Listing cannot be removed while a tenancy is open' } }));
  const e = await rejects(service.applyAction({ ...input, action: 'remove_listing' }));
  assert.equal(e.code, 'action_listing_tenancy_open'); assert.match(e.title, /Tenancy is open/); assert.doesNotMatch(e.message, /22023|SQL|exception/i);
  const denied = await rejects(client(() => ({ error: { code: '42501', message: 'Access unavailable' } })).service.fetchRestrictions());
  assert.equal(denied.code, 'access_unavailable');
  const missing = await rejects(client(() => ({ error: { code: 'PGRST202', message: 'Could not find the function public.get_admin_audit_log' } })).service.fetchAuditLog('all', 0));
  assert.equal(missing.code, 'backend_update_required'); assert.match(missing.message, /update/i);
});

test('network and unknown failures on a decision tell the Admin to check before retrying', async () => {
  const offline = await rejects(client(() => ({ error: new TypeError('Network request failed') })).service.applyAction(input));
  assert.equal(offline.code, 'network'); assert.match(offline.message, /Reload to see whether your decision was saved/);
  const odd = await rejects(client(() => ({ error: { code: 'XX000', message: 'internal' } })).service.applyAction(input));
  assert.equal(odd.code, 'unknown'); assert.match(odd.message, /AD-XX000/);
});

test('a malformed or mismatched response is an error, not a success', async () => {
  const bad = await rejects(client(() => ({ data: { count: 'many', rows: [] } })).service.fetchRestrictions());
  assert.match(bad.message, /couldn't be completed|could not/i);
  await rejects(client(() => ({ data: { rows: [{}], count: 1 } })).service.fetchAuditLog('all', 0));
  const wrong = await rejects(client(() => ({ data: { id: U, action: 'suspend_account', status: 'suspended', targetUserId: U, targetListingId: null, reportId: null, endsAt: null } })).service.applyAction(input));
  assert.equal(wrong.code, 'unknown'); assert.match(wrong.message, /Reload to see whether your decision was saved/, 'an unreadable result after a decision must not invite a blind retry');
});

test('no demo, mock or sample-data path exists in the Admin actions sources', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['services/adminActionsService.ts', 'viewModels/adminActionsWorkflow.ts', 'viewModels/useAdminModerationViewModel.ts', 'views/AdminActionsView.tsx', 'views/AdminAuditView.tsx', 'views/RestrictionDetailView.tsx', 'views/AdminDashboardView.tsx', 'components/AdminActionSheet.tsx']) {
    assert.doesNotMatch(readFileSync('src/features/admin-moderation/' + file, 'utf8'), /DEMO|demoOpen|TEMPORARY|sample data|setTimeout\(/i, file);
  }
  assert.match(readFileSync('src/features/admin-moderation/services/adminActionsService.ts', 'utf8'), /rpc\('apply_admin_moderation_action'/, 'the service really calls the backend');
});

test('the action sheet never discards a typed reason silently (backdrop, Back and Cancel all confirm)', async () => {
  const { readFileSync } = await import('node:fs');
  const sheet = readFileSync('src/features/admin-moderation/components/AdminActionSheet.tsx', 'utf8');
  assert.match(sheet, /Alert\.alert\('Discard this reason\?'/);
  assert.match(sheet, /onClose=\{requestClose\}/);
  assert.match(sheet, /label="Cancel" onPress=\{requestClose\}/);
  assert.match(sheet, /if \(busy\) return;/, 'nothing can dismiss the sheet while a decision is being saved');
});
