/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatAuthBootTrace, traceAuthBoot } from '../src/shared/utils/authBootTrace';

test('startup trace formatting includes safe state but drops unrecognized sensitive fields', () => {
  const details = { screen: 'bootstrap', userPresent: true, access_token: 'secret-token', password: 'secret-password', userId: 'private-id' };
  const result = formatAuthBootTrace('VM_STATE', details);
  assert.match(result, /\[AUTH-BOOT\].*VM_STATE/);
  assert.match(result, /"screen":"bootstrap"/);
  assert.match(result, /"userPresent":true/);
  assert.doesNotMatch(result, /secret|private-id|access_token|password|userId/);
});

test('startup tracing emits nothing outside development', (context) => {
  const globals = globalThis as typeof globalThis & { __DEV__?: boolean };
  const previous = globals.__DEV__;
  globals.__DEV__ = false;
  const output = context.mock.method(console, 'info', () => {});
  try {
    traceAuthBoot('APP_MOUNT', { userPresent: true });
    assert.equal(output.mock.callCount(), 0);
  } finally {
    if (previous === undefined) delete globals.__DEV__;
    else globals.__DEV__ = previous;
  }
});
