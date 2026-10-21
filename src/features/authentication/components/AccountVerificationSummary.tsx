import { StyleSheet, Text, View } from 'react-native';
import { VerificationStatusBadge } from '../../../shared/components/VerificationStatusBadge';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

export function AccountVerificationSummary({ items }: { items: AuthProfilesViewModel['verificationSummary'] }) {
  return <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>Verification</Text>{items.map(item => <View key={item.label} style={styles.row}><Text style={styles.label}>{item.label}</Text><VerificationStatusBadge {...item.status} /><Text style={styles.detail}>{item.detail}</Text></View>)}</View>;
}
const styles = StyleSheet.create({
  section: { marginTop: spacing.lg }, heading: { fontFamily: typography.family, color: colors.text, fontSize: 18, fontWeight: '700' },
  row: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.xs, paddingVertical: spacing.md },
  label: { fontFamily: typography.family, color: colors.text, fontSize: 15, fontWeight: '600' }, detail: { fontFamily: typography.family, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
