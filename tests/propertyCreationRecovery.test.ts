/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/services/supabase/database.types';
import { emptyDraftProperty, propertyCreationInput } from '../src/features/property-listing/models/DraftProperty';
import { CLOCK_SLACK_MS, YOUNG_MARKER_MS, createPropertyCreationService } from '../src/features/property-listing/services/propertyCreationService';
import { createPropertyCreationWorkflow } from '../src/features/property-listing/viewModels/propertyCreationWorkflow';
import { createdOn, newestFirst, recentPropertyLabel, recoveryMessage, titleCase } from '../src/features/property-listing/models/RecentProperty';

const PROPERTY = 'a0000000-0000-4000-8000-000000000001';
const location = { exactLatitude: 14.4291, exactLongitude: 120.9367, publicLatitude: 14.43, publicLongitude: 120.94 };
const validDraft = () => ({ ...emptyDraftProperty(), propertyType: 'studio' as const, city: 'imus' as const, barangay: 'Example barangay', addressLine1: 'Example street', ...location, bedrooms: '1', bathrooms: '1', floorAreaSqm: '32' });
const NOW = Date.parse('2026-11-15T12:00:00Z');
const at = (minutesBeforeMarker: number) => new Date(NOW - minutesBeforeMarker * 60_000).toISOString();
const row = (n: number, created_at: string, over: any = {}) => ({ id: `b000000${n}-0000-4000-8000-00000000000${n}`, landlord_id: 'owner', property_type: 'apartment', city: 'imus', barangay: 'anabu i-a', created_at, ...over });

// A fake Supabase client: profiles, a properties table that honors eq / gte / order / limit, an rpc that can wait or fail.
function harness(startRows: any[] = []) {
  const rows = [...startRows], values = new Map<string, string>(), reads: string[] = [];
  let userId = 'owner', rpcCalls = 0, rpcError: any = null, wait: Promise<void> | null = null, rpcResult: any = { property_id: PROPERTY, status: 'created' }, serverCreates = true, clock = NOW;
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table: string) {
      reads.push(table);
      if (table === 'profiles') { const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { account_status: 'active', tier1_verified_at: 'date' }, error: null }) }; return q; }
      const f: Record<string, unknown> = {}; let limit = 100;
      const list = () => rows.filter(r => Object.entries(f).every(([k, v]) => k === 'since' ? r.created_at >= (v as string) : r[k] === v))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1)).slice(0, limit);
      const q: any = { select: () => q, eq: (k: string, v: unknown) => { f[k] = v; return q; }, gte: (_k: string, v: string) => { f.since = v; return q; }, order: () => q, limit: (n: number) => { limit = n; return q; },
        maybeSingle: async () => ({ data: list()[0] ?? null, error: null }), then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ data: list(), error: null })) };
      return q;
    },
    async rpc() { rpcCalls++; if (wait) await wait; if (serverCreates) rows.push(row(9, new Date(clock).toISOString(), { id: PROPERTY })); return { data: rpcResult, error: rpcError }; },
  } as unknown as SupabaseClient<Database>;
  const journal = { getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { values.set(k, v); }, removeItem: async (k: string) => { values.delete(k); } };
  const service = createPropertyCreationService(() => client, journal, () => {}, () => clock);
  const marker = () => { const v = values.get('rentlease:property-creation:owner'); return v ? JSON.parse(v) : null; };
  return {
    service, journal, values, rows, reads, marker, rpcCalls: () => rpcCalls,
    setMarker: (m: unknown) => values.set('rentlease:property-creation:owner', JSON.stringify(m)),
    setRpcError: (e: unknown) => { rpcError = e; }, setRpcResult: (r: unknown) => { rpcResult = r; }, setServerCreates: (v: boolean) => { serverCreates = v; },
    delay: (p: Promise<void>) => { wait = p; }, setUser: (id: string) => { userId = id; }, setClock: (t: number) => { clock = t; },
  };
}
const flow = (h: ReturnType<typeof harness>) => createPropertyCreationWorkflow(h.service);
const fill = (w: ReturnType<typeof flow>) => { const d = validDraft(); const { exactLatitude, exactLongitude, publicLatitude, publicLongitude, ...fields } = d;
  for (const k of Object.keys(fields) as (keyof typeof fields)[]) w.updateField(k as never, fields[k] as never);
  w.provideConfirmedLocation({ exactLatitude, exactLongitude, publicLatitude, publicLongitude }, w.getSnapshot().locationRevision); };

