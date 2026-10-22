import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

export function OnboardingAccountOptions({ identity, disabled, onSwitch }: { identity: string; disabled: boolean; onSwitch: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded, disabled }} disabled={disabled} onPress={() => setExpanded(value => !value)} style={styles.action}>
      <Text style={styles.label}>{expanded ? 'Hide account options' : 'Account options'}</Text>
    </Pressable>
    {expanded ? <View>
      <Text style={styles.identity}>Signed in as {identity}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onSwitch} style={styles.action}><Text style={styles.link}>Sign out and switch account</Text></Pressable>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.xs },
  action: { justifyContent: 'center', minHeight: 48, paddingVertical: spacing.xs },
  label: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14 },
  link: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  identity: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13 },
});
