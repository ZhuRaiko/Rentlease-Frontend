import {useState, type ReactNode} from 'react';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Modal, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {StatusButton} from '../../../shared/components/StatusParts';
import {NOTE_MAX, type Step} from '../models/Maintenance';

/** One selectable chip, 48dp high. The group is a radio group for screen readers. */
export function ChoiceChip({label, selected, onPress, disabled = false}: {label: string; selected: boolean; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected, disabled}} disabled={disabled} onPress={onPress}
    style={[styles.chip, selected && styles.chipOn, disabled && {opacity: 0.5}]}><Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text></Pressable>;
}
export function ChipGroup({children, label}: {children: ReactNode; label: string}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>{children}</View>;
}

/** A plain message line. Amber for something that needs a retry or a note. */
export function Notice({text, tone = 'warning', onRetry, retryLabel = 'Retry', disabled = false}: {text: string; tone?: 'warning' | 'neutral'; onRetry?: (() => void) | undefined; retryLabel?: string; disabled?: boolean}) {
  return <View accessibilityLiveRegion="polite" style={[styles.notice, tone === 'neutral' && styles.noticeNeutral]}>
    <Text accessibilityRole="alert" style={[ui.body, tone === 'warning' && {color: colors.warning}]}>{text}</Text>
    {onRetry ? <StatusButton label={retryLabel} disabled={disabled} onPress={onRetry}/> : null}
  </View>;
}

/** The landlord's (or the other person's) last note, in a bubble. */
export function NoteBubble({who, text, when, mine = false}: {who: string; text: string; when?: string | undefined; mine?: boolean}) {
  return <View style={[styles.bubble, mine && styles.bubbleMine]}>
    <Text style={styles.bubbleWho}>{who}{when ? ` · ${when}` : ''}</Text>
    <Text selectable style={ui.body}>{text}</Text>
  </View>;
}

/** The four steps, one under the other, each with its time or state. */
/** The vertical step list. Any steps with a key, label, detail and state; the setup screen uses it too. */
export function StepList({steps}: {steps: readonly {key: string; label: string; detail: string; state: Step['state']}[]}) {
  return <View accessibilityRole="list" style={{gap: 0}}>{steps.map((s, i) => <View key={s.key} accessible accessibilityLabel={`${s.label}. ${s.detail}. ${s.state === 'done' ? 'Done' : s.state === 'current' ? 'Now' : 'Not yet'}`} style={styles.stepRow}>
    <View style={styles.rail}><View style={[styles.dot, s.state === 'done' && styles.dotDone, s.state === 'current' && styles.dotNow]}/>{i < steps.length - 1 ? <View style={[styles.line, s.state === 'done' && styles.lineDone]}/> : null}</View>
    <View style={{flex: 1, paddingBottom: spacing.sm}}><Text style={[ui.body, s.state === 'upcoming' && {color: colors.textSecondary}]}>{s.label}</Text>{s.detail ? <Text style={ui.supporting}>{s.detail}</Text> : null}</View>
  </View>)}</View>;
}
/** A compact four-segment line for a list card, with the current step under it. */
export function StepLine({steps}: {steps: Step[]}) {
  const current = steps.find(s => s.state === 'current') ?? steps[steps.length - 1];
  return <View accessible accessibilityLabel={steps.map(s => `${s.label}: ${s.state === 'done' ? 'done' : s.state === 'current' ? 'now' : 'not yet'}`).join(', ')} style={{gap: spacing.xxs}}>
    <View style={styles.segments}>{steps.map(s => <View key={s.key} style={[styles.segment, s.state !== 'upcoming' && styles.segmentOn, s.state === 'current' && styles.segmentNow]}/>)}</View>
    {current ? <Text style={ui.supporting}>{current.label}{current.detail ? ` · ${current.detail}` : ''}</Text> : null}
  </View>;
}

/** A bottom sheet with a title and optional required note ("Not fixed" needs one). */
export function NoteSheet({visible, title, body, placeholder, confirmLabel, requireNote, disabled, onConfirm, onClose}: {visible: boolean; title: string; body?: string; placeholder?: string; confirmLabel: string; requireNote: boolean; disabled: boolean; onConfirm: (note: string) => void; onClose: () => void}) {
  const [note, setNote] = useState(''), insets = useSafeAreaInsets();
  const ready = !requireNote || note.trim().length > 0;
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
    <View style={styles.scrim}><View accessibilityViewIsModal style={[styles.sheet, {paddingBottom: spacing.md + insets.bottom}]}>
      <Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text>
      {body ? <Text style={ui.body}>{body}</Text> : null}
      {placeholder !== undefined ? <TextInput accessibilityLabel={placeholder || title} placeholder={placeholder} placeholderTextColor={colors.textMuted} multiline maxLength={NOTE_MAX} value={note} onChangeText={setNote} style={styles.input}/> : null}
      <View style={{gap: spacing.xs}}>
        <StatusButton tone="primary" label={confirmLabel} disabled={disabled || !ready} onPress={() => onConfirm(note.trim())}/>
        <StatusButton label="Never mind" onPress={() => {setNote(''); onClose();}}/>
      </View>
    </View></View>
  </Modal>;
}

export const styles = StyleSheet.create({
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  chip: {minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.controlBorder, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'},
  chipOn: {backgroundColor: colors.primaryPale, borderColor: colors.primaryAction},
  chipText: {...ui.body, fontWeight: '600'}, chipTextOn: {color: colors.primaryAction, fontWeight: '700'},
  notice: {padding: spacing.sm, gap: spacing.xs, borderRadius: radius.panel, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningSurface},
  noticeNeutral: {borderColor: colors.outline, backgroundColor: colors.surface},
  bubble: {padding: spacing.sm, gap: 2, borderRadius: radius.panel, backgroundColor: colors.surface},
  bubbleMine: {backgroundColor: colors.primaryPale},
  bubbleWho: {...ui.supporting, fontWeight: '700'},
  stepRow: {flexDirection: 'row', gap: spacing.sm},
  rail: {width: 14, alignItems: 'center'},
  dot: {width: 12, height: 12, borderRadius: 6, marginTop: 5, borderWidth: 2, borderColor: colors.controlBorder, backgroundColor: colors.background},
  dotDone: {backgroundColor: colors.primaryAction, borderColor: colors.primaryAction}, dotNow: {backgroundColor: colors.warning, borderColor: colors.warning},
  line: {flex: 1, width: 2, backgroundColor: colors.outline}, lineDone: {backgroundColor: colors.primaryAction},
  segments: {flexDirection: 'row', gap: spacing.xxs}, segment: {flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.outline},
  segmentOn: {backgroundColor: colors.primaryAction}, segmentNow: {backgroundColor: colors.warning},
  scrim: {flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end'},
  sheet: {backgroundColor: colors.background, padding: spacing.md, gap: spacing.sm, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg},
  input: {...ui.control, color: colors.ink, padding: spacing.sm, minHeight: 96, textAlignVertical: 'top'},
});
