import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import type { LandlordPortfolioItem } from '../models/LandlordPortfolio';
import { portfolioLocation, portfolioType } from '../models/LandlordPortfolio';
import { portfolioArchivedNote, portfolioAvailability, portfolioCardLayout, portfolioStatusPill, portfolioVerificationRow, type PortfolioActionKey, type PortfolioPillTone, type PortfolioRequestActivity } from '../models/PortfolioCardPresentation';
import { deleteCardMenuLabel } from '../models/UnfinishedPostMenu';
import { ListingButton } from './ListingButton';

const pillColors: Record<PortfolioPillTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.surface, color: colors.textSecondary },
  positive: { backgroundColor: colors.primaryPale, color: colors.primaryAction },
  attention: { backgroundColor: colors.warningSurface, color: colors.warning },
  info: { backgroundColor: colors.identitySurface, color: colors.identityInk },
  danger: { backgroundColor: colors.restrictedSurface, color: colors.restricted },
};
const rowColors = { neutral: pillColors.neutral, positive: pillColors.positive, attention: pillColors.attention } as const;

/** Unfinished-post deletion entry; passed only for a post that can be offered deletion. `reason` is the existing server reason after a check. */
export interface PortfolioDeleteEntry { onDelete: () => void; reason: string | null }
export interface PortfolioCleanupBanner { busy: boolean; onRetry: () => void }

/**
 * One My Rentals card: cover photo with status pill and overflow button, title, location, price, one verification status row,
 * one primary button (plus one short secondary), and everything else behind the overflow menu. Handlers come from the ViewModel.
 */
