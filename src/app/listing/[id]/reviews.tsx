import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { AppScreen, BrandHeader, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { getListingById } from '@/features/listings/listing-service';
import { Listing } from '@/features/listings/types';
import { trustRoutes } from '@/features/trust/routes';
import { getListingRatings, getRatingSummary } from '@/features/trust/trust-service';
import { Rating } from '@/features/trust/types';
import { useTheme } from '@/hooks/use-theme';

export default function ListingReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getListingById(id), getListingRatings(id)]).then(([nextListing, nextRatings]) => {
      if (!isMounted) return;
      setListing(nextListing);
      setRatings(nextRatings);
    });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const summary = getRatingSummary(ratings);

  return (
    <AppScreen>
      <BrandHeader title="Reviews" />
      <Pressable onPress={() => router.back()} style={styles.back}>
        <ThemedText style={styles.backText}>{'<'}</ThemedText>
      </Pressable>
      <View style={styles.heading}>
        <ThemedText style={styles.title}>{listing?.title ?? 'Listing reviews'}</ThemedText>
        <ThemedText style={styles.copy}>
          {summary.count > 0 ? `${summary.average}/5 from ${summary.count} reviews` : 'No reviews yet'}
        </ThemedText>
      </View>

      {listing ? (
        <PrimaryAction
          label="Rate Landlord"
          onPress={() => router.push(trustRoutes.rate(listing.id, listing.ownerId, listing.landlordName))}
          style={styles.rateButton}
        />
      ) : null}

      <SectionLabel>Review List</SectionLabel>
      <View style={styles.list}>
        {ratings.length === 0 ? <ThemedText style={styles.empty}>Reviews will appear here after ratings are submitted.</ThemedText> : null}
        {ratings.map((rating) => (
          <ReviewCard key={rating.id} rating={rating} />
        ))}
      </View>
    </AppScreen>
  );
}

function ReviewCard({ rating }: { rating: Rating }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <ThemedText style={styles.stars}>{'★'.repeat(rating.score)}{'☆'.repeat(5 - rating.score)}</ThemedText>
        <ThemedText style={styles.date}>{new Date(rating.createdAt).toLocaleDateString('en-PH')}</ThemedText>
      </View>
      <ThemedText style={styles.reviewText}>{rating.reviewText || 'No written review.'}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    padding: 8,
  },
  backText: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '700',
  },
  heading: {
    marginTop: 10,
    gap: 8,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.66,
  },
  rateButton: {
    marginTop: 20,
  },
  list: {
    marginTop: 12,
    gap: 12,
  },
  empty: {
    opacity: 0.56,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 14,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  stars: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  date: {
    fontSize: 12,
    opacity: 0.5,
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 21,
  },
});
