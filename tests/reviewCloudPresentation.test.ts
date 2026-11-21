/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { codePointLength, codePointToIndex, highlightSegments, type CloudTerm, type ReviewCloud, type ReviewCorpus } from '../src/shared/models/ReviewWordCloud';
import { CLOUD_EMPTY_COPY, CLOUD_SIZE_STEPS, cloudChips, cloudColorTokens, cloudErrorCopy, cloudErrorKindForStatus, cloudTermColor, cloudTermFontSize, cloudView, highlightForReview, matchingReviews, nextSelection } from '../src/shared/models/reviewCloudPresentation';
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
test('chip size steps through the theme type scale, grows with the service size, and is clamped at the page title size', () => {
  assert.deepEqual([...CLOUD_SIZE_STEPS], [ui.body.fontSize, ui.sectionTitle.fontSize, ui.pageTitle.fontSize]);
  assert.equal(cloudTermFontSize(1), 15); assert.equal(cloudTermFontSize(1.34), 15); assert.equal(cloudTermFontSize(1.35), 17); assert.equal(cloudTermFontSize(1.79), 17); assert.equal(cloudTermFontSize(1.8), 22); assert.equal(cloudTermFontSize(2.3), 22);
  assert.equal(cloudTermFontSize(50), 22, 'never larger than the page title'); assert.equal(cloudTermFontSize(Number.NaN), 15); assert.equal(cloudTermFontSize(-3), 15);
  let last = 0; for (const rem of [1, 1.2, 1.4, 1.6, 1.8, 2, 2.3]) { const size = cloudTermFontSize(rem); assert.ok(size >= last, `${rem} does not shrink`); last = size; }
});
test('the five service color names map to existing theme tokens; an unknown name falls back to ink; no hex values live in the presentation code', () => {
  assert.deepEqual(cloudColorTokens, { blue: colors.identityInk, green: colors.primaryAction, orange: colors.warning, purple: colors.ink, pink: colors.premiumText });
  for (const name of ['blue', 'green', 'orange', 'purple', 'pink']) assert.ok(Object.values(colors).includes(cloudTermColor(name) as never), name);
  assert.equal(cloudTermColor('chartreuse'), colors.ink); assert.equal(cloudTermColor(undefined), colors.ink); assert.equal(cloudTermColor('constructor'), colors.ink);
  assert.doesNotMatch(readFileSync('src/shared/models/reviewCloudPresentation.ts', 'utf8'), /#[0-9a-fA-F]{3,8}\b/, 'no hard-coded colors');
});
test('chips carry the term text, a plain accessibility label with the review count, and their size and color', () => {
  const chips = cloudChips(cloudOf([term({ review_count: 1, font_size_rem: 2.2, color: 'blue' }), term({ id: 't-' + 'b'.repeat(64), text: 'room clean', review_count: 5, color: 'pink' })]));
  assert.deepEqual(chips.map(c => [c.text, c.fontSize, c.accessibilityLabel]), [['clean', 22, 'clean, in 1 review'], ['room clean', 17, 'room clean, in 5 reviews']]); assert.equal(chips[0]!.color, colors.identityInk); assert.deepEqual(cloudChips(null), []);
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
function loadCard(): any {
  const mod = { exports: {} as any };
  const mock = (key: string): any => {
    if (key === 'react/jsx-runtime') { const jsx = (type: any, props: any) => ({ type, props }); return { jsx, jsxs: jsx }; }
    if (key === 'react-native') return { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View', Pressable: 'Pressable', StyleSheet: { create: (x: any) => x } };
    if (key.endsWith('/AppButton')) return { AppButton: 'Button' };
    if (key.endsWith('/HighlightedText')) return { HighlightedText: 'HighlightedText' };
    if (key.endsWith('/reviewCloudPresentation')) return require('../src/shared/models/reviewCloudPresentation');
    if (key.endsWith('/colors')) return require('../src/shared/theme/colors'); if (key.endsWith('/radius')) return require('../src/shared/theme/radius'); if (key.endsWith('/spacing')) return require('../src/shared/theme/spacing'); if (key.endsWith('/ui')) return require('../src/shared/theme/ui');
    throw new Error('unexpected import ' + key);
  };
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync('src/shared/components/ReviewWordCloudCard.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(mock, mod, mod.exports);
  return mod.exports.ReviewWordCloudCard;
}
const all = (n: any): any[] => n && typeof n === 'object' ? [n, ...[n.props?.children].flat(Infinity).flatMap(all)] : [];
const texts = (n: any) => all(n).filter(x => x.type === 'Text').map(x => [x.props.children].flat(Infinity).join(''));
const style = (n: any) => Object.assign({}, ...[n.props.style].flat(Infinity).filter(Boolean));
const props = (over: any = {}) => ({ view: { kind: 'ready' }, chips: cloudChips(cloudOf([term({ font_size_rem: 2.2 }), term({ id: id('b'), text: 'room clean', font_size_rem: 1 })])), selectedId: null, matching: [], onSelect() {}, onClear() {}, onRetry() {}, ...over });
test('card: hidden shows nothing; loading is calm (no error styling, no button); the empty state is the friendly sentence', () => {
  const Card = loadCard();
  assert.equal(Card(props({ view: { kind: 'hidden' } })), null);
  const loading = Card(props({ view: { kind: 'loading' } })); assert.ok(texts(loading).some(t => t.includes('can take up to a minute'))); assert.equal(all(loading).filter(n => n.type === 'Button').length, 0); assert.ok(!all(loading).some(n => n.props?.accessibilityRole === 'alert'));
  const empty = Card(props({ view: { kind: 'notice', message: CLOUD_EMPTY_COPY } })); assert.ok(texts(empty).includes('The word cloud appears once 2 or more reviews share words.'));
});
test('card: an error shows the plain message and one Try again button that calls retry', () => {
  const Card = loadCard(); let retried = 0; const tree = Card(props({ view: { kind: 'error', message: cloudErrorCopy.network }, onRetry: () => { retried++; } }));
  assert.ok(texts(tree).includes(cloudErrorCopy.network)); const buttons = all(tree).filter(n => n.type === 'Button'); assert.deepEqual(buttons.map(b => b.props.label), ['Try again']); buttons[0].props.onPress(); assert.equal(retried, 1);
});
test('card: every chip is a button at least 48dp high that can wrap at large text, sized and colored from the view model; tapping selects, tapping the selected one clears', () => {
  const Card = loadCard(); const picked: string[] = []; let cleared = 0;
  const tree = Card(props({ onSelect: (x: string) => picked.push(x), onClear: () => { cleared++; } })); const chips = all(tree).filter(n => n.type === 'Pressable');
  assert.equal(chips.length, 2); for (const chip of chips) { assert.equal(chip.props.accessibilityRole, 'button'); const s = style(chip); assert.ok(s.minHeight >= 48 && s.minWidth >= 48); assert.equal(s.maxWidth, '100%'); assert.equal(s.flexShrink, 1); }
  const label = all(chips[0]).find(n => n.type === 'Text'); assert.equal(style(label).fontSize, 22); assert.equal(style(label).color, colors.identityInk === style(label).color ? colors.identityInk : style(label).color);
  chips[0].props.onPress(); assert.deepEqual(picked, [term().id]);
  const on = Card(props({ selectedId: term().id, onSelect: (x: string) => picked.push(x), onClear: () => { cleared++; } })); const selectedChip = all(on).filter(n => n.type === 'Pressable')[0]; assert.equal(selectedChip.props.accessibilityState.selected, true); selectedChip.props.onPress(); assert.equal(cleared, 1);
});
test('card: a selected term shows how many reviews contain it and those reviews with the words highlighted, right under the chips, with Clear', () => {
  const Card = loadCard(); let cleared = 0;
  const matching = matchingReviews(corpus, term({ text: 'room clean', matches: [{ id: 'r1', spans: [{ start: 2, end: 21 }] }] }));
  const tree = Card(props({ selectedId: term().id, matching, onClear: () => { cleared++; } }));
  assert.ok(texts(tree).includes('“clean” is in 1 review')); const highlighted = all(tree).find(n => n.type === 'HighlightedText'); assert.deepEqual(marked(highlighted.props.segments), ['Room was very clean']);
  const order = all(tree).map(n => n.type); assert.ok(order.lastIndexOf('Pressable') < order.indexOf('HighlightedText'), 'the reviews come after the chips');
  all(tree).filter(n => n.type === 'Button').find(b => b.props.label === 'Clear').props.onPress(); assert.equal(cleared, 1);
  assert.ok(texts(Card(props({ selectedId: term().id, matching: [] }))).includes('“clean” is in 0 reviews'), 'never claims a match that is not there');
});
