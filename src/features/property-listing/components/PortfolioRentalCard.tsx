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
import { portfolioCardActions, portfolioStatusChip, portfolioVerificationChip, type PortfolioActionKey, type PortfolioChip, type PortfolioRequestActivity } from '../models/PortfolioCardPresentation';
import { ListingButton } from './ListingButton';

const chipColors = {
  neutral: { backgroundColor: colors.surface, color: colors.textSecondary },
  positive: { backgroundColor: colors.primaryPale, color: colors.primaryAction },
  attention: { backgroundColor: colors.warningSurface, color: colors.warning },
} as const;

function Chip({ chip, mark }: { chip: PortfolioChip; mark?: boolean }) {
  const tone = chipColors[chip.tone];
  return <View style={[styles.chip, { backgroundColor: tone.backgroundColor }]}><Text style={[styles.chipText, { color: tone.color }]}>{mark ? '✓ ' : ''}{chip.label}</Text></View>;
}

/**
 * One My Rentals card: status and verification chips, a quiet activity line only when something needs attention, one primary
 * action with one secondary beside it, and everything else behind the overflow menu. Handlers are supplied by the ViewModel.
 */
export function PortfolioRentalCard({ item, disabled, onAction, request, verificationError }: { item: LandlordPortfolioItem; disabled: boolean; onAction: (key: PortfolioActionKey) => void; request?: PortfolioRequestActivity | null | undefined; verificationError?: string | null | undefined }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / Math.max(1, fontScale ?? 1) < 280;
  const listing = item.currentListing, actions = portfolioCardActions(item);
  const title = listing?.title || `${portfolioType(item.property)} in ${portfolioLocation(item.property).split(', ').at(-1)}`;
  const verification = portfolioVerificationChip(item);
  const activity = request ? (request.error ?? request.text) : null;
  const run = (action: () => void) => () => { setMenuOpen(false); action(); };
  const menuEntries = [...actions.menu.map(action => ({ key: action.key, label: action.label, press: run(() => onAction(action.key)) })), ...(request ? [{ key: 'requests', label: 'Manage Requests', press: run(request.onManage) }] : [])];
  return <View style={styles.card}>
    <View style={[styles.row, stacked && styles.rowStacked]}>
      {item.coverPhoto ? <Image accessibilityLabel={`Cover of ${title}`} source={{ uri: item.coverPhoto.publicUrl }} style={stacked ? styles.thumbStacked : styles.thumb} />
        : <View style={[stacked ? styles.thumbStacked : styles.thumb, styles.placeholder]}><Text style={styles.placeholderText}>No photo yet</Text></View>}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {menuEntries.length ? <Pressable accessibilityRole="button" accessibilityLabel={`More actions for ${title}`} accessibilityState={{ expanded: menuOpen, disabled }} disabled={disabled} onPress={() => setMenuOpen(open => !open)} style={styles.more}><Text style={styles.moreGlyph}>{'⋯'}</Text></Pressable> : null}
        </View>
        <Text style={ui.supporting}>{portfolioLocation(item.property)}</Text>
        {listing ? <Text style={styles.rent}>{'₱'}{listing.asking_rent_monthly.toLocaleString('en-PH')}<Text style={ui.supporting}> / month</Text></Text> : null}
      </View>
    </View>
    <View style={styles.chips}><Chip chip={portfolioStatusChip(item)} /><Chip chip={verification} mark={verification.tone === 'positive'} /></View>
    {!item.property.is_active ? <Text style={ui.supporting}>Property inactive. Listing changes may be unavailable.</Text> : null}
    {activity ? <View style={styles.note}>
      <View style={styles.noteText}>{request?.pending && !request.error ? <View accessible={false} style={styles.dot} /> : null}<Text style={[ui.supporting, styles.noteLabel, request?.pending && !request.error && styles.noteAttention]}>{activity}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open requests for ${title}`} disabled={disabled} onPress={request!.onManage} style={styles.link}><Text style={styles.linkText}>Requests</Text></Pressable>
    </View> : null}
    <View style={styles.actions}>
      <View style={styles.action}><ListingButton label={actions.primary.label} tone="brand" disabled={disabled} onPress={() => onAction(actions.primary.key)} /></View>
      {actions.secondary ? <View style={styles.action}><ListingButton label={actions.secondary.label} tone="outline" disabled={disabled} onPress={() => onAction(actions.secondary!.key)} /></View> : null}
    </View>
    {menuOpen ? <View style={styles.menu}>{menuEntries.map(entry => <Pressable key={entry.key} accessibilityRole="button" disabled={disabled} onPress={entry.press} style={styles.menuItem}><Text style={ui.body}>{entry.label}</Text></Pressable>)}</View> : null}
    <FeedbackNotice tone="error" message={verificationError ?? null} />
  </View>;
}

const styles = StyleSheet.create({
  card: { ...ui.panel, padding: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowStacked: { flexDirection: 'column' },
  thumb: { width: 92, height: 92, borderRadius: radius.control },
  thumbStacked: { width: '100%', aspectRatio: 1.9, borderRadius: radius.control },
  placeholder: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.xs },
  placeholderText: { ...ui.supporting, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  info: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  title: { ...ui.sectionTitle, flex: 1, minWidth: 0 },
  more: { width: 48, height: 48, marginTop: -spacing.xs, marginRight: -spacing.xs, alignItems: 'center', justifyContent: 'center' },
  moreGlyph: { ...ui.sectionTitle, color: colors.textSecondary },
  rent: { ...ui.sectionTitle, fontWeight: '700', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 12, flexShrink: 1 },
  chipText: { fontFamily: typography.family, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs, borderTopColor: colors.outline, borderTopWidth: 1, paddingTop: spacing.xs },
  noteText: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  noteLabel: { flexShrink: 1 },
  noteAttention: { color: colors.ink, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  link: { minHeight: 48, minWidth: 48, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...ui.body, color: colors.primaryAction, fontWeight: '700', fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  action: { flexGrow: 1, flexBasis: 132, minWidth: 0 },
  menu: { ...ui.panel, overflow: 'hidden' },
  menuItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
});
