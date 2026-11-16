import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import { ButtonRow, Cell, CellRow, Slot, TenancyButton, TenancyChip } from '../../tenancy/components/TenancyParts';
import { TenancyDashboardIcon } from '../../tenancy/views/TenancyDashboardIcon';
import { CHIP_COLORS, dueLabel, pesos, shortDate } from '../../tenancy/models/TenancyPresentation';
import { portfolioLocation, portfolioType } from '../models/LandlordPortfolio';
import { editPropertyDetailsPlan } from '../models/PortfolioCardPresentation';
import { emptyFacts, itemFor, lifecycleSegments, managementPill, needsYou, PAUSED_HINT, stayDates, type ManagedReservation, type PropertyManagementPort } from '../models/PropertyManagement';
import { ManagePriceCheck } from '../components/ManagePriceCheck';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

const pillTone = { positive: 'positive', info: 'info', attention: 'warning', neutral: 'neutral', danger: 'restricted' } as const;

function Tile({ label, note, icon, tone = 'positive', onPress }: { label: string; note: string; icon: ReactNode; tone?: 'positive' | 'warning' | 'info'; onPress: () => void }) {
  const c = CHIP_COLORS[tone];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${note}`} onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
    <View accessible={false} style={[styles.well, { backgroundColor: c.backgroundColor }]}>{icon}</View>
    <Text style={styles.tileTitle}>{label}</Text><Text style={ui.supporting}>{note}</Text>
  </Pressable>;
}

/**
 * Manage one property: header, what needs the landlord, then either the current tenant and rent (occupied) or stats, the waiting request,
 * listing status and the price check (vacant). Replaces "Manage Status". Every element comes from a read that exists; if a fact could not
 * be read the element is not drawn rather than guessed.
 */
export function ManagePropertyView({ viewModel: vm, management, accountId }: { viewModel: PropertyListingViewModel; management?: PropertyManagementPort | undefined; accountId?: string | undefined }) {
  const item = itemFor(vm.portfolioState.items, vm.workspacePropertyId), row = vm.realListing, state = vm.lifecycleState, operation = state.confirmation;
  const [declining, setDeclining] = useState<ManagedReservation | null>(null), [declineError, setDeclineError] = useState<string | null>(null), [declineBusy, setDeclineBusy] = useState(false);
  const loadedFor = vm.workspacePropertyId;
  useEffect(() => { if (loadedFor) management?.loadReviews(loadedFor); }, [loadedFor]);
  if (!item || !row) return <View style={styles.screen}><ScreenHeader title="Manage" onBack={vm.goBack} /><Text style={[ui.body, styles.pad]}>Checking listing status...</Text></View>;
  const facts = management?.factsOf(item.propertyId) ?? emptyFacts(), stay = facts.stay, occupied = row.status === 'rented' || !!stay;
  const pill = managementPill(item), needs = needsYou(facts), title = row.title || `${portfolioType(item.property)} in ${portfolioLocation(item.property)}`;
  const segments = lifecycleSegments(row.status, occupied), reviews = management?.reviewsFor(item.propertyId) ?? null;
  const archivedWhileOccupied = row.status === 'archived' && !!stay;
  const detailsPlan = editPropertyDetailsPlan(item), canEditListing = ['active', 'paused'].includes(row.status) && item.property.is_active;
  const go = (target: Parameters<PropertyManagementPort['openTarget']>[1]) => target.kind === 'requests' ? management?.reviewRequests(item) : management?.openTarget(item.propertyId, target);
  const waiting = facts.reservations[0] ?? null;
  const decline = async () => {
    if (!declining || !management) return;
    setDeclineBusy(true); setDeclineError(null);
    const error = await management.decline(item.propertyId, declining.id);
    setDeclineBusy(false);
    if (error) setDeclineError(error); else { setDeclining(null); management.refresh(); }
  };
  return <View style={styles.screen}>
    <ScreenHeader title={title} onBack={vm.goBack} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FeedbackNotice message={vm.notice} />
      <FeedbackNotice message={state.error ?? null} tone="error" />
      <FeedbackNotice message={management?.error ?? null} tone="error" />
      <View style={styles.card}>
        {item.coverPhoto ? <Image accessibilityLabel={`Cover of ${title}`} source={{ uri: item.coverPhoto.publicUrl }} style={styles.cover} /> : <View accessible={false} style={[styles.cover, styles.coverBlank]} />}
        <View style={styles.coverChip}><TenancyChip chip={{ label: pill.label, tone: pillTone[pill.tone] }} onPhoto /></View>
        <View style={styles.cardBody}>
          <Text style={ui.supporting}>{portfolioLocation(item.property)} {'·'} {portfolioType(item.property)}{!occupied && row.asking_rent_monthly ? ` · ${pesos(row.asking_rent_monthly)} / mo` : ''}{archivedWhileOccupied ? ' · Listing archived while occupied' : ''}</Text>
          {!occupied ? <CellRow>
            {reviews ? <Cell label="Rating" value={reviews.count > 0 && reviews.average !== null ? `★ ${reviews.average.toFixed(1)} · ${reviews.count}` : 'No reviews yet'} /> : null}
          </CellRow> : null}
        </View>
      </View>

      {needs.length ? <View accessibilityLabel={`Needs you, ${needs.length}`} style={styles.alert}>
        <Text accessibilityRole="header" style={styles.alertHead}>{`Needs you · ${needs.length}`}</Text>
        {needs.map(n => <Pressable key={n.key} accessibilityRole="button" accessibilityLabel={`${n.chip}: ${n.text}`} onPress={() => go(n.target)} style={styles.needRow}>
          <TenancyChip chip={{ label: n.chip, tone: n.tone === 'danger' ? 'urgent' : 'warning' }} /><Text style={[ui.body, styles.grow]}>{n.text}</Text><Text style={styles.chevron}>{'›'}</Text>
        </Pressable>)}
      </View> : null}

      {occupied && stay ? <>
        <View style={styles.card}><View style={styles.cardBody}>
          <View style={styles.headRow}><Text accessibilityRole="header" style={[ui.sectionTitle, styles.grow]}>Current tenant</Text><Pressable accessibilityRole="link" accessibilityLabel="Open tenancy" onPress={() => management?.openTenancy(stay.tenancyId)} style={styles.link}><Text style={styles.linkText}>Tenancy {'›'}</Text></Pressable></View>
          <View style={styles.headRow}>
            <View style={[styles.avatar]}><Text style={styles.avatarText}>{(stay.tenantName || 'T').slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.grow}><Text style={ui.sectionTitle}>{stay.tenantName || 'Tenant'}</Text></View>
            {stay.conversationId ? <View style={styles.messageSlot}><TenancyButton label="Message" accessibilityLabel={`Message ${stay.tenantName || 'tenant'}`} onPress={() => management?.message(stay.conversationId!)} /></View> : null}
          </View>
          <CellRow><Cell label="Stay" value={stayDates(stay)} />{stay.rent !== null ? <Cell label="Rent" value={pesos(stay.rent)} /> : null}</CellRow>
        </View></View>
        <View style={styles.card}><View style={styles.cardBody}>
          <View style={styles.headRow}><Text accessibilityRole="header" style={[ui.sectionTitle, styles.grow]}>Rent</Text>{stay.nextDue ? <TenancyChip chip={{ label: `Next ${shortDate(stay.nextDue)}`, tone: 'info' }} /> : null}</View>
          <Text style={ui.body}>{stay.nextDue ? `Next rent due ${dueLabel(stay.nextDue, Date.now())}` : 'No upcoming rent date is recorded.'}</Text>
          <Text style={ui.supporting}>Rent dates come from the tenancy schedule. Payments are not tracked yet.</Text>
        </View></View>
        <View style={styles.grid}>
          <Tile label="Maintenance" note={facts.maintenance.open ? `${facts.maintenance.open} open` : 'None open'} icon={<TenancyDashboardIcon kind="maintenance" />} tone={facts.maintenance.open ? 'warning' : 'positive'} onPress={() => management?.openTenancy(stay.tenancyId, 'care')} />
          {reviews ? <Tile label="Reviews" note={reviews.count > 0 ? `★ ${reviews.average.toFixed(1)} · ${reviews.count} review${reviews.count === 1 ? '' : 's'}` : 'No reviews yet'} icon={<Text style={styles.glyph}>{'★'}</Text>} onPress={() => management?.openTenancy(stay.tenancyId, 'reviews')} /> : null}
          {detailsPlan && canEditListing ? <Tile label="Edit details" note="Price, photos, info" icon={<Text style={styles.glyph}>{'✎'}</Text>} onPress={() => vm.editPortfolioPropertyDetails(item.propertyId)} /> : null}
          <Tile label="Tenancy" note="Terms and history" icon={<TenancyDashboardIcon kind="upcoming" />} tone="info" onPress={() => management?.openTenancy(stay.tenancyId)} />
        </View>
      </> : null}

      {!occupied && waiting ? <View style={styles.alert}>
        <Text accessibilityRole="header" style={styles.alertHead}>{facts.reservations.length === 1 ? '1 reservation request is waiting' : `${facts.reservations.length} reservation requests are waiting`}</Text>
        <View style={styles.headRow}><View style={styles.avatar}><Text style={styles.avatarText}>{(waiting.applicantName || 'R').slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.grow}><Text style={ui.sectionTitle}>{waiting.applicantName || 'Renter'}</Text><Text style={ui.supporting}>{stayDates({ tenancyId: '', tenantId: '', tenantName: null, startDate: waiting.moveInDate, endDate: waiting.endDate, rent: null, nextDue: null, conversationId: null })}</Text></View></View>
        {declining ? <View style={styles.confirm}>
          <Text style={ui.body}>Decline this request? {waiting.applicantName || 'The renter'} will be told it was declined.</Text>
          <FeedbackNotice message={declineError} tone="error" />
          <ButtonRow><Slot><TenancyButton tone="dangerOutline" label={declineBusy ? 'Declining...' : 'Decline request'} disabled={declineBusy} onPress={() => void decline()} /></Slot><Slot><TenancyButton label="Keep request" disabled={declineBusy} onPress={() => { setDeclining(null); setDeclineError(null); }} /></Slot></ButtonRow>
        </View> : <ButtonRow><Slot><TenancyButton tone="warning" label="Review request" onPress={() => management?.reviewRequests(item)} /></Slot><Slot><TenancyButton label="Decline" accessibilityLabel={`Decline request from ${waiting.applicantName || 'renter'}`} onPress={() => setDeclining(waiting)} /></Slot></ButtonRow>}
      </View> : null}

      {!operation ? <View style={styles.card}><View style={styles.cardBody}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Listing status</Text>
        <View accessibilityRole="tablist" style={styles.seg}>
          {segments.segments.map((segment, index) => {
            const enabled = !!segment.operation && !segment.selected && !vm.lifecycleBlocked;
            return <Pressable key={segment.key} accessibilityRole="tab" accessibilityLabel={segment.label} accessibilityState={{ selected: segment.selected, disabled: !enabled && !segment.selected }} disabled={!enabled} onPress={() => segment.operation && vm.lifecycle.request(segment.operation)} style={[styles.segItem, index > 0 && styles.segDivider, segment.selected && (segment.key === 'paused' ? styles.segWarn : styles.segOn)]}>
              <Text style={[ui.body, segment.selected && styles.segOnText, !enabled && !segment.selected && styles.segOffText]}>{segment.label}</Text>
            </Pressable>;
          })}
        </View>
        <Text style={ui.supporting}>{segments.reason ?? PAUSED_HINT}</Text>
      </View></View> : <View style={styles.card}><View style={styles.cardBody}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>{vm.lifecycleLabel[operation]}?</Text>
        <Text style={ui.body}>{operation === 'archive' ? 'Archiving is final in this workflow. Your listing record, property and photos will be kept.' : operation === 'pause' ? 'Pause this listing? You may request reactivation later.' : "Return this listing to Published? RentLease will recheck this property's verification and publication requirements."}</Text>
        <ButtonRow><Slot><TenancyButton tone="primary" label={`Confirm ${vm.lifecycleLabel[operation].toLowerCase()}`} disabled={vm.lifecycleBlocked} onPress={() => void vm.lifecycle.confirm()} /></Slot><Slot><TenancyButton label="Cancel" onPress={vm.lifecycle.cancel} /></Slot></ButtonRow>
      </View></View>}

      {!occupied ? <ManagePriceCheck accountId={accountId} listingId={row.id} property={vm.estimationProperty} rent={row.asking_rent_monthly} /> : null}

      {!occupied ? <View style={styles.grid}>
        {canEditListing ? <Tile label="Edit listing" note="Photos, price, info" icon={<Text style={styles.glyph}>{'✎'}</Text>} onPress={vm.editManagedListing} /> : null}
      </View> : null}
      <TenancyButton label="Back to My properties" onPress={vm.goDashboard} disabled={state.busy} />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  pad: { padding: spacing.md },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: { ...ui.panel, overflow: 'hidden' },
  cover: { width: '100%', height: 96 },
  coverBlank: { backgroundColor: colors.surface },
  coverChip: { position: 'absolute', left: spacing.sm, top: spacing.sm },
  cardBody: { padding: spacing.sm, gap: spacing.sm },
  alert: { padding: spacing.sm, gap: spacing.xs, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningSurface },
  alertHead: { ...ui.sectionTitle, color: colors.warning },
  needRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chevron: { ...ui.sectionTitle, color: colors.warning },
  grow: { flex: 1, minWidth: 0 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  link: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkText: { ...ui.body, color: colors.primaryAction, fontWeight: '700' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryAction },
  avatarText: { ...ui.body, color: colors.white, fontWeight: '700' },
  messageSlot: { minWidth: 110 },
  confirm: { gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { ...ui.panel, flexGrow: 1, flexBasis: 150, minHeight: 76, padding: spacing.sm, gap: 4 },
  glyph: { ...ui.sectionTitle, color: colors.primaryAction },
  well: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { ...ui.body, fontWeight: '700' },
  seg: { flexDirection: 'row', borderWidth: 1.5, borderColor: colors.controlBorder, borderRadius: radius.control, overflow: 'hidden', backgroundColor: colors.background },
  segItem: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  segDivider: { borderLeftWidth: 1, borderLeftColor: colors.outline },
  segOn: { backgroundColor: colors.primaryPale },
  segWarn: { backgroundColor: colors.warningSurface },
  segOnText: { fontWeight: '700', color: colors.ink },
  segOffText: { color: colors.textMuted },
});
