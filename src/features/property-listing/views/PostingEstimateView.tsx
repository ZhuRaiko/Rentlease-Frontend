import {PostingSection} from '../components/PostingSection';
import type {ReactNode} from 'react';
import {Text,View} from 'react-native';
import {ListingWizardScaffold} from '../components/ListingWizardScaffold';
import {PostingProgress} from '../components/PostingProgress';
import {ListingButton} from '../components/ListingButton';
import {ui} from '../../../shared/theme/ui';
import type {PropertyListingViewModel} from '../viewModels/usePropertyListingViewModel';
export function PostingEstimateView({viewModel:vm,onClose,estimateSection}:{viewModel:PropertyListingViewModel;onClose:()=>void;estimateSection:ReactNode}){return <ListingWizardScaffold title="Rental Price Estimate" description="Get guidance for your monthly rent using the saved property details." progress={<PostingProgress step={3}/>} onBack={vm.goBack} onClose={onClose} footer={<ListingButton tone="brand" label="Continue to Review" disabled={!!vm.composerPhase||vm.listingDraftState.busy} onPress={vm.continuePostingReview}/>}><View style={{gap:8}}>{estimateSection}</View><Text style={ui.body}>Your asking rent: PHP {vm.draft.askingRent || 'Not entered'} / month</Text><ListingButton label="Keep My Price" tone="outline" onPress={vm.keepPostingPrice}/>{vm.composerNotice?<Text accessibilityLiveRegion="polite" style={ui.supporting}>{vm.composerNotice}</Text>:null}<PostingSection title="About this estimate" plain><Text style={ui.supporting}>An estimate is optional. Continue with your own price if it is unavailable. Your property details are saved; your listing and selected photos are saved at Review. Using an estimate only updates your asking rent.</Text></PostingSection></ListingWizardScaffold>;}
