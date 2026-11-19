import { isAllowedPanoramaImageUrl } from './roomTourGlBridge';
import { GL_FOV_DEGREES, GL_MAX_FRAME_MS, GL_PITCH_DEG_PER_PX, GL_PITCH_LIMIT_DEGREES, GL_POSITION_MAX_HZ, GL_SPAN_DEGREES } from './roomTourGlGeometry';
import { MAX_FLING_VELOCITY, MIN_FLING_VELOCITY, MOMENTUM_DECELERATION, RUBBER_BAND_FACTOR, RUBBER_BAND_MAX_DP, SPRING_BACK_SPEED, WRAP_THRESHOLD_DP, type Edge } from './roomTourMotion';

/**
 * The WebGL room tour page: ONE self-contained HTML document with an inline script (no external script, no library). It draws the photo on the inside of a
 * cylinder (radius 1) with the camera in the middle, so the band's top and bottom edges curve toward the center like a real panoramic photo. Nothing is drawn
 * above or below the photographed band: the canvas is transparent and the React Native backdrop shows through.
 *
 * GL_MATH_SOURCE is plain JavaScript text used by the page AND evaluated by the unit tests (WebGL itself cannot be unit tested): the tests check that it agrees with
 * roomTourGlGeometry.ts and that points on the cylinder project where they should (centered ahead of the camera, curving taller toward the sides).
 */
export const GL_MATH_SOURCE = String.raw`
function cylHeight(spanDeg, aspect) { return (spanDeg * Math.PI / 180) / aspect; }
function hFov(vDeg, viewAspect) { return 2 * Math.atan(Math.tan(vDeg * Math.PI / 360) * viewAspect) * 180 / Math.PI; }
function yawLimit(spanDeg, hDeg) { return Math.max(0, (spanDeg - hDeg) / 2); }
function clamp(v, lo, hi) { if (v < lo) return lo; if (v > hi) return hi; return v; }
function posFromYaw(yaw, limit) { if (limit > 0) return clamp((yaw + limit) / (2 * limit), 0, 1); return 0; }
function perspective(fovDeg, aspect, near, far) { var f = 1 / Math.tan(fovDeg * Math.PI / 360), nf = 1 / (near - far); return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]; }
function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
function mul4(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function overshoot(raw, max) { if (raw < 0) return raw; if (raw > max) return raw - max; return 0; }
function rubber(d, factor, cap) { if (d > 0) return Math.min(cap, d * factor); return 0; }
function dragOff(raw, max, factor, cap) { var o = overshoot(raw, max); if (o < 0) return -rubber(-o, factor, cap); if (o > 0) return max + rubber(o, factor, cap); return raw; }
function finite(v) { return typeof v === 'number' && isFinite(v); }
function frameDt(now, last, max) { var d = now - last; if (!finite(d) || d < 0) return 0; if (d > max) return max; return d; }
function limitPitch(v, lim, fallback) { if (!finite(v)) return fallback; return clamp(v, -lim, lim); }
function limitOffset(v, maxPx, cap, fallback) { if (!finite(v)) return fallback; return clamp(v, -cap, maxPx + cap); }
function coast(offset, vel, a, dt) { var f = Math.exp(-a * dt); return [offset + vel * (1 - f) / a, vel * f]; }
function mvp(fovDeg, aspect, yawDeg, pitchDeg) { return mul4(perspective(fovDeg, aspect, 0.05, 10), mul4(rotX(-pitchDeg * Math.PI / 180), rotY(yawDeg * Math.PI / 180))); }
`;

