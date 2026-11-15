import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { thumbVeil } from '../models/PropertyMedia';
import { ListingButton } from './ListingButton';
import { PropertyMediaViewer } from './PropertyMediaViewer';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export const PHOTOS_EMPTY_TITLE = 'Add photos';
export const PHOTOS_EMPTY_HINT = 'The first photo is your cover. You can add up to 10.';
const HERO_RADIUS = 24, THUMB_RADIUS = 18, THUMB = 88;

/**
 * The first card on the Listing step (same step for a new, a draft and a published/paused listing): a big cover, a row of thumbnails, and the
 * existing photo workflow underneath (load, queue, resume, reconcile). Only the surface is new; uploads start as soon as photos are picked.
 */
export function ListingPhotosCard({ viewModel: vm }: { viewModel: PropertyListingViewModel }) {
  const state = vm.photoState, flow = vm.propertyPhotos, items = vm.mediaItems;
  const running = state.busy && state.batch.status === 'running';
  const blocked = state.busy || !!vm.composerPhase || state.needsReconcile || (!!vm.workspacePropertyId && !state.loaded);
  const cover = items.find(i => i.cover) ?? items[0];
  const coverIndex = cover ? items.indexOf(cover) : 0;
  const failed = items.some(i => thumbVeil(i, running)?.kind === 'failed');
  const count = items.length;
  return <View style={styles.card}>
    <PropertyMediaViewer viewModel={vm} />
    <View style={styles.head}>
      <Text accessibilityRole="header" style={styles.title}>Photos</Text>
      <Text style={ui.supporting}>{count} of 10</Text>
    </View>
    {!cover
      ? <Pressable accessibilityRole="button" accessibilityLabel={`${PHOTOS_EMPTY_TITLE}. ${PHOTOS_EMPTY_HINT}`} accessibilityState={{ disabled: blocked }} disabled={blocked} onPress={() => void flow.addPhotos()} style={styles.empty}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.emptyTitle}>{PHOTOS_EMPTY_TITLE}</Text>
          <Text style={styles.emptyHint}>{PHOTOS_EMPTY_HINT}</Text>
        </Pressable>
      : <>
          <Pressable accessibilityRole="button" accessibilityLabel={`Cover photo, open fullscreen`} onPress={() => flow.openMedia(coverIndex)} style={styles.hero}>
            <Image source={{ uri: cover.uri }} accessibilityLabel={cover.label} style={styles.heroImage} resizeMode="cover" />
            <Text style={[styles.pill, styles.coverPill]}>Cover</Text>
            <Text style={[styles.pill, styles.countPill]}>{coverIndex + 1} of {count}</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {items.map((item, index) => {
              const veil = thumbVeil(item, running);
              const retry = veil?.kind === 'failed' && veil.retry;
              return <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={`${retry ? 'Retry upload of photo' : 'View photo'} ${index + 1}${veil ? `, ${veil.text}` : ''}${item.cover ? ', cover' : ''}`}
                onPress={() => retry ? void flow.resumeQueue() : flow.openMedia(index)} style={styles.thumb}>
                <Image source={{ uri: item.uri }} accessibilityLabel={item.label} style={styles.thumbImage} resizeMode="cover" />
                {veil ? <View style={[styles.veil, veil.kind === 'failed' && styles.veilFailed]}>
                  <Text style={[styles.veilText, veil.kind === 'failed' && styles.veilFailedText]}>{veil.text}</Text>
                  {retry ? <Text style={[styles.veilText, styles.veilFailedText, styles.veilRetry]}>Retry</Text> : null}
                </View> : null}
              </Pressable>;
            })}
          </ScrollView>
          <View style={styles.pair}>
            <View style={styles.cell}><ListingButton label="Manage photos" tone="outline" disabled={state.busy || !!vm.composerPhase} onPress={() => vm.navigate('photoManager')} /></View>
            <View style={styles.cell}><ListingButton label="Add more" tone="outline" disabled={blocked || count >= 10} onPress={() => void flow.addPhotos()} /></View>
          </View>
        </>}
    <Text style={ui.supporting}>JPEG, PNG or WebP, up to 10 MB each. Photos are public, so leave out private details.</Text>
    {running ? <Text accessibilityLiveRegion="polite" style={styles.status}>{`Uploading ${Math.min(state.batch.completed + 1, state.batch.total)} of ${state.batch.total}…`}</Text> : null}
    {!running && failed && !state.needsReconcile ? <View style={styles.status}><Text style={styles.statusText}>Some photos didn’t upload.</Text>{!blocked && state.pendingSelections.length ? <ListingButton label="Retry failed" tone="outline" onPress={() => void flow.resumeQueue()} /> : null}</View> : null}
    <FeedbackNotice message={state.error} tone="error" />
    <FeedbackNotice message={state.notice} tone={state.needsReconcile ? 'warning' : 'info'} />
    {!!vm.workspacePropertyId && !state.busy && (state.needsReconcile || !state.loaded) ? <ListingButton label={state.needsReconcile ? 'Check saved photos' : 'Retry loading photos'} tone="outline" onPress={() => void flow.checkStatus()} /> : null}
    {state.removeId ? <><FeedbackNotice message="Remove this saved photo and its stored image? A replacement cover is not selected automatically." tone="warning" /><ListingButton label="Confirm remove photo" disabled={blocked} tone="danger" onPress={() => void flow.confirmRemove()} /><ListingButton label="Keep photo" tone="outline" onPress={flow.cancelRemove} /></> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { gap: spacing.sm, borderWidth: 1.5, borderColor: colors.outline, borderRadius: radius.panel, padding: spacing.md, backgroundColor: colors.background },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs },
  title: { ...ui.sectionTitle },
  empty: { minHeight: 180, borderRadius: HERO_RADIUS, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primaryAction, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.md },
  plus: { ...ui.pageTitle, color: colors.primaryAction }, emptyTitle: { ...ui.body, fontWeight: '700', color: colors.primaryAction }, emptyHint: { ...ui.supporting, textAlign: 'center' },
  hero: { borderRadius: HERO_RADIUS, overflow: 'hidden', backgroundColor: colors.surface },
  heroImage: { width: '100%', aspectRatio: 3 / 2 },
  pill: { ...ui.supporting, position: 'absolute', fontWeight: '700', borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: spacing.sm, overflow: 'hidden' },
  coverPill: { left: spacing.sm, top: spacing.sm, backgroundColor: colors.background, color: colors.primaryAction },
  countPill: { right: spacing.sm, bottom: spacing.sm, backgroundColor: colors.text, color: colors.background },
  strip: { gap: spacing.sm },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB_RADIUS, overflow: 'hidden', backgroundColor: colors.surface },
  thumbImage: { width: '100%', height: '100%' },
  veil: { ...StyleSheet.absoluteFill as object, alignItems: 'center', justifyContent: 'center', padding: spacing.xs, backgroundColor: 'rgba(255,255,255,0.72)' },
  veilFailed: { backgroundColor: 'rgba(255,247,232,0.94)' },
  veilText: { ...ui.supporting, fontWeight: '600', textAlign: 'center', color: colors.text }, veilFailedText: { color: colors.warning }, veilRetry: { textDecorationLine: 'underline' },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, cell: { flexGrow: 1, flexBasis: 135 },
  status: { gap: spacing.xs, borderRadius: radius.panel, backgroundColor: colors.surface, padding: spacing.sm }, statusText: { ...ui.supporting, color: colors.warning },
});
