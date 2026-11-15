/** Which actions on a request card are visible buttons and which stay behind the toggle. Action names are the existing ones. */
export function requestCardActions<A extends string>(actions: readonly A[], pending: boolean): { visible: A[]; more: A[] } {
  const answer = actions.filter(a => a === 'approve' || a === 'decline');
  const visible = !pending ? [] : answer.length ? answer : actions.filter(a => a === 'cancel');
  return { visible, more: actions.filter(a => !visible.includes(a)) };
}

/** Toggle wording: history is never called "actions" when the actions are already on the card. */
export function requestToggleLabel(expanded: boolean, split: { visible: readonly string[]; more: readonly string[] }): string {
  if (!split.visible.length) return expanded ? 'Hide actions and history' : 'Actions and history';
  return split.more.length ? (expanded ? 'Hide more actions and history' : 'More actions and history') : (expanded ? 'Hide history' : 'History');
}
