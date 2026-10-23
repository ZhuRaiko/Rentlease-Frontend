import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ListingButton } from '../components/ListingButton';
import { SectionCard } from '../components/ListingControls';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { PropertySummaryCard } from '../components/PropertySummaryCard';
import type { ListingStatus } from '../models/PropertyListing';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

interface ListingManagementViewProps {
  viewModel: PropertyListingViewModel;
  onClose: () => void;
  onOpenPriceEstimate: () => void;
}

const confirmationContent: Record<
  'pauseConfirmation' | 'reactivateConfirmation' | 'unavailableConfirmation' | 'archiveConfirmation',
  { title: string; copy: string; action: string; status: ListingStatus; tone: 'dark' | 'green' | 'danger' }
> = {
  pauseConfirmation: {
    title: 'Pause this listing?',
    copy: 'The property remains saved but will stop appearing as an active listing until you reactivate it.',
    action: 'Pause listing',
    status: 'paused',
    tone: 'dark',
  },
  reactivateConfirmation: {
    title: 'Reactivate this listing?',
    copy: 'The property will return to the Published state in this local frontend preview.',
    action: 'Reactivate listing',
    status: 'published',
    tone: 'green',
  },
  unavailableConfirmation: {
    title: 'Mark property unavailable?',
    copy: 'Use this when the property is occupied or temporarily cannot accept applications.',
    action: 'Mark unavailable',
    status: 'unavailable',
    tone: 'dark',
  },
  archiveConfirmation: {
    title: 'Archive this listing?',
    copy: 'The listing will move out of active management. This frontend preview keeps the local record visible for evaluation.',
    action: 'Archive listing',
    status: 'archived',
    tone: 'danger',
  },
};

function EditDestination({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.editRow, pressed && styles.pressed]}
    >
      <View style={styles.editCopy}>
        <Text style={styles.editLabel}>{label}</Text>
        <Text style={styles.editDetail}>{detail}</Text>
      </View>
      <Text style={styles.editAction}>Edit</Text>
    </Pressable>
  );
}

export function ListingManagementView({
  viewModel,
  onClose,
  onOpenPriceEstimate,
}: ListingManagementViewProps) {
  const { screen, listing } = viewModel;

  if (screen.endsWith('Confirmation')) {
    const confirmation = confirmationContent[
      screen as keyof typeof confirmationContent
    ];
    return (
      <ListingWizardScaffold
        description={confirmation.copy}
        onBack={viewModel.goBack}
        onClose={onClose}
        title={confirmation.title}
      >
        <SectionCard>
          <Text style={styles.confirmListing}>{listing.title}</Text>
          <Text style={styles.confirmStatus}>Current status: {listing.status}</Text>
        </SectionCard>
        <ListingButton
          label={confirmation.action}
          onPress={() => viewModel.setListingStatus(confirmation.status)}
          tone={confirmation.tone}
        />
        <ListingButton label="Cancel" onPress={viewModel.goBack} tone="outline" />
      </ListingWizardScaffold>
    );
  }

  if (screen === 'editListing') {
    return (
      <ListingWizardScaffold
        description="Choose the section to update. Changes remain local until backend listing persistence is connected."
        onBack={viewModel.goBack}
        onClose={onClose}
        title="Edit listing"
      >
        <View style={styles.editList}>
          <EditDestination detail="Title, property type, furnishing" label="Basic information" onPress={viewModel.editDetails} />
          <EditDestination detail={viewModel.propertyState.propertyId ? `${viewModel.photoState.photos.length} saved property photos` : 'Requires a saved property'} label="Photos and cover" onPress={() => viewModel.navigate('photoManager')} />
          <EditDestination detail="Area, bedrooms, bathrooms, parking" label="Specifications" onPress={() => viewModel.navigate('specifications')} />
          <EditDestination detail={viewModel.draft.address} label="Address and map pin" onPress={() => viewModel.navigate('address')} />
          <EditDestination detail={`₱${viewModel.draft.askingRent} per month`} label="Rent and terms" onPress={() => viewModel.navigate('rentTerms')} />
          <EditDestination detail="Description, rules, availability" label="Listing content" onPress={() => viewModel.navigate('description')} />
        </View>
        <ListingButton label="Save local changes" onPress={viewModel.finishEdit} />
      </ListingWizardScaffold>
    );
  }

  return (
    <ListingWizardScaffold
      description="Control the listing’s visibility and update its information."
      onBack={viewModel.goBack}
      onClose={onClose}
      title="Listing management"
    >
      <PropertySummaryCard listing={listing} onPress={() => viewModel.navigate('published')} />
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <ListingButton label="Edit listing" onPress={viewModel.startEdit} />
      <ListingButton label="Estimate rental price" onPress={onOpenPriceEstimate} tone="outline" />
      {listing.status === 'published' ? (
        <ListingButton label="Pause listing" onPress={() => viewModel.navigate('pauseConfirmation')} tone="dark" />
      ) : null}
      {listing.status === 'paused' || listing.status === 'unavailable' ? (
        <ListingButton label="Reactivate listing" onPress={() => viewModel.navigate('reactivateConfirmation')} />
      ) : null}
      {listing.status !== 'archived' && listing.status !== 'unavailable' ? (
        <ListingButton label="Mark unavailable" onPress={() => viewModel.navigate('unavailableConfirmation')} tone="outline" />
      ) : null}
      {listing.status !== 'archived' ? (
        <ListingButton label="Archive listing" onPress={() => viewModel.navigate('archiveConfirmation')} tone="danger" />
      ) : (
        <SectionCard>
          <Text style={styles.archivedTitle}>Listing archived</Text>
          <Text style={styles.archivedCopy}>Archived listings are retained only in this local preview.</Text>
        </SectionCard>
      )}
      <ListingButton label="Back to My Properties" onPress={viewModel.goDashboard} tone="outline" />
    </ListingWizardScaffold>
  );
}

const styles = StyleSheet.create({
  editList: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  editRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingHorizontal: spacing.md },
  editCopy: { flex: 1, gap: spacing.xxs },
  editLabel: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  editDetail: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16 },
  editAction: { color: colors.primary, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  confirmListing: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '800' },
  confirmStatus: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, textTransform: 'capitalize' },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17, padding: spacing.sm },
  archivedTitle: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '800' },
  archivedCopy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.72 },
});
