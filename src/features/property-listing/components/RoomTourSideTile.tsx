import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { panoramaSideLabel, type PanoramaSide } from '../../../shared/models/PropertyPanorama';
import { panoramaProblemText } from '../models/PropertyPanoramaSelection';
import type { SideState } from '../viewModels/propertyPanoramaWorkflow';

const TILE_HEIGHT = 96, TARGET = 48;
const lower = (side: PanoramaSide) => panoramaSideLabel[side].toLowerCase();

/**
 * One side of the room tour. An empty tile is itself the Add button; a saved tile has a "⋯" menu button; a problem tile is red (icon plus words,
 * never color alone) and opens the picker again. While another change runs, this tile is disabled. Pure presentation: every action comes from props.
 */
export function RoomTourSideTile({ side, state, disabled, onAdd, onMenu }: { side: PanoramaSide; state: SideState; disabled: boolean; onAdd: () => void; onMenu: () => void }) {
  const name = lower(side), label = panoramaSideLabel[side];
  const working = state.status === 'picking' || state.status === 'uploading';
  const saved = state.panorama;
  if (state.status === 'error' && state.problem) {
    const text = panoramaProblemText[state.problem];
    return <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${text.title} ${text.body}`} accessibilityState={{ disabled }} disabled={disabled} onPress={onAdd} style={[styles.tile, styles.errorTile, disabled && styles.dim]}>
      <View accessible={false} style={styles.alertIcon}><Text style={styles.alertMark}>!</Text></View>
      <View style={styles.errorText}><Text style={styles.errorTitle}>{text.title}</Text><Text style={ui.supporting}>{text.body}</Text></View>
    </Pressable>;
  }
  if (working) {
    return <View accessibilityLabel={`Uploading ${name}`} accessibilityLiveRegion="polite" style={[styles.tile, styles.workingTile]}>
      {saved ? <Image source={{ uri: saved.url }} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.dimImage]} /> : null}
      <ActivityIndicator color={colors.primaryAction} />
      <Text style={styles.workingText}>{state.status === 'picking' ? 'Opening your photos…' : `Uploading ${name}…`}</Text>
    </View>;
  }
  if (state.status === 'ready' && saved) {
    return <View style={[styles.tile, styles.savedTile, disabled && styles.dim]}>
      <Image source={{ uri: saved.url }} accessible accessibilityLabel={`${label} room tour photo`} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <Text style={styles.sidePill}>{`✓ ${label}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More actions for ${name}`} accessibilityState={{ disabled }} disabled={disabled} onPress={onMenu} hitSlop={0} style={styles.menuTarget}>
        <View style={styles.menuDot} accessible={false}><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View>
      </Pressable>
    </View>;
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={`Add ${name}. Opens your photos.`} accessibilityState={{ disabled }} disabled={disabled} onPress={onAdd} style={[styles.tile, styles.emptyTile, disabled && styles.dim]}>
    <View accessible={false} style={styles.plusCircle}><Text style={styles.plus}>+</Text></View>
    <Text style={styles.addLabel}>{`Add ${name}`}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  tile: { minHeight: TILE_HEIGHT, borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
  dimImage: { opacity: 0.35 },
  emptyTile: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primaryAction, backgroundColor: colors.primaryPale, gap: spacing.xxs, padding: spacing.sm },
  plusCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryAction, alignItems: 'center', justifyContent: 'center' },
  plus: { ...ui.sectionTitle, color: colors.white },
  addLabel: { ...ui.body, fontWeight: '700' },
  workingTile: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline, gap: spacing.xs, padding: spacing.sm },
  workingText: { ...ui.body, fontWeight: '700' },
  savedTile: { backgroundColor: colors.surface, alignItems: 'stretch', justifyContent: 'flex-end' },
  sidePill: { ...ui.supporting, alignSelf: 'flex-start', margin: spacing.xs, fontWeight: '700', color: colors.primaryAction, backgroundColor: colors.background, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.sm, overflow: 'hidden' },
  menuTarget: { position: 'absolute', top: 0, right: 0, width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
  menuDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  errorTile: { flexDirection: 'row', justifyContent: 'flex-start', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.restrictedSurface, borderWidth: 1.5, borderColor: colors.restricted },
  alertIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.restricted, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  alertMark: { ...ui.body, fontWeight: '800', color: colors.restricted },
  errorText: { flex: 1, gap: 2 },
  errorTitle: { ...ui.body, fontWeight: '700', color: colors.restricted },
});
