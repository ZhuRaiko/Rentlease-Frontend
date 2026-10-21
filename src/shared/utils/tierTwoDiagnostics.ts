// TEMPORARY: remove after diagnosing the Tier 2 upload failure.
type DiagnosticEvent =
  | 'SUBMIT_START' | 'SUBMIT_SUCCESS' | 'SUBMIT_ERROR'
  | 'AUTH_START' | 'AUTH_SUCCESS' | 'AUTH_ERROR'
  | 'SUBMISSION_INSERT_START' | 'SUBMISSION_INSERT_SUCCESS' | 'SUBMISSION_INSERT_ERROR'
  | 'UPLOAD_ENTER' | 'UPLOAD_ERROR' | 'FILE_READ_START' | 'FILE_READ_SUCCESS' | 'FILE_READ_ERROR'
  | 'STORAGE_UPLOAD_START' | 'STORAGE_UPLOAD_SUCCESS' | 'STORAGE_UPLOAD_ERROR'
  | 'METADATA_INSERT_START' | 'METADATA_INSERT_SUCCESS' | 'METADATA_INSERT_ERROR';

interface DiagnosticFields {
  stage?: string;
  documentType?: string;
  submissionId?: string;
  fileName?: string;
  mimeType?: string | null;
  size?: number | null;
  uriScheme?: string;
  isCacheUri?: boolean;
  userPresent?: boolean;
  bucket?: string;
  storagePath?: string;
  byteLength?: number;
  bodyType?: string;
  upsert?: boolean;
  dataPresent?: boolean;
}
const fields: ReadonlyArray<keyof DiagnosticFields> = [
  'stage', 'documentType', 'submissionId', 'fileName', 'mimeType', 'size', 'uriScheme', 'isCacheUri',
  'userPresent', 'bucket', 'storagePath', 'byteLength', 'bodyType', 'upsert', 'dataPresent',
];
function sanitize(value: string): string {
  return value
    .replace(/\b(?:file|content|data):[^\s"'<>]+/gi, '[URI REDACTED]')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, '[URI REDACTED]')
    .replace(/\bBearer\s+[^\s,;"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:access[_-]?token|refresh[_-]?token|authorization|apikey|api[_-]?key|password|otp)["']?\s*[:=]\s*["']?[^\s,;"'}]+/gi, '[CREDENTIAL REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[TOKEN REDACTED]')
    .slice(0, 600);
}
export function tierTwoUriScheme(uri: string): string {
  return /^([a-z][a-z0-9+.-]*):/i.exec(uri)?.[1]?.toLowerCase() ?? 'unknown';
}
export function tierTwoUriDiagnostics(uri: string): { uriScheme: string; isCacheUri: boolean } {
  // Marker only: this does not prove membership in Expo Go's permitted cache scope.
  const path = uri.split(/[?#]/, 1)[0] ?? '';
  return { uriScheme: tierTwoUriScheme(uri), isCacheUri: /\/cache\//i.test(path) };
}
export function traceTierTwoDiagnostic(event: DiagnosticEvent, details: DiagnosticFields = {}, error?: unknown): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  // Logging must never change error propagation or serialize arbitrary objects.
  try {
    const safe: Record<string, string | number | boolean | null> = {};
    for (const key of fields) {
      const value = details[key];
      if (typeof value === 'string') safe[key] = sanitize(value);
      else if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) safe[key] = value;
    }
    if (error !== undefined) {
      const source = error && typeof error === 'object' ? error as Record<string, unknown> : { message: error };
      for (const key of ['name', 'message', 'status', 'statusCode', 'code']) {
        const value = source[key];
        if (typeof value === 'string') safe[key] = sanitize(value);
        else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
      }
    }
    console.info(`[TIER2-DIAG] ${event} ${JSON.stringify(safe)}`);
  } catch { /* Diagnostics cannot affect the operation being observed. */ }
}
