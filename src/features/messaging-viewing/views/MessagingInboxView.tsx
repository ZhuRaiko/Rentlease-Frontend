import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ConversationRow, ViewingSummaryCard } from '../components/MessagingCards';
import { MessagingScaffold } from '../components/MessagingScaffold';
import type { MessagingViewingViewModel } from '../viewModels/useMessagingViewingViewModel';

interface MessagingInboxViewProps {
  onClose: () => void;
  viewModel: MessagingViewingViewModel;
}

export function MessagingInboxView({ onClose, viewModel }: MessagingInboxViewProps) {
  if (viewModel.screen === 'emptyInbox') {
    return (
      <MessagingScaffold
        actionLabel="Restore"
        onAction={viewModel.openInbox}
        onClose={onClose}
        title="Messages"
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyGraphic}>
            <View style={styles.emptyBubble}>
              <View style={styles.emptyTail} />
              <View style={[styles.emptyLine, styles.emptyLineLong]} />
              <View style={styles.emptyLine} />
            </View>
          </View>
          <Text accessibilityRole="header" style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyBody}>
            Property inquiries and viewing updates will appear here once you start a conversation.
          </Text>
          <AppButton label="Start a listing inquiry" onPress={viewModel.startInquiry} />
        </View>
      </MessagingScaffold>
    );
  }

  return (
    <MessagingScaffold
      actionLabel="Empty"
      onAction={() => viewModel.navigate('emptyInbox')}
      onClose={onClose}
      title="Messages"
    >
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>{viewModel.actor === 'landlord' ? 'LANDLORD INBOX' : 'TENANT INBOX'}</Text>
          <Text style={styles.heading}>Your conversations</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={viewModel.startInquiry} style={styles.newButton}>
          <Text style={styles.newButtonLabel}>New inquiry</Text>
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <View style={styles.searchIcon}>
          <View style={styles.searchCircle} />
          <View style={styles.searchHandle} />
        </View>
        <TextInput
          accessibilityLabel="Search messages"
          onChangeText={viewModel.setSearchText}
          placeholder="Search people or listings"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={viewModel.searchText}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => viewModel.navigate('upcomingViewing')}
        style={({ pressed }) => [styles.upcomingWrap, pressed && styles.pressed]}
      >
        <Text style={styles.sectionLabel}>UPCOMING</Text>
        <ViewingSummaryCard
          date="Sunday, September 20, 2026"
          status="accepted"
          time="10:30 AM"
        >
          <Text style={styles.tapHint}>Tap to view schedule details</Text>
        </ViewingSummaryCard>
      </Pressable>

      <Text style={styles.sectionLabel}>ALL MESSAGES</Text>
      <View>
        {viewModel.filteredConversations.map((conversation) => (
          <ConversationRow
            conversation={conversation}
            key={conversation.id}
            onPress={() => viewModel.openConversation(conversation.id)}
          />
        ))}
      </View>
      {viewModel.filteredConversations.length === 0 ? (
        <Text style={styles.noSearchResults}>No conversation matches that search.</Text>
      ) : null}
    </MessagingScaffold>
  );
}

const styles = StyleSheet.create({
  headingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heading: { color: colors.text, fontFamily: typography.family, fontSize: 23, fontWeight: '900', marginTop: 4 },
  newButton: { backgroundColor: colors.primaryPale, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10 },
  newButtonLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  searchBar: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, minHeight: 48, paddingHorizontal: spacing.md },
  searchIcon: { height: 20, position: 'relative', width: 20 },
  searchCircle: { borderColor: colors.textMuted, borderRadius: 7, borderWidth: 1.5, height: 13, left: 1, position: 'absolute', top: 1, width: 13 },
  searchHandle: { backgroundColor: colors.textMuted, height: 1.5, left: 12, position: 'absolute', top: 13, transform: [{ rotate: '45deg' }], width: 7 },
  searchInput: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 13, paddingVertical: spacing.sm },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.lg },
  upcomingWrap: { marginTop: spacing.xs },
  tapHint: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  noSearchResults: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, paddingVertical: spacing.xl, textAlign: 'center' },
  emptyState: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.xxl },
  emptyGraphic: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: 60, height: 120, justifyContent: 'center', width: 120 },
  emptyBubble: { borderColor: colors.primary, borderRadius: radius.md, borderWidth: 3, height: 52, position: 'relative', width: 68 },
  emptyTail: { borderBottomColor: colors.primary, borderBottomWidth: 12, borderLeftColor: 'transparent', borderLeftWidth: 12, bottom: -12, height: 0, left: 10, position: 'absolute', width: 0 },
  emptyLine: { backgroundColor: colors.primary, borderRadius: 2, height: 3, left: 13, position: 'absolute', top: 31, width: 26 },
  emptyLineLong: { top: 17, width: 40 },
  emptyTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21, maxWidth: 320, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
