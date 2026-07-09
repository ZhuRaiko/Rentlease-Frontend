import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { submitRating } from '@/features/trust/trust-service';
import { useTheme } from '@/hooks/use-theme';

export default function RatePartyScreen() {
  const { listingId, rateeId, rateeName } = useLocalSearchParams<{
    listingId?: string;
    rateeId?: string;
    rateeName?: string;
  }>();
  const { session } = useAuth();
  const [score, setScore] = useState(5);
  const [reviewText, setReviewText] = useState('');

  async function handleSubmit() {
    if (!session?.user.id) {
      Alert.alert('Sign in needed', 'Please sign in again before leaving a rating.');
      return;
    }

    try {
      await submitRating(session.user.id, {
        rateeId: rateeId ?? null,
        listingRef: listingId ?? null,
        score,
        reviewText,
      });
      router.back();
    } catch (error) {
      Alert.alert('Rating failed', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Rate" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>How was your experience?</ThemedText>
        <ThemedText style={styles.copy}>
          Rate {rateeName ? decodeURIComponent(rateeName) : 'the other party'} so future RentLease users know what to expect.
        </ThemedText>
      </View>

      <SectionLabel>Stars</SectionLabel>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Star key={value} value={value} selected={value <= score} onPress={() => setScore(value)} />
        ))}
      </View>

      <SectionLabel>Review</SectionLabel>
      <FormInput
        multiline
        value={reviewText}
        onChangeText={setReviewText}
        placeholder="Share what went well, what felt risky, or what others should know."
        style={styles.review}
      />
      <PrimaryAction label="Submit Rating" onPress={handleSubmit} style={styles.submit} />
    </AppScreen>
  );
}

function Star({ value, selected, onPress }: { value: number; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={`${value} star`}
      onPress={onPress}
      style={[styles.star, { borderColor: selected ? theme.primary : theme.borderStrong }]}>
      <ThemedText style={[styles.starText, { color: selected ? theme.primary : theme.tabInactive }]}>★</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: 10,
    gap: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.66,
  },
  stars: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  star: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starText: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  review: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: 24,
  },
});
