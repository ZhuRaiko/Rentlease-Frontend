import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppButton } from './AppButton';
import { ScreenContainer } from './ScreenContainer';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { fitImage, initialImageTransform, panImage, zoomAt, imageGallerySwipe, type ImageSize, type ImageTransform } from '../models/documentImagePreview';

interface Props {
  visible: boolean;
  uri: string | null;
  title: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onImageError?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

// Pure presentation: never fetches/signs URLs, reads files, uploads or changes form state.
export function FullscreenDocumentImage({ visible, ...props }: Props) {
  return (
    <Modal visible={visible} onRequestClose={props.onClose} animationType="fade" presentationStyle="fullScreen">
      <GestureHandlerRootView style={styles.root}>
        {visible ? <ImageSession {...props} /> : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function ImageSession({ uri, title, description, loading = false, error, onClose, onImageError, onNext, onPrevious }: Omit<Props, 'visible'>) {
  const [source, setSource] = useState({ uri, version: 0 });
  // Numeric React keys reset gesture state without putting sensitive URLs into debug keys.
  if (source.uri !== uri) setSource({ uri, version: source.version + 1 });
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {description ? <Text numberOfLines={3} style={styles.copy}>{description}</Text> : null}
        <AppButton label="Close" onPress={onClose} variant="secondary" />
        {onNext || onPrevious ? <View style={styles.galleryActions}>
          <View style={styles.galleryAction}><AppButton label="Previous photo" disabled={!onPrevious} onPress={() => onPrevious?.()} variant="secondary" /></View>
          <View style={styles.galleryAction}><AppButton label="Next photo" disabled={!onNext} onPress={() => onNext?.()} variant="secondary" /></View>
        </View> : null}
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Opening document image" color={colors.primary} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.copy}>{error}</Text> : null}
      {uri && !error ? <ZoomImage key={source.version} uri={uri} {...(onImageError ? { onImageError } : {})} {...(onNext || onPrevious ? { onSwipe: (direction: -1 | 1) => direction === 1 ? onNext?.() : onPrevious?.() } : {})} /> : <View style={styles.root} />}
    </ScreenContainer>
  );
}

function ZoomImage({ uri, onImageError, onSwipe }: { uri: string; onImageError?: () => void; onSwipe?: (direction: -1 | 1) => void }) {
  const [viewport, setViewport] = useState<ImageSize>({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState<ImageSize>({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const transform = useRef<ImageTransform>({ ...initialImageTransform });
  const values = useRef({ scale: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) }).current;
  const fitted = useMemo(() => fitImage(viewport, naturalSize), [viewport, naturalSize]);
  const apply = useCallback((next: ImageTransform) => {
    transform.current = next; values.scale.setValue(next.scale); values.x.setValue(next.x); values.y.setValue(next.y);
  }, [values]);
  const reset = useCallback(() => apply({ ...initialImageTransform }), [apply]);
  const gestures = useMemo(() => {
    let panStart = { ...initialImageTransform }; let pinchStart = { ...initialImageTransform }; let focal = { x: 0, y: 0 }; let pinched = false;
    const pan = Gesture.Pan().maxPointers(1).runOnJS(true)
      .onStart(() => { panStart = { ...transform.current }; pinched = false; })
      .onUpdate(event => { apply(panImage(panStart, event.translationX, event.translationY, viewport, fitted)); })
      .onEnd(event => { const direction = imageGallerySwipe(panStart.scale, transform.current.scale, event.translationX, event.translationY, pinched); if (direction !== null) onSwipe?.(direction); });
    const pinch = Gesture.Pinch().runOnJS(true)
      .onStart(event => { pinched = true; pinchStart = { ...transform.current }; focal = { x: event.focalX, y: event.focalY }; })
      .onUpdate(event => {
        apply(zoomAt(pinchStart, pinchStart.scale * event.scale, focal, viewport, fitted, { x: event.focalX - focal.x, y: event.focalY - focal.y }));
      });
    const doubleTap = Gesture.Tap().numberOfTaps(2).runOnJS(true).onEnd((event, success) => {
      if (success) apply(zoomAt(transform.current, transform.current.scale > 1 ? 1 : 3, { x: event.x, y: event.y }, viewport, fitted));
    });
    return Gesture.Simultaneous(pan, pinch, doubleTap);
  }, [apply, viewport, fitted, onSwipe]);
  return (
    <>
      <GestureDetector gesture={gestures}>
        <View collapsable={false} style={styles.imageArea} onLayout={event => { const { width, height } = event.nativeEvent.layout; setViewport({ width, height }); reset(); }}>
          {!loaded && !failed ? <ActivityIndicator style={styles.spinner} accessibilityLabel="Loading document image" color={colors.primary} /> : null}
          {failed ? <Text accessibilityRole="alert" style={styles.copy}>The image could not be loaded. Close and reopen to try again.</Text> : (
            <Animated.Image accessible accessibilityLabel="Zoomable document image" source={{ uri }} resizeMode="contain" resizeMethod="scale"
              onLoad={event => { setNaturalSize({ width: event.nativeEvent.source.width, height: event.nativeEvent.source.height }); setLoaded(true); reset(); }}
              onError={() => { setFailed(true); onImageError?.(); }}
              style={[StyleSheet.absoluteFill, { transform: [{ translateX: values.x }, { translateY: values.y }, { scale: values.scale }] }]} />
          )}
        </View>
      </GestureDetector>
      <Text style={styles.copy}>{onSwipe ? 'Swipe between photos when fitted. Pinch to zoom, drag to pan, double-tap to zoom or fit.' : 'Pinch to zoom. Drag to pan. Double-tap to zoom or fit.'}</Text>
      <AppButton label="Reset zoom" disabled={!loaded || failed} onPress={reset} variant="secondary" />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: spacing.xs, paddingBottom: spacing.sm },
  galleryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  galleryAction: { flexGrow: 1, flexBasis: 130 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '800' },
  copy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, paddingVertical: spacing.xs },
  imageArea: { flex: 1, overflow: 'hidden', backgroundColor: colors.surface, justifyContent: 'center' },
  spinner: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center' },
});
