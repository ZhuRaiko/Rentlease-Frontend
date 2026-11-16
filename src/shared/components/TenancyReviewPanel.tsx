import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from './AppButton';
import { PropertyPhotoThumbnail } from './PropertyPhotoThumbnail';
import { StarPicker, StarRow, TagPicker, TagPills } from './ReviewParts';
import { StatusChip } from './StatusParts';
import { reviewNotEligibleText, reviewScreenFor, type ReviewRow } from '../models/RentalReview';
import { COMMENT_LIMIT, commentCounter, formCopy, groupOf, sentDateLabel, sentView, type StepState } from '../models/ReviewPresentation';
import { tagLabels, toggleTag } from '../models/ReviewTags';
import type { PublicPropertyPhoto } from '../models/PropertyMediaPath';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { ui } from '../theme/ui';
import { useRentalReviews } from '../viewModels/useRentalReviews';

/** Who or what is being rated, shown at the top of the screen. Built by the screen that opens this one, from the tenancy's own data. */
export interface ReviewSubject { title: string; subtitle: string; photos: readonly PublicPropertyPhoto[] | null; initial: string | null }

interface Props {
  accountId: string | undefined;
  tenancyId: string;
  /** The other person's name from the tenancy's people. Never taken from a review. */
  otherName: string;
  subject?: ReviewSubject | null | undefined;
  endDate?: string | null | undefined;
  registerExitGuard?: ((guard: (() => boolean) | null) => void) | undefined;
  onDone?: (() => void) | undefined;
  /** The header title for the current state ("Rate your stay", "Rate your tenant" or "Review sent"). */
  onTitle?: ((title: string) => void) | undefined;
}

function Subject({ subject }: { subject: ReviewSubject }) {
  return <View style={styles.subject}>
    {subject.photos ? <PropertyPhotoThumbnail photos={subject.photos} size={56} /> : <View accessible={false} style={styles.initial}><Text allowFontScaling={false} style={styles.initialText}>{subject.initial ?? ''}</Text></View>}
    <View style={styles.grow}><Text accessibilityRole="header" style={ui.sectionTitle}>{subject.title}</Text><Text style={ui.supporting}>{subject.subtitle}</Text></View>
  </View>;
}

const STEP_COLOR: Record<StepState, string> = { done: colors.primaryAction, current: colors.warning, upcoming: colors.controlBorder };

function Sent({ row, role, name, onDone }: { row: ReviewRow; role: 'tenant' | 'landlord'; name: string; onDone?: (() => void) | undefined }) {
  const view = sentView(row.status, role, name, sentDateLabel(row.createdAt));
  return <View style={styles.stack}>
    <View style={styles.hero}>
      <View accessible={false} style={styles.check}><Text allowFontScaling={false} style={styles.checkMark}>{row.status === 'approved' || row.status === 'pending' ? '✓' : '–'}</Text></View>
      <Text accessibilityRole="header" style={[ui.sectionTitle, styles.center]}>{view.heading}</Text>
      <Text style={[ui.supporting, styles.center]}>{view.body}</Text>
    </View>
    <View style={styles.card}>
      <View style={styles.cardHead}><Text style={[ui.body, styles.grow, { fontWeight: '700' }]}>{view.cardTitle}</Text><StatusChip chip={view.chip} /></View>
      <View accessibilityLabel={`${row.rating} out of 5 stars`} accessible><StarRow filled={row.rating} /></View>
      {row.text ? <Text style={ui.body}>{row.text}</Text> : null}
      <TagPills labels={tagLabels(groupOf(row.kind), row.tags ?? [])} />
    </View>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={[ui.body, { fontWeight: '700' }]}>Status of your review</Text>
      {view.steps.map((s, i) => <View key={s.key} style={styles.step}>
        <View style={styles.rail}><View style={[styles.dot, { backgroundColor: s.state === 'done' ? STEP_COLOR.done : colors.background, borderColor: STEP_COLOR[s.state] }]} />{i < view.steps.length - 1 ? <View style={styles.line} /> : null}</View>
        <View style={[styles.grow, { paddingBottom: spacing.sm }]}><Text style={ui.body}>{s.label}</Text><Text style={ui.supporting}>{s.detail}</Text></View>
      </View>)}
    </View>
    {onDone ? <AppButton label="Back to tenancy" onPress={onDone} /> : null}
  </View>;
}

/**
 * One rate screen per person, chosen by role and never by a selector: the tenant rates the stay (property), the landlord rates the tenant.
 * Stars are required; up to 5 tags and a comment are optional. After sending, the screen shows the STORED review and its status.
 * What decides what is shown lives in models/RentalReview.ts (reviewScreenFor) and models/ReviewPresentation.ts.
 */
