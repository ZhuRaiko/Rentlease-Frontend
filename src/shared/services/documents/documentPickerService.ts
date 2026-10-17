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
