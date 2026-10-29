import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ListingButton } from './ListingButton';
import { PropertyMediaViewer } from './PropertyMediaViewer';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
export function PropertyMediaSection({ viewModel: vm }: { viewModel: PropertyListingViewModel }) {
  const state = vm.photoState, flow = vm.propertyPhotos, items = vm.mediaItems, active = items[state.activeMediaIndex];
  const blocked = state.busy || !!vm.composerPhase || state.needsReconcile || (!!vm.workspacePropertyId && !state.loaded);
  return <View style={styles.section}>
    <PropertyMediaViewer viewModel={vm} />
    <Text accessibilityRole="header" style={styles.heading}>Photos &amp; 360°</Text>
    {active ? <Pressable accessibilityRole="button" accessibilityLabel={`Open photo ${state.activeMediaIndex + 1} fullscreen, ${active.status}`} onPress={() => flow.openMedia(state.activeMediaIndex)}>
      <Image source={{ uri: active.uri }} accessibilityLabel={active.label} style={styles.large} resizeMode="contain" />
      <View style={styles.badge}><Text style={styles.badgeText}>{active.cover ? 'Cover · ' : ''}{active.status}</Text></View>
    </Pressable> : <View style={[styles.large, styles.empty]}><Text style={styles.body}>Show tenants the rooms and spaces.</Text><Text style={styles.copy}>Add up to 10 clear property photos.</Text></View>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {items.map((item, index) => <View key={item.key} style={styles.thumbShell}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: index === state.activeMediaIndex }} accessibilityLabel={`View photo ${index + 1}, ${item.status}${item.cover ? ', cover' : ''}`} onPress={() => flow.openMedia(index)} style={[styles.thumb, index === state.activeMediaIndex && styles.active]}>
          <Image source={{ uri: item.uri }} accessibilityLabel={item.label} style={styles.thumbImage} resizeMode="cover" />
          <View style={styles.thumbBadge}><Text style={styles.thumbBadgeText}>{item.cover ? 'Cover' : item.status}</Text></View>
        </Pressable>
        {item.status !== 'Needs attention' ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} accessibilityState={{ disabled: blocked || !!item.photoId && !!state.pendingSelections.length }} disabled={blocked || !!item.photoId && !!state.pendingSelections.length} onPress={() => item.photoId ? flow.requestRemove(item.photoId) : flow.removePending(item.pendingIndex!)} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable> : null}
      </View>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Add property photos" disabled={blocked || items.length >= 10} onPress={() => void flow.addPhotos()} style={styles.addThumb}><Text style={styles.addLabel}>+</Text></Pressable>
    </ScrollView>
    <View style={styles.row}><Text style={styles.copy}>{items.length} / 10 photos</Text>
      {active?.photoId && !active.cover ? <Pressable accessibilityRole="button" disabled={blocked || !!state.pendingSelections.length} onPress={() => void flow.setCover(active.photoId!)} style={styles.action}><Text style={styles.link}>Set as cover</Text></Pressable> : null}
    </View>
    <View style={styles.actions}>
      <View style={styles.actionCell}><ListingButton label="Add photos" tone="outline" disabled={blocked || items.length >= 10} onPress={() => void flow.addPhotos()} /></View>
      <View style={styles.actionCell}><ListingButton label="Add 360° interior" tone="outline" disabled onPress={() => {}} /></View>
    </View>
    <Text style={styles.copy}>360° interior is optional. Not available in this build yet.</Text>
    <Text style={styles.copy}>JPEG, PNG or WebP, up to 10 MB each. Photos are public; leave out sensitive information.</Text>
    <FeedbackNotice message={state.error} tone="error" />
    {state.needsReconcile ? <FeedbackNotice message={state.notice} tone="warning" /> : null}
    {state.busy ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{state.batch.status === 'running' ? `${state.batch.completed} of ${state.batch.total} photos confirmed. Uploading...` : 'Opening or loading photos...'}</Text> : null}
    {!!vm.workspacePropertyId && !state.busy && (state.needsReconcile || !state.loaded) ? <ListingButton label="Check photo status" tone="outline" onPress={() => void flow.checkStatus()} /> : null}
    {!!vm.workspacePropertyId && !blocked && state.pendingSelections.length ? <ListingButton label="Continue remaining uploads" tone="outline" onPress={() => void flow.resumeQueue()} /> : null}
    {state.removeId ? <><FeedbackNotice message="Remove this saved photo and its stored image? A replacement cover is not selected automatically." tone="warning" /><ListingButton label="Confirm remove photo" disabled={blocked} tone="danger" onPress={() => void flow.confirmRemove()} /><ListingButton label="Keep photo" tone="outline" onPress={flow.cancelRemove} /></> : null}
    {vm.workspacePropertyId ? <Pressable accessibilityRole="button" disabled={state.busy || !!vm.composerPhase} onPress={() => vm.navigate('photoManager')} style={styles.action}><Text style={styles.link}>Manage order and photo details</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: spacing.sm }, heading: { ...ui.sectionTitle }, body: { ...ui.body }, copy: { ...ui.supporting },
  large: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: colors.surface }, empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.xs },
  badge: { position: 'absolute', left: 8, bottom: 8, backgroundColor: colors.background, borderRadius: 6, padding: spacing.xs }, badgeText: { ...ui.supporting, fontWeight: '600' },
  strip: { gap: spacing.sm }, thumbShell: { width: 102, height: 100 }, thumb: { borderWidth: 2, borderColor: 'transparent', borderRadius: 8, overflow: 'hidden', width: 100, height: 96 }, active: { borderColor: colors.primary }, thumbImage: { width: '100%', height: '100%' },
  thumbBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, paddingHorizontal: 3 }, thumbBadgeText: { ...ui.supporting, fontWeight: '600' },
  remove: { position: 'absolute', right: 0, top: 0, width: 48, height: 48, alignItems: 'flex-end', padding: 3 }, removeText: { ...ui.body, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.background, textAlign: 'center' },
  addThumb: { minWidth: 70, minHeight: 96, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.controlBorder, borderRadius: 8 }, addLabel: { ...ui.pageTitle, color: colors.primary },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.xs }, action: { minHeight: 48, justifyContent: 'center' }, link: { ...ui.supporting, color: colors.primary, fontWeight: '600' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, actionCell: { flexGrow: 1, flexBasis: 135 },
});