// ---- 1. The dead end, and its way out
test('REPRODUCTION: an old pending marker (no time) at initialize leaves a fresh post in the recovery state', async () => {
  const h = harness(); h.setMarker({ state: 'pending' }); const w = flow(h);
  await w.initialize();
  const s = w.getSnapshot();
  assert.equal(s.uncertain, true, 'the marker blocks the new post: this is the reported dead end, kept for a marker that cannot be checked');
  assert.equal(s.uncertainSince, null); assert.deepEqual(s.recent, []); assert.equal(s.loaded, false);
  assert.equal(h.rpcCalls(), 0, 'and it never creates');
});
test('a pending marker WITH a time and nothing created since: a clean new post, marker cleared, no scary message', async () => {
  const h = harness([row(1, at(60))]);                       // an older property exists, created an hour before the interrupted save
  h.setMarker({ state: 'pending', at: NOW }); h.setClock(NOW + 3 * 60_000); const w = flow(h);
  await w.initialize();
  const s = w.getSnapshot();
  assert.equal(s.uncertain, false); assert.equal(s.error, null); assert.equal(s.loaded, true); assert.equal(s.propertyId, null);
  assert.equal(h.marker(), null, 'the marker is gone');
  assert.equal(h.rpcCalls(), 0, 'nothing was created to open the clean post');
  fill(w); await w.submit(true); assert.equal(w.getSnapshot().propertyId, PROPERTY, 'and a save now works');
});
test('a pending marker with a time and properties created since: only those, newest first, nothing created, marker kept', async () => {
  const h = harness([row(1, at(60)), row(2, at(-1)), row(3, at(-10)), row(4, at(4))]);   // an hour before (out), 1 and 10 min after, 4 min before (inside the slack)
  h.setMarker({ state: 'pending', at: NOW }); const w = flow(h);
  await w.initialize();
  const s = w.getSnapshot();
  assert.equal(s.uncertain, true); assert.equal(s.uncertainSince, NOW); assert.equal(s.recentChecked, true);
  assert.deepEqual(s.recent.map(r => r.id), [row(3, '').id, row(2, '').id, row(4, '').id], 'newest first; the hour-old property is not shown');
  assert.match(s.error ?? '', /created around your last save/);
  assert.deepEqual(h.marker(), { state: 'pending', at: NOW }, 'the marker stays until the person decides');
  assert.equal(h.rpcCalls(), 0); assert.equal(s.propertyId, null, 'never auto-selected, never auto-created');
});
test('the clock slack is exactly five minutes', async () => {
  assert.equal(CLOCK_SLACK_MS, 5 * 60_000);
  const inside = harness([row(1, at(5))]); inside.setMarker({ state: 'pending', at: NOW });
  const a = flow(inside); await a.initialize(); assert.equal(a.getSnapshot().uncertain, true, 'five minutes before still counts');
  const outside = harness([row(1, new Date(NOW - CLOCK_SLACK_MS - 1000).toISOString())]); outside.setMarker({ state: 'pending', at: NOW }); outside.setClock(NOW + 3 * 60_000);
  const b = flow(outside); await b.initialize(); assert.equal(b.getSnapshot().uncertain, false, 'one second more does not');
});
test('only this landlord\'s properties count', async () => {
  const h = harness([row(1, at(-1), { landlord_id: 'someone-else' })]); h.setMarker({ state: 'pending', at: NOW }); h.setClock(NOW + 3 * 60_000);
  const w = flow(h); await w.initialize(); assert.equal(w.getSnapshot().uncertain, false);
});
test('an unreadable or odd marker is treated as an old one: the person decides', async () => {
  for (const raw of ['not json', '"text"', '{}', '{"state":"pending","at":"yesterday"}', '{"state":"pending","at":null}']) {
    const h = harness(); h.values.set('rentlease:property-creation:owner', raw); const w = flow(h);
    await w.initialize(); assert.equal(w.getSnapshot().uncertain, true, raw); assert.equal(w.getSnapshot().uncertainSince, null, raw); assert.equal(h.rpcCalls(), 0, raw);
  }
});
test('a receipt marker still opens the saved property, and a receipt for a property that is gone is still uncertain', async () => {
  const ok = harness([row(9, at(1), { id: PROPERTY })]); ok.setMarker({ propertyId: PROPERTY, status: 'created' });
  const w = flow(ok); await w.initialize(); assert.equal(w.getSnapshot().propertyId, PROPERTY); assert.equal(w.getSnapshot().uncertain, false);
  const gone = harness(); gone.setMarker({ propertyId: PROPERTY, status: 'created' });
  const g = flow(gone); await g.initialize(); assert.equal(g.getSnapshot().uncertain, true);
});

