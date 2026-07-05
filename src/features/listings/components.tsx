import { router } from 'expo-router';
import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Typography } from '@/constants/theme';
import { amenityLabels } from '@/features/listings/mock-data';
import { listingRoutes } from '@/features/listings/routes';
import { Listing } from '@/features/listings/types';
import { useTheme } from '@/hooks/use-theme';

export function AppScreen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  const content = <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>;

  if (!scroll) {
    return <View style={[styles.screen, { backgroundColor: theme.background }]}>{content}</View>;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}>
      {content}
    </ScrollView>
  );
}

export function BrandHeader({ title = 'RentLease' }: { title?: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandMark}>
        <ThemedText style={styles.brandMarkText}>RL</ThemedText>
      </View>
      <ThemedText style={styles.brandTitle}>{title}</ThemedText>
      <View style={styles.avatar} />
    </View>
  );
}

export function BottomNav({ active }: { active: 'discover' | 'listing' | 'post' | 'tenancy' | 'chat' }) {
  const items = [
    ['discover', 'Discover'],
    ['listing', 'Listing'],
    ['post', 'Post'],
    ['tenancy', 'Tenancy'],
    ['chat', 'Chat'],
  ] as const;
  const theme = useTheme();

  return (
    <View style={[styles.bottomNav, { borderColor: theme.border }]}>
      {items.map(([key, label]) => (
        <Pressable
          key={key}
          onPress={() => {
            if (key === 'discover') router.replace(listingRoutes.home);
            if (key === 'post') router.push(listingRoutes.newStart);
          }}
          style={styles.navItem}>
          <ThemedText style={[styles.navIcon, { color: key === active ? theme.primary : theme.tabInactive }]}>
            {key === 'post' ? '+' : '•'}
          </ThemedText>
          <ThemedText style={[styles.navLabel, { color: key === active ? theme.primary : theme.tabInactive }]}>
            {label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export function ListingCard({ listing }: { listing: Listing }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(listingRoutes.detail(listing.id))}
      style={({ pressed }) => [styles.listingCard, { borderColor: theme.border }, pressed && styles.pressed]}>
      <View style={[styles.cardImage, { backgroundColor: listing.imageGradient[1] }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <ThemedText style={styles.cardTitle}>{listing.title}</ThemedText>
          <ThemedText style={styles.cardPrice}>{formatPeso(listing.price)}</ThemedText>
        </View>
        <ThemedText style={styles.cardLocation}>{listing.city}, Cavite</ThemedText>
        <View style={styles.cardMetaRow}>
          <ThemedText style={styles.metaText}>{listing.bedrooms} bed</ThemedText>
          <ThemedText style={styles.metaText}>{listing.bathrooms} bath</ThemedText>
          <ThemedText style={styles.metaText}>{listing.sizeSqm} sqm</ThemedText>
        </View>
        <View style={styles.chipRow}>
          {listing.amenities.slice(0, 3).map((amenity) => (
            <Chip key={amenity} label={amenityLabels[amenity]} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

export function Chip({
  label,
  selected = true,
  onPress,
  color = 'primary',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: 'primary' | 'accent' | 'neutral';
}) {
  const theme = useTheme();
  const backgroundColor =
    color === 'accent' ? theme.accent : color === 'neutral' ? theme.chipNeutral : theme.primaryPressed;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? backgroundColor : theme.backgroundElement,
          borderColor: selected ? backgroundColor : theme.borderStrong,
        },
      ]}>
      <ThemedText style={[styles.chipText, { color: selected ? theme.inverseText : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <ThemedText style={styles.sectionLabel}>{children}</ThemedText>;
}

export function FormInput({ style, ...props }: TextInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={theme.textMuted}
      style={[styles.formInput, { borderColor: theme.text, color: theme.text }, style]}
      {...props}
    />
  );
}

export function PrimaryAction({
  label,
  onPress,
  style,
  tone = 'dark',
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'dark' | 'green';
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryAction,
        { backgroundColor: tone === 'green' ? '#287E3B' : theme.text },
        pressed && styles.pressed,
        style,
      ]}>
      <ThemedText style={[styles.primaryActionText, { color: theme.inverseText }]}>{label}</ThemedText>
    </Pressable>
  );
}

export function StepProgress({ step }: { step: number }) {
  const theme = useTheme();

  return (
    <View style={styles.progressRow}>
      {Array.from({ length: 5 }, (_, index) => (
        <View
          key={index}
          style={[
            styles.progressBar,
            { backgroundColor: index < step ? '#AFD5B6' : theme.borderStrong },
          ]}
        />
      ))}
    </View>
  );
}

export function PostingShell({
  step,
  title,
  children,
  onNext,
  nextLabel = 'Next',
}: {
  step?: number;
  title?: string;
  children: ReactNode;
  onNext?: () => void;
  nextLabel?: string;
}) {
  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.closeButton}>
        <ThemedText style={styles.closeText}>x</ThemedText>
      </Pressable>
      {step ? (
        <>
          <ThemedText style={styles.stepText}>Step {step} of 5</ThemedText>
          <StepProgress step={step} />
        </>
      ) : null}
      {title ? <ThemedText style={styles.postTitle}>{title}</ThemedText> : null}
      {children}
      {onNext ? (
        <Pressable onPress={onNext} style={styles.nextLink}>
          <ThemedText style={styles.nextText}>{nextLabel} &gt;</ThemedText>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}

export function MapPreview({ listings }: { listings: Listing[] }) {
  const theme = useTheme();

  return (
    <View style={[styles.mapPreview, { borderColor: theme.borderStrong }]}>
      <View style={styles.mapRoadHorizontal} />
      <View style={styles.mapRoadVertical} />
      {listings.slice(0, 5).map((listing, index) => (
        <Pressable
          key={listing.id}
          onPress={() => router.push(listingRoutes.detail(listing.id))}
          style={[
            styles.mapPin,
            {
              left: `${18 + index * 15}%`,
              top: `${25 + (index % 3) * 18}%`,
              backgroundColor: theme.primary,
            },
          ]}>
          <ThemedText style={styles.mapPinText}>P</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export function formatPeso(value: number) {
  return `PHP ${value.toLocaleString('en-PH')}/mo`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 86,
  },
  header: {
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D9D9D9',
    marginLeft: 'auto',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 57,
    borderTopWidth: 2,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingBottom: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  navIcon: {
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '700',
  },
  navLabel: {
    fontSize: 10,
    lineHeight: 12,
  },
  listingCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  cardImage: {
    height: 130,
  },
  cardBody: {
    padding: 12,
    gap: 7,
  },
  cardTopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  cardPrice: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  cardLocation: {
    fontSize: 13,
    lineHeight: 17,
    opacity: 0.62,
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  sectionLabel: {
    ...Typography.sectionLabel,
    textTransform: 'uppercase',
  },
  formInput: {
    minHeight: 48,
    borderWidth: 0.5,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  primaryAction: {
    minHeight: 56,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryActionText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 12,
    zIndex: 2,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 24,
    lineHeight: 28,
    opacity: 0.4,
  },
  stepText: {
    marginTop: 132,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '500',
  },
  postTitle: {
    marginTop: 28,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
  },
  nextLink: {
    alignSelf: 'flex-end',
    marginTop: 24,
    padding: 12,
  },
  nextText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  mapPreview: {
    height: 270,
    borderWidth: 1,
    borderRadius: 27,
    overflow: 'hidden',
    backgroundColor: '#E6F1FB',
  },
  mapRoadHorizontal: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: 130,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.72)',
    transform: [{ rotate: '-9deg' }],
  },
  mapRoadVertical: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    left: 190,
    width: 32,
    backgroundColor: 'rgba(255,255,255,0.62)',
    transform: [{ rotate: '18deg' }],
  },
  mapPin: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
});
