import { InterfaceIcon } from '../../../shared/components/InterfaceIcon';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryButton, DiscoveryHeader, DiscoverySearchBar } from '../components/DiscoveryControls';
import { DiscoveryFeedPost } from '../components/DiscoveryFeedPost';
import { DiscoveryIcon } from '../components/DiscoveryIcon';
import { DiscoveryMapPlaceholder } from '../components/DiscoveryMapPlaceholder';
import { DiscoveryPropertyCard } from '../components/DiscoveryPropertyCard';
import { previewDiscoveryFeed, previewDiscoveryProperties } from '../models/SearchDiscovery';
import type { SearchDiscoveryViewModel } from '../viewModels/useSearchDiscoveryViewModel';

const profileAvatar = require('../../../assets/authentication/profile-avatar.png');
const rentLeaseHome = require('../../../assets/authentication/rentlease-home.png');

interface TenantDiscoveryViewProps {
  viewModel: SearchDiscoveryViewModel;
  onClose: () => void;
  onOpenNotifications: () => void;
}

function ResultsToolbar({ viewModel }: { viewModel: SearchDiscoveryViewModel }) {
  const showingMap = viewModel.screen === 'resultsMap';
  return (
    <View style={styles.toolbar}>
      <View style={styles.viewToggle}>
        <Pressable
          accessibilityLabel="List view"
          accessibilityRole="button"
          accessibilityState={{ selected: !showingMap }}
          onPress={() => viewModel.navigate('resultsList')}
          style={[styles.toggleButton, !showingMap && styles.toggleButtonActive]}
        >
          <DiscoveryIcon color={!showingMap ? colors.white : colors.textSecondary} name="list" size={18} />
          <Text style={[styles.toggleLabel, !showingMap && styles.toggleLabelActive]}>List</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Map view"
          accessibilityRole="button"
          accessibilityState={{ selected: showingMap }}
          onPress={() => viewModel.navigate('resultsMap')}
          style={[styles.toggleButton, showingMap && styles.toggleButtonActive]}
        >
          <DiscoveryIcon color={showingMap ? colors.white : colors.textSecondary} name="map" size={18} />
          <Text style={[styles.toggleLabel, showingMap && styles.toggleLabelActive]}>Map</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={viewModel.openFilters} style={styles.toolButton}>
        <DiscoveryIcon color={colors.text} name="filter" size={18} />
        <Text style={styles.toolLabel}>Filters</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('sort')} style={styles.toolButton}>
        <DiscoveryIcon color={colors.text} name="list" size={18} />
        <Text style={styles.toolLabel}>Sort</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({
  error,
  viewModel,
}: {
  error: boolean;
  viewModel: SearchDiscoveryViewModel;
}) {
  return (
    <View style={styles.stateScreen}>
      <View style={[styles.stateGraphic, error && styles.stateGraphicError]}>
        <DiscoveryIcon color={error ? colors.restricted : colors.primary} name="search" size={44} />
      </View>
      <Text accessibilityRole="header" style={styles.stateTitle}>
        {error ? 'Search is unavailable' : 'No homes matched your search'}
      </Text>
      <Text style={styles.stateBody}>
        {error
          ? 'We could not refresh the preview results. Your filters and saved listings are still here.'
          : 'Try another city, increase your budget, or remove one of your filters.'}
      </Text>
      <DiscoveryButton
        label={error ? 'Try again' : 'Adjust filters'}
        onPress={error ? viewModel.retrySearch : viewModel.openFilters}
      />
      <DiscoveryButton label="Clear search" onPress={viewModel.clearSearch} tone="outline" />
    </View>
  );
}

export function TenantDiscoveryView({ viewModel, onClose, onOpenNotifications }: TenantDiscoveryViewProps) {
  if (viewModel.screen === 'noResults' || viewModel.screen === 'searchError') {
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onBack={viewModel.goBack} title="Search" />
        <EmptyState error={viewModel.screen === 'searchError'} viewModel={viewModel} />
      </View>
    );
  }

  if (viewModel.screen === 'savedListings') {
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onClose={onClose} title="Saved Listings" />
        {viewModel.savedProperties.length ? (
          <FlatList
            contentContainerStyle={styles.listContent}
            data={viewModel.savedProperties}
            keyExtractor={(property) => property.id}
            renderItem={({ item }) => (
              <DiscoveryPropertyCard
                onPress={() => viewModel.openProperty(item.id)}
                onToggleSaved={() => viewModel.toggleSaved(item.id)}
                property={item}
                saved
              />
            )}
          />
        ) : (
          <View style={styles.stateScreen}>
            <View style={styles.stateGraphic}>
              <DiscoveryIcon color={colors.primary} name="bookmark" size={42} />
            </View>
            <Text accessibilityRole="header" style={styles.stateTitle}>Save homes for later</Text>
            <Text style={styles.stateBody}>Your saved RENTLEASE listings will appear here.</Text>
            <DiscoveryButton label="Explore properties" onPress={viewModel.openHome} />
          </View>
        )}
      </View>
    );
  }

  if (viewModel.screen === 'resultsList') {
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onBack={viewModel.goBack} title="Search Results" />
        <View style={styles.searchPad}>
          <DiscoverySearchBar
            onChangeText={viewModel.setQuery}
            onFocus={() => viewModel.navigate('searchLocation')}
            onSubmit={viewModel.submitSearch}
            value={viewModel.query}
          />
          <ResultsToolbar viewModel={viewModel} />
          {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
          <Text style={styles.resultCount}>{viewModel.visibleProperties.length} properties · {viewModel.sortOption}</Text>
        </View>
        <FlatList
          contentContainerStyle={styles.listContent}
          data={viewModel.visibleProperties}
          keyExtractor={(property) => property.id}
          renderItem={({ item }) => (
            <DiscoveryPropertyCard
              onPress={() => viewModel.openProperty(item.id)}
              onToggleSaved={() => viewModel.toggleSaved(item.id)}
              property={item}
              saved={viewModel.isSaved(item.id)}
            />
          )}
        />
      </View>
    );
  }

  if (viewModel.screen === 'resultsMap') {
    return (
      <View style={styles.screen}>
        <DiscoveryHeader onBack={viewModel.goBack} title="Map Results" />
        <View style={styles.searchPad}>
          <DiscoverySearchBar
            onChangeText={viewModel.setQuery}
            onFocus={() => viewModel.navigate('searchLocation')}
            onSubmit={viewModel.submitSearch}
            value={viewModel.query}
          />
          <ResultsToolbar viewModel={viewModel} />
        </View>
        <ScrollView contentContainerStyle={styles.mapContent} showsVerticalScrollIndicator={false}>
          <DiscoveryMapPlaceholder
            onSelectProperty={viewModel.openProperty}
            properties={viewModel.visibleProperties}
          />
          {viewModel.visibleProperties[0] ? (
            <DiscoveryPropertyCard
              compact
              onPress={() => viewModel.openProperty(viewModel.visibleProperties[0]?.id ?? '')}
              onToggleSaved={() => viewModel.toggleSaved(viewModel.visibleProperties[0]?.id ?? '')}
              property={viewModel.visibleProperties[0]}
              saved={viewModel.isSaved(viewModel.visibleProperties[0].id)}
            />
          ) : null}
        </ScrollView>
      </View>
    );
  }

  if (viewModel.screen === 'home') {
    return (
      <View style={styles.screen}>
        <View style={styles.feedHeader}>
          <View style={styles.wordmark}>
            <Text accessibilityRole="header" style={styles.wordmarkText}>RentLease</Text>
            <Image resizeMode="contain" source={rentLeaseHome} style={styles.wordmarkIcon} />
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityLabel="Open Notifications" accessibilityRole="button" onPress={onOpenNotifications} style={styles.headerAction}>
              <InterfaceIcon name="notifications" color={colors.text} />
            </Pressable>
            <Pressable accessibilityLabel="Open Profile" accessibilityRole="button" onPress={onClose} style={styles.headerAction}>
              <Image resizeMode="cover" source={profileAvatar} style={styles.headerAvatar} />
            </Pressable>
          </View>
        </View>
        <View style={styles.feedTabs}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: false }} style={styles.feedTabTarget} onPress={() => viewModel.navigate('searchLocation')}>
            <Text style={styles.feedTabMuted}>Discover</Text>
          </Pressable>
          <View style={styles.tabDivider} />
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: true }} style={styles.feedTabTarget} onPress={viewModel.openHome}>
            <Text style={styles.feedTabActive}>For You</Text>
          </Pressable>
        </View>
        {viewModel.notice ? <Text style={styles.feedNotice}>{viewModel.notice}</Text> : null}
        <ScrollView contentContainerStyle={styles.feedContent} showsVerticalScrollIndicator={false}>
          {previewDiscoveryFeed.map((post) => {
            const property = previewDiscoveryProperties.find((item) => item.id === post.propertyId);
            if (!property) return null;
            return (
              <DiscoveryFeedPost
                avatar={profileAvatar}
                avatarLabel={post.avatar === 'juan' ? 'JD' : undefined}
                description={post.caption}
                displayedMatchScore={post.displayedMatchScore}
                galleryMoreCount={post.galleryMoreCount}
                heroCrop={post.heroCrop}
                key={post.id}
                landlordName={post.landlordName}
                onViewListing={() => viewModel.openProperty(property.id)}
                property={property}
                showGallery={post.showGallery}
                tierLabel={post.verificationTier}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  feedHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 72, gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  wordmark: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs, flex: 1, minWidth: 0 },
  wordmarkText: { color: colors.text, fontFamily: typography.family, fontSize: 25, fontWeight: '800', letterSpacing: -0.7, flexShrink: 1 },
  wordmarkIcon: { height: 26, width: 26 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  headerAction: { alignItems: 'center', justifyContent: 'center', minHeight: 48, minWidth: 48 },
  headerAvatar: { borderColor: colors.border, borderRadius: 18, borderWidth: 1, height: 33, width: 33 },
  feedTabs: { alignItems: 'center', flexDirection: 'row', gap: 21, height: 50, justifyContent: 'center' },
  feedTabTarget: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
  feedTabMuted: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, letterSpacing: 0.4 },
  feedTabActive: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '900' },
  tabDivider: { backgroundColor: colors.text, height: 18, width: 1 },
  feedNotice: { backgroundColor: colors.primaryPale, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, textAlign: 'center' },
  feedContent: { paddingBottom: spacing.xs },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, padding: spacing.sm },
  searchPad: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  toolbar: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  viewToggle: { backgroundColor: colors.surface, borderRadius: radius.pill, flexDirection: 'row', padding: 3 },
  toggleButton: { alignItems: 'center', borderRadius: radius.pill, flexDirection: 'row', gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  toggleButtonActive: { backgroundColor: colors.primary },
  toggleLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  toggleLabelActive: { color: colors.white },
  toolButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  toolLabel: { color: colors.text, fontFamily: typography.family, fontSize: 10, fontWeight: '700' },
  resultCount: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11 },
  listContent: { gap: spacing.md, padding: spacing.lg },
  mapContent: { gap: spacing.md, padding: spacing.lg },
  stateScreen: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.xl },
  stateGraphic: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.pill, height: 96, justifyContent: 'center', width: 96 },
  stateGraphicError: { backgroundColor: colors.restrictedSurface },
  stateTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  stateBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21, maxWidth: 330, textAlign: 'center' },
});
