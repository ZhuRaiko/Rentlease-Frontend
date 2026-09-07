import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  MaintenancePropertyCard,
  PriorityPill,
} from '../components/MaintenanceCards';
import { MaintenanceScaffold } from '../components/MaintenanceScaffold';
import { priorityOptions } from '../models/MaintenanceRequest';
import type { MaintenanceRequestsViewModel } from '../viewModels/useMaintenanceRequestsViewModel';

function FormHeading({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <View style={styles.headingBlock}>
      <Text style={styles.step}>{step}</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

export function MaintenanceRequestFormView({ viewModel }: { viewModel: MaintenanceRequestsViewModel }) {
  if (viewModel.screen === 'create') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="New maintenance request">
        <FormHeading
          body="Maintenance requests are available for active tenancies. Select the property where the issue occurred."
          step="STEP 1 OF 5"
          title="Which property needs attention?"
        />
        <Pressable accessibilityRole="button" accessibilityState={{ selected: true }} onPress={() => undefined} style={styles.selectedProperty}>
          <MaintenancePropertyCard />
          <View style={styles.selectedCheck}><View style={styles.checkShort} /><View style={styles.checkLong} /></View>
        </Pressable>
        <View style={styles.leaseCard}>
          <Text style={styles.leaseLabel}>ACTIVE TENANCY</Text>
          <Text style={styles.leaseValue}>Lease through August 31, 2027</Text>
          <Text style={styles.leaseMeta}>Landlord · Samuel Feliciano</Text>
        </View>
        <AppButton label="Describe the issue" onPress={() => viewModel.navigate('issueDetails')} />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'issueDetails') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Describe the issue">
        <FormHeading
          body="Give the landlord enough detail to understand what needs repair."
          step="STEP 2 OF 5"
          title="What happened?"
        />
        <Text style={styles.inputLabel}>ISSUE TITLE</Text>
        <TextInput
          accessibilityLabel="Issue title"
          onChangeText={(value) => viewModel.updateDraft('title', value)}
          placeholder="Example: Kitchen sink is leaking"
          placeholderTextColor={colors.textMuted}
          style={styles.textInput}
          value={viewModel.draft.title}
        />
        <Text style={styles.inputLabel}>DESCRIPTION</Text>
        <TextInput
          accessibilityLabel="Issue description"
          multiline
          onChangeText={(value) => viewModel.updateDraft('description', value)}
          placeholder="Explain when it started, where it is, and how it affects the property."
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, styles.multilineInput]}
          textAlignVertical="top"
          value={viewModel.draft.description}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            viewModel.updateDraft('title', 'Kitchen sink is leaking');
            viewModel.updateDraft('description', 'Water is leaking from the pipe below the kitchen sink whenever the faucet is used. The cabinet floor is starting to get wet.');
          }}
          style={styles.previewFill}
        >
          <Text style={styles.previewFillLabel}>Use preview issue details</Text>
        </Pressable>
        <AppButton
          disabled={!viewModel.canReview}
          label="Choose urgency"
          onPress={() => viewModel.navigate('priority')}
        />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'priority') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Urgency">
        <FormHeading
          body="Choose the urgency based on safety and how much the issue affects daily use."
          step="STEP 3 OF 5"
          title="How urgent is this issue?"
        />
        <View style={styles.priorityList}>
          {priorityOptions.map((option) => {
            const selected = viewModel.draft.priority === option.value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => viewModel.choosePriority(option.value)}
                style={({ pressed }) => [styles.priorityOption, selected && styles.priorityOptionSelected, pressed && styles.pressed]}
              >
                <View style={styles.priorityCopy}>
                  <PriorityPill priority={option.value} />
                  <Text style={styles.priorityDescription}>{option.description}</Text>
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioCenter} /> : null}</View>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.emergencyNote}>
          <Text style={styles.emergencyTitle}>Immediate danger?</Text>
          <Text style={styles.emergencyBody}>Contact emergency services first for fire, gas leaks, serious flooding, or immediate threats to safety.</Text>
        </View>
        <AppButton label="Add photos" onPress={() => viewModel.navigate('photoUpload')} />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'photoUpload') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Maintenance photos">
        <FormHeading
          body="Photos help show the location and severity. Actual file upload is not connected in this frontend repository."
          step="STEP 4 OF 5"
          title="Show the issue clearly"
        />
        <View style={styles.photoGrid}>
          {[0, 1, 2].map((index) => {
            const added = index < viewModel.draft.photoCount;
            return (
              <View key={index} style={[styles.photoSlot, added && styles.photoSlotAdded]}>
                {added ? (
                  <>
                    <View style={styles.photoPreviewMark}><View style={styles.photoMountain} /><View style={styles.photoSun} /></View>
                    <Text style={styles.photoLabel}>PHOTO {index + 1}</Text>
                  </>
                ) : (
                  <Text style={styles.photoEmpty}>EMPTY</Text>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" onPress={viewModel.addPhotoPreview} style={styles.smallAction}><Text style={styles.smallActionLabel}>Add preview photo</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={viewModel.removePhotoPreview} style={styles.smallAction}><Text style={styles.smallActionLabel}>Remove</Text></Pressable>
        </View>
        <Text style={styles.photoCount}>{viewModel.draft.photoCount} of 3 presentation photos added</Text>
        <AppButton label="Review request" onPress={() => viewModel.navigate('review')} />
      </MaintenanceScaffold>
    );
  }

  if (viewModel.screen === 'review') {
    return (
      <MaintenanceScaffold onBack={viewModel.goBack} title="Review request">
        <FormHeading
          body="Confirm the details before submitting this frontend preview."
          step="STEP 5 OF 5"
          title="Ready to send?"
        />
        <MaintenancePropertyCard />
        <View style={styles.reviewCard}>
          <View style={styles.reviewTop}><PriorityPill priority={viewModel.draft.priority} /><Text style={styles.reviewPhotos}>{viewModel.draft.photoCount} photos</Text></View>
          <Text style={styles.reviewTitle}>{viewModel.draft.title}</Text>
          <Text style={styles.reviewBody}>{viewModel.draft.description}</Text>
        </View>
        <AppButton label="Submit maintenance request" onPress={viewModel.submitRequest} />
        <Text style={styles.previewNote}>No request will be written to Supabase.</Text>
      </MaintenanceScaffold>
    );
  }

  const request = viewModel.selectedRequest;
  if (!request) return null;
  return (
    <MaintenanceScaffold title="Request submitted">
      <View style={styles.successState}>
        <View style={styles.successCircle}><View style={styles.successCheckShort} /><View style={styles.successCheckLong} /></View>
        <Text style={styles.successEyebrow}>REQUEST SUBMITTED</Text>
        <Text accessibilityRole="header" style={styles.successTitle}>Your landlord can now review the issue</Text>
        <Text style={styles.successBody}>Track acknowledgements, information requests, schedules, and resolution updates from Maintenance.</Text>
        <View style={styles.successSummary}>
          <PriorityPill priority={request.priority} />
          <Text style={styles.successIssue}>{request.title}</Text>
          <Text style={styles.successId}>{request.id}</Text>
        </View>
        <AppButton label="View submitted status" onPress={() => viewModel.replace('submittedStatus')} />
        <AppButton label="Return to maintenance" onPress={viewModel.openRequests} variant="secondary" />
      </View>
    </MaintenanceScaffold>
  );
}

const styles = StyleSheet.create({
  headingBlock: { marginBottom: spacing.lg },
  step: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34, marginTop: spacing.xs },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  selectedProperty: { borderColor: colors.primary, borderRadius: radius.card, borderWidth: 2, padding: 2, position: 'relative' },
  selectedCheck: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, height: 28, justifyContent: 'center', position: 'absolute', right: -8, top: -8, width: 28 },
  checkShort: { backgroundColor: colors.white, height: 2, left: 7, position: 'absolute', top: 14, transform: [{ rotate: '45deg' }], width: 7 },
  checkLong: { backgroundColor: colors.white, height: 2, left: 11, position: 'absolute', top: 12, transform: [{ rotate: '-45deg' }], width: 12 },
  leaseCard: { backgroundColor: colors.primaryPale, borderRadius: radius.card, gap: 4, marginVertical: spacing.md, padding: spacing.md },
  leaseLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  leaseValue: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  leaseMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  inputLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs },
  textInput: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 13, marginBottom: spacing.md, minHeight: 50, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  multilineInput: { minHeight: 150 },
  previewFill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primaryPale, borderRadius: radius.pill, marginBottom: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: 10 },
  previewFillLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  priorityList: { gap: spacing.sm },
  priorityOption: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', minHeight: 76, padding: spacing.md },
  priorityOptionSelected: { backgroundColor: colors.primaryPale, borderColor: colors.primary },
  priorityCopy: { flex: 1, gap: spacing.xs },
  priorityDescription: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11 },
  radio: { alignItems: 'center', borderColor: colors.border, borderRadius: 11, borderWidth: 2, height: 22, justifyContent: 'center', width: 22 },
  radioSelected: { borderColor: colors.primary },
  radioCenter: { backgroundColor: colors.primary, borderRadius: 6, height: 12, width: 12 },
  emergencyNote: { backgroundColor: colors.restrictedSurface, borderRadius: radius.sm, gap: 4, marginVertical: spacing.md, padding: spacing.sm },
  emergencyTitle: { color: colors.restricted, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  emergencyBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15 },
  photoGrid: { flexDirection: 'row', gap: spacing.xs },
  photoSlot: { alignItems: 'center', aspectRatio: 0.9, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderStyle: 'dashed', borderWidth: 1, flex: 1, justifyContent: 'center' },
  photoSlotAdded: { backgroundColor: colors.primaryPale, borderColor: colors.primary, borderStyle: 'solid' },
  photoPreviewMark: { borderColor: colors.primary, borderRadius: 4, borderWidth: 2, height: 34, overflow: 'hidden', position: 'relative', width: 42 },
  photoMountain: { borderBottomColor: colors.primary, borderBottomWidth: 18, borderLeftColor: 'transparent', borderLeftWidth: 18, borderRightColor: 'transparent', borderRightWidth: 18, bottom: 0, height: 0, left: 2, position: 'absolute', width: 0 },
  photoSun: { backgroundColor: colors.primary, borderRadius: 4, height: 7, left: 7, position: 'absolute', top: 6, width: 7 },
  photoLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 8, fontWeight: '900', marginTop: spacing.xs },
  photoEmpty: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  smallAction: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flex: 1, minHeight: 42, justifyContent: 'center' },
  smallActionLabel: { color: colors.text, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  photoCount: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginBottom: spacing.lg, marginTop: spacing.sm, textAlign: 'center' },
  reviewCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, marginVertical: spacing.md, padding: spacing.md },
  reviewTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  reviewPhotos: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10 },
  reviewTitle: { color: colors.text, fontFamily: typography.family, fontSize: 19, fontWeight: '900' },
  reviewBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18 },
  previewNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, marginTop: spacing.sm, textAlign: 'center' },
  successState: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.xl },
  successCircle: { backgroundColor: colors.primaryPale, borderRadius: 55, height: 110, position: 'relative', width: 110 },
  successCheckShort: { backgroundColor: colors.primary, height: 5, left: 25, position: 'absolute', top: 58, transform: [{ rotate: '45deg' }], width: 27 },
  successCheckLong: { backgroundColor: colors.primary, height: 5, left: 43, position: 'absolute', top: 50, transform: [{ rotate: '-45deg' }], width: 47 },
  successEyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  successTitle: { color: colors.text, fontFamily: typography.family, fontSize: 25, fontWeight: '900', lineHeight: 31, maxWidth: 340, textAlign: 'center' },
  successBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, maxWidth: 330, textAlign: 'center' },
  successSummary: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.xs, padding: spacing.md },
  successIssue: { color: colors.text, fontFamily: typography.family, fontSize: 15, fontWeight: '800' },
  successId: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  pressed: { opacity: 0.72 },
});
