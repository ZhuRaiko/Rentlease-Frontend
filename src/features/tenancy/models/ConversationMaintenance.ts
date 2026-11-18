import {categoryLabel, isOpen, isUrgent, stepIndex} from './Maintenance';
import {timeOfDay} from './MaintenanceFormat';
import type {CareContext} from './TenancyCare';

export interface MaintenanceStripItem {id: string; title: string; meta: string; urgent: boolean; status: 'Sent' | 'Seen' | 'In progress'}
export interface MaintenanceStrip {openCount: number; items: MaintenanceStripItem[]}

/** Up to three requests are listed; the header counts every open one. */
export const STRIP_LIMIT = 3;
const STEP: Record<number, MaintenanceStripItem['status']> = {0: 'Sent', 1: 'Seen', 2: 'In progress'};

/**
 * What a chat shows about its tenancy's maintenance: the open requests only (a resolved request counts as closed here, because the thread does not
 * read the tenant's confirmation), newest first. Nothing here is a message and nothing is counted as unread.
 */
export function maintenanceStrip(care: CareContext): MaintenanceStrip {
  const open = care.requests.filter(r => isOpen(r.status, true)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return {
    openCount: open.length,
    items: open.slice(0, STRIP_LIMIT).map(r => ({
      id: r.id, title: r.title, urgent: isUrgent(r.priority), status: STEP[stepIndex(r.status)] ?? 'Sent',
      meta: `${categoryLabel(r.category)} · sent ${timeOfDay(r.createdAt)}`,
    })),
  };
}
