import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NameWithCheck } from './VerifiedCheck';
import { PublicAvatar } from './PublicIdentityBadge';
import { profileBadge, profileName, ratingText, staysLabel, type ProfileRole } from '../models/PublicProfile';
import type { PublicIdentity } from '../models/PublicIdentity';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { ui } from '../theme/ui';
import { useProfileNavigation } from '../viewModels/useProfileNavigation';
import { usePublicProfile } from '../viewModels/usePublicProfile';

/** Small profile surfaces. Each makes one profile read. A refusal or a failure means "no check, no rating" and never an error banner. */

const star = '★';

/** Listing detail owner row: avatar, nickname with the check, the landlord rating and View profile. */
export function ListingOwnerRow({ accountId, ownerId, label, identity }: { accountId: string | undefined; ownerId: string; label: string; identity: PublicIdentity | undefined }) {
  const state = usePublicProfile(accountId, ownerId), nav = useProfileNavigation();
  const profile = state.status === 'ready' ? state.profile : null, badge = profileBadge(profile, 'landlord');
  const name = profile ? profileName(profile.nickname) : label;
  return <View style={styles.wrapRow}>
    <PublicAvatar url={identity?.avatarUrl} name={identity?.nickname} />
    <View style={styles.nameBlock}>
      <NameWithCheck name={name} verified={!!badge?.idVerified} />
      {badge?.rating ? <Text style={[ui.supporting, { color: colors.ink }]}>{`${star} ${ratingText(badge.rating.average)} landlord`}</Text> : null}
    </View>
    {nav && profile ? <Pressable accessibilityRole="button" accessibilityLabel={`View profile of ${name}`} onPress={() => nav.open(ownerId, 'landlord')} style={styles.link}><Text style={styles.linkText}>View profile</Text></Pressable> : null}
  </View>;
}

/** Chat header title: the name with the check, and "Landlord . <property>" or "Tenant". Tapping opens the profile. */
export function ChatPersonTitle({ accountId, personId, role, name, propertyTitle }: { accountId: string | undefined; personId: string; role: ProfileRole; name: string; propertyTitle?: string | null | undefined }) {
  const state = usePublicProfile(accountId, personId), nav = useProfileNavigation();
  const profile = state.status === 'ready' ? state.profile : null, badge = profileBadge(profile, role);
  const sub = role === 'landlord' ? ['Landlord', propertyTitle].filter(Boolean).join(' · ') : 'Tenant';
  const shown = profile ? profileName(profile.nickname) : name;
  const body = <View style={styles.grow}><NameWithCheck name={shown} verified={!!badge?.idVerified} /><Text style={ui.supporting}>{sub}</Text></View>;
  if (!nav || !profile) return body;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${shown}, ${sub}. Open profile`} onPress={() => nav.open(personId, role)} style={[styles.grow, styles.tall]}>{body}</Pressable>;
}

/** Reservation request, landlord view: name with the check and "Tenant . star rating . N stays". Tapping opens the tenant profile. */
export function ApplicantLine({ accountId, tenantId, name }: { accountId: string | undefined; tenantId: string; name: string | null | undefined }) {
  const state = usePublicProfile(accountId, tenantId), nav = useProfileNavigation();
  const profile = state.status === 'ready' ? state.profile : null, badge = profileBadge(profile, 'tenant');
  const shown = profile ? profileName(profile.nickname) : name?.trim() || 'Applicant';
  const parts = ['Tenant', badge?.rating ? `${star} ${ratingText(badge.rating.average)}` : null, badge?.stays !== null && badge?.stays !== undefined ? staysLabel(badge.stays) : null].filter(Boolean).join(' · ');
  const body = <View style={styles.grow}><NameWithCheck name={shown} verified={!!badge?.idVerified} /><Text style={ui.supporting}>{parts}</Text></View>;
  if (!nav || !profile) return body;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${shown}, ${parts}. Open profile`} onPress={() => nav.open(tenantId, 'tenant')} style={[styles.grow, styles.tall]}>{body}</Pressable>;
}

/** Tenancy people: avatar, name with the check and the relation, tappable. */
export function PersonProfileRow({ accountId, personId, name, relation, identity, showRelation = true }: { accountId: string | undefined; personId: string; name: string; relation: 'Landlord' | 'Tenant'; identity: PublicIdentity | undefined; showRelation?: boolean }) {
  const state = usePublicProfile(accountId, personId), nav = useProfileNavigation();
  const profile = state.status === 'ready' ? state.profile : null, role: ProfileRole = relation === 'Landlord' ? 'landlord' : 'tenant', badge = profileBadge(profile, role);
  const body = <View style={styles.row}><PublicAvatar url={identity?.avatarUrl} name={identity?.nickname} /><View style={styles.grow}><NameWithCheck name={name} verified={!!badge?.idVerified} />{showRelation ? <Text style={ui.supporting}>{relation}</Text> : null}</View></View>;
  if (!nav || !profile) return body;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${relation}. Open profile`} onPress={() => nav.open(personId, role)} style={styles.tall}>{body}</Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  // The owner row wraps at large text: the button drops under the name instead of squeezing it.
  wrapRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: spacing.xs },
  nameBlock: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 120 },
  tall: { minHeight: 48, justifyContent: 'center' },
  link: { minHeight: 48, minWidth: 48, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.control, borderWidth: 1, borderColor: colors.controlBorder },
  linkText: { ...ui.body, fontWeight: '700', color: colors.primaryAction },
});
