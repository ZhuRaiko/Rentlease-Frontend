/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOnboardingStatusCheck } from '../src/features/authentication/viewModels/onboardingStatusCheck';

test('onboarding foreground checks are scoped, throttled and never overlap', async () => {
  let now = 0, calls = 0;
  let resolve!: () => void;
  const checker = createOnboardingStatusCheck(() => { calls++; return new Promise<void>(r => { resolve = r; }); }, () => now);
  assert.equal(await checker.check(false), false);
  const first = checker.check(true);
  assert.equal(await checker.check(true), false);
  assert.equal(calls, 1);
  resolve(); assert.equal(await first, true);
  now = 29_999; assert.equal(await checker.check(true), false);
  now = 30_000; const second = checker.check(true); assert.equal(calls, 2); resolve(); await second;
});

test('automatic check failure allows explicit recovery and disposal prevents later checks', async () => {
  let calls = 0, now = 0;
  const checker = createOnboardingStatusCheck(async () => { calls++; throw new Error('offline'); }, () => now);
  assert.equal(await checker.check(true), false);
  now = 30_000; assert.equal(await checker.check(true), false);
  assert.equal(calls, 2);
  checker.dispose(); now = 60_000;
  assert.equal(await checker.check(true), false); assert.equal(calls, 2);
});
