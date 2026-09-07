import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReferenceImageCrop } from '../../../shared/components/ReferenceImageCrop';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type {
  MaintenancePriority,
  MaintenanceRequestPreview,
  MaintenanceStatus,
} from '../models/MaintenanceRequest';

const listingReference = require('../../../assets/property-listing/listing-detail-reference.png');

const statusTone: Record<MaintenanceStatus, 'neutral' | 'positive' | 'warning' | 'danger'> = {
  Submitted: 'neutral',
  Acknowledged: 'positive',
  'More information needed': 'warning',
  Scheduled: 'positive',
  'In progress': 'warning',
  'Awaiting tenant confirmation': 'warning',
  Resolved: 'positive',
  Reopened: 'warning',
  Rejected: 'danger',
  Disputed: 'danger',
};

const priorityColors: Record<MaintenancePriority, string> = {
  Low: '#78909C',
  Medium: '#E39B17',
  High: '#E56A2C',
  Emergency: colors.restricted,
};

export function MaintenanceStatusPill({ status }: { status: MaintenanceStatus }) {
  const tone = statusTone[status];
  return (
    <View style={[
      styles.statusPill,
      tone === 'positive' && styles.statusPositive,
      tone === 'warning' && styles.statusWarning,
      tone === 'danger' && styles.statusDanger,
    ]}>
      <Text style={[
        styles.statusText,
        tone === 'positive' && styles.statusTextPositive,
        tone === 'warning' && styles.statusTextWarning,
        tone === 'danger' && styles.statusTextDanger,
      ]}>{status}</Text>
    </View>
  );
}

export function PriorityPill({ priority }: { priority: MaintenancePriority }) {
  return (
    <View style={[styles.priorityPill, { borderColor: priorityColors[priority] }]}>
      <View style={[styles.priorityDot, { backgroundColor: priorityColors[priority] }]} />
      <Text style={[styles.priorityText, { color: priorityColors[priority] }]}>{priority}</Text>
    </View>
  );
}

export function MaintenancePropertyCard() {
  return (
    <View style={styles.propertyCard}>
      <View style={styles.propertyImage}>
        <ReferenceImageCrop
          borderRadius={radius.sm}
          crop={{ x: 2, y: 25, width: 225, height: 105 }}
          source={listingReference}
          sourceHeight={499}
          sourceWidth={372}
        />
      </View>
      <View style={styles.propertyCopy}>
        <Text numberOfLines={2} style={styles.propertyTitle}>2-Bedroom House with Balcony</Text>
        <Text style={styles.propertyAddress}>Imus City, Cavite</Text>
        <Text style={styles.unitCode}>UNIT UC-06</Text>
      </View>
    </View>
  );
}

export function MaintenanceRequestCard({
  request,
  onPress,
}: {
  request: MaintenanceRequestPreview;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.requestCard, pressed && styles.pressed]}
    >
      <View style={styles.cardTopRow}>
        <PriorityPill priority={request.priority} />
        <Text style={styles.updatedAt}>{request.updatedAt}</Text>
      </View>
      <Text style={styles.requestTitle}>{request.title}</Text>
      <Text numberOfLines={1} style={styles.requestProperty}>{request.propertyTitle} · {request.unitCode}</Text>
      <Text numberOfLines={2} style={styles.requestDescription}>{request.description}</Text>
      <View style={styles.cardBottomRow}>
        <MaintenanceStatusPill status={request.status} />
        <Text style={styles.viewLabel}>View details</Text>
      </View>
    </Pressable>
  );
}

