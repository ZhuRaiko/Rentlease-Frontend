import {useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {ButtonRow, Slot, StatusButton, StatusChip} from '../../../shared/components/StatusParts';
import {KeyboardAwareScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {ageText, careActionsFor, categoryLabel, isOpen, requestChip, resolvedLine, tenancyStateOf, trackerSteps} from '../models/Maintenance';
import {formatWhen} from '../models/MaintenanceFormat';
import {NoteBubble, Notice, NoteSheet, StepLine} from '../components/MaintenanceParts';
import type {CareRequest} from '../models/TenancyCare';
import type {useTenancyCareViewModel} from '../viewModels/useTenancyCareViewModel';

type Care = ReturnType<typeof useTenancyCareViewModel>;
type Tab = 'open' | 'resolved';

/** "My maintenance requests" for the tenant: Open and Resolved tabs, one card per request. */
export function MaintenanceListView({care, propertyTitle, landlordName, onReport, onOpen}: {care: Care; propertyTitle: string; landlordName: string; onReport: () => void; onOpen: (requestId: string) => void}) {
  const [tab, setTab] = useState<Tab>('open'), [sheet, setSheet] = useState<{kind: 'notFixed' | 'cancel'; request: CareRequest} | null>(null);
  const data = care.data, now = Date.now(), tenancy = tenancyStateOf(data?.status ?? '');
  const confirmed = (r: CareRequest) => care.workflow.confirmedOf(r);
  const groups = useMemo(() => {
    const open: CareRequest[] = [], resolved: CareRequest[] = [];
    for (const r of data?.requests ?? []) {if (isOpen(r.status, care.workflow.confirmedOf(r))) open.push(r); else if (r.status === 'resolved') resolved.push(r);}
    return {open, resolved};
  }, [data, care.confirmations]);
  const shown = groups[tab], locked = care.busy || care.saving || !care.ready, canReport = tenancy === 'active' && data?.tenantId !== undefined;
  const run = (action: 'confirm_resolved' | 'reopen' | 'cancel', r: CareRequest, note?: string) => {
    void care.workflow.submit(action, {requestId: r.id, revision: r.revision, ...(note ? {note} : {})});
    setSheet(null);
  };
  return <KeyboardAwareScrollView contentContainerStyle={styles.content}>
    <Text style={ui.supporting}>{propertyTitle}</Text>
    <View accessibilityRole="tablist" style={styles.tabs}>{(['open', 'resolved'] as const).map(t => <Pressable key={t} accessibilityRole="tab" accessibilityLabel={`${t === 'open' ? 'Open' : 'Resolved'}, ${groups[t].length}`} accessibilityState={{selected: tab === t}} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
      <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'open' ? 'Open' : 'Resolved'} · {groups[t].length}</Text></Pressable>)}</View>
    {care.busy && !data ? <ActivityIndicator accessibilityLabel="Loading requests" color={colors.primaryAction}/> : null}
    {care.error ? <Notice text={care.error} onRetry={() => void care.workflow.retry()} disabled={care.busy || care.saving}/> : null}
    {data && !shown.length && !care.busy ? <View style={styles.empty}><Text accessibilityRole="header" style={ui.sectionTitle}>{tab === 'open' ? 'No requests' : 'Nothing resolved yet'}</Text>
      <Text style={ui.supporting}>{tab === 'open' ? 'When something needs fixing, tell your landlord here.' : 'Fixed requests you confirmed show up here.'}</Text>
      {tab === 'open' && canReport ? <StatusButton tone="primary" label="Report an issue" onPress={onReport}/> : null}</View> : null}
    {shown.map(r => {
      const ok = confirmed(r), a = careActionsFor({role: 'tenant', tenancy, status: r.status, confirmed: ok}), chip = requestChip({priority: r.priority, status: r.status, confirmed: ok});
      const steps = trackerSteps({status: r.status, confirmed: ok, role: 'tenant', otherName: landlordName, times: {sent: formatWhen(r.createdAt, now)}});
      return <View key={r.id} style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${r.title}. Open request`} onPress={() => onOpen(r.id)} style={{gap: spacing.xs}}>
          <View style={styles.head}><View style={{flex: 1, minWidth: 0}}><Text style={ui.sectionTitle}>{r.title}</Text><Text style={ui.supporting}>{categoryLabel(r.category)} · sent {ageText(r.createdAt, now)}</Text></View>{chip ? <StatusChip chip={chip}/> : null}</View>
          {r.status === 'resolved' ? <Text style={[ui.body, !ok && {color: colors.warning, fontWeight: '700'}]}>{resolvedLine({role: 'tenant', otherName: landlordName, confirmed: ok})}</Text> : steps.length ? <StepLine steps={steps}/> : null}
          {r.response ? <NoteBubble who={landlordName} text={r.response}/> : null}
        </Pressable>
        <ButtonRow>
          {a.reply ? <Slot><StatusButton label="Reply" accessibilityLabel={`Reply: ${r.title}`} disabled={locked} onPress={() => onOpen(r.id)}/></Slot> : null}
          {a.confirm ? <Slot><StatusButton tone="primary" label="Confirm fixed" accessibilityLabel={`Confirm fixed: ${r.title}`} disabled={locked} onPress={() => run('confirm_resolved', r)}/></Slot> : null}
          {a.notFixed ? <Slot><StatusButton tone="warning" label="Not fixed" accessibilityLabel={`Not fixed: ${r.title}`} disabled={locked} onPress={() => setSheet({kind: 'notFixed', request: r})}/></Slot> : null}
          {a.cancel ? <Slot><StatusButton tone="dangerOutline" label="Cancel request" accessibilityLabel={`Cancel request: ${r.title}`} disabled={locked} onPress={() => setSheet({kind: 'cancel', request: r})}/></Slot> : null}
        </ButtonRow>
      </View>;
    })}
    {data && (care.offset > 0 || data.requests.length === 20) ? <ButtonRow>
      {care.offset > 0 ? <Slot><StatusButton label="Newer requests" disabled={locked} onPress={() => void care.workflow.load(Math.max(0, care.offset - 20))}/></Slot> : null}
      {data.requests.length === 20 ? <Slot><StatusButton label="Older requests" disabled={locked || care.offset >= 10000} onPress={() => void care.workflow.load(care.offset + 20)}/></Slot> : null}</ButtonRow> : null}
    {data && tab === 'open' && shown.length && canReport ? <StatusButton tone="primary" label="Report an issue" disabled={locked} onPress={onReport}/> : null}
    {sheet?.kind === 'notFixed' ? <NoteSheet visible title="Not fixed" body={`Tell ${landlordName} what is still wrong. A note is required.`} placeholder="What is still wrong?" confirmLabel="Send: not fixed" requireNote disabled={locked} onConfirm={note => run('reopen', sheet.request, note)} onClose={() => setSheet(null)}/> : null}
    {sheet?.kind === 'cancel' ? <NoteSheet visible title="Cancel this request?" body={`${landlordName} will be told. You can report it again later.`} confirmLabel="Cancel request" requireNote={false} disabled={locked} onConfirm={() => run('cancel', sheet.request)} onClose={() => setSheet(null)}/> : null}
  </KeyboardAwareScrollView>;
}
const styles = StyleSheet.create({
  content: {padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg},
  tabs: {flexDirection: 'row', gap: spacing.xs},
  tab: {flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control, borderWidth: 1.5, borderColor: colors.controlBorder, backgroundColor: colors.background, paddingHorizontal: spacing.xs},
  tabOn: {backgroundColor: colors.primaryPale, borderColor: colors.primaryAction}, tabText: {...ui.body, fontWeight: '600', textAlign: 'center'}, tabTextOn: {color: colors.primaryAction, fontWeight: '700'},
  card: {...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card},
  head: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.xs},
  empty: {...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card},
});
