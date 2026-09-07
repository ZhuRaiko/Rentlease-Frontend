import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type {
  AuditEntryPreview,
  ModerationReportPreview,
  QueuePriority,
  ReportQueueStatus,
  VerificationQueueStatus,
  VerificationSubmissionPreview,
} from '../models/AdminModeration';

export function AdminHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <View style={styles.headingBlock}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      <Text style={styles.headingBody}>{body}</Text>
    </View>
  );
}

export function AdminStatCard({ value, label, tone = 'neutral' }: { value: string | number; label: string; tone?: 'neutral' | 'warning' | 'danger' | 'positive' }) {
  return (
    <View style={[styles.statCard, tone === 'warning' && styles.statWarning, tone === 'danger' && styles.statDanger, tone === 'positive' && styles.statPositive]}>
      <Text style={[styles.statValue, tone === 'warning' && styles.textWarning, tone === 'danger' && styles.textDanger, tone === 'positive' && styles.textPositive]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function PriorityPill({ priority }: { priority: QueuePriority }) {
  return (
    <View style={[styles.priorityPill, priority === 'Urgent' && styles.priorityUrgent, priority === 'High' && styles.priorityHigh]}>
      <Text style={[styles.priorityText, priority === 'Urgent' && styles.priorityTextUrgent, priority === 'High' && styles.priorityTextHigh]}>{priority}</Text>
    </View>
  );
}

export function AdminStatusPill({ status }: { status: VerificationQueueStatus | ReportQueueStatus }) {
  const positive = status === 'Approved' || status === 'Action taken';
  const danger = status === 'Rejected' || status === 'Dismissed';
  const warning = status === 'Additional information requested' || status === 'Information requested';
  return (
    <View style={[styles.statusPill, positive && styles.statusPositive, danger && styles.statusDanger, warning && styles.statusWarning]}>
      <Text style={[styles.statusText, positive && styles.statusTextPositive, danger && styles.statusTextDanger, warning && styles.statusTextWarning]}>{status}</Text>
    </View>
  );
}

export function VerificationQueueCard({ item, onPress }: { item: VerificationSubmissionPreview; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.queueCard, pressed && styles.pressed]}>
      <View style={styles.queueTop}><PriorityPill priority={item.priority} /><Text style={styles.queueAge}>{item.age}</Text></View>
      <Text style={styles.queueTitle}>{item.applicantName}</Text>
      <Text style={styles.queueSubtitle}>Tier {item.requestedTier} verification · {item.id}</Text>
      <View style={styles.queueBottom}><AdminStatusPill status={item.status} /><Text style={styles.viewAction}>Review ›</Text></View>
    </Pressable>
  );
}

export function ReportQueueCard({ item, onPress }: { item: ModerationReportPreview; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.queueCard, pressed && styles.pressed]}>
      <View style={styles.queueTop}><PriorityPill priority={item.priority} /><Text style={styles.queueAge}>{item.age}</Text></View>
      <Text style={styles.queueTitle}>{item.reason}</Text>
      <Text style={styles.queueSubtitle}>{item.targetType} · {item.targetName}</Text>
      <View style={styles.queueBottom}><AdminStatusPill status={item.status} /><Text style={styles.viewAction}>{item.evidenceCount} evidence · Review ›</Text></View>
    </Pressable>
  );
}

export function DetailCard({ children }: PropsWithChildren) {
  return <View style={styles.detailCard}>{children}</View>;
}

export function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function EvidencePlaceholder({ index, label }: { index: number; label: string }) {
  return (
    <View style={styles.evidenceCard}>
      <View style={styles.evidenceVisual}>
        <View style={styles.imageFrame}><View style={styles.imageSun} /><View style={styles.imageMountain} /></View>
      </View>
      <Text style={styles.evidenceIndex}>EVIDENCE {index}</Text>
      <Text style={styles.evidenceLabel}>{label}</Text>
      <Text style={styles.localOnly}>LOCAL PREVIEW</Text>
    </View>
  );
}

