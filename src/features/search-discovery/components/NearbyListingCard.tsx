import { StyleSheet, Text, View } from 'react-native';
import type { RpcNearbyListing } from '../models/GpsProximity';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const labels: Record<string, string> = { imus: 'Imus', dasmarinas: 'Dasmariñas', tagaytay: 'Tagaytay', boarding_house: 'Boarding house', bedspace: 'Bedspace', condominium: 'Condominium', studio: 'Studio', apartment: 'Apartment', house: 'House', room: 'Room', dormitory: 'Dormitory', other: 'Other' };
export function NearbyListingCard({ listing }: { listing: RpcNearbyListing }) {
  // Decimal transport strings remain strings; no lossy numeric conversion for display.
  const rent = listing.askingRentMonthly === null ? 'Rent not provided' : `₱${typeof listing.askingRentMonthly === 'number' ? listing.askingRentMonthly.toLocaleString('en-PH') : listing.askingRentMonthly} /mo`;
  return <View style={styles.card}>
    <Text style={styles.rent}>{rent}</Text>
    <Text accessibilityRole="header" style={styles.title}>{listing.title || 'Rental listing'}</Text>
    <Text style={styles.copy}>{listing.propertyType ? labels[listing.propertyType] ?? listing.propertyType : 'Property type not provided'}</Text>
    <Text style={styles.copy}>{[listing.barangay, listing.city ? labels[listing.city] ?? listing.city : null].filter(Boolean).join(', ') || 'Area not provided'}</Text>
    <Text style={styles.distance}>{listing.distanceMeters} m away</Text>
    <Text style={styles.copy}>{listing.availableFrom ? `Available from ${listing.availableFrom}` : 'Availability date not provided'}</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { paddingVertical: spacing.lg, gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  rent: { fontFamily: typography.family, fontSize: 18, fontWeight: '800', color: colors.primary },
  title: { fontFamily: typography.family, fontSize: 17, fontWeight: '700', color: colors.text },
  copy: { fontFamily: typography.family, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  distance: { fontFamily: typography.family, fontSize: 14, fontWeight: '700', color: colors.primary },
});
