import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { Chip, formatPeso } from '@/features/listings/components';
import { amenityLabels } from '@/features/listings/mock-data';
import { ScoredListing } from '@/features/recommendations/types';
import { useTheme } from '@/hooks/use-theme';

export function MatchBadge({ score }: { score: number }) {
  const theme = useTheme();
  const percent = Math.round(score * 100);

  return (
    <View style={[styles.badge, { backgroundColor: theme.primarySoft, borderColor: theme.pricePanelBorder }]}>
      <ThemedText style={[styles.badgeValue, { color: theme.success }]}>{percent}%</ThemedText>
      <ThemedText style={[styles.badgeLabel, { color: theme.success }]}>match</ThemedText>
    </View>
  );
}

export function MatchBar({ score }: { score: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
      <View style={[styles.barFill, { width: `${Math.round(score * 100)}%`, backgroundColor: theme.primary }]} />
    </View>
  );
}

export function ScoredListingCard({
  listing,
  onPress,
}: {
  listing: ScoredListing;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: theme.border },
        pressed && { opacity: 0.75 },
      ]}>
      <View style={[styles.image, { backgroundColor: listing.imageGradient[1] }]}>
        <MatchBadge score={listing.matchScore} />
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <ThemedText style={styles.title}>{listing.title}</ThemedText>
          <ThemedText style={styles.price}>{formatPeso(listing.price)}</ThemedText>
        </View>
        <ThemedText style={styles.location}>{listing.city}, Cavite</ThemedText>
        <MatchBar score={listing.matchScore} />
        <View style={styles.breakdown}>
          <ScorePill label="Budget" score={listing.matchBreakdown.budget} />
          <ScorePill label="Area" score={listing.matchBreakdown.location} />
          <ScorePill label="Specs" score={listing.matchBreakdown.unitSpecs} />
          <ScorePill label="Amenities" score={listing.matchBreakdown.amenities} />
        </View>
        <View style={styles.chips}>
          {listing.amenities.slice(0, 3).map((amenity) => (
            <Chip key={amenity} label={amenityLabels[amenity]} color="accent" />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.scorePill}>
      <ThemedText style={styles.scoreText}>{label} {Math.round(score * 100)}%</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: 12,
    top: 12,
    minWidth: 74,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  badgeValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  badgeLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  barTrack: {
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: 7,
    borderRadius: 999,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  image: {
    height: 132,
  },
  body: {
    padding: 12,
    gap: 9,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  price: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  location: {
    fontSize: 13,
    lineHeight: 17,
    opacity: 0.62,
  },
  breakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  scorePill: {
    borderRadius: Radius.pill,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  scoreText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
