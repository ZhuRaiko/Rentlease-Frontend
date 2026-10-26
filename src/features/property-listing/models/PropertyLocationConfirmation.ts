import type { DraftProperty } from './DraftProperty';
import { propertyCityOptions } from './DraftProperty';
export interface ExactPropertyPoint { latitude: number; longitude: number }
export interface PropertyLocationContext { addressRevision: number; setupId: string; query: string }
export function isExactPropertyPoint(value: unknown): value is ExactPropertyPoint {
  if (!value || typeof value !== 'object') return false;
  const { latitude, longitude } = value as Partial<ExactPropertyPoint>;
  return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
export function toMapLngLat(point: ExactPropertyPoint): [number, number] {
  if (!isExactPropertyPoint(point)) throw new Error('Choose a valid point on the map.');
  return [point.longitude, point.latitude];
}
export function fromMapLngLat(value: unknown): ExactPropertyPoint | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const point = { longitude: value[0], latitude: value[1] };
  return isExactPropertyPoint(point) ? point : null;
}
export function propertyAddressQuery(draft: DraftProperty): string {
  const city = propertyCityOptions.find(option => option.value === draft.city)?.label ?? '';
  return [draft.addressLine1, draft.addressLine2, draft.barangay, city, draft.postalCode, 'Cavite', 'Philippines'].map(value => value.trim()).filter(Boolean).join(', ');
}
