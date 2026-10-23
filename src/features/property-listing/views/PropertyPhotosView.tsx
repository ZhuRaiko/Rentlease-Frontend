import { Image, StyleSheet, Text, View } from 'react-native';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import { ListingWizardScaffold } from '../components/ListingWizardScaffold';
import { ListingButton } from '../components/ListingButton';
import { ListingField } from '../components/ListingControls';
import type { PropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';

export function PropertyPhotosView({ viewModel: vm, onClose }: { viewModel: PropertyListingViewModel; onClose: () => void }) {
  const state = vm.photoState, flow = vm.propertyPhotos;
  const disabled = state.busy || !state.loaded || state.needsReconcile;
  return <ListingWizardScaffold title="Property photos" description="Show the rooms and spaces tenants will use. JPEG, PNG or WebP, up to 10 MB each." onBack={vm.goBack} onClose={onClose}>
    {!state.propertyId ? <>
      <FeedbackNotice message="Photos require a saved property first. Confirm the property location before saving; the separate location integration is pending." />
      <ListingButton label="Choose photo" disabled onPress={() => void flow.select()} />
      <ListingButton label="Return to property setup" tone="outline" onPress={() => vm.navigate('propertySetup')} />
    </> : <>
      <Text accessibilityRole="header" style={styles.heading}>{state.photos.length} of 10 photos</Text>
      <Text style={styles.copy}>Property photos are publicly accessible. Do not include identity documents, private access instructions or other sensitive information.</Text>
      <FeedbackNotice message={state.error} tone="error" />
      <FeedbackNotice message={state.notice} tone="success" />
      {state.busy ? <Text accessibilityLiveRegion="polite" style={styles.copy}>Updating property photos...</Text> : null}
      {state.needsReconcile || !state.loaded ? <ListingButton label="Check photo status" disabled={state.busy} onPress={() => void flow.checkStatus()} tone="outline" /> : null}
      {!state.photos.length && state.loaded ? <Text style={styles.copy}>No saved photos yet. Add a clear photo of the property to get started.</Text> : null}
      {state.photos.map((photo, index) => <View key={photo.id} style={styles.photo}>
        <Image source={{ uri: photo.publicUrl }} accessibilityLabel={photo.alt_text || `Property photo ${index + 1}`} style={styles.image} resizeMode="cover" />
        <View style={styles.caption}><Text style={styles.heading}>Photo {index + 1}</Text>{photo.is_cover ? <Text style={styles.cover}>Cover photo</Text> : null}</View>
        <ListingField label={`Photo ${index + 1} description (optional)`} placeholder="For example: Bedroom with window" value={state.altDrafts[photo.id] ?? ''} onChangeText={value => flow.setAltDraft(photo.id, value)} multiline />
        <ListingButton disabled={disabled || (state.altDrafts[photo.id] ?? '') === (photo.alt_text ?? '')} label="Save description" tone="outline" onPress={() => void flow.saveAlt(photo.id)} />
        {!photo.is_cover ? <ListingButton disabled={disabled} label="Use as cover" tone="outline" onPress={() => void flow.setCover(photo.id)} /> : null}
        <View style={styles.actions}>
          <View style={styles.action}><ListingButton disabled={disabled || index === 0} label="Move earlier" tone="outline" onPress={() => void flow.move(photo.id, -1)} /></View>
          <View style={styles.action}><ListingButton disabled={disabled || index === state.photos.length - 1} label="Move later" tone="outline" onPress={() => void flow.move(photo.id, 1)} /></View>
        </View>
        {state.removeId === photo.id ? <>
          <FeedbackNotice tone="warning" message="Remove this photo from the property? This also removes its stored image. A replacement cover is not selected automatically." />
          <ListingButton disabled={state.busy} label="Confirm remove photo" tone="danger" onPress={() => void flow.confirmRemove()} />
          <ListingButton disabled={state.busy} label="Keep photo" tone="outline" onPress={flow.cancelRemove} />
        </> : <ListingButton disabled={disabled} label="Remove photo" tone="danger" onPress={() => flow.requestRemove(photo.id)} />}
      </View>)}
      {state.selected ? <View style={styles.photo}>
        <Text accessibilityRole="header" style={styles.heading}>Ready to upload</Text>
        <Image source={{ uri: state.selected.uri }} accessibilityLabel="Selected property photo, not uploaded" style={styles.image} resizeMode="contain" />
        <Text style={styles.copy}>{state.selected.fileName}</Text>
        <Text style={styles.copy}>{state.selected.mimeType} ? {state.selected.size === null ? 'Size checked before upload' : `${(state.selected.size / 1024 / 1024).toFixed(2)} MB`}</Text>
        <ListingField label="Photo description (optional)" placeholder="Describe this room or space" value={state.altText} onChangeText={flow.setAlt} multiline />
        <ListingButton disabled={disabled || state.photos.length >= 10} label="Upload photo" onPress={() => void flow.upload()} />
        <ListingButton disabled={state.busy} label="Discard selection" tone="outline" onPress={flow.cancelSelection} />
      </View> : <ListingButton disabled={disabled || state.photos.length >= 10} label={state.photos.length >= 10 ? '10-photo limit reached' : 'Choose photo'} onPress={() => void flow.select()} />}
      <Text style={styles.copy}>The first saved photo is assigned as cover through the backend. You can change it later. Changes here are saved to the property; no rental listing is published.</Text>
      <ListingButton disabled={state.busy} label="Continue to listing preview" tone="outline" onPress={vm.continueListingPreview} />
    </>}
  </ListingWizardScaffold>;
}
const styles = StyleSheet.create({
  heading: { ...ui.sectionTitle },
  copy: { ...ui.body },
  photo: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.background, borderRadius: 10 },
  caption: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  cover: { color: colors.primary, fontFamily: typography.family, fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexBasis: 140, flexGrow: 1 },
});