export function PortfolioRentalCard({ item, disabled, onAction, request, verificationError, deletion, cleanup }: { item: LandlordPortfolioItem; disabled: boolean; onAction: (key: PortfolioActionKey) => void; request?: PortfolioRequestActivity | null | undefined; verificationError?: string | null | undefined; deletion?: PortfolioDeleteEntry | null | undefined; cleanup?: PortfolioCleanupBanner | null | undefined }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / Math.max(1, fontScale ?? 1) < 280;
  const listing = item.currentListing, actions = portfolioCardLayout(item);
  const title = listing?.title || `${portfolioType(item.property)} in ${portfolioLocation(item.property).split(', ').at(-1)}`;
  const pill = portfolioStatusPill(item), verification = portfolioVerificationRow(item), tone = rowColors[verification.tone];
  const availability = portfolioAvailability(item), archivedNote = portfolioArchivedNote(item), activity = request ? (request.error ?? request.text) : null;
  const run = (action: () => void) => () => { setMenuOpen(false); action(); };
  const menuEntries = [...actions.menu.map(action => ({ key: action.key, label: action.label, press: run(() => onAction(action.key)) })), ...(request ? [{ key: 'requests', label: 'Manage Requests', press: run(request.onManage) }] : [])];
  const showMenu = menuEntries.length > 0 || !!deletion;
  const status = <Text style={[styles.statusText, { color: tone.color }]}>{verification.tone === 'positive' ? '✓ ' : ''}{verification.label}</Text>;
  return <View style={styles.card}>
    <View style={styles.coverBox}>
      {item.coverPhoto ? <Image accessibilityLabel={`Cover of ${title}`} source={{ uri: item.coverPhoto.publicUrl }} style={styles.cover} />
        : <View style={[styles.cover, styles.placeholder]}><Pressable accessibilityRole="button" accessibilityLabel={`Add photos to ${title}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onAction('open')} style={styles.addPhotos}><Text style={styles.addPhotosText}>Add photos</Text></Pressable></View>}
      <View style={[styles.pill, { backgroundColor: pillColors[pill.tone].backgroundColor }]}><Text style={[styles.pillText, { color: pillColors[pill.tone].color }]}>{pill.label}</Text></View>
      {showMenu ? <Pressable accessibilityRole="button" accessibilityLabel={`More actions for ${title}`} accessibilityState={{ expanded: menuOpen, disabled }} disabled={disabled} onPress={() => setMenuOpen(open => !open)} style={styles.more}><Text style={styles.moreGlyph}>{'⋯'}</Text></Pressable> : null}
    </View>
    <View style={styles.body}>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <Text style={ui.supporting}>{portfolioLocation(item.property)}</Text>
        {listing ? <Text style={styles.rent}>{'₱'}{listing.asking_rent_monthly.toLocaleString('en-PH')}<Text style={ui.supporting}> / month</Text></Text> : null}
      </View>
      {verification.actionLabel
        ? <Pressable accessibilityRole="button" accessibilityLabel={`${verification.label}. ${verification.actionLabel}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onAction('verification')} style={[styles.statusRow, { backgroundColor: tone.backgroundColor }]}>
          {status}<View style={styles.statusAction}><Text style={[styles.statusActionText, { color: tone.color }]}>{verification.actionLabel}</Text><Text style={[styles.statusActionText, { color: tone.color }]}>{' ›'}</Text></View>
        </Pressable>
        : <View style={[styles.statusRow, { backgroundColor: tone.backgroundColor }]}>{status}</View>}
      {availability ? <Pressable accessibilityRole="button" accessibilityLabel={`${availability}. Change`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onAction('editRental')} style={[styles.statusRow, styles.availability]}><Text style={styles.availabilityText}>{availability}</Text><Text style={styles.availabilityText}>Change</Text></Pressable> : null}
      {archivedNote ? <Text style={ui.supporting}>{archivedNote}</Text> : null}
      {!item.property.is_active ? <Text style={ui.supporting}>Property inactive. Listing changes may be unavailable.</Text> : null}
      {activity ? <View style={styles.note}>
        <View style={styles.noteText}>{request?.pending && !request.error ? <View accessible={false} style={styles.dot} /> : null}<Text style={[ui.supporting, styles.noteLabel, request?.pending && !request.error && styles.noteAttention]}>{activity}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open requests for ${title}`} disabled={disabled} onPress={request!.onManage} style={styles.link}><Text style={styles.linkText}>Requests</Text></Pressable>
      </View> : null}
      {cleanup ? <View style={styles.banner}>
        <Text style={[ui.supporting, styles.bannerText]}>Some photos could not be removed.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Retry photo cleanup for ${title}`} accessibilityState={{ disabled: disabled || cleanup.busy, busy: cleanup.busy }} disabled={disabled || cleanup.busy} onPress={cleanup.onRetry} style={styles.link}><Text style={styles.linkText}>{cleanup.busy ? 'Retrying...' : 'Retry'}</Text></Pressable>
      </View> : null}
      <View style={[styles.row, stacked && styles.rowStacked]}>
        <View style={styles.primary}><ListingButton label={actions.primary.label} tone="brand" disabled={disabled} onPress={() => onAction(actions.primary.key)} /></View>
        {actions.secondary ? <View style={stacked ? styles.primary : styles.secondary}><ListingButton label={actions.secondary.label} tone="outline" disabled={disabled} onPress={() => onAction(actions.secondary!.key)} /></View> : null}
      </View>
      {menuOpen ? <View style={styles.menu}>
        {menuEntries.map(entry => <Pressable key={entry.key} accessibilityRole="button" disabled={disabled} onPress={entry.press} style={styles.menuItem}><Text style={ui.body}>{entry.label}</Text></Pressable>)}
        {deletion ? <>
          {menuEntries.length ? <View style={styles.divider} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={deleteCardMenuLabel} disabled={disabled} onPress={run(deletion.onDelete)} style={styles.menuItem}><Text style={[ui.body, styles.danger]}>{deleteCardMenuLabel}</Text></Pressable>
        </> : null}
      </View> : null}
      {deletion?.reason ? <Text style={[ui.supporting, styles.reason]}>{deletion.reason}</Text> : null}
      <FeedbackNotice tone="error" message={verificationError ?? null} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { ...ui.panel, overflow: 'hidden' },
  coverBox: { position: 'relative' },
  cover: { width: '100%', height: 150 },
  placeholder: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  addPhotos: { minHeight: 48, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, borderWidth: 1, borderColor: colors.controlBorder, backgroundColor: colors.background },
  addPhotosText: { ...ui.body, fontWeight: '600' },
  pill: { position: 'absolute', top: spacing.sm, left: spacing.sm, paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill },
  pillText: { fontFamily: typography.family, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  more: { position: 'absolute', top: 4, right: 4, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  moreGlyph: { ...ui.sectionTitle, color: colors.ink },
  body: { padding: spacing.sm, gap: spacing.sm },
  info: { gap: 2 },
  title: { ...ui.sectionTitle },
  rent: { ...ui.sectionTitle, color: colors.primaryAction, fontWeight: '700', marginTop: 2 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.control },
  statusText: { fontFamily: typography.family, fontSize: 13, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  statusAction: { flexDirection: 'row', alignItems: 'center' },
  statusActionText: { fontFamily: typography.family, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  availability: { backgroundColor: colors.identitySurface },
  availabilityText: { fontFamily: typography.family, fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.identityInk },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs, borderTopColor: colors.outline, borderTopWidth: 1, paddingTop: spacing.xs },
  noteText: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  noteLabel: { flexShrink: 1 },
  noteAttention: { color: colors.ink, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs, paddingLeft: spacing.sm, borderRadius: radius.control, backgroundColor: colors.warningSurface },
  bannerText: { flex: 1, minWidth: 0, color: colors.warning },
  link: { minHeight: 48, minWidth: 48, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...ui.body, color: colors.primaryAction, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowStacked: { flexDirection: 'column' },
  primary: { flex: 1, minWidth: 0 },
  secondary: { flexShrink: 0 },
  menu: { ...ui.panel, overflow: 'hidden' },
  menuItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  divider: { height: 1, backgroundColor: colors.outline },
  danger: { color: colors.restricted, fontWeight: '600' },
  reason: { color: colors.restricted },
});
