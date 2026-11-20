/// <reference types="node" />
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import type {SearchDiscoveryViewModel} from '../src/features/search-discovery/viewModels/useSearchDiscoveryViewModel';
import {preferencesExit} from '../src/features/search-discovery/models/MatchingPreferenceForm';
import {sharedStub} from './support/sharedStubs';

// The real Discovery hook, workflows and navigation guard; only React's scheduler and the backend/device ports are replaced (same method as gpsDiscoveryIntegration).
function mount(initialScreen: 'home' | 'matchingPreferences') {
  let cursor = 0, current: SearchDiscoveryViewModel;
  const accountId = 'tenant', slots: any[] = [], effects: (() => void)[] = [], cache = new Map<string, any>();
  const manualService = {user: async () => 'tenant', search: async () => [], locations: async () => ({locations: [], received: 0}), detail: async () => { throw Error('not selected'); }, catalogue: async () => []};
  const hooks = {
    useState(initial: any) { const i = cursor++; if (!slots[i]) slots[i] = {value: typeof initial === 'function' ? initial() : initial}; return [slots[i].value, (v: any) => { slots[i].value = typeof v === 'function' ? v(slots[i].value) : v; }]; },
    useRef(value: any) { const i = cursor++; return slots[i] ?? (slots[i] = {current: value}); },
    useMemo(fn: () => any, deps: unknown[]) { const i = cursor++; if (!slots[i] || deps.some((v, n) => !Object.is(v, slots[i].deps[n]))) slots[i] = {deps, value: fn()}; return slots[i].value; },
    useEffect(fn: () => any, deps: unknown[]) { const i = cursor++, previous = slots[i]; if (!previous || deps.some((v, n) => !Object.is(v, previous.deps[n]))) effects.push(() => { previous?.cleanup?.(); slots[i] = {deps, cleanup: fn()}; }); },
    useSyncExternalStore(_subscribe: any, snapshot: () => any) { cursor++; return snapshot(); },
  };
  const load = (path: string): any => {
    const absolute = resolve(path); if (cache.has(absolute)) return cache.get(absolute);
    const actual = createRequire(absolute), module = {exports: {} as any};
    const req = (name: string): any => name === 'react' ? hooks : name.endsWith('/usePublicIdentitiesViewModel') ? {usePublicIdentitiesViewModel: () => ({})} : name.endsWith('/recommendationDependencies') ? {recommendationService: {user: async () => accountId, load: async () => ({candidates: [], limited: false, scanned: 0})}} : name.endsWith('/manualSearchDependencies') ? {manualSearchService: manualService} : name.endsWith('/gpsProximityDependencies') ? {gpsProximityDependencies: {user: async () => 'tenant', locate: async () => ({kind: 'denied'}), search: async () => [], settings: async () => {}}} : name.endsWith('/supabase/client') ? {getSupabaseClient: () => { throw Error('The Supabase client must not be reached from the Discovery hook in this test.'); }} : sharedStub(absolute, name) ?? (name.startsWith('.') ? load(resolve(absolute, '..', name.endsWith('.ts') ? name : name + '.ts')) : actual(name));
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
    new Function('require', 'module', 'exports', code)(req, module, module.exports); cache.set(absolute, module.exports); return module.exports;
  };
  const hook = load('src/features/search-discovery/viewModels/useSearchDiscoveryViewModel.ts').useSearchDiscoveryViewModel;
  const flush = () => { cursor = 0; current = hook(initialScreen, {accountId}); while (effects.length) effects.shift()!(); return current; };
  flush();
  return {vm: () => current, flush, unmount() { slots.forEach(slot => slot?.cleanup?.()); }};
}
const fromForYou = () => { const h = mount('home'); h.vm().openForYou(); h.flush(); h.vm().openMatchingPreferences(); h.flush(); assert.equal(h.vm().screen, 'matchingPreferences'); return h; };
const fromProfile = () => { const h = mount('matchingPreferences'); assert.equal(h.vm().screen, 'matchingPreferences'); return h; };
const closes = () => { let count = 0; return {fn: () => { count++; }, count: () => count}; };

test('the exit rule: first-run skips, a Profile-opened screen closes the flow, a For You-opened screen goes back one screen', () => {
  assert.equal(preferencesExit(true, 'workspace'), 'skip-introduction');
  assert.equal(preferencesExit(true, 'discover'), 'skip-introduction');
  assert.equal(preferencesExit(false, 'workspace'), 'close-workspace');
  assert.equal(preferencesExit(false, 'discover'), 'back-in-flow');
});

test('Close opened from For You returns to For You, not to Profile', () => {
  const h = fromForYou(), leave = closes();
  h.vm().closeFromWorkspace(leave.fn); h.flush();
  assert.equal(h.vm().screen, 'home'); assert.equal(h.vm().homeTab, 'forYou'); assert.equal(leave.count(), 0, 'the flow was not closed, so the app did not go to Profile');
  h.unmount();
});

test('Close opened from Profile returns to Profile (closes the Discovery flow)', () => {
  const h = fromProfile(), leave = closes();
  h.vm().closeFromWorkspace(leave.fn); h.flush();
  assert.equal(leave.count(), 1);
  h.unmount();
});

test('hardware Back does the same from each origin', () => {
  const forYou = fromForYou(), a = closes(), b = closes();
  forYou.vm().backFromWorkspace(a.fn, () => assert.fail('must not exit the app')); forYou.flush();
  assert.equal(forYou.vm().screen, 'home'); assert.equal(forYou.vm().homeTab, 'forYou'); assert.equal(a.count(), 0);
  const profile = fromProfile();
  profile.vm().backFromWorkspace(b.fn, () => assert.fail('must not exit the app')); profile.flush();
  assert.equal(b.count(), 1);
  forYou.unmount(); profile.unmount();
});

for (const origin of ['For You', 'Profile'] as const) test(`Discard your changes from ${origin}: Keep editing stays, Discard changes goes to the origin`, () => {
  const h = origin === 'For You' ? fromForYou() : fromProfile(), leave = closes();
  h.vm().updateMatchingPreference('minimumBedrooms', 4); h.flush();
  h.vm().closeFromWorkspace(leave.fn); h.flush();
  assert.equal(h.vm().navigationConfirmation, true, 'the discard sheet is asked for');
  assert.equal(h.vm().screen, 'matchingPreferences'); assert.equal(leave.count(), 0);
  h.vm().cancelNavigation(); h.flush();
  assert.equal(h.vm().navigationConfirmation, false); assert.equal(h.vm().screen, 'matchingPreferences', 'Keep editing stays'); assert.equal(h.vm().matchingPreferences.minimumBedrooms, 4, 'the edit is kept');
  h.vm().closeFromWorkspace(leave.fn); h.flush(); h.vm().confirmNavigation(); h.flush();
  if (origin === 'For You') { assert.equal(h.vm().screen, 'home'); assert.equal(h.vm().homeTab, 'forYou'); assert.equal(leave.count(), 0); assert.notEqual(h.vm().matchingPreferences.minimumBedrooms, 4, 'discarded'); }
  else assert.equal(leave.count(), 1);
  h.unmount();
});

test('after a Profile-opened visit ends inside the flow, opening it again from For You still returns to For You', () => {
  const h = fromProfile(), leave = closes();
  h.vm().goBack(); h.flush(); assert.equal(h.vm().screen, 'home');
  h.vm().openForYou(); h.flush(); h.vm().openMatchingPreferences(); h.flush();
  h.vm().closeFromWorkspace(leave.fn); h.flush();
  assert.equal(h.vm().screen, 'home'); assert.equal(leave.count(), 0);
  h.unmount();
});
