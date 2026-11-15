import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { CHECKING_MESSAGE, CHECK_FAILED_MESSAGE, CHECK_STALL_MS, listingCheckLine } from '../src/features/property-listing/models/ListingCheck';
import { createListingPublicationWorkflow } from '../src/features/property-listing/viewModels/listingPublicationWorkflow';

const property = '10000000-0000-4000-8000-000000000001';
test('the words are the wireframe words', () => {
  assert.equal(CHECK_FAILED_MESSAGE, "Couldn't check this listing");
  assert.equal(CHECKING_MESSAGE, 'Checking this listing…');
  assert.equal(CHECK_STALL_MS, 8000);
});
test('the check line: nothing when fine, quiet while checking, amber with Retry when failed or stalled', () => {
  assert.equal(listingCheckLine('ok', false), null);
  assert.equal(listingCheckLine('ok', true), null);
  assert.deepEqual(listingCheckLine('checking', false), { kind: 'checking', text: CHECKING_MESSAGE, retry: false });
  assert.deepEqual(listingCheckLine('checking', true), { kind: 'failed', text: CHECK_FAILED_MESSAGE, retry: true });
  assert.deepEqual(listingCheckLine('failed', false), { kind: 'failed', text: CHECK_FAILED_MESSAGE, retry: true });
  assert.deepEqual(listingCheckLine('failed', true), { kind: 'failed', text: CHECK_FAILED_MESSAGE, retry: true });
});

// ---- The workflow: a plain check is marked, and Retry can abandon a stuck one
const workflow = (restore: (propertyId: string, listingId?: string) => Promise<any>) => {
  const service: any = { restore, context: async () => ({}), assertContext: async () => {} };
  const flow = createListingPublicationWorkflow(service, () => {}); flow.setProperty(property); return flow;
};
test('a running check is marked as a check, and the marker ends with it', async () => {
  let release!: (v: any) => void; const flow = workflow(() => new Promise(r => { release = r; }));
  assert.equal(flow.getSnapshot().checking, false, 'not checking before a check starts');
  const p = flow.restore(null);
  assert.equal(flow.getSnapshot().busy, true); assert.equal(flow.getSnapshot().checking, true);
  release(null); assert.equal(await p, true);
  assert.equal(flow.getSnapshot().busy, false); assert.equal(flow.getSnapshot().checking, false); assert.equal(flow.getSnapshot().loaded, true);
});
test('a failed check ends the marker too, and leaves the error for Retry', async () => {
  const flow = workflow(async () => { throw new Error('offline'); });
  assert.equal(await flow.restore(null), false);
  const s = flow.getSnapshot(); assert.equal(s.loaded, false); assert.equal(s.busy, false); assert.equal(s.checking, false); assert.ok(s.error);
});
test('recheck abandons a stuck check, starts a new one, and ignores the stuck one if it ever answers', async () => {
  const resolvers: ((v: any) => void)[] = [], rows: string[] = [];
  const flow = workflow(() => new Promise(r => { resolvers.push(r); }));
  const first = flow.restore(null); assert.equal(flow.getSnapshot().busy, true);
  assert.equal(await flow.restore(null), false, 'a second plain restore is refused while one runs (unchanged)');
  const second = flow.recheck(null); assert.equal(resolvers.length, 2, 'a new call was made');
  resolvers[1]!(null); assert.equal(await second, true);
  assert.equal(flow.getSnapshot().loaded, true); assert.equal(flow.getSnapshot().busy, false);
  resolvers[0]!({ row: { id: 'late', property_id: property, status: 'archived' }, operations: [] }); await first;
  assert.equal(flow.getSnapshot().status, null, 'the abandoned call changed nothing'); assert.equal(flow.getSnapshot().loaded, true); rows.push('ok');
});
test('recheck clears an earlier error before it runs', async () => {
  let fail = true; const flow = workflow(async () => { if (fail) throw new Error('offline'); return null; });
  await flow.restore(null); assert.ok(flow.getSnapshot().error); fail = false;
  assert.equal(await flow.recheck(null), true); assert.equal(flow.getSnapshot().error, null); assert.equal(flow.getSnapshot().loaded, true);
});
test('recheck does nothing without a property', async () => {
  const service: any = { restore: async () => null, context: async () => ({}), assertContext: async () => {} };
  const flow = createListingPublicationWorkflow(service, () => {}); assert.equal(await flow.recheck(null), false);
});

