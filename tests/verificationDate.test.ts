/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { formatVerificationDate } from '../src/features/admin-moderation/models/AdminVerification';
import { formatVerificationDate as sharedFormatter } from '../src/shared/utils/formatVerificationDate';

test('Admin reuses the shared verification formatter without a duplicate implementation', () => assert.equal(formatVerificationDate, sharedFormatter));
test('invalid timestamps use a safe placeholder rather than crashing a screen', () => assert.equal(formatVerificationDate('invalid'), 'Date unavailable'));

test('reported UTC submission shows 7:41 PM Philippine time, not emulator GMT 11:41 AM', () => {
  assert.equal(formatVerificationDate('2026-10-21T11:41:27.883577+00:00'), 'Oct 21, 2026, 7:41:27 PM PHT');
});
test('Philippine morning and noon use the correct AM/PM markers', () => {
  assert.equal(formatVerificationDate('2026-10-20T23:05:00Z'), 'Oct 21, 2026, 7:05:00 AM PHT');
  assert.equal(formatVerificationDate('2026-10-21T04:00:00Z'), 'Oct 21, 2026, 12:00:00 PM PHT');
});
test('UTC date boundaries become the next Philippine day/year with midnight AM', () => {
  assert.equal(formatVerificationDate('2026-10-21T16:00:00Z'), 'Oct 22, 2026, 12:00:00 AM PHT');
  assert.equal(formatVerificationDate('2026-12-31T23:59:59Z'), 'Jan 1, 2027, 7:59:59 AM PHT');
});
test('equivalent timestamp offsets represent the same instant without double conversion', () => {
  assert.equal(formatVerificationDate('2026-10-21T19:41:27.883+08:00'), formatVerificationDate('2026-10-21T11:41:27.883Z'));
});
test('verification display is independent of device/host default timezone', () => {
  // Load in fresh processes: cached Intl formatters capture the default zone at construction.
  const script = `
    const ts = require('typescript');
    const source = require('node:fs').readFileSync('src/shared/utils/formatVerificationDate.ts', 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    new Function('exports', compiled)(exports);
    process.stdout.write(exports.formatVerificationDate('2026-10-21T11:41:27Z'));
  `;
  for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Manila']) {
    const result = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'Oct 21, 2026, 7:41:27 PM PHT');
  }
});
