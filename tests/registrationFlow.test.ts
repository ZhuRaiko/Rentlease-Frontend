/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialRegistrationDraft, type RegistrationDraft } from '../src/features/authentication/models/AuthProfile';
import { advanceRegistration, getRegistrationBackTarget, getRegistrationProgress, registrationDisplayName, validateRegistrationStep, createRegistrationSubmission } from '../src/features/authentication/viewModels/registrationFlow';

const valid: RegistrationDraft = { ...initialRegistrationDraft, firstName: ' Ada ', lastName: ' Santos ', email: ' ADA@example.com ', password: 'abcdefgh', confirmPassword: 'abcdefgh' };
test('local registration questions advance in order without any signup operation', () => {
  let screen = 'registrationName' as const; const first = advanceRegistration(screen, valid); assert.equal(first.screen, 'registrationNickname');
  assert.equal(advanceRegistration('registrationNickname', valid).screen, 'registrationEmail');
  assert.equal(advanceRegistration('registrationEmail', valid).screen, 'registrationPassword');
  assert.equal(advanceRegistration('registrationPassword', valid).screen, 'registrationPassword');
});
test('name requires first and last; optional nickname permits continuation and explicit skip clears it', () => {
  assert.ok(validateRegistrationStep('registrationName', { ...valid, firstName: ' ' }));
  assert.ok(validateRegistrationStep('registrationName', { ...valid, lastName: '' }));
  assert.equal(validateRegistrationStep('registrationNickname', valid), null);
  const result = advanceRegistration('registrationNickname', { ...valid, nickname: 'Old name' }, true);
  assert.equal(result.draft.nickname, ''); assert.equal(result.screen, 'registrationEmail');
  assert.equal(registrationDisplayName(result.draft), 'Ada Santos');
  assert.equal(registrationDisplayName({ ...valid, nickname: '  Ada S  ' }), 'Ada S');
});
test('email validation requires an address and normalizes only the submitted payload', async () => {
  for (const email of ['', 'ada@', '@example.com', 'ada@example', 'ada @example.com']) assert.ok(validateRegistrationStep('registrationEmail', { ...valid, email }));
  assert.equal(validateRegistrationStep('registrationEmail', valid), null);
  const calls: unknown[] = []; const submission = createRegistrationSubmission(async (...args: string[]) => { calls.push(args); return { user: { id: 'u' }, session: null }; });
  await submission.submit(valid); assert.deepEqual(calls, [['ada@example.com', 'abcdefgh', 'Ada Santos']]); assert.equal(valid.email, ' ADA@example.com ');
});
test('short passwords and mismatched confirmation never call signup', async () => {
  let calls = 0; const signup = createRegistrationSubmission(async () => { calls++; return { user: { id: 'u' }, session: null }; });
  for (const draft of [{ ...valid, password: 'short', confirmPassword: 'short' }, { ...valid, confirmPassword: 'different' }]) {
    const result = await signup.submit(draft); assert.equal(result.kind, 'invalid');
  }
  assert.equal(calls, 0); assert.equal(signup.phase(), 'ready');
});
test('back/forward navigation preserves the local draft without mutating its values', () => {
  const draft = Object.freeze({ ...valid, nickname: 'Ada' });
  assert.equal(advanceRegistration('registrationName', draft).draft, draft);
  assert.equal(advanceRegistration('registrationEmail', draft).draft, draft);
  assert.equal(draft.password, valid.password); assert.equal(draft.nickname, 'Ada');
  assert.deepEqual(getRegistrationBackTarget(['welcome', 'registrationName', 'registrationNickname', 'registrationEmail'], 'ready', 'registrationPassword'), { screen: 'registrationEmail', history: ['welcome', 'registrationName', 'registrationNickname'] });
});
test('Back after created/uncertain signup recovers without editing the attempted email or affecting Profile Back', () => {
  for (const phase of ['created', 'uncertain'] as const) {
    assert.deepEqual(getRegistrationBackTarget(['registrationEmail'], phase, 'registrationPassword'), { screen: 'emailConfirmation', history: [] });
    assert.deepEqual(getRegistrationBackTarget(['registrationPassword'], phase, 'signIn'), { screen: 'emailConfirmation', history: [] });
    assert.deepEqual(getRegistrationBackTarget(['profile'], phase, 'editProfile'), { screen: 'profile', history: [] });
  }
});
test('progress tracks the current real stage and never marks current email/SMS verification complete', () => {
  assert.deepEqual(getRegistrationProgress('emailConfirmation'), { step: 5, total: 8, completed: 4 });
  assert.deepEqual(getRegistrationProgress('mobileConfirmation'), { step: 7, total: 8, completed: 6 });
  assert.deepEqual(getRegistrationProgress('verificationPending'), { step: 7, total: 8, completed: 6 });
  assert.deepEqual(getRegistrationProgress('roleSelection'), { step: 8, total: 8, completed: 7 });
  assert.equal(getRegistrationProgress('signIn'), null);
});
test('signup is synchronously excluded while pending and after account creation', async () => {
  let calls = 0; let release!: () => void;
  const signup = createRegistrationSubmission(async () => { calls++; await new Promise<void>(r => { release = r; }); return { user: { id: 'u' }, session: null }; });
  const first = signup.submit(valid); assert.equal(signup.phase(), 'submitting'); assert.equal((await signup.submit(valid)).kind, 'blocked');
  release(); const result = await first; assert.equal(result.kind, 'created'); assert.equal(signup.phase(), 'created');
  assert.equal((await signup.submit(valid)).kind, 'blocked'); assert.equal(calls, 1);
});
test('a no-session signup result is not converted into a confirmed session', async () => {
  const resultData = { user: { id: 'u' }, session: null };
  const signup = createRegistrationSubmission(async () => resultData); const result = await signup.submit(valid);
  assert.equal(result.kind, 'created'); if (result.kind === 'created') assert.equal(result.result, resultData);
});
test('uncertain network outcomes block retry until explicit recovery/reset', async () => {
  let calls = 0; const signup = createRegistrationSubmission(async () => { calls++; throw Error('Network request failed'); });
  assert.equal((await signup.submit(valid)).kind, 'uncertain'); assert.equal(signup.phase(), 'uncertain');
  assert.equal((await signup.submit(valid)).kind, 'blocked'); assert.equal(calls, 1);
  signup.reset(); assert.equal(signup.phase(), 'ready');
});
test('definitive backend validation errors allow corrected manual retry', async () => {
  let calls = 0; const signup = createRegistrationSubmission(async () => { if (++calls === 1) throw { code: 'weak_password', status: 422 }; return { user: { id: 'u' }, session: null }; });
  assert.equal((await signup.submit(valid)).kind, 'error'); assert.equal(signup.phase(), 'ready');
  assert.equal((await signup.submit(valid)).kind, 'created'); assert.equal(calls, 2);
});
test('reset invalidates an obsolete signup result so it cannot restore a prior registration phase', async () => {
  let release!: () => void;
  const signup = createRegistrationSubmission(async () => { await new Promise<void>(r => { release = r; }); return { user: { id: 'old' }, session: null }; });
  const old = signup.submit(valid); signup.reset(); release();
  assert.equal((await old).kind, 'blocked'); assert.equal(signup.phase(), 'ready');
});
