import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthBrand } from '../components/AuthBrand';

interface WelcomeViewProps {
  onSignIn: () => void;
  onCreateAccount: () => void;
  notice?: string | null;
}

export function WelcomeView({ onSignIn, onCreateAccount, notice }: WelcomeViewProps) {
  const { width, fontScale } = useWindowDimensions();
  return <ScrollView contentContainerStyle={styles.screen}>
    <View style={styles.brand}><AuthBrand compact={width < 380 || fontScale > 1.2} /><Text style={styles.location}>Rental homes in Cavite</Text></View>
    <View style={styles.introduction}>
      <Text accessibilityRole="header" style={styles.title}>Your next chapter starts at home.</Text>
      <Text style={styles.body}>Find your place or make room for someone new.</Text>
    </View>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onSignIn} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.copy}><Text style={styles.cardTitle}>Sign in</Text><Text style={styles.body}>Already part of RentLease? Welcome back.</Text></View>
        <Image accessible={false} resizeMode="contain" source={require('../../../assets/authentication/arrow-forward.png')} style={styles.arrow} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onCreateAccount} style={({ pressed }) => [styles.card, styles.createCard, pressed && styles.pressed]}>
        <View style={styles.copy}><Text style={[styles.cardTitle, styles.createText]}>Create account</Text><Text style={[styles.body, styles.createText]}>Get started as a Tenant, Landlord, or both.</Text></View>
        <Text accessible={false} style={styles.createArrow}>{'\u203a'}</Text>
      </Pressable>
    </View>
    <FeedbackNotice message={notice} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { alignSelf: 'center', flexGrow: 1, justifyContent: 'center', gap: spacing.xl, maxWidth: 460, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, width: '100%' },
  brand: { gap: spacing.md, alignItems: 'center' },
  location: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  introduction: { gap: spacing.sm },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 30, fontWeight: '800', lineHeight: 38 },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 15, lineHeight: 22 },
  actions: { gap: spacing.md },
  card: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, borderRadius: radius.card, minHeight: 112, padding: spacing.lg },
  copy: { flex: 1, gap: spacing.xs, minWidth: 0 },
  cardTitle: { color: colors.text, fontFamily: typography.family, fontSize: 21, fontWeight: '700' },
  arrow: { width: 20, height: 28 },
  createCard: { backgroundColor: colors.primaryAction, borderColor: colors.primaryAction },
  createText: { color: colors.white },
  createArrow: { color: colors.white, fontSize: 36 },
  pressed: { opacity: 0.8 },
});