const RENDERER_SOURCE = String.raw`
(function () {
  var C = JSON.parse(document.getElementById('cfg').textContent), RAD = Math.PI / 180, N = 96;
  var canvas = document.getElementById('c');
  function post(m) { try { window.ReactNativeWebView.postMessage(JSON.stringify(m)); } catch (e) {} }
  function fail(r) { post({ type: 'error', reason: r }); }
  var gl = null, isGl2 = false;
  try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true }); isGl2 = !!gl; if (!gl) gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true }); } catch (e) {}
  if (!gl) { fail('webgl unavailable'); return; }
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); fail('context lost'); });
  function shader(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader'); return s; }
  var prog = gl.createProgram();
  try {
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec3 aPos;attribute vec2 aUv;uniform mat4 uMvp;varying vec2 vUv;void main(){vUv=aUv;gl_Position=uMvp*vec4(aPos,1.0);}'));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 vUv;uniform sampler2D uTex;void main(){gl_FragColor=texture2D(uTex,vUv);}'));
    gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link'); gl.useProgram(prog);
  } catch (e) { fail('shader'); return; }
  var aPos = gl.getAttribLocation(prog, 'aPos'), aUv = gl.getAttribLocation(prog, 'aUv'), uMvp = gl.getUniformLocation(prog, 'uMvp');
  var buf = gl.createBuffer(), tex = null, loaded = false, aspect = C.aspect, token = 0, readyPosted = false, reduced = !!C.reduced;
  var vw = 1, vh = 1, hf = 60, limit = 0, degPerPx = 0.1, maxPx = 0, offset = 0, pitch = 0, vel = 0, mode = 'idle', target = 0, drag = null, raf = 0, last = 0;
  var lastT = -1, lastAt = 0, flushTimer = 0, origin = '', goodOffset = 0, goodPitch = 0, drawnOffset = NaN, drawnPitch = NaN;
  // Every write to the position goes through these: a bad number keeps the last good value, pitch is always inside its limit, and a pull past an end never shows more than the rubber band cap.
  function setOffset(v) { offset = limitOffset(v, maxPx, C.rubberMax, goodOffset); goodOffset = offset; }
  function setPitch(v) { pitch = limitPitch(v, C.pitchLimit, goodPitch); goodPitch = pitch; }
  try { origin = new URL(C.imageUrl).origin; } catch (e) { fail('url'); return; }
  function size() {
    var frac = 0, dpr = Math.min(window.devicePixelRatio || 1, 2); if (maxPx > 0) frac = offset / maxPx;
    vw = Math.max(1, canvas.clientWidth); vh = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr); gl.viewport(0, 0, canvas.width, canvas.height);
    hf = hFov(C.fov, vw / vh); limit = yawLimit(C.span, hf); degPerPx = hf / vw; maxPx = 2 * limit / degPerPx; setOffset(clamp(frac * maxPx, 0, maxPx));
  }
  function mesh() {
    var hh = cylHeight(C.span, aspect) / 2, d = new Float32Array((N + 1) * 10);
    for (var i = 0, p = 0; i <= N; i++) {
      var a = (-C.span / 2 + C.span * i / N) * RAD, x = Math.sin(a), z = -Math.cos(a), u = i / N;
      d[p++] = x; d[p++] = hh; d[p++] = z; d[p++] = u; d[p++] = 0; d[p++] = x; d[p++] = -hh; d[p++] = z; d[p++] = u; d[p++] = 1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
  }
  function upload(img) {
    var max = gl.getParameter(gl.MAX_TEXTURE_SIZE), src = img, w = img.naturalWidth, h = img.naturalHeight;
    if (w > max || h > max) { var k = Math.min(max / w, max / h), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.floor(w * k)); cv.height = Math.max(1, Math.floor(h * k)); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); src = cv; w = cv.width; h = cv.height; }
    if (tex) gl.deleteTexture(tex);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    var pot = function (n) { return (n & (n - 1)) === 0; };
    if (isGl2 || (pot(w) && pot(h))) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function yaw() { return offset * degPerPx - limit; }
  function draw() {
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); if (!loaded) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 20, 12);
    gl.uniformMatrix4fv(uMvp, false, new Float32Array(mvp(C.fov, vw / vh, yaw(), pitch))); gl.drawArrays(gl.TRIANGLE_STRIP, 0, (N + 1) * 2);
    drawnOffset = offset; drawnPitch = pitch;
  }
  function redraw() { if (offset !== drawnOffset || pitch !== drawnPitch) draw(); }   // a frame is drawn only when something changed
  function report() {
    var t = posFromYaw(yaw(), limit), now = performance.now();
    if (Math.abs(t - lastT) < 0.0005) return;
    if (now - lastAt >= 1000 / C.hz) { lastT = t; lastAt = now; post({ type: 'position', t: t }); }
    else if (!flushTimer) flushTimer = setTimeout(function () { flushTimer = 0; report(); }, 1000 / C.hz);
  }
  function step(dt) {
    var moving = false;
    if (mode === 'coast') {
      var r = coast(offset, vel, 1 - C.decel, dt);   // exact for any step: the same glide at 16 ms and at 50 ms
      setOffset(r[0]); if (finite(r[1])) vel = r[1]; else { vel = 0; mode = 'idle'; }
      if (offset <= 0) { setOffset(0); mode = 'idle'; } else if (offset >= maxPx) { setOffset(maxPx); mode = 'idle'; } else if (Math.abs(vel) < 0.005) mode = 'idle';
      moving = mode === 'coast';
    } else if (mode === 'spring') {
      setOffset(offset + (target - offset) * (1 - Math.exp(-dt * C.spring / 1000)));
      if (Math.abs(target - offset) < 0.5) { setOffset(target); mode = 'idle'; } moving = mode === 'spring';
    }
    if (mode !== 'drag' && pitch !== 0) { setPitch(pitch * Math.exp(-dt * 0.012)); if (Math.abs(pitch) < 0.05) setPitch(0); moving = true; }
    return moving;
  }
  // The step comes from one clock (performance.now) and is kept between 0 and the maximum: the animation timestamp can be older than the clock on a slow renderer, and a negative step would make the damping grow.
  function tick() { raf = 0; var t = performance.now(), dt = frameDt(t, last, C.maxDt); last = t; var moving = step(dt); redraw(); report(); if (moving || mode === 'drag') schedule(); }
  function schedule() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function load(url, asp, entry) {
    var mine = ++token, img = new Image(); loaded = false; readyPosted = false; aspect = asp; img.crossOrigin = 'anonymous'; draw();   // draw() clears the canvas: the old side is not shown while the new one loads
    img.onload = function () {
      if (mine !== token) return;
      try { size(); mesh(); upload(img); } catch (e) { fail('texture'); return; }
      loaded = true; setOffset(0); if (entry === 'right') setOffset(maxPx); setPitch(0); vel = 0; mode = 'idle'; lastT = -1; draw(); report();
      if (!readyPosted) { readyPosted = true; post({ type: 'ready' }); }
    };
    img.onerror = function () { if (mine === token) fail('image'); };
    img.src = url;
  }
  var pullEdge = '', pullDp = 0, pullAt = 0;
  function pull(over) {
    if (!C.both) return;
    var dp = Math.abs(over), edge = pullEdge;
    if (over < 0) edge = 'left'; else if (over > 0) edge = 'right';
    if (edge === '') return;
    var now = performance.now(), changed = edge !== pullEdge || Math.abs(dp - pullDp) >= 2 || (dp === 0 && pullDp !== 0);
    if (!changed || (dp !== 0 && now - pullAt < 1000 / C.hz)) return;
    pullEdge = edge; pullDp = dp; pullAt = now; post({ type: 'pull', edge: edge, dp: dp });
  }
  function samplesTrim(t) { while (drag.samples.length > 2 && t - drag.samples[0][0] > 100) drag.samples.shift(); }
  canvas.addEventListener('pointerdown', function (e) {
    if (!loaded || drag || !finite(e.clientX) || !finite(e.clientY)) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, start: clamp(offset, 0, maxPx), raw: offset, samples: [[e.timeStamp, e.clientX]] }; mode = 'drag'; vel = 0; schedule();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id || !finite(e.clientX) || !finite(e.clientY)) return;
    drag.raw = drag.start - (e.clientX - drag.x); setOffset(dragOff(drag.raw, maxPx, C.rubberFactor, C.rubberMax));
    setPitch((e.clientY - drag.y) * C.pitchPerPx); drag.samples.push([e.timeStamp, e.clientX]); samplesTrim(e.timeStamp); pull(overshoot(drag.raw, maxPx)); schedule();
  });
  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag, over = overshoot(d.raw, maxPx); drag = null; mode = 'idle';
    var rel = 'right'; if (over < 0) rel = 'left';
    if (C.both && over !== 0 && e.type === 'pointerup') post({ type: 'release', edge: rel, dp: Math.abs(over) }); else pull(0);
    pullEdge = ''; pullDp = 0;
    if (over !== 0) { target = maxPx; if (over < 0) target = 0; if (reduced) setOffset(target); else mode = 'spring'; }
    else if (!reduced && d.samples.length > 1) {
      var a = d.samples[0], b = d.samples[d.samples.length - 1], dtm = b[0] - a[0];
      if (dtm > 0 && finite(dtm)) { vel = clamp(-(b[1] - a[1]) / dtm, -C.maxFling, C.maxFling); if (finite(vel) && Math.abs(vel) >= C.minFling) mode = 'coast'; else vel = 0; }
    }
    schedule();
  }
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  window.addEventListener('resize', function () { size(); draw(); schedule(); });
  window.__roomTour = {
    setSide: function (url, asp, entry) {
      try { if (new URL(url).origin !== origin) return; } catch (e) { return; }
      if (typeof asp !== 'number' || !(asp > 0) || asp > 100) return;
      if (entry === 'right') load(url, asp, 'right'); else load(url, asp, 'left');
    },
    nudge: function (dir) { if (!loaded || (dir !== 1 && dir !== -1)) return; mode = 'idle'; vel = 0; setOffset(clamp(offset + dir * vw * 0.6, 0, maxPx)); draw(); report(); },
    setReducedMotion: function (b) { reduced = !!b; if (reduced && mode === 'coast') { mode = 'idle'; vel = 0; } }
  };
  size(); load(C.imageUrl, C.aspect, C.entry);
})();
`;

