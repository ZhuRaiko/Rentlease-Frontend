# RENTLEASE Tier 2 ? File-read code inspection

Snapshot date: 2026-10-19.

Purpose: copy-paste handoff of the current picker, URI normalization, uploader and temporary diagnostic code. This is a historical inspection snapshot, not authoritative living documentation or a confirmed bugfix.

## Findings

- `copyToCacheDirectory: true`, `multiple: false`, and `type: '*/*'` are already configured.
- The successful pick's `result.assets[0].uri` is assigned directly to `SelectedDocument.uri`. Filename normalization does not change that URI.
- The workflow retains the selected document and passes it to the uploader without rewriting the URI.
- The uploader already uses the current Expo `File` API and `await file.arrayBuffer()`.
- Installed expo-file-system implements arrayBuffer by calling native bytes internally. No direct `.bytes()` call exists in application source.
- User-observed failure in Expo Go: `ERR_INVALID_PERMISSION`, missing READ, during file reading. No FILE_READ_SUCCESS or STORAGE_UPLOAD_START occurs. Native permission rejection is confirmed; its underlying path/scope cause is unresolved.
- No Android permissions, file-access behavior, Supabase operations, UI or navigation were changed in the diagnostic pass. No commit or push was made.

## 1. Exact document picker service

Source: `src/shared/services/documents/documentPickerService.ts`

```ts
import * as DocumentPicker from 'expo-document-picker';

import { normalizeError } from '../../errors/AppError';
import { normalizeDocumentSelection, type SelectedDocument } from '../../models/SelectedDocument';

export async function selectLocalDocument(): Promise<SelectedDocument | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      // Backend MIME/size limits are unconfirmed. Selection is not validation.
      type: '*/*',
    });
    return normalizeDocumentSelection(result);
  } catch (error) {
    throw { ...normalizeError(error), message: 'Could not select this document. Please try again.' };
  }
}
```

## 2. SelectedDocument and exact URI normalization

Source: `src/shared/models/SelectedDocument.ts`

```ts
// A cached local device selection, not a public.verification_documents row.
export interface SelectedDocument {
  uri: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
}

interface LocalDocumentAsset {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export function normalizeDocumentSelection(result:
  | { canceled: true; assets: null }
  | { canceled: false; assets: LocalDocumentAsset[] },
): SelectedDocument | null {
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('Picker returned no document.');
  return normalizeSelectedDocument(asset);
}

export function normalizeSelectedDocument(asset: LocalDocumentAsset): SelectedDocument {
  if (!asset.uri.trim()) throw new Error('The selected document could not be read.');
  return {
    uri: asset.uri,
    fileName: asset.name.trim() || 'document',
    mimeType: asset.mimeType?.trim() || null,
    size: typeof asset.size === 'number' && Number.isFinite(asset.size) && asset.size >= 0 ? asset.size : null,
  };
}
```

## 3. Exact upload service and file-reading code

Source: `src/shared/services/supabase/storage/verificationDocumentStorageService.ts`