// ---- 2. The marker carries a time; creating never proceeds past a candidate
test('create writes the pending marker WITH the time before the call is sent', async () => {
  const h = harness(); let release!: () => void; h.delay(new Promise<void>(r => { release = r; })); h.setClock(NOW + 1234);
  const pending = h.service.create('owner', propertyCreationInput(validDraft()));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(h.rpcCalls(), 1, 'the call is out'); assert.deepEqual(h.marker(), { state: 'pending', at: NOW + 1234 });
  release(); assert.equal((await pending).propertyId, PROPERTY); assert.deepEqual(h.marker(), { propertyId: PROPERTY, status: 'created' });
});
test('an unknown outcome leaves a timed marker, and the error carries its time', async () => {
  const h = harness(); h.setRpcError({ code: '', message: 'offline' }); h.setServerCreates(false);
  await assert.rejects(h.service.create('owner', propertyCreationInput(validDraft())), (e: any) => e.code === 'property_creation_uncertain' && e.since === NOW);
  assert.deepEqual(h.marker(), { state: 'pending', at: NOW });
});
test('create never goes ahead of a candidate: it stops with the candidates and sends nothing', async () => {
  const h = harness([row(2, at(-1))]); h.setMarker({ state: 'pending', at: NOW });
  await assert.rejects(h.service.create('owner', propertyCreationInput(validDraft())), (e: any) => e.code === 'property_creation_uncertain' && e.since === NOW && e.recent.length === 1);
  assert.equal(h.rpcCalls(), 0);
});
test('create after a stale marker with no candidate clears it and saves once', async () => {
  const h = harness([row(1, at(120))]); h.setMarker({ state: 'pending', at: NOW }); h.setClock(NOW + 3 * 60_000);
  assert.equal((await h.service.create('owner', propertyCreationInput(validDraft()))).propertyId, PROPERTY);
  assert.equal(h.rpcCalls(), 1); assert.deepEqual(h.marker(), { propertyId: PROPERTY, status: 'created' });
});
test('create after an OLD marker (no time) still refuses', async () => {
  const h = harness(); h.setMarker({ state: 'pending' });
  await assert.rejects(h.service.create('owner', propertyCreationInput(validDraft())), { code: 'property_creation_uncertain' });
  assert.equal(h.rpcCalls(), 0);
});

// ---- 3. Duplicates
test('a duplicate create shares the running call: one RPC, one receipt, never uncertain', async () => {
  const h = harness(); let release!: () => void; h.delay(new Promise<void>(r => { release = r; }));
  const first = h.service.create('owner', propertyCreationInput(validDraft())), second = h.service.create('owner', propertyCreationInput(validDraft()));
  release(); const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b); assert.equal(h.rpcCalls(), 1);
});
test('another workflow opening while a save runs waits for it and then opens the saved property, never an uncertain state', async () => {
  const h = harness(); let release!: () => void; h.delay(new Promise<void>(r => { release = r; }));
  const first = flow(h); await first.initialize(); fill(first); const saving = first.submit(true);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  const second = flow(h); const opening = second.initialize();
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(second.getSnapshot().uncertain, false, 'the pending marker of a running save is not an unknown outcome');
  release(); await saving; await opening;
  assert.equal(first.getSnapshot().propertyId, PROPERTY); assert.equal(second.getSnapshot().propertyId, PROPERTY); assert.equal(second.getSnapshot().uncertain, false);
  assert.equal(h.rpcCalls(), 1);
});
test('starting another property while a save runs is refused plainly, not marked uncertain', async () => {
  const h = harness(); let release!: () => void; h.delay(new Promise<void>(r => { release = r; }));
  const saving = h.service.create('owner', propertyCreationInput(validDraft()));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  await assert.rejects(h.service.beginNew('owner'), (e: any) => e.code === 'property_creation_preflight' && /still being saved/.test(e.message));
  release(); await saving; assert.equal(h.rpcCalls(), 1);
});
test('a double press on Save in one workflow makes one call and no uncertain state', async () => {
  const h = harness(); let release!: () => void; h.delay(new Promise<void>(r => { release = r; }));
  const w = flow(h); await w.initialize(); fill(w);
  const a = w.submit(true), b = w.submit(true);
  release(); await Promise.all([a, b]);
  assert.equal(h.rpcCalls(), 1); assert.equal(w.getSnapshot().uncertain, false); assert.equal(w.getSnapshot().propertyId, PROPERTY);
});

