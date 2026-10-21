/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { localImagePreviewReducer, isPreviewImage, fitImage, constrainTransform, zoomAt, panImage, initialImageTransform } from '../src/shared/models/documentImagePreview';

const document = Object.freeze({ uri: 'file:///cache/test.jpeg', fileName: 'test.jpeg', mimeType: 'image/jpeg', size: 123 });
test('local preview opens only supported images and closes without changing document or form data', () => {
  const form = Object.freeze({ document, type: 'land_title', propertyId: 'property-one', screen: 'review' });
  const open = localImagePreviewReducer(null, { type: 'open', document }); assert.equal(open, document);
  assert.equal(localImagePreviewReducer(open, { type: 'close' }), null);
  assert.deepEqual(form, { document, type: 'land_title', propertyId: 'property-one', screen: 'review' });
  for (const mimeType of ['application/pdf', 'image/svg+xml', 'image/gif', null]) assert.equal(localImagePreviewReducer(null, { type: 'open', document: { ...document, mimeType } }), null);
});
test('switching documents uses the new source and image support does not guess from extensions', () => {
  const second = { ...document, uri: 'file:///cache/other.png', mimeType: 'image/png' };
  const first = localImagePreviewReducer(null, { type: 'open', document }); assert.equal(localImagePreviewReducer(first, { type: 'open', document: second }), second);
  assert.equal(isPreviewImage(null), false); assert.equal(isPreviewImage('IMAGE/JPEG'), true);
});
test('images fit in the viewing area without distortion', () => {
  assert.deepEqual(fitImage({ width: 400, height: 600 }, { width: 2000, height: 1000 }), { width: 400, height: 200 });
  assert.deepEqual(fitImage({ width: 400, height: 600 }, { width: 1000, height: 2000 }), { width: 300, height: 600 });
});
test('pinch/double tap zoom preserves the focal point and clamps supported magnification', () => {
  const viewport = { width: 400, height: 600 }; const image = { width: 400, height: 600 };
  assert.deepEqual(zoomAt(initialImageTransform, 2, { x: 100, y: 150 }, viewport, image), { scale: 2, x: 100, y: 150 });
  assert.equal(zoomAt(initialImageTransform, 100, { x: 200, y: 300 }, viewport, image).scale, 8);
  assert.deepEqual(zoomAt({ scale: 3, x: 80, y: 40 }, .2, { x: 20, y: 20 }, viewport, image), initialImageTransform);
});
test('panning stays within enlarged content bounds and resets to fit at minimum scale', () => {
  const viewport = { width: 400, height: 600 }; const image = { width: 400, height: 300 };
  assert.deepEqual(panImage({ scale: 2, x: 0, y: 0 }, 900, 900, viewport, image), { scale: 2, x: 200, y: 0 });
  assert.deepEqual(constrainTransform({ scale: 1, x: 99, y: -99 }, viewport, image), initialImageTransform);
});
test('fresh viewer sessions start at fit with no offsets', () => assert.deepEqual(initialImageTransform, { scale: 1, x: 0, y: 0 }));
test('moving pinch constrains after combining scale and focal movement to avoid edge drift', () => {
  const viewport = { width: 400, height: 600 };
  assert.deepEqual(zoomAt({ scale: 4, x: 600, y: 0 }, 2, { x: 400, y: 300 }, viewport, viewport, { x: -100, y: 0 }), { scale: 2, x: 200, y: 0 });
  assert.deepEqual(zoomAt({ scale: 4, x: 600, y: 0 }, 2, { x: 400, y: 300 }, viewport, viewport, { x: -300, y: 0 }), { scale: 2, x: 100, y: 0 });
});
test('fullscreen Modal Android Back and visible Close route only to the supplied close callback', () => {
  const path = resolve('src/shared/components/FullscreenDocumentImage.tsx');
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const attributes: Array<[string, string]> = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) attributes.push([node.name.getText(source), node.initializer.expression.getText(source)]);
    ts.forEachChild(node, visit);
  }; visit(source);
  assert.ok(attributes.some(([name, value]) => name === 'onRequestClose' && value === 'props.onClose'));
  assert.ok(attributes.some(([name, value]) => name === 'onPress' && value === 'onClose'));
  // Native Back delivery is a device test; this guards callback wiring against accidental feature navigation.
});
