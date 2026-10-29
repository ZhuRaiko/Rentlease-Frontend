import { StyleSheet, Text } from 'react-native';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { ListingButton } from '../components/ListingButton';
import { ListingWorkspaceFeedback } from '../components/ListingWorkspaceFeedback';
import { colors } from '../../../shared/theme/colors';
import { typography } from '../../../shared/theme/typography';
import { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
export function PublishedListingStatusView({ viewModel, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const state = viewModel.lifecycleState;
  const row = viewModel.realListing;
  const operation = state.confirmation;
  const description = row?.status === 'rented'
    ? 'This listing is currently rented and its status is managed by the tenancy workflow.'
    : row?.status === 'removed' ? 'This listing is no longer active on RentLease.'
    : row?.status === 'archived' ? 'This listing is archived. Your property and photos are retained.'
    : 'Listing status is confirmed by RentLease. Content editing is unavailable after publication.';
  return <ListingWizardScaffold title={row ? viewModel.lifecycleStatusLabel[row.status] : 'Listing status'} description={description} onBack={viewModel.goBack} onClose={onClose}>
    <ListingWorkspaceFeedback viewModel={viewModel} scope="management" />
    <Text style={styles.title}>{row?.title}</Text>
    <Text style={styles.detail}>Listing: {row?.id}</Text>
    <Text style={styles.detail}>Completeness: {Math.round((row?.completeness_score ?? 0) * 100)}%</Text>
    {row?.published_at ? <Text style={styles.detail}>Published: {formatVerificationDate(row.published_at)}</Text> : null}
    {row?.paused_at ? <Text style={styles.detail}>Paused: {formatVerificationDate(row.paused_at)}</Text> : null}
    {row?.archived_at ? <Text style={styles.detail}>Archived: {formatVerificationDate(row.archived_at)}</Text> : null}
    {row?.updated_at ? <Text style={styles.detail}>Updated: {formatVerificationDate(row.updated_at)}</Text> : null}
    {operation ? <>
      <Text accessibilityRole="header" style={styles.title}>{viewModel.lifecycleLabel[operation]}?</Text>
      <Text style={styles.detail}>{operation === 'archive' ? 'Archiving is final in this workflow. Your listing record, property and photos will be kept.' : operation === 'pause' ? 'Pause this listing? You may request reactivation later.' : 'Return this listing to Published? RentLease will recheck this property?s verification and publication requirements.'}</Text>
      <ListingButton label={`Confirm ${viewModel.lifecycleLabel[operation].toLowerCase()}`} disabled={viewModel.lifecycleBlocked} onPress={() => void viewModel.lifecycle.confirm()} />
      <ListingButton label="Cancel" tone="outline" onPress={viewModel.lifecycle.cancel} />
    </> : viewModel.lifecycleActions.map(action => <ListingButton key={action} label={viewModel.lifecycleLabel[action]} tone="outline" disabled={viewModel.lifecycleBlocked} onPress={() => viewModel.lifecycle.request(action)} />)}
    <ListingButton label="Back to My Listings" tone="outline" disabled={state.busy} onPress={viewModel.goDashboard} />
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({ title: { fontFamily: typography.family, color: colors.text, fontSize: 22, fontWeight: '700' }, detail: { fontFamily: typography.family, color: colors.textSecondary, fontSize: 14, lineHeight: 21 } });
