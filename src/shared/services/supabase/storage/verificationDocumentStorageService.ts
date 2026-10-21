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
