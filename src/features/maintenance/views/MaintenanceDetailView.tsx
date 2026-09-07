import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  MaintenanceAction,
  MaintenanceDetailCard,
  MaintenancePropertyCard,
  MaintenanceTimeline,
} from '../components/MaintenanceCards';
import { MaintenanceScaffold } from '../components/MaintenanceScaffold';
import { maintenanceDates, maintenanceTimes } from '../models/MaintenanceRequest';
import type { MaintenanceRequestsViewModel } from '../viewModels/useMaintenanceRequestsViewModel';

function DetailHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <View style={styles.headingBlock}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

function OutcomeGraphic({ tone }: { tone: 'success' | 'warning' | 'danger' }) {
  return (
    <View style={[
      styles.outcomeGraphic,
      tone === 'warning' && styles.outcomeWarning,
      tone === 'danger' && styles.outcomeDanger,
    ]}>
      {tone === 'success' ? (
        <><View style={styles.checkShort} /><View style={styles.checkLong} /></>
      ) : tone === 'warning' ? (
        <><View style={styles.clockHandOne} /><View style={styles.clockHandTwo} /></>
      ) : (
        <><View style={[styles.crossLine, styles.crossOne]} /><View style={[styles.crossLine, styles.crossTwo]} /></>
      )}
    </View>
  );
}

