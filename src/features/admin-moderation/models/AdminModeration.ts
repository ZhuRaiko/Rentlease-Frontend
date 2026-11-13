/** Admin workspace screens. Every screen listed here is backed by real data or is an honest "not connected" state. */
export type AdminModerationScreen =
  | 'dashboard'
  | 'reviewQueues'
  | 'verificationDetails'
  | 'reportDetails'
  | 'reviewDetails'
  | 'activeRestrictions'
  | 'auditHistory';

export type AdminNavigationSection = 'dashboard' | 'queues' | 'enforcement' | 'audit';

/** Tabs of the single Queues screen. */
export type AdminQueueTab = 'verification' | 'reports' | 'reviews';
