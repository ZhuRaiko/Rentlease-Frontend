import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Image, Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { clampPanOffset, maxPanOffset, panProgress, panoramaSideLabel, stripAreaHeight, stripWidth, type PanoramaSide, type PublicPropertyPanorama } from '../../../shared/models/PropertyPanorama';
import { markDragHintSeen, openRoomTour, retrySide, selectSide, shouldShowDragHint, showSideSwitch, sideFailed, sideLoaded, switchEnabled, wrapToSide, type RoomTourViewerState } from '../viewModels/roomTourViewerState';
import { RoomTourBackdrop, RoomTourEdgeFades } from './RoomTourBackdrop';
import { RoomTourGlStrip } from './RoomTourGlStrip';
import { GL_FOV_DEGREES, GL_SPAN_DEGREES, ROOM_TOUR_GL_ENABLED, horizontalFov, panDistanceDp } from '../viewModels/roomTourGlGeometry';
import { DIAL_SIZE, MOMENTUM_DECELERATION, SPRING_BACK_SPEED, WRAP_FADE_IN_MS, WRAP_FADE_OUT_MS, backdropMaxShift, dialArc, dialHalves, dialLabel, dragOffset, edgeOf, entryOffset, overshootOf, releaseVelocity, shouldCoast, shouldRefreshDialLabel, wrapChip, wrapTarget, wrapTriggered, type DialHalfState, type Edge } from '../viewModels/roomTourMotion';

const TARGET = 48, RING = 4;
type Chip = { edge: Edge; text: string };

/**
 * Full-screen room tour: a strip viewer. The image fills the strip area by HEIGHT and keeps its own shape, so most of it is off-screen. A horizontal drag pans it and it
 * keeps gliding after the finger lifts; the ends are soft (rubber band, springing back); with both sides, pulling past an end and releasing wraps to the other side
 * (a fade, not an alignment: the two photos overlap and are not stitched). A small dial shows roughly where you are in the circle. No zoom, no WebView.
 * Close with the X or the Android Back button. All decisions (clamp, rubber band, wrap threshold, dial angle, labels) are in roomTourMotion.ts and roomTourViewerState.ts.
 */
export function RoomTourViewer({ tour, visible, onClose }: { tour: readonly PublicPropertyPanorama[]; visible: boolean; onClose: () => void }) {
  return <Modal visible={visible} onRequestClose={onClose} animationType="fade" presentationStyle="fullScreen" supportedOrientations={['portrait']} statusBarTranslucent>
    <GestureHandlerRootView style={styles.root}>{visible ? <Session tour={tour} onClose={onClose} /> : null}</GestureHandlerRootView>
  </Modal>;
}

/** Reduced motion: no gliding and no fades (hard clamp, instant switch). Follows the system setting while the viewer is open. */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduce(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { live = false; subscription.remove(); };
  }, []);
  return reduce;
}

