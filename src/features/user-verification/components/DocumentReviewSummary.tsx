import { StyleSheet, Text, View } from 'react-native';
import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

/** Presentation only: selected file details shared by verification review screens. */
export function DocumentReviewSummary({ document, typeLabel, typeValue }: {
  document: SelectedDocument;
  typeLabel: string;
  typeValue: string | null | undefined;
}) {
  return (
              <View style={styles.documentSummary}>
                <Text style={styles.summaryLabel}>Selected document</Text>
                <Text style={styles.summaryFileName}>{document.fileName}</Text>
                <View style={styles.fileDetails}>
                  <Text style={styles.summaryDetail}>File type: {document.mimeType ?? 'Unavailable'}</Text>
                  <Text style={styles.summaryDetail}>File size: {document.size !== null ? `${document.size.toLocaleString()} bytes` : 'Unavailable'}</Text>
                </View>
                <View style={styles.idSummary}>
                  <Text style={styles.summaryLabel}>{typeLabel}</Text>
                  <Text style={styles.summaryValue}>{typeValue}</Text>
                </View>
              </View>
  );
}

const styles = StyleSheet.create({
  documentSummary: { padding: spacing.md, gap: spacing.xs, minWidth: 0 },
  summaryLabel: { color: colors.identityInk, fontFamily: typography.family, fontSize: 14, fontWeight: '600' },
  summaryFileName: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  fileDetails: { gap: spacing.xxs },
  summaryDetail: { color: colors.trustedText, fontFamily: typography.family, fontSize: 14, flexShrink: 1 },
  idSummary: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.xxs, gap: spacing.xxs },
  summaryValue: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '600', flexShrink: 1 },
});
