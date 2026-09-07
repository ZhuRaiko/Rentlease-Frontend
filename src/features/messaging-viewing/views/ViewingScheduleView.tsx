import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  InlineAction,
  ListingContextCard,
  ViewingSummaryCard,
} from '../components/MessagingCards';
import { MessagingScaffold } from '../components/MessagingScaffold';
import { viewingDates, viewingTimes, type ViewingStatus } from '../models/MessagingViewing';
import type { MessagingViewingViewModel } from '../viewModels/useMessagingViewingViewModel';

interface ViewingScheduleViewProps {
  viewModel: MessagingViewingViewModel;
}

function ScreenIntroduction({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <View style={styles.introduction}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

function ScheduleStatusScreen({
  viewModel,
  status,
  eyebrow,
  title,
  body,
  children,
}: React.PropsWithChildren<{
  viewModel: MessagingViewingViewModel;
  status: ViewingStatus;
  eyebrow: string;
  title: string;
  body: string;
}>) {
  return (
    <MessagingScaffold onBack={viewModel.openInbox} title="Viewing schedule">
      <ScreenIntroduction body={body} eyebrow={eyebrow} title={title} />
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <ViewingSummaryCard date={viewModel.proposal.date} status={status} time={viewModel.proposal.time}>
        {children}
      </ViewingSummaryCard>
    </MessagingScaffold>
  );
}

export function ViewingScheduleView({ viewModel }: ViewingScheduleViewProps) {
  if (viewModel.screen === 'proposeViewing') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="Propose a viewing">
        <ScreenIntroduction
          body="Choose a date and time to request an in-person tour. The other person can accept, decline, or suggest another schedule."
          eyebrow="VIEWING REQUEST"
          title="See the property in person"
        />
        <ListingContextCard />
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Before you request</Text>
          <Text style={styles.infoLine}>• Confirm who will attend the viewing.</Text>
          <Text style={styles.infoLine}>• Arrange meeting details inside RENTLEASE chat.</Text>
          <Text style={styles.infoLine}>• Never send a reservation payment before verifying the property.</Text>
        </View>
        <AppButton label="Choose a date" onPress={() => viewModel.navigate('selectDate')} />
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'selectDate') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="Select viewing date">
        <ScreenIntroduction
          body="Available presentation dates are shown below."
          eyebrow="SEPTEMBER 2026"
          title="When would you like to visit?"
        />
        <View style={styles.dateGrid}>
          {viewingDates.map((date) => {
            const selected = viewModel.proposal.date === date.full;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={date.full}
                onPress={() => viewModel.selectDate(date.full)}
                style={({ pressed }) => [styles.dateOption, selected && styles.optionSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.weekday, selected && styles.optionLabelSelected]}>{date.weekday}</Text>
                <Text style={[styles.day, selected && styles.optionLabelSelected]}>{date.day}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.selectionSummary}>
          <Text style={styles.selectionLabel}>SELECTED DATE</Text>
          <Text style={styles.selectionValue}>{viewModel.proposal.date}</Text>
        </View>
        <AppButton label="Continue to time" onPress={() => viewModel.navigate('selectTime')} />
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'selectTime') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="Select viewing time">
        <ScreenIntroduction
          body={viewModel.proposal.date}
          eyebrow="AVAILABLE TIMES"
          title="What time works best?"
        />
        <View style={styles.timeGrid}>
          {viewingTimes.map((time) => {
            const selected = viewModel.proposal.time === time;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={time}
                onPress={() => viewModel.selectTime(time)}
                style={({ pressed }) => [styles.timeOption, selected && styles.optionSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.timeLabel, selected && styles.optionLabelSelected]}>{time}</Text>
              </Pressable>
            );
          })}
        </View>
        <AppButton label="Review proposal" onPress={() => viewModel.navigate('reviewProposal')} />
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'reviewProposal') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="Review proposal">
        <ScreenIntroduction
          body="Check the schedule before sending it to the conversation."
          eyebrow="FINAL CHECK"
          title="Ready to propose this viewing?"
        />
        <ViewingSummaryCard date={viewModel.proposal.date} status="draft" time={viewModel.proposal.time} />
        <Text style={styles.inputLabel}>NOTE FOR THE VIEWING</Text>
        <TextInput
          accessibilityLabel="Viewing note"
          multiline
          onChangeText={viewModel.setProposalNote}
          placeholder="Add a short note"
          placeholderTextColor={colors.textMuted}
          style={styles.noteInput}
          textAlignVertical="top"
          value={viewModel.proposal.note}
        />
        <AppButton label="Send viewing proposal" onPress={viewModel.submitProposal} />
        <Text style={styles.previewNote}>The proposal is stored only in local frontend state.</Text>
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'proposalPending') {
    return (
      <ScheduleStatusScreen
        body="The proposal is waiting for a response. For this frontend preview, you can inspect every possible response state."
        eyebrow="REQUEST SENT"
        status="pending"
        title="Viewing proposal pending"
        viewModel={viewModel}
      >
        <View style={styles.actionRow}>
          <InlineAction label="Preview accepted" onPress={viewModel.acceptProposal} tone="primary" />
          <InlineAction label="Preview declined" onPress={viewModel.declineProposal} tone="danger" />
        </View>
        <InlineAction label="Preview counter-proposal" onPress={viewModel.counterProposal} />
      </ScheduleStatusScreen>
    );
  }

  if (viewModel.screen === 'proposalAccepted') {
    return (
      <ScheduleStatusScreen
        body="Both participants now have the same confirmed date and time."
        eyebrow="CONFIRMED"
        status="accepted"
        title="Your viewing was accepted"
        viewModel={viewModel}
      >
        <View style={styles.actionRow}>
          <InlineAction label="Viewing details" onPress={() => viewModel.navigate('viewingDetails')} tone="primary" />
          <InlineAction label="Upcoming view" onPress={() => viewModel.navigate('upcomingViewing')} />
        </View>
      </ScheduleStatusScreen>
    );
  }

  if (viewModel.screen === 'proposalDeclined') {
    return (
      <ScheduleStatusScreen
        body="The selected schedule did not work. You can return to the conversation or propose another time."
        eyebrow="NOT AVAILABLE"
        status="declined"
        title="Viewing proposal declined"
        viewModel={viewModel}
      >
        <View style={styles.actionRow}>
          <InlineAction label="Return to chat" onPress={() => viewModel.replace('conversation')} />
          <InlineAction label="Propose another" onPress={viewModel.beginViewingProposal} tone="primary" />
        </View>
      </ScheduleStatusScreen>
    );
  }

  if (viewModel.screen === 'counterProposal') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="Counter-proposal">
        <ScreenIntroduction
          body="A different viewing time was suggested. Choose an updated time before responding."
          eyebrow="SCHEDULE CHANGE"
          title="Review another time"
        />
        <ViewingSummaryCard date={viewModel.proposal.date} status="countered" time={viewModel.proposal.time} />
        <Text style={styles.inputLabel}>CHOOSE A REPLACEMENT TIME</Text>
        <View style={styles.timeGrid}>
          {viewingTimes.slice(2).map((time) => {
            const selected = viewModel.proposal.time === time;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={time}
                onPress={() => viewModel.selectTime(time)}
                style={[styles.timeOption, selected && styles.optionSelected]}
              >
                <Text style={[styles.timeLabel, selected && styles.optionLabelSelected]}>{time}</Text>
              </Pressable>
            );
          })}
        </View>
        <AppButton label="Send counter-proposal" onPress={viewModel.submitCounterProposal} />
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'viewingDetails') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="Viewing details">
        <ScreenIntroduction
          body="Keep the confirmed property and schedule details together."
          eyebrow="CONFIRMED VIEWING"
          title="Everything for your visit"
        />
        <ViewingSummaryCard date={viewModel.proposal.date} status="accepted" time={viewModel.proposal.time} />
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Meeting note</Text>
          <Text style={styles.infoLine}>{viewModel.proposal.note}</Text>
          <Text style={styles.infoTitle}>Contact</Text>
          <Text style={styles.infoLine}>{viewModel.selectedConversation?.participantName ?? 'Samuel Feliciano'} · RENTLEASE chat</Text>
        </View>
        <View style={styles.actionRow}>
          <InlineAction label="Open conversation" onPress={() => viewModel.replace('conversation')} />
          <InlineAction label="Cancel viewing" onPress={() => viewModel.navigate('cancelViewing')} tone="danger" />
        </View>
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'upcomingViewing') {
    return (
      <ScheduleStatusScreen
        body="Your confirmed appointment is approaching. Use the conversation if either participant needs an update."
        eyebrow="UPCOMING"
        status="accepted"
        title="Property viewing this Sunday"
        viewModel={viewModel}
      >
        <View style={styles.reminderCard}>
          <Text style={styles.reminderTitle}>Viewing reminder</Text>
          <Text style={styles.reminderBody}>Arrive on time and verify the property and landlord before making any payment.</Text>
        </View>
        <View style={styles.actionRow}>
          <InlineAction label="Mark completed" onPress={viewModel.completeViewing} tone="primary" />
          <InlineAction label="Cancel viewing" onPress={() => viewModel.navigate('cancelViewing')} tone="danger" />
        </View>
      </ScheduleStatusScreen>
    );
  }

  if (viewModel.screen === 'cancelViewing') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="Cancel viewing">
        <ScreenIntroduction
          body="The other participant would normally be notified. This preview changes only local frontend state."
          eyebrow="CONFIRM CANCELLATION"
          title="Cancel this property viewing?"
        />
        <ViewingSummaryCard date={viewModel.proposal.date} status="accepted" time={viewModel.proposal.time} />
        <AppButton label="Keep viewing" onPress={viewModel.goBack} />
        <AppButton label="Cancel viewing" onPress={viewModel.cancelViewing} variant="danger" />
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'viewingCancelled') {
    return (
      <ScheduleStatusScreen
        body="This appointment is no longer active. The conversation remains available."
        eyebrow="CANCELLED"
        status="cancelled"
        title="Viewing cancelled"
        viewModel={viewModel}
      >
        <InlineAction label="Return to conversation" onPress={() => viewModel.replace('conversation')} tone="primary" />
      </ScheduleStatusScreen>
    );
  }

  return (
    <ScheduleStatusScreen
      body="The visit has been recorded in the local frontend preview."
      eyebrow="VISIT FINISHED"
      status="completed"
      title="Viewing completed"
      viewModel={viewModel}
    >
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What happens next?</Text>
        <Text style={styles.infoLine}>Continue the conversation if you have questions about rental terms or the application process.</Text>
      </View>
      <InlineAction label="Return to conversation" onPress={() => viewModel.replace('conversation')} tone="primary" />
    </ScheduleStatusScreen>
  );
}

const styles = StyleSheet.create({
  introduction: { marginBottom: spacing.lg },
  eyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, lineHeight: 33, marginTop: spacing.xs },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  infoCard: { backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.xs, marginVertical: spacing.md, padding: spacing.md },
  infoTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800', marginTop: 2 },
  infoLine: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18 },
  dateGrid: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  dateOption: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, minHeight: 86, justifyContent: 'center' },
  weekday: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  day: { color: colors.text, fontFamily: typography.family, fontSize: 23, fontWeight: '900', marginTop: 4 },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionLabelSelected: { color: colors.white },
  selectionSummary: { backgroundColor: colors.primaryPale, borderRadius: radius.card, marginBottom: spacing.lg, padding: spacing.md },
  selectionLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  selectionValue: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '800', marginTop: 5 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  timeOption: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexBasis: '31%', flexGrow: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xs },
  timeLabel: { color: colors.text, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  inputLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: spacing.lg },
  noteInput: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg, marginTop: spacing.xs, minHeight: 110, padding: spacing.md },
  previewNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, marginTop: spacing.sm, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.xs },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, marginBottom: spacing.md, padding: spacing.sm },
  reminderCard: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, gap: 4, padding: spacing.sm },
  reminderTitle: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  reminderBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.72 },
});
