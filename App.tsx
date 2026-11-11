import {useInAppNotifications} from './src/features/notifications/viewModels/useInAppNotifications';
import {TenancyDetailsView} from './src/features/tenancy/views/TenancyDetailsView';
import {ReportingWorkspace} from './src/shared/components/Reporting';
import {TenancyCareWorkspaceView} from './src/features/tenancy/views/TenancyCareWorkspaceView';
import {TenancySetupView} from './src/features/tenancy/views/TenancySetupView';
import {TenancyWorkspaceView} from './src/features/tenancy/views/TenancyWorkspaceView';
import {OwnedPropertiesWorkspace} from './src/app/OwnedPropertiesWorkspace';
import {LivePropertyDetailView} from './src/features/search-discovery/views/LiveSearchViews';
import {useListingDetailViewModel} from './src/features/search-discovery/viewModels/useListingDetailViewModel';
import { useMarketplaceExitConfirmation } from './src/shared/viewModels/useMarketplaceExitConfirmation';
import { profileAfterDismissal, profileBackTarget, resolveProfileReturn, type ProfileReturnTarget } from './src/shared/models/profileReturn';
import { RentLeaseBottomNavigation } from './src/shared/components/RentLeaseBottomNavigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal, View } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { traceAuthBoot } from './src/shared/utils/authBootTrace';

import type { UserRole } from './src/features/authentication/models/AuthProfile';
import { getWorkspaceDestination } from './src/features/authentication/models/accountRouting';
import { AuthProfilesFlowView } from './src/features/authentication/views/AuthProfilesFlowView';
import { useAuthProfilesViewModel } from './src/features/authentication/viewModels/useAuthProfilesViewModel';
import { UserVerificationFlowView } from './src/features/user-verification/views/UserVerificationFlowView';
import { AdminModerationFlowView } from './src/features/admin-moderation/views/AdminModerationFlowView';
import { MessagingViewingFlowView } from './src/features/messaging-viewing/views/MessagingViewingFlowView';
import { NotificationsFlowView } from './src/features/notifications/views/NotificationsFlowView';
import { RatingsReportsFlowView } from './src/features/ratings-reports/views/RatingsReportsFlowView';
import { defaultMarketplaceMode, defaultPreviewActor, initialMarketplaceWorkspace, propertiesWorkspace, type AppWorkspace } from './src/shared/models/marketplaceNavigation';
import type { MatchingPreferences } from './src/features/search-discovery/models/SearchDiscovery';
import { RentalPriceEstimationFlowView } from './src/features/rental-price-estimation/views/RentalPriceEstimationFlowView';
import { SearchDiscoveryFlowView } from './src/features/search-discovery/views/SearchDiscoveryFlowView';

traceAuthBoot('APP_MODULE_READY');

