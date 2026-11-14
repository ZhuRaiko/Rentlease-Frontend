/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { notificationTargetKinds, parseNotificationTarget } from '../src/features/notifications/models/InAppNotification';

const id = '00000000-0000-4000-8000-0000000000aa';

test('both verification kinds are accepted as notification targets, with a uuid id', () => {
  assert.deepEqual(parseNotificationTarget({ kind: 'property_verification', id }), { kind: 'property_verification', id });
  assert.deepEqual(parseNotificationTarget({ kind: 'identity_verification', id }), { kind: 'identity_verification', id });
  for (const kind of ['conversation', 'tenancy', 'report']) assert.deepEqual(parseNotificationTarget({ kind, id }), { kind, id });
  assert.equal(parseNotificationTarget(null), null);
});
test('unknown kinds and untrusted ids are still rejected', () => {
  assert.throws(() => parseNotificationTarget({ kind: 'profile', id }));
  assert.throws(() => parseNotificationTarget({ kind: 'verification', id }));
  assert.throws(() => parseNotificationTarget({ kind: 'property_verification', id: 'not-a-uuid' }));
  assert.throws(() => parseNotificationTarget({ kind: 'identity_verification' }));
  assert.throws(() => parseNotificationTarget([]));
  assert.deepEqual([...notificationTargetKinds].sort(), ['conversation', 'identity_verification', 'property_verification', 'report', 'tenancy']);
});
test('the app routes every target kind explicitly: no kind falls through into the reports screen', () => {
  const app = readFileSync('App.tsx', 'utf8').replace(/\r\n/g, '\n');
  const start = app.indexOf('renderTarget={(target,onBack)=>'), end = app.indexOf('registerBackAction={registerWorkspaceBack}\n', start);
  const route = app.slice(start, end);
  assert.ok(start > 0 && end > start);
  for (const kind of notificationTargetKinds) assert.match(route, new RegExp(`target\\.kind===['"]${kind}['"]`), `${kind} has its own branch`);
  assert.match(route, /target\.kind==='property_verification'\?renderPropertyVerification\(target\.id,onBack,registerWorkspaceBack\)/, 'a property notification opens that property\'s Tier 3 verification');
  assert.match(route, /target\.kind==='identity_verification'\?<UserVerificationFlowView tierOneVerified=\{[^}]*\} onClose=\{onBack\} registerBackAction=\{registerWorkspaceBack\}\/>/, 'an identity notification opens the Tier 2 overview (no property id)');
  assert.doesNotMatch(route, /initialPropertyId.*identity_verification|identity_verification.*initialPropertyId/);
  assert.match(route, /target\.kind==='report'\?<ReportingWorkspace/);
  assert.match(route, /:null\}\s*$/, 'an unknown kind renders nothing instead of a wrong screen');
});
