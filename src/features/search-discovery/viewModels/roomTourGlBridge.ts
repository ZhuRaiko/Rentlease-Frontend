import { PROPERTY_PANORAMA_BUCKET } from '../../../shared/models/PropertyPanorama';
import type { Edge } from './roomTourMotion';

/**
 * The only two things that cross between React Native and the WebView, and both are checked here (pure, tested):
 *  - messages FROM the page are untrusted text: parsed in a try/catch, the type is on an allow-list, every field is type- and range-checked, and anything else is ignored;
 *  - the image URL sent TO the page must be this app's public storage URL for the property-panoramas bucket (https, the exact path shape, nothing else).
 */
export type GlMessage =
  | { type: 'ready' }
  | { type: 'error'; reason: string }
  | { type: 'position'; t: number }
  | { type: 'pull'; edge: Edge; dp: number }
  | { type: 'release'; edge: Edge; dp: number };

export const GL_MESSAGE_MAX_CHARS = 512;
const MAX_DP = 5000;
const isEdge = (value: unknown): value is Edge => value === 'left' || value === 'right';
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Parses one message from the page. Returns null for anything that is not exactly one of the allowed messages. */
export function parseGlMessage(raw: unknown): GlMessage | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > GL_MESSAGE_MAX_CHARS) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value)) return null;
  switch (value.type) {
    case 'ready': return { type: 'ready' };
    case 'error': return { type: 'error', reason: typeof value.reason === 'string' && /^[\w .:-]{1,64}$/.test(value.reason) ? value.reason : 'unknown' };
    case 'position': return typeof value.t === 'number' && Number.isFinite(value.t) && value.t >= 0 && value.t <= 1 ? { type: 'position', t: value.t } : null;
    case 'pull': case 'release': {
      const { edge, dp } = value;
      return isEdge(edge) && typeof dp === 'number' && Number.isFinite(dp) && dp >= 0 && dp <= MAX_DP ? { type: value.type, edge, dp } : null;
    }
    default: return null;
  }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const URL_SHAPE = new RegExp(`^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+/storage/v1/object/public/${PROPERTY_PANORAMA_BUCKET}/${UUID}/${UUID}/${UUID}\\.(jpg|jpeg|png|webp)$`);
/** True only for an https public-storage URL of the property-panoramas bucket with the exact object path shape. Rejects other hosts, `javascript:`, `file:`, `data:`, credentials, ports, queries and fragments. */
export const isAllowedPanoramaImageUrl = (url: unknown): url is string => typeof url === 'string' && url.length < 400 && URL_SHAPE.test(url);

// ---- Commands TO the page (run with injectJavaScript). Values are JSON-encoded, with characters that could end a script or a line made harmless. ----
const js = (value: unknown): string => JSON.stringify(value).replace(/</g, '\u003c').split(' ').join('\u2028').split(' ').join('\u2029');
/** Show another side's image; a wrap enters it at the given end. Returns null (send nothing) for a URL that is not allowed. */
export function glSetSideCommand(url: string, aspect: number, entry: Edge): string | null {
  return isAllowedPanoramaImageUrl(url) && Number.isFinite(aspect) && aspect > 0 && aspect < 100 ? `window.__roomTour&&window.__roomTour.setSide(${js(url)},${js(aspect)},${js(entry)});true;` : null;
}
export const glReducedMotionCommand = (reduced: boolean): string => `window.__roomTour&&window.__roomTour.setReducedMotion(${reduced ? 'true' : 'false'});true;`;
/** Screen-reader scroll actions: look a step to the right (1) or left (-1). */
export const glNudgeCommand = (direction: 1 | -1): string => `window.__roomTour&&window.__roomTour.nudge(${direction === 1 ? 1 : -1});true;`;
