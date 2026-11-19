/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GL_FOV_DEGREES, GL_MAX_FRAME_MS, GL_PITCH_LIMIT_DEGREES, GL_SPAN_DEGREES, clampPitch, clampYaw, cylinderHeight, horizontalFov, panDistanceDp, positionFromYaw, yawLimit } from '../src/features/search-discovery/viewModels/roomTourGlGeometry';
import { glNudgeCommand, glReducedMotionCommand, glSetSideCommand, isAllowedPanoramaImageUrl, parseGlMessage } from '../src/features/search-discovery/viewModels/roomTourGlBridge';
import { GL_MATH_SOURCE, buildRoomTourGlHtml } from '../src/features/search-discovery/viewModels/roomTourGlHtml';
import { MAX_FLING_VELOCITY, RUBBER_BAND_FACTOR, RUBBER_BAND_MAX_DP, dragOffset } from '../src/features/search-discovery/viewModels/roomTourMotion';

const uuid = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000001`;
const URL_OK = `https://abc.supabase.co/storage/v1/object/public/property-panoramas/${uuid(1)}/${uuid(2)}/${uuid(3)}.jpg`;
const URL_BACK = `https://abc.supabase.co/storage/v1/object/public/property-panoramas/${uuid(1)}/${uuid(2)}/${uuid(4)}.jpg`;
const math = new Function(`${GL_MATH_SOURCE}; return { cylHeight, hFov, yawLimit, posFromYaw, mvp, dragOff, overshoot, rubber, mul4, perspective, rotX, rotY };`)() as Record<string, (...args: number[]) => any>;
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

// ---- geometry ----
test('cylinder height keeps the photo’s real proportions: arc length over aspect, for several spans and aspects (including 4.28 and 5.35)', () => {
  for (const aspect of [4.28, 5.35, 3, 2]) for (const span of [120, 160, GL_SPAN_DEGREES, 240]) near(cylinderHeight(span, aspect), (span * Math.PI / 180) / aspect);
  near(cylinderHeight(200, 4.28), 0.8156, 1e-3); near(cylinderHeight(200, 5.35), 0.6525, 1e-3);
  assert.ok(cylinderHeight(200, 5.35) < cylinderHeight(200, 4.28), 'a wider photo is a shorter band');
  for (const bad of [0, -1, Number.NaN]) { assert.equal(cylinderHeight(200, bad), 0); assert.equal(cylinderHeight(bad, 4), 0); }
});
test('yaw range: the view never shows past the photo’s ends; a portrait phone sees a narrow slice, so the range is wide', () => {
  const portrait = horizontalFov(GL_FOV_DEGREES, 411 / 700), landscape = horizontalFov(GL_FOV_DEGREES, 16 / 9);
  assert.ok(portrait < landscape && portrait > 30 && portrait < 45, `portrait horizontal field ${portrait}`);
  for (const span of [160, 200, 240]) { near(yawLimit(span, portrait), (span - portrait) / 2); assert.ok(yawLimit(span, portrait) * 2 + portrait <= span + 1e-9); }
  assert.equal(yawLimit(30, portrait), 0, 'a photo no wider than the view cannot pan'); assert.equal(yawLimit(Number.NaN, 40), 0);
});
test('yaw and pitch are clamped at their edges; position is 0 at the left end, 1 at the right end, 0.5 at the middle', () => {
  assert.equal(clampYaw(-500, 80), -80); assert.equal(clampYaw(500, 80), 80); assert.equal(clampYaw(10, 80), 10); assert.equal(clampYaw(Number.NaN, 80), 0); assert.equal(clampYaw(5, 0), 0);
  assert.equal(GL_PITCH_LIMIT_DEGREES, 8); assert.equal(clampPitch(30), 8); assert.equal(clampPitch(-30), -8); assert.equal(clampPitch(3), 3); assert.equal(clampPitch(Number.NaN), 0);
  assert.equal(positionFromYaw(-80, 80), 0); assert.equal(positionFromYaw(80, 80), 1); assert.equal(positionFromYaw(0, 80), 0.5); assert.equal(positionFromYaw(-200, 80), 0); assert.equal(positionFromYaw(200, 80), 1); assert.equal(positionFromYaw(0, 0), 0);
});
test('pan distance: how far a finger drags to cross the photo, for the backdrop drift and the dial', () => {
  const hf = horizontalFov(GL_FOV_DEGREES, 411 / 700);
  near(panDistanceDp(200, hf, 411), 411 * (200 - hf) / hf); assert.equal(panDistanceDp(30, hf, 411), 0); assert.equal(panDistanceDp(200, 0, 411), 0);
});
test('the renderer’s inline math agrees with the TypeScript geometry (so the two cannot drift)', () => {
  for (const [span, aspect, view] of [[200, 4.28, 0.587], [200, 5.35, 0.587], [160, 3, 1.78], [240, 4, 0.5]] as const) {
    near(math.cylHeight!(span, aspect), cylinderHeight(span, aspect)); near(math.hFov!(GL_FOV_DEGREES, view), horizontalFov(GL_FOV_DEGREES, view), 1e-9);
    near(math.yawLimit!(span, math.hFov!(GL_FOV_DEGREES, view)), yawLimit(span, horizontalFov(GL_FOV_DEGREES, view)), 1e-9);
  }
  for (const yaw of [-90, -10, 0, 33, 90, 200]) near(math.posFromYaw!(yaw, 80), positionFromYaw(yaw, 80));
  for (const raw of [-300, -10, 0, 400, 1790, 1900, 5000]) near(math.dragOff!(raw, 1790, RUBBER_BAND_FACTOR, RUBBER_BAND_MAX_DP), dragOffset(raw, 1790), 1e-9);
});

