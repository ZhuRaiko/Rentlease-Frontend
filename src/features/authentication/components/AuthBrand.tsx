import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const homeIcon = require('../../../assets/authentication/rentlease-home.png');

interface AuthBrandProps {
  compact?: boolean;
  showTagline?: boolean;
}

export function AuthBrand({ compact = false, showTagline = true }: AuthBrandProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.brandRow}>
        <Text maxFontSizeMultiplier={1.2} style={[styles.wordmark, compact && styles.compactWordmark]}>RentLease</Text>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={homeIcon}
          style={[styles.icon, compact && styles.compactIcon]}
        />
      </View>
      {showTagline ? <Text style={styles.tagline}>Home found. Community approved.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing.xs },
  brandRow: { alignItems: 'center', flexDirection: 'row', maxWidth: '100%' },
  wordmark: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1.7,
  },
  compactWordmark: { fontSize: 42, letterSpacing: -1.2 },
  icon: { height: 56, marginLeft: 4, width: 56 },
  compactIcon: { height: 44, width: 44 },
  tagline: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 16,
    fontWeight: '300',
    textAlign: 'center',
  },
});