export interface RoomTourGlOptions {
  imageUrl: string;
  /** Image width over height (the stored width and height of the photo). */
  aspect: number;
  spanDegrees?: number;
  fovDegrees?: number;
  pitchLimitDegrees?: number;
  reducedMotion?: boolean;
  /** Both Front and Back exist: the page then reports pulls past an end and releases, so the viewer can wrap to the other side. */
  bothSides?: boolean;
  /** Which end the first image is entered at (a wrap enters at the end opposite to the one left through). */
  entry?: Edge;
}

/** Makes the page, with the same motion constants the flat viewer uses passed in (not copied). Throws for an image URL that is not this app's public panorama URL. */
export function buildRoomTourGlHtml(options: RoomTourGlOptions): string {
  const { imageUrl } = options;
  if (!isAllowedPanoramaImageUrl(imageUrl)) throw new Error('The room tour image URL is not allowed.');
  if (!Number.isFinite(options.aspect) || options.aspect <= 0 || options.aspect >= 100) throw new Error('The room tour image aspect is not valid.');
  const config = {
    imageUrl, aspect: options.aspect, span: options.spanDegrees ?? GL_SPAN_DEGREES, fov: options.fovDegrees ?? GL_FOV_DEGREES, pitchLimit: options.pitchLimitDegrees ?? GL_PITCH_LIMIT_DEGREES,
    reduced: !!options.reducedMotion, both: !!options.bothSides, entry: options.entry ?? 'left', hz: GL_POSITION_MAX_HZ, pitchPerPx: GL_PITCH_DEG_PER_PX,
    decel: MOMENTUM_DECELERATION, minFling: MIN_FLING_VELOCITY, maxFling: MAX_FLING_VELOCITY, maxDt: GL_MAX_FRAME_MS, rubberFactor: RUBBER_BAND_FACTOR, rubberMax: RUBBER_BAND_MAX_DP, spring: SPRING_BACK_SPEED, wrapThreshold: WRAP_THRESHOLD_DP,
  };
  const json = JSON.stringify(config).replace(/</g, '\\u003c');   // a "<" inside the data can never close the script tag
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">'
    + '<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}canvas{display:block;width:100%;height:100%;touch-action:none;background:transparent}</style></head>'
    + `<body><canvas id="c"></canvas><script type="application/json" id="cfg">${json}</script><script>${GL_MATH_SOURCE}${RENDERER_SOURCE}</script></body></html>`;
}