// ---- the projection: a point on the cylinder lands where it should (checked on the real matrices the page uses) ----
function ndc(a: number, y: number, yaw: number, pitch = 0, aspect = 0.587) {
  const m = math.mvp!(GL_FOV_DEGREES, aspect, yaw, pitch) as unknown as number[], p = [Math.sin(a * Math.PI / 180), y, -Math.cos(a * Math.PI / 180), 1];
  const clip = [0, 1, 2, 3].map(r => m[r]! * p[0]! + m[4 + r]! * p[1]! + m[8 + r]! * p[2]! + m[12 + r]! * p[3]!);
  return { x: clip[0]! / clip[3]!, y: clip[1]! / clip[3]!, w: clip[3]! };
}
test('projection: the part of the photo the camera points at is centered; larger angles are further right; the camera turns toward them', () => {
  near(ndc(0, 0, 0).x, 0); near(ndc(30, 0, 30).x, 0, 1e-9); near(ndc(-50, 0, -50).x, 0, 1e-9);
  assert.ok(ndc(10, 0, 0).x > 0 && ndc(-10, 0, 0).x < 0, 'right of the view is positive');
  assert.ok(ndc(20, 0, 0).x > ndc(10, 0, 0).x, 'monotonic');
  assert.ok(ndc(10, 0, 20).x < 0 && ndc(30, 0, 20).x > 0, 'turning right moves the picture left');
  assert.ok(ndc(0, 0, 0).w > 0, 'the point ahead is in front of the camera');
});
test('projection: the band’s top and bottom edges curve toward the center: taller at the sides, shorter in the middle', () => {
  const h = cylinderHeight(GL_SPAN_DEGREES, 4.28) / 2;
  const mid = ndc(0, h, 0).y, side = ndc(16, h, 0).y, midBottom = ndc(0, -h, 0).y, sideBottom = ndc(16, -h, 0).y;
  assert.ok(side > mid && mid > 0, `top edge rises toward the sides (${mid} then ${side})`);
  assert.ok(sideBottom < midBottom && midBottom < 0, 'bottom edge drops toward the sides');
  assert.ok(Math.abs(mid - -midBottom) < 1e-9, 'symmetric about the horizon');
});
test('projection: looking up moves the straight-ahead point down the screen; looking down moves it up', () => {
  assert.ok(ndc(0, 0, 0, 8).y < 0 && ndc(0, 0, 0, -8).y > 0); near(ndc(0, 0, 0, 0).y, 0);
});

