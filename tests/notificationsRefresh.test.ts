/// <reference types="node" />
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupNotifications, notificationLook, notificationRowView, routeNotificationTarget, whenLabel} from '../src/features/notifications/models/NotificationPresentation';
import {parseNotificationPage, type InAppNotification} from '../src/features/notifications/models/InAppNotification';

const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
// 2026-11-18T05:00:00Z is 1:00 PM on 18 Nov in Manila.
const NOW = Date.parse('2026-11-18T05:00:00Z');
const note = (n: number, type: string, createdAt: string, readAt: string | null = null, extra: Partial<InAppNotification> = {}): InAppNotification => ({id: id(n), title: 'T' + n, body: 'Open RentLease to review this update.', type, createdAt, readAt, ...extra});

test('every event type the server sends has an icon and a tone (maintenance amber, message blue, tenancy green, grey for review/report/verification)', () => {
  const types = ['new_message', 'viewing_update', 'maintenance_update', 'tenancy_update', 'rent_due', 'report_update', 'verification_update'];
  for (const t of types) assert.notEqual(notificationLook(t).icon, undefined, t);
  assert.deepEqual(notificationLook('maintenance_update'), {icon: 'wrench', tone: 'amber'});
  assert.deepEqual(notificationLook('new_message'), {icon: 'chat', tone: 'blue'});
  assert.deepEqual(notificationLook('tenancy_update'), {icon: 'house', tone: 'green'});
  assert.equal(notificationLook('report_update').tone, 'grey');
  assert.equal(notificationLook('review_request').tone, 'grey');
});

test('a type this app does not know falls back to a neutral look instead of breaking the list', () => {
  assert.deepEqual(notificationLook('something_new'), {icon: 'flag', tone: 'grey'});
});

test('unread = bold flag and dot; read = neither; the title stays the server’s', () => {
  const unread = notificationRowView(note(1, 'new_message', '2026-11-18T04:00:00Z'), NOW), read = notificationRowView(note(2, 'new_message', '2026-11-18T04:00:00Z', '2026-11-18T04:30:00Z'), NOW);
  assert.equal(unread.unread, true);
  assert.equal(read.unread, false);
  assert.equal(unread.title, 'T1');
});

test('Urgent shows ONLY when the notification says so; absent means "Maintenance update" as the server wrote it', () => {
  const plain = notificationRowView(note(1, 'maintenance_update', '2026-11-18T04:00:00Z', null, {title: 'Maintenance update'}), NOW);
  assert.equal(plain.urgent, false);
  assert.equal(plain.title, 'Maintenance update');
  assert.equal(plain.tone, 'amber');
  const urgent = notificationRowView(note(2, 'maintenance_update', '2026-11-18T04:00:00Z', null, {title: 'Maintenance update', urgent: true}), NOW);
  assert.equal(urgent.urgent, true);
  assert.equal(urgent.title, 'Urgent maintenance request');
  assert.deepEqual([urgent.icon, urgent.tone], ['warning', 'red']);
  assert.equal(notificationRowView(note(3, 'new_message', '2026-11-18T04:00:00Z', null, {urgent: true}), NOW).urgent, false, 'only maintenance can be urgent');
});

test('the list parser keeps an explicit urgent flag, and adds none when the server sends none', () => {
  const row = (extra: object) => ({id: id(1), title: 'Maintenance update', body: 'b', type: 'maintenance_update', createdAt: '2026-11-18T04:00:00Z', readAt: null, ...extra});
  const page = (rows: object[]) => parseNotificationPage({rows, unread: rows.length, through: '2026-11-18T04:00:00Z', next: null});
  assert.equal(page([row({})]).rows[0]!.urgent, undefined);
  assert.equal(page([row({urgent: true})]).rows[0]!.urgent, true);
  assert.equal(page([row({urgent: 'yes'})]).rows[0]!.urgent, undefined, 'only a real boolean counts');
});

test('grouping: Today first then Earlier, server order kept, an empty group left out', () => {
  const rows = [note(1, 'new_message', '2026-11-18T04:00:00Z'), note(2, 'tenancy_update', '2026-11-17T04:00:00Z'), note(3, 'maintenance_update', '2026-11-18T01:00:00Z'), note(4, 'report_update', '2026-11-13T04:00:00Z')];
  const groups = groupNotifications(rows, NOW);
  assert.deepEqual(groups.map(g => g.label), ['Today', 'Earlier']);
  assert.deepEqual(groups[0]!.rows.map(r => r.id), [id(1), id(3)]);
  assert.deepEqual(groups[1]!.rows.map(r => r.id), [id(2), id(4)]);
  assert.deepEqual(groupNotifications([rows[1]!], NOW).map(g => g.label), ['Earlier']);
  assert.deepEqual(groupNotifications([], NOW), []);
});

test('time label: the time today, the day before that (Philippine time)', () => {
  assert.equal(whenLabel('2026-11-17T17:11:00Z', NOW), '1:11 AM');
  assert.equal(whenLabel('2026-11-17T01:00:00Z', NOW), 'Nov 17');
  assert.equal(whenLabel('2026-11-18T04:00:00Z', NOW), '12:00 PM');
});

test('only a Reservation update opens the reservations screen; every other notification keeps its target', () => {
  const chat = {kind: 'conversation' as const, id: '00000000-0000-4000-8000-000000000001'}, home = {kind: 'tenancy' as const, id: '00000000-0000-4000-8000-000000000002'};
  assert.deepEqual(routeNotificationTarget({type: 'viewing_update', title: 'Reservation update'}, chat), {...chat, panel: 'reservations'});
  assert.deepEqual(routeNotificationTarget({type: 'viewing_update', title: 'Viewing update'}, chat), chat);
  assert.deepEqual(routeNotificationTarget({type: 'new_message', title: 'New message'}, chat), chat);
  assert.deepEqual(routeNotificationTarget({type: 'tenancy_update', title: 'Tenancy update'}, home), home);
  assert.deepEqual(routeNotificationTarget({type: 'tenancy_update', title: 'Reservation update'}, home), home, 'a non-conversation target is never changed');
});
