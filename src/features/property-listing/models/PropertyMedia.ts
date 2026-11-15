import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import type { PropertyPhoto } from './PropertyPhoto';
export interface PropertyMediaItem {
  key: string; uri: string; label: string; status: 'Selected' | 'Uploading' | 'Saved' | 'Needs attention';
  photoId?: string; pendingIndex?: number; cover: boolean;
}
export function propertyMediaItems(photos: PropertyPhoto[], pending: SelectedDocument[], uncertain: SelectedDocument | null, uploading: boolean): PropertyMediaItem[] {
  return [
    ...photos.map((photo, index): PropertyMediaItem => ({ key: `saved:${photo.id}`, uri: photo.publicUrl, label: photo.alt_text || `Property photo ${index + 1}`, status: 'Saved', photoId: photo.id, cover: photo.is_cover })),
    ...pending.map((file, index): PropertyMediaItem => ({ key: `selected:${index}`, uri: file.uri, label: file.fileName, status: uploading && index === 0 ? 'Uploading' : 'Selected', pendingIndex: index, cover: false })),
    ...(uncertain ? [{ key: 'uncertain', uri: uncertain.uri, label: uncertain.fileName, status: 'Needs attention' as const, cover: false }] : []),
  ];
}

/** What a thumbnail on the Listing step shows over the picture: a light veil while the photo is on its way, an amber one when it needs a retry or a check. */
export type ThumbVeil = { kind: 'uploading'; text: 'Uploading…' } | { kind: 'failed'; text: string; retry: boolean } | null;
export function thumbVeil(item: Pick<PropertyMediaItem, 'status'>, running: boolean): ThumbVeil {
  if (item.status === 'Saved') return null;
  if (item.status === 'Uploading' || (item.status === 'Selected' && running)) return { kind: 'uploading', text: 'Uploading…' };
  if (item.status === 'Needs attention') return { kind: 'failed', text: 'Check this photo', retry: false };
  return { kind: 'failed', text: 'Couldn’t upload', retry: true };
}
/** Photos that are not saved yet, or whose outcome is not known: the Listing step's button waits for these. */
export type PhotoWait = 'uploading' | 'attention' | null;
export function photoWait(s: { busy: boolean; needsReconcile: boolean; pendingSelections: readonly unknown[] }, hasProperty: boolean): PhotoWait {
  if (!hasProperty) return null;
  if (s.busy && s.pendingSelections.length) return 'uploading'; // a plain photo load is a background check and never holds the button
  if (s.needsReconcile || s.pendingSelections.length) return 'attention';
  return null;
}
export const PHOTOS_UPLOADING_MESSAGE = 'Uploading your photos…';
export const PHOTOS_ATTENTION_MESSAGE = 'Some photos need a retry';
