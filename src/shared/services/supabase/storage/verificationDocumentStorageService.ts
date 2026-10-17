import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { normalizeError } from '../../../errors/AppError';
import type { SelectedDocument } from '../../../models/SelectedDocument';
import { getStorageClient } from './storageService';
import { createVerificationDocumentPath } from './verificationDocumentPath';

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
  try {
    const storagePath = createVerificationDocumentPath({
      userId: input.userId,
      submissionId: input.submissionId,
      fileName: input.selectedDocument.fileName,
      uniqueId: randomUUID(),
    });
    // React Native Storage uploads use binary data, not Blob/FormData.
    const contents = await new File(input.selectedDocument.uri).arrayBuffer();
    const { data, error } = await getStorageClient()
      .from(VERIFICATION_DOCUMENT_BUCKET)
      .upload(storagePath, contents, {
        upsert: false,
        ...(input.selectedDocument.mimeType ? { contentType: input.selectedDocument.mimeType } : {}),
      });
    if (error) throw error;
    return {
      storagePath: data.path,
      fileName: input.selectedDocument.fileName,
      mimeType: input.selectedDocument.mimeType,
      size: contents.byteLength,
    };
  } catch (error) {
    throw { ...normalizeError(error), message: 'Could not upload this verification document. Please try again.' };
  }
}