function Session({ tour, onClose }: { tour: readonly PublicPropertyPanorama[]; onClose: () => void }) {
  const [view, setView] = useState<RoomTourViewerState | null>(() => openRoomTour(tour));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hint, setHint] = useState(shouldShowDragHint);
  const [chip, setChip] = useState<Chip | null>(null);
  const reduceMotion = useReduceMotion();
  // The WebGL strip is used unless it is switched off or unavailable. Once it fails for any reason the flat strip is used for the rest of this session (no flip-flopping).
  const [glFallback, setGlFallback] = useState(false);
  const gl = ROOM_TOUR_GL_ENABLED && !glFallback;
  const toFlat = useCallback((reason: string) => { if (__DEV__) console.info('[ROOM-TOUR-GL] using the flat strip:', reason); setGlFallback(true); }, []);
  const progress = useRef(new Animated.Value(0)).current;   // 0..1 position in the strip: written by the strip, read by the dial
  const fade = useRef(new Animated.Value(1)).current;        // strip opacity during a wrap
  const wrapping = useRef(false);
  const entry = useRef<Edge>('left');                         // which end the next strip starts at (changes only for a wrap)
  const selected: PanoramaSide = view?.selected ?? 'front';
  const [dial, setDial] = useState(() => dialLabel(selected, 0));
  const dialRef = useRef({ label: dial, at: 0 });
  const dismissHint = useCallback(() => { markDragHintSeen(); setHint(false); }, []);
  useEffect(() => () => { if (shouldShowDragHint()) markDragHintSeen(); }, []);   // once per session even if the hint was never touched away
  // The dial's spoken label follows the position, throttled: only a changed label, and not more often than DIAL_LABEL_MIN_INTERVAL_MS. A side change updates it at once.
  useEffect(() => {
    const refresh = (value: number, force: boolean) => {
      const next = dialLabel(selected, value), now = Date.now();
      if (shouldRefreshDialLabel(dialRef.current.label, next, dialRef.current.at, now, force)) { dialRef.current = { label: next, at: now }; setDial(next); }
    };
    refresh(0, true);
    const id = progress.addListener(({ value }) => refresh(value, false));
    return () => progress.removeListener(id);
  }, [progress, selected]);
  useEffect(() => { entry.current = 'left'; }, [view?.selected, view?.reloads.front, view?.reloads.back]);   // after the strip has mounted: later switches start at the left again
  const wrap = useCallback((exit: Edge) => {
    if (wrapping.current || !view) return;
    const target = wrapTarget(view.selected, exit);
    wrapping.current = true; setChip(null);
    const arrive = () => {
      entry.current = target.entry;
      setView(v => v && wrapToSide(v, target.side));
      if (reduceMotion) { fade.setValue(1); wrapping.current = false; }
      else Animated.timing(fade, { toValue: 1, duration: WRAP_FADE_IN_MS, useNativeDriver: true }).start(() => { wrapping.current = false; });
    };
    if (reduceMotion) arrive(); else Animated.timing(fade, { toValue: 0, duration: WRAP_FADE_OUT_MS, useNativeDriver: true }).start(arrive);
  }, [view, reduceMotion, fade]);
  if (!view) return null;
  const current = tour.find(p => p.side === view.selected)!;
  const areaHeight = stripAreaHeight(size.height), strip = stripWidth(areaHeight, current.width, current.height), max = maxPanOffset(strip, size.width);
  const status = view.load[view.selected], name = panoramaSideLabel[view.selected], both = showSideSwitch(view);
  // How far a finger would drag to cross the whole photo: the flat strip's pan distance, or (GL) the span over the field of view. Feeds the backdrop drift and the dial.
  const panMax = gl ? panDistanceDp(GL_SPAN_DEGREES, horizontalFov(GL_FOV_DEGREES, size.width / Math.max(1, size.height)), size.width) : max;
  const onLayout = (event: LayoutChangeEvent) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height });
  return <View style={styles.root} onLayout={onLayout}>
    {/* Decoration only, behind everything: a blurred, darkened copy of this side's image. Still with reduced motion. */}
    {size.width > 0 && size.height > 0 ? <RoomTourBackdrop key={current.url} url={current.url} width={size.width} height={size.height} maxShift={reduceMotion ? 0 : backdropMaxShift(panMax)} progress={progress} fade={fade} /> : null}
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close room tour" onPress={onClose} style={styles.closeTarget}><View accessible={false} style={styles.close}><Text style={styles.closeMark}>{'×'}</Text></View></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Room tour</Text>
    </View>
    <View style={styles.middle}>
      {gl ? <Animated.View style={[styles.glLayer, { opacity: fade }]}>
        <RoomTourGlStrip panorama={current} entry={entry.current} reduceMotion={reduceMotion} onReady={side => setView(v => v && sideLoaded(v, side))} onPosition={t => progress.setValue(t)} onUnavailable={toFlat} />
      </Animated.View> : null}
      {areaHeight > 0 ? <View pointerEvents="box-none" style={{ height: areaHeight }}>
        {gl ? null : <><Animated.View style={[styles.fill, { opacity: fade }]}>
          <Strip key={`${view.selected}:${view.reloads[view.selected]}`} panorama={current} width={strip} height={areaHeight} viewportWidth={size.width} max={max} interactive={status === 'loaded'} progress={progress} startAt={entry.current}
            bothSides={both} side={view.selected} reduceMotion={reduceMotion} loaded={status === 'loaded'}
            onLoaded={() => setView(v => v && sideLoaded(v, current.side))} onFailed={() => setView(v => v && sideFailed(v, current.side))} onTouch={dismissHint} onChip={setChip} onWrap={wrap} />
        </Animated.View>
        <RoomTourEdgeFades /></>}
        {status === 'loading' ? <View style={styles.center} pointerEvents="none"><ActivityIndicator accessibilityLabel={`Loading ${name.toLowerCase()}`} color={colors.white} /><Text accessibilityLiveRegion="polite" style={styles.onDark}>{`Loading ${name.toLowerCase()}...`}</Text></View> : null}
        {status === 'failed' ? <View style={[styles.center, styles.failed]}>
          <Text accessibilityRole="alert" style={styles.failTitle}>{`Couldn’t load the ${name.toLowerCase()}`}</Text>
          <Text style={styles.onDark}>Check your connection and try again.</Text>
          <AppButton label="Try again" onPress={() => setView(v => v && retrySide(v, current.side))} />
        </View> : null}
        {status === 'loaded' && hint ? <View style={styles.center} pointerEvents="none"><Text style={styles.hint}>Drag to look around</Text></View> : null}
        {chip ? <View pointerEvents="none" style={[styles.center, { alignItems: chip.edge === 'left' ? 'flex-start' : 'flex-end' }]}><Text style={styles.chip}>{chip.text}</Text></View> : null}
      </View> : null}
    </View>
    <View style={styles.footer}>
      {status === 'loaded' && panMax > 0 ? <PositionDial progress={progress} side={view.selected} halves={dialHalves(view.sides, view.selected)} label={dial} /> : null}
      {both
        ? <View style={styles.switchTrack}>{view.sides.map(side => <SideButton key={side} side={side} selected={view.selected === side} disabled={!switchEnabled(view)} onPress={() => setView(v => v && selectSide(v, side))} />)}</View>
        : <Text style={styles.singleLabel}>{name}</Text>}
    </View>
  </View>;
}

