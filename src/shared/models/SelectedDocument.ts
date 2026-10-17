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