// ---- messages from the page ----
test('page messages: every allowed message parses', () => {
  assert.deepEqual(parseGlMessage('{"type":"ready"}'), { type: 'ready' });
  assert.deepEqual(parseGlMessage('{"type":"error","reason":"image"}'), { type: 'error', reason: 'image' });
  assert.deepEqual(parseGlMessage('{"type":"position","t":0.25}'), { type: 'position', t: 0.25 });
  assert.deepEqual(parseGlMessage('{"type":"pull","edge":"left","dp":80}'), { type: 'pull', edge: 'left', dp: 80 });
  assert.deepEqual(parseGlMessage('{"type":"release","edge":"right","dp":0}'), { type: 'release', edge: 'right', dp: 0 });
});
test('page messages: wrong type, wrong fields, junk and oversized input are ignored', () => {
  for (const bad of ['{"type":"navigate","url":"x"}', '{"type":"position","t":2}', '{"type":"position","t":-0.1}', '{"type":"position","t":"0.5"}', '{"type":"position"}', '{"type":"pull","edge":"up","dp":3}',
    '{"type":"pull","edge":"left","dp":-1}', '{"type":"release","edge":"left","dp":"9"}', '{"type":"release","edge":"left","dp":1e9}', 'not json', '', '[]', 'null', '42', '{"type":null}'])
    assert.equal(parseGlMessage(bad), null, bad);
  assert.equal(parseGlMessage({ type: 'ready' }), null, 'only strings are accepted');
  assert.equal(parseGlMessage(`{"type":"error","reason":"${'x'.repeat(600)}"}`), null, 'oversized');
  assert.deepEqual(parseGlMessage('{"type":"error","reason":"<script>alert(1)</script>"}'), { type: 'error', reason: 'unknown' }, 'an odd reason is replaced, never passed on');
});

// ---- the image URL allow-list and the commands ----
test('image URL allow-list: accepts only this app’s public property-panoramas object URL', () => {
  assert.equal(isAllowedPanoramaImageUrl(URL_OK), true); assert.equal(isAllowedPanoramaImageUrl(URL_OK.replace('.jpg', '.webp')), true);
  for (const bad of ['http://abc.supabase.co/storage/v1/object/public/property-panoramas/' + `${uuid(1)}/${uuid(2)}/${uuid(3)}.jpg`, 'javascript:alert(1)', 'file:///data/user/0/x.jpg', 'data:image/jpeg;base64,AAAA',
    URL_OK.replace('property-panoramas', 'property-media'), URL_OK + '?x=1', URL_OK + '#a', URL_OK.replace('https://abc', 'https://user:pw@abc'), URL_OK.replace('abc.supabase.co', 'abc.supabase.co:8443'), URL_OK.replace('abc.supabase.co', 'localhost'),
    URL_OK.replace('.jpg', '.gif'), URL_OK.replace('/storage/v1/object/public', '/storage/v1/object/sign'), URL_OK.toUpperCase(), '', 'https://evil.test/' + URL_OK, `${URL_OK}"><script>`])
    assert.equal(isAllowedPanoramaImageUrl(bad), false, bad);
  assert.equal(isAllowedPanoramaImageUrl(null), false); assert.equal(isAllowedPanoramaImageUrl(7), false);
});
test('commands to the page: a rejected URL sends nothing; values are JSON-encoded; the others are fixed text', () => {
  assert.equal(glSetSideCommand('javascript:alert(1)', 4, 'left'), null); assert.equal(glSetSideCommand(URL_OK, 0, 'left'), null); assert.equal(glSetSideCommand(URL_OK, Number.NaN, 'left'), null);
  const command = glSetSideCommand(URL_BACK, 4.28, 'right')!;
  assert.equal(command, `window.__roomTour&&window.__roomTour.setSide(${JSON.stringify(URL_BACK)},4.28,"right");true;`);
  assert.equal(glReducedMotionCommand(true), 'window.__roomTour&&window.__roomTour.setReducedMotion(true);true;'); assert.equal(glReducedMotionCommand(false), 'window.__roomTour&&window.__roomTour.setReducedMotion(false);true;');
  assert.equal(glNudgeCommand(1), 'window.__roomTour&&window.__roomTour.nudge(1);true;'); assert.equal(glNudgeCommand(-1), 'window.__roomTour&&window.__roomTour.nudge(-1);true;');
});

