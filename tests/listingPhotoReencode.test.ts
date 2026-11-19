/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PHOTO_FAILED_MESSAGE, PropertyPhotoError } from '../src/features/property-listing/models/PropertyPhoto';
import { PHOTO_JPEG_QUALITY, PHOTO_MAX_EDGE_PX, PHOTO_ORIGINAL_MAX_BYTES, PHOTO_REENCODED_MIME, orientationFixFor, orientationOps, readJpegOrientation, readJpegSize, resizeTarget, swapsAxes } from '../src/features/property-listing/models/PropertyPhotoReencode';
import { createListingPhotoPreparer, type ManipulatorModule, type PreparerDeps } from '../src/features/property-listing/services/listingPhotoPreparer';

// ---- synthetic JPEG headers (no real image data: only the segments the readers look at) ----
function jpegHeader(options: { width: number; height: number; orientation?: number; little?: boolean; exif?: boolean }): Uint8Array {
  const bytes: number[] = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0];   // SOI + a JFIF segment to skip
  if (options.exif !== false && options.orientation !== undefined) {
    const little = options.little ?? false, w16 = (v: number) => little ? [v & 255, v >> 8] : [v >> 8, v & 255], w32 = (v: number) => little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255];
    const tiff = [...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...w16(42), ...w32(8), ...w16(1), ...w16(0x0112), ...w16(3), ...w32(1), ...w16(options.orientation), 0, 0, ...w32(0)];
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff], length = body.length + 2;
    bytes.push(0xff, 0xe1, length >> 8, length & 255, ...body);
  }
  bytes.push(0xff, 0xe2, 0x00, 0x04, 0x41, 0x42);   // an APP2 to skip
  bytes.push(0xff, 0xc0, 0x00, 0x11, 8, options.height >> 8, options.height & 255, options.width >> 8, options.width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1);
  return new Uint8Array(bytes);
}
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

// ---- pure rules ----
test('resize target: the longest edge at most 2560, aspect kept by letting the other edge follow, and never enlarged', () => {
  assert.equal(PHOTO_MAX_EDGE_PX, 2560); assert.equal(PHOTO_JPEG_QUALITY, 0.85); assert.equal(PHOTO_REENCODED_MIME, 'image/jpeg');
  assert.deepEqual(resizeTarget(4000, 3000), { width: 2560 }); assert.deepEqual(resizeTarget(3072, 4096), { height: 2560 }); assert.deepEqual(resizeTarget(6144, 1436), { width: 2560 });
  assert.equal(resizeTarget(2560, 1920), null, 'exactly 2560 needs nothing'); assert.equal(resizeTarget(2000, 1500), null, 'never enlarged'); assert.deepEqual(resizeTarget(1000, 2561), { height: 2560 });
  assert.deepEqual(resizeTarget(4000, 4000), { width: 2560 }); assert.equal(resizeTarget(0, 100), null); assert.equal(resizeTarget(Number.NaN, 5000), null);
  assert.equal(PHOTO_ORIGINAL_MAX_BYTES, 50 * 1024 * 1024);
});
test('stored size and EXIF orientation are read from the JPEG header, in both byte orders; no tag or no EXIF means null', () => {
  assert.deepEqual(readJpegSize(jpegHeader({ width: 4096, height: 3072, orientation: 6 })), { width: 4096, height: 3072 });
  for (const little of [false, true]) for (const o of [1, 2, 3, 4, 5, 6, 7, 8]) assert.equal(readJpegOrientation(jpegHeader({ width: 10, height: 20, orientation: o, little })), o, `orientation ${o} little=${little}`);
  assert.equal(readJpegOrientation(jpegHeader({ width: 10, height: 20 })), null); assert.equal(readJpegOrientation(jpegHeader({ width: 10, height: 20, orientation: 9 })), null, 'out of range'); assert.equal(readJpegOrientation(png), null);
  assert.equal(readJpegSize(png), null); assert.equal(readJpegSize(new Uint8Array([0xff, 0xd8])), null); assert.equal(readJpegSize(new Uint8Array(0)), null);
  assert.equal(readJpegOrientation(jpegHeader({ width: 10, height: 20, orientation: 6 }).slice(0, 30)), null, 'a header cut short is not guessed at');
});
test('orientation steps turn a stored picture upright, and only the quarter-turn ones swap width and height', () => {
  assert.deepEqual(orientationOps(1), []); assert.deepEqual(orientationOps(null), []); assert.deepEqual(orientationOps(6), [{ rotate: 90 }]); assert.deepEqual(orientationOps(8), [{ rotate: 270 }]); assert.deepEqual(orientationOps(3), [{ rotate: 180 }]);
  assert.deepEqual(orientationOps(2), [{ flip: 'horizontal' }]); assert.deepEqual(orientationOps(4), [{ flip: 'vertical' }]); assert.deepEqual(orientationOps(5), [{ flip: 'horizontal' }, { rotate: 270 }]); assert.deepEqual(orientationOps(7), [{ flip: 'horizontal' }, { rotate: 90 }]);
  for (const o of [5, 6, 7, 8]) assert.equal(swapsAxes(o), true); for (const o of [null, 1, 2, 3, 4]) assert.equal(swapsAxes(o), false);
});
test('orientation check: a quarter-turn photo that came out sideways is corrected; one the loader already turned is left alone', () => {
  const stored = { width: 4096, height: 3072 };   // stored landscape, orientation 6 = shows as portrait
  assert.deepEqual(orientationFixFor(stored, 6, { width: 3072, height: 4096 }), [], 'already upright');
  assert.deepEqual(orientationFixFor(stored, 6, { width: 4096, height: 3072 }), [{ rotate: 90 }], 'came out sideways');
  assert.deepEqual(orientationFixFor(stored, 8, { width: 2560, height: 1920 }), [{ rotate: 270 }]);
  assert.deepEqual(orientationFixFor(stored, 1, { width: 2560, height: 1920 }), [], 'no orientation, no change');
  assert.deepEqual(orientationFixFor({ width: 3072, height: 4096 }, 6, { width: 4096, height: 3072 }), [], 'stored portrait + tag 6 shows landscape: that is what the result is');
  assert.deepEqual(orientationFixFor(null, 6, { width: 4096, height: 3072 }), [], 'unknown stored size: trust the loader'); assert.deepEqual(orientationFixFor({ width: 3000, height: 3000 }, 6, { width: 3000, height: 3000 }), [], 'a square cannot be told');
  assert.deepEqual(orientationFixFor(stored, 3, { width: 4096, height: 3072 }), [], 'a half turn keeps the shape, so it relies on the loader');
});

