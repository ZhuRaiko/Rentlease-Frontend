/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSelectedDocument, normalizeDocumentSelection } from '../src/shared/models/SelectedDocument';
import { createVerificationDocumentPath } from '../src/shared/services/supabase/storage/verificationDocumentPath';

test('selection normalizes optional metadata without inventing MIME or size', () => {
  assert.deepEqual(normalizeSelectedDocument({ uri: 'file:///cache/document', name: 'ID' }), {
    uri: 'file:///cache/document', fileName: 'ID', mimeType: null, size: null,
  });
});

test('selection preserves original metadata including zero size', () => {
  assert.deepEqual(normalizeSelectedDocument({ uri: 'file:///cache/id', name: 'my ID.pdf', mimeType: 'application/pdf', size: 0 }), {
    uri: 'file:///cache/id', fileName: 'my ID.pdf', mimeType: 'application/pdf', size: 0,
  });
});

test('selection rejects missing URI and normalizes invalid optional size', () => {
  assert.throws(() => normalizeSelectedDocument({ uri: '', name: 'ID' }));
  assert.equal(normalizeSelectedDocument({ uri: 'file:///id', name: 'ID', size: -1 }).size, null);
});

test('picker cancellation is a normal null result', () => {
  assert.equal(normalizeDocumentSelection({ canceled: true, assets: null }), null);
});

test('successful picker selection preserves the exact cached asset URI rather than deriving a path from its filename', () => {
  const uri = 'file:///app/cache/DocumentPicker/unique%20file.jpeg';
  const document = normalizeDocumentSelection({ canceled: false, assets: [
    { uri, name: 'images (1).jpeg', mimeType: 'image/jpeg', size: 44619 },
  ] });
  assert.equal(document?.uri, uri);
  assert.equal(document?.fileName, 'images (1).jpeg');
});

test('a successful selection without an asset is a failure, not cancellation', () => {
  assert.throws(() => normalizeDocumentSelection({ canceled: false, assets: [] }), /Picker returned no document/);
});

const userId = '11111111-1111-4111-8111-111111111111';
const submissionId = '22222222-2222-4222-8222-222222222222';
const uniqueId = '33333333-3333-4333-8333-333333333333';

test('Storage path uses the user/submission namespace and unique safe filename', () => {
  const path = createVerificationDocumentPath({ userId, submissionId, fileName: '../../Private ID.PDF', uniqueId });
  assert.equal(path, `${userId}/${submissionId}/${uniqueId}.pdf`);
  assert.equal(path.includes('Private'), false);
});

test('unsafe or missing submission identifiers are rejected before upload', () => {
  for (const invalid of ['', '../another-user', 'property-1']) {
    assert.throws(() => createVerificationDocumentPath({ userId, submissionId: invalid, fileName: 'ID', uniqueId }));
  }
});

test('different unique identifiers produce different keys, and arbitrary filename suffixes are not copied', () => {
  const one = createVerificationDocumentPath({ userId, submissionId, fileName: 'ID.unsafe/extension', uniqueId });
  const two = createVerificationDocumentPath({ userId, submissionId, fileName: 'ID.unsafe/extension', uniqueId: userId });
  assert.notEqual(one, two);
  assert.equal(one, `${userId}/${submissionId}/${uniqueId}`);
});
