import {PostingPriceStep} from './PostingPriceStep';
import {PostingReviewView} from './PostingReviewView';
import {ListingButton} from '../components/ListingButton';
import {UnfinishedPostDeletionAction} from '../components/UnfinishedPostDeletionAction';
import {RentalPriceGuidance} from '../../../shared/components/RentalPriceGuidance';
import {InlineRentalEstimate} from '../../../shared/components/InlineRentalEstimate';
import type {LandlordPortfolioItem} from '../models/LandlordPortfolio';
import type {PortfolioRequestActivity} from '../models/PortfolioCardPresentation';
import {PropertyIdentityEditView} from './PropertyIdentityEditView';
import {PropertyRoutineEditView} from './PropertyRoutineEditView';
import { ListingDraftSavedView } from './ListingDraftSavedView';
import { PublishedListingStatusView } from './PublishedListingStatusView';
import { useEffect, useRef, type ReactNode } from 'react';
import { NavigationConfirmation } from '../../../shared/components/NavigationConfirmation';
import { Modal, StatusBar, StyleSheet, View, Text } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import { usePropertyListingViewModel } from '../viewModels/usePropertyListingViewModel';
import { CreateListingView } from './CreateListingView';
import { ListingComposerView } from './ListingComposerView';
import { ListingDetailsView } from './ListingDetailsView';
import { ListingDetailView } from './ListingDetailView';
import { ListingManagementView } from './ListingManagementView';
import { ListingPreviewView } from './ListingPreviewView';
import { PropertyDashboardView } from './PropertyDashboardView';

export interface PropertyListingFlowViewProps {
 accountId?:string|undefined;
 requestActivity?:((item:LandlordPortfolioItem)=>PortfolioRequestActivity|null)|undefined;
  renderPropertyVerification?: (propertyId:string,onClose:()=>void,registerBack:(action:(()=>void)|null)=>void)=>ReactNode;
  initialScreen?: 'dashboard' | 'postingType';
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
  onClose: () => void;
  onRootBack: () => void;
  onOpenDiscover: () => void;
  onOpenPriceEstimate: () => void;
  onOpenChat: () => void;
  onOpenMaintenance: () => void;
}

const createScreens = new Set([
  'postingType',
  'propertySetup',
  'photoUpload',
  'photoManager',
  'basicInfo',
  'specifications',
  'address',
  'mapConfirm',
  'amenities',
  'rentTerms',
  'description',
  'rules',
  'availability',
]);

const previewScreens = new Set(['preview', 'missingRequirements', 'publishConfirmation']);

const managementScreens = new Set([
  'management',
  'editListing',
  'pauseConfirmation',
  'reactivateConfirmation',
  'unavailableConfirmation',
  'archiveConfirmation',
]);

