import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { DiscoveryProperty } from '../models/SearchDiscovery';
import { DiscoveryPropertyImage } from './DiscoveryPropertyImage';

interface DiscoveryMapPlaceholderProps {
  properties: DiscoveryProperty[];
  onSelectProperty: (propertyId: string) => void;
}

const pinPositions = [
  { left: '18%', top: '30%' },
  { left: '54%', top: '42%' },
  { left: '70%', top: '20%' },
] as const;

export function DiscoveryMapPlaceholder({
  properties,
  onSelectProperty,
}: DiscoveryMapPlaceholderProps) {
  return (
    <View style={styles.map}>
      <View style={styles.mapImage}>
        <DiscoveryPropertyImage crop={{ x: 14, y: 576, width: 199, height: 131 }} />
      </View>
      <View style={styles.previewBadge}>
        <Text style={styles.previewBadgeText}>Map preview</Text>
      </View>
      {properties.slice(0, 3).map((property, index) => {
        const position = pinPositions[index] ?? pinPositions[0];
        return (
          <Pressable
            accessibilityLabel={`Open ${property.title}`}
            accessibilityRole="button"
            key={property.id}
            onPress={() => onSelectProperty(property.id)}
            style={[styles.pin, position]}
          >
            <Text style={styles.pinLabel}>₱{Math.round(property.rent / 1000)}k</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { aspectRatio: 199 / 131, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  mapImage: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  previewBadge: { backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radius.pill, left: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, position: 'absolute', top: spacing.sm },
  previewBadgeText: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  pin: { backgroundColor: colors.primary, borderColor: colors.white, borderRadius: radius.pill, borderWidth: 2, elevation: 3, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, position: 'absolute' },
  pinLabel: { color: colors.white, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
});
