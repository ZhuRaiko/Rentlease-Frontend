interface VerificationDocumentPathInput {
  userId: string;
  submissionId: string;
  fileName: string;
  uniqueId: string;
}

export function createVerificationDocumentPath(input: VerificationDocumentPathInput): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (![input.userId, input.submissionId, input.uniqueId].every((value) => uuid.test(value))) {
    throw new Error('An authenticated user and existing verification submission are required.');
  }
  // Do not embed personal filenames or permit path traversal in an object key.
  const extension = /\.([a-z0-9]{1,10})$/i.exec(input.fileName)?.[1]?.toLowerCase();
  return `${input.userId}/${input.submissionId}/${input.uniqueId}${extension ? `.${extension}` : ''}`;
}
