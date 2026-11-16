import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';
import { PublicAvatar } from '../../../shared/components/PublicIdentityBadge';
import { StarRow, TagPills } from '../../../shared/components/ReviewParts';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { NameWithCheck } from '../../../shared/components/VerifiedCheck';
import type { ProfileRole } from '../../../shared/models/PublicProfile';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { ui } from '../../../shared/theme/ui';
import type { RatingView, ReviewLine } from '../models/ProfileScreen';
import { usePublicProfileScreenViewModel } from '../viewModels/usePublicProfileScreenViewModel';

interface Props {
  accountId: string | undefined;
  userId: string;
  /** The block the entry point is about. If it is empty the other one is shown; if both are empty, only the identity. */
  prefer: ProfileRole | null;
  onBack: () => void;
  /** Opens a listing from the Listings section (the root owns navigation). */
  onOpenListing?: ((listingId: string) => void) | undefined;
}

function RatingCard({ r }: { r: RatingView }) {
  if (r.empty) return <View style={styles.card}><Text style={ui.body}>{r.countLine}</Text></View>;
  return <View style={styles.card}>
    <View style={styles.ratingTop}>
      <Text accessibilityLabel={`Average ${r.average} out of 5`} style={styles.average}>{r.average}</Text>
      <View style={styles.grow}><StarRow filled={r.starsFilled} size={20} /><Text style={ui.supporting}>{r.countLine}</Text></View>
    </View>
    <View style={styles.bars}>{r.bars.map(b => <View key={b.stars} accessible accessibilityLabel={`${b.stars} stars, ${b.count}`} style={styles.barRow}>
      <Text accessible={false} style={[ui.supporting, styles.barLabel]}>{b.stars}</Text>
      <View accessible={false} style={styles.track}><View style={[styles.fill, { width: `${Math.round(b.fraction * 100)}%` }]} /></View>
      <Text accessible={false} style={[ui.supporting, styles.barCount]}>{b.count}</Text>
    </View>)}</View>
    <TagPills labels={r.tags.map(t => t.label)} counts={r.tags.map(t => t.count)} />
  </View>;
}
function Reviews({ title, rows }: { title: string; rows: ReviewLine[] }) {
  if (rows.length === 0) return null;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text>
    {rows.map(r => <View key={r.key} style={styles.card}>
      <View accessible accessibilityLabel={`${r.stars} out of 5 stars`}><StarRow filled={r.stars} /></View>
      <Text style={ui.supporting}>{r.heading}</Text>
      {r.text ? <Text style={ui.body}>{r.text}</Text> : null}
      <TagPills labels={r.tags} />
    </View>)}
  </View>;
}

/** A public profile: the landlord or the tenant view, or only the identity. Read-only. */
export function PublicProfileView({ accountId, userId, prefer, onBack, onOpenListing }: Props) {
  const vm = usePublicProfileScreenViewModel(accountId, userId, prefer);
  const view = vm.phase === 'ready' ? vm.view : null;
  return <View style={styles.screen}>
    <ScreenHeader title={view ? view.name : 'Profile'} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      {vm.phase === 'loading' ? <ActivityIndicator accessibilityLabel="Loading profile" color={colors.primaryAction} /> : null}
      {vm.phase === 'unavailable' ? <View style={styles.card}><Text accessibilityRole="alert" style={ui.body}>{vm.message}</Text><Text style={ui.supporting}>You can see a profile when you share a conversation or a rental with the person, or when they have a listing.</Text></View> : null}
      {vm.phase === 'error' ? <View style={styles.card}><Text accessibilityRole="alert" style={ui.body}>{vm.message}</Text><AppButton label="Try again" variant="secondary" onPress={vm.retry} /></View> : null}
      {vm.phase === 'ready' && view ? <>
        <View style={styles.identity}>
          <PublicAvatar url={vm.avatarUrl} name={view.name === 'RentLease user' ? null : view.name} size={96} />
          <View style={styles.grow}>
            <NameWithCheck name={view.name} verified={vm.idVerified} size={22} textStyle={ui.pageTitle} />
            {view.label ? <Text style={ui.body}>{view.label}</Text> : null}
            {view.landlord ? <Text style={ui.supporting}>{view.landlord.subtitle}</Text> : null}
            {view.tenant ? <Text style={ui.supporting}>{view.tenant.subtitle}</Text> : null}
          </View>
        </View>
        {view.landlord ? <>
          <RatingCard r={view.landlord.rating} />
          {view.landlord.listings.length ? <View style={styles.section}>
            <Text accessibilityRole="header" style={ui.sectionTitle}>Listings</Text>
            {view.landlord.listings.map(l => <Pressable key={l.id} accessibilityRole="button" accessibilityLabel={`${l.title}, ${l.line}. Open listing`} disabled={!onOpenListing} onPress={() => onOpenListing?.(l.id)} style={[styles.card, styles.listing]}>
              <View style={styles.grow}><Text style={ui.body}>{l.title}</Text><Text style={ui.supporting}>{l.line}</Text></View>
              {onOpenListing ? <Text accessible={false} style={styles.chevron}>{'›'}</Text> : null}
            </Pressable>)}
          </View> : null}
          <Reviews title="Recent reviews" rows={view.landlord.reviews} />
        </> : null}
        {view.tenant ? <>
          <RatingCard r={view.tenant.rating} />
          <Reviews title="What landlords said" rows={view.tenant.reviews} />
          <Text style={ui.supporting}>{view.tenant.info}</Text>
        </> : null}
      </> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  grow: { flex: 1, minWidth: 0, gap: spacing.xxs },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  card: { ...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card },
  section: { gap: spacing.sm },
  ratingTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  average: { ...ui.pageTitle, fontSize: 44, lineHeight: 52 },
  bars: { gap: spacing.xxs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  barLabel: { width: 16, textAlign: 'right' },
  barCount: { minWidth: 24 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.reviewOrange },
  listing: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  chevron: { ...ui.sectionTitle, color: colors.textSecondary },
});
