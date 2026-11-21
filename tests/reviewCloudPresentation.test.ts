/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { codePointLength, codePointToIndex, highlightSegments, type CloudTerm, type ReviewCloud, type ReviewCorpus } from '../src/shared/models/ReviewWordCloud';
import { CLOUD_EMPTY_COPY, CLOUD_FADED, CLOUD_SELECTED, CLOUD_SIZE_STEPS, MATCH_PREVIEW, cloudChips, cloudColorTokens, cloudErrorCopy, cloudErrorKindForStatus, cloudTermColor, cloudTermFontSize, cloudTermTint, cloudTints, cloudView, highlightForReview, matchHeading, matchingReviews, nextSelection, showMoreLabel } from '../src/shared/models/reviewCloudPresentation';
import { sharedStub } from './support/sharedStubs';
import { CloudCallError } from '../src/shared/services/reviewWordCloudService';
import { createReviewWordCloudWorkflow, type CloudCacheEntry } from '../src/shared/viewModels/reviewWordCloudWorkflow';
import { colors } from '../src/shared/theme/colors';
import { ui } from '../src/shared/theme/ui';

const joined = (parts: { text: string }[]) => parts.map(p => p.text).join('');
const marked = (parts: { text: string; marked: boolean }[]) => parts.filter(p => p.marked).map(p => p.text);

// ---- code point offsets -> JS string indices ----
test('code point to string index: plain text is the identity; an emoji is one code point but two string units', () => {
  assert.equal(codePointToIndex('hello', 3), 3);
  const text = '😀 clean';   // the emoji is 2 UTF-16 units
  assert.equal(codePointToIndex(text, 0), 0); assert.equal(codePointToIndex(text, 1), 2); assert.equal(codePointToIndex(text, 2), 3); assert.equal(codePointToIndex(text, 7), text.length);
  assert.equal(text.slice(codePointToIndex(text, 2), codePointToIndex(text, 7)), 'clean'); assert.notEqual(text.slice(2, 7), 'clean', 'slicing with the raw numbers is wrong');
  assert.equal(codePointLength(text), 7); assert.equal(text.length, 8);
});
test('code point to string index: accents (precomposed or letter plus combining mark), several emoji and bad input', () => {
  const precomposed = 'café ok', combining = 'café ok';   // 7 vs 8 code points, the same on screen
  assert.equal(codePointLength(precomposed), 7); assert.equal(codePointLength(combining), 8);
  assert.equal(combining.slice(0, codePointToIndex(combining, 5)), 'café', 'the combining mark is its own code point');
  assert.equal(codePointToIndex(combining, 4), 4);
  const many = '🏠🏠 near 🚌'; assert.equal(codePointToIndex(many, 2), 4); assert.equal(many.slice(codePointToIndex(many, 8), codePointToIndex(many, 9)), '🚌');
  for (const bad of [-1, 0, Number.NaN, 1.5, Infinity]) assert.equal(codePointToIndex('abc', bad as number), 0, String(bad));
  assert.equal(codePointToIndex('abc', 99), 3, 'beyond the end is the end');
});
test('highlight: spans are code points, so emoji and accents before the term do not shift it', () => {
  const text = '😀 Café room is clean 🎉 and quiet';
  const clean = highlightSegments(text, [{ start: 16, end: 21 }]);   // "clean" by code point
  assert.deepEqual(marked(clean), ['clean']); assert.equal(joined(clean), text);
  const accent = highlightSegments(text, [{ start: 2, end: 7 }]); assert.deepEqual(marked(accent), ['Café'], 'the accent stays with its letter');
  const quiet = highlightSegments(text, [{ start: 28, end: 33 }]); assert.deepEqual(marked(quiet), ['quiet']); assert.equal(joined(quiet), text);
});
test('highlight: a two-word phrase span covers the words between them exactly as given (removed filler words included)', () => {
  const text = 'Room was very clean and bright';   // the term "room clean": the span covers "Room was very clean"
  const phrase = highlightSegments(text, [{ start: 0, end: 19 }]); assert.deepEqual(marked(phrase), ['Room was very clean']); assert.equal(joined(phrase), text);
  const two = highlightSegments(text, [{ start: 0, end: 4 }, { start: 14, end: 19 }]); assert.deepEqual(marked(two), ['Room', 'clean']);   // two separate spans of one term
  assert.deepEqual(highlightSegments(text, [{ start: 0, end: 19 }]).map(p => p.marked), [true, false]);
});
test('highlight: overlapping, duplicate, reversed, empty, out-of-range, non-integer and non-object spans are ignored and never crash; the text always joins back', () => {
  const text = 'near the mall, near the school';
  const spans: any[] = [{ start: 0, end: 4 }, { start: 0, end: 4 }, { start: 2, end: 8 }, { start: 9, end: 13 }, { start: 5, end: 5 }, { start: 9, end: 3 }, { start: -2, end: 4 }, { start: 0, end: 999 }, { start: 1.5, end: 3 }, { start: '1', end: 3 }, { start: 5 }, null, undefined, 'x', 7];
  const parts = highlightSegments(text, spans);
  assert.equal(joined(parts), text); assert.deepEqual(marked(parts), ['near', 'mall']);
  assert.equal(joined(highlightSegments(text, null as any)), text); assert.deepEqual(highlightSegments('', [{ start: 0, end: 1 }]), []); assert.deepEqual(marked(highlightSegments(text, [])), []);
  assert.deepEqual(marked(highlightSegments('😀😀', [{ start: 1, end: 2 }])), ['😀']); assert.equal(joined(highlightSegments('😀😀', [{ start: 1, end: 2 }])), '😀😀');
});

