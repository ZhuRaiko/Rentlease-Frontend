import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { clampPanOffset, maxPanOffset, panProgress, panoramaSideLabel, stripAreaHeight, stripWidth, visibleFraction, type PanoramaSide, type PublicPropertyPanorama } from '../../../shared/models/PropertyPanorama';
import { markDragHintSeen, openRoomTour, retrySide, selectSide, shouldShowDragHint, showSideSwitch, sideFailed, sideLoaded, switchEnabled, type RoomTourViewerState } from '../viewModels/roomTourViewerState';

const TARGET = 48, BAR_WIDTH = 140, BAR_HEIGHT = 4, MIN_THUMB = 24;

/**
 * Full-screen room tour: a strip viewer. The image fills the strip area by HEIGHT and keeps its own shape, so most of it is off-screen; a horizontal drag pans it,
 * clamped at both edges, starting at the left edge. No zoom, no WebView. Close with the X or the Android Back button. Pure presentation: all state decisions are in roomTourViewerState.
 */
export function RoomTourViewer({ tour, visible, onClose }: { tour: readonly PublicPropertyPanorama[]; visible: boolean; onClose: () => void }) {
  return <Modal visible={visible} onRequestClose={onClose} animationType="fade" presentationStyle="fullScreen" supportedOrientations={['portrait']} statusBarTranslucent>
    <GestureHandlerRootView style={styles.root}>{visible ? <Session tour={tour} onClose={onClose} /> : null}</GestureHandlerRootView>
  </Modal>;
}

function Session({ tour, onClose }: { tour: readonly PublicPropertyPanorama[]; onClose: () => void }) {
  const [view, setView] = useState<RoomTourViewerState | null>(() => openRoomTour(tour));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hint, setHint] = useState(shouldShowDragHint);
  const progress = useRef(new Animated.Value(0)).current;   // 0..1 position in the strip, shared by the strip (writes) and the bar (reads)
  const dismissHint = useCallback(() => { markDragHintSeen(); setHint(false); }, []);
  useEffect(() => () => { if (shouldShowDragHint()) markDragHintSeen(); }, []);   // once per session even if the hint was never touched away
  if (!view) return null;
  const current = tour.find(p => p.side === view.selected)!;
  const areaHeight = stripAreaHeight(size.height), strip = stripWidth(areaHeight, current.width, current.height), max = maxPanOffset(strip, size.width);
  const status = view.load[view.selected], name = panoramaSideLabel[view.selected];
  const onLayout = (event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  return <View style={styles.root} onLayout={onLayout}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close room tour" onPress={onClose} style={styles.closeTarget}><View accessible={false} style={styles.close}><Text style={styles.closeMark}>{'×'}</Text></View></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Room tour</Text>
    </View>
    <View style={styles.middle}>
      {areaHeight > 0 ? <View style={{ height: areaHeight }}>
        <Strip key={`${view.selected}:${view.reloads[view.selected]}`} panorama={current} width={strip} height={areaHeight} viewportWidth={size.width} max={max} status={status} progress={progress}
          onLoaded={() => setView(v => v && sideLoaded(v, current.side))} onFailed={() => setView(v => v && sideFailed(v, current.side))} onTouch={dismissHint} />
        {status === 'loading' ? <View style={styles.center} pointerEvents="none"><ActivityIndicator accessibilityLabel={`Loading ${name.toLowerCase()}`} color={colors.white} /><Text accessibilityLiveRegion="polite" style={styles.onDark}>{`Loading ${name.toLowerCase()}...`}</Text></View> : null}
        {status === 'failed' ? <View style={[styles.center, styles.failed]}>
          <Text accessibilityRole="alert" style={styles.failTitle}>{`Couldn’t load the ${name.toLowerCase()}`}</Text>
          <Text style={styles.onDark}>Check your connection and try again.</Text>
          <AppButton label="Try again" onPress={() => setView(v => v && retrySide(v, current.side))} />
        </View> : null}
        {status === 'loaded' && hint ? <View style={styles.center} pointerEvents="none"><Text style={styles.hint}>Drag to look around</Text></View> : null}
      </View> : null}
    </View>
    <View style={styles.footer}>
      {status === 'loaded' && max > 0 ? <PositionBar progress={progress} strip={strip} viewportWidth={size.width} /> : null}
      {showSideSwitch(view)
        ? <View style={styles.switchTrack}>{view.sides.map(side => <SideButton key={side} side={side} selected={view.selected === side} disabled={!switchEnabled(view)} onPress={() => setView(v => v && selectSide(v, side))} />)}</View>
        : <Text style={styles.singleLabel}>{name}</Text>}
    </View>
  </View>;
}