export function PropertyListingFlowView({
  accountId,
  renderPropertyVerification,
  requestActivity,
  initialScreen = 'dashboard',
  registerBackAction,
  onClose,
  onRootBack,
  onOpenDiscover,
  onOpenPriceEstimate,
  onOpenChat,
  onOpenMaintenance,
}: PropertyListingFlowViewProps) {
  const viewModel = usePropertyListingViewModel(initialScreen);
  const verificationBack=useRef<(()=>void)|null>(null);
  const verificationPropertyId=viewModel.propertyVerificationState.entryPropertyId;
  const close = () => viewModel.requestNavigation(onClose);
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onRootBack));
    return () => registerBackAction?.(null);
  });
  const estimateTarget=viewModel.workspaceListingId?{listingId:viewModel.workspaceListingId}:viewModel.workspacePropertyId?{propertyId:viewModel.workspacePropertyId}:null;
  const estimateSection=estimateTarget?<InlineRentalEstimate key={`${accountId}:${JSON.stringify(estimateTarget)}:${viewModel.screen}`} accountId={accountId} target={estimateTarget} property={viewModel.estimationProperty} onReview={viewModel.estimationProperty?.landlord_id===accountId&&viewModel.propertyEditAvailable&&viewModel.screen!=='propertyEdit'?viewModel.openPropertyDetails:undefined}/>:null;
  const priceGuidance=<RentalPriceGuidance key={`${accountId}:${viewModel.workspacePropertyId}:${viewModel.screen}`} accountId={accountId} target={viewModel.workspacePropertyId?{propertyId:viewModel.workspacePropertyId}:null} property={viewModel.estimationProperty} onUseEstimate={viewModel.applyRentalEstimate} disabled={viewModel.listingDraftReadOnly||!!viewModel.composerPhase||viewModel.listingDraftState.busy||viewModel.unfinishedPostState.busy}/>;
  let content;

  if(viewModel.screen!=='dashboard'&&viewModel.unfinishedPostState.status?.propertyId===viewModel.workspacePropertyId&&viewModel.unfinishedPostState.status?.state==='cleanup_pending'){
    content=<View style={{padding:24,gap:12}}><Text accessibilityRole="header">Finishing post deletion</Text><Text>The post was removed. Owned photos still need cleanup. Retry below, or return to My Rentals.</Text><ListingButton label="Back to My Rentals" tone="outline" disabled={viewModel.unfinishedPostState.busy} onPress={viewModel.goDashboard}/></View>;
  } else if (viewModel.screen === 'dashboard' || viewModel.screen === 'empty') {
    content = <PropertyDashboardView viewModel={viewModel} requestActivity={requestActivity}/>;
  } else if (viewModel.screen === 'published' && viewModel.showRealPublication && viewModel.realListing) {
    content = <PublishedListingStatusView estimateSection={estimateSection} viewModel={viewModel} onClose={close} />;
  } else if (viewModel.screen === 'identityEdit') {
    content=<PropertyIdentityEditView viewModel={viewModel} onClose={close}/>;
  } else if (viewModel.screen === 'propertyEdit') {
    content=<PropertyRoutineEditView estimateSection={estimateSection} viewModel={viewModel} onClose={close}/>;
  } else if (viewModel.screen === 'draftSaved') {
    content = <ListingDraftSavedView viewModel={viewModel} onClose={close} />;
  } else if(viewModel.screen==='postingEstimate'&&viewModel.postingWizard){
    content=<PostingPriceStep accountId={accountId} viewModel={viewModel} onClose={close}/>;
  } else if(viewModel.screen==='postingReview'&&viewModel.postingWizard){
    content=<PostingReviewView viewModel={viewModel} onClose={close}/>;
  } else if (viewModel.screen === 'listingComposer') {
    content = <ListingComposerView estimateSection={estimateSection} viewModel={viewModel} onClose={close} />;
  } else if (viewModel.screen === 'listingDetails') {
    content = <ListingDetailsView priceGuidance={priceGuidance} viewModel={viewModel} onClose={close} />;
  } else if (createScreens.has(viewModel.screen)) {
    content = <CreateListingView onClose={close} viewModel={viewModel} />;
  } else if (previewScreens.has(viewModel.screen)) {
    content = <ListingPreviewView onClose={close} viewModel={viewModel} />;
  } else if (managementScreens.has(viewModel.screen)) {
    content = (
      <ListingManagementView
        onClose={close}
        estimateSection={estimateSection}
        viewModel={viewModel}
      />
    );
  } else {
    content = (
      <ListingDetailView
        onClose={close}
        estimateSection={estimateSection}
        viewModel={viewModel}
      />
    );
  }


  // The bottom navigation is hidden on the wizard steps; everywhere else it owns the bottom edge.
  const showNavigation=!(viewModel.postingWizard&&['listingComposer','listingDetails','postingEstimate','postingReview','publishConfirmation'].includes(viewModel.screen));

  return (
    <ScreenContainer includeBottomInset={false} padded={false} bottomChrome={showNavigation}>
      {verificationPropertyId && renderPropertyVerification ? <Modal key={verificationPropertyId} visible presentationStyle="fullScreen" onRequestClose={()=>verificationBack.current?.()}>
        {renderPropertyVerification(verificationPropertyId,viewModel.closePropertyVerification,action=>{verificationBack.current=action;})}
      </Modal> : null}
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      {['dashboard','listingComposer','listingDetails','propertyEdit','postingEstimate','postingReview'].includes(viewModel.screen)?<UnfinishedPostDeletionAction viewModel={viewModel}/>:null}
      <NavigationConfirmation title={viewModel.propertyReturnConfirmation?"Discard property edits?":"Leave Property & Listing Management?"} body={viewModel.propertyReturnConfirmation?"Your listing edits will be kept. Continue without saving these property changes?":"You have unsaved property, photo, or listing changes. Stay to continue editing, or leave without saving."} visible={viewModel.navigationConfirmation} onCancel={viewModel.cancelNavigation} onConfirm={viewModel.confirmNavigation} />
      {showNavigation?<RentLeaseBottomNavigation
        active={viewModel.activeTab}
        onChat={() => viewModel.requestNavigation(onOpenChat)}
        onDiscover={() => viewModel.requestNavigation(onOpenDiscover)}
        onListing={viewModel.goDashboard}
        onPost={viewModel.openPostingType}
        onTenancy={() => viewModel.requestNavigation(onOpenMaintenance)}
      />:null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
