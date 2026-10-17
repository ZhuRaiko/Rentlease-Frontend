import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SelectedDocument } from '../../../shared/models/SelectedDocument';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface DocumentPreviewPickerProps {
  document: SelectedDocument | null;
  onSelect?: (() => void) | undefined;
  busy?: boolean;
}

export function DocumentPreviewPicker({
  document,
  onSelect,
  busy = false,
}: DocumentPreviewPickerProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = document?.mimeType?.startsWith('image/') && document.uri !== failedUri;
  return (
    <View style={styles.wrapper}>
      <View style={styles.preview}>
        {document && showImage ? (
          <>
            <Image onError={() => setFailedUri(document.uri)} resizeMode="contain" source={{ uri: document.uri }} style={styles.image} />
            <View style={styles.sampleBadge}>
              <Text style={styles.sampleText}>LOCAL FILE · NOT UPLOADED</Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{document ? 'Document selected' : 'No document selected'}</Text>
            <Text style={styles.emptyCopy}>{document ? 'A visual preview is unavailable for this file. The selection is local only.' : 'Choose a document from your device.'}</Text>
          </View>
        )}
      </View>
      {document ? <>
        <Text style={styles.fileName}>{document.fileName}</Text>
        <Text style={styles.emptyCopy}>{document.mimeType ?? 'File type unavailable'}{document.size !== null ? ` · ${document.size} bytes` : ''}</Text>
      </> : null}
      {onSelect ? <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onSelect}
        style={({ pressed }) => [styles.selectButton, (pressed || busy) && styles.pressed]}
      >
        <Text style={styles.selectLabel}>{busy ? 'Opening document picker…' : document ? 'Choose another document' : 'Choose document'}</Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  preview: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    height: 300,
    overflow: 'hidden',
  },
  image: { height: '100%', width: '100%' },
  sampleBadge: {
    backgroundColor: colors.overlay,
    bottom: 0,
    left: 0,
    padding: spacing.xs,
    position: 'absolute',
    right: 0,
  },
  sampleText: {
    color: colors.white,
    fontFamily: typography.family,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyState: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.lg },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 20,
    fontWeight: '800',
  },
  emptyCopy: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  fileName: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13 },
  selectButton: {
    alignItems: 'center',
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
  },
  selectLabel: {
    color: colors.primary,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: { opacity: 0.75 },
});
