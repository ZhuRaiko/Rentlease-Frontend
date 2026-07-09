import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function TrustBadgeCard({ score, badge }: { score: number; badge: string }) {
  const theme = useTheme();
  const isPremium = badge === 'Premium';
  const isTrusted = badge === 'Trusted';
  const backgroundColor = isPremium ? theme.accentSoft : theme.primarySoft;
  const borderColor = isPremium ? theme.accent : theme.pricePanelBorder;
  const textColor = isPremium ? theme.accent : theme.success;

  return (
    <View style={[styles.card, { backgroundColor, borderColor }]}>
      <View style={styles.mark}>
        <ThemedText style={[styles.markText, { color: textColor }]}>{isPremium ? 'T3' : isTrusted ? 'T2' : 'T1'}</ThemedText>
      </View>
      <View style={styles.copy}>
        <ThemedText style={[styles.badge, { color: textColor }]}>{badge}</ThemedText>
        <ThemedText style={[styles.score, { color: textColor }]}>{Math.round(score * 100)}% trust score</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 86,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  copy: {
    flex: 1,
  },
  badge: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  score: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
