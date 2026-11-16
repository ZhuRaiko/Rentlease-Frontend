import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import type { LandlordPortfolioItem } from '../models/LandlordPortfolio';
import { portfolioLocation, portfolioType } from '../models/LandlordPortfolio';
import { portfolioArchivedNote, portfolioAvailability, portfolioCardLayout, type PortfolioActionKey, type PortfolioRequestActivity } from '../models/PortfolioCardPresentation';
import { cardChips, cardLine, draftLine, emptyFacts, isDraftCard, managementPill, needsYou, type ManagedFacts, type PillTone } from '../models/PropertyManagement';
import { deleteCardMenuLabel } from '../models/UnfinishedPostMenu';
import { ListingButton } from './ListingButton';

const pillColors: Record<PillTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.surface, color: colors.textSecondary },
  positive: { backgroundColor: colors.primaryAction, color: colors.white },
  attention: { backgroundColor: colors.warningSurface, color: colors.warning },
  info: { backgroundColor: colors.identitySurface, color: colors.identityInk },
  danger: { backgroundColor: colors.restrictedSurface, color: colors.restricted },
};
const chipColors = { attention: pillColors.attention, info: pillColors.info, neutral: pillColors.neutral } as const;

/** Unfinished-post deletion entry; passed only for a post that can be offered deletion. `reason` is the existing server reason after a check. */
export interface PortfolioDeleteEntry { onDelete: () => void; reason: string | null }
export interface PortfolioCleanupBanner { busy: boolean; onRetry: () => void }

/**
 * One My properties card: cover with one status chip, title with a badge for what waits on the landlord, place and price, the one line that
 * matters for the state, chips for what is open, one filled "Manage" button and a 48dp "..." menu holding every other action. A draft shows
 * as a compact card with a single outlined "Continue posting". Handlers come from the ViewModel; facts come from the root's existing reads.
 */
