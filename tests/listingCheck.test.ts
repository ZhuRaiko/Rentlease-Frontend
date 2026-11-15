import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { CHECKING_MESSAGE, CHECK_FAILED_MESSAGE, CHECK_STALL_MS, RETRY_HINT, TYPING_HINT, WAITING_SUFFIX, listingCheckLine, savedLineText, waitingView } from '../src/features/property-listing/models/ListingCheck';
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
  assert.match(view, /waitingView\(waiting, vm\.returnTo \? 'Save and return' : 'Continue to Price'\)/);
  const price = readFileSync('src/features/property-listing/views/PostingEstimateView.tsx', 'utf8');
  assert.match(price, /disabled=\{saving\|\|blocked\|\|!!waiting\}/);
});

// ---- Stage 2: the saved line and the waiting button
test('the saved line shows the plain saved status and nothing else', () => {
  assert.equal(savedLineText('Property saved'), 'Property saved ✓');
  assert.equal(savedLineText('Property saved. Sharing recorded.'), 'Property saved. Sharing recorded.');
  assert.match(savedLineText('Property saved. Sharing could not be recorded. You can share it from the Property step.')!, /^Property saved\. Sharing could not/);
  for (const warning of ['Property saved. Listing details are not saved yet.', 'Property saved. Check photo status before continuing.', 'Listing draft saved. Nothing has been published.', '', null])
    assert.equal(savedLineText(warning), null, String(warning));
});
test('the waiting button: waits with a reason, the right hint for each reason, and nothing when nothing waits', () => {
  assert.deepEqual(waitingView(null, 'Continue to Price'), { label: 'Continue to Price', hint: null });
  assert.deepEqual(waitingView(CHECKING_MESSAGE, 'Continue to Price'), { label: 'Continue to Price · waiting for check', hint: 'You can keep typing. Only saving waits.' });
  assert.deepEqual(waitingView(CHECK_FAILED_MESSAGE, 'Save and return'), { label: 'Save and return · waiting for check', hint: 'Retry the check above to continue. You can keep typing.' });
  assert.deepEqual(waitingView('Check the unresolved listing status before making further changes.', 'Continue to Price'), { label: 'Continue to Price', hint: 'Check the unresolved listing status before making further changes. You can keep typing. Only saving waits.' }, 'another reason keeps its own words');
  assert.equal(WAITING_SUFFIX, ' · waiting for check'); assert.equal(TYPING_HINT, 'You can keep typing. Only saving waits.'); assert.equal(RETRY_HINT, 'Retry the check above to continue. You can keep typing.');
});
test('the saved line component is one slim quiet line, never a card', () => {
  const real = { setTimeout: globalThis.setTimeout };
  const req = (key: string): any => {
    if (key === 'react/jsx-runtime') return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
    if (key === 'react-native') return { StyleSheet: { create: (s: any) => s }, Text: 'Text', View: 'View' };
    const n = key.split('/').at(-1)!;
    if (n === 'colors') return { colors: { surface: '#F5F5F5', textSecondary: '#606A63' } };
    return { [n]: {}, ui: {}, radius: { panel: 12 }, spacing: { sm: 12 } };
  };
  const m = { exports: {} as any };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync('src/features/property-listing/components/ListingSavedLine.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(req, m, m.exports);
  const tree = m.exports.ListingSavedLine({ text: 'Property saved ✓' });
  const style = Object.assign({}, ...[tree.props.style].flat());
  assert.equal(style.backgroundColor, '#F5F5F5'); assert.equal(style.borderWidth, undefined, 'no border: not a card'); assert.ok(style.minHeight <= 40, 'slim');
  assert.equal(tree.props.accessibilityLiveRegion, 'polite');
  assert.equal(nodes(tree).filter(n => n.type === 'Text').map(n => n.props.children).join(''), 'Property saved ✓');
  assert.equal(real.setTimeout, globalThis.setTimeout);
});
test('the Price step button waits the same way, and the recovery feedback hides only the plain saved notice', () => {
  const price = readFileSync('src/features/property-listing/views/PostingEstimateView.tsx', 'utf8');
  assert.match(price, /const wait=waitingView\(waiting,label\);/);
  assert.match(price, /label=\{wait\.label\} disabled=\{saving\|\|blocked\|\|!!waiting\}/);
  assert.match(price, /wait\.hint\?wait\.hint:blocked\?/);
  const feedback = readFileSync('src/features/property-listing/components/ComposerRecoveryFeedback.tsx', 'utf8');
  assert.match(feedback, /message=\{slimSaved && savedLineText\(vm\.composerNotice\) \? null : vm\.composerNotice\}/, 'a warning notice still shows as a card');
});
