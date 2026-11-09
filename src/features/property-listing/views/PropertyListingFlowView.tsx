import {RentalPriceGuidance} from '../../../shared/components/RentalPriceGuidance';
import {InlineRentalEstimate} from '../../../shared/components/InlineRentalEstimate';
import type {LandlordPortfolioItem} from '../models/LandlordPortfolio';
import {PropertyIdentityEditView} from './PropertyIdentityEditView';
import {PropertyRoutineEditView} from './PropertyRoutineEditView';
import { ListingDraftSavedView } from './ListingDraftSavedView';
import { PublishedListingStatusView } from './PublishedListingStatusView';
import { useEffect, useRef, type ReactNode } from 'react';
import { NavigationConfirmation } from '../../../shared/components/NavigationConfirmation';
import { Modal, StatusBar, StyleSheet, View } from 'react-native';

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
 renderRequestControls?:((item:LandlordPortfolioItem)=>ReactNode)|undefined;
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
  renderRequestControls,
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
  const priceGuidance=<RentalPriceGuidance key={`${accountId}:${viewModel.workspacePropertyId}:${viewModel.screen}`} accountId={accountId} target={viewModel.workspacePropertyId?{propertyId:viewModel.workspacePropertyId}:null} property={viewModel.estimationProperty} onUseEstimate={viewModel.applyRentalEstimate} disabled={viewModel.listingDraftReadOnly||!!viewModel.composerPhase||viewModel.listingDraftState.busy}/>;
  let content;

  if (viewModel.screen === 'dashboard' || viewModel.screen === 'empty') {
    content = <PropertyDashboardView viewModel={viewModel} renderRequestControls={renderRequestControls}/>;
  } else if (viewModel.screen === 'published' && viewModel.showRealPublication && viewModel.realListing) {
    content = <PublishedListingStatusView estimateSection={estimateSection} viewModel={viewModel} onClose={close} />;
  } else if (viewModel.screen === 'identityEdit') {
    content=<PropertyIdentityEditView viewModel={viewModel} onClose={close}/>;
  } else if (viewModel.screen === 'propertyEdit') {
    content=<PropertyRoutineEditView estimateSection={estimateSection} viewModel={viewModel} onClose={close}/>;
  } else if (viewModel.screen === 'draftSaved') {
    content = <ListingDraftSavedView viewModel={viewModel} onClose={close} />;
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


  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      {verificationPropertyId && renderPropertyVerification ? <Modal key={verificationPropertyId} visible presentationStyle="fullScreen" onRequestClose={()=>verificationBack.current?.()}>
        {renderPropertyVerification(verificationPropertyId,viewModel.closePropertyVerification,action=>{verificationBack.current=action;})}
      </Modal> : null}
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <NavigationConfirmation title={viewModel.propertyReturnConfirmation?"Discard property edits?":"Leave Property & Listing Management?"} body={viewModel.propertyReturnConfirmation?"Your listing edits will be kept. Continue without saving these property changes?":"You have unsaved property, photo, or listing changes. Stay to continue editing, or leave without saving."} visible={viewModel.navigationConfirmation} onCancel={viewModel.cancelNavigation} onConfirm={viewModel.confirmNavigation} />
      <RentLeaseBottomNavigation
        active={viewModel.activeTab}
        onChat={() => viewModel.requestNavigation(onOpenChat)}
        onDiscover={() => viewModel.requestNavigation(onOpenDiscover)}
        onListing={viewModel.goDashboard}
        onPost={viewModel.openPostingType}
        onTenancy={() => viewModel.requestNavigation(onOpenMaintenance)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
