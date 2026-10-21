/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { traceTierTwoDiagnostic, tierTwoUriScheme, tierTwoUriDiagnostics } from '../src/shared/utils/tierTwoDiagnostics';

test('Tier 2 diagnostic URI helper exposes only the scheme', () => {
  assert.equal(tierTwoUriScheme('file:///private/ID.pdf'), 'file');
  assert.equal(tierTwoUriScheme('content://private/123'), 'content');
  assert.equal(tierTwoUriScheme('/private/path'), 'unknown');
});
test('cache diagnostics expose only scheme and a path-segment marker, not the actual URI', () => {
  assert.deepEqual(tierTwoUriDiagnostics('file:///data/user/0/private.app/cache/DocumentPicker/private.jpeg'), { uriScheme: 'file', isCacheUri: true });
  assert.deepEqual(tierTwoUriDiagnostics('file:///private/document.jpeg'), { uriScheme: 'file', isCacheUri: false });
  assert.deepEqual(tierTwoUriDiagnostics('file:///private/cache-image.jpeg?path=/cache/'), { uriScheme: 'file', isCacheUri: false });
  assert.deepEqual(tierTwoUriDiagnostics('content://provider/images/12'), { uriScheme: 'content', isCacheUri: false });
});
test('Tier 2 diagnostics are silent outside development', (context) => {
  const globals = globalThis as typeof globalThis & { __DEV__?: boolean };
  const previous = globals.__DEV__;
  const output = context.mock.method(console, 'info', () => {});
  try {
    globals.__DEV__ = false;
    traceTierTwoDiagnostic('AUTH_START');
    delete globals.__DEV__;
    traceTierTwoDiagnostic('AUTH_START');
    assert.equal(output.mock.callCount(), 0);
  } finally { if (previous === undefined) delete globals.__DEV__; else globals.__DEV__ = previous; }
});
test('Tier 2 diagnostics whitelist fields and sanitize raw error text without serializing errors', (context) => {
  const globals = globalThis as typeof globalThis & { __DEV__?: boolean };
  const previous = globals.__DEV__;
  const lines: string[] = [];
  context.mock.method(console, 'info', (...args: unknown[]) => { lines.push(args.join(' ')); });
  try {
    globals.__DEV__ = true;
    traceTierTwoDiagnostic('STORAGE_UPLOAD_ERROR', {
      bucket: 'verification-documents', storagePath: 'user/submission/unique.pdf',
      ...{ access_token: 'secret-token', uri: 'file:///private/ID.pdf', contents: 'secret-document' },
    }, {
      name: 'StorageApiError', message: 'Denied file:///private/ID.pdf file:/private/ID.pdf content:/private/ID.pdf data:secret-document https://host/object?token=secret Bearer private-token access_token=secret-value {"refresh_token":"secret-json"}',
      status: 403, statusCode: '403', code: 'denied', headers: { Authorization: 'private-token' },
      stack: 'secret-stack', cause: { password: 'secret-password' },
    });
    assert.match(lines[0]!, /\[TIER2-DIAG\] STORAGE_UPLOAD_ERROR/);
    assert.match(lines[0]!, /"status":403/);
    assert.match(lines[0]!, /"statusCode":"403"/);
    assert.match(lines[0]!, /"code":"denied"/);
    assert.match(lines[0]!, /user\/submission\/unique.pdf/);
    assert.doesNotMatch(lines[0]!, /private\/ID|private-token|secret|headers|stack|cause|contents/);
  } finally { if (previous === undefined) delete globals.__DEV__; else globals.__DEV__ = previous; }
});
test('diagnostic logger failures cannot change the operation being instrumented', (context) => {
  const globals = globalThis as typeof globalThis & { __DEV__?: boolean };
  const previous = globals.__DEV__;
  context.mock.method(console, 'info', () => { throw Error('logger unavailable'); });
  try { globals.__DEV__ = true; assert.doesNotThrow(() => traceTierTwoDiagnostic('AUTH_START')); }
  finally { if (previous === undefined) delete globals.__DEV__; else globals.__DEV__ = previous; }
});
