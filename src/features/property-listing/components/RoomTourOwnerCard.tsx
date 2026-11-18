import { StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { PANORAMA_SIDES } from '../../../shared/models/PropertyPanorama';
import { roomTourBusy } from '../viewModels/propertyPanoramaWorkflow';
import type { RoomTourViewModel } from '../viewModels/useRoomTourWorkflow';
import { ListingButton } from './ListingButton';
import { RoomTourSideTile } from './RoomTourSideTile';
import { RoomTourMenuSheet, RoomTourRemoveSheet } from './RoomTourSheets';

export const ROOM_TOUR_TITLE = '360° room tour';
export const ROOM_TOUR_TIP = 'Let renters look around. Take each side with your camera’s Panorama mode.';

/**
 * Owner's "360° room tour": one tile per side, saved as soon as an upload finishes (not tied to "Save listing details"). These are not property photos:
 * they never change the photo count or the cover. Shown only for a saved property. Pure presentation over the workflow state.
 */
export function RoomTourOwnerCard({ roomTour }: { roomTour: RoomTourViewModel }) {
  const { state } = roomTour, busy = roomTourBusy(state);
  const menu = state.menuSide ? state.sides[state.menuSide] : null;
  return <View style={styles.card}>
    <View style={styles.head}>
      <Text accessibilityRole="header" style={styles.title}>{ROOM_TOUR_TITLE}</Text>
      <Text style={styles.badge}>Optional</Text>
    </View>
    <Text style={ui.supporting}>{ROOM_TOUR_TIP}</Text>
    {PANORAMA_SIDES.map(side => {
      const sideState = state.sides[side], working = sideState.status === 'picking' || sideState.status === 'uploading';
      return <RoomTourSideTile key={side} side={side} state={sideState} disabled={!state.loaded || (busy && !working)} onAdd={() => void roomTour.pick(side)} onMenu={() => roomTour.openMenu(side)} />;
    })}
    {state.loading && !state.loaded ? <Text accessibilityLiveRegion="polite" style={ui.supporting}>Loading your room tour{'…'}</Text> : null}
    <FeedbackNotice message={state.notice} tone="error" />
    {state.notice && !state.loaded && !state.loading ? <ListingButton label="Try again" tone="outline" onPress={() => void roomTour.load()} /> : null}
    {state.menuSide ? <RoomTourMenuSheet side={state.menuSide} panorama={menu?.panorama ?? null} onClose={roomTour.closeMenu} onReplace={() => void roomTour.replace(state.menuSide!)} onRemove={() => roomTour.requestRemove(state.menuSide!)} /> : null}
    {state.removeSide ? <RoomTourRemoveSheet side={state.removeSide} busy={state.removing} onKeep={roomTour.cancelRemove} onRemove={() => void roomTour.confirmRemove()} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { gap: spacing.sm, borderWidth: 1.5, borderColor: colors.outline, borderRadius: radius.panel, padding: spacing.md, backgroundColor: colors.background },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  title: { ...ui.sectionTitle },
  badge: { ...ui.supporting, fontWeight: '700', backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.sm, overflow: 'hidden' },
});
