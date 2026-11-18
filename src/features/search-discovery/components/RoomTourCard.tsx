import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import type { PublicPropertyPanorama } from '../../../shared/models/PropertyPanorama';
import { roomTourSubtitle } from '../viewModels/roomTourViewerState';
import { RoomTourViewer } from './RoomTourViewer';

export const ROOM_TOUR_CARD_TITLE = 'Look around the room';

/** One compact card on the rental details screen; the whole card opens the tour. Renders nothing when no side is readable: never an empty or "no tour" placeholder. */
export function RoomTourCard({ tour }: { tour: readonly PublicPropertyPanorama[] }) {
  const [open, setOpen] = useState(false), [thumbFailed, setThumbFailed] = useState(false);
  const subtitle = roomTourSubtitle(tour), cover = tour[0];
  if (!subtitle || !cover) return null;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${ROOM_TOUR_CARD_TITLE}. ${subtitle}. Opens the room tour.`} onPress={() => setOpen(true)} style={styles.card}>
      <View accessible={false} style={styles.thumb}>
        {thumbFailed ? null : <Image source={{ uri: cover.url }} resizeMode="cover" resizeMethod="resize" onError={() => setThumbFailed(true)} style={StyleSheet.absoluteFill} />}
        <Text style={styles.badge}>{'360°'}</Text>
      </View>
      <View style={styles.text}><Text style={styles.title}>{ROOM_TOUR_CARD_TITLE}</Text><Text style={ui.supporting}>{subtitle}</Text></View>
      <Text accessible={false} style={styles.chevron}>{'›'}</Text>
    </Pressable>
    <RoomTourViewer tour={tour} visible={open} onClose={() => setOpen(false)} />
  </>;
}
const styles = StyleSheet.create({
  card: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, backgroundColor: colors.background },
  thumb: { width: 96, height: 56, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface },
  badge: { ...ui.supporting, position: 'absolute', top: spacing.xxs, left: spacing.xxs, fontWeight: '700', color: colors.white, backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 1, paddingHorizontal: spacing.xs, overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
  title: { ...ui.sectionTitle },
  chevron: { ...ui.pageTitle, paddingHorizontal: spacing.xs },
});