// ---- the page ----
const inlineScript = (html: string) => /<script>([\s\S]*?)<\/script>/.exec(html)![1]!;
test('page: contains no URL but the one passed, no external script, and no network or code-loading calls', () => {
  const html = buildRoomTourGlHtml({ imageUrl: URL_OK, aspect: 4.28 });
  assert.deepEqual(html.match(/https?:/gi), ['https:'], 'one URL only'); assert.ok(html.includes(URL_OK));
  assert.ok(!/<script[^>]*\ssrc\s*=/i.test(html) && !/<script src/i.test(html), 'no external script'); assert.equal((html.match(/<script/g) ?? []).length, 2);
  for (const banned of ['fetch(', 'XMLHttpRequest', 'import(', 'eval(', 'new Function', 'WebSocket', 'localStorage', 'document.cookie', 'window.open']) assert.ok(!html.includes(banned), `no ${banned}`);
  assert.ok(html.includes('crossOrigin') && html.includes('anonymous'));
});
test('page: refuses a URL that is not allowed and a bad aspect; the script compiles; the config cannot end its script tag', () => {
  assert.throws(() => buildRoomTourGlHtml({ imageUrl: 'https://evil.test/x.jpg', aspect: 4 })); assert.throws(() => buildRoomTourGlHtml({ imageUrl: URL_OK, aspect: 0 })); assert.throws(() => buildRoomTourGlHtml({ imageUrl: URL_OK, aspect: 500 }));
  const html = buildRoomTourGlHtml({ imageUrl: URL_OK, aspect: 5.35, spanDegrees: 180, reducedMotion: true, entry: 'right' });
  assert.doesNotThrow(() => new Function(inlineScript(html)));
  const cfg = JSON.parse(/<script type="application\/json" id="cfg">([\s\S]*?)<\/script>/.exec(html)![1]!);
  assert.equal(cfg.span, 180); assert.equal(cfg.reduced, true); assert.equal(cfg.entry, 'right'); assert.equal(cfg.fov, GL_FOV_DEGREES);
  assert.equal(cfg.rubberFactor, RUBBER_BAND_FACTOR, 'motion constants are passed in, not copied');
});

// WebGL itself cannot be unit tested. This runs the page script in a sandbox with a fake canvas and a fake GL context, to check what CAN be checked: the messages it sends,
// its position math and clamping, and its failure paths. It does not prove anything is drawn correctly.
function runPage(options: { glNull?: boolean; maxTexture?: number; imageWidth?: number; reducedMotion?: boolean; entry?: 'left' | 'right'; imageFails?: boolean; bothSides?: boolean } = {}) {
  const html = buildRoomTourGlHtml({ imageUrl: URL_OK, aspect: 4.28, reducedMotion: !!options.reducedMotion, bothSides: !!options.bothSides, entry: options.entry ?? 'left' });
  const cfgText = /<script type="application\/json" id="cfg">([\s\S]*?)<\/script>/.exec(html)![1]!;
  const messages: any[] = [], listeners: Record<string, (event: any) => void> = {}, frames: ((now: number) => void)[] = [], timers: (() => void)[] = [], drawn = { arrays: 0, downscaled: 0, textures: 0, clears: 0 }, matrices: number[][] = [];
  let now = 0;
  const gl: any = new Proxy({}, { get: (_t, key: string) => key === 'getParameter' ? () => options.maxTexture ?? 8192 : key === 'getShaderParameter' || key === 'getProgramParameter' ? () => true : key === 'uniformMatrix4fv' ? (_loc: unknown, _t: unknown, m: ArrayLike<number>) => { matrices.push(Array.from(m)); } : key === 'clear' ? () => { drawn.clears++; } : key === 'drawArrays' ? () => { drawn.arrays++; } : key === 'texImage2D' ? () => { drawn.textures++; } : /^[A-Z_0-9]+$/.test(key) ? 1 : () => 1 });
  const canvas = { clientWidth: 400, clientHeight: 700, width: 0, height: 0, addEventListener: (type: string, fn: (event: any) => void) => { listeners[type] = fn; }, getContext: () => options.glNull ? null : gl, setPointerCapture: () => {} };
  const document = { getElementById: (id: string) => id === 'cfg' ? { textContent: cfgText } : canvas, createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => { drawn.downscaled++; } }) }) };
  const images: any[] = [];
  class FakeImage { onload: (() => void) | null = null; onerror: (() => void) | null = null; naturalWidth = options.imageWidth ?? 6144; naturalHeight = 1407; crossOrigin = ''; set src(_value: string) { images.push(this); } }
  const window: any = { ReactNativeWebView: { postMessage: (m: string) => messages.push(JSON.parse(m)) }, addEventListener: (type: string, fn: (event: any) => void) => { listeners[`window:${type}`] = fn; }, devicePixelRatio: 2 };
  const performance = { now: () => now };
  new Function('window', 'document', 'Image', 'performance', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', 'URL', inlineScript(html))(window, document, FakeImage, performance, (fn: (t: number) => void) => frames.push(fn), (fn: () => void) => { timers.push(fn); return timers.length; }, () => {}, URL);
  const settle = () => { for (let guard = 0; timers.length && guard < 20; guard++) { now += 40; timers.shift()!(); } };   // each timer fires 40 ms later, so throttle timers can fire
  const frame = (ms = 16) => { now += ms; const batch = frames.splice(0); batch.forEach(fn => fn(now)); settle(); };
  const loadImage = () => { const img = images.shift(); if (options.imageFails) img.onerror(); else img.onload(); settle(); };
  const pointer = (type: string, x: number, y: number, t: number) => { now = t; listeners[type]?.({ type, pointerId: 1, clientX: x, clientY: y, timeStamp: t }); };
  const positions = () => messages.filter(m => m.type === 'position').map(m => m.t as number);
  return { messages, positions, frame, loadImage, pointer, drawn, images, window, frames, clock: () => now, matrices };
}
const maxPx = () => { const hf = math.hFov!(GL_FOV_DEGREES, 400 / 700), limit = math.yawLimit!(GL_SPAN_DEGREES, hf); return 2 * limit / (hf / 400); };

