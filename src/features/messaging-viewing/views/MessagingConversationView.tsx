import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  InlineAction,
  ListingContextCard,
  MessageBubble,
} from '../components/MessagingCards';
import { MessagingScaffold } from '../components/MessagingScaffold';
import type { MessagingViewingViewModel } from '../viewModels/useMessagingViewingViewModel';

interface MessagingConversationViewProps {
  viewModel: MessagingViewingViewModel;
}

export function MessagingConversationView({ viewModel }: MessagingConversationViewProps) {
  if (viewModel.screen === 'newInquiry') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="New listing inquiry">
        <Text style={styles.eyebrow}>LISTING</Text>
        <ListingContextCard />
        <Text accessibilityRole="header" style={styles.formTitle}>Ask about this property</Text>
        <Text style={styles.formBody}>
          Introduce yourself and ask the landlord about availability, rental terms, or a viewing.
        </Text>
        <TextInput
          accessibilityLabel="Inquiry message"
          multiline
          onChangeText={viewModel.setComposerText}
          placeholder="Hi! Is this property still available for viewing?"
          placeholderTextColor={colors.textMuted}
          style={styles.inquiryInput}
          textAlignVertical="top"
          value={viewModel.composerText}
        />
        <AppButton label="Send inquiry" onPress={viewModel.submitInquiry} />
        <Text style={styles.previewNote}>Frontend preview only. No message will be delivered.</Text>
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'attachment') {
    return (
      <MessagingScaffold onBack={viewModel.goBack} title="Add an attachment">
        <View style={styles.attachmentHero}>
          <View style={styles.paperShape}>
            <View style={styles.paperFold} />
            <View style={styles.paperLine} />
            <View style={[styles.paperLine, styles.paperLineShort]} />
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.formTitle}>Share with this conversation</Text>
        <Text style={styles.formBody}>
          Choose a presentation-only file type. Actual document and image upload remains disconnected.
        </Text>
        <View style={styles.attachmentOptions}>
          <InlineAction label="Property question.pdf" onPress={() => viewModel.chooseAttachment('Property question.pdf')} />
          <InlineAction label="Reference photo.jpg" onPress={() => viewModel.chooseAttachment('Reference photo.jpg')} />
        </View>
        <AppButton label="Cancel" onPress={viewModel.goBack} variant="secondary" />
      </MessagingScaffold>
    );
  }

  if (viewModel.screen === 'listingUnavailable') {
    return (
      <MessagingScaffold onBack={viewModel.openInbox} title="Conversation">
        <ListingContextCard />
        <View style={styles.unavailableState}>
          <View style={styles.unavailableMark}>
            <View style={styles.unavailableLine} />
          </View>
          <Text accessibilityRole="header" style={styles.unavailableTitle}>Listing no longer available</Text>
          <Text style={styles.unavailableBody}>
            New inquiries and viewing proposals are disabled, but this conversation remains available for reference.
          </Text>
          <AppButton label="Return to messages" onPress={viewModel.openInbox} />
        </View>
      </MessagingScaffold>
    );
  }

  const conversation = viewModel.selectedConversation;
  if (!conversation) return null;

  return (
    <MessagingScaffold
      contentPadded={false}
      onBack={viewModel.openInbox}
      scroll={false}
      subtitle={conversation.online ? 'Online now' : conversation.participantRole}
      title={conversation.participantName}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={64}
        style={styles.conversationScreen}
      >
        <View style={styles.listingContextWrap}>
          <ListingContextCard compact />
        </View>
        {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
        <ScrollView
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.dateDivider}>TODAY</Text>
          {viewModel.messages.map((message) => <MessageBubble key={message.id} message={message} />)}
        </ScrollView>
        <View style={styles.quickActions}>
          <InlineAction label="Attach" onPress={() => viewModel.navigate('attachment')} />
          <InlineAction label="Propose viewing" onPress={viewModel.beginViewingProposal} tone="primary" />
        </View>
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Message"
            multiline
            onChangeText={viewModel.setComposerText}
            placeholder="Write a message..."
            placeholderTextColor={colors.textMuted}
            style={styles.composerInput}
            value={viewModel.composerText}
          />
          <Pressable
            accessibilityLabel="Send message"
            accessibilityRole="button"
            disabled={!viewModel.composerText.trim()}
            onPress={viewModel.sendMessage}
            style={({ pressed }) => [
              styles.sendButton,
              !viewModel.composerText.trim() && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.sendArrow}>
              <View style={styles.sendArrowTail} />
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </MessagingScaffold>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  formTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', marginTop: spacing.lg },
  formBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  inquiryInput: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 14, lineHeight: 20, marginVertical: spacing.lg, minHeight: 150, padding: spacing.md },
  previewNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, marginTop: spacing.sm, textAlign: 'center' },
  attachmentHero: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.card, height: 160, justifyContent: 'center' },
  paperShape: { backgroundColor: colors.white, borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 2, height: 88, position: 'relative', width: 68 },
  paperFold: { borderLeftColor: 'transparent', borderLeftWidth: 17, borderTopColor: colors.primary, borderTopWidth: 17, height: 0, position: 'absolute', right: -2, top: -2, width: 0 },
  paperLine: { backgroundColor: colors.primary, borderRadius: 2, height: 3, left: 13, position: 'absolute', top: 47, width: 40 },
  paperLineShort: { top: 61, width: 27 },
  attachmentOptions: { flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.lg },
  unavailableState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  unavailableMark: { alignItems: 'center', backgroundColor: colors.restrictedSurface, borderRadius: 52, height: 104, justifyContent: 'center', width: 104 },
  unavailableLine: { backgroundColor: colors.restricted, borderRadius: 3, height: 4, transform: [{ rotate: '-45deg' }], width: 48 },
  unavailableTitle: { color: colors.text, fontFamily: typography.family, fontSize: 23, fontWeight: '900', textAlign: 'center' },
  unavailableBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, maxWidth: 320, textAlign: 'center' },
  conversationScreen: { flex: 1 },
  listingContextWrap: { borderBottomColor: '#EEEEEE', borderBottomWidth: 1, padding: spacing.sm },
  notice: { backgroundColor: colors.primaryPale, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, textAlign: 'center' },
  messageList: { flexGrow: 1, padding: spacing.md },
  dateDivider: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '800', marginBottom: spacing.md, textAlign: 'center' },
  quickActions: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  composer: { alignItems: 'flex-end', borderTopColor: '#EEEEEE', borderTopWidth: 1, flexDirection: 'row', gap: spacing.xs, padding: spacing.sm },
  composerInput: { backgroundColor: colors.surface, borderRadius: 20, color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 13, maxHeight: 90, minHeight: 42, paddingHorizontal: spacing.md, paddingVertical: 10 },
  sendButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  sendButtonDisabled: { backgroundColor: colors.surfaceStrong },
  sendArrow: { borderBottomColor: 'transparent', borderBottomWidth: 7, borderLeftColor: colors.white, borderLeftWidth: 14, borderTopColor: 'transparent', borderTopWidth: 7, height: 0, marginLeft: 3, position: 'relative', width: 0 },
  sendArrowTail: { backgroundColor: colors.white, height: 2, position: 'absolute', right: 1, top: -1, transform: [{ rotate: '-25deg' }], width: 10 },
  pressed: { opacity: 0.72 },
});
