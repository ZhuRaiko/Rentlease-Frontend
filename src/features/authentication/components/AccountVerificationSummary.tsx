import { verificationTierIdentities } from '../../../shared/models/verificationTierIdentity';
import { StyleSheet, Text, View } from 'react-native';
import { VerificationStatusIndicator } from '../../../shared/components/VerificationStatusIndicator';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

export function AccountVerificationSummary({ items }: { items: AuthProfilesViewModel['verificationSummary'] }) {
  return <View style={styles.section}>
    <Text style={styles.scope}>Account required. Identity and Property optional.</Text>
    {items.map(item => {
      const identity = verificationTierIdentities[item.tier];
      return <View accessible accessibilityLabel={`${item.label}: ${item.status.label}`} key={item.label} style={styles.row}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.tierMark, { backgroundColor: identity.surface }]}><Text style={[styles.number, { color: identity.ink }]}>{identity.number}</Text></View>
        <Text style={styles.label}>{item.label}</Text>
        <VerificationStatusIndicator {...item.status} />
      </View>;
    })}
    <Text style={styles.propertyScope}>Property is an account-level indication, not verification of every property.</Text>
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.xxs },
  scope: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21, marginBottom: spacing.xxs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xs, borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: spacing.sm },
  tierMark: { minWidth: 36, minHeight: 36, padding: spacing.xxs, borderRadius: radius.firm, borderWidth: 1, borderColor: colors.primaryAction, alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  label: { color: colors.text, flexGrow: 1, flexShrink: 1, flexBasis: 110, fontFamily: typography.family, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  propertyScope: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
});