/**
 * The strip and its gestures. The pan offset lives in a ref and Animated values (set on the JS thread, like FullscreenDocumentImage): no re-render per frame.
 * Inside the strip a drag is exact; past an end it is rubber-banded; a release past the wrap threshold hands over to the other side; a release past an end below it springs
 * back; a release inside the strip glides (Animated.decay) and stops at the ends. Touching the strip again stops any glide or spring.
 */
function Strip({ panorama, width, height, viewportWidth, max, interactive, loaded, progress, startAt, bothSides, side, reduceMotion, onLoaded, onFailed, onTouch, onChip, onWrap }: {
  panorama: PublicPropertyPanorama; width: number; height: number; viewportWidth: number; max: number; interactive: boolean; loaded: boolean; progress: Animated.Value; startAt: Edge; bothSides: boolean; side: PanoramaSide; reduceMotion: boolean;
  onLoaded: () => void; onFailed: () => void; onTouch: () => void; onChip: (chip: Chip | null) => void; onWrap: (exit: Edge) => void;
}) {
  const first = useRef(entryOffset(startAt, max)).current;   // read once, at mount
  const offset = useRef(first);
  const x = useRef(new Animated.Value(-first)).current;
  const maxRef = useRef(max), coasting = useRef(false);
  maxRef.current = max;
  useEffect(() => {
    progress.setValue(panProgress(first, maxRef.current));   // a newly mounted strip reports where it starts
    const id = x.addListener(({ value }) => {
      offset.current = -value;
      if (coasting.current && value > 0) { coasting.current = false; x.stopAnimation(); x.setValue(0); }   // a glide stops at the left end ...
      else if (coasting.current && value < -maxRef.current) { coasting.current = false; x.stopAnimation(); x.setValue(-maxRef.current); }   // ... and at the right end
      progress.setValue(panProgress(offset.current, maxRef.current));
    });
    return () => x.removeListener(id);
  }, [x, progress, first]);
  const settle = useCallback((target: number) => {
    if (reduceMotion) x.setValue(-target);
    else Animated.spring(x, { toValue: -target, speed: SPRING_BACK_SPEED, bounciness: 0, useNativeDriver: false }).start();
  }, [x, reduceMotion]);
  const stop = useCallback(() => { coasting.current = false; x.stopAnimation(); }, [x]);
  const pan = useMemo(() => {
    let start = 0, chipEdge: Edge | null = null;
    const showChip = (next: Chip | null) => { if ((next?.edge ?? null) !== chipEdge) { chipEdge = next?.edge ?? null; onChip(next); } };
    return Gesture.Pan().maxPointers(1).activeOffsetX([-8, 8]).runOnJS(true)
      .onBegin(stop)   // touching the strip again stops a glide or a spring at once
      .onStart(() => { stop(); start = clampPanOffset(offset.current, maxRef.current); onTouch(); })
      .onUpdate(event => {
        if (!interactive) return;
        const raw = start - event.translationX;
        x.setValue(-dragOffset(raw, maxRef.current));
        showChip(wrapChip(side, overshootOf(raw, maxRef.current), bothSides));
      })
      .onEnd(event => {
        if (!interactive) return;
        const over = overshootOf(start - event.translationX, maxRef.current), exit = edgeOf(over);
        showChip(null);
        if (exit && wrapTriggered(over, bothSides)) { onWrap(exit); return; }
        if (exit) { settle(exit === 'left' ? 0 : maxRef.current); return; }   // below the threshold, or only one side: spring back
        const velocity = releaseVelocity(event.velocityX);
        if (reduceMotion || !shouldCoast(velocity)) return;
        coasting.current = true;
        Animated.decay(x, { velocity, deceleration: MOMENTUM_DECELERATION, useNativeDriver: false }).start(() => { coasting.current = false; });
      })
      .onFinalize(() => showChip(null));
  }, [x, stop, settle, interactive, bothSides, side, reduceMotion, onTouch, onChip, onWrap]);
  const step = useCallback((direction: 1 | -1) => { stop(); x.setValue(-clampPanOffset(offset.current + direction * viewportWidth * 0.6, maxRef.current)); }, [x, stop, viewportWidth]);
  return <GestureDetector gesture={pan}>
    <View collapsable={false} accessible accessibilityLabel={`${panoramaSideLabel[panorama.side]} panorama. Swipe or use the scroll actions to look around.`} accessibilityActions={[{ name: 'increment', label: 'Look right' }, { name: 'decrement', label: 'Look left' }]}
      onAccessibilityAction={event => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)} style={styles.window}>
      <Animated.View style={{ width, height, transform: [{ translateX: x }] }}>
        <Image source={{ uri: panorama.url }} resizeMode="cover" resizeMethod="resize" onLoad={onLoaded} onError={onFailed} style={{ width, height, opacity: loaded ? 1 : 0 }} />
      </Animated.View>
    </View>
  </GestureDetector>;
}