// ---- the preparer, with a fake manipulator that records every call and can behave like a loader that does or does not apply the orientation ----
const JPEG = Symbol('jpeg');
function setup(options: { header?: Uint8Array | null | 'throw'; decoded?: { width: number; height: number }; failAt?: 'manipulate' | 'render' | 'save' | 'read' | 'empty'; module?: boolean } = {}) {
  const log: string[] = [], released: string[] = [], contexts: { source: string; ops: string[]; resize?: unknown }[] = [], removed: string[] = [], read: string[] = [];
  let saved: { options: { format: unknown; compress: number }; width: number; height: number } | null = null;
  const refOf = (width: number, height: number) => ({ width, height, release: () => { released.push('ref'); }, saveAsync: async (o: { format: unknown; compress: number }) => { if (options.failAt === 'save') throw new Error('save failed'); saved = { options: o, width, height }; return { uri: 'file:///cache/out.jpg', width, height }; } });
  const decoded = options.decoded ?? { width: 4000, height: 3000 };
  const mod: ManipulatorModule = {
    SaveFormat: { JPEG },
    ImageManipulator: { manipulate: (source: string | { width: number; height: number }) => {
      if (options.failAt === 'manipulate') throw new Error('no manipulator');
      const entry: { source: string; ops: string[]; resize?: unknown } = { source: typeof source === 'string' ? source : 'ref', ops: [] }; contexts.push(entry); log.push(`manipulate:${entry.source}`);
      const ctx: any = { resize: (size: unknown) => { entry.resize = size; return ctx; }, rotate: (d: number) => { entry.ops.push(`rotate:${d}`); return ctx; }, flip: (t: string) => { entry.ops.push(`flip:${t}`); return ctx; }, release: () => { released.push('ctx'); },
        renderAsync: async () => {
          if (options.failAt === 'render') throw new Error('render failed');
          let { width, height } = typeof source === 'string' ? decoded : source;
          const size = entry.resize as { width?: number; height?: number } | undefined;
          if (size?.width) { height = Math.round(height * size.width / width); width = size.width; } else if (size?.height) { width = Math.round(width * size.height / height); height = size.height; }
          for (const op of entry.ops) if (op === 'rotate:90' || op === 'rotate:270') [width, height] = [height, width];
          return refOf(width, height);
        } };
      return ctx;
    } },
  };
  const deps: PreparerDeps = {
    loadManipulator: () => options.module === false ? null : mod,
    readHeader: () => { if (options.header === 'throw') throw new Error('cannot read'); return options.header === undefined ? jpegHeader({ width: 4000, height: 3000, orientation: 1 }) : options.header; },
    readBytes: async uri => { read.push(uri); if (options.failAt === 'read') throw new Error('read failed'); return options.failAt === 'empty' ? new ArrayBuffer(0) : new ArrayBuffer(42); },
    remove: uri => { removed.push(uri); },
  };
  const file = { uri: 'file:///cache/original.jpg', fileName: 'original.jpg', mimeType: 'image/jpeg', size: 9_000_000 };
  return { prepare: createListingPhotoPreparer(deps), file, contexts, released, removed, read, saved: () => saved, log };
}

