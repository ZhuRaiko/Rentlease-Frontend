import { StyleSheet, Text, View } from 'react-native';
import { TAGS_CARD_NOTE, TAGS_CARD_TITLE } from '../models/reviewCloudPresentation';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { ui } from '../theme/ui';

/**
 * "Tags tenants picked": the tags reviewers chose on the review form, each with how many reviews chose it. A smaller, quieter card under the word cloud that is always shown on
 * Themes, whatever state the cloud is in. The tags are not tappable (they never were), so they are plain read-only chips, not buttons. Words come already sorted by count.
 */
export function ReviewTagsCard({ tags }: { tags: readonly { code: string; label: string; count: number }[] }) {
  if (tags.length === 0) return null;
  return <View style={styles.card}>
    <View><Text accessibilityRole="header" style={styles.title}>{TAGS_CARD_TITLE}</Text><Text style={ui.supporting}>{TAGS_CARD_NOTE}</Text></View>
    <View style={styles.chips}>{tags.map(tag => <View key={tag.code} accessible accessibilityLabel={`${tag.label}, chosen in ${tag.count} ${tag.count === 1 ? 'review' : 'reviews'}`} style={styles.chip}>
      <Text style={styles.label}>{tag.label}</Text>
      <View style={styles.count}><Text style={styles.countText}>{tag.count}</Text></View>
    </View>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.card, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.canvas },
  title: { ...ui.body, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%', gap: spacing.xs, minHeight: 40, paddingVertical: spacing.xxs, paddingLeft: spacing.sm, paddingRight: spacing.xxs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background },
  label: { ...ui.body, flexShrink: 1 },
  count: { minWidth: 28, height: 28, paddingHorizontal: spacing.xxs, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: typography.family, fontSize: 13, fontWeight: '700', color: colors.ink },
});
