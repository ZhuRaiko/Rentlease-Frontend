import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';
import { VerificationStatusBadge } from '../../../shared/components/VerificationStatusBadge';
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
  const identity = tier === 1 ? { name: 'Account', surface: colors.primaryPale, ink: colors.primaryAction }
    : tier === 2 ? { name: 'Identity', surface: colors.identitySurface, ink: colors.identityInk }
    : { name: 'Property', surface: colors.propertyProofSurface, ink: colors.propertyProofInk };
  return <View style={styles.card}>
    <View style={[styles.tierIdentity, { backgroundColor: identity.surface }]}><Text style={[styles.eyebrow, { color: identity.ink }]}>Tier {tier} / {identity.name}</Text></View>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.statusLabel}>{tier === 1 ? 'Account status' : tier === 2 ? 'Submission status' : 'Property status'}</Text>
    <VerificationStatusBadge {...presentation} />
    <Text style={styles.subtitle}>{subtitle}</Text>
    <View style={styles.items}>{items.map(item => <Text key={item} style={styles.item}>{item}</Text>)}</View>
    {tier === 1 || disabled || !onPress ? <Text style={styles.next}>{actionLabel}</Text> : <AppButton variant="secondary" label={actionLabel} onPress={onPress} />}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  tierIdentity: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, marginTop: spacing.xs },
  eyebrow: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 21, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
  items: { gap: spacing.xs },
  item: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
  next: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
});
