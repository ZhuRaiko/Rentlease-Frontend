import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { panoramaSideLabel, type PanoramaSide, type PublicPropertyPanorama } from '../../../shared/models/PropertyPanorama';
import { ListingButton } from './ListingButton';

function Sheet({ onClose, children, label }: { onClose: () => void; children: React.ReactNode; label: string }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label}`} onPress={onClose} style={styles.scrim} />
    <View accessibilityViewIsModal style={styles.sheet}>{children}</View>
  </Modal>;
}

/** The "⋯" menu: the side's preview, Replace photo, Remove. */
export function RoomTourMenuSheet({ side, panorama, onReplace, onRemove, onClose }: { side: PanoramaSide; panorama: PublicPropertyPanorama | null; onReplace: () => void; onRemove: () => void; onClose: () => void }) {
  return <Sheet onClose={onClose} label="menu">
    <View style={styles.head}>
      {panorama ? <Image source={{ uri: panorama.url }} accessible={false} resizeMode="cover" style={styles.preview} /> : null}
      <Text accessibilityRole="header" style={styles.title}>{panoramaSideLabel[side]}</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onReplace} style={styles.row}><Text style={styles.rowText}>Replace photo</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onRemove} style={styles.row}><Text style={[styles.rowText, styles.danger]}>Remove</Text></Pressable>
  </Sheet>;
}

/** The only place with two buttons: Keep it / Remove. */
export function RoomTourRemoveSheet({ side, busy, onKeep, onRemove }: { side: PanoramaSide; busy: boolean; onKeep: () => void; onRemove: () => void }) {
  return <Sheet onClose={onKeep} label="confirmation">
    <Text accessibilityRole="header" style={styles.title}>{`Remove ${panoramaSideLabel[side].toLowerCase()}?`}</Text>
    <Text style={ui.body}>Renters won&apos;t see it anymore. You can add it again later.</Text>
    <View style={styles.buttons}>
      <View style={styles.cell}><ListingButton label="Keep it" tone="outline" disabled={busy} onPress={onKeep} /></View>
      <View style={styles.cell}><ListingButton label={busy ? 'Removing…' : 'Remove'} tone="danger" disabled={busy} onPress={onRemove} /></View>
    </View>
  </Sheet>;
}
const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill as object, backgroundColor: colors.overlay },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  preview: { width: 72, height: 48, borderRadius: radius.sm, backgroundColor: colors.surface },
  title: { ...ui.sectionTitle },
  row: { minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.outline },
  rowText: { ...ui.body, fontWeight: '700' },
  danger: { color: colors.restricted },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: 130 },
});