// Horizontal pan only, clamped to [0, max]. The offset lives in a ref and Animated values (set on the JS thread, like FullscreenDocumentImage): no re-render per frame.
function Strip({ panorama, width, height, viewportWidth, max, status, progress, onLoaded, onFailed, onTouch }: { panorama: PublicPropertyPanorama; width: number; height: number; viewportWidth: number; max: number; status: string; progress: Animated.Value; onLoaded: () => void; onFailed: () => void; onTouch: () => void }) {
  const offset = useRef(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => { progress.setValue(0); }, [progress]);   // a newly mounted strip starts at the left edge
  const move = useCallback((next: number) => { offset.current = clampPanOffset(next, max); x.setValue(-offset.current); progress.setValue(panProgress(offset.current, max)); }, [max, x, progress]);
  const pan = useMemo(() => {
    let start = 0;
    return Gesture.Pan().maxPointers(1).activeOffsetX([-8, 8]).runOnJS(true)
      .onStart(() => { start = offset.current; onTouch(); })
      .onUpdate(event => move(start - event.translationX));
  }, [move, onTouch]);
  const step = useCallback((direction: 1 | -1) => move(offset.current + direction * viewportWidth * 0.6), [move, viewportWidth]);
  return <GestureDetector gesture={pan}>
    <View collapsable={false} accessible accessibilityLabel={`${panoramaSideLabel[panorama.side]} panorama. Swipe or use the scroll actions to look around.`} accessibilityActions={[{ name: 'increment', label: 'Look right' }, { name: 'decrement', label: 'Look left' }]}
      onAccessibilityAction={event => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)} style={styles.window}>
      <Animated.View style={{ width, height, transform: [{ translateX: x }] }}>
        <Image source={{ uri: panorama.url }} resizeMode="cover" resizeMethod="resize" onLoad={onLoaded} onError={onFailed} style={{ width, height, opacity: status === 'loaded' ? 1 : 0 }} />
      </Animated.View>
    </View>
  </GestureDetector>;
}

function PositionBar({ progress, strip, viewportWidth }: { progress: Animated.Value; strip: number; viewportWidth: number }) {
  const thumb = Math.max(MIN_THUMB, BAR_WIDTH * visibleFraction(strip, viewportWidth));
  const left = progress.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_WIDTH - thumb] });
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.barTrack}><Animated.View style={[styles.barThumb, { width: thumb, left }]} /></View>;
}

function SideButton({ side, selected, disabled, onPress }: { side: PanoramaSide; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled || selected} onPress={onPress} style={[styles.sideButton, selected && styles.sideSelected, disabled && !selected && styles.sideDisabled]}>
    <Text style={[styles.sideText, selected && styles.sideTextSelected]}>{panoramaSideLabel[side]}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.lg },
  closeTarget: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.textSecondary, alignItems: 'center', justifyContent: 'center' },
  closeMark: { ...ui.pageTitle, color: colors.white, lineHeight: 26 },
  title: { ...ui.sectionTitle, color: colors.white },
  middle: { flex: 1, justifyContent: 'center' },
  window: { flex: 1, overflow: 'hidden', backgroundColor: colors.ink },
  center: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
  failed: { backgroundColor: colors.ink },
  failTitle: { ...ui.sectionTitle, color: colors.white, textAlign: 'center' },
  onDark: { ...ui.body, color: colors.white, textAlign: 'center' },
  hint: { ...ui.body, color: colors.white, fontWeight: '700', backgroundColor: colors.textSecondary, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, overflow: 'hidden' },
  footer: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  barTrack: { width: BAR_WIDTH, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.textSecondary },
  barThumb: { position: 'absolute', top: 0, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.white },
  switchTrack: { alignSelf: 'stretch', flexDirection: 'row', backgroundColor: colors.textSecondary, borderRadius: radius.pill, padding: spacing.xxs },
  sideButton: { flex: 1, minHeight: TARGET, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sideSelected: { backgroundColor: colors.white },
  sideDisabled: { opacity: 0.5 },
  sideText: { ...ui.body, fontWeight: '700', color: colors.white },
  sideTextSelected: { color: colors.ink },
  singleLabel: { ...ui.body, color: colors.white, fontWeight: '700' },
});