export function MaintenanceDetailView({ viewModel }: { viewModel: MaintenanceRequestsViewModel }) {
  const request = viewModel.selectedRequest;
  if (!request) return null;

  if (viewModel.screen === 'requestDetails') {
    return (
      <MaintenanceScaffold onBack={viewModel.openRequests} title="Request details">
        <MaintenancePropertyCard />
        <View style={styles.sectionGap} />
        <MaintenanceDetailCard request={request} />
        <View style={styles.actionRow}>
          <MaintenanceAction label="Track status" onPress={() => viewModel.navigate('submittedStatus')} tone="primary" />
          <MaintenanceAction label="Landlord preview" onPress={() => viewModel.navigate('landlordDetails')} />
        </View>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'submittedStatus') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Request status">
        <DetailHeading
          body="Updates from the landlord and repair schedule will appear in this timeline."
          eyebrow="SUBMITTED"
          title="Your request is waiting for review"
        />
        {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
        <MaintenanceDetailCard request={request}>
          <MaintenanceTimeline activeStep={request.status === 'Acknowledged' ? 1 : 0} />
        </MaintenanceDetailCard>
        <View style={styles.actionRow}>
          <MaintenanceAction label="Preview landlord review" onPress={() => viewModel.navigate('landlordDetails')} />
          <MaintenanceAction label="Preview info request" onPress={() => viewModel.navigate('tenantAddInfo')} />
        </View>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'landlordDetails') {
    return (
      <MaintenanceScaffold onBack={viewModel.openRequests} subtitle={request.tenantName} title="Landlord request details">
        <DetailHeading
          body="Review the tenant report before acknowledging, requesting details, scheduling work, or rejecting it."
          eyebrow="TENANT REQUEST"
          title={request.title}
        />
        <MaintenancePropertyCard />
        <View style={styles.sectionGap} />
        <MaintenanceDetailCard request={request} />
        <View style={styles.actionRow}>
          <MaintenanceAction label="Acknowledge" onPress={viewModel.acknowledge} tone="primary" />
          <MaintenanceAction label="More information" onPress={() => viewModel.navigate('requestMoreInfo')} />
        </View>
        <View style={styles.actionRow}>
          <MaintenanceAction label="Schedule repair" onPress={() => viewModel.navigate('scheduleRepair')} />
          <MaintenanceAction label="Reject request" onPress={() => viewModel.navigate('landlordReject')} tone="danger" />
        </View>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'acknowledge') {
    return (
      <MaintenanceScaffold onBack={viewModel.openRequests} title="Request acknowledged">
        <View style={styles.outcomeState}>
          <OutcomeGraphic tone="success" />
          <Text style={styles.outcomeEyebrow}>ACKNOWLEDGED</Text>
          <Text accessibilityRole="header" style={styles.outcomeTitle}>The tenant knows you are reviewing the issue</Text>
          <Text style={styles.outcomeBody}>Continue by arranging an inspection or repair schedule.</Text>
          <MaintenanceDetailCard request={request} />
          <AppButton label="Schedule inspection or repair" onPress={() => viewModel.navigate('scheduleRepair')} />
          <AppButton label="Request more information" onPress={() => viewModel.navigate('requestMoreInfo')} variant="secondary" />
        </View>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'requestMoreInfo') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Request more information">
        <DetailHeading
          body="Ask for specific details that will help assess the repair."
          eyebrow="LANDLORD RESPONSE"
          title="What else do you need from the tenant?"
        />
        <Text style={styles.inputLabel}>QUESTION OR REQUEST</Text>
        <TextInput
          accessibilityLabel="Information request"
          multiline
          onChangeText={viewModel.setMoreInformation}
          placeholder="Example: Please share a wider photo showing the pipe connection."
          placeholderTextColor={colors.textMuted}
          style={styles.largeInput}
          textAlignVertical="top"
          value={viewModel.moreInformation}
        />
        <Pressable onPress={() => viewModel.setMoreInformation('Please share a wider photo of the pipe connection and confirm whether the water can be shut off.')} style={styles.previewFill}>
          <Text style={styles.previewFillLabel}>Use preview question</Text>
        </Pressable>
        <AppButton disabled={!viewModel.moreInformation.trim()} label="Send information request" onPress={viewModel.requestInformation} />
        <Text style={styles.previewNote}>No notification or backend update will be sent.</Text>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'tenantAddInfo') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Add information">
        <DetailHeading
          body={viewModel.moreInformation || 'The landlord requested a wider photo and confirmation about the water shutoff.'}
          eyebrow="LANDLORD ASKED"
          title="Help clarify the maintenance issue"
        />
        <Text style={styles.inputLabel}>YOUR RESPONSE</Text>
        <TextInput
          accessibilityLabel="Additional maintenance information"
          multiline
          onChangeText={viewModel.setMoreInformation}
          placeholder="Add the requested details"
          placeholderTextColor={colors.textMuted}
          style={styles.largeInput}
          textAlignVertical="top"
          value={viewModel.moreInformation}
        />
        <View style={styles.localPhotoCard}>
          <View style={styles.localPhotoIcon}><View style={styles.photoMountain} /></View>
          <View style={styles.localPhotoCopy}><Text style={styles.localPhotoTitle}>Additional photo preview</Text><Text style={styles.localPhotoMeta}>Not uploaded · frontend only</Text></View>
        </View>
        <AppButton label="Submit additional information" onPress={viewModel.submitAdditionalInformation} />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'scheduleRepair') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Schedule maintenance">
        <DetailHeading
          body="Choose an inspection or repair window and share who will attend."
          eyebrow="LANDLORD SCHEDULE"
          title="When will the work happen?"
        />
        <Text style={styles.inputLabel}>DATE</Text>
        <View style={styles.optionWrap}>
          {maintenanceDates.map((date) => {
            const selected = viewModel.schedule.date === date;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={date} onPress={() => viewModel.setSchedule({ ...viewModel.schedule, date })} style={[styles.option, selected && styles.optionSelected]}><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{date}</Text></Pressable>;
          })}
        </View>
        <Text style={styles.inputLabel}>TIME</Text>
        <View style={styles.timeWrap}>
          {maintenanceTimes.map((time) => {
            const selected = viewModel.schedule.time === time;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={time} onPress={() => viewModel.setSchedule({ ...viewModel.schedule, time })} style={[styles.timeOption, selected && styles.optionSelected]}><Text style={[styles.timeText, selected && styles.optionTextSelected]}>{time}</Text></Pressable>;
          })}
        </View>
        <Text style={styles.inputLabel}>REPAIR CONTACT</Text>
        <TextInput accessibilityLabel="Repair contact" onChangeText={(contact) => viewModel.setSchedule({ ...viewModel.schedule, contact })} style={styles.textInput} value={viewModel.schedule.contact} />
        <Text style={styles.inputLabel}>SCHEDULE NOTE</Text>
        <TextInput accessibilityLabel="Schedule note" multiline onChangeText={(note) => viewModel.setSchedule({ ...viewModel.schedule, note })} style={[styles.textInput, styles.noteInput]} textAlignVertical="top" value={viewModel.schedule.note} />
        <AppButton label="Confirm maintenance schedule" onPress={viewModel.scheduleRepair} />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'scheduled') {
    return (
      <MaintenanceScaffold onBack={viewModel.openRequests} title="Scheduled maintenance">
        <DetailHeading body="The inspection or repair window is ready for both participants." eyebrow="SCHEDULED" title="Repair visit confirmed" />
        <View style={styles.scheduleCard}>
          <Text style={styles.scheduleDate}>{viewModel.schedule.date}</Text>
          <Text style={styles.scheduleTime}>{viewModel.schedule.time}</Text>
          <View style={styles.divider} />
          <Text style={styles.scheduleContact}>{viewModel.schedule.contact}</Text>
          <Text style={styles.scheduleNote}>{viewModel.schedule.note}</Text>
        </View>
        <MaintenanceDetailCard request={request}><MaintenanceTimeline activeStep={2} /></MaintenanceDetailCard>
        <AppButton label="Mark work in progress" onPress={viewModel.startWork} />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'inProgress') {
    return (
      <MaintenanceScaffold onBack={viewModel.openRequests} title="Maintenance in progress">
        <DetailHeading body="The tenant can see that inspection or repair work has started." eyebrow="WORK STARTED" title="Repair is in progress" />
        <MaintenanceDetailCard request={request}><MaintenanceTimeline activeStep={3} /></MaintenanceDetailCard>
        <View style={styles.workCard}><Text style={styles.workTitle}>{viewModel.schedule.contact}</Text><Text style={styles.workBody}>Started today · {viewModel.schedule.time}{`\n`}Scheduled work: {viewModel.schedule.note}</Text></View>
        <AppButton label="Mark as resolved" onPress={() => viewModel.navigate('markResolved')} />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'markResolved') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Resolve request">
        <DetailHeading body="Explain what was repaired. The tenant will be asked to confirm the resolution." eyebrow="LANDLORD UPDATE" title="Mark this request as resolved?" />
        <Text style={styles.inputLabel}>RESOLUTION NOTE</Text>
        <TextInput accessibilityLabel="Resolution note" multiline onChangeText={viewModel.setResolutionNote} style={styles.largeInput} textAlignVertical="top" value={viewModel.resolutionNote} />
        <AppButton label="Send for tenant confirmation" onPress={viewModel.markResolved} />
        <AppButton label="Keep in progress" onPress={viewModel.goBack} variant="secondary" />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'resolutionPending') {
    return (
      <MaintenanceScaffold onBack={viewModel.openRequests} title="Confirm resolution">
        <DetailHeading body="The landlord marked the repair complete. Check the issue before closing the request." eyebrow="TENANT CONFIRMATION" title="Was the issue resolved?" />
        <MaintenanceDetailCard request={request} />
        <View style={styles.resolutionCard}><Text style={styles.resolutionLabel}>LANDLORD RESOLUTION NOTE</Text><Text style={styles.resolutionText}>{viewModel.resolutionNote}</Text></View>
        <View style={styles.actionRow}>
          <MaintenanceAction label="Confirm resolved" onPress={viewModel.confirmResolution} tone="primary" />
          <MaintenanceAction label="Reopen request" onPress={viewModel.reopenRequest} tone="danger" />
        </View>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'confirmResolution') {
    return (
      <MaintenanceScaffold onBack={viewModel.openRequests} title="Maintenance resolved">
        <View style={styles.outcomeState}>
          <OutcomeGraphic tone="success" />
          <Text style={styles.outcomeEyebrow}>RESOLVED</Text>
          <Text accessibilityRole="header" style={styles.outcomeTitle}>The maintenance request is complete</Text>
          <Text style={styles.outcomeBody}>The resolution has been confirmed in this local frontend preview.</Text>
          <MaintenanceDetailCard request={request}><MaintenanceTimeline activeStep={4} /></MaintenanceDetailCard>
          <AppButton label="Return to maintenance" onPress={viewModel.openRequests} />
        </View>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'reopen') {
    return (
      <MaintenanceScaffold onBack={viewModel.openRequests} title="Request reopened">
        <View style={styles.outcomeState}>
          <OutcomeGraphic tone="warning" />
          <Text style={styles.outcomeEyebrow}>REOPENED</Text>
          <Text accessibilityRole="header" style={styles.outcomeTitle}>The issue still needs attention</Text>
          <TextInput accessibilityLabel="Reason for reopening" multiline onChangeText={viewModel.setReopenReason} style={styles.largeInput} textAlignVertical="top" value={viewModel.reopenReason} />
          <Text style={styles.outcomeBody}>The landlord would normally receive this update. No notification was sent.</Text>
          <AppButton label="Return to request" onPress={() => viewModel.replace('requestDetails')} />
        </View>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'landlordReject') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Reject request">
        <View style={styles.outcomeState}>
          <OutcomeGraphic tone="danger" />
          <Text style={[styles.outcomeEyebrow, styles.dangerText]}>REVIEW REQUIRED</Text>
          <Text accessibilityRole="header" style={styles.outcomeTitle}>Reject this maintenance request?</Text>
          <Text style={styles.outcomeBody}>A clear reason is required so the tenant can accept the decision or submit a dispute.</Text>
          <MaintenanceDetailCard request={request} />
          <AppButton label="Continue to rejection reason" onPress={() => viewModel.navigate('rejectionReason')} variant="danger" />
          <AppButton label="Go back" onPress={viewModel.goBack} variant="secondary" />
        </View>
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'rejectionReason') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Rejection reason">
        <DetailHeading body="Describe why the request is not accepted and what evidence was considered." eyebrow="LANDLORD DECISION" title="Explain the rejection" />
        <Text style={styles.inputLabel}>REASON</Text>
        <TextInput accessibilityLabel="Rejection reason" multiline onChangeText={viewModel.setRejectionReason} style={styles.largeInput} textAlignVertical="top" value={viewModel.rejectionReason} />
        <AppButton disabled={!viewModel.rejectionReason.trim()} label="Reject request" onPress={viewModel.rejectRequest} variant="danger" />
      </MaintenanceScaffold>
    );
  }

  return (
    <MaintenanceScaffold onBack={viewModel.openRequests} title="Rejection response">
      <DetailHeading body="Review the landlord's reason before accepting the decision or raising a dispute." eyebrow="TENANT RESPONSE" title="Maintenance request rejected" />
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <View style={styles.rejectionCard}><Text style={styles.rejectionLabel}>LANDLORD REASON</Text><Text style={styles.rejectionText}>{viewModel.rejectionReason}</Text></View>
      <Text style={styles.inputLabel}>DISPUTE DETAILS</Text>
      <TextInput accessibilityLabel="Dispute details" multiline onChangeText={viewModel.setDisputeText} style={styles.largeInput} textAlignVertical="top" value={viewModel.disputeText} />
      <View style={styles.actionRow}>
        <MaintenanceAction label="Accept rejection" onPress={viewModel.acceptRejection} />
        <MaintenanceAction label="Submit dispute" onPress={viewModel.disputeRejection} tone="danger" />
      </View>
      <Text style={styles.previewNote}>This decision remains in local frontend state.</Text>
    </MaintenanceScaffold>
  );
}

const styles = StyleSheet.create({
  headingBlock: { marginBottom: spacing.lg },
  eyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34, marginTop: spacing.xs },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  sectionGap: { height: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginBottom: spacing.md, padding: spacing.sm },
  outcomeState: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.lg },
  outcomeGraphic: { backgroundColor: colors.primaryPale, borderRadius: 52, height: 104, position: 'relative', width: 104 },
  outcomeWarning: { backgroundColor: colors.warningSurface, borderColor: colors.warning, borderWidth: 3 },
  outcomeDanger: { backgroundColor: colors.restrictedSurface },
  checkShort: { backgroundColor: colors.primary, height: 5, left: 24, position: 'absolute', top: 55, transform: [{ rotate: '45deg' }], width: 25 },
  checkLong: { backgroundColor: colors.primary, height: 5, left: 41, position: 'absolute', top: 48, transform: [{ rotate: '-45deg' }], width: 45 },
  clockHandOne: { backgroundColor: colors.warning, height: 29, left: 49, position: 'absolute', top: 23, width: 4 },
  clockHandTwo: { backgroundColor: colors.warning, height: 4, left: 50, position: 'absolute', top: 49, transform: [{ rotate: '35deg' }], width: 23 },
  crossLine: { backgroundColor: colors.restricted, height: 5, left: 27, position: 'absolute', top: 50, width: 50 },
  crossOne: { transform: [{ rotate: '45deg' }] },
  crossTwo: { transform: [{ rotate: '-45deg' }] },
  outcomeEyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  dangerText: { color: colors.restricted },
  outcomeTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', lineHeight: 30, maxWidth: 350, textAlign: 'center' },
  outcomeBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, maxWidth: 330, textAlign: 'center' },
  inputLabel: { alignSelf: 'stretch', color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs },
  largeInput: { alignSelf: 'stretch', borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 13, lineHeight: 19, minHeight: 130, padding: spacing.md },
  textInput: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 13, marginBottom: spacing.md, minHeight: 50, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  noteInput: { minHeight: 96 },
  previewFill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primaryPale, borderRadius: radius.pill, marginBottom: spacing.lg, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  previewFillLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  previewNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, marginTop: spacing.sm, textAlign: 'center' },
  localPhotoCard: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.card, flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md, padding: spacing.md },
  localPhotoIcon: { borderColor: colors.primary, borderRadius: 4, borderWidth: 2, height: 38, overflow: 'hidden', position: 'relative', width: 46 },
  photoMountain: { borderBottomColor: colors.primary, borderBottomWidth: 21, borderLeftColor: 'transparent', borderLeftWidth: 20, borderRightColor: 'transparent', borderRightWidth: 20, bottom: 0, height: 0, left: 2, position: 'absolute', width: 0 },
  localPhotoCopy: { flex: 1 },
  localPhotoTitle: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  localPhotoMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, marginTop: 2 },
  optionWrap: { gap: spacing.xs, marginBottom: spacing.md },
  option: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing.md },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  optionTextSelected: { color: colors.white },
  timeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  timeOption: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexBasis: '47%', minHeight: 44, justifyContent: 'center' },
  timeText: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  scheduleCard: { backgroundColor: colors.primaryPale, borderColor: colors.primarySoft, borderRadius: radius.card, borderWidth: 1, gap: spacing.xs, marginBottom: spacing.md, padding: spacing.md },
  scheduleDate: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '900' },
  scheduleTime: { color: colors.primary, fontFamily: typography.family, fontSize: 24, fontWeight: '900' },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.xs },
  scheduleContact: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  scheduleNote: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16 },
  workCard: { backgroundColor: colors.warningSurface, borderRadius: radius.card, gap: spacing.xs, marginVertical: spacing.md, padding: spacing.md },
  workTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  workBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 17 },
  resolutionCard: { backgroundColor: colors.primaryPale, borderRadius: radius.card, gap: spacing.xs, marginTop: spacing.md, padding: spacing.md },
  resolutionLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  resolutionText: { color: colors.text, fontFamily: typography.family, fontSize: 12, lineHeight: 18 },
  rejectionCard: { backgroundColor: colors.restrictedSurface, borderRadius: radius.card, gap: spacing.xs, marginBottom: spacing.md, padding: spacing.md },
  rejectionLabel: { color: colors.restricted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  rejectionText: { color: colors.text, fontFamily: typography.family, fontSize: 12, lineHeight: 18 },
});