test('page (fake GL): WebGL unavailable is reported as an error, not a crash', () => {
  const page = runPage({ glNull: true }); assert.deepEqual(page.messages, [{ type: 'error', reason: 'webgl unavailable' }]);
});
test('page (fake GL): an image that fails to load is reported as an error', () => {
  const page = runPage({ imageFails: true }); page.loadImage(); assert.ok(page.messages.some(m => m.type === 'error' && m.reason === 'image')); assert.ok(!page.messages.some(m => m.type === 'ready'));
});
test('page (fake GL): ready is sent once after the first frame, at position 0; a photo wider than the texture limit is downscaled first', () => {
  const page = runPage({ maxTexture: 4096 }); page.loadImage();
  assert.equal(page.messages.filter(m => m.type === 'ready').length, 1); assert.ok(page.drawn.arrays >= 1, 'a frame was drawn before ready'); assert.equal(page.drawn.downscaled, 1, 'the 6144 px image was drawn smaller first');
  assert.deepEqual(page.positions().slice(0, 1), [0]);
  const sharp = runPage({ maxTexture: 8192 }); sharp.loadImage(); assert.equal(sharp.drawn.downscaled, 0);
});
test('page (fake GL): entering from the right end starts at position 1', () => {
  const page = runPage({ entry: 'right' }); page.loadImage(); assert.deepEqual(page.positions().slice(0, 1), [1]);
});
test('page (fake GL): dragging left moves the position forward by the finger distance, clamped; a pull past the end springs back to exactly the end', () => {
  const page = runPage({ reducedMotion: true }); page.loadImage(); const range = maxPx();
  page.pointer('pointerdown', 300, 300, 0); page.pointer('pointermove', 100, 300, 50); page.frame(50);
  near(page.positions().at(-1)!, 200 / range, 1e-6);
  page.pointer('pointermove', -5000, 300, 100); page.frame(50); assert.ok(page.positions().at(-1)! <= 1, 'never reports more than 1'); assert.equal(page.positions().at(-1), 1);
  page.pointer('pointerup', -5000, 300, 150); page.frame(50); assert.equal(page.positions().at(-1), 1);
  assert.ok(page.positions().every(t => t >= 0 && t <= 1));
});
test('page (fake GL): a fast release glides on and stops at the end; reduced motion does not glide', () => {
  const gliding = runPage(); gliding.loadImage();
  gliding.pointer('pointerdown', 300, 300, 0); gliding.pointer('pointermove', 250, 300, 16); gliding.pointer('pointermove', 200, 300, 32); gliding.pointer('pointerup', 200, 300, 33);
  const before = gliding.positions().at(-1) ?? 0; for (let i = 0; i < 400; i++) gliding.frame(16);
  assert.ok(gliding.positions().at(-1)! > before + 0.01, 'kept moving after release'); assert.ok(gliding.positions().every(t => t >= 0 && t <= 1));
  const still = runPage({ reducedMotion: true }); still.loadImage();
  still.pointer('pointerdown', 300, 300, 0); still.pointer('pointermove', 250, 300, 16); still.pointer('pointermove', 200, 300, 32); still.frame(16); still.pointer('pointerup', 200, 300, 33);
  const stopped = still.positions().at(-1)!; for (let i = 0; i < 60; i++) still.frame(16); assert.equal(still.positions().at(-1), stopped, 'no glide with reduced motion');
});
test('page (fake GL): position messages are throttled to about 30 a second', () => {
  const page = runPage({ reducedMotion: true }); page.loadImage(); page.pointer('pointerdown', 300, 300, 0);
  for (let i = 1; i <= 60; i++) { page.pointer('pointermove', 300 - i * 4, 300, i * 8); page.frame(8); }
  const seconds = page.clock() / 1000, count = page.positions().length; assert.ok(count > 5 && count <= seconds * 30 + 3, `${count} position messages in ${seconds.toFixed(2)} s of simulated time`);
});
test('page (fake GL): setSide ignores another origin and a bad aspect, and a valid side sends ready again', () => {
  const page = runPage(); page.loadImage(); const api = page.window.__roomTour;
  api.setSide('https://evil.test/storage/v1/object/public/property-panoramas/x.jpg', 4, 'left'); assert.equal(page.images.length, 0);
  api.setSide(URL_BACK, -1, 'left'); api.setSide(URL_BACK, 'x', 'left'); assert.equal(page.images.length, 0);
  api.setSide(URL_BACK, 4.1, 'right'); assert.equal(page.images.length, 1); page.loadImage();
  assert.deepEqual(page.positions().at(-1), 1, 'entered at the right end'); assert.equal(page.messages.filter(m => m.type === 'ready').length, 2, 'ready is reported again for the new side');
});

