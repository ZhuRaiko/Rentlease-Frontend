import type { SelectedDocument } from './SelectedDocument';

export const isPreviewImage = (mimeType: string | null) => ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType?.trim().toLowerCase() ?? '');
export function localImagePreviewReducer(state: SelectedDocument | null, action: { type: 'close' } | { type: 'open'; document: SelectedDocument }): SelectedDocument | null {
  return action.type === 'close' ? null : action.document.uri && isPreviewImage(action.document.mimeType) ? action.document : state;
}
export interface ImageSize { width: number; height: number }
export interface ImageTransform { scale: number; x: number; y: number }
export const initialImageTransform: ImageTransform = { scale: 1, x: 0, y: 0 };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export function fitImage(viewport: ImageSize, image: ImageSize): ImageSize {
  if (image.width <= 0 || image.height <= 0) return viewport;
  const ratio = Math.min(viewport.width / image.width, viewport.height / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
}
export function constrainTransform(transform: ImageTransform, viewport: ImageSize, image: ImageSize): ImageTransform {
  const scale = clamp(transform.scale, 1, 8);
  const xBound = Math.max(0, (image.width * scale - viewport.width) / 2);
  const yBound = Math.max(0, (image.height * scale - viewport.height) / 2);
  return { scale, x: xBound ? clamp(transform.x, -xBound, xBound) : 0, y: yBound ? clamp(transform.y, -yBound, yBound) : 0 };
}
export function zoomAt(base: ImageTransform, scale: number, focal: { x: number; y: number }, viewport: ImageSize, image: ImageSize, movement = { x: 0, y: 0 }): ImageTransform {
  const nextScale = clamp(scale, 1, 8); const ratio = nextScale / base.scale;
  const x = focal.x - viewport.width / 2; const y = focal.y - viewport.height / 2;
  // Combine scaling and moving pinch focal point before clamping, avoiding jumps at content edges.
  return constrainTransform({ scale: nextScale, x: x - (x - base.x) * ratio + movement.x, y: y - (y - base.y) * ratio + movement.y }, viewport, image);
}
export const panImage = (base: ImageTransform, dx: number, dy: number, viewport: ImageSize, image: ImageSize) => constrainTransform({ ...base, x: base.x + dx, y: base.y + dy }, viewport, image);