// ---- 4. The recovery actions
test('an unknown outcome after a save: Check recent finds the property by the marker time and the person selects it', async () => {
  const h = harness(); h.setRpcError({ code: '', message: 'offline' });   // the server did create it, but the answer was lost
  const w = flow(h); await w.initialize(); fill(w); await w.submit(true);
  assert.equal(w.getSnapshot().uncertain, true); assert.equal(w.getSnapshot().uncertainSince, NOW); assert.equal(w.getSnapshot().recentChecked, false);
  await w.checkRecent();
  assert.deepEqual(w.getSnapshot().recent.map(r => r.id), [PROPERTY]); assert.equal(w.getSnapshot().recentChecked, true);
  await w.confirmExisting('not-in-the-list'); assert.equal(w.getSnapshot().propertyId, null, 'only a listed property can be selected');
  await w.confirmExisting(PROPERTY);
  assert.equal(w.getSnapshot().propertyId, PROPERTY); assert.equal(w.getSnapshot().uncertain, false); assert.deepEqual(h.marker(), { propertyId: PROPERTY, status: 'created' });
});
test('an unknown outcome where the server created nothing: Check recent clears the marker and keeps what the person typed', async () => {
  const h = harness(); h.setRpcError({ code: '', message: 'offline' }); h.setServerCreates(false);
  const w = flow(h); await w.initialize(); fill(w); await w.submit(true);
  assert.equal(w.getSnapshot().uncertain, true);
  h.setClock(NOW + 3 * 60_000);       // old enough that an empty answer is believed
  await w.checkRecent();
  const s = w.getSnapshot();
  assert.equal(s.uncertain, false); assert.equal(s.error, null); assert.equal(h.marker(), null);
  assert.equal(s.draft.barangay, 'Example barangay', 'the typed details are kept'); assert.equal(s.loaded, true);
  h.setRpcError(null); h.setServerCreates(true); await w.submit(true);
  assert.equal(w.getSnapshot().propertyId, PROPERTY, 'and the person can save again'); assert.equal(h.rpcCalls(), 2);
});
test('an OLD marker: Check recent lists the latest properties unfiltered and never clears the marker by itself', async () => {
  const h = harness([row(1, at(600)), row(2, at(3000))]); h.setMarker({ state: 'pending' });
  const w = flow(h); await w.initialize(); await w.checkRecent();
  assert.deepEqual(w.getSnapshot().recent.map(r => r.id), [row(1, '').id, row(2, '').id], 'newest first, whatever the age');
  assert.equal(w.getSnapshot().uncertain, true); assert.notEqual(h.marker(), null);
  const none = harness(); none.setMarker({ state: 'pending' }); const n = flow(none); await n.initialize(); await n.checkRecent();
  assert.equal(n.getSnapshot().uncertain, true, 'nothing found for an old marker is not proof: the person decides'); assert.match(n.getSnapshot().error ?? '', /No recent property was found/); assert.notEqual(none.marker(), null);
});
test('start fresh clears the marker, keeps the typed details, creates nothing, and only works from the recovery state', async () => {
  const h = harness([row(1, at(600))]); h.setMarker({ state: 'pending' });
  const w = flow(h); await w.initialize(); assert.equal(w.getSnapshot().uncertain, true);
  w.updateField('barangay' as never, 'ignored while uncertain' as never); assert.equal(w.getSnapshot().draft.barangay, '', 'the form is locked while uncertain');
  await w.startFresh();
  const s = w.getSnapshot();
  assert.equal(s.uncertain, false); assert.equal(s.loaded, true); assert.equal(s.error, null); assert.deepEqual(s.recent, []); assert.equal(s.uncertainSince, null);
  assert.equal(h.marker(), null); assert.equal(h.rpcCalls(), 0); assert.equal(s.propertyId, null);
  fill(w); await w.submit(true); assert.equal(w.getSnapshot().propertyId, PROPERTY, 'a fresh post saves');
  // not in the recovery state: nothing happens
  const clean = harness(); clean.setMarker({ propertyId: PROPERTY, status: 'created' }); clean.rows.push(row(9, at(1), { id: PROPERTY }));
  const c = flow(clean); await c.initialize(); await c.startFresh(); assert.equal(c.getSnapshot().propertyId, PROPERTY, 'a saved property is not discarded'); assert.deepEqual(clean.marker(), { propertyId: PROPERTY, status: 'created' });
});
test('start fresh keeps the identity-change handling', async () => {
  const h = harness(); h.setMarker({ state: 'pending' }); const w = flow(h); await w.initialize();
  const real = h.journal.removeItem; h.journal.removeItem = async (k: string) => { h.setUser('someone-else'); return real(k); };
  await w.startFresh();
  assert.match(w.getSnapshot().error ?? '', /account changed/i); assert.equal(w.getSnapshot().uncertain, false); assert.equal(w.getSnapshot().propertyId, null);
});
test('an identity change during the first check resets the state, as before', async () => {
  const h = harness(); h.setMarker({ state: 'pending', at: NOW }); h.rows.push(row(2, at(-1)));
  const w = flow(h); const opening = w.initialize(); h.setUser('someone-else'); await opening;
  assert.match(w.getSnapshot().error ?? '', /account changed/i); assert.deepEqual(w.getSnapshot().recent, []);
});

