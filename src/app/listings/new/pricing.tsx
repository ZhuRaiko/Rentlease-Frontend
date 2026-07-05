import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FormInput, PostingShell, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { createListingFromDraft } from '@/features/listings/listing-service';
import { useListingDraft } from '@/features/listings/listing-draft-context';
import { listingRoutes } from '@/features/listings/routes';
import { useAuth } from '@/features/auth/auth-context';

export default function PostingPricingScreen() {
  const { draft, updateDraft, resetDraft } = useListingDraft();
  const { session } = useAuth();
  const [isPosting, setIsPosting] = useState(false);
  const suggestedPrice = 32000;

  async function postListing() {
    try {
      setIsPosting(true);
      const listing = await createListingFromDraft(
        {
          ...draft,
          title: draft.title || 'Untitled RentLease Listing',
          description: draft.description || 'A new rental listing on RentLease.',
          price: draft.price || String(suggestedPrice),
        },
        session?.user.id ?? '00000000-0000-0000-0000-000000000000'
      );
      resetDraft();
      router.replace(listingRoutes.detail(listing.id));
    } catch (error) {
      Alert.alert('Could not post listing', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <PostingShell step={5}>
      <View style={styles.content}>
        <SectionLabel>Payment terms</SectionLabel>
        <FormInput
          value={draft.paymentTerms}
          onChangeText={(paymentTerms) => updateDraft({ paymentTerms })}
          placeholder="e.g. 1 month advance + 2 months deposit"
        />

        <View style={styles.pricePanel}>
          <ThemedText style={styles.panelLabel}>Suggested rent range price</ThemedText>
          <ThemedText style={styles.range}>PHP 28,000 - PHP 38,000 / mo</ThemedText>
          <ThemedText style={styles.panelLabel}>Suggested Exact Price</ThemedText>
          <ThemedText style={styles.exact}>PHP 32,000 / mo</ThemedText>
          <ThemedText style={styles.aiLabel}>Suggested by RentLease AI</ThemedText>
        </View>

        <PrimaryAction
          label="Yes, use suggested price"
          onPress={() => updateDraft({ price: String(suggestedPrice), usedSuggestedPrice: true })}
        />
        <PrimaryAction
          label="No thanks, I have my own."
          onPress={() => updateDraft({ usedSuggestedPrice: false })}
        />

        <SectionLabel>Asking Rent</SectionLabel>
        <FormInput
          keyboardType="numeric"
          value={draft.price}
          onChangeText={(price) => updateDraft({ price })}
          placeholder="PHP Enter amount"
        />

        <ThemedText style={styles.transparency}>
          {"Do you want to show that you've used our price estimation feature?"}
        </ThemedText>
        <View style={styles.yesNo}>
          <PrimaryAction label="Yes" onPress={() => updateDraft({ usedSuggestedPrice: true })} style={styles.yesNoButton} />
          <PrimaryAction label="No" onPress={() => updateDraft({ usedSuggestedPrice: false })} style={styles.yesNoButton} />
        </View>

        <PrimaryAction
          label={isPosting ? 'Posting...' : 'Post Listing'}
          onPress={postListing}
          tone="green"
          style={styles.postButton}
        />
      </View>
    </PostingShell>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: 28,
    gap: 14,
  },
  pricePanel: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2CAA82',
    borderRadius: 27,
    backgroundColor: '#F0FFED',
    padding: 20,
    gap: 10,
  },
  panelLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  range: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  exact: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
    textAlign: 'center',
  },
  aiLabel: {
    alignSelf: 'flex-end',
    fontSize: 12,
    fontWeight: '200',
  },
  transparency: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
  },
  yesNo: {
    flexDirection: 'row',
    gap: 18,
  },
  yesNoButton: {
    flex: 1,
  },
  postButton: {
    marginTop: 18,
    marginBottom: 30,
  },
});
