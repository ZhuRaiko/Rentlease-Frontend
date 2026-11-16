import {useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {StatusButton} from '../../../shared/components/StatusParts';
import {KeyboardAwareScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {CATEGORY_LABELS, DEFAULT_URGENCY, DESCRIPTION_MAX, URGENCY_OPTIONS, URGENT_HINT, PICKER_CATEGORIES, createPayload, reportValid, type PickerCategory, type UrgencyKey} from '../models/Maintenance';
import {ChipGroup, ChoiceChip, Notice} from '../components/MaintenanceParts';
import type {useTenancyCareViewModel} from '../viewModels/useTenancyCareViewModel';

type Care = ReturnType<typeof useTenancyCareViewModel>;

/** "Report an issue": category, urgency, description. The title is made from the description when it is sent. */
export function MaintenanceReportView({care, propertyTitle, landlordName}: {care: Care; propertyTitle: string; landlordName: string}) {
  const [category, setCategory] = useState<PickerCategory>('plumbing'), [urgency, setUrgency] = useState<UrgencyKey>(DEFAULT_URGENCY), [description, setDescription] = useState('');
  const locked = !care.ready || care.busy || care.saving, retrying = !!care.pending && care.pending.action === 'create';
  const valid = reportValid(description);
  const send = () => {if (retrying) void care.workflow.retry(); else void care.workflow.submit('create', createPayload({description, category, urgency}));};
  return <KeyboardAwareScrollView contentContainerStyle={styles.content}>
    <View style={{gap: 2}}><Text accessibilityRole="header" style={ui.pageTitle}>{propertyTitle}</Text><Text style={ui.supporting}>Goes to {landlordName}</Text></View>
    {care.busy ? <ActivityIndicator accessibilityLabel="Loading" color={colors.primaryAction}/> : null}
    <View style={styles.group}><Text accessibilityRole="header" style={ui.sectionTitle}>What’s the problem?</Text>
      <ChipGroup label="Category">{PICKER_CATEGORIES.map(c => <ChoiceChip key={c} label={CATEGORY_LABELS[c]!} selected={category === c} disabled={locked || retrying} onPress={() => setCategory(c)}/>)}</ChipGroup></View>
    <View style={styles.group}><Text accessibilityRole="header" style={ui.sectionTitle}>How urgent is it?</Text>
      <ChipGroup label="Urgency">{URGENCY_OPTIONS.map(o => <ChoiceChip key={o.key} label={o.label} selected={urgency === o.key} disabled={locked || retrying} onPress={() => setUrgency(o.key)}/>)}</ChipGroup>
      <Text style={ui.supporting}>{URGENT_HINT}</Text></View>
    <View style={styles.group}><Text accessibilityRole="header" style={ui.sectionTitle}>What’s happening?</Text>
      <TextInput accessibilityLabel="What’s happening?" placeholder="Describe the issue" placeholderTextColor={colors.textMuted} multiline maxLength={DESCRIPTION_MAX} value={description} editable={!locked && !retrying} onChangeText={setDescription} style={styles.input}/>
      {description.length > 0 && !valid && !retrying ? <Text style={ui.supporting}>Add a few more words (at least 10 characters).</Text> : null}</View>
    {care.error ? <Notice text={care.error} onRetry={care.pending ? () => void care.workflow.retry() : () => void care.workflow.load()} disabled={care.busy || care.saving}/> : null}
    <StatusButton tone="primary" label={care.saving ? 'Sending…' : retrying ? 'Retry sending' : 'Send to landlord'} disabled={locked || (!retrying && !valid)} onPress={send}/>
  </KeyboardAwareScrollView>;
}
const styles = StyleSheet.create({
  content: {padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg},
  group: {gap: spacing.xs},
  input: {...ui.control, color: colors.ink, padding: spacing.sm, minHeight: 120, textAlignVertical: 'top'},
});