// ---- error and state mapping ----
test('failures map to a plain kind by HTTP status; no status means the network; no raw text is ever the message', () => {
  const kinds: [number | null, string][] = [[null, 'network'], [401, 'auth'], [403, 'auth'], [429, 'busy'], [400, 'invalid'], [422, 'invalid'], [404, 'unavailable'], [409, 'unavailable'], [413, 'unavailable'], [500, 'unavailable'], [502, 'unavailable'], [503, 'unavailable'], [504, 'unavailable'], [418, 'generic']];
  for (const [status, kind] of kinds) assert.equal(cloudErrorKindForStatus(status), kind, String(status));
  for (const copy of Object.values(cloudErrorCopy)) assert.ok(copy.length > 20 && !/\b(error|exception|undefined|null|http|\d{3})\b/i.test(copy), copy);
  assert.equal(new CloudCallError('busy', 429).message, cloudErrorCopy.busy);
});
const term = (over: Partial<CloudTerm> = {}): CloudTerm => ({ id: 't-' + 'a'.repeat(64), text: 'clean', review_count: 2, color: 'green', font_size_rem: 1.5, matches: [{ id: 'r1', spans: [{ start: 0, end: 5 }] }], ...over });
const cloudOf = (terms: CloudTerm[], status: ReviewCloud['status'] = 'ready'): ReviewCloud => ({ status, terms });
test('card state: loading, friendly empty copy, plain error, ready; signed out and anything unexpected show nothing', () => {
  const ready = cloudOf([term()]);
  assert.deepEqual(cloudView({ signedIn: false, status: 'ready', cloud: ready, errorKind: null }), { kind: 'hidden' });
  assert.deepEqual(cloudView({ signedIn: true, status: 'idle', cloud: null, errorKind: null }), { kind: 'loading' }); assert.deepEqual(cloudView({ signedIn: true, status: 'loading', cloud: null, errorKind: null }), { kind: 'loading' });
  assert.deepEqual(cloudView({ signedIn: true, status: 'ready', cloud: ready, errorKind: null }), { kind: 'ready' });
  for (const status of ['insufficient_data', 'empty'] as const) assert.deepEqual(cloudView({ signedIn: true, status: 'ready', cloud: cloudOf([], status), errorKind: null }), { kind: 'notice', message: 'The word cloud appears once 2 or more reviews share words.' });
  assert.equal(CLOUD_EMPTY_COPY, 'The word cloud appears once 2 or more reviews share words.');
  assert.deepEqual(cloudView({ signedIn: true, status: 'ready', cloud: cloudOf([], 'ready'), errorKind: null }), { kind: 'notice', message: CLOUD_EMPTY_COPY }, 'ready with no terms is still the friendly empty state');
  for (const kind of Object.keys(cloudErrorCopy) as (keyof typeof cloudErrorCopy)[]) assert.deepEqual(cloudView({ signedIn: true, status: 'error', cloud: null, errorKind: kind }), { kind: 'error', message: cloudErrorCopy[kind] });
  assert.deepEqual(cloudView({ signedIn: true, status: 'error', cloud: null, errorKind: null }), { kind: 'error', message: cloudErrorCopy.generic });
  for (const status of ['unavailable', 'success', 'weird']) assert.deepEqual(cloudView({ signedIn: true, status, cloud: null, errorKind: null }), { kind: 'hidden' }, status);
  assert.deepEqual(cloudView({ signedIn: true, status: 'ready', cloud: null, errorKind: null }), { kind: 'hidden' });
});

