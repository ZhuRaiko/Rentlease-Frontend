import { verificationTierIdentities } from '../../../shared/models/verificationTierIdentity';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';
import { VerificationStatusIndicator } from '../../../shared/components/VerificationStatusIndicator';
import type { StatusPresentation } from '../../../shared/models/verificationPresentation';
import { colors } from '../../../shared/theme/colors';
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

export function VerificationTierCard({ tier, title, subtitle, items, onPress, actionLabel, disabled = false, presentation }: VerificationTierCardProps) {
  const identity = verificationTierIdentities[tier];
  return <View style={styles.section}>
    <View style={styles.heading}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.mark, { backgroundColor: identity.surface }]}><Text style={[styles.number, { color: identity.ink }]}>{identity.number}</Text></View>
      <View style={styles.headingCopy}>
        <Text accessibilityRole="header" accessibilityLabel={`Tier ${tier}: ${title}`} style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <VerificationStatusIndicator {...presentation} />
      </View>
    </View>
    <View style={styles.items}>{items.map(item => <Text key={item} style={styles.item}>{item}</Text>)}</View>
    {tier === 1 ? null : disabled || !onPress ? <Text style={styles.next}>{actionLabel}</Text> : <AppButton variant="secondary" label={actionLabel} onPress={onPress} />}
  </View>;
}
const styles = StyleSheet.create({
  section: { padding: spacing.md, backgroundColor: colors.background, borderColor: colors.accountCredentialInk, borderWidth: 1, borderBottomWidth: 3, borderRadius: radius.firm, gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headingCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  mark: { borderRadius: radius.firm, borderWidth: 1, borderColor: colors.primaryAction, minWidth: 40, minHeight: 40, padding: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 18, lineHeight: 25, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
  items: { gap: spacing.xs },
  item: { color: colors.text, fontFamily: typography.family, fontSize: 16, lineHeight: 24 },
  next: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
});