export default function App() {
  const auth = useAuthProfilesViewModel();
  const discoveryHomeAction=useRef<(()=>void)|null>(null);
  const [tenancyConversation,setTenancyConversation]=useState<{owner:string;id:string}|null>(null);
  const [inquiryConversation,setInquiryConversation]=useState<{userId:string;id:string}|null>(null);
  const [activityMode, setActivityMode] = useState<UserRole>('tenant');
  const previewActor: UserRole = activityMode;
  const [workspace, setWorkspace] = useState<AppWorkspace>(null);
  const [profileReturnTarget, setProfileReturnTarget] = useState<ProfileReturnTarget | null>(null);
  const [savedPreferences, setSavedPreferences] = useState<{ userId: string; value: MatchingPreferences } | null>(null);
  const handledIntroduction = useRef(0);
  const workspaceBackAction = useRef<{ workspace: AppWorkspace; userId: string | null; action: () => void } | null>(null);
  const registerWorkspaceBack = useCallback((action: (() => void) | null) => {
    if (action) workspaceBackAction.current = { workspace, userId: auth.account?.user.id ?? null, action };
    else if (workspaceBackAction.current?.workspace === workspace) workspaceBackAction.current = null;
  }, [workspace, auth.account?.user.id]);
  const renderTenancySetup=(id:string,onBack:()=>void,onChanged:()=>void)=><TenancySetupView key={`${auth.account?.user.id}:${id}`} accountId={auth.account?.user.id} reservationId={id} onBack={onBack} onChanged={onChanged} registerBackAction={registerWorkspaceBack}/>;
  const workspaceDestination = auth.account ? getWorkspaceDestination(auth.account) : null;
  const canEnterAdmin = workspaceDestination === 'adminModeration';
  const canEnterMarketplace = workspaceDestination === 'discovery' && !auth.matchingIntroductionGate;
  const notifications=useInAppNotifications(canEnterMarketplace||canEnterAdmin?auth.account?.user.id:undefined);
  const access = { marketplace: canEnterMarketplace, admin: canEnterAdmin };
  const requestMarketplaceExit = useMarketplaceExitConfirmation(workspace, auth.account?.user.id ?? null, canEnterMarketplace && !canEnterAdmin);
  useEffect(() => {
    traceAuthBoot('APP_MOUNT', { initialMetricsPresent: initialWindowMetrics !== null });
    return () => traceAuthBoot('APP_UNMOUNT');
  }, []);
  useEffect(() => {
    traceAuthBoot('APP_DESTINATION', { screen: auth.screen, asyncState: auth.asyncState,
      accountPresent: auth.account !== null, destination: workspaceDestination, workspace: workspace?.type ?? null,
      modalVisible: workspace !== null && (workspace.type === 'adminModeration' ? canEnterAdmin : canEnterMarketplace) });
  }, [auth.screen, auth.asyncState, auth.account, workspaceDestination, workspace, canEnterAdmin, canEnterMarketplace]);
  useEffect(()=>{if(workspace?.type!=='tenancy'||tenancyConversation?.owner!==auth.account?.user.id)setTenancyConversation(null);},[workspace?.type,auth.account?.user.id]);
  useEffect(()=>{if(workspace?.type!=='discovery'||inquiryConversation?.userId!==auth.account?.user.id)setInquiryConversation(null);},[workspace?.type,auth.account?.user.id]);
  const validProfileReturn = resolveProfileReturn(profileReturnTarget, auth.account?.user.id ?? null, access);
  const allowedProfileReturn = profileBackTarget(profileReturnTarget, auth.account?.user.id ?? null, previewActor, access);
  const openProfile = () => {
    setProfileReturnTarget(profileAfterDismissal(profileReturnTarget, auth.account?.user.id ?? null, workspace, previewActor, access));
    setWorkspace(null);
    void auth.refreshProfile();
  };
  const returnFromProfile = () => {
    if (!allowedProfileReturn) return;
    setActivityMode(allowedProfileReturn.mode);
    setWorkspace(allowedProfileReturn.workspace);
    setProfileReturnTarget(null);
  };
  useEffect(() => {
    if (profileReturnTarget && !validProfileReturn) setProfileReturnTarget(null);
  }, [auth.account?.user.id, canEnterMarketplace, canEnterAdmin, profileReturnTarget]);
  useEffect(() => {
    if (workspace || !['profile', 'editProfile', 'settings'].includes(auth.screen) || auth.showSignOutConfirmation) return;
    if (auth.screen === 'profile' && !allowedProfileReturn) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (auth.screen === 'profile') returnFromProfile();
      else if (auth.asyncState !== 'loading') auth.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [workspace, auth.screen, allowedProfileReturn, auth.showSignOutConfirmation]);

  const workspaceOwner = useRef(auth.account?.user.id ?? null);
  useEffect(() => {
    const userId = auth.account?.user.id ?? null;
    if (workspaceOwner.current !== userId || (!canEnterMarketplace && !canEnterAdmin)) {
      setWorkspace(null);
      setProfileReturnTarget(null);
      workspaceBackAction.current = null;
    }
    workspaceOwner.current = userId;
  }, [auth.account?.user.id, canEnterMarketplace, canEnterAdmin]);

  const openProperties = (initialScreen: 'dashboard' | 'postingType') => {
    const next = propertiesWorkspace(access, initialScreen);
    if (next) { setActivityMode('landlord'); setWorkspace(next); }
  };

  const openDiscovery = () => {
    if (!canEnterMarketplace) return;
    setActivityMode(defaultPreviewActor(auth.roles));
    setWorkspace({ type: 'discovery', initialScreen: 'home' });
  };
  const finishMatchingIntroduction = async () => {
    if (!await auth.completeMatchingIntroduction()) return false;
    setWorkspace(initialMarketplaceWorkspace(access, defaultMarketplaceMode(auth.account?.profile.experience_preference)));
    return true;
  };

  useEffect(() => {
    if (auth.entryVersion === 0 || !workspaceDestination || (workspaceDestination === 'discovery' && !canEnterMarketplace)) return;
    if (handledIntroduction.current === auth.entryVersion) return;
    handledIntroduction.current = auth.entryVersion;
    const mode = defaultMarketplaceMode(auth.account?.profile.experience_preference);
    const offer = canEnterMarketplace && auth.matchingIntroductionRequired;
    setActivityMode(defaultPreviewActor(auth.roles));
    setSavedPreferences(current => current?.userId === auth.account?.user.id ? current : null);
    setWorkspace(offer ? { type: 'discovery', initialScreen: 'matchingPreferences', introduction: true } : initialMarketplaceWorkspace(access, mode));
  }, [auth.entryVersion, workspaceDestination, auth.matchingIntroductionRequired, canEnterMarketplace]);

  useEffect(() => {
    if (auth.signedOutVersion > 0) {
      setWorkspace(null);
      setProfileReturnTarget(null);
      setActivityMode('tenant');
      setSavedPreferences(null);
      handledIntroduction.current = 0;
    }
  }, [auth.signedOutVersion]);

  useEffect(() => {
    if (!workspace) return;
    if ((workspace.type === 'adminModeration' && !canEnterAdmin) || (workspace.type !== 'adminModeration' && !canEnterMarketplace)) { setWorkspace(null); return; }
  }, [canEnterMarketplace, canEnterAdmin, workspace]);

  const renderPropertyVerification = (propertyId:string,onReturn:()=>void,registerBack:(action:(()=>void)|null)=>void) => (
    <UserVerificationFlowView initialPropertyId={propertyId} tierOneVerified={!!auth.account?.profile.tier1_verified_at} onClose={onReturn} registerBackAction={registerBack}/>
  );
  return (
    <SafeAreaProvider>
      <AuthProfilesFlowView
        viewModel={auth}
        onProfileBack={!workspace && allowedProfileReturn ? returnFromProfile : undefined}
        marketplaceNavigation={canEnterMarketplace ? <RentLeaseBottomNavigation active={null}
          onDiscover={openDiscovery}
          onListing={() => openProperties('dashboard')}
          onPost={() => openProperties('postingType')}
          onTenancy={() => setWorkspace({ type: 'tenancy' })}
          onChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })} /> : undefined}
        onOpenAdminModeration={() => { if (canEnterAdmin) setWorkspace({ type: 'adminModeration' }); }}
        onOpenMatchingPreferences={() => { if (canEnterMarketplace) setWorkspace({ type: 'discovery', initialScreen: 'matchingPreferences' }); }}
        onOpenRatingsReports={() => { if (canEnterMarketplace) setWorkspace({ type: 'ratingsReports' }); }}
        onOpenVerification={() => { if (canEnterMarketplace) setWorkspace({ type: 'verification' }); }}
      />

      <Modal
        key={auth.account?.user.id ?? 'signed-out'}
        animationType="slide"
        onRequestClose={() => {
          const registered = workspaceBackAction.current;
          if (registered?.workspace === workspace && registered?.userId === auth.account?.user.id) registered.action();
          // Every mounted workspace registers its own Back action; never bypass its guard.
        }}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={workspace !== null && (workspace?.type === 'adminModeration' ? canEnterAdmin : canEnterMarketplace)}
      >
        {workspace?.type === 'verification' && canEnterMarketplace ? (
          <UserVerificationFlowView tierOneVerified={!!auth.account?.profile.tier1_verified_at} onClose={openProfile} registerBackAction={registerWorkspaceBack} />
        ) : null}
        {workspace?.type === 'discovery' ? (
          <View style={{flex:1}}><SearchDiscoveryFlowView notificationUnread={notifications.page?.unread??null}
            accountId={auth.account?.user.id}
            onRootBack={requestMarketplaceExit}
            initialScreen={workspace.initialScreen}
            introduction={workspace.introduction ?? false}
            initialPreferences={savedPreferences && savedPreferences.userId === auth.account?.user.id ? savedPreferences.value : undefined}
            onSavePreferences={(value) => { if (auth.account) setSavedPreferences({ userId: auth.account.user.id, value }); }}
            onIntroductionComplete={finishMatchingIntroduction}
            registerHomeAction={action=>{discoveryHomeAction.current=action;}}
            registerBackAction={inquiryConversation?undefined:registerWorkspaceBack}
            canPostProperty={canEnterMarketplace}
            onClose={openProfile}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenPriceEstimate={() =>
              openDiscovery()
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenMaintenance={() => setWorkspace({ type: 'tenancy' })}
            onOpenNotifications={() => { if (canEnterMarketplace) setWorkspace({ type: 'notifications' }); }}
            onStartInquiry={(id) => { if(auth.account) setInquiryConversation({userId:auth.account.user.id,id}); }}
          />
          {inquiryConversation&&inquiryConversation.userId===auth.account?.user.id?<View style={{position:'absolute',top:0,right:0,bottom:0,left:0}}><MessagingViewingFlowView renderTenancySetup={renderTenancySetup} renderListingDetails={(id,onBack)=><ChatListingDetails key={`${auth.account?.user.id}:${id}`} owner={auth.account?.user.id} id={id} onBack={onBack}/>}
            accountId={auth.account?.user.id} conversationId={inquiryConversation.id} returnToListing
            canPostProperty={canEnterMarketplace} onRootBack={()=>setInquiryConversation(null)} onClose={openProfile} registerBackAction={registerWorkspaceBack}
            onOpenDiscover={()=>{setInquiryConversation(null);discoveryHomeAction.current?.();}} onCreateListing={()=>openProperties('postingType')}
            onOpenListings={()=>openProperties('dashboard')} onOpenMaintenance={()=>setWorkspace({type:'tenancy'})}/></View>:null}</View>
        ) : null}
        {workspace?.type === 'properties' && canEnterMarketplace ? (
          <OwnedPropertiesWorkspace key={auth.account?.user.id} accountId={auth.account?.user.id}
            renderPropertyVerification={renderPropertyVerification}
            onRootBack={openDiscovery}
            registerBackAction={registerWorkspaceBack}
            initialScreen={workspace.initialScreen}
            onClose={openProfile}
            onOpenDiscover={openDiscovery}
            onOpenPriceEstimate={() =>
              openProperties('dashboard')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenMaintenance={() => setWorkspace({ type: 'tenancy' })}
          />
        ) : null}
        {workspace?.type === 'priceEstimate' ? (
          <RentalPriceEstimationFlowView key={auth.account?.user.id} accountId={auth.account?.user.id}
            registerBackAction={registerWorkspaceBack}
            actor={workspace.actor}
            canPostProperty={canEnterMarketplace}
            onClose={() =>
              setWorkspace(
                workspace.returnTo === 'properties' && canEnterMarketplace
                  ? { type: 'properties', initialScreen: 'dashboard' }
                  : { type: 'discovery', initialScreen: 'home' },
              )
            }
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={openDiscovery}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'tenancy' })}
          />
        ) : null}
        {workspace?.type === 'messages' ? (
          <MessagingViewingFlowView renderTenancySetup={renderTenancySetup} renderListingDetails={(id,onBack)=><ChatListingDetails key={`${auth.account?.user.id}:${id}`} owner={auth.account?.user.id} id={id} onBack={onBack}/>}
            accountId={auth.account?.user.id}
            onRootBack={openDiscovery}
            registerBackAction={registerWorkspaceBack}
            actor={previewActor}
            initialScreen={workspace.initialScreen}
            canPostProperty={canEnterMarketplace}
            onClose={openProfile}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenDiscover={openDiscovery}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'tenancy' })}
          />
        ) : null}
        {workspace?.type==='tenancy'?<TenancyWorkspaceView externalPanelOpen={tenancyConversation?.owner===auth.account?.user.id&&!!tenancyConversation} onOpenConversation={id=>{if(auth.account)setTenancyConversation({owner:auth.account.user.id,id});}} key={auth.account?.user.id} accountId={auth.account?.user.id} onBack={openDiscovery} registerBackAction={registerWorkspaceBack} onMaintenance={()=>setWorkspace({type:'maintenance'})} onDiscover={openDiscovery} onListings={()=>openProperties('dashboard')} onPost={()=>openProperties('postingType')} onChat={()=>setWorkspace({type:'messages',initialScreen:'inbox'})}/>:null}
        {workspace?.type==='tenancy'&&tenancyConversation&&tenancyConversation.owner===auth.account?.user.id?<View style={{position:'absolute',top:0,right:0,bottom:0,left:0}}><MessagingViewingFlowView key={`${tenancyConversation.owner}:${tenancyConversation.id}`} accountId={auth.account?.user.id} conversationId={tenancyConversation.id} returnToListing onRootBack={()=>setTenancyConversation(null)} onClose={()=>setTenancyConversation(null)} registerBackAction={registerWorkspaceBack} canPostProperty={canEnterMarketplace} onCreateListing={()=>openProperties('postingType')} onOpenListings={()=>openProperties('dashboard')} onOpenDiscover={openDiscovery} onOpenMaintenance={()=>setTenancyConversation(null)} renderTenancySetup={renderTenancySetup} renderListingDetails={(id,onBack)=><ChatListingDetails key={`${auth.account?.user.id}:${id}`} owner={auth.account?.user.id} id={id} onBack={onBack}/>}/></View>:null}
        {workspace?.type === 'maintenance' ? <TenancyCareWorkspaceView key={auth.account?.user.id} accountId={auth.account?.user.id} onBack={()=>setWorkspace({type:'tenancy'})} registerBackAction={registerWorkspaceBack}/> : null}
        {workspace?.type === 'ratingsReports' ? (
          <RatingsReportsFlowView accountId={auth.account?.user.id}
            registerBackAction={registerWorkspaceBack}
            actor={previewActor}
            canPostProperty={canEnterMarketplace}
            onClose={openProfile}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={openDiscovery}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'tenancy' })}
          />
        ) : null}
        {workspace?.type === 'adminModeration' && auth.isAdmin ? (
          <AdminModerationFlowView accountId={auth.account?.user.id} registerBackAction={registerWorkspaceBack} onClose={openProfile} />
        ) : null}
        {workspace?.type === 'notifications' ? (
          <NotificationsFlowView key={auth.account?.user.id} accountId={auth.account?.user.id} viewModel={notifications}
            renderTarget={(target,onBack)=>target.kind==='conversation'?<MessagingViewingFlowView accountId={auth.account?.user.id} conversationId={target.id} returnToListing onRootBack={onBack} onClose={onBack} registerBackAction={registerWorkspaceBack} canPostProperty={canEnterMarketplace} onCreateListing={()=>openProperties('postingType')} onOpenDiscover={openDiscovery} onOpenListings={()=>openProperties('dashboard')} onOpenMaintenance={()=>setWorkspace({type:'tenancy'})} renderTenancySetup={renderTenancySetup} renderListingDetails={(id,back)=><ChatListingDetails owner={auth.account?.user.id} id={id} onBack={back}/>}/>:target.kind==='tenancy'?<TenancyDetailsView accountId={auth.account?.user.id} tenancyId={target.id} reservationId={null} onBack={onBack} registerBackAction={registerWorkspaceBack}/>:<ReportingWorkspace accountId={auth.account?.user.id} scope={{mode:'mine'}} onBack={onBack} registerBackAction={registerWorkspaceBack}/>}
            registerBackAction={registerWorkspaceBack}
            canPostProperty={canEnterMarketplace}
            onClose={openDiscovery}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={openDiscovery}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'tenancy' })}
            onOpenRatingsReports={() => setWorkspace({ type: 'ratingsReports' })}
            onOpenVerification={() => {
              if (canEnterMarketplace) setWorkspace({ type: 'verification' });
            }}
          />
        ) : null}
      </Modal>

    </SafeAreaProvider>
  );
}

function ChatListingDetails({owner,id,onBack}:{owner:string|undefined;id:string;onBack:()=>void}){
 const viewModel=useListingDetailViewModel(owner,id,onBack);
 return <LivePropertyDetailView viewModel={viewModel} accountId={owner}/>;
}