// ---- 5. Words
test('the recovery card words: readable type, barangay and city, a date, newest first, no raw id', () => {
  const r = row(1, '2026-11-15T12:00:00Z', { property_type: 'boarding_house', city: 'imus', barangay: 'anabu i-a' });
  assert.equal(recentPropertyLabel(r), 'Boarding house in Anabu I-A, Imus (created Nov 15, 2026)');
  assert.equal(recentPropertyLabel(row(1, 'not a date', { property_type: 'apartment', barangay: '  poblacion ' })), 'Apartment in Poblacion, Imus', 'no date, no brackets');
  assert.ok(!recentPropertyLabel(r).includes(r.id) && !/_/.test(recentPropertyLabel(r)));
  assert.equal(recentPropertyLabel(row(1, '2026-11-15T12:00:00Z', { property_type: 'something_new', city: 'new_city', barangay: '' })), 'Something New in New City (created Nov 15, 2026)', 'an unknown value is still readable');
  assert.equal(createdOn('2026-01-02T12:00:00Z'), 'Jan 2, 2026'); assert.equal(createdOn('x'), null);
  assert.equal(titleCase('anabu i-a'), 'Anabu I-A'); assert.equal(titleCase('  SAN ROQUE '), 'SAN ROQUE'); assert.equal(titleCase('santa-cruz ii'), 'Santa-Cruz Ii');
  assert.deepEqual(newestFirst([{ id: 'a', created_at: '2026-01-01T00:00:00Z' }, { id: 'c', created_at: 'bad' }, { id: 'b', created_at: '2026-03-01T00:00:00Z' }, { id: 'd', created_at: '2026-03-01T00:00:00Z' }]).map(x => x.id), ['d', 'b', 'a', 'c'], 'newest first, a tie by id, a bad date last');
});
test('one message, four situations', () => {
  const m = (recent: number, uncertainSince: number | null, recentChecked: boolean) => recoveryMessage({ recent: new Array(recent).fill(0), uncertainSince, recentChecked });
  assert.match(m(2, NOW, true), /created around your last save/); assert.match(m(2, null, true), /most recent properties/);
  assert.match(m(0, NOW, true), /No recent property was found/); assert.match(m(0, null, false), /earlier save/); assert.match(m(0, NOW, false), /last save/);
  for (const text of [m(2, NOW, true), m(2, null, true), m(0, NOW, true), m(0, null, false), m(0, NOW, false)]) assert.ok(!/support\/backend|do not create another blindly|Do not submit again/i.test(text), text);
});