// ---- chips: size and color from the theme ----
test('word size: four fixed steps from the service size, never larger than the page title, never smaller than the body', () => {
  assert.deepEqual([...CLOUD_SIZE_STEPS], [ui.body.fontSize, ui.sectionTitle.fontSize, 20, ui.pageTitle.fontSize]);
  assert.deepEqual([1, 1.29].map(cloudTermFontSize), [15, 15]); assert.deepEqual([1.3, 1.64].map(cloudTermFontSize), [17, 17]); assert.deepEqual([1.65, 1.99].map(cloudTermFontSize), [20, 20]); assert.deepEqual([2, 2.3].map(cloudTermFontSize), [22, 22]);
  assert.equal(cloudTermFontSize(50), 22, 'never larger than the page title'); assert.equal(cloudTermFontSize(Number.NaN), 15); assert.equal(cloudTermFontSize(-3), 15);
  assert.equal(new Set([1, 1.4, 1.8, 2.3].map(cloudTermFontSize)).size, 4, 'all four steps are used across the service range');
  let last = 0; for (const rem of [1, 1.2, 1.4, 1.6, 1.8, 2, 2.3]) { const size = cloudTermFontSize(rem); assert.ok(size >= last, `${rem} does not shrink`); last = size; }
});
// Contrast (WCAG): the ratio of two sRGB hex colors.
const lum = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
const hueOf = (hex: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number], max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; if (d < 0.04) return null; const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
test('the five service color names map to soft tints from existing theme tokens; an unknown name falls back to a neutral tint; no hex values live in the presentation code', () => {
  for (const name of ['blue', 'green', 'orange', 'purple', 'pink'] as const) {
    const tint = cloudTints[name]; for (const value of Object.values(tint)) assert.ok(Object.values(colors).includes(value as never), `${name}: ${value} is a theme token`);
    assert.deepEqual(cloudTermTint(name), tint); assert.equal(cloudTermColor(name), tint.text); assert.equal(cloudColorTokens[name], tint.text);
  }
  assert.deepEqual(cloudTermTint('chartreuse'), cloudTints.purple); assert.deepEqual(cloudTermTint(undefined), cloudTints.purple); assert.deepEqual(cloudTermTint('constructor'), cloudTints.purple);
  assert.doesNotMatch(readFileSync('src/shared/models/reviewCloudPresentation.ts', 'utf8'), /#[0-9a-fA-F]{3,8}/, 'no hard-coded colors');
});
test('no tint is red or amber (those read as warnings), and every word is readable on its tint, faded or selected (4.5:1 or better)', () => {
  for (const [name, tint] of [...Object.entries(cloudTints), ['faded', CLOUD_FADED], ['selected', CLOUD_SELECTED]] as [string, typeof CLOUD_FADED][]) {
    assert.ok(contrast(tint.text, tint.background) >= 4.5, `${name}: ${contrast(tint.text, tint.background).toFixed(2)}:1`);
    for (const value of [tint.background, tint.text, tint.border]) { const hue = hueOf(value); assert.ok(hue === null || hue >= 80, `${name}: ${value} has hue ${hue} (red and amber are 0 to 70)`); }
  }
  assert.ok(contrast(CLOUD_SELECTED.text, CLOUD_SELECTED.background) >= 7, 'the selected word is dark with light text');
});
test('chips carry the term text, a plain accessibility label with the review count, and their size and color', () => {
  const chips = cloudChips(cloudOf([term({ review_count: 1, font_size_rem: 2.2, color: 'blue' }), term({ id: 't-' + 'b'.repeat(64), text: 'room clean', review_count: 5, color: 'pink', font_size_rem: 1.4 })]));
  assert.deepEqual(chips.map(c => [c.text, c.fontSize, c.accessibilityLabel]), [['clean', 22, 'clean, in 1 review'], ['room clean', 17, 'room clean, in 5 reviews']]); assert.equal(chips[0]!.color, cloudTints.blue.text); assert.deepEqual(chips[0]!.tint, cloudTints.blue); assert.deepEqual(cloudChips(null), []);
});

// ---- matching reviews and highlighting elsewhere ----
const row = (id: string, text: string | null, revision = 'v') => ({ id, kind: 'property', status: 'approved', propertyId: 'p', text, revision, rating: 4, createdAt: 'now', updatedAt: null, moderatedAt: null, history: [] }) as unknown as ReviewCorpus['rows'][number];
const corpus: ReviewCorpus = { propertyId: 'p', count: 3, version: 'v', rows: [row('r1', '😀 Room was very clean'), row('r2', 'Quiet street'), row('r3', null)] };
test('matching reviews: only reviews that contain the term, in corpus order, with code point spans converted; a rating-only review is skipped', () => {
  const t = term({ text: 'room clean', matches: [{ id: 'r3', spans: [{ start: 0, end: 4 }] }, { id: 'r1', spans: [{ start: 2, end: 21 }] }] });
  const out = matchingReviews(corpus, t); assert.deepEqual(out.map(r => r.id), ['r1']); assert.deepEqual(marked(out[0]!.segments), ['Room was very clean']); assert.equal(joined(out[0]!.segments), '😀 Room was very clean');
  assert.deepEqual(matchingReviews(null, t), []); assert.deepEqual(matchingReviews(corpus, null), []);
});
test('highlight in another list: only when the shown text is exactly the analysed text, otherwise nothing is marked', () => {
  const t = term({ matches: [{ id: 'r2', spans: [{ start: 0, end: 5 }] }] });
  assert.deepEqual(marked(highlightForReview(corpus, t, 'r2', 'Quiet street')!), ['Quiet']);
  assert.equal(highlightForReview(corpus, t, 'r2', 'Quiet street!'), null, 'the text changed since it was analysed'); assert.equal(highlightForReview(corpus, t, 'r1', '😀 Room was very clean'), null, 'no match for this review');
  assert.equal(highlightForReview(corpus, null, 'r2', 'Quiet street'), null); assert.equal(highlightForReview(corpus, t, 'r2', null), null); assert.equal(highlightForReview(corpus, t, 'missing', 'Quiet street'), null);
});
test('selection: tap a term to select it, tap it again to clear it, tap another to change it', () => {
  assert.equal(nextSelection(null, 'a'), 'a'); assert.equal(nextSelection('a', 'a'), null); assert.equal(nextSelection('a', 'b'), 'b'); assert.equal(nextSelection('a', null), null);
});

// ---- the workflow: loads once, caches, local selection, busy retry, timeout, plain errors ----
const id = (c: string) => 't-' + c.repeat(64);
const goodCorpus: ReviewCorpus = { propertyId: 'p', count: 2, version: 'v1', rows: [row('r1', 'Room was very clean'), row('r2', 'Clean room')] };
const raw = (terms: unknown[], status = 'ready') => ({ property_id: 'p', corpus_version: 'v1', eligible_review_count: 2, synthetic: false, span_encoding: 'unicode_code_points', status, terms });
const rawTerm = (c: string, text: string) => ({ id: id(c), text, review_count: 2, color: 'blue', font_size_rem: 1.4, matches: [{ id: 'r1', spans: [{ start: 0, end: 4 }] }, { id: 'r2', spans: [{ start: 6, end: 10 }] }] });
function cache() { let entry: CloudCacheEntry | undefined; return { get: () => entry, set: (e: CloudCacheEntry) => { entry = e; }, peek: () => entry }; }
function flow(options: { process?: (c: ReviewCorpus, s: AbortSignal) => Promise<unknown>; timeoutMs?: number; cache?: ReturnType<typeof cache> } = {}) {
  const calls = { read: 0, process: 0, waits: [] as number[] };
  const workflow = createReviewWordCloudWorkflow(async () => { calls.read++; return goodCorpus; }, async (c, s) => { calls.process++; return (options.process ?? (async () => raw([rawTerm('a', 'clean'), rawTerm('b', 'room')])))(c, s); },
    { ...(options.cache ? { cache: options.cache } : {}), timeoutMs: options.timeoutMs ?? 60000, busyRetryMs: 7, wait: async ms => { calls.waits.push(ms); } });
  return { workflow, calls };
}
test('workflow: loads and is ready with terms; the empty statuses stay ready with no terms (the card shows the friendly copy)', async () => {
  const f = flow(); await f.workflow.load(); const s = f.workflow.getSnapshot(); assert.equal(s.status, 'ready'); assert.equal(s.cloud?.terms.length, 2); assert.equal(s.error, null);
  const none = flow({ process: async () => raw([], 'insufficient_data') }); await none.workflow.load(); assert.equal(none.workflow.getSnapshot().status, 'ready'); assert.equal(none.workflow.getSnapshot().cloud?.status, 'insufficient_data');
});
test('workflow: loaded once per property view and kept for the session; a second view of the same property makes no request', async () => {
  const shared = cache(), first = flow({ cache: shared }); await first.workflow.ensure(); assert.equal(first.calls.process, 1); assert.ok(shared.peek());
  const readsAfterFirst = first.calls.read; await first.workflow.ensure(); await first.workflow.ensure(); assert.equal(first.calls.process, 1, 'ensure does not ask again'); assert.equal(first.calls.read, readsAfterFirst);
  const second = flow({ cache: shared }); await second.workflow.ensure(); assert.equal(second.workflow.getSnapshot().status, 'ready'); assert.equal(second.calls.read, 0); assert.equal(second.calls.process, 0, 'served from the session cache');
  await second.workflow.load(); assert.equal(second.calls.process, 1, 'an explicit retry does ask again');
});
test('workflow: choosing a term is local (no request), choosing it again clears it, another replaces it, and a retry keeps a still-valid choice', async () => {
  const f = flow(); await f.workflow.load(); const reads = f.calls.read, processed = f.calls.process;
  f.workflow.select(id('a')); assert.equal(f.workflow.getSnapshot().selected, id('a')); f.workflow.select(id('b')); assert.equal(f.workflow.getSnapshot().selected, id('b'));
  f.workflow.select(id('b')); assert.equal(f.workflow.getSnapshot().selected, null); f.workflow.select(id('zzz')); assert.equal(f.workflow.getSnapshot().selected, null, 'an unknown term cannot be selected');
  f.workflow.select(id('a')); assert.equal(f.calls.read, reads); assert.equal(f.calls.process, processed, 'no request for any selection');
  await f.workflow.load(); assert.equal(f.workflow.getSnapshot().selected, id('a'));
});
test('workflow: "busy" is retried once automatically after a short wait; a second "busy" becomes the plain busy message', async () => {
  let n = 0; const ok = flow({ process: async () => { if (++n === 1) throw new CloudCallError('busy', 429); return raw([rawTerm('a', 'clean')]); } });
  await ok.workflow.load(); assert.equal(ok.workflow.getSnapshot().status, 'ready'); assert.equal(ok.calls.process, 2); assert.deepEqual(ok.calls.waits, [7]);
  const never = flow({ process: async () => { throw new CloudCallError('busy', 429); } }); await never.workflow.load();
  const s = never.workflow.getSnapshot(); assert.equal(s.status, 'error'); assert.equal(s.errorKind, 'busy'); assert.equal(s.error, cloudErrorCopy.busy); assert.equal(never.calls.process, 2, 'exactly one automatic retry');
  const other = flow({ process: async () => { throw new CloudCallError('unavailable', 503); } }); await other.workflow.load(); assert.equal(other.calls.process, 1, 'only "busy" is retried');
});
test('workflow: every failure ends as a plain message, never the raw error text; a retry after an error can succeed', async () => {
  for (const kind of ['network', 'auth', 'unavailable', 'invalid'] as const) {
    const f = flow({ process: async () => { throw new CloudCallError(kind, kind === 'network' ? null : 503); } }); await f.workflow.load(); const s = f.workflow.getSnapshot();
    assert.equal(s.status, 'error'); assert.equal(s.error, cloudErrorCopy[kind]); assert.equal(s.corpus, null, 'no review text is kept on failure');
  }
  const raw500 = flow({ process: async () => { throw new Error('boom: SELECT * FROM secret_table'); } }); await raw500.workflow.load(); assert.equal(raw500.workflow.getSnapshot().error, cloudErrorCopy.generic); assert.ok(!String(raw500.workflow.getSnapshot().error).includes('boom'));
  const bad = flow({ process: async () => ({ not: 'a cloud' }) }); await bad.workflow.load(); assert.equal(bad.workflow.getSnapshot().status, 'error'); assert.equal(bad.workflow.getSnapshot().error, cloudErrorCopy.generic);
  let fail = true; const again = flow({ process: async () => { if (fail) throw new CloudCallError('network'); return raw([rawTerm('a', 'clean')]); } }); await again.workflow.load(); fail = false; await again.workflow.load(); assert.equal(again.workflow.getSnapshot().status, 'ready');
});
test('workflow: a slow request stays "loading" (not an error) until the time limit, then becomes the plain timeout message with Retry', async () => {
  let release: () => void = () => {}; const slow = flow({ timeoutMs: 40, process: () => new Promise((resolve) => { release = () => resolve(raw([])); }) });
  const pending = slow.workflow.load(); assert.equal(slow.workflow.getSnapshot().status, 'loading'); await new Promise(r => setTimeout(r, 10)); assert.equal(slow.workflow.getSnapshot().status, 'loading', 'still waiting, calmly');
  await pending; const s = slow.workflow.getSnapshot(); assert.equal(s.status, 'error'); assert.equal(s.errorKind, 'timeout'); assert.equal(s.error, cloudErrorCopy.timeout); release();
  assert.equal(readFileSync('src/shared/viewModels/reviewWordCloudWorkflow.ts', 'utf8').includes('timeoutMs??60000'), true, 'the default limit is 60 seconds');
});
test('hook: nothing refreshes on a timer or when the app returns to the foreground, and nothing is logged', () => {
  // Source check (the only way to observe "no polling" without running React): the hook has no interval and no app-state listener, and neither file logs.
  const hook = readFileSync('src/shared/viewModels/useReviewWordCloud.ts', 'utf8'), workflow = readFileSync('src/shared/viewModels/reviewWordCloudWorkflow.ts', 'utf8'), service = readFileSync('src/shared/services/reviewWordCloudService.ts', 'utf8');
  assert.doesNotMatch(hook, /setInterval|AppState/); for (const source of [hook, workflow, service]) assert.doesNotMatch(source, /console\.|\.log\(/);
});
// ---- the card (a dumb view) ----
// ReviewWordCloudCard is loaded for real with stand-in children (icons, stars, highlighted text and buttons are tags named after themselves). Its own function components (Pill, Matches)
// are expanded, and useState keeps its value between renders, so "Show N more" can be pressed and the card rendered again.
const window = { width: 411, fontScale: 1 };
function cardHarness() {
  const slots: any[] = []; let cursor = 0; const mod = { exports: {} as any };
  const jsx = (type: any, props: any, key?: any) => ({ type, props, key });
  const mock = (key: string): any => {
    if (key === 'react') return { useState: (initial: any) => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (next: any) => { slots[i] = next; }]; } };
    if (key === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (key === 'react-native') return { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', StyleSheet: { create: (x: any) => x }, Text: 'Text', View: 'View', useWindowDimensions: () => window };
    if (key.endsWith('/AppButton')) return { AppButton: 'Button' };
    if (key.endsWith('/HighlightedText')) return { HighlightedText: 'HighlightedText' };
    if (key.endsWith('/ReviewParts')) return { StarRow: 'StarRow' };
    if (key.endsWith('/ReviewCloudIcons')) return { CheckIcon: 'CheckIcon', CloseIcon: 'CloseIcon', ChatIcon: 'ChatIcon', OfflineIcon: 'OfflineIcon' };
    if (key.endsWith('/reviewCloudPresentation')) return require('../src/shared/models/reviewCloudPresentation');
    if (/\/theme\/(colors|radius|spacing|typography|ui)$/.test(key)) return require('../src/shared/theme/' + key.split('/').pop());
    throw new Error('unexpected import ' + key);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync('src/shared/components/ReviewWordCloudCard.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(mock, mod, mod.exports);
  const expand = (n: any): any => Array.isArray(n) ? n.map(expand) : !n || typeof n !== 'object' ? n : typeof n.type === 'function' ? { ...expand(n.type(n.props)), key: n.key } : { ...n, props: { ...n.props, children: expand(n.props?.children) } };
  return (props: any) => { cursor = 0; return expand(mod.exports.ReviewWordCloudCard(props)); };
}
const all = (n: any): any[] => Array.isArray(n) ? n.flatMap(all) : n && typeof n === 'object' ? [n, ...all(n.props?.children)] : [];
const texts = (n: any) => all(n).filter(x => x.type === 'Text').map(x => [x.props.children].flat(Infinity).join(''));
const style = (n: any) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
const pressables = (n: any, label?: string) => all(n).filter(x => x.type === 'Pressable' && (!label || x.props.accessibilityLabel === label));
const pillView = (pressable: any) => all(pressable).find(x => x.type === 'View' && style(x).borderRadius !== undefined);
const idB = id('b');
const chipsOf = () => cloudChips(cloudOf([term({ font_size_rem: 2.2, review_count: 7, text: 'wifi' }), term({ id: idB, text: 'room clean', review_count: 5, color: 'blue', font_size_rem: 1 })]));
const props = (over: any = {}) => ({ view: { kind: 'ready' }, chips: chipsOf(), selectedId: null, matching: [], reviewCount: 18, onSelect() {}, onClear() {}, onRetry() {}, ...over });
const shown = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'm' + i, text: 'Nice wifi', segments: [{ text: 'Nice ', marked: false }, { text: 'wifi', marked: true }], stars: 5 - (i % 2), meta: 'Tenant · Sep 2026' }));
const moreButtons = (n: any) => texts(n).filter(t => /^Show \d+ more$/.test(t));

test('card: hidden shows nothing', () => { assert.equal(cardHarness()(props({ view: { kind: 'hidden' } })), null); });
test('card, loading: a spinner, "The first time can take up to a minute", six skeleton pills, no error styling and no button', () => {
  const tree = cardHarness()(props({ view: { kind: 'loading' } })), t = texts(tree);
  assert.ok(all(tree).some(n => n.type === 'ActivityIndicator')); assert.ok(t.includes('Finding the words tenants wrote…')); assert.ok(t.includes('The first time can take up to a minute. You can keep reading.'));
  const skeletons = all(tree).filter(n => n.type === 'View' && style(n).height === 40 && style(n).width > 0); assert.equal(skeletons.length, 6);
  assert.equal(pressables(tree).length, 0); assert.equal(all(tree).filter(n => n.type === 'Button').length, 0); assert.ok(!all(tree).some(n => n.props?.accessibilityRole === 'alert'));
  assert.ok(all(tree).some(n => n.props?.accessible === false && n.props.importantForAccessibility === 'no-hide-descendants' && all(n).filter(x => style(x).height === 40).length === 6), 'the placeholders are hidden from screen readers');
});
test('card, not enough shared words: a note card with the title and the sentence, an icon, and nothing to press', () => {
  const tree = cardHarness()(props({ view: { kind: 'notice', message: CLOUD_EMPTY_COPY } })), t = texts(tree);
  assert.ok(t.includes('What tenants wrote') && t.includes('The word cloud appears once 2 or more reviews share words.')); assert.ok(all(tree).some(n => n.type === 'ChatIcon')); assert.equal(pressables(tree).length, 0);
});
test('card, could not load: the title, the plain message as an alert, an icon and one Try again button that calls retry', () => {
  let retried = 0; const tree = cardHarness()(props({ view: { kind: 'error', message: cloudErrorCopy.network }, onRetry: () => { retried++; } })), t = texts(tree);
  assert.ok(t.includes('Couldn’t load what tenants wrote') && t.includes('Check your connection and try again.')); assert.ok(all(tree).some(n => n.props?.accessibilityRole === 'alert' && texts(n).includes(cloudErrorCopy.network))); assert.ok(all(tree).some(n => n.type === 'OfflineIcon'));
  const buttons = all(tree).filter(n => n.type === 'Button'); assert.deepEqual(buttons.map(b => b.props.label), ['Try again']); buttons[0].props.onPress(); assert.equal(retried, 1);
});
test('card, ready: the title and hint, then a pill per word with its count; every pill has a 48dp touch area, can wrap, and tapping selects', () => {
  const picked: string[] = []; const tree = cardHarness()(props({ onSelect: (x: string) => picked.push(x) })), t = texts(tree);
  assert.ok(t.includes('What tenants wrote') && t.includes('Tap a word to see the reviews that use it.'));
  const pills = pressables(tree); assert.equal(pills.length, 2);
  for (const pill of pills) { assert.equal(pill.props.accessibilityRole, 'button'); const s = style(pill); assert.ok(s.minHeight >= 48 && s.minWidth >= 48, 'a 48dp touch area even when the pill looks smaller'); assert.equal(s.maxWidth, '100%'); assert.equal(s.flexShrink, 1); }
  assert.deepEqual(texts(pills[0]), ['wifi', '7']); assert.deepEqual(texts(pills[1]), ['room clean', '5']); assert.equal(pills[0].props.accessibilityLabel, 'wifi, in 7 reviews');
  assert.equal(style(all(pills[0]).find(n => n.type === 'Text' && n.props.children === 'wifi')).fontSize, 22); assert.equal(style(all(pills[1]).find(n => n.type === 'Text' && n.props.children === 'room clean')).fontSize, 15);
  assert.equal(style(pillView(pills[0])).backgroundColor, cloudTints.green.background); assert.equal(style(pillView(pills[1])).backgroundColor, cloudTints.blue.background);
  pills[0].props.onPress(); assert.deepEqual(picked, [term().id]); assert.ok(!all(tree).some(n => n.type === 'CheckIcon'), 'nothing is selected, so no check');
});
test('card, selected: a dark pill with a check; the others fade but keep readable text; tapping it again clears; tapping another changes', () => {
  const picked: string[] = []; let cleared = 0; const tree = cardHarness()(props({ selectedId: term().id, matching: shown(1), onSelect: (x: string) => picked.push(x), onClear: () => { cleared++; } }));
  const [on, off] = pressables(tree).slice(0, 2) as [any, any];
  assert.equal(on.props.accessibilityState.selected, true); assert.equal(off.props.accessibilityState.selected, false);
  assert.equal(style(pillView(on)).backgroundColor, colors.ink); assert.ok(all(on).some(n => n.type === 'CheckIcon'), 'the check, so selection does not rely on colour'); assert.ok(!all(off).some(n => n.type === 'CheckIcon'));
  const faded = all(off).find(n => n.type === 'Text' && n.props.children === 'room clean'); assert.equal(style(faded).color, CLOUD_FADED.text); assert.equal(style(pillView(off)).backgroundColor, CLOUD_FADED.background);
  assert.ok(contrast(style(faded).color, style(pillView(off)).backgroundColor) >= 4.5, 'faded text stays readable');
  on.props.onPress(); assert.equal(cleared, 1); off.props.onPress(); assert.deepEqual(picked, [idB]);
});
test('card, selected: "N of M reviews mention “word”", Clear, and the matching reviews with the word highlighted, stars and role · month, under the cloud', () => {
  let cleared = 0; const tree = cardHarness()(props({ selectedId: term().id, matching: shown(2), onClear: () => { cleared++; } })), t = texts(tree);
  assert.ok(t.includes('2 of 18 reviews mention “wifi”')); assert.ok(t.includes('Tenant · Sep 2026'));
  const clear = pressables(tree, 'Clear')[0]; assert.ok(clear && style(clear).minHeight >= 48); assert.ok(all(clear).some(n => n.type === 'CloseIcon')); clear.props.onPress(); assert.equal(cleared, 1);
  const highlighted = all(tree).filter(n => n.type === 'HighlightedText'); assert.equal(highlighted.length, 2); assert.deepEqual(marked(highlighted[0].props.segments), ['wifi']); assert.deepEqual(all(tree).filter(n => n.type === 'StarRow').map(n => n.props.filled), [5, 4]);
  const order = all(tree).map(n => n.type), lastPill = order.indexOf('Pressable', 0) >= 0 ? all(tree).findIndex(n => n === pressables(tree)[1]) : -1;
  assert.ok(lastPill >= 0 && lastPill < order.indexOf('HighlightedText'), 'the reviews come after the pills'); assert.equal(moreButtons(tree).length, 0, 'two matches need no Show more');
  assert.equal(matchHeading(1, 1, 'wifi'), '1 of 1 review mentions “wifi”'); assert.equal(matchHeading(1, 18, 'wifi'), '1 of 18 reviews mention “wifi”'); assert.equal(matchHeading(3, 0, 'x'), '3 of 3 reviews mention “x”', 'never says fewer reviews than it shows');
});
test('card, selected: only the first two matching reviews show, then "Show N more" shows the rest; a new word starts closed again', () => {
  const render = cardHarness(), base = { selectedId: term().id, matching: shown(5) };
  let tree = render(props(base)); assert.equal(MATCH_PREVIEW, 2); assert.equal(all(tree).filter(n => n.type === 'HighlightedText').length, 2);
  const more = pressables(tree).find(n => texts(n).includes('Show 3 more'))!; assert.ok(more && style(more).minHeight >= 48); assert.equal(showMoreLabel(3), 'Show 3 more');
  more.props.onPress(); tree = render(props(base)); assert.equal(all(tree).filter(n => n.type === 'HighlightedText').length, 5); assert.equal(moreButtons(tree).length, 0);
  const keyOf = (id: string) => all(cardHarness()(props({ ...base, selectedId: id }))).filter(n => n.key === term().id || n.key === idB).at(-1)?.key;   // the pills are keyed by word too; the last such node is the matching-reviews block
  assert.equal(keyOf(term().id), term().id); assert.equal(keyOf(idB), idB, 'the matching reviews are keyed by the word, so Show more resets for a new word');
});
test('highlight: spans are code points, so an emoji, accents and a combining mark before the word do not shift it; the parts join back to the text', () => {
  const text = '😀 café wifi 😀 fast é wifi';   // 😀 is one code point (two UTF-16 units); cafe + U+0301 is two code points for the accented letter
  const t = term({ text: 'wifi', matches: [{ id: 'r1', spans: [{ start: 8, end: 12 }, { start: 15, end: 19 }, { start: 22, end: 26 }] }] });
  const c: ReviewCorpus = { propertyId: 'p', count: 1, version: 'v', rows: [row('r1', text)] }, parts = matchingReviews(c, t)[0]!.segments;
  assert.deepEqual(marked(parts), ['wifi', 'fast', 'wifi']); assert.equal(joined(parts), text);
  assert.notEqual(text.slice(8, 12), 'wifi', 'slicing with the raw numbers would land in the wrong place'); assert.equal(codePointLength(text), 26);
  assert.equal(matchingReviews(c, t)[0]!.stars, 4, 'the stars come from the review itself');
});

test('card, icon states: at large text or on a narrow screen the icon stacks above its copy; otherwise they sit side by side', () => {
  const rowOf = (view: any) => all(cardHarness()(props({ view }))).find(n => n.type === 'View' && [n.props.style].flat(Infinity).some((x: any) => x && x.flexDirection !== undefined && (x.flexDirection === 'row' || x.flexDirection === 'column')) && all(n).some(c => c.type === 'ChatIcon' || c.type === 'OfflineIcon'));
  const direction = (n: any) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean)).flexDirection;
  for (const view of [{ kind: 'notice', message: CLOUD_EMPTY_COPY }, { kind: 'error', message: cloudErrorCopy.network }]) {
    Object.assign(window, { width: 411, fontScale: 1 }); assert.equal(direction(rowOf(view)), 'row');
    Object.assign(window, { width: 411, fontScale: 1.5 }); assert.equal(direction(rowOf(view)), 'column');
    Object.assign(window, { width: 320, fontScale: 1 }); assert.equal(direction(rowOf(view)), 'column');
  }
  Object.assign(window, { width: 411, fontScale: 1 });
});
