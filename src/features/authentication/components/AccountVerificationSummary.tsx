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

// Same plateau rhythm as the overview bloom, condensed and softened for Profile.
const profileBloom = {
  intensity: 0.32,
  bands: [
    { strength: 1, start: '0%', end: '24%' },
    { strength: 0.65, start: '30%', end: '35%' },
    { strength: 0.3, start: '41%', end: '46%' },
    { strength: 0.08, start: '52%', end: '55%' },
    { strength: 0, start: '61%', end: '100%' },
  ],
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
          type: 'radial-gradient', shape: 'ellipse',
          size: { x: '70%', y: '180%' },
          position: { left: 0, top: '35%' },
          colorStops: profileBloom.bands.map(({ strength, start, end }) => ({
            color: `rgba(${accent.rgb}, ${profileBloom.intensity * strength})`,
            positions: [start, end],
          })),
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
