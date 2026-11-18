import { useEffect, useState } from 'react';
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
  if (state.status === 'ready' && saved) return <SavedSide key={saved.url} side={side} url={saved.url} disabled={disabled} onMenu={onMenu} />;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Add ${name}. Opens your photos.`} accessibilityState={{ disabled }} disabled={disabled} onPress={onAdd} style={[styles.tile, styles.emptyTile, disabled && styles.dim]}>
    <View accessible={false} style={styles.plusCircle}><Text style={styles.plus}>+</Text></View>
    <Text style={styles.addLabel}>{`Add ${name}`}</Text>
  </Pressable>;
}

export type PreviewState = 'loading' | 'loaded' | 'failed';
const PREVIEW_TIMEOUT_MS = 10000;

/**
 * A saved side. The preview is only a picture: the side label and the "⋯" button are in their OWN row below it, never drawn on top of the image, so a preview that
 * cannot load or draw (a very large original, a bad connection) can never hide them. A preview that errors, or does not load within 10 seconds, says "Preview unavailable".
 */
function SavedSide({ side, url, disabled, onMenu }: { side: PanoramaSide; url: string; disabled: boolean; onMenu: () => void }) {
  const [preview, setPreview] = useState<PreviewState>('loading');
  useEffect(() => {
    if (preview !== 'loading') return;
    const timer = setTimeout(() => setPreview(current => (current === 'loading' ? 'failed' : current)), PREVIEW_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [preview]);
  return <SavedSideContent side={side} url={url} preview={preview} disabled={disabled} onMenu={onMenu} onPreviewLoad={() => setPreview('loaded')} onPreviewError={() => setPreview('failed')} />;
}

/** The pure rendering of a saved side for a given preview state (exported so the failed-preview layout can be tested directly). */
export function SavedSideContent({ side, url, preview, disabled, onMenu, onPreviewLoad, onPreviewError }: { side: PanoramaSide; url: string; preview: PreviewState; disabled: boolean; onMenu: () => void; onPreviewLoad?: () => void; onPreviewError?: () => void }) {
  const name = lower(side), label = panoramaSideLabel[side];
  return <View style={[styles.savedTile, disabled && styles.dim]}>
    <View style={styles.preview}>
      {preview !== 'failed' ? <Image source={{ uri: url }} accessible accessibilityLabel={`${label} room tour photo`} resizeMode="cover" resizeMethod="resize" onLoad={onPreviewLoad} onError={onPreviewError} style={StyleSheet.absoluteFill} /> : null}
      {preview === 'loading' ? <Text accessibilityLiveRegion="polite" style={styles.previewNote}>{'Loading preview…'}</Text> : null}
      {preview === 'failed' ? <Text accessibilityLiveRegion="polite" style={styles.previewNote}>Preview unavailable</Text> : null}
    </View>
    <View style={styles.footer}>
      <Text style={styles.sidePill}>{`✓ ${label}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`More actions for ${name}`} accessibilityState={{ disabled }} disabled={disabled} onPress={onMenu} style={styles.menuTarget}>
        <View style={styles.menuDot} accessible={false}><View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} /></View>
      </Pressable>
    </View>
  </View>;
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
  savedTile: { gap: spacing.xxs },
  preview: { height: TILE_HEIGHT, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  previewNote: { ...ui.supporting, textAlign: 'center', padding: spacing.sm },
  footer: { minHeight: TARGET, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sidePill: { ...ui.body, fontWeight: '700', color: colors.primaryAction, flexShrink: 1 },
  menuTarget: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
  menuDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  errorTile: { flexDirection: 'row', justifyContent: 'flex-start', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.restrictedSurface, borderWidth: 1.5, borderColor: colors.restricted },
  alertIcon: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.restricted, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  alertMark: { ...ui.body, fontWeight: '800', color: colors.restricted },
  errorText: { flex: 1, gap: 2 },
  errorTitle: { ...ui.body, fontWeight: '700', color: colors.restricted },
});
