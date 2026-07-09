import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppScreen, BrandHeader, PrimaryAction } from '@/features/listings/components';
import { recommendationRoutes } from '@/features/recommendations/routes';
import { useAuth } from '@/features/auth/auth-context';
import { saveTenantPreference } from '@/features/recommendations/recommendation-service';
import { defaultRecommendationPreference } from '@/features/recommendations/recommender';
import { authRoutes } from '@/features/auth/routes';
import { useTheme } from '@/hooks/use-theme';

export default function RecommendationIntroScreen() {
  const { session } = useAuth();
  const theme = useTheme();

  async function handleSkip() {
    if (session?.user.id) {
      await saveTenantPreference(session.user.id, defaultRecommendationPreference, true);
    }
    router.replace(authRoutes.home);
  }

  return (
    <AppScreen>
      <BrandHeader title="RentLease" />
      <View style={styles.hero}>
        <View style={[styles.iconBox, { backgroundColor: theme.primarySoft, borderColor: theme.pricePanelBorder }]}>
          <ThemedText style={styles.iconText}>RL</ThemedText>
        </View>
        <ThemedText style={styles.title}>Find homes that fit you first.</ThemedText>
        <ThemedText style={styles.copy}>
          Answer a short optional survey so RentLease can rank listings by your budget,
          preferred city, unit needs, and amenities.
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <PrimaryAction label="Answer Survey" onPress={() => router.push(recommendationRoutes.survey)} />
        <PrimaryAction label="Skip for now" tone="green" onPress={handleSkip} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: 78,
    gap: 18,
  },
  iconBox: {
    width: 86,
    height: 86,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  title: {
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '900',
  },
  copy: {
    width: '88%',
    fontSize: 15,
    lineHeight: 24,
    opacity: 0.72,
  },
  actions: {
    marginTop: 54,
    gap: 12,
  },
});
