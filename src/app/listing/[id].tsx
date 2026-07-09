import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  AppScreen,
  BottomNav,
  Chip,
  formatPeso,
  MapPreview,
  PrimaryAction,
  SectionLabel,
} from '@/features/listings/components';
import { amenityLabels } from '@/features/listings/mock-data';
import { getListingById } from '@/features/listings/listing-service';
import { Listing } from '@/features/listings/types';
import { useAuth } from '@/features/auth/auth-context';
import { postListingRoutes } from '@/features/post-listing/routes';
import { getOrCreateThread } from '@/features/post-listing/post-listing-service';
import { PriceEstimateCard } from '@/features/pricing/components';
import { getPriceEstimate, listingToPriceRequest, PriceEstimateResponse } from '@/features/pricing/price-service';
import { trustRoutes } from '@/features/trust/routes';
import { getListingRatings, getRatingSummary } from '@/features/trust/trust-service';
import { Rating } from '@/features/trust/types';
import { useTheme } from '@/hooks/use-theme';

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [estimate, setEstimate] = useState<PriceEstimateResponse | null>(null);
  const theme = useTheme();

  useEffect(() => {
    let isMounted = true;

    Promise.all([getListingById(id), getListingRatings(id)]).then(([nextListing, nextRatings]) => {
      if (!isMounted) return;
      setListing(nextListing);
      setRatings(nextRatings);
      getPriceEstimate(listingToPriceRequest(nextListing)).then((nextEstimate) => {
        if (isMounted) setEstimate(nextEstimate);
      });
    });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (!listing) {
    return (
      <AppScreen>
        <ThemedText>Loading listing...</ThemedText>
      </AppScreen>
    );
  }

  const ratingSummary = getRatingSummary(ratings);

  async function handleConnect() {
    if (!session?.user.id || !listing) return;
    const thread = await getOrCreateThread(listing.id, session.user.id, listing.ownerId);
    router.push(postListingRoutes.chatThread(thread.id));
  }

  return (
    <View style={styles.root}>
      <AppScreen>
        <Pressable onPress={() => router.back()} style={styles.backCircle}>
          <ThemedText style={styles.backText}>{'<'}</ThemedText>
        </Pressable>
        <View style={[styles.hero, { backgroundColor: listing.imageGradient[1] }]} />
        <View style={styles.thumbRow}>
          {listing.imageGradient.map((color) => (
            <View key={color} style={[styles.thumb, { backgroundColor: color }]} />
          ))}
          <View style={[styles.thumb, { backgroundColor: theme.backgroundSubtle }]} />
        </View>

        <View style={styles.summary}>
          <View>
            <ThemedText style={styles.price}>{formatPeso(listing.price)}</ThemedText>
            <ThemedText style={styles.location}>{listing.city} City, Cavite</ThemedText>
          </View>
          <Pressable onPress={() => router.push(trustRoutes.reportListing(listing.id))} style={styles.reportButton}>
            <ThemedText style={styles.report}>!</ThemedText>
          </Pressable>
        </View>
        <ThemedText style={styles.title}>{listing.title}</ThemedText>
        <View style={styles.chips}>
          <Chip label={listing.propertyType} />
          <Chip label={listing.furnishingStatus.replace('_', ' ')} color="neutral" />
        </View>

        <SectionLabel>Description</SectionLabel>
        <ThemedText style={styles.description}>{listing.description}</ThemedText>

        <SectionLabel>Reviews</SectionLabel>
        <Pressable
          onPress={() => router.push(trustRoutes.listingReviews(listing.id))}
          style={[styles.reviewSummary, { borderColor: theme.border }]}>
          <View>
            <ThemedText style={styles.reviewScore}>
              {ratingSummary.count > 0 ? `${ratingSummary.average}/5` : 'No reviews yet'}
            </ThemedText>
            <ThemedText style={styles.reviewCount}>
              {ratingSummary.count > 0 ? `${ratingSummary.count} renter reviews` : 'Be the first to rate this listing'}
            </ThemedText>
          </View>
          <ThemedText style={styles.reviewArrow}>{'>'}</ThemedText>
        </Pressable>

        <SectionLabel>Landlord</SectionLabel>
        <View style={styles.landlord}>
          <View style={styles.landlordAvatar} />
          <View style={styles.landlordCopy}>
            <ThemedText style={styles.landlordName}>{listing.landlordName}</ThemedText>
            <ThemedText style={styles.landlordBadge}>{listing.landlordBadge}</ThemedText>
          </View>
        </View>

        <View style={[styles.pricePanel, { borderColor: theme.pricePanelBorder }]}>
          <View>
            <ThemedText style={styles.estimateLabel}>Price estimation by RentLease</ThemedText>
            <ThemedText style={styles.estimatePrice}>{formatPeso(listing.price)}</ThemedText>
            <View style={styles.rangePill}>
              <ThemedText style={styles.rangeText}>Range PHP 49,000-PHP 67,800</ThemedText>
            </View>
          </View>
          <View style={styles.estimateNotes}>
            <ThemedText style={styles.estimateNote}>
              {"Listed price is within RentLease's estimate."}
            </ThemedText>
            <ThemedText style={styles.estimateNote}>
              {"Landlord used RentLease's price tool."}
            </ThemedText>
          </View>
        </View>

        {estimate ? (
          <>
            <SectionLabel>Suggested Price</SectionLabel>
            <PriceEstimateCard estimate={estimate} compact />
          </>
        ) : null}

        <SectionLabel>Unit Specifications</SectionLabel>
        <View style={styles.specGrid}>
          <Spec label={`${listing.bedrooms} Bedrooms`} />
          <Spec label={`${listing.bathrooms} Bathrooms`} />
          <Spec label={`${listing.sizeSqm} sqm`} />
          <Spec label={`${listing.parkingSpaces} Parking`} />
        </View>

        <SectionLabel>Location</SectionLabel>
        <MapPreview listings={[listing]} />
        <View style={[styles.addressBox, { borderColor: theme.text }]}>
          <ThemedText style={styles.address}>{listing.address}</ThemedText>
        </View>

        <SectionLabel>Amenities</SectionLabel>
        <View style={styles.chips}>
          {listing.amenities.map((amenity) => (
            <Chip key={amenity} label={amenityLabels[amenity]} color="accent" />
          ))}
        </View>

        <PrimaryAction label="Connect with Landlord" onPress={handleConnect} style={styles.contactButton} />
        <View style={styles.trustActions}>
          <PrimaryAction
            label="Schedule Viewing"
            tone="green"
            onPress={() => router.push(postListingRoutes.schedule(listing.id, listing.ownerId))}
            style={styles.trustAction}
          />
        </View>
        <View style={styles.trustActions}>
          <PrimaryAction
            label="Rate Landlord"
            tone="green"
            onPress={() => router.push(trustRoutes.rate(listing.id, listing.ownerId, listing.landlordName))}
            style={styles.trustAction}
          />
          <PrimaryAction
            label="Report Landlord"
            onPress={() => router.push(trustRoutes.reportUser(listing.ownerId))}
            style={styles.trustAction}
          />
        </View>
      </AppScreen>
      <BottomNav active="discover" />
    </View>
  );
}

function Spec({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.spec, { borderColor: theme.text }]}>
      <ThemedText style={styles.specIcon}>•</ThemedText>
      <ThemedText style={styles.specLabel}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backCircle: {
    position: 'absolute',
    top: 50,
    left: 9,
    zIndex: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(217,217,217,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  hero: {
    height: 245,
    marginHorizontal: -16,
    marginTop: 43,
  },
  thumbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 33,
    paddingHorizontal: 8,
  },
  thumb: {
    width: 87,
    height: 57,
    borderRadius: 4,
  },
  summary: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '600',
  },
  location: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 16,
  },
  report: {
    fontSize: 28,
    fontWeight: '800',
  },
  reportButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 10,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500',
  },
  chips: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  description: {
    marginTop: 10,
    marginBottom: 26,
    fontSize: 13,
    lineHeight: 22,
  },
  reviewSummary: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  reviewScore: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  reviewCount: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.58,
  },
  reviewArrow: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
  },
  landlord: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  landlordAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D9D9D9',
  },
  landlordCopy: {
    gap: 3,
  },
  landlordName: {
    fontSize: 13,
    fontWeight: '700',
  },
  landlordBadge: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.37,
  },
  pricePanel: {
    minHeight: 112,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#F0FFED',
    padding: 18,
    flexDirection: 'row',
    gap: 18,
    marginBottom: 28,
  },
  estimateLabel: {
    color: '#3B6D11',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  estimatePrice: {
    marginTop: 7,
    color: '#63835A',
    fontSize: 21,
    fontWeight: '700',
  },
  rangePill: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#C0DD97',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  rangeText: {
    color: '#3B6D11',
    fontSize: 11,
    lineHeight: 15,
  },
  estimateNotes: {
    flex: 1,
    gap: 12,
  },
  estimateNote: {
    color: '#3B6D11',
    fontSize: 12,
    lineHeight: 17,
  },
  specGrid: {
    marginTop: 14,
    gap: 9,
    marginBottom: 22,
  },
  spec: {
    height: 54,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  specIcon: {
    fontSize: 22,
  },
  specLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  addressBox: {
    marginTop: 12,
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 10,
  },
  address: {
    fontSize: 15,
  },
  contactButton: {
    marginTop: 26,
  },
  trustActions: {
    marginTop: 10,
    marginBottom: 24,
    flexDirection: 'row',
    gap: 10,
  },
  trustAction: {
    flex: 1,
    minHeight: 48,
  },
});