/**
 * A small round dial: a ring split into a Front half (right, starting at the top and going clockwise) and a Back half (left), and a pointer that sweeps across the current
 * side's half as you pan. Core Views and an Animated rotation only. It is a picture of "where in the circle", not a measurement: no degrees are shown or claimed.
 */
function PositionDial({ progress, side, halves, label }: { progress: Animated.Value; side: PanoramaSide; halves: Record<PanoramaSide, DialHalfState>; label: string }) {
  const arc = dialArc(side);
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: [`${arc.from}deg`, `${arc.to}deg`] });
  return <View pointerEvents="none" style={styles.dialRow}>
    <Text style={[styles.dialWord, halves.back !== 'current' && styles.dialWordDim]}>Back</Text>
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={styles.dial}>
      <DialHalf edge="left" state={halves.back} /><DialHalf edge="right" state={halves.front} />
      <Animated.View style={[styles.pointerBox, { transform: [{ rotate }] }]}><View style={styles.pointer} /></Animated.View>
    </View>
    <Text style={[styles.dialWord, halves.front !== 'current' && styles.dialWordDim]}>Front</Text>
  </View>;
}
function DialHalf({ edge, state }: { edge: Edge; state: DialHalfState }) {
  return <View style={[styles.half, edge === 'right' ? { right: 0 } : { left: 0 }]}>
    <View style={[styles.ring, { left: edge === 'right' ? -DIAL_SIZE / 2 : 0, borderColor: state === 'current' ? colors.white : colors.textSecondary, opacity: state === 'missing' ? 0.35 : 1 }]} />
  </View>;
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
  fill: { flex: 1 },
  glLayer: { ...StyleSheet.absoluteFill as object },
  window: { flex: 1, overflow: 'hidden', backgroundColor: colors.ink },
  center: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
  failed: { backgroundColor: colors.ink },
  failTitle: { ...ui.sectionTitle, color: colors.white, textAlign: 'center' },
  onDark: { ...ui.body, color: colors.white, textAlign: 'center' },
  hint: { ...ui.body, color: colors.white, fontWeight: '700', backgroundColor: colors.textSecondary, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, overflow: 'hidden' },
  chip: { ...ui.supporting, color: colors.ink, fontWeight: '700', backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, overflow: 'hidden', maxWidth: '80%' },
  footer: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  dialRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dialWord: { ...ui.supporting, color: colors.white, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  dialWordDim: { opacity: 0.6 },
  dial: { width: DIAL_SIZE, height: DIAL_SIZE },
  half: { position: 'absolute', top: 0, width: DIAL_SIZE / 2, height: DIAL_SIZE, overflow: 'hidden' },
  ring: { position: 'absolute', top: 0, width: DIAL_SIZE, height: DIAL_SIZE, borderRadius: DIAL_SIZE / 2, borderWidth: RING },
  pointerBox: { position: 'absolute', top: 0, left: 0, width: DIAL_SIZE, height: DIAL_SIZE, alignItems: 'center' },
  pointer: { marginTop: RING, width: 3, height: DIAL_SIZE / 2 - RING, borderRadius: 2, backgroundColor: colors.primarySoft },
  switchTrack: { alignSelf: 'stretch', flexDirection: 'row', backgroundColor: colors.textSecondary, borderRadius: radius.pill, padding: spacing.xxs },
  sideButton: { flex: 1, minHeight: TARGET, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sideSelected: { backgroundColor: colors.white },
  sideDisabled: { opacity: 0.5 },
  sideText: { ...ui.body, fontWeight: '700', color: colors.white },
  sideTextSelected: { color: colors.ink },
  singleLabel: { ...ui.body, color: colors.white, fontWeight: '700' },
});
