import { Camera, Map, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ListingButton } from '../components/ListingButton';
import { toMapLngLat, type ExactPropertyPoint } from '../models/PropertyLocationConfirmation';
interface Props {
  styleUrl: string; point: ExactPropertyPoint; initialPoint: ExactPropertyPoint;
  error: string | null; ready: boolean; onMove: (lngLat: unknown) => void;
  onLoaded: () => void; onFailed: () => void; onCancel: () => void; onConfirm: () => void;
}
export function PropertyLocationMapView({ styleUrl, point, initialPoint, error, ready, onMove, onLoaded, onFailed, onCancel, onConfirm }: Props) {
  return <View style={styles.screen}>
    <ScreenHeader title="Confirm exact location" onBack={onCancel} />
    <Text style={styles.copy}>Adjust the pin to the property's exact location, then confirm. Tap the map or drag the pin to move it.</Text>
    <View style={styles.mapShell}>
      <Map style={styles.map} mapStyle={styleUrl} attribution onPress={event => onMove(event.nativeEvent.lngLat)} onDidFinishLoadingMap={onLoaded} onDidFailLoadingMap={onFailed}>
        <Camera initialViewState={{ center: toMapLngLat(initialPoint), zoom: 16 }} />
        <ViewAnnotation id="exact-property-point" lngLat={toMapLngLat(point)} draggable onDragEnd={event => onMove(event.nativeEvent.lngLat)}>
          <View collapsable={false} accessibilityLabel="Exact property location pin" style={styles.pin}><View style={styles.pinCenter} /></View>
        </ViewAnnotation>
      </Map>
    </View>
    <ScrollView style={styles.footer} contentContainerStyle={styles.footerContent}>
      <Text style={styles.attribution}>MapTiler ? ? OpenStreetMap contributors. Map attribution is available on the map.</Text>
      <FeedbackNotice message={error} tone="error" />
      {!ready && !error ? <Text accessibilityLiveRegion="polite" style={styles.copy}>Loading map...</Text> : null}
      <ListingButton label="Confirm exact location" disabled={!ready || !!error} onPress={onConfirm} />
      <ListingButton label="Cancel" tone="outline" onPress={onCancel} />
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, copy: { fontFamily: typography.family, fontSize: 15, lineHeight: 22, color: colors.trustedText, padding: spacing.sm },
  mapShell: { flex: 1, minHeight: 180 }, map: { flex: 1 }, footer: { flexGrow: 0, maxHeight: '45%' }, footerContent: { padding: spacing.md, gap: spacing.sm },
  attribution: { fontFamily: typography.family, fontSize: 12, color: colors.textSecondary },
  pin: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryAction, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pinCenter: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
});
