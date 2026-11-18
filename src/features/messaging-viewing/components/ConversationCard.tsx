import {Pressable, StyleSheet, Text, View} from 'react-native';
import {PropertyPhotoThumbnail} from '../../../shared/components/PropertyPhotoThumbnail';
import {PublicAvatar} from '../../../shared/components/PublicIdentityBadge';
import {VerifiedCheck} from '../../../shared/components/VerifiedCheck';
import {SkeletonBlock} from '../../../shared/components/RefreshHint';
import type {PublicPropertyPhoto} from '../../../shared/models/PropertyMediaPath';
import type {TenancyRoleTag} from '../../../shared/models/TenancyLink';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';

/** A small outlined or filled label on a conversation card. Filled = the relationship tag ("Your tenant" / "Your landlord"). */
export function CardTag({label, filled = false}: {label: string; filled?: boolean}) {
  return <View style={[styles.tag, filled && styles.tagFilled]}><Text style={[styles.tagText, filled && styles.tagTextFilled]}>{label}</Text></View>;
}

export interface ConversationCardProps {
  name: string;
  avatarUrl?: string | null | undefined;
  avatarName?: string | null | undefined;
  verified: boolean;
  day: string;
  title: string;
  owned: boolean;
  roleTag: TenancyRoleTag | null;
  preview: string;
  photos: readonly PublicPropertyPhoto[];
  accessibilityLabel: string;
  onPress: () => void;
}

export function ConversationCard(p: ConversationCardProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={p.accessibilityLabel} onPress={p.onPress} style={({pressed}) => [styles.card, pressed && styles.pressed]}>
    <PublicAvatar url={p.avatarUrl} name={p.avatarName} size={48} />
    <View style={styles.copy}>
      <View style={styles.nameRow}>
        <Text numberOfLines={2} style={styles.name}>{p.name}</Text>
        {p.verified ? <VerifiedCheck size={16} /> : null}
        <Text style={styles.day}>{p.day}</Text>
      </View>
      <Text numberOfLines={1} style={styles.title}>{p.title}</Text>
      {p.owned || p.roleTag ? <View style={styles.tags}>{p.owned ? <CardTag label="Your listing" /> : null}{p.roleTag ? <CardTag label={p.roleTag} filled /> : null}</View> : null}
      <Text numberOfLines={1} style={styles.preview}>{p.preview}</Text>
    </View>
    <PropertyPhotoThumbnail photos={p.photos} size={56} />
  </Pressable>;
}

/** Four fixed-size placeholder cards (the same size as a real card), shown only on the first open with nothing cached. */
export function ConversationSkeleton({count = 4}: {count?: number}) {
  const fill = {backgroundColor: colors.outline};
  return <View accessible accessibilityLabel="Loading conversations" accessibilityLiveRegion="polite" style={styles.skeletonList}>
    {Array.from({length: count}, (_, i) => <View key={i} style={[styles.card, styles.skeletonCard]}>
      <SkeletonBlock width={48} height={48} radius={24} style={fill} />
      <View style={styles.copy}>
        <SkeletonBlock width={`${44 + (i % 3) * 8}%`} height={14} radius={7} style={fill} />
        <SkeletonBlock width="76%" height={12} radius={6} style={fill} />
        <SkeletonBlock width={72} height={22} radius={11} style={fill} />
        <SkeletonBlock width={`${52 + (i % 2) * 8}%`} height={12} radius={6} style={fill} />
      </View>
      <SkeletonBlock width={56} height={56} radius={12} style={fill} />
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  card: {backgroundColor: colors.background, borderColor: colors.outline, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, minHeight: 88},
  pressed: {opacity: 0.72},
  copy: {flex: 1, minWidth: 0, gap: spacing.xxs},
  nameRow: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxs},
  name: {...ui.body, fontWeight: '700', flexShrink: 1},
  day: {...ui.supporting, fontSize: 12, marginLeft: 'auto', paddingLeft: spacing.xxs},
  title: {...ui.supporting, lineHeight: 18},
  tags: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs + 2},
  tag: {minHeight: 24, paddingHorizontal: spacing.sm - 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background, justifyContent: 'center'},
  tagFilled: {backgroundColor: colors.primaryAction, borderColor: colors.primaryAction},
  tagText: {...ui.supporting, fontSize: 12, lineHeight: 16, fontWeight: '500', color: colors.primaryAction},
  tagTextFilled: {color: colors.white},
  preview: {...ui.body, lineHeight: 20},
  skeletonList: {gap: spacing.xs},
  skeletonCard: {alignItems: 'flex-start', minHeight: 120},
});