```ts
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { normalizeError } from '../../../errors/AppError';
import type { SelectedDocument } from '../../../models/SelectedDocument';
import { getStorageClient } from './storageService';
import { createVerificationDocumentPath } from './verificationDocumentPath';
import { tierTwoUriDiagnostics, traceTierTwoDiagnostic } from '../../../utils/tierTwoDiagnostics';

const VERIFICATION_DOCUMENT_BUCKET = 'verification-documents';

export interface UploadedVerificationDocument {
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  size: number;
}

// Caller must already have created a real submission. This primitive does not
// create submissions, insert metadata, replace files, or return URLs.
export async function uploadVerificationDocument(input: {
  userId: string;
  submissionId: string;
  selectedDocument: SelectedDocument;
}): Promise<UploadedVerificationDocument> {
  traceTierTwoDiagnostic('UPLOAD_ENTER', tierTwoUriDiagnostics(input.selectedDocument.uri));
  try {
    const storagePath = createVerificationDocumentPath({
      userId: input.userId,
      submissionId: input.submissionId,
      fileName: input.selectedDocument.fileName,
      uniqueId: randomUUID(),
    });
    // React Native Storage uploads use binary data, not Blob/FormData.
    traceTierTwoDiagnostic('FILE_READ_START', { submissionId: input.submissionId });
    let contents: ArrayBuffer;
    try {
      const file = new File(input.selectedDocument.uri);
      contents = await file.arrayBuffer();
      traceTierTwoDiagnostic('FILE_READ_SUCCESS', { byteLength: contents.byteLength, bodyType: contents.constructor.name });
    } catch (error) {
      traceTierTwoDiagnostic('FILE_READ_ERROR', { submissionId: input.submissionId }, error);
      throw error;
    }
    const storageDetails = {
      bucket: VERIFICATION_DOCUMENT_BUCKET, submissionId: input.submissionId, storagePath,
      mimeType: input.selectedDocument.mimeType, byteLength: contents.byteLength, upsert: false,
    };
    traceTierTwoDiagnostic('STORAGE_UPLOAD_START', storageDetails);
    let result;
    try {
      result = await getStorageClient()
        .from(VERIFICATION_DOCUMENT_BUCKET)
        .upload(storagePath, contents, {
          upsert: false,
          ...(input.selectedDocument.mimeType ? { contentType: input.selectedDocument.mimeType } : {}),
        });
    } catch (error) {
      traceTierTwoDiagnostic('STORAGE_UPLOAD_ERROR', storageDetails, error);
      throw error;
    }
    const { data, error } = result;
    if (error) {
      traceTierTwoDiagnostic('STORAGE_UPLOAD_ERROR', storageDetails, error);
      throw error;
    }
    traceTierTwoDiagnostic('STORAGE_UPLOAD_SUCCESS', { storagePath, dataPresent: !!data });
    return {
      storagePath: data.path,
      fileName: input.selectedDocument.fileName,
      mimeType: input.selectedDocument.mimeType,
      size: contents.byteLength,
    };
  } catch (error) {
    traceTierTwoDiagnostic('UPLOAD_ERROR', { submissionId: input.submissionId }, error);
    throw { ...normalizeError(error), message: 'Could not upload this verification document. Please try again.' };
  }
}
```

## 4. Workflow selection and handoff excerpt

Source: `src/features/user-verification/viewModels/tierTwoVerificationWorkflow.ts`

The excerpt ends immediately before metadata insertion.

```ts
    async pickDocument() {
      if (!canEdit() || !getTierTwoDocumentType(state.selectedIdLabel ?? '')) return;
      const attempt = epoch;
      update({ isSelectingDocument: true, error: null });
      try {
        const selectedDocument = await selectDocument();
        if (current(attempt) && selectedDocument) update({ selectedDocument });
      } catch { if (current(attempt)) update({ error: 'Could not select this document. Please try again.' }); }
      finally { if (current(attempt)) update({ isSelectingDocument: false }); }
    },
    async submit() {
      if (!canSubmit()) return;
      const documentType = getTierTwoDocumentType(state.selectedIdLabel ?? '');
      const selectedDocument = state.selectedDocument;
      if (!documentType || !selectedDocument) return;
      traceTierTwoDiagnostic('SUBMIT_START', tierTwoUriDiagnostics(selectedDocument.uri));
      const attempt = epoch;
      update({ isSubmitting: true, error: null });
      let stage: 'auth' | 'fetch' | 'create' | 'upload' | 'metadata' | 'refresh' = 'auth';
      try {
        const userId = await service.getCurrentUserId(); alive(attempt);
        stage = 'fetch';
        const existing = await service.fetchLatest(userId); alive(attempt);
        if (existing) {
          update({ submission: existing, screen: 'tier2Status', selectedDocument: null, selectedIdLabel: null });
          return;
        }
        stage = 'create';
        traceTierTwoDiagnostic('SUBMISSION_INSERT_START', { documentType });
        let created: TierTwoSubmission;
        try {
          created = await service.createSubmission(userId);
          traceTierTwoDiagnostic('SUBMISSION_INSERT_SUCCESS', { submissionId: created.id, documentType });
        } catch (error) {
          traceTierTwoDiagnostic('SUBMISSION_INSERT_ERROR', { documentType }, error);
          throw error;
        }
        alive(attempt);
        if (!created.id) throw new Error('Missing submission ID.');
        update({ submission: created });
        stage = 'upload';
        // Recheck identity before handing the authenticated namespace to Storage.
        if (await service.getCurrentUserId() !== userId) throw new Error('Account changed.');
        alive(attempt);
        const uploaded = await uploadDocument({ userId, submissionId: created.id, selectedDocument }); alive(attempt);
```

