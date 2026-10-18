export type AuthBootEvent =
  | 'APP_MODULE_READY' | 'APP_MOUNT' | 'APP_UNMOUNT' | 'APP_DESTINATION'
  | 'VM_MOUNT' | 'VM_UNMOUNT' | 'VM_STATE' | 'AUTH_VIEW_MOUNT' | 'AUTH_VIEW_UNMOUNT' | 'AUTH_VIEW_STATE'
  | 'AUTH_SUBSCRIBE' | 'AUTH_SUBSCRIBED' | 'AUTH_UNSUBSCRIBE' | 'AUTH_EVENT'
  | 'BOOTSTRAP_START' | 'ACCOUNT_LOAD_START' | 'ACCOUNT_LOAD_SUCCESS' | 'ACCOUNT_LOAD_ERROR' | 'ACCOUNT_LOAD_STALE'
  | 'REFRESH_QUEUED' | 'REFRESH_SUPPRESSED' | 'COORDINATOR_DISPOSE'
  | 'STARTUP_DEADLINE_CREATED' | 'STARTUP_DEADLINE_CLEARED' | 'STARTUP_DEADLINE_FIRED'
  | 'REQUEST_DEADLINE_FIRED' | 'STARTUP_RESOLVED' | 'SESSION_REQUEST' | 'SESSION_RESULT'
  | 'AUTH_USER_REQUEST' | 'AUTH_USER_RESULT' | 'PROFILE_QUERY_START' | 'PROFILE_QUERY_RESULT'
  | 'ROLES_QUERY_START' | 'ROLES_QUERY_RESULT' | 'SUPABASE_CLIENT_CREATED' | 'APP_STATE';

// Only code-owned state labels/booleans/counters. Never pass accounts, sessions,
// Errors, environment values, user identifiers or form/document data here.
export interface AuthBootFields {
  instance?: number;
  generation?: number;
  source?: string;
  eventName?: string;
  screen?: string;
  asyncState?: string;
  userPresent?: boolean;
  accountPresent?: boolean;
  errorPresent?: boolean;
  retryVisible?: boolean;
  destination?: string | null;
  workspace?: string | null;
  modalVisible?: boolean;
  initialMetricsPresent?: boolean;
  timeoutMs?: number;
  reason?: string;
  appState?: string;
}

const SAFE_FIELDS: ReadonlyArray<keyof AuthBootFields> = [
  'instance', 'generation', 'source', 'eventName', 'screen', 'asyncState', 'userPresent',
  'accountPresent', 'errorPresent', 'retryVisible', 'destination', 'workspace', 'modalVisible',
  'initialMetricsPresent', 'timeoutMs', 'reason', 'appState',
];

let instanceSequence = 0;
export function nextAuthBootInstance(): number { return ++instanceSequence; }

export function formatAuthBootTrace(event: AuthBootEvent, fields: AuthBootFields): string {
  // Whitelist at runtime too: extra properties cannot accidentally serialize credentials.
  const safe = Object.fromEntries(SAFE_FIELDS.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]]));
  return `[AUTH-BOOT] ${Date.now()} ${event} ${JSON.stringify(safe)}`;
}

export function traceAuthBoot(event: AuthBootEvent, fields: AuthBootFields = {}): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.info(formatAuthBootTrace(event, fields));
}