// ---- 6. The card and where it is used
const cache: Record<string, any> = {};
function load(file: string, state: { confirming: boolean; setters: boolean[] }): any {
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react') return { useState: () => [state.confirming, (v: boolean) => state.setters.push(v)] };
    if (key === 'react-native') return { StyleSheet: { create: (s: any) => s }, Text: 'Text', View: 'View' };
    const n = key.split('/').at(-1)!;
    if (n === 'RecentProperty') return cache[n] ??= (() => { const m = { exports: {} as any }; new Function('require', 'module', 'exports', ts.transpileModule(readFileSync('src/features/property-listing/models/RecentProperty.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)((k: string) => k.endsWith('DraftProperty') ? require('../src/features/property-listing/models/DraftProperty') : {}, m, m.exports); return m.exports; })();
    if (n === 'spacing') return { spacing: { sm: 12 } };
    if (n === 'ui') return { ui: {} };
    return { [n]: n };
  };
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  return m.exports;
}
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const card = (confirming: boolean, over: any = {}) => {
  const log: string[] = [], setters: boolean[] = [], state = { confirming, setters };
  const tree = load('src/features/property-listing/components/PropertyRecoveryCard.tsx', state).PropertyRecoveryCard({
    state: { recent: [row(2, '2026-11-15T12:00:00Z'), row(1, '2026-11-14T12:00:00Z')], uncertainSince: NOW, recentChecked: true, confirming: false, busy: false, ...over },
    onCheck: () => log.push('check'), onUse: (id: string) => log.push(`use:${id}`), onStartFresh: () => log.push('fresh'),
  });
  const buttons = nodes(tree).filter(n => n.type === 'ListingButton');
  return { tree, log, setters, buttons, label: (l: string) => buttons.find(b => b.props.label === l) };
};
test('the card shows one message and readable choices, newest first, with no raw id anywhere', () => {
  const c = card(false);
  const notices = nodes(c.tree).filter(n => n.type === 'FeedbackNotice');
  assert.equal(notices.length, 1, 'one notice, not a red one and an amber one'); assert.equal(notices[0].props.tone, 'warning');
  assert.deepEqual(c.buttons.map(b => b.props.label), ['Apartment in Anabu I-A, Imus (created Nov 15, 2026)', 'Apartment in Anabu I-A, Imus (created Nov 14, 2026)', 'None of these, start fresh']);
  assert.ok(!JSON.stringify(c.buttons.map(b => b.props.label)).includes('b000000'), 'no id');
  c.buttons[0].props.onPress(); assert.deepEqual(c.log, [`use:${row(2, '').id}`]);
});
test('Check recent shows only until the properties have been looked up', () => {
  assert.ok(card(false, { recentChecked: false, recent: [] }).label('Check recent owned properties'));
  assert.equal(card(false, { recentChecked: true }).label('Check recent owned properties'), undefined);
  card(false, { recentChecked: false, recent: [] }).label('Check recent owned properties').props.onPress();
});
test('Start fresh asks once: the first press only asks, Yes does it, Cancel does not', () => {
  const first = card(false); first.label('None of these, start fresh').props.onPress();
  assert.deepEqual(first.log, [], 'nothing happens on the first press'); assert.deepEqual(first.setters, [true], 'it opens the question');
  const asking = card(true);
  assert.ok(nodes(asking.tree).some(n => n.type === 'Text' && /Properties you already have are not deleted/.test(String(n.props.children))));
  assert.equal(asking.label('None of these, start fresh'), undefined, 'the question replaces the button');
  asking.label('Cancel').props.onPress(); assert.deepEqual(asking.log, [], 'Cancel does nothing'); assert.deepEqual(asking.setters, [false]);
  const yes = card(true); yes.label('Yes, start fresh').props.onPress(); assert.deepEqual(yes.log, ['fresh']); assert.deepEqual(yes.setters, [false]);
});
test('every recovery control is disabled while busy', () => {
  const c = card(false, { busy: true, recentChecked: false });
  assert.ok(c.buttons.every(b => b.props.disabled === true));
});
test('both places that show the recovery state use the one card and no second red notice', () => {
  const feedback = readFileSync('src/features/property-listing/components/ComposerRecoveryFeedback.tsx', 'utf8');
  assert.match(feedback, /<PropertyRecoveryCard state=\{vm\.propertyState\} onCheck=\{\(\) => void vm\.propertyCreation\.checkRecent\(\)\} onUse=\{id => void vm\.propertyCreation\.confirmExisting\(id\)\} onStartFresh=\{\(\) => void vm\.propertyCreation\.startFresh\(\)\} \/>/);
  assert.match(feedback, /message=\{vm\.propertyState\.uncertain \|\| vm\.propertyValidationIssues/, 'the red error is not shown on top of the card');
  assert.ok(!/Do not create another copy|Use existing \$\{/.test(feedback));
  const setup = readFileSync('src/features/property-listing/views/PropertySetupView.tsx', 'utf8');
  assert.match(setup, /<PropertyRecoveryCard state=\{state\} onCheck=\{\(\) => void flow\.checkRecent\(\)\} onUse=\{id => void flow\.confirmExisting\(id\)\} onStartFresh=\{\(\) => void flow\.startFresh\(\)\} \/>/);
  assert.match(setup, /message=\{state\.uncertain \|\| vm\.propertyValidationIssues/);
  assert.ok(!/contact support\/backend|\$\{property\.id\}/.test(setup), 'no raw id and no support dead end');
});
test('nothing here touches Supabase beyond reads of the properties the landlord owns', () => {
  const service = readFileSync('src/features/property-listing/services/propertyCreationService.ts', 'utf8');
  assert.equal((service.match(/\.rpc\(/g) ?? []).length, 2, 'the two existing create calls, unchanged');
  assert.ok(!/\.from\([^)]*\)[\s\S]{0,160}\.(insert|update|delete|upsert)\(/.test(service), 'no table write');
  assert.ok([...service.matchAll(/\.from\('([a-z_]+)'\)\.select/g)].every(m => ['profiles', 'properties'].includes(m[1]!)), 'reads of profiles and properties only');
  const rpcs = [...service.matchAll(/rpc\('([a-z_0-9]+)'/g)].map(m => m[1]); assert.deepEqual(rpcs, ['create_property_setup_v2', 'create_property_setup']);
});

// ---- 7. A young marker is never cleared on "nothing found"
const sec = (n: number) => NOW + n * 1000;
test('a marker 30 seconds old with nothing found: a calm "still confirming" state, the marker is kept, nothing is created', async () => {
  assert.equal(YOUNG_MARKER_MS, 2 * 60_000);
  const h = harness([row(1, at(60))]); h.setMarker({ state: 'pending', at: NOW }); h.setClock(sec(30));
  const w = flow(h); await w.initialize();
  const s = w.getSnapshot();
  assert.equal(s.uncertain, true); assert.equal(s.confirming, true); assert.equal(s.loaded, false); assert.deepEqual(s.recent, []);
  assert.match(s.error ?? '', /^Still confirming your last save/); assert.ok(!/error|fail|could not|may already exist|do not/i.test(s.error ?? ''), 'no scary wording');
  assert.deepEqual(h.marker(), { state: 'pending', at: NOW }, 'the marker is kept'); assert.equal(h.rpcCalls(), 0);
  await w.checkRecent();                                                        // Retry too early: still calm, still kept
  assert.equal(w.getSnapshot().confirming, true); assert.equal(w.getSnapshot().uncertain, true); assert.deepEqual(h.marker(), { state: 'pending', at: NOW });
  w.updateField('barangay' as never, 'x' as never); assert.equal(w.getSnapshot().draft.barangay, '', 'nothing can be typed or saved meanwhile');
  await w.submit(true); assert.equal(h.rpcCalls(), 0, 'and a save is not sent');
  h.setClock(sec(130)); await w.checkRecent();                                  // after the two minutes the same Retry settles it
  const after = w.getSnapshot();
  assert.equal(after.uncertain, false); assert.equal(after.confirming, false); assert.equal(after.loaded, true); assert.equal(h.marker(), null); assert.equal(after.error, null);
});
test('the two minutes are exact: 119.9 seconds is still young, 120 seconds is not', async () => {
  const young = harness(); young.setMarker({ state: 'pending', at: NOW }); young.setClock(NOW + YOUNG_MARKER_MS - 1);
  const a = flow(young); await a.initialize(); assert.equal(a.getSnapshot().confirming, true);
  const old = harness(); old.setMarker({ state: 'pending', at: NOW }); old.setClock(NOW + YOUNG_MARKER_MS);
  const b = flow(old); await b.initialize(); assert.equal(b.getSnapshot().uncertain, false); assert.equal(old.marker(), null);
});
test('a marker 3 minutes old with nothing found: cleared, a clean post, no scary message', async () => {
  const h = harness([row(1, at(90))]); h.setMarker({ state: 'pending', at: NOW }); h.setClock(sec(180));
  const w = flow(h); await w.initialize();
  assert.equal(w.getSnapshot().uncertain, false); assert.equal(w.getSnapshot().confirming, false); assert.equal(w.getSnapshot().error, null); assert.equal(w.getSnapshot().loaded, true); assert.equal(h.marker(), null);
});
test('a marker 3 minutes old with a candidate found: the candidate is listed and the marker is kept', async () => {
  const h = harness([row(2, at(-1))]); h.setMarker({ state: 'pending', at: NOW }); h.setClock(sec(180));
  const w = flow(h); await w.initialize();
  const s = w.getSnapshot();
  assert.equal(s.uncertain, true); assert.equal(s.confirming, false); assert.deepEqual(s.recent.map(r => r.id), [row(2, '').id]); assert.deepEqual(h.marker(), { state: 'pending', at: NOW }); assert.equal(h.rpcCalls(), 0);
});
test('a candidate found on a young marker is shown at once: only an empty answer waits', async () => {
  const h = harness([row(2, at(-1))]); h.setMarker({ state: 'pending', at: NOW }); h.setClock(sec(30));
  const w = flow(h); await w.initialize();
  assert.equal(w.getSnapshot().confirming, false); assert.equal(w.getSnapshot().recent.length, 1);
});
test('a save is refused while the last marker is young and empty, and works once it is old enough', async () => {
  const h = harness(); h.setMarker({ state: 'pending', at: NOW }); h.setClock(sec(30));
  await assert.rejects(h.service.create('owner', propertyCreationInput(validDraft())), (e: any) => e.code === 'property_creation_uncertain' && e.confirming === true);
  assert.equal(h.rpcCalls(), 0);
  h.setClock(sec(200)); assert.equal((await h.service.create('owner', propertyCreationInput(validDraft()))).propertyId, PROPERTY); assert.equal(h.rpcCalls(), 1);
});
test('an unknown outcome right after a save waits calmly, then settles', async () => {
  const h = harness(); h.setRpcError({ code: '', message: 'offline' }); h.setServerCreates(false);
  const w = flow(h); await w.initialize(); fill(w); await w.submit(true);
  await w.checkRecent();                                                 // same instant: too young to believe an empty answer
  assert.equal(w.getSnapshot().confirming, true); assert.notEqual(h.marker(), null);
  h.setClock(sec(121)); await w.checkRecent();
  assert.equal(w.getSnapshot().uncertain, false); assert.equal(h.marker(), null); assert.equal(w.getSnapshot().draft.barangay, 'Example barangay');
});
test('a marker time in the future (the device clock moved back) is not young, so it cannot stick forever', async () => {
  const h = harness(); h.setMarker({ state: 'pending', at: NOW + 3_600_000 });
  const w = flow(h); await w.initialize(); assert.equal(w.getSnapshot().uncertain, false); assert.equal(h.marker(), null);
});
test('the confirming card: a calm line and one Check again, nothing that could start a second copy', () => {
  const c = card(false, { confirming: true, recent: [], recentChecked: true });
  const notices = nodes(c.tree).filter(n => n.type === 'FeedbackNotice');
  assert.equal(notices.length, 1); assert.equal(notices[0].props.tone, undefined, 'neutral, not a warning');
  assert.match(notices[0].props.message, /^Still confirming your last save/);
  assert.deepEqual(c.buttons.map(b => b.props.label), ['Check again']);
  c.buttons[0].props.onPress(); assert.deepEqual(c.log, ['check']);
  assert.ok(card(false, { confirming: true, recent: [], recentChecked: true, busy: true }).buttons.every(b => b.props.disabled === true));
  assert.ok(card(false, { confirming: true }).buttons.some(b => b.props.label === 'None of these, start fresh'), 'with candidates found the normal choices come back');
});