## 5. Temporary development diagnostic helper

Source: `src/shared/utils/tierTwoDiagnostics.ts`

```ts
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
```

## 6. Why runtime reports FileSystemFile.bytes

Installed dependency: `expo-file-system 57.0.7`. Source: `node_modules/expo-file-system/src/File.ts`.

```ts
  async arrayBuffer(): Promise<ArrayBuffer> {
    const bytes = await this.bytes();
    return bytes.buffer as ArrayBuffer;
  }
```

Execution chain:

```text
RENTLEASE file.arrayBuffer()
? Expo File.arrayBuffer()
? this.bytes()
? native FileSystemFile.bytes
? native READ permission validation
? ERR_INVALID_PERMISSION
```

The native method name therefore does not establish that RENTLEASE calls bytes directly. Changing the call to arrayBuffer cannot bypass this check, because that API is already used and delegates to bytes in the installed version. An Expo Go cache-scope mismatch remains a hypothesis rather than a proven cause.

## 7. Entire src search results

The following results were regenerated while preparing this report:

| Search expression | Matches |
| --- | --- |
| `.bytes(` | None |
| `new File(` | `src/shared/services/supabase/storage/verificationDocumentStorageService.ts:38:      const file = new File(input.selectedDocument.uri);` |
| `arrayBuffer(` | `src/shared/services/supabase/storage/verificationDocumentStorageService.ts:39:      contents = await file.arrayBuffer();` |
| `copyToCacheDirectory` | `src/shared/services/documents/documentPickerService.ts:10:      copyToCacheDirectory: true,` |
| `readAsStringAsync` | None |
| `fetch(uri)` | None |
| `Paths.cache` | None |
| `.copy(` | None |

## 8. Diagnostic interpretation

SUBMIT_START and UPLOAD_ENTER now emit only uriScheme and isCacheUri. Example shape, not an observed result:

```text
[TIER2-DIAG] SUBMIT_START {"uriScheme":"file","isCacheUri":true}
[TIER2-DIAG] UPLOAD_ENTER {"uriScheme":"file","isCacheUri":true}
```

`isCacheUri` checks for a `/cache/` segment, excluding query/fragment text. It does not prove that the path belongs to the app's permitted Expo Go cache scope. Neither the complete URI nor an identifying prefix is logged. The helper emits nothing outside development. Other diagnostic events retain their existing permitted fields and sanitized error information.

If reading succeeds, the next expected sequence is:

```text
FILE_READ_START
FILE_READ_SUCCESS   byteLength=<actual bytes>, bodyType=ArrayBuffer
STORAGE_UPLOAD_START
```

This sequence has not been established by the failing runtime attempt.

## 9. Validation and scope

From the preceding diagnostic pass:

- TypeScript: PASS (`npm.cmd run typecheck`).
- Automated tests: 76 total, 76 passed, 0 failed, 0 skipped/cancelled.
- `git diff --check`: PASS.
- Android file-read/upload success: NOT VERIFIED; the reported error remains unresolved.

This export task created only this Markdown report. Application code, living documentation and existing reports were not edited or moved. No environment values, tokens, document contents or actual private local file URIs were included.
