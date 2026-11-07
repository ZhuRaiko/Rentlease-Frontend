import {publicNickname} from '../../../shared/models/PublicIdentity';
import type { AuthProfileScreen, RegistrationDraft, RegistrationIdentityInput } from '../models/AuthProfile';

const questions: AuthProfileScreen[] = ['registrationName', 'registrationNickname', 'registrationEmail', 'registrationPassword', 'emailConfirmation', 'registrationPhone', 'mobileConfirmation'];
export const registrationDisplayName = (draft: RegistrationDraft) => publicNickname(draft.nickname)??'';
export function validateRegistrationStep(screen: AuthProfileScreen, draft: RegistrationDraft): string | null {
  if (screen === 'registrationName' && (!draft.firstName.trim() || !draft.lastName.trim())) return 'Enter your first and last name.';
  if (screen === 'registrationNickname') {
    try { if (publicNickname(draft.nickname) && !draft.publicNameAcknowledged) return 'Confirm that your Display Name will be public.'; } catch { return 'Use 2 to 30 letters or numbers, with spaces, periods, apostrophes, underscores, or hyphens.'; }
  }
  if (screen === 'registrationEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return 'Enter a valid email address, such as name@example.com.';
  if (screen === 'registrationPassword') {
    if (draft.password.length < 8) return 'Use at least 8 characters for your password.';
    if (draft.confirmPassword !== draft.password) return 'Passwords do not match. Enter the same password in both fields.';
  }
  return null;
}
export function advanceRegistration(screen: AuthProfileScreen, draft: RegistrationDraft, skipNickname = false) {
  const candidate = skipNickname && screen === 'registrationNickname' ? { ...draft, nickname: '', publicNameAcknowledged: false } : draft;
  const error = validateRegistrationStep(screen, candidate);
  const next: Partial<Record<AuthProfileScreen, AuthProfileScreen>> = { registrationName: 'registrationNickname', registrationNickname: 'registrationEmail', registrationEmail: 'registrationPassword' };
  return { screen: error ? screen : next[screen] ?? screen, draft: candidate, error };
}
export function getRegistrationProgress(screen: AuthProfileScreen) {
  const index = questions.indexOf(screen === 'verificationPending' ? 'mobileConfirmation' : screen);
  return index < 0 ? null : { step: index + 1, total: questions.length, completed: index };
}

type SignupPhase = 'ready' | 'submitting' | 'created' | 'uncertain';
export function getRegistrationBackTarget(history: AuthProfileScreen[], phase: SignupPhase, screen: AuthProfileScreen) {
  const target = history.at(-1) ?? 'welcome';
  if ((phase === 'created' || phase === 'uncertain') && (questions.slice(0, 4).includes(screen) || questions.slice(0, 4).includes(target))) {
    return { screen: 'emailConfirmation' as const, history: [] as AuthProfileScreen[] };
  }
  return { screen: target, history: history.slice(0, -1) };
}
type SignupOutcome<T> = { kind: 'created'; result: T } | { kind: 'invalid'; message: string } | { kind: 'error'; error: unknown } | { kind: 'uncertain' } | { kind: 'blocked' };
// Registration-local request guard only. Session/Auth event ownership stays in the existing coordinator.
// Holds only phase/generation, never credentials, sessions or user data.
export function createRegistrationSubmission<T extends { user: unknown }>(signup: (email: string, password: string, displayName: string, identity: RegistrationIdentityInput) => Promise<T>) {
  let phase: SignupPhase = 'ready'; let generation = 0;
  return {
    phase: () => phase,
    reset() { generation++; phase = 'ready'; },
    async submit(draft: RegistrationDraft): Promise<SignupOutcome<T>> {
      if (phase !== 'ready') return { kind: 'blocked' };
      for (const screen of ['registrationName', 'registrationNickname', 'registrationEmail', 'registrationPassword'] as const) {
        const message = validateRegistrationStep(screen, draft);
        if (message) return { kind: 'invalid', message };
      }
      phase = 'submitting'; const attempt = generation;
      try {
        const result = await signup(draft.email.trim().toLowerCase(), draft.password, registrationDisplayName(draft), {firstName:draft.firstName.trim(),lastName:draft.lastName.trim(),publicNameAcknowledged:draft.publicNameAcknowledged});
        if (attempt !== generation) return { kind: 'blocked' };
        if (!result.user) throw Error('Signup result unconfirmed.');
        phase = 'created'; return { kind: 'created', result };
      } catch (error) {
        if (attempt !== generation) return { kind: 'blocked' };
        const value = error as { status?: number; code?: string } | null;
        const definitive = (typeof value?.status === 'number' && value.status >= 400 && value.status < 500 && value.status !== 408) || ['weak_password', 'email_address_invalid', 'user_already_exists'].includes(value?.code ?? '');
        phase = definitive ? 'ready' : 'uncertain';
        return definitive ? { kind: 'error', error } : { kind: 'uncertain' };
      }
    },
  };
}
