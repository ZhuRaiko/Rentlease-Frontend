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

test('a superseded bootstrap cannot clear the replacement error and hide Retry', async () => {
  let finishOld!: (value: string) => void;
  let loads = 0;
  const ui = { screen: 'bootstrap', state: 'loading', message: '' };
  const sync = createAccountSynchronization({
    load: () => ++loads === 1
      ? new Promise<string>((resolve) => { finishOld = resolve; })
      : Promise.reject(new Error('profile unavailable')),
    apply: () => { ui.screen = 'profile'; ui.state = 'success'; },
    clear: () => { ui.screen = 'welcome'; ui.state = 'success'; },
    onError: (error) => { ui.state = 'error'; ui.message = (error as Error).message; },
  });
  sync.bootstrap();
  sync.handleEvent('SIGNED_IN', 'restored-user');
  await tick();
  assert.equal(ui.state, 'error');
  finishOld('stale-account');
  await tick();
  assert.deepEqual(ui, { screen: 'bootstrap', state: 'error', message: 'profile unavailable' });
  sync.dispose();
});

test('a replacement account load can resolve startup even if the original never settles', async () => {
  let loads = 0;
  const ui = { screen: 'bootstrap', state: 'loading' };
  const sync = createAccountSynchronization({
    load: () => ++loads === 1 ? new Promise<string>(() => {}) : Promise.resolve('restored'),
    apply: () => { ui.screen = 'profile'; ui.state = 'success'; },
    clear: () => { ui.screen = 'welcome'; },
    onError: () => { ui.state = 'error'; },
  });
  sync.bootstrap();
  sync.handleEvent('USER_UPDATED', 'restored-user');
  await tick();
  assert.deepEqual(ui, { screen: 'profile', state: 'success' });
  sync.dispose();
});

test('a hung bootstrap reaches a recoverable error and Retry can load an account', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let finishOld!: (value: string) => void;
  let loads = 0;
  const applied: string[] = [];
  const errors: unknown[] = [];
  const sync = createAccountSynchronization({
    timeoutMs: 100,
    load: () => ++loads === 1 ? new Promise<string>((resolve) => { finishOld = resolve; }) : Promise.resolve('retry-account'),
    apply: (value) => { if (value) applied.push(value); },
    clear: () => {}, onError: (error) => { errors.push(error); },
  });
  sync.bootstrap();
  context.mock.timers.tick(100);
  assert.equal(errors.length, 1);
  assert.match((errors[0] as Error).message, /timed out/i);
  sync.bootstrap();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(applied, ['retry-account']);
  finishOld('too-late');
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(applied, ['retry-account']);
  sync.dispose();
});

test('startup notifications cannot keep extending the initial completion deadline', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const errors: unknown[] = [];
  const sync = createAccountSynchronization({
    timeoutMs: 100,
    load: () => new Promise<string>(() => {}),
    apply: () => {}, clear: () => {}, onError: (error) => { errors.push(error); },
  });
  sync.bootstrap();
  context.mock.timers.tick(40);
  sync.handleEvent('USER_UPDATED', 'user');
  context.mock.timers.tick(0);
  context.mock.timers.tick(40);
  sync.handleEvent('USER_UPDATED', 'user');
  context.mock.timers.tick(0);
  context.mock.timers.tick(20);
  assert.equal(errors.length, 1);
  sync.dispose();
});

test('sign-out and cleanup cancel the initial deadline without later error presentation', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let clears = 0;
  const errors: unknown[] = [];
  const sync = createAccountSynchronization({
    timeoutMs: 100,
    load: () => new Promise<string>(() => {}),
    apply: () => {}, clear: () => { clears++; }, onError: (error) => { errors.push(error); },
  });
  sync.bootstrap();
  sync.handleEvent('SIGNED_OUT', null);
  context.mock.timers.tick(100);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(clears, 1);
  assert.deepEqual(errors, []);
  sync.bootstrap();
  sync.dispose();
  context.mock.timers.tick(100);
  assert.deepEqual(errors, []);
});

test('an initial account-load error resolves startup through the error callback', async () => {
  const failure = new Error('roles unavailable');
  const errors: unknown[] = [];
  const sync = createAccountSynchronization({
    load: async () => { throw failure; },
    apply: () => assert.fail('An unsuccessful read must not authenticate'),
    clear: () => {}, onError: (error) => { errors.push(error); },
  });
  sync.bootstrap();
  await tick();
  assert.deepEqual(errors, [failure]);
  sync.dispose();
});

test('a restored signed-out session resolves startup and cancels its deadline', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let signedOut = false;
  const errors: unknown[] = [];
  const sync = createAccountSynchronization({
    timeoutMs: 100,
    load: async () => null,
    apply: (value) => { signedOut = value === null; },
    clear: () => {}, onError: (error) => { errors.push(error); },
  });
  sync.bootstrap();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(signedOut, true);
  context.mock.timers.tick(100);
  assert.deepEqual(errors, []);
  sync.dispose();
});