test('re-encode: a portrait phone photo is resized by its LONG edge, saved as a JPEG at quality 0.85 and handed back as the upload', async () => {
  const s = setup({ header: jpegHeader({ width: 4096, height: 3072, orientation: 6 }), decoded: { width: 3072, height: 4096 } });   // the loader applied the orientation
  const out = await s.prepare(s.file);
  assert.equal(out.mime, 'image/jpeg'); assert.equal(out.body.byteLength, 42);
  assert.equal(s.contexts.length, 1, 'one pass'); assert.deepEqual(s.contexts[0]!.resize, { height: 2560 }); assert.equal(s.contexts[0]!.source, s.file.uri);
  assert.deepEqual(s.saved()!.options, { format: JPEG, compress: 0.85 }); assert.deepEqual([s.saved()!.width, s.saved()!.height], [1920, 2560]);
});
test('re-encode: a landscape photo is resized by its width; a photo already within 2560 is not resized or enlarged', async () => {
  const wide = setup({ header: jpegHeader({ width: 4000, height: 3000, orientation: 1 }) }); await wide.prepare(wide.file);
  assert.deepEqual(wide.contexts[0]!.resize, { width: 2560 }); assert.deepEqual([wide.saved()!.width, wide.saved()!.height], [2560, 1920]);
  const small = setup({ header: jpegHeader({ width: 2000, height: 1500, orientation: 1 }), decoded: { width: 2000, height: 1500 } }); await small.prepare(small.file);
  assert.equal(small.contexts[0]!.resize, undefined, 'no resize'); assert.deepEqual([small.saved()!.width, small.saved()!.height], [2000, 1500]); assert.equal(small.saved()!.options.compress, 0.85, 'still re-encoded, so the metadata is still dropped');
});
test('orientation: when the loader leaves a quarter-turn photo sideways the photo is turned explicitly, and the long edge is still at most 2560', async () => {
  const s = setup({ header: jpegHeader({ width: 4096, height: 3072, orientation: 6 }), decoded: { width: 4096, height: 3072 } });   // the loader did NOT apply the orientation
  await s.prepare(s.file);
  assert.deepEqual(s.contexts.map(c => c.source), [s.file.uri, 'ref', 'ref'], 'decode, turn, then bring the long edge back to 2560');
  assert.deepEqual(s.contexts[1]!.ops, ['rotate:90']); assert.ok(s.saved()!.height > s.saved()!.width, 'portrait on save'); assert.equal(Math.max(s.saved()!.width, s.saved()!.height), 2560);
  const left = setup({ header: jpegHeader({ width: 4096, height: 3072, orientation: 8 }), decoded: { width: 4096, height: 3072 } }); await left.prepare(left.file); assert.deepEqual(left.contexts[1]!.ops, ['rotate:270']);
  const five = setup({ header: jpegHeader({ width: 4096, height: 3072, orientation: 5 }), decoded: { width: 4096, height: 3072 } }); await five.prepare(five.file); assert.deepEqual(five.contexts[1]!.ops, ['flip:horizontal', 'rotate:270']);
  const seven = setup({ header: jpegHeader({ width: 4096, height: 3072, orientation: 7 }), decoded: { width: 4096, height: 3072 } }); await seven.prepare(seven.file); assert.deepEqual(seven.contexts[1]!.ops, ['flip:horizontal', 'rotate:90']);
});
test('orientation: when the loader already applied it, there is no extra turn; a landscape photo with no tag is untouched', async () => {
  const done = setup({ header: jpegHeader({ width: 4096, height: 3072, orientation: 6 }), decoded: { width: 3072, height: 4096 } }); await done.prepare(done.file);
  assert.ok(done.contexts.every(c => c.ops.length === 0), 'no rotate or flip');
  const plain = setup({ header: jpegHeader({ width: 4000, height: 3000, orientation: 1 }) }); await plain.prepare(plain.file); assert.ok(plain.contexts.every(c => c.ops.length === 0));
});
test('a PNG or WebP pick (no JPEG header to read) is decoded, brought to 2560 if larger, and saved as a JPEG', async () => {
  const big = setup({ header: png, decoded: { width: 3000, height: 2000 } }); const out = await big.prepare({ ...big.file, uri: 'file:///cache/pick.png', mimeType: 'image/png' });
  assert.equal(out.mime, 'image/jpeg'); assert.deepEqual(big.contexts.map(c => c.resize), [undefined, { width: 2560 }]); assert.deepEqual([big.saved()!.width, big.saved()!.height], [2560, 1707]); assert.deepEqual(big.saved()!.options, { format: JPEG, compress: 0.85 });
  const small = setup({ header: png, decoded: { width: 2000, height: 1000 } }); await small.prepare({ ...small.file, mimeType: 'image/webp' }); assert.equal(small.contexts.length, 1); assert.deepEqual([small.saved()!.width, small.saved()!.height], [2000, 1000]);
});
test('a header that cannot be read is not fatal: the size is found by decoding', async () => {
  const s = setup({ header: 'throw', decoded: { width: 4000, height: 3000 } }); await s.prepare(s.file);
  assert.deepEqual(s.contexts.map(c => c.resize), [undefined, { width: 2560 }]);
});
test('the temporary copy is deleted, native objects are released, and only the re-encoded file is ever read', async () => {
  const s = setup(); await s.prepare(s.file);
  assert.deepEqual(s.removed, ['file:///cache/out.jpg']); assert.ok(s.released.length >= 2, 'contexts and refs released'); assert.deepEqual(s.read, ['file:///cache/out.jpg'], 'the original file is never read as the upload');
});
test('fail closed: any failure throws the existing failed-photo error and the original bytes are never read or returned', async () => {
  for (const failAt of ['manipulate', 'render', 'save', 'read', 'empty'] as const) {
    const s = setup({ failAt });
    await assert.rejects(s.prepare(s.file), (error: unknown) => error instanceof PropertyPhotoError && error.message === PHOTO_FAILED_MESSAGE && !error.reconcile, failAt);
    assert.ok(!s.read.includes(s.file.uri), `${failAt}: the original was not read`);
  }
});
test('fail closed: with the native module missing from the build nothing is read and the same error is thrown', async () => {
  const s = setup({ module: false });
  await assert.rejects(s.prepare(s.file), (error: unknown) => error instanceof PropertyPhotoError && error.message === PHOTO_FAILED_MESSAGE); assert.deepEqual(s.read, []); assert.deepEqual(s.contexts, []);
});

// Source check (the one test that reads source text, because "never a top-level import" cannot be observed any other way): the native module is required lazily.
test('expo-image-manipulator is never imported at the top level of the listing photo code (a build without it must not break the listing flow)', () => {
  for (const file of ['src/features/property-listing/services/propertyPhotoDependencies.ts', 'src/features/property-listing/services/listingPhotoPreparer.ts', 'src/features/property-listing/models/PropertyPhotoReencode.ts']) {
    const source = readFileSync(file, 'utf8'); assert.ok(!/^\s*import[^;]*from\s+['"]expo-image-manipulator['"]/m.test(source), `${file} imports it at the top level`);
  }
  const dependencies = readFileSync('src/features/property-listing/services/propertyPhotoDependencies.ts', 'utf8');
  assert.match(dependencies, /try\s*\{\s*return require\('expo-image-manipulator'\)/); assert.ok(!/\bread:\s*file\s*=>/.test(dependencies), 'the original bytes are no longer the upload');
});