export function TenancyReviewPanel({ accountId, tenancyId, otherName, subject, endDate, registerExitGuard, onDone, onTitle }: Props) {
  const vm = useRentalReviews(accountId, { mode: 'tenancy', id: tenancyId });
  const c = vm.data?.type === 'context' ? vm.data.value : null;
  const [rating, setRating] = useState<number | null>(null), [tags, setTags] = useState<string[]>([]), [body, setBody] = useState('');
  const screen = c && accountId ? reviewScreenFor(c, accountId) : null;
  const locked = !vm.ready || vm.busy || vm.saving || !!vm.pending;
  const title = screen ? (screen.state === 'reviewed' ? 'Review sent' : screen.role === 'tenant' ? 'Rate your stay' : 'Rate your tenant') : 'Ratings';
  useEffect(() => { onTitle?.(title); }, [title, onTitle]);
  useEffect(() => {
    registerExitGuard?.(() => { if (vm.saving) { Alert.alert('Review in progress', 'Wait until the submission result is confirmed.'); return false; } return true; });
    return () => registerExitGuard?.(null);
  }, [vm.saving, registerExitGuard]);

  if (!screen) {
    return <View style={styles.stack}>
      {vm.busy ? <ActivityIndicator accessibilityLabel="Loading" color={colors.primaryAction} /> : null}
      {vm.error ? <View style={styles.card}><Text accessibilityRole="alert" style={ui.body}>{vm.error}</Text><AppButton label="Try again" variant="secondary" disabled={vm.busy} onPress={() => void vm.workflow.load()} /></View> : null}
    </View>;
  }
  const copy = formCopy(screen.role, otherName);
  const kind = screen.kind;

  if (vm.pending && vm.pending.action === 'submit') {
    const op = vm.pending;
    return <View style={styles.stack}>
      {subject ? <Subject subject={subject} /> : null}
      <View style={styles.card}>
        <Text accessibilityRole="header" style={[ui.body, { fontWeight: '700' }]}>Your review isn't confirmed yet</Text>
        <Text style={ui.supporting}>We couldn't confirm it was sent. Retry sends this same review, so it can't be sent twice.</Text>
        <View accessibilityLabel={`${op.rating} out of 5 stars`} accessible><StarRow filled={op.rating} /></View>
        {op.text ? <Text style={ui.body}>{op.text}</Text> : null}
        <TagPills labels={tagLabels(groupOf(op.kind), op.tags)} />
      </View>
      {vm.error ? <Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text> : null}
      <AppButton label={vm.saving ? 'Sending...' : 'Retry'} disabled={!vm.ready || vm.busy || vm.saving} onPress={() => void vm.workflow.retry()} />
    </View>;
  }

  if (screen.state === 'reviewed' && screen.own) return <Sent row={screen.own} role={screen.role} name={otherName} onDone={onDone} />;

  return <View style={styles.stack}>
    {subject ? <Subject subject={subject} /> : null}
    {screen.state === 'not_eligible' ? <View style={styles.card}><Text style={ui.body}>{reviewNotEligibleText(endDate)}</Text></View> : null}
    {screen.state === 'legacy' ? <View style={styles.card}><Text style={ui.supporting}>A review from you already exists for this tenancy.</Text></View> : null}
    {screen.state === 'form' ? <>
      <View style={[styles.card, { alignItems: 'center' }]}>
        <Text style={[ui.body, styles.center]}>{copy.question}</Text>
        <StarPicker value={rating} onChange={setRating} disabled={locked} />
      </View>
      <View style={styles.card}>
        <Text style={ui.body}>What stood out? <Text style={ui.supporting}>Pick up to 5</Text></Text>
        <TagPicker group={groupOf(kind)} selected={tags} onToggle={code => setTags(old => toggleTag(groupOf(kind), old, code))} disabled={locked} />
      </View>
      <View style={styles.card}>
        <Text style={ui.body}>Add a comment <Text style={ui.supporting}>Optional</Text></Text>
        <TextInput accessibilityLabel="Add a comment, optional" multiline editable={!locked} value={body} onChangeText={setBody} maxLength={COMMENT_LIMIT} placeholder={copy.commentPlaceholder} placeholderTextColor={colors.textMuted} style={styles.input} />
        <Text accessibilityLabel={`${body.length} of ${COMMENT_LIMIT} characters`} style={[ui.supporting, styles.counter]}>{commentCounter(body)}</Text>
      </View>
      <Text style={ui.supporting}>{copy.info}</Text>
      {vm.error ? <Text accessibilityRole="alert" style={[ui.body, { color: colors.restricted }]}>{vm.error}</Text> : null}
      <AppButton label={vm.saving ? 'Sending...' : copy.submit} disabled={locked || rating === null} onPress={() => { if (rating !== null) void vm.workflow.submit({ action: 'submit', tenancyId, kind, rating, text: body.trim() === '' ? null : body, tags }); }} />
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  subject: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  initial: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: colors.white, fontSize: 22, fontWeight: '700' },
  card: { ...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: colors.primaryAction, fontSize: 28, fontWeight: '700' },
  step: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 5 },
  line: { flex: 1, width: 2, backgroundColor: colors.outline },
  input: { ...ui.control, minHeight: 112, padding: spacing.sm, color: colors.ink, textAlignVertical: 'top', fontSize: 15, backgroundColor: colors.background },
  counter: { textAlign: 'right' },
});
