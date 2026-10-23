import { verificationTierIdentities } from '../../../shared/models/verificationTierIdentity';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { VerificationStatusIndicator } from '../../../shared/components/VerificationStatusIndicator';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

// Profile-only category accents; status colors remain owned by VerificationStatusIndicator.
const profileTierAccents = {
  1: { rgb: '69, 172, 103', ink: '#245C36' },
  2: { rgb: '50, 170, 181', ink: '#205E65' },
  3: { rgb: '230, 172, 55', ink: '#77531E' },
} as const;

export function AccountVerificationSummary({ items }: { items: AuthProfilesViewModel['verificationSummary'] }) {
  const { fontScale } = useWindowDimensions();
  return <View style={styles.section}>
    <Text style={styles.scope}>Account required. Identity and Property optional.</Text>
    {items.map(item => {
      const identity = verificationTierIdentities[item.tier];
      const accent = profileTierAccents[item.tier];
      return <View accessible accessibilityLabel={`${item.label}: ${item.status.label}`} key={item.label} style={[styles.row, {
        experimental_backgroundImage: [{
          type: 'linear-gradient', direction: 'to right',
          colorStops: [
            { color: `rgba(${accent.rgb}, 0.18)`, positions: ['0%', '20%'] },
            { color: `rgba(${accent.rgb}, 0.10)`, positions: ['24%', '27%'] },
            { color: `rgba(${accent.rgb}, 0.04)`, positions: ['31%', '34%'] },
            { color: `rgba(${accent.rgb}, 0)`, positions: ['40%', '100%'] },
          ],
        }],
      }]}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.tierMark, { width: 36 * Math.max(1, fontScale) }]}><Text style={[styles.number, { color: accent.ink }]}>{identity.number}</Text></View>
        <Text style={styles.label}>{item.label}</Text>
        <View style={styles.statusSurface}><VerificationStatusIndicator {...item.status} /></View>
      </View>;
    })}
    <Text style={styles.propertyScope}>Property is an account-level indication, not verification of every property.</Text>
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.xxs },
  scope: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, marginBottom: spacing.xxs },
  row: { backgroundColor: colors.background, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.md, rowGap: spacing.xs, borderRadius: radius.sm, overflow: 'hidden', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  tierMark: { minHeight: 32, flexShrink: 0, alignItems: 'flex-start', justifyContent: 'center' },
  number: { fontFamily: typography.family, fontSize: 24, lineHeight: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  label: { color: colors.ink, flexGrow: 1, flexShrink: 1, flexBasis: 110, fontFamily: typography.family, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  statusSurface: { alignSelf: 'flex-start', flexShrink: 1, maxWidth: '100%', marginLeft: 'auto', backgroundColor: colors.background },
  propertyScope: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, marginTop: spacing.xs },
});