// ---- The component
function render(state: 'ok' | 'checking' | 'failed', stalledNow = false) {
  const timers: { ms: number; fn: () => void }[] = [], sets: boolean[] = [], effects: (() => (() => void) | void)[] = [], cleared: number[] = [];
  const real = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  (globalThis as any).setTimeout = (fn: () => void, ms: number) => { timers.push({ ms, fn }); return timers.length; };
  (globalThis as any).clearTimeout = (id: number) => { cleared.push(id); };
  try {
    const req = (key: string): any => {
      if (key === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
      if (key === 'react') return { useState: () => [stalledNow, (v: boolean) => sets.push(v)], useEffect: (fn: any) => effects.push(fn) };
      if (key === 'react-native') return { Pressable: 'Pressable', StyleSheet: { create: (s: any) => s }, Text: 'Text', View: 'View' };
      const n = key.split('/').at(-1)!;
      if (n === 'colors') return { colors: { surface: '#F5F5F5', warningSurface: '#FFF7E8', warning: '#9A6414', textSecondary: '#606A63', primaryAction: '#32743C' } };
      if (n === 'ListingCheck') return load('src/features/property-listing/models/ListingCheck.ts');
      return { [n]: {}, ui: {}, radius: { panel: 12 }, spacing: { sm: 12 } };
    };
    const load = (file: string): any => { const m = { exports: {} as any }; new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports); return m.exports; };
    let retried = 0;
    const tree = load('src/features/property-listing/components/ListingCheckLine.tsx').ListingCheckLine({ state, onRetry: () => { retried++; } });
    const cleanups = effects.map(e => e());
    const runCleanup = () => { const keep = globalThis.clearTimeout; (globalThis as any).clearTimeout = (id: number) => { cleared.push(id); }; try { cleanups.forEach(c => (c as () => void)()); } finally { (globalThis as any).clearTimeout = keep; } };
    return { tree, timers, sets, runCleanup, cleared, retry: () => retried };
  } finally { (globalThis as any).setTimeout = real.setTimeout; (globalThis as any).clearTimeout = real.clearTimeout; }
}
const nodes = (v: any): any[] => v && typeof v === 'object' ? [v, ...[v.props?.children].flat(Infinity).flatMap(nodes)] : [];
const flat = (s: any) => Object.assign({}, ...[s].flat(Infinity).filter(Boolean));
const textOf = (t: any) => nodes(t).filter(n => n.type === 'Text').map(n => [n.props.children].flat().join('')).join(' | ');
test('the component: nothing for ok, a quiet line with no Retry while checking', () => {
  assert.equal(render('ok').tree, null);
  const r = render('checking');
  assert.equal(textOf(r.tree), CHECKING_MESSAGE);
  assert.ok(!nodes(r.tree).some(n => n.type === 'Pressable'), 'no Retry yet');
  assert.notEqual(flat(r.tree.props.style).backgroundColor, '#FFF7E8');
});
test('the component: a failed check is amber with a 48dp Retry that calls onRetry', () => {
  const r = render('failed'), view = nodes(r.tree);
  assert.match(textOf(r.tree), /^Couldn't check this listing \| Retry$/);
  const retry = view.find(n => n.type === 'Pressable')!;
  assert.equal(retry.props.accessibilityRole, 'button'); assert.ok(flat(retry.props.style).minHeight >= 48 && flat(retry.props.style).minWidth >= 48);
  retry.props.onPress(); assert.equal(r.retry(), 1);
  const s = flat(r.tree.props.style); assert.equal(s.backgroundColor, '#FFF7E8'); assert.equal(s.borderColor, '#9A6414');
  assert.equal(r.tree.props.accessibilityLiveRegion, 'polite');
});
test('the component: a check that runs too long turns into the failed look with Retry', () => {
  const r = render('checking', true);
  assert.match(textOf(r.tree), /Couldn't check this listing/); assert.ok(nodes(r.tree).some(n => n.type === 'Pressable'));
});
test('the component schedules the stall timer only while checking, for exactly the stall time, and clears it', () => {
  const checking = render('checking');
  assert.equal(checking.timers.length, 1); assert.equal(checking.timers[0]!.ms, CHECK_STALL_MS);
  assert.deepEqual(checking.sets, [false], 'it starts not stalled');
  checking.timers[0]!.fn(); assert.deepEqual(checking.sets, [false, true], 'the timer marks it stalled');
  checking.runCleanup(); assert.equal(checking.cleared.length, 1, 'the timer is cleared on change');
  for (const state of ['ok', 'failed'] as const) assert.equal(render(state).timers.length, 0, state);
});

// ---- Wiring
test('typing is gated only by what is known; writes keep the check; navigation is not held by a check', () => {
  const vm = readFileSync('src/features/property-listing/viewModels/usePropertyListingViewModel.ts', 'utf8');
  assert.equal((vm.match(/if \(initialHydrationPending\(\) \|\| operationBusy\(\) \|\| listingFieldsLocked\(\)\) return;/g) ?? []).length, 3, 'updateDraft, toggleAmenity and toggleRule');
  assert.match(vm, /\(publication\.getSnapshot\(\)\.busy && !publication\.getSnapshot\(\)\.checking\)/);
  assert.match(vm, /if \(operationBusy\(\) \|\| savedConfirmation\.current \|\| publicationReadOnly\(\)\) return;/, 'a write still waits for the check');
  assert.match(vm, /continuePostingEstimate:\(\)=>\{[^}]*publicationReadOnly\(\)/, 'Continue waits for the check');
  assert.match(vm, /void publication\.restore\(null\);/, 'the first save checks the new property');
  assert.match(vm, /void publication\.restore\(workspace\.listingId\);\s*\}, \[workspace\.propertyId/, 'a saved property whose check never ran is checked once nothing is saving');
  assert.match(vm, /listingDraftReadOnly: listingFieldsLocked\(\)/);
  const view = readFileSync('src/features/property-listing/views/ListingDetailsView.tsx', 'utf8');
  assert.match(view, /<ListingCheckLine state=\{vm\.listingCheck\.state\} onRetry=\{\(\) => void vm\.retryListingCheck\(\)\} \/>/);
  assert.match(view, /disabled:!editable\|\|!!waiting/);
  assert.match(view, /You can keep typing\. Only saving waits\./);
  const price = readFileSync('src/features/property-listing/views/PostingEstimateView.tsx', 'utf8');
  assert.match(price, /disabled=\{saving\|\|blocked\|\|!!waiting\}/);
});
