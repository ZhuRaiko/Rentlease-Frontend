import {useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {ButtonRow, Slot, StatusButton, StatusChip} from '../../../shared/components/StatusParts';
import {useBottomClearance} from '../../../shared/components/useBottomClearance';
import {KeyboardAwareScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {NOTE_MAX, QUICK_REPLIES, categoryLabel, requestChip, resolvedLine, stepIndex, stepTimes, threadName, trackerSteps} from '../models/Maintenance';
import {formatWhen} from '../models/MaintenanceFormat';
import {NoteBubble, Notice, NoteSheet, StepList} from '../components/MaintenanceParts';
import {useMaintenanceRequestViewModel} from '../viewModels/useMaintenanceViewModels';

/** One request for either person: what was reported, where it stands, the conversation, and the actions this person may take. */
export function MaintenanceRequestView({accountId, requestId, otherName, propertyTitle}: {accountId: string | undefined; requestId: string; otherName: string; propertyTitle?: string | undefined}) {
  const vm = useMaintenanceRequestViewModel(accountId, requestId), [text, setText] = useState(''), [sheet, setSheet] = useState<'notFixed' | 'cancel' | null>(null);
  const bottom = useBottomClearance();
  const d = vm.data, a = vm.workflow.actions(), locked = vm.busy || vm.saving || !vm.ready, now = Date.now();
  if (!d || !a) return <KeyboardAwareScrollView contentContainerStyle={[styles.content, {paddingBottom: bottom}]}>
    {vm.busy ? <ActivityIndicator accessibilityLabel="Loading request" color={colors.primaryAction}/> : null}
    {vm.error ? <Notice text={vm.error} onRetry={() => void vm.workflow.retry()} disabled={vm.busy}/> : null}
  </KeyboardAwareScrollView>;
  const r = d.request, role = r.role, confirmed = r.tenantConfirmedAt !== null, chip = requestChip({priority: r.priority, status: r.status, confirmed});
  const steps = trackerSteps({status: r.status, confirmed, role, otherName, times: stepTimes(d.thread, r.createdAt, iso => formatWhen(iso, now))});
  const landlord = role === 'landlord', at = stepIndex(r.status);
  // The text box is the note for a status change too; it is cleared only when the write went through (no error, nothing left to retry).
  const settled = () => {const s = vm.workflow.getSnapshot(); return !s.error && !s.pending;};
  const sendReply = async () => {const note = text.trim(); if (!note) return; await vm.workflow.reply(note); if (settled()) setText('');};
  const status = async (target: 'acknowledged' | 'in_progress' | 'resolved') => {await vm.workflow.setStatus(target, text); if (settled()) setText('');};
  return <KeyboardAwareScrollView contentContainerStyle={[styles.content, {paddingBottom: bottom}]}>
    <View style={styles.card}>
      <View style={styles.head}><View style={{flex: 1, minWidth: 0}}><Text accessibilityRole="header" style={ui.pageTitle}>{r.title}</Text>
        <Text style={ui.supporting}>{categoryLabel(r.category)}{propertyTitle ? ` · ${propertyTitle}` : ''}</Text>
        <Text style={ui.supporting}>{landlord ? otherName : 'You'} · {formatWhen(r.createdAt, now)}</Text></View>{chip ? <StatusChip chip={chip}/> : null}</View>
      <Text selectable style={ui.body}>{r.description}</Text>
    </View>
    {vm.error ? <Notice text={vm.error} onRetry={() => void vm.workflow.retry()} disabled={vm.busy || vm.saving}/> : null}
    {landlord ? <View style={styles.card}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Status</Text>
      <ButtonRow>
        {a.seen ? <Slot><StatusButton tone={at >= 1 ? 'primary' : 'secondary'} label="Seen" disabled={locked} onPress={() => void status('acknowledged')}/></Slot> : null}
        <Slot><StatusButton tone={at === 2 ? 'warning' : at > 2 ? 'primary' : 'secondary'} label="In progress" disabled={locked || !a.start} onPress={() => void status('in_progress')}/></Slot>
        <Slot><StatusButton tone={at === 3 ? 'primary' : 'secondary'} label="Fixed" disabled={locked || !a.resolve} onPress={() => void status('resolved')}/></Slot>
      </ButtonRow>
      <Text style={ui.supporting}>{r.status === 'resolved' ? resolvedLine({role, otherName, confirmed}) : `${otherName} confirms when it’s fixed.`}</Text>
      <Text style={ui.supporting}>A status change sends the note below, or “Seen”, “Work started” or “Marked as fixed” when it is empty.</Text>
    </View> : <View style={styles.card}><Text accessibilityRole="header" style={ui.sectionTitle}>Where it stands</Text>
      {steps.length ? <StepList steps={steps}/> : <Text style={ui.body}>{r.status === 'cancelled' ? 'You cancelled this request.' : 'This request is closed.'}</Text>}
      {a.confirm || a.notFixed || a.cancel ? <ButtonRow>
        {a.confirm ? <Slot><StatusButton tone="primary" label="Confirm fixed" disabled={locked} onPress={() => void vm.workflow.confirmFixed()}/></Slot> : null}
        {a.notFixed ? <Slot><StatusButton tone="warning" label="Not fixed" disabled={locked} onPress={() => setSheet('notFixed')}/></Slot> : null}
        {a.cancel ? <Slot><StatusButton tone="dangerOutline" label="Cancel request" disabled={locked} onPress={() => setSheet('cancel')}/></Slot> : null}</ButtonRow> : null}
    </View>}
    <View style={styles.card}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>Conversation</Text>
      {d.thread.map(e => <NoteBubble key={e.id} who={threadName(e.role, role, otherName)} when={formatWhen(e.at, now)} mine={e.role === role} text={e.note ?? 'Updated the request.'}/>)}
      {a.reply ? <>
        <Text style={ui.body}>{landlord ? `Tell ${otherName} what’s happening` : `Reply to ${otherName}`}</Text>
        {landlord ? <View style={styles.chips}>{QUICK_REPLIES.map(q => <StatusButton key={q} label={q} disabled={locked} onPress={() => setText(q)}/>)}</View> : null}
        <TextInput accessibilityLabel={landlord ? `Tell ${otherName} what’s happening` : `Reply to ${otherName}`} placeholder="Write a message" placeholderTextColor={colors.textMuted} multiline maxLength={NOTE_MAX} value={text} editable={!locked} onChangeText={setText} style={styles.input}/>
        <StatusButton tone="primary" label={vm.saving ? 'Sending…' : landlord ? 'Send update' : 'Send reply'} disabled={locked || !text.trim()} onPress={() => void sendReply()}/>
      </> : <Text style={ui.supporting}>{r.tenancyEnded ? 'This tenancy has ended, so this request is read-only.' : 'This request is closed.'}</Text>}
    </View>
    {sheet === 'notFixed' ? <NoteSheet visible title="Not fixed" body={`Tell ${otherName} what is still wrong. A note is required.`} placeholder="What is still wrong?" confirmLabel="Send: not fixed" requireNote disabled={locked} onConfirm={note => {void vm.workflow.notFixed(note); setSheet(null);}} onClose={() => setSheet(null)}/> : null}
    {sheet === 'cancel' ? <NoteSheet visible title="Cancel this request?" body={`${otherName} will be told.`} confirmLabel="Cancel request" requireNote={false} disabled={locked} onConfirm={() => {void vm.workflow.cancel(); setSheet(null);}} onClose={() => setSheet(null)}/> : null}
  </KeyboardAwareScrollView>;
}
const styles = StyleSheet.create({
  content: {padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg},
  card: {...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card},
  head: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.xs},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  input: {...ui.control, color: colors.ink, padding: spacing.sm, minHeight: 96, textAlignVertical: 'top'},
});
