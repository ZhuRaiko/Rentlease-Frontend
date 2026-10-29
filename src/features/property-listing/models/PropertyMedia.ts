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
