import { Text } from 'react-native';
import { landlordRatingLine } from '../models/ReviewPresentation';
import { colors } from '../theme/colors';
import { ui } from '../theme/ui';
import { useRentalReviews } from '../viewModels/useRentalReviews';

/**
 * "★ 4.8 landlord" under the owner's name, from get_review_summary('landlord'). Nothing is drawn while loading, when the read fails,
 * or when the landlord has no review yet (no stars for zero).
 */
export function LandlordRatingLine({ accountId, landlordId }: { accountId: string | undefined; landlordId: string }) {
  const vm = useRentalReviews(accountId, { mode: 'summary', kind: 'landlord', id: landlordId });
  const line = vm.data?.type === 'summary' ? landlordRatingLine(vm.data.value) : null;
  return line ? <Text style={[ui.supporting, { color: colors.ink }]}>{line}</Text> : null;
}