export function AuditCard({ item, onPress }: { item: AuditEntryPreview; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.auditCard, pressed && styles.pressed]}>
      <View style={[styles.auditDot, item.tone === 'warning' && styles.auditWarning, item.tone === 'danger' && styles.auditDanger, item.tone === 'positive' && styles.auditPositive]} />
      <View style={styles.auditCopy}>
        <Text style={styles.auditAction}>{item.action}</Text>
        <Text style={styles.auditSubject}>{item.subject}</Text>
        <Text style={styles.auditMeta}>{item.adminName} · {item.occurredAt}</Text>
      </View>
      <Text style={styles.auditCase}>{item.caseId}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headingBlock: { marginBottom: spacing.lg },
  eyebrow: { color: '#2E7552', fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heading: { color: colors.text, fontFamily: typography.family, fontSize: 27, fontWeight: '900', letterSpacing: -0.5, lineHeight: 33, marginTop: spacing.xs },
  headingBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  statCard: { backgroundColor: colors.surface, borderRadius: radius.card, flex: 1, minHeight: 84, padding: spacing.sm },
  statWarning: { backgroundColor: colors.warningSurface },
  statDanger: { backgroundColor: colors.restrictedSurface },
  statPositive: { backgroundColor: colors.primaryPale },
  statValue: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', lineHeight: 12, marginTop: 4 },
  textWarning: { color: colors.warning },
  textDanger: { color: colors.restricted },
  textPositive: { color: colors.primary },
  priorityPill: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  priorityUrgent: { backgroundColor: colors.restrictedSurface },
  priorityHigh: { backgroundColor: colors.warningSurface },
  priorityText: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 8, fontWeight: '900' },
  priorityTextUrgent: { color: colors.restricted },
  priorityTextHigh: { color: colors.warning },
  statusPill: { alignSelf: 'flex-start', backgroundColor: '#EFF7FC', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  statusPositive: { backgroundColor: colors.primaryPale },
  statusDanger: { backgroundColor: colors.restrictedSurface },
  statusWarning: { backgroundColor: colors.warningSurface },
  statusText: { color: '#33799E', fontFamily: typography.family, fontSize: 8, fontWeight: '900' },
  statusTextPositive: { color: colors.primary },
  statusTextDanger: { color: colors.restricted },
  statusTextWarning: { color: colors.warning },
  queueCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: 6, padding: spacing.md },
  queueTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  queueAge: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  queueTitle: { color: colors.text, fontFamily: typography.family, fontSize: 15, fontWeight: '900' },
  queueSubtitle: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15 },
  queueBottom: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  viewAction: { color: '#2E7552', fontFamily: typography.family, fontSize: 9, fontWeight: '900' },
  detailCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  detailRow: { gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  detailRowBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  detailLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  detailValue: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  evidenceCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, flex: 1, padding: spacing.sm },
  evidenceVisual: { alignItems: 'center', height: 82, justifyContent: 'center' },
  imageFrame: { borderColor: colors.textMuted, borderRadius: 4, borderWidth: 2, height: 42, overflow: 'hidden', position: 'relative', width: 52 },
  imageSun: { backgroundColor: colors.textMuted, borderRadius: 5, height: 9, left: 8, position: 'absolute', top: 7, width: 9 },
  imageMountain: { borderBottomColor: colors.textMuted, borderBottomWidth: 23, borderLeftColor: 'transparent', borderLeftWidth: 22, borderRightColor: 'transparent', borderRightWidth: 22, bottom: 0, height: 0, left: 3, position: 'absolute', width: 0 },
  evidenceIndex: { color: colors.restricted, fontFamily: typography.family, fontSize: 8, fontWeight: '900' },
  evidenceLabel: { color: colors.text, fontFamily: typography.family, fontSize: 10, fontWeight: '800', marginTop: 3, textAlign: 'center' },
  localOnly: { color: colors.textMuted, fontFamily: typography.family, fontSize: 7, marginTop: 4 },
  auditCard: { alignItems: 'flex-start', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  auditDot: { backgroundColor: colors.textMuted, borderRadius: 6, height: 12, marginTop: 3, width: 12 },
  auditWarning: { backgroundColor: colors.warning },
  auditDanger: { backgroundColor: colors.restricted },
  auditPositive: { backgroundColor: colors.primary },
  auditCopy: { flex: 1 },
  auditAction: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  auditSubject: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 3 },
  auditMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, marginTop: 5 },
  auditCase: { color: '#2E7552', fontFamily: typography.family, fontSize: 8, fontWeight: '800', maxWidth: 90, textAlign: 'right' },
  pressed: { opacity: 0.72 },
});
