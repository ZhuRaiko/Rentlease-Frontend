import { Text, View } from 'react-native';
import { landlordExperienceView } from '../models/RentalReview';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { ui } from '../theme/ui';
import { useRentalReviews } from '../viewModels/useRentalReviews';

/** Profile section: what landlords said about this person, from published reviews. Hidden until there is one. No reviewer names (rows carry none). */
export function LandlordExperienceSection({ accountId }: { accountId: string }) {
  const vm = useRentalReviews(accountId, { mode: 'user', id: accountId });
  const view = landlordExperienceView(vm.data?.type === 'public' ? vm.data.value : null);
  if (!view) return null;
  return <View style={{ ...ui.panel, padding: spacing.md, gap: spacing.sm }}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>{view.title}</Text>
    <Text style={ui.body}>{`${view.average} \u00b7 ${view.countLabel}`}</Text>
    {view.rows.map(row => <View key={row.id} style={{ borderTopWidth: 1, borderColor: colors.outline, paddingTop: spacing.sm, gap: spacing.xxs }}>
      <Text style={ui.body}>{`${row.rating} / 5`}</Text>
      {row.text ? <Text style={ui.body}>{row.text}</Text> : null}
      <Text style={ui.supporting}>{new Date(row.createdAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</Text>
    </View>)}
  </View>;
}