// ---- phase 2: pulling past an end and releasing (wrap-around between the sides) ----
const pulls = (page: ReturnType<typeof runPage>) => page.messages.filter(m => m.type === 'pull');
const releases = (page: ReturnType<typeof runPage>) => page.messages.filter(m => m.type === 'release');
test('page (fake GL), both sides: pulling past the left end reports the edge and the finger distance, and a release reports it once', () => {
  const page = runPage({ bothSides: true, reducedMotion: true }); page.loadImage();
  page.pointer('pointerdown', 100, 300, 0); page.pointer('pointermove', 180, 300, 40); page.frame(20);   // 80 px right of the start at the left end: 80 px past it
  const first = pulls(page).at(-1); assert.equal(first.edge, 'left'); near(first.dp, 80, 1e-6);
  page.pointer('pointermove', 230, 300, 80); page.frame(20); near(pulls(page).at(-1).dp, 130, 1e-6);
  page.pointer('pointerup', 230, 300, 100);
  assert.deepEqual(releases(page).map(m => m.edge), ['left']); near(releases(page)[0].dp, 130, 1e-6);
});
test('page (fake GL), both sides: pulling past the right end reports the right edge', () => {
  const page = runPage({ bothSides: true, reducedMotion: true, entry: 'right' }); page.loadImage();
  page.pointer('pointerdown', 300, 300, 0); page.pointer('pointermove', 210, 300, 40); page.frame(20); page.pointer('pointerup', 210, 300, 60);
  assert.equal(pulls(page).at(-1).edge, 'right'); near(pulls(page).at(-1).dp, 90, 1e-6); assert.equal(releases(page)[0].edge, 'right');
});
test('page (fake GL), both sides: dragging back inside the photo clears the pull; a drag that stays inside sends no pull and no release', () => {
  const page = runPage({ bothSides: true, reducedMotion: true }); page.loadImage();
  page.pointer('pointerdown', 100, 300, 1000); page.pointer('pointermove', 160, 300, 1030); page.frame(30); assert.ok(pulls(page).length >= 1);
  page.pointer('pointermove', 60, 300, 1100); page.frame(30);   // back past the start, inside the photo
  assert.equal(pulls(page).at(-1).dp, 0, 'the pull is cleared'); page.pointer('pointerup', 60, 300, 1130); assert.equal(releases(page).length, 0);
  const inside = runPage({ bothSides: true, reducedMotion: true }); inside.loadImage();
  inside.pointer('pointerdown', 300, 300, 0); inside.pointer('pointermove', 200, 300, 30); inside.pointer('pointerup', 200, 300, 60); assert.equal(pulls(inside).length, 0); assert.equal(releases(inside).length, 0);
});
test('page (fake GL), one side: never reports a pull or a release, only the soft edge', () => {
  const page = runPage({ bothSides: false, reducedMotion: true }); page.loadImage();
  page.pointer('pointerdown', 100, 300, 0); page.pointer('pointermove', 300, 300, 40); page.frame(20); page.pointer('pointerup', 300, 300, 60);
  assert.equal(pulls(page).length, 0); assert.equal(releases(page).length, 0);
});
test('page (fake GL), both sides: a cancelled touch clears the pull and does not release', () => {
  const page = runPage({ bothSides: true, reducedMotion: true }); page.loadImage();
  page.pointer('pointerdown', 100, 300, 0); page.pointer('pointermove', 200, 300, 40); page.frame(20); page.pointer('pointercancel', 200, 300, 60);
  assert.equal(releases(page).length, 0); assert.equal(pulls(page).at(-1).dp, 0);
});
test('page (fake GL): asking for another side clears the old picture at once (no flash of the previous side)', () => {
  const page = runPage(); page.loadImage(); const arrays = page.drawn.arrays, clears = page.drawn.clears;
  page.window.__roomTour.setSide(URL_BACK, 4.1, 'left'); assert.equal(page.drawn.arrays, arrays, 'nothing is drawn for the new side until it has loaded'); assert.equal(page.drawn.clears, clears + 1, 'the canvas is cleared');
  assert.ok(page.images.length === 1, 'the new image is loading');
});

