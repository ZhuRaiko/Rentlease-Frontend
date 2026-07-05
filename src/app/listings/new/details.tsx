import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Chip, FormInput, PostingShell, SectionLabel } from '@/features/listings/components';
import { useListingDraft } from '@/features/listings/listing-draft-context';
import { listingRoutes } from '@/features/listings/routes';
import { FurnishingStatus } from '@/features/listings/types';

const propertyTypes = ['House', 'Apartment', 'Condo', 'Room'];
const furnishingStatuses: FurnishingStatus[] = ['furnished', 'semi_furnished', 'unfurnished'];

export default function PostingDetailsScreen() {
  const { draft, updateDraft } = useListingDraft();

  return (
    <PostingShell step={2} onNext={() => router.push(listingRoutes.newSpecs)}>
      <View style={styles.content}>
        <SectionLabel>Listing Title</SectionLabel>
        <FormInput
          value={draft.title}
          onChangeText={(title) => updateDraft({ title })}
          placeholder={'e.g. "2BR House in Imus near SM"'}
        />

        <SectionLabel>Property type</SectionLabel>
        <View style={styles.chips}>
          {propertyTypes.map((type) => (
            <Chip
              key={type}
              label={type}
              selected={draft.propertyType === type}
              onPress={() => updateDraft({ propertyType: type })}
            />
          ))}
        </View>

        <SectionLabel>Description</SectionLabel>
        <FormInput
          value={draft.description}
          onChangeText={(description) => updateDraft({ description })}
          placeholder="What makes this place special?"
          multiline
          style={styles.description}
        />

        <SectionLabel>Furnishing status</SectionLabel>
        <View style={styles.chips}>
          {furnishingStatuses.map((status) => (
            <Chip
              key={status}
              label={status.replace('_', ' ')}
              selected={draft.furnishingStatus === status}
              onPress={() => updateDraft({ furnishingStatus: status })}
              color="neutral"
            />
          ))}
        </View>
      </View>
    </PostingShell>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: 28,
    gap: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  description: {
    minHeight: 111,
    textAlignVertical: 'top',
  },
});
