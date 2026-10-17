/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountSynchronization } from '../src/features/authentication/viewModels/accountSynchronization';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

test('Auth callbacks defer and coalesce account loads outside the callback', async () => {
  let loads = 0;
  const applied: string[] = [];
  const sync = createAccountSynchronization({
    load: async () => { loads++; return 'account'; },
    apply: (account) => { if (account) applied.push(account); },
    clear: () => {}, onError: () => {},
  });
  sync.handleEvent('INITIAL_SESSION', 'user');
  sync.handleEvent('SIGNED_IN', 'user');
  sync.handleEvent('USER_UPDATED', 'user');
  assert.equal(loads, 0);
  await tick();
  assert.equal(loads, 1);
  assert.deepEqual(applied, ['account']);
  sync.dispose();
});

test('sign-out invalidates an older account load immediately', async () => {
  let finish!: (value: string) => void;
  const applied: string[] = [];
  let clears = 0;
  const sync = createAccountSynchronization({
    load: () => new Promise<string>((resolve) => { finish = resolve; }),
    apply: (account) => { if (account) applied.push(account); },
    clear: () => { clears++; }, onError: () => {},
  });
  const pending = sync.refresh('explicit');
  sync.handleEvent('SIGNED_OUT', null);
  assert.equal(clears, 1);
  finish('stale-account');
  await pending;
  assert.deepEqual(applied, []);
  sync.dispose();
});

test('explicit mutation suppresses its Auth events and refreshes only when requested', async () => {
  let loads = 0;
  const sync = createAccountSynchronization({
    load: async () => { loads++; return 'account'; },
    apply: () => {}, clear: () => {}, onError: () => {},
  });
  await sync.mutate(async () => {
    sync.handleEvent('SIGNED_IN', 'user');
    sync.handleEvent('USER_UPDATED', 'user');
    await tick();
  });
  await sync.refresh('explicit');
  await tick();
  assert.equal(loads, 1);
  sync.dispose();
});

test('token refresh emitted by an account read cannot cause a reload loop', async () => {
  let loads = 0;
  const sync = createAccountSynchronization({
    load: async () => { loads++; sync.handleEvent('TOKEN_REFRESHED', 'user'); return 'account'; },
    apply: () => {}, clear: () => {}, onError: () => {},
  });
  await sync.refresh('explicit');
  await tick();
  assert.equal(loads, 1);
  sync.dispose();
});

test('cleanup cancels scheduled events and ignores in-flight results', async () => {
  let applied = false;
  let finish!: (value: string) => void;
  const sync = createAccountSynchronization({
    load: () => new Promise<string>((resolve) => { finish = resolve; }),
    apply: () => { applied = true; }, clear: () => {}, onError: () => {},
  });
  const pending = sync.refresh('explicit');
  sync.dispose();
  finish('account');
  await pending;
  sync.handleEvent('SIGNED_IN', 'user');
  await tick();
  assert.equal(applied, false);
});

test('a newer explicit refresh wins over an older read', async () => {
  const finishes: Array<(value: string) => void> = [];
  const applied: string[] = [];
  const sync = createAccountSynchronization({
    load: () => new Promise<string>((resolve) => { finishes.push(resolve); }),
    apply: (value) => { if (value) applied.push(value); }, clear: () => {}, onError: () => {},
  });
  const first = sync.refresh('explicit');
  const second = sync.refresh('explicit');
  finishes[1]!('new');
  await second;
  finishes[0]!('old');
  await first;
  assert.deepEqual(applied, ['new']);
  sync.dispose();
});

test('a different signed-in user invalidates a bootstrap read before it can apply', async () => {
  const finishes: Array<(value: string) => void> = [];
  const applied: string[] = [];
  const sync = createAccountSynchronization({
    load: () => new Promise<string>((resolve) => { finishes.push(resolve); }),
    apply: (value) => { if (value) applied.push(value); }, clear: () => {}, onError: () => {},
  });
  const first = sync.refresh('explicit');
  sync.handleEvent('SIGNED_IN', 'different-user');
  finishes[0]!('old');
  await first;
  assert.deepEqual(applied, []);
  await tick();
  finishes[1]!('new');
  await tick();
  assert.deepEqual(applied, ['new']);
  sync.dispose();
});

test('cleanup cancels a queued event without starting its request', async () => {
  let loads = 0;
  const sync = createAccountSynchronization({
    load: async () => { loads++; return 'account'; },
    apply: () => {}, clear: () => {}, onError: () => {},
  });
  sync.handleEvent('SIGNED_IN', 'user');
  sync.dispose();
  await tick();
  assert.equal(loads, 0);
});

test('background request failures are surfaced once without retry loops', async () => {
  const errors: unknown[] = [];
  const error = new Error('offline');
  const sync = createAccountSynchronization({
    load: async () => { throw error; },
    apply: () => {}, clear: () => {}, onError: (value) => { errors.push(value); },
  });
  sync.handleEvent('SIGNED_IN', 'user');
  await tick();
  assert.deepEqual(errors, [error]);
  sync.dispose();
});
