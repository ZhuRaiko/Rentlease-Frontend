import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type {
  PublishedReview,
  ReportDraft,
  ReportStatus,
  ReviewSubject,
} from '../models/RatingsReports';

export function FlowHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.headingBlock}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      <Text style={styles.headingBody}>{body}</Text>
    </View>
  );
}

export function PersonCard({ subject }: { subject: ReviewSubject }) {
  const initials = subject.name.split(' ').map((part) => part[0]).join('').slice(0, 2);
  return (
    <View style={styles.personCard}>
      <View style={styles.avatar}><Text style={styles.avatarLabel}>{initials}</Text></View>
      <View style={styles.personCopy}>
        <Text style={styles.personName}>{subject.name}</Text>
        <Text style={styles.personRole}>{subject.role}</Text>
        <Text style={styles.personContext}>{subject.context}</Text>
      </View>
    </View>
  );
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  compact = false,
}: {
  value: number;
  onChange?: ((rating: number) => void) | undefined;
  readonly?: boolean;
  compact?: boolean;
}) {
  return (
    <View accessibilityLabel={`${value} out of 5 stars`} style={styles.stars}>
      {[1, 2, 3, 4, 5].map((rating) => (
        <Pressable
          accessibilityLabel={`${rating} stars`}
          accessibilityRole="button"
          disabled={readonly}
          key={rating}
          onPress={() => onChange?.(rating)}
          style={styles.starButton}
        >
          <Text style={[
            styles.star,
            compact && styles.starCompact,
            rating <= value ? styles.starFilled : styles.starEmpty,
          ]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SelectionCard({
  title,
  body,
  meta,
  onPress,
  tone = 'primary',
}: {
  title: string;
  body: string;
  meta?: string | undefined;
  onPress: () => void;
  tone?: 'primary' | 'danger' | 'blue';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectionCard,
        tone === 'danger' && styles.selectionDanger,
        tone === 'blue' && styles.selectionBlue,
        pressed && styles.pressed,
      ]}
    >
      <View style={[
        styles.selectionMark,
        tone === 'danger' && styles.selectionMarkDanger,
        tone === 'blue' && styles.selectionMarkBlue,
      ]}>
        <View style={styles.markLine} />
        <View style={[styles.markLine, styles.markLineShort]} />
      </View>
      <View style={styles.selectionCopy}>
        <Text style={styles.selectionTitle}>{title}</Text>
        <Text style={styles.selectionBody}>{body}</Text>
        {meta ? <Text style={styles.selectionMeta}>{meta}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function ReviewCard({ review }: { review: PublishedReview }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View>
          <Text style={styles.reviewAuthor}>{review.authorName}</Text>
          <Text style={styles.reviewMeta}>{review.authorRole} · {review.publishedAt}</Text>
        </View>
        <StarRating compact readonly value={review.rating} />
      </View>
      <Text style={styles.reviewText}>{review.text}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: ReportStatus }) {
  const danger = status === 'Dismissed';
  const warning = status === 'More information requested';
  return (
    <View style={[styles.statusPill, danger && styles.statusDanger, warning && styles.statusWarning]}>
      <Text style={[styles.statusText, danger && styles.statusTextDanger, warning && styles.statusTextWarning]}>{status}</Text>
    </View>
  );
}

export function ReportSummaryCard({
  report,
  children,
}: PropsWithChildren<{ report: ReportDraft }>) {
  return (
    <View style={styles.reportCard}>
      <Text style={styles.summaryLabel}>REPORTING</Text>
      <Text style={styles.summaryValue}>{report.targetName}</Text>
      <Text style={styles.summaryType}>{report.targetType.toUpperCase()}</Text>
      <View style={styles.divider} />
      <Text style={styles.summaryLabel}>REASON</Text>
      <Text style={styles.summaryValue}>{report.reason || 'Not selected'}</Text>
      {report.details ? <Text style={styles.summaryBody}>{report.details}</Text> : null}
      <Text style={styles.evidenceText}>{report.evidenceCount} evidence item{report.evidenceCount === 1 ? '' : 's'} attached</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  headingBlock: { marginBottom: spacing.lg },
  eyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heading: { color: colors.text, fontFamily: typography.family, fontSize: 27, fontWeight: '900', letterSpacing: -0.5, lineHeight: 33, marginTop: spacing.xs },
  headingBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  personCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  avatar: { alignItems: 'center', backgroundColor: '#DDA83E', borderRadius: 25, height: 50, justifyContent: 'center', width: 50 },
  avatarLabel: { color: colors.white, fontFamily: typography.family, fontSize: 15, fontWeight: '900' },
  personCopy: { flex: 1 },
  personName: { color: colors.text, fontFamily: typography.family, fontSize: 15, fontWeight: '900' },
  personRole: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '800', marginTop: 2 },
  personContext: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 14, marginTop: 4 },
  stars: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  starButton: { paddingHorizontal: 2, paddingVertical: 4 },
  star: { fontFamily: typography.family, fontSize: 42, lineHeight: 50 },
  starCompact: { fontSize: 14, lineHeight: 18 },
  starFilled: { color: '#F0A927' },
  starEmpty: { color: colors.surfaceStrong },
  selectionCard: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 94, padding: spacing.md },
  selectionDanger: { backgroundColor: colors.restrictedSurface, borderColor: '#E8C4C4' },
  selectionBlue: { backgroundColor: '#EFF7FC', borderColor: '#C6E2F3' },
  selectionMark: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.sm, height: 42, justifyContent: 'center', width: 42 },
  selectionMarkDanger: { backgroundColor: colors.restricted },
  selectionMarkBlue: { backgroundColor: colors.reviewBlue },
  markLine: { backgroundColor: colors.white, borderRadius: 2, height: 3, marginVertical: 2, width: 20 },
  markLineShort: { width: 13 },
  selectionCopy: { flex: 1 },
  selectionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '900' },
  selectionBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, marginTop: 3 },
  selectionMeta: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '800', marginTop: 5 },
  chevron: { color: colors.textMuted, fontFamily: typography.family, fontSize: 28 },
  reviewCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  reviewHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  reviewAuthor: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  reviewMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, marginTop: 2 },
  reviewText: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18 },
  statusPill: { alignSelf: 'flex-start', backgroundColor: colors.primaryPale, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  statusDanger: { backgroundColor: colors.restrictedSurface },
  statusWarning: { backgroundColor: colors.warningSurface },
  statusText: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  statusTextDanger: { color: colors.restricted },
  statusTextWarning: { color: colors.warning },
  reportCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: 5, padding: spacing.md },
  summaryLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  summaryValue: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  summaryType: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900' },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.sm },
  summaryBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 17, marginTop: 3 },
  evidenceText: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, marginTop: spacing.sm },
  pressed: { opacity: 0.72 },
});