export function PortfolioRentalCard({ item, disabled, onAction, request, verificationError, deletion, cleanup, facts = emptyFacts() }: { item: LandlordPortfolioItem; disabled: boolean; onAction: (key: PortfolioActionKey) => void; request?: PortfolioRequestActivity | null | undefined; verificationError?: string | null | undefined; deletion?: PortfolioDeleteEntry | null | undefined; cleanup?: PortfolioCleanupBanner | null | undefined; facts?: ManagedFacts }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const listing = item.currentListing, actions = portfolioCardLayout(item);
  const title = listing?.title || `${portfolioType(item.property)} in ${portfolioLocation(item.property).split(', ').at(-1)}`;
  const pill = managementPill(item), draft = isDraftCard(item), line = cardLine(item, facts), badge = needsYou(facts).length;
  const chips = cardChips(item, facts), requestText = request ? (request.error ?? request.text) : null, archivedNote = portfolioArchivedNote(item), availability = portfolioAvailability(item);
  const run = (action: () => void) => () => { setMenuOpen(false); action(); };
  const menuEntries = [...actions.menu.map(action => ({ key: action.key, label: action.label, press: run(() => onAction(action.key)) })), ...(request ? [{ key: 'requests', label: 'Manage Requests', press: run(request.onManage) }] : [])];
  const showMenu = menuEntries.length > 0 || !!deletion;
  const more = showMenu ? <Pressable accessibilityRole="button" accessibilityLabel={`More actions for ${title}`} accessibilityState={{ expanded: menuOpen, disabled }} disabled={disabled} onPress={() => setMenuOpen(open => !open)} style={styles.more}><Text style={styles.moreGlyph}>{'⋯'}</Text></Pressable> : null;
  const menu = menuOpen ? <View style={styles.menu}>
    {menuEntries.map(entry => <Pressable key={entry.key} accessibilityRole="button" disabled={disabled} onPress={entry.press} style={styles.menuItem}><Text style={ui.body}>{entry.label}</Text></Pressable>)}
    {deletion ? <>
      {menuEntries.length ? <View style={styles.divider} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={deleteCardMenuLabel} disabled={disabled} onPress={run(deletion.onDelete)} style={styles.menuItem}><Text style={[ui.body, styles.danger]}>{deleteCardMenuLabel}</Text></Pressable>
    </> : null}
  </View> : null;
  const notes = <>
    {deletion?.reason ? <Text style={[ui.supporting, styles.reason]}>{deletion.reason}</Text> : null}
    {cleanup ? <View style={styles.banner}>
      <Text style={[ui.supporting, styles.bannerText]}>Some photos could not be removed.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Retry photo cleanup for ${title}`} accessibilityState={{ disabled: disabled || cleanup.busy, busy: cleanup.busy }} disabled={disabled || cleanup.busy} onPress={cleanup.onRetry} style={styles.link}><Text style={styles.linkText}>{cleanup.busy ? 'Retrying...' : 'Retry'}</Text></Pressable>
    </View> : null}
    <FeedbackNotice tone="error" message={verificationError ?? null} />
  </>;
  if (draft) return <View style={styles.draftCard}>
    <View style={styles.draftHead}>
      {item.coverPhoto ? <Image accessibilityLabel={`Cover of ${title}`} source={{ uri: item.coverPhoto.publicUrl }} style={styles.draftThumb} /> : <View accessible={false} style={[styles.draftThumb, styles.placeholder]} />}
      <View style={styles.info}><Text style={ui.body}>{title}</Text><Text style={ui.supporting}>{draftLine(item)}</Text></View>
      <View accessible accessibilityLabel="Status: Draft" style={[styles.chip, { backgroundColor: pillColors.neutral.backgroundColor }]}><Text style={[styles.chipText, { color: pillColors.neutral.color }]}>Draft</Text></View>
    </View>
    <View style={styles.row}><View style={styles.primary}><ListingButton label="Continue posting" tone="outline" disabled={disabled} onPress={() => onAction(actions.primary.key)} /></View>{more}</View>
    {menu}{notes}
  </View>;
  return <View style={styles.card}>
    <View style={styles.coverBox}>
      {item.coverPhoto ? <Image accessibilityLabel={`Cover of ${title}`} source={{ uri: item.coverPhoto.publicUrl }} style={styles.cover} /> : <View accessible={false} style={[styles.cover, styles.placeholder]} />}
      <View accessible accessibilityLabel={`Status: ${pill.label}`} style={[styles.pill, { backgroundColor: pillColors[pill.tone].backgroundColor }]}><Text style={[styles.pillText, { color: pillColors[pill.tone].color }]}>{pill.label}</Text></View>
    </View>
    <View style={styles.body}>
      <View style={styles.titleRow}>
        <View style={styles.info}>
          <Text style={styles.title}>{title}</Text>
          <Text style={ui.supporting}>{portfolioLocation(item.property)}{listing && pill.label !== 'Occupied' ? ` · ₱${listing.asking_rent_monthly.toLocaleString('en-PH')} / mo` : ''}</Text>
        </View>
        {badge > 0 ? <View accessible accessibilityLabel={`${badge} waiting for you`} style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
      </View>
      {line ? <Text style={ui.supporting}>{line}</Text> : null}
      {availability ? <Pressable accessibilityRole="button" accessibilityLabel={`${availability}. Change`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onAction('editListing')} style={styles.availability}><Text style={styles.availabilityText}>{availability}</Text><Text style={styles.availabilityText}>Change</Text></Pressable> : null}
      {archivedNote ? <Text style={ui.supporting}>{archivedNote}</Text> : null}
      {!item.property.is_active ? <Text style={ui.supporting}>Property inactive. Listing changes may be unavailable.</Text> : null}
      {chips.length || requestText ? <View style={styles.chips}>
        {chips.map(chip => <View key={chip.label} style={[styles.chip, { backgroundColor: chipColors[chip.tone].backgroundColor }]}><Text style={[styles.chipText, { color: chipColors[chip.tone].color }]}>{chip.label}</Text></View>)}
        {requestText ? <View style={[styles.chip, { backgroundColor: chipColors.attention.backgroundColor }]}><Text style={[styles.chipText, { color: chipColors.attention.color }]}>{requestText}</Text></View> : null}
      </View> : null}
      <View style={styles.row}><View style={styles.primary}><ListingButton label={actions.primary.label} tone="brand" disabled={disabled} onPress={() => onAction(actions.primary.key)} /></View>{more}</View>
      {menu}{notes}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  card: { ...ui.panel, overflow: 'hidden' },
  coverBox: { position: 'relative' },
  cover: { width: '100%', height: 84 },
  placeholder: { backgroundColor: colors.surface },
  pill: { position: 'absolute', top: spacing.sm, left: spacing.sm, paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill },
  pillText: { fontFamily: typography.family, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  more: { width: 48, height: 48, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.controlBorder, backgroundColor: colors.background },
  moreGlyph: { ...ui.sectionTitle, color: colors.ink },
  body: { padding: spacing.sm, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  info: { gap: 2, flex: 1, minWidth: 0 },
  title: { ...ui.sectionTitle },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warning },
  badgeText: { fontFamily: typography.family, fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.white },
  availability: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.control, backgroundColor: colors.identitySurface },
  availabilityText: { fontFamily: typography.family, fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.identityInk },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  chipText: { fontFamily: typography.family, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  draftCard: { ...ui.panel, padding: spacing.sm, gap: spacing.sm, backgroundColor: colors.surface },
  draftHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  draftThumb: { width: 44, height: 44, borderRadius: radius.control },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs, paddingLeft: spacing.sm, borderRadius: radius.control, backgroundColor: colors.warningSurface },
  bannerText: { flex: 1, minWidth: 0, color: colors.warning },
  link: { minHeight: 48, minWidth: 48, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center' },
  linkText: { ...ui.body, color: colors.primaryAction, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primary: { flex: 1, minWidth: 0 },
  menu: { ...ui.panel, overflow: 'hidden' },
  menuItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  divider: { height: 1, backgroundColor: colors.outline },
  danger: { color: colors.restricted, fontWeight: '600' },
  reason: { color: colors.restricted },
});
