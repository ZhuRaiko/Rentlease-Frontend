/// <reference types="node" />
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifyAdminError } from '../src/shared/models/AdminOperationError';
import { ADMIN_REASON_MAX, ADMIN_REASON_MIN, AUDIT_PAGE_SIZE, auditFilters, type AdminActionKind } from '../src/features/admin-moderation/models/AdminActions';

// Drift guard: the SQL of migration 20261113180000 and the frontend must keep agreeing. If the SQL text changes, these fail and force a review.
const sqlFile = 'supabase/migrations/20261113180000_admin_actions_audit.sql';
const sql = readFileSync(sqlFile, 'utf8').replace(/\r\n/g, '\n');
const bodies = [...sql.matchAll(/create function public\.(apply_admin_moderation_action|get_admin_restrictions|get_admin_audit_log)[\s\S]*?\$fn\$;/g)];
const raises = (text: string) => [...text.matchAll(/raise exception '((?:[^']|'')*)'/g)].map((m) => m[1]!.replace(/''/g, "'"));
// The NEW definitions (migration 20261114120000, prepared, not applied). That migration patches the live functions in place, so the full effective source
// is the harness snapshot; the harness asserts the snapshot equals the patched functions and the migration header pins their md5.
const patchFile = 'supabase/migrations/20261114120000_admin_reinstate_relist_guard.sql';
const patchSql = readFileSync(patchFile, 'utf8').replace(/\r\n/g, '\n');
const effective = (JSON.parse(readFileSync('supabase/test-support/admin_reinstate_relist_guard_effective.json', 'utf8')) as { functions: Record<string, { md5: string; source: string }> }).functions;
const auditBody = effective['get_admin_audit_log']!.source;
const actionBody = effective['apply_admin_moderation_action']!.source;
const runtimeMessages = [...new Set(bodies.flatMap((m) => raises(m[0])))];

// The codes added for this migration. 'Access unavailable' is the pre-existing access_unavailable rule.
const NEW_CODES = ['action_not_supported', 'action_reason_length', 'action_target_shape', 'action_end_date_past', 'action_end_date_not_suspension', 'action_self_target', 'action_admin_target',
  'action_target_unavailable', 'action_account_not_active', 'action_account_not_restricted', 'action_listing_not_removable', 'action_listing_tenancy_open',
  'action_report_required', 'action_report_unavailable', 'action_report_not_upheld', 'action_report_target_mismatch', 'action_conflicting_retry', 'action_not_applied', 'audit_unavailable', 'audit_filter_invalid', 'transaction_mode'];

test('the effective get_admin_audit_log is the one the migration header pins (md5 of the snapshot)', () => {
  for (const fn of ['save_listing_draft', 'publish_listing', 'apply_admin_moderation_action', 'get_admin_audit_log']) {
    const pinned = patchSql.match(new RegExp(`--\\s+${fn}\\s+[0-9a-f]{32}\\s+->\\s+([0-9a-f]{32})`))![1];
    assert.equal(createHash('md5').update(effective[fn]!.source).digest('hex'), pinned, `${fn}: snapshot md5 equals the pin in the migration header`);
  }
});

test('the audit log (new definition) hides rows of reports the calling Admin is conflicted on, inside the filter that feeds count and page', () => {
  const body = auditBody;
  const f = body.slice(body.indexOf('with f as('), body.indexOf('page as('));
  assert.match(f, /and not \(l\.entity_type='report' and rentlease_reporting\.conflicted\(l\.entity_id,a\)\)/);
  assert.match(f, /and not \(nullif\(l\.metadata->>'report_id',''\) is not null and rentlease_reporting\.conflicted\(\(l\.metadata->>'report_id'\)::uuid,a\)\)/);
  assert.ok(body.indexOf("'count',(select count(*) from f)") > body.indexOf('with f as('), 'count is taken from the same filtered set');
  assert.match(body, /'actorId',g\.admin_id/, 'actorId is returned');
  assert.match(body, /when 'verification_submission' then coalesce\(case when vp\.public_nickname_confirmed_at is not null then nullif\(btrim\(vp\.public_nickname\),''\) end,'User '\|\|left\(vs\.user_id::text,8\)\)/, 'applicant name: public nickname only');
  assert.match(body, /when 'report' then case when sr\.reported_listing_id is not null then coalesce\(nullif\(btrim\(rl\.title\),''\),/, 'report subject: listing title');
  assert.doesNotMatch(body, /display_name|submitted_note|review_note|rejection_reason|document/, 'no private name, note or document field is read');
  assert.match(body, /'remove_listing','reinstate_listing','restrict_account','warning'\) end/, 'the Actions filter includes reinstate_listing');
  assert.match(f, /and not \(l\.action='reinstate_listing' and l\.entity_type='listing' and exists\(select 1 from public\.listings rl0 join public\.reports rx on \(rx\.reported_listing_id=rl0\.id or rx\.reported_user_id=rl0\.landlord_id\) where rl0\.id=l\.entity_id and rentlease_reporting\.conflicted\(rx\.id,a\)\)\)/, 'reinstate rows are hidden from an Admin conflicted on a report about the listing or its owner, inside f');
});