// ---- stability on a slow renderer (a software emulator drops frames and its timestamps can disagree with the clock) ----
// Reads yaw and pitch back from the matrix the page really drew with: M = P * Rx(-pitch) * Ry(yaw), so V = P^-1 * M can be taken apart.
function view(m: number[], aspect = 400 / 700) {
  const f = 1 / Math.tan(GL_FOV_DEGREES * Math.PI / 360), at = (r: number, c: number) => m[c * 4 + r]!;
  const v = (r: number, c: number) => r === 0 ? at(0, c) * aspect / f : r === 1 ? at(1, c) / f : -at(3, c);
  const phi = Math.asin(Math.max(-1, Math.min(1, v(2, 1)))), yaw = Math.atan2(v(0, 2), v(2, 2) / Math.cos(phi));
  return { yaw: yaw * 180 / Math.PI, pitch: -phi * 180 / Math.PI };
}
function limits() { const hf = math.hFov!(GL_FOV_DEGREES, 400 / 700), limit = math.yawLimit!(GL_SPAN_DEGREES, hf), degPerPx = hf / 400; return { limit, cap: RUBBER_BAND_MAX_DP * degPerPx, degPerPx }; }
function assertBounded(matrices: number[][], label: string) {
  const { limit, cap } = limits(); assert.ok(matrices.length > 0, `${label}: something was drawn`);
  matrices.forEach((m, index) => {
    assert.ok(m.every(Number.isFinite), `${label}: frame ${index} has a NaN or infinity`);
    const { yaw, pitch } = view(m);
    assert.ok(Math.abs(pitch) <= GL_PITCH_LIMIT_DEGREES + 1e-3, `${label}: frame ${index} pitch ${pitch}`);
    assert.ok(Math.abs(yaw) <= limit + cap + 0.05, `${label}: frame ${index} yaw ${yaw} (limit ${limit} + cap ${cap})`);
  });
}
test('the page\u2019s matrix decoder agrees with the math (so the checks below mean something)', () => {
  for (const [yaw, pitch] of [[0, 0], [30, 5], [-60, -8], [80, 3]] as const) { const out = view(math.mvp!(GL_FOV_DEGREES, 400 / 700, yaw, pitch) as unknown as number[]); near(out.yaw, yaw, 1e-6); near(out.pitch, pitch, 1e-6); }
});
test('time step: never negative, never above the maximum, and a bad number moves nothing', () => {
  assert.equal(GL_MAX_FRAME_MS, 50);
  const dt = new Function(`${GL_MATH_SOURCE}; return frameDt;`)() as (now: number, last: number, max: number) => number;
  assert.equal(dt(116, 100, 50), 16); assert.equal(dt(1100, 100, 50), 50); assert.equal(dt(90, 100, 50), 0, 'time going backwards is not a negative step'); assert.equal(dt(Number.NaN, 100, 50), 0); assert.equal(dt(Infinity, 100, 50), 0);
});
test('the glide is the same at 60 fps and in 50 ms steps, and cannot grow', () => {
  const fns = new Function(`${GL_MATH_SOURCE}; return { coast, limitPitch, limitOffset };`)() as Record<string, (...a: number[]) => any>;
  const a = 1 - 0.997; let fine = [0, 2], coarse = [0, 2]; for (let i = 0; i < 100; i++) fine = fns.coast!(fine[0]!, fine[1]!, a, 16); for (let i = 0; i < 32; i++) coarse = fns.coast!(coarse[0]!, coarse[1]!, a, 50);
  near(fine[0]!, coarse[0]!, 1e-6 + Math.abs(fine[0]!) * 0.001); assert.ok(Math.abs(fns.coast!(0, 3, a, 50)[1]) < 3, 'the velocity only ever shrinks');
  assert.equal(fns.limitPitch!(500, 8, 1), 8); assert.equal(fns.limitPitch!(-500, 8, 1), -8); assert.equal(fns.limitPitch!(Number.NaN, 8, 1), 1); assert.equal(fns.limitOffset!(Infinity, 1000, 96, 7), 7); assert.equal(fns.limitOffset!(-9999, 1000, 96, 0), -96); assert.equal(fns.limitOffset!(9999, 1000, 96, 0), 1096);
});
for (const ms of [16, 100, 500]) {
  test(`stability at ${ms} ms frames: yaw stays inside its range plus the rubber-band cap, pitch inside the limit, never NaN, and the spring settles`, () => {
    const page = runPage(); page.loadImage(); const { limit } = limits();
    // a fast fling toward the right end, then a long pull past the end and a release (spring back)
    let t = page.clock();
    page.pointer('pointerdown', 380, 300, t); for (let i = 1; i <= 6; i++) { t += 16; page.pointer('pointermove', 380 - i * 60, 300 + i * 10, t); }
    page.pointer('pointerup', 20, 360, t + 1);
    for (let i = 0; i < 600; i++) page.frame(ms);
    t = page.clock(); page.pointer('pointerdown', 380, 300, t); for (let i = 1; i <= 40; i++) { t += 16; page.pointer('pointermove', 380 - i * 40, 300, t); page.frame(ms); }
    page.pointer('pointerup', -1220, 300, page.clock() + 1);
    for (let i = 0; i < 400; i++) page.frame(ms);
    assertBounded(page.matrices, `${ms} ms`);
    const last = view(page.matrices.at(-1)!); near(Math.abs(last.yaw), limit, 0.05); assert.ok(Math.abs(last.pitch) < 0.06, 'pitch is back at rest');
    assert.equal(page.frames.length, 0, 'the animation stopped (the spring settled)');
  });
}
test('stability: a burst of vertical and horizontal drags with huge distances stays inside the limits, ignores NaN, and settles', () => {
  const page = runPage(); page.loadImage(); let t = page.clock();
  page.pointer('pointerdown', 200, 300, t);
  for (const [x, y] of [[200, 1e7], [1e12, -1e9], [Number.NaN, 300], [200, Number.NaN], [-1e12, 5e8], [200, -3e4], [Infinity, 0], [200, 1e6]] as const) { t += 8; page.pointer('pointermove', x, y, t); page.frame(16); assertBounded(page.matrices, `burst ${x},${y}`); }
  page.pointer('pointerup', 200, 1e6, t + 1);
  for (let i = 0; i < 300; i++) page.frame(16);
  assertBounded(page.matrices, 'after the burst'); assert.ok(Math.abs(view(page.matrices.at(-1)!).pitch) < 0.06, 'pitch eased back to 0'); assert.equal(page.frames.length, 0);
});
test('stability: time that goes backwards (a clock or timestamp glitch) cannot make anything grow', () => {
  const page = runPage(); page.loadImage(); let t = page.clock();
  page.pointer('pointerdown', 200, 300, t); t += 16; page.pointer('pointermove', 200, 2000, t); page.pointer('pointerup', 200, 2000, t + 1);   // pitch is at its limit
  for (let i = 0; i < 400; i++) { page.frame(16); page.frame(-30); }
  assertBounded(page.matrices, 'backwards time'); assert.ok(Math.abs(view(page.matrices.at(-1)!).pitch) <= GL_PITCH_LIMIT_DEGREES + 1e-3);
});
test('stability: a glitchy release cannot launch the photo faster than the maximum glide', () => {
  const page = runPage(); page.loadImage(); let t = page.clock();
  page.pointer('pointerdown', 380, 300, t); page.pointer('pointermove', 20, 300, t + 1); page.pointer('pointerup', 20, 300, t + 2);   // 360 px in 1 ms
  for (let i = 0; i < 300; i++) page.frame(16);
  assertBounded(page.matrices, 'fling'); assert.equal(MAX_FLING_VELOCITY, 6);
});
test('redraw only when something changed: holding a finger still draws nothing new', () => {
  const page = runPage(); page.loadImage(); const before = page.drawn.arrays;
  page.pointer('pointerdown', 200, 300, page.clock()); for (let i = 0; i < 10; i++) page.frame(16);
  assert.equal(page.drawn.arrays, before, 'no new draw while nothing moved');
  page.pointer('pointermove', 150, 300, page.clock() + 8); page.frame(16); assert.ok(page.drawn.arrays > before, 'a move draws');
});
