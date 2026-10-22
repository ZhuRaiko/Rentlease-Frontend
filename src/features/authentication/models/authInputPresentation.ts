// The native input must not carry keyboard variation flags from another question.
// Visibility is intentionally excluded: Show/Hide must not remount a focused input.
export const authInputIdentity = (label: string | undefined, secure: boolean) => `${secure ? 'secure' : 'plain'}:${label ?? 'field'}`;
