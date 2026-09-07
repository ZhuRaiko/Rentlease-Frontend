import type { PropsWithChildren } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ReferenceImageCrop } from '../../../shared/components/ReferenceImageCrop';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type {
  ChatMessage,
  ConversationPreview,
  ViewingStatus,
} from '../models/MessagingViewing';

const listingReference = require('../../../assets/property-listing/listing-detail-reference.png');
const profileAvatar = require('../../../assets/authentication/profile-avatar.png');

export function MessageAvatar({
  name,
  online = false,
  usePhoto = false,
  size = 46,
}: {
  name: string;
  online?: boolean;
  usePhoto?: boolean;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={{ height: size, position: 'relative', width: size }}>
      {usePhoto ? (
        <Image
          resizeMode="cover"
          source={profileAvatar}
          style={[styles.avatarImage, { borderRadius: size / 2, height: size, width: size }]}
        />
      ) : (
        <View style={[styles.avatarFallback, { borderRadius: size / 2, height: size, width: size }]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
      {online ? <View style={styles.onlineDot} /> : null}
    </View>
  );
}

export function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: ConversationPreview;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.conversationRow, pressed && styles.pressed]}
    >
      <MessageAvatar
        name={conversation.participantName}
        online={conversation.online}
        usePhoto={conversation.id === 'conversation-imus-house'}
      />
      <View style={styles.conversationCopy}>
        <View style={styles.rowBetween}>
          <Text numberOfLines={1} style={styles.participantName}>{conversation.participantName}</Text>
          <Text style={styles.timestamp}>{conversation.timestamp}</Text>
        </View>
        <Text numberOfLines={1} style={styles.listingName}>{conversation.listingTitle}</Text>
        <View style={styles.rowBetween}>
          <Text
            numberOfLines={1}
            style={[styles.lastMessage, conversation.unreadCount > 0 && styles.lastMessageUnread]}
          >
            {conversation.lastMessage}
          </Text>
          {conversation.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadLabel}>{conversation.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ListingContextCard({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.listingCard, compact && styles.listingCardCompact]}>
      <View style={styles.listingImage}>
        <ReferenceImageCrop
          borderRadius={radius.sm}
          crop={{ x: 2, y: 25, width: 225, height: 105 }}
          source={listingReference}
          sourceHeight={499}
          sourceWidth={372}
        />
      </View>
      <View style={styles.listingCopy}>
        <Text numberOfLines={2} style={styles.listingTitle}>2-Bedroom House with Balcony</Text>
        <Text numberOfLines={1} style={styles.listingAddress}>Imus City, Cavite</Text>
        <Text style={styles.listingRent}>₱60,800<Text style={styles.rentUnit}> / month</Text></Text>
      </View>
    </View>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const outgoing = message.direction === 'outgoing';
  return (
    <View style={[styles.messageRow, outgoing && styles.messageRowOutgoing]}>
      <View style={[styles.bubble, outgoing ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
        {message.kind === 'attachment' ? <Text style={styles.attachmentType}>DOCUMENT</Text> : null}
        {message.kind === 'viewing' ? <Text style={styles.viewingType}>VIEWING PROPOSAL</Text> : null}
        <Text style={[styles.messageBody, outgoing && styles.messageBodyOutgoing]}>{message.body}</Text>
        <Text style={[styles.messageMeta, outgoing && styles.messageMetaOutgoing]}>
          {message.sentAt}{outgoing ? ` · ${message.delivery}` : ''}
        </Text>
      </View>
    </View>
  );
}

const statusLabels: Record<ViewingStatus, string> = {
  draft: 'Draft',
  pending: 'Pending response',
  accepted: 'Accepted',
  declined: 'Declined',
  countered: 'Counter-proposed',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

export function StatusPill({ status }: { status: ViewingStatus }) {
  const negative = status === 'declined' || status === 'cancelled';
  const positive = status === 'accepted' || status === 'completed';
  return (
    <View
      style={[
        styles.statusPill,
        positive && styles.statusPositive,
        negative && styles.statusNegative,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          positive && styles.statusTextPositive,
          negative && styles.statusTextNegative,
        ]}
      >
        {statusLabels[status]}
      </Text>
    </View>
  );
}

export function ViewingSummaryCard({
  date,
  time,
  status,
  children,
}: PropsWithChildren<{ date: string; time: string; status: ViewingStatus }>) {
  return (
    <View style={styles.viewingCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.viewingEyebrow}>PROPERTY VIEWING</Text>
        <StatusPill status={status} />
      </View>
      <View style={styles.dateTile}>
        <Text style={styles.dateMonth}>SEP</Text>
        <Text style={styles.dateDay}>{date.match(/\b\d{1,2}\b/)?.[0] ?? '20'}</Text>
      </View>
      <View style={styles.viewingDetails}>
        <Text style={styles.viewingDate}>{date}</Text>
        <Text style={styles.viewingTime}>{time} · In-person viewing</Text>
        <Text style={styles.viewingLocation}>2-Bedroom House with Balcony{`\n`}Imus City, Cavite</Text>
      </View>
      {children}
    </View>
  );
}

export function InlineAction({
  label,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'primary' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.inlineAction,
        tone === 'primary' && styles.inlineActionPrimary,
        tone === 'danger' && styles.inlineActionDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.inlineActionLabel,
          tone === 'primary' && styles.inlineActionLabelPrimary,
          tone === 'danger' && styles.inlineActionLabelDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarImage: { borderColor: '#D69A21', borderWidth: 1 },
  avatarFallback: { alignItems: 'center', backgroundColor: '#DFF2E4', justifyContent: 'center' },
  avatarInitials: { color: colors.primary, fontFamily: typography.family, fontSize: 14, fontWeight: '900' },
  onlineDot: { backgroundColor: colors.primary, borderColor: colors.white, borderRadius: 6, borderWidth: 2, bottom: 0, height: 12, position: 'absolute', right: 0, width: 12 },
  conversationRow: { alignItems: 'center', borderBottomColor: '#EEEEEE', borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 88, paddingVertical: spacing.sm },
  conversationCopy: { flex: 1, gap: 4 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  participantName: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  timestamp: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10 },
  listingName: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  lastMessage: { color: colors.textSecondary, flex: 1, fontFamily: typography.family, fontSize: 12 },
  lastMessageUnread: { color: colors.text, fontWeight: '700' },
  unreadBadge: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 9, height: 18, justifyContent: 'center', marginLeft: spacing.xs, minWidth: 18, paddingHorizontal: 5 },
  unreadLabel: { color: colors.white, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  listingCard: { backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: 'row', gap: spacing.sm, overflow: 'hidden', padding: spacing.xs },
  listingCardCompact: { borderRadius: radius.sm },
  listingImage: { flexBasis: 104, maxWidth: 112, minWidth: 96 },
  listingCopy: { flex: 1, justifyContent: 'center', paddingRight: spacing.xs },
  listingTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800', lineHeight: 17 },
  listingAddress: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 3 },
  listingRent: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900', marginTop: 5 },
  rentUnit: { color: colors.textSecondary, fontSize: 9, fontWeight: '400' },
  messageRow: { alignItems: 'flex-start', marginBottom: spacing.xs },
  messageRowOutgoing: { alignItems: 'flex-end' },
  bubble: { borderRadius: 18, maxWidth: '82%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bubbleIncoming: { backgroundColor: colors.surface },
  bubbleOutgoing: { backgroundColor: '#2BA47D', borderBottomRightRadius: 5 },
  attachmentType: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900', marginBottom: 4 },
  viewingType: { color: '#DFF7E9', fontFamily: typography.family, fontSize: 9, fontWeight: '900', marginBottom: 4 },
  messageBody: { color: colors.text, fontFamily: typography.family, fontSize: 13, lineHeight: 18 },
  messageBodyOutgoing: { color: colors.white },
  messageMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, marginTop: 5, textAlign: 'right' },
  messageMetaOutgoing: { color: '#DFF7E9' },
  statusPill: { backgroundColor: colors.warningSurface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  statusPositive: { backgroundColor: colors.primaryPale },
  statusNegative: { backgroundColor: colors.restrictedSurface },
  statusText: { color: colors.warning, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  statusTextPositive: { color: colors.primary },
  statusTextNegative: { color: colors.restricted },
  viewingCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.md, padding: spacing.md },
  viewingEyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  dateTile: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primaryPale, borderRadius: radius.sm, minWidth: 62, padding: spacing.xs },
  dateMonth: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900' },
  dateDay: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900' },
  viewingDetails: { gap: 4 },
  viewingDate: { color: colors.text, fontFamily: typography.family, fontSize: 15, fontWeight: '800' },
  viewingTime: { color: colors.primary, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  viewingLocation: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17 },
  inlineAction: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  inlineActionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  inlineActionDanger: { backgroundColor: colors.restrictedSurface, borderColor: '#EBC2C2' },
  inlineActionLabel: { color: colors.text, fontFamily: typography.family, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  inlineActionLabelPrimary: { color: colors.white },
  inlineActionLabelDanger: { color: colors.restricted },
  pressed: { opacity: 0.72 },
});
