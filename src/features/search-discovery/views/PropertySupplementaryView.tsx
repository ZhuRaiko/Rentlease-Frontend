import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryHeader } from '../components/DiscoveryControls';
import { DiscoveryIcon } from '../components/DiscoveryIcon';
import { DiscoveryMapPlaceholder } from '../components/DiscoveryMapPlaceholder';
import { DiscoveryPropertyImage } from '../components/DiscoveryPropertyImage';
import type { ImageCrop } from '../models/SearchDiscovery';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';

interface PropertySupplementaryViewProps {
  viewModel: SearchDiscoveryViewModel;
}

const galleryCrops: ImageCrop[] = [
  { x: 2, y: 25, width: 225, height: 105 },
  { x: 14, y: 154, width: 44, height: 33 },
  { x: 61, y: 154, width: 44, height: 33 },
  { x: 108, y: 154, width: 44, height: 33 },
  { x: 155, y: 154, width: 44, height: 33 },
];

export function PropertySupplementaryView({ viewModel }: PropertySupplementaryViewProps) {
  const property = viewModel.selectedProperty;
  if (!property) return null;

  if (viewModel.screen === 'photoGallery') {
    const activeCrop = galleryCrops[viewModel.galleryIndex] ?? galleryCrops[0];
    if (!activeCrop) return null;
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onBack={viewModel.goBack} title="Property Photos" />
        <ScrollView contentContainerStyle={styles.galleryContent} showsVerticalScrollIndicator={false}>
          <View style={styles.mainPhoto}>
            <DiscoveryPropertyImage borderRadius={radius.card} crop={activeCrop} />
          </View>
          <Text style={styles.galleryCount}>Photo {viewModel.galleryIndex + 1} of {galleryCrops.length}</Text>
          <View style={styles.thumbnailGrid}>
            {galleryCrops.map((crop, index) => (
              <Pressable
                accessibilityLabel={`View photo ${index + 1}`}
                accessibilityRole="button"
                accessibilityState={{ selected: index === viewModel.galleryIndex }}
                key={`${crop.x}-${crop.y}`}
                onPress={() => viewModel.setGalleryIndex(index)}
                style={[styles.thumbnail, index === viewModel.galleryIndex && styles.thumbnailActive]}
              >
                <DiscoveryPropertyImage borderRadius={radius.sm} crop={crop} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (viewModel.screen === 'propertyAmenities') {
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onBack={viewModel.goBack} title="Property Amenities" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>Features included with {property.title}</Text>
          <View style={styles.rows}>
            {property.amenities.map((amenity) => (
              <View key={amenity} style={styles.row}>
                <View style={styles.iconCircle}><DiscoveryIcon color={colors.primary} name="filter" size={20} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{amenity}</Text>
                  <Text style={styles.rowBody}>Included in this listing</Text>
                </View>
                <View style={styles.availableDot} />
              </View>
            ))}
          </View>
          <Text style={styles.previewNote}>Amenity availability is presentation-only until listing data is connected.</Text>
        </ScrollView>
      </View>
    );
  }

  if (viewModel.screen === 'nearbyPlaces') {
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onBack={viewModel.goBack} title="Nearby Places" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>Everyday essentials near {property.city}</Text>
          <View style={styles.rows}>
            {property.nearbyPlaces.map((place) => (
              <View key={place.id} style={styles.row}>
                <View style={styles.iconCircle}><DiscoveryIcon color={colors.primary} name="location" size={20} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{place.name}</Text>
                  <Text style={styles.rowBody}>{place.category}</Text>
                </View>
                <Text style={styles.distance}>{place.distance}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.previewNote}>Nearby-place distances are local preview values. OpenStreetMap Overpass is not queried yet.</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DiscoveryHeader onBack={viewModel.goBack} title="Property Location" />
      <ScrollView contentContainerStyle={styles.locationContent}>
        <DiscoveryMapPlaceholder onSelectProperty={() => undefined} properties={[property]} />
        <View style={styles.addressCard}>
          <View style={styles.iconCircle}><DiscoveryIcon color={colors.primary} name="location" size={20} /></View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{property.address}</Text>
            <Text style={styles.rowBody}>{property.city}, Cavite · Approximate preview location</Text>
          </View>
        </View>
        <Text style={styles.previewNote}>Interactive MapTiler/MapLibre rendering and exact coordinates remain disconnected.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  galleryContent: { gap: spacing.md, padding: spacing.lg },
  mainPhoto: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden' },
  galleryCount: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, textAlign: 'center' },
  thumbnailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbnail: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 2, overflow: 'hidden', width: '47%' },
  thumbnailActive: { borderColor: colors.primary },
  content: { gap: spacing.lg, padding: spacing.lg },
  lead: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '900', lineHeight: 28 },
  rows: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 72, paddingHorizontal: spacing.md },
  iconCircle: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 42, justifyContent: 'center', width: 42 },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  rowBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: spacing.xxs },
  availableDot: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, height: 13, width: 13 },
  distance: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  previewNote: { backgroundColor: colors.surface, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, padding: spacing.sm },
  locationContent: { gap: spacing.md, padding: spacing.lg },
  addressCard: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
});