test('the new apply_admin_moderation_action accepts reinstate_listing; the app does not offer it yet and has no rule for the four new messages', () => {
  const sqlActions = [...actionBody.match(/p_action not in\(([^)]*)\)/)![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  const tsActions: AdminActionKind[] = ['suspend_account', 'restore_account', 'remove_listing'];
  assert.deepEqual(sqlActions, [...tsActions, 'reinstate_listing'].sort(), 'when the app wires Reinstate, add it to AdminActionKind and update this test');
  // Pinned on purpose: these map to "unknown" today. Wiring the Reinstate UI must add rules (and flip this list to empty) before it ships.
  const added = ['Listing is not removed', 'This property already has a live listing', 'A report is not used for this action', 'Property has a removed listing'];
  for (const m of added) assert.ok(actionBody.includes(m) || effective['save_listing_draft']!.source.includes(m), `${m} is raised by the new SQL`);
  assert.deepEqual(added.filter((m) => classifyAdminError({ message: m }, { decision: true }).code === 'unknown'), added);
});

test('the SQL still defines all three functions and raises the messages this test knows about', () => {
  assert.equal(bodies.length, 3, 'three public functions found in the migration');
  assert.ok(runtimeMessages.length >= 20, `found ${runtimeMessages.length} runtime messages`);
});

test('every runtime message raised by the SQL maps to a specific plain-language rule (none fall through to "unknown")', () => {
  for (const message of runtimeMessages) {
    const info = classifyAdminError({ message }, { decision: true });
    assert.notEqual(info.code, 'unknown', `no rule for SQL message: ${message}`);
    assert.doesNotMatch(`${info.title} ${info.message} ${info.nextStep}`, /exception|sqlstate|postgres|42\d{3}|22023|55000/i, message);
    assert.ok(info.title.length > 0 && info.message.length > 0 && info.nextStep.length > 0, message);
  }
});

test('every new rule corresponds to a message the SQL really raises (no dead or misspelled rules)', () => {
  const produced = new Set(runtimeMessages.map((message) => classifyAdminError({ message }).code));
  produced.delete('access_unavailable');
  assert.deepEqual([...produced].sort(), [...NEW_CODES].sort());
});

test('the messages the Admin is most likely to meet read as plain language', () => {
  const text = (message: string) => { const i = classifyAdminError({ message }, { decision: true }); return `${i.title}: ${i.message} ${i.nextStep}`; };
  assert.match(text('Listing cannot be removed while a tenancy is open'), /proposed, awaiting confirmation or active[\s\S]*remove the listing/);
  assert.match(text('Admin accounts cannot be targeted'), /can't be suspended, restored or removed/);
  assert.match(text('Report must be upheld first'), /upheld/);
  assert.match(text('A report is required for this action'), /upheld report/);
  assert.match(text('Audit entry was not written'), /nothing was changed/);
  assert.match(text('Conflicting retry'), /already started with different details/);
});

test('fixable refusals keep the sheet open; state conflicts ask to reload', () => {
  const reload = (message: string) => classifyAdminError({ message }, { decision: true }).reload;
  for (const m of ['Reason must be 10 to 500 characters', 'End date must be in the future', 'End date applies only to suspensions', 'Choose exactly one target', 'A report is required for this action', 'Action was not applied', 'Audit entry was not written', 'READ COMMITTED required', 'Invalid audit filter']) assert.equal(reload(m), false, m);
  for (const m of ['Account is already restricted or suspended', 'Listing cannot be removed while a tenancy is open', 'Report must be upheld first', 'Target unavailable', 'Conflicting retry']) assert.equal(reload(m), true, m);
});

test('allowed actions, bounds, page sizes and filters agree between the SQL and the frontend', () => {
  const sqlActions = [...sql.match(/p_action not in\(([^)]*)\)/)![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  const tsActions: AdminActionKind[] = ['suspend_account', 'restore_account', 'remove_listing'];
  assert.deepEqual(sqlActions, [...tsActions].sort(), 'warn, restrict and pause stay unwired in both');
  assert.ok(!(sqlActions as string[]).includes('pause_listing'), 'pause_listing is not offered until a moderation hold exists');
  // The report requirement: the SQL requires p_report_id for exactly the actions the app only offers from an upheld report.
  assert.match(sql, /if p_report_id is null and p_action in\('suspend_account','remove_listing'\) then raise exception 'A report is required for this action'/);
  assert.match(sql, /A report is required for this action/);
  assert.match(sql, new RegExp(`char_length\\(reason\\) not between ${ADMIN_REASON_MIN} and ${ADMIN_REASON_MAX}`));
  assert.match(sql, new RegExp(`limit ${AUDIT_PAGE_SIZE} offset p_offset`));
  assert.match(sql, /limit 100\) x\)/, 'restrictions page size matches the parser limit of 100');
  const sqlKinds = [...auditBody.match(/p_kind not in\(([^)]*)\)/)![1]!.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(sqlKinds, auditFilters.map((f) => f.id).sort());
});

test('the service passes exactly the parameter names the SQL declares', () => {
  const service = readFileSync('src/features/admin-moderation/services/adminActionsService.ts', 'utf8');
  const params = (fn: string) => [...sql.match(new RegExp(`create function public\\.${fn}\\(([^)]*)\\)`))![1]!.matchAll(/\bp_[a-z_]+/g)].map((m) => m[0]).sort();
  const used = (rpc: string) => { const chunk = service.slice(service.indexOf(`rpc('${rpc}'`)); return [...chunk.slice(0, chunk.indexOf('}')).matchAll(/\bp_[a-z_]+/g)].map((m) => m[0]).sort(); };
  assert.deepEqual(used('apply_admin_moderation_action'), params('apply_admin_moderation_action'));
  assert.deepEqual(used('get_admin_audit_log'), params('get_admin_audit_log'));
  assert.deepEqual(params('get_admin_restrictions'), []);
  const types = readFileSync('src/shared/services/supabase/database.types.ts', 'utf8');
  for (const p of params('apply_admin_moderation_action')) assert.ok(types.includes(p + ':'), `database.types.ts declares ${p}`);
});

test('security shape stays: definer functions, pinned existing trigger, client grants limited to the three RPCs, strict audit', () => {
  assert.match(sql, /'311afeb3c10eef8dd2b1b5a965377f21'/, 'apply_moderation_action md5 pin');
  assert.equal(bodies.every((m) => /security definer set search_path=pg_catalog/.test(m[0])), true);
  assert.equal((sql.match(/is_active_admin\(a\) is not true/g) ?? []).length, 3, 'every RPC requires an active Admin');
  assert.match(sql, /grant execute on function public\.apply_admin_moderation_action\([^;]*to authenticated;/);
  assert.doesNotMatch(sql, /to authenticated,\s*anon|to anon|grant [^;]* on (table )?public\.(moderation_actions|admin_audit_logs)|grant [^;]* on all tables/i, 'no client table grants');
  assert.match(sql, /revoke all on all tables in schema rentlease_admin_actions from public,anon,authenticated,service_role/);
  const triggers = [...sql.matchAll(/create function rentlease_admin_actions\.audit_[a-z_]+\(\)[\s\S]*?\$fn\$;/g)];
  assert.equal(triggers.length, 3);
  for (const t of triggers) { assert.doesNotMatch(t[0], /exception\s+when|when others/i, 'audit triggers never swallow errors'); assert.match(t[0], /security definer set search_path=pg_catalog/); }
  assert.match(sql, /Audit failure policy \(deliberate\)/, 'the policy is documented in the migration header');
  assert.equal((sql.match(/create trigger audit_(verification|report|review)_decision after /g) ?? []).length, 3, 'AFTER triggers');
});