export function MaintenanceDetailCard({
  request,
  children,
}: PropsWithChildren<{ request: MaintenanceRequestPreview }>) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.cardTopRow}>
        <PriorityPill priority={request.priority} />
        <MaintenanceStatusPill status={request.status} />
      </View>
      <Text style={styles.detailTitle}>{request.title}</Text>
      <Text style={styles.detailDescription}>{request.description}</Text>
      <View style={styles.divider} />
      <View style={styles.metadataGrid}>
        <View style={styles.metadataItem}><Text style={styles.metadataLabel}>REQUEST ID</Text><Text style={styles.metadataValue}>{request.id}</Text></View>
        <View style={styles.metadataItem}><Text style={styles.metadataLabel}>TENANT</Text><Text style={styles.metadataValue}>{request.tenantName}</Text></View>
        <View style={styles.metadataItem}><Text style={styles.metadataLabel}>PHOTOS</Text><Text style={styles.metadataValue}>{request.photoCount} attached</Text></View>
        <View style={styles.metadataItem}><Text style={styles.metadataLabel}>SUBMITTED</Text><Text style={styles.metadataValue}>{request.createdAt}</Text></View>
      </View>
      {children}
    </View>
  );
}

export function MaintenanceTimeline({ activeStep }: { activeStep: number }) {
  const steps = ['Submitted', 'Acknowledged', 'Scheduled', 'In progress', 'Resolved'];
  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => {
        const complete = index <= activeStep;
        return (
          <View key={step} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, complete && styles.timelineDotActive]} />
              {index < steps.length - 1 ? <View style={[styles.timelineLine, index < activeStep && styles.timelineLineActive]} /> : null}
            </View>
            <Text style={[styles.timelineLabel, complete && styles.timelineLabelActive]}>{step}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function MaintenanceAction({
  label,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'primary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        tone === 'primary' && styles.actionPrimary,
        tone === 'danger' && styles.actionDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[
        styles.actionLabel,
        tone === 'primary' && styles.actionLabelPrimary,
        tone === 'danger' && styles.actionLabelDanger,
      ]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statusPill: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  statusPositive: { backgroundColor: colors.primaryPale },
  statusWarning: { backgroundColor: colors.warningSurface },
  statusDanger: { backgroundColor: colors.restrictedSurface },
  statusText: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, fontWeight: '800' },
  statusTextPositive: { color: colors.primary },
  statusTextWarning: { color: colors.warning },
  statusTextDanger: { color: colors.restricted },
  priorityPill: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  priorityDot: { borderRadius: 4, height: 7, width: 7 },
  priorityText: { fontFamily: typography.family, fontSize: 9, fontWeight: '900' },
  propertyCard: { backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: 'row', gap: spacing.sm, overflow: 'hidden', padding: spacing.xs },
  propertyImage: { flexBasis: 108, maxWidth: 112, minWidth: 100 },
  propertyCopy: { flex: 1, justifyContent: 'center', paddingRight: spacing.xs },
  propertyTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800', lineHeight: 17 },
  propertyAddress: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 3 },
  unitCode: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900', marginTop: 5 },
  requestCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  cardTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  updatedAt: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  requestTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '900', marginTop: 2 },
  requestProperty: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  requestDescription: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16 },
  cardBottomRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  viewLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  detailCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  detailTitle: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '900', lineHeight: 27 },
  detailDescription: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19 },
  divider: { backgroundColor: colors.border, height: 1 },
  metadataGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  metadataItem: { flexBasis: '50%', paddingRight: spacing.xs },
  metadataLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  metadataValue: { color: colors.text, fontFamily: typography.family, fontSize: 10, lineHeight: 14, marginTop: 3 },
  timeline: { marginTop: spacing.md },
  timelineRow: { flexDirection: 'row', minHeight: 44 },
  timelineRail: { alignItems: 'center', marginRight: spacing.sm, width: 18 },
  timelineDot: { backgroundColor: colors.surfaceStrong, borderRadius: 7, height: 14, width: 14 },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineLine: { backgroundColor: colors.surfaceStrong, flex: 1, width: 2 },
  timelineLineActive: { backgroundColor: colors.primarySoft },
  timelineLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 12, paddingTop: 0 },
  timelineLabelActive: { color: colors.text, fontWeight: '800' },
  action: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionDanger: { backgroundColor: colors.restrictedSurface, borderColor: '#EBC2C2' },
  actionLabel: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  actionLabelPrimary: { color: colors.white },
  actionLabelDanger: { color: colors.restricted },
  pressed: { opacity: 0.72 },
});
