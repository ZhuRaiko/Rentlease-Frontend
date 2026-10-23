import { verificationTierIdentities } from '../../../shared/models/verificationTierIdentity';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';
import { VerificationStatusIndicator } from '../../../shared/components/VerificationStatusIndicator';
import type { StatusPresentation } from '../../../shared/models/verificationPresentation';
import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface VerificationTierCardProps {
  tier: 1 | 2 | 3;
  title: string;
  subtitle: string;
  items: string[];
  presentation: StatusPresentation;
  onPress?: () => void;
  actionLabel: string;
  disabled?: boolean;
}

// Overview-only identity: an off-edge bloom keeps the left reading area neutral.
const cardWash = {
  tint: { 1: '69, 172, 103', 2: '50, 170, 181', 3: '230, 172, 55' },
  // Measured outward from the off-edge origin, not across the card from the left.
  bands: [
    { strength: 1, start: '0%', end: '24%' },
    { strength: 0.65, start: '30%', end: '35%' },
    { strength: 0.3, start: '41%', end: '46%' },
    { strength: 0.08, start: '52%', end: '55%' },
    { strength: 0, start: '61%', end: '100%' },
  ],
} as const;

export function VerificationTierCard({ tier, title, subtitle, items, onPress, actionLabel, disabled = false, presentation }: VerificationTierCardProps) {
  const identity = verificationTierIdentities[tier];
  const tint = cardWash.tint[tier];
  return <View style={[styles.section, {
    experimental_backgroundImage: [{
      type: 'radial-gradient',
      shape: 'ellipse',
      size: { x: '100%', y: '180%' },
      position: { left: '104%', top: '35%' },
      colorStops: cardWash.bands.map(({ strength, start, end }) => ({
        color: `rgba(${tint}, ${strength})`,
        positions: [start, end],
      })),
    }],
  }]}>
    <View style={styles.heading}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.mark, { backgroundColor: identity.surface }]}><Text style={[styles.number, { color: identity.ink }]}>{identity.number}</Text></View>
      <View style={styles.headingCopy}>
        <Text accessibilityRole="header" accessibilityLabel={`Tier ${tier}: ${title}`} style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.statusSurface}><VerificationStatusIndicator {...presentation} /></View>
      </View>
    </View>
    <View style={styles.items}>{items.map(item => <Text key={item} style={styles.item}>{item}</Text>)}</View>
    {tier === 1 ? null : disabled || !onPress ? <Text style={styles.next}>{actionLabel}</Text> : <AppButton variant="secondary" label={actionLabel} onPress={onPress} />}
  </View>;
}
const styles = StyleSheet.create({
  section: { ...ui.panel, padding: spacing.md, gap: spacing.sm },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  mark: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.controlBorder, minWidth: 34, minHeight: 34, padding: spacing.xxs, alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: typography.family, fontSize: 13, fontWeight: '600' },
  title: { ...ui.sectionTitle },
  statusSurface: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.background, borderRadius: radius.firm },
  subtitle: { color: colors.ink, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
  items: { gap: spacing.xs },
  item: { ...ui.body },
  next: { color: colors.ink, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
});
