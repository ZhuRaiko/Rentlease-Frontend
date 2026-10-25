import { StyleSheet, Text } from 'react-native';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { ListingButton } from '../components/ListingButton';
import { colors } from '../../../shared/theme/colors';
import { typography } from '../../../shared/theme/typography';
import { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
export function PublishedListingStatusView({ viewModel, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const state = viewModel.publicationState;
  return <ListingWizardScaffold title="Published" description="Publication confirmed by RentLease." onBack={viewModel.goBack} onClose={onClose}>
    <Text style={styles.title}>{state.lastConfirmed?.title}</Text>
    <Text style={styles.detail}>Listing: {state.publishedListingId}</Text>
    <Text style={styles.detail}>Completeness: {Math.round((state.completenessScore ?? 0) * 100)}%</Text>
    <Text style={styles.detail}>Published: {state.publishedAt ? formatVerificationDate(state.publishedAt) : 'Not confirmed'}</Text>
    <Text style={styles.detail}>Your saved property and photos are retained. Listing lifecycle actions are not available in this phase. Discovery integration is separate.</Text>
    <ListingButton label="Back to My Listings" tone="outline" onPress={viewModel.goDashboard} />
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({ title: { fontFamily: typography.family, color: colors.text, fontSize: 22, fontWeight: '700' }, detail: { fontFamily: typography.family, color: colors.textSecondary, fontSize: 14, lineHeight: 21 } });
