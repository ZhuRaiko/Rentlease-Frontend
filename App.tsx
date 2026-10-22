import { useMarketplaceExitConfirmation } from './src/shared/viewModels/useMarketplaceExitConfirmation';
import { profileAfterDismissal, profileBackTarget, resolveProfileReturn, type ProfileReturnTarget } from './src/shared/models/profileReturn';
import { RentLeaseBottomNavigation } from './src/shared/components/RentLeaseBottomNavigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Modal } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { traceAuthBoot } from './src/shared/utils/authBootTrace';

import type { UserRole } from './src/features/authentication/models/AuthProfile';
import { getWorkspaceDestination } from './src/features/authentication/models/accountRouting';
import { AuthProfilesFlowView } from './src/features/authentication/views/AuthProfilesFlowView';
import { useAuthProfilesViewModel } from './src/features/authentication/viewModels/useAuthProfilesViewModel';
import { UserVerificationFlowView } from './src/features/user-verification/views/UserVerificationFlowView';
import { AdminModerationFlowView } from './src/features/admin-moderation/views/AdminModerationFlowView';
import { MessagingViewingFlowView } from './src/features/messaging-viewing/views/MessagingViewingFlowView';
import { MaintenanceRequestsFlowView } from './src/features/maintenance/views/MaintenanceRequestsFlowView';
import { NotificationsFlowView } from './src/features/notifications/views/NotificationsFlowView';
import { PropertyListingFlowView } from './src/features/property-listing/views/PropertyListingFlowView';
import { RatingsReportsFlowView } from './src/features/ratings-reports/views/RatingsReportsFlowView';
import { initialMarketplaceWorkspace, propertiesWorkspace, type AppWorkspace } from './src/shared/models/marketplaceNavigation';
import type { MatchingPreferences } from './src/features/search-discovery/models/SearchDiscovery';
import { RentalPriceEstimationFlowView } from './src/features/rental-price-estimation/views/RentalPriceEstimationFlowView';
import { SearchDiscoveryFlowView } from './src/features/search-discovery/views/SearchDiscoveryFlowView';

traceAuthBoot('APP_MODULE_READY');

export default function App() {
  const auth = useAuthProfilesViewModel();
  const [preferredRole, setPreferredRole] = useState<UserRole>('tenant');
  const accountRole: UserRole = auth.hasLandlordRole && (!auth.hasTenantRole || preferredRole === 'landlord') ? 'landlord' : 'tenant';
  const [workspace, setWorkspace] = useState<AppWorkspace>(null);
  const [profileReturnTarget, setProfileReturnTarget] = useState<ProfileReturnTarget | null>(null);
  const [savedPreferences, setSavedPreferences] = useState<{ userId: string; value: MatchingPreferences } | null>(null);
  const handledIntroduction = useRef(0);
  const workspaceBackAction = useRef<{ workspace: AppWorkspace; userId: string | null; action: () => void } | null>(null);
  const registerWorkspaceBack = useCallback((action: (() => void) | null) => {
    if (action) workspaceBackAction.current = { workspace, userId: auth.account?.user.id ?? null, action };
    else if (workspaceBackAction.current?.workspace === workspace) workspaceBackAction.current = null;
  }, [workspace, auth.account?.user.id]);
  const workspaceDestination = auth.account ? getWorkspaceDestination(auth.account) : null;
  const canEnterAdmin = workspaceDestination === 'adminModeration';
  const canEnterMarketplace = workspaceDestination === 'discovery' && !auth.matchingIntroductionGate;
  const access = { marketplace: canEnterMarketplace, admin: canEnterAdmin, tenant: auth.hasTenantRole, landlord: auth.hasLandlordRole };
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
  const validProfileReturn = resolveProfileReturn(profileReturnTarget, auth.account?.user.id ?? null, access);
  const allowedProfileReturn = profileBackTarget(profileReturnTarget, auth.account?.user.id ?? null, accountRole, access);
  const openProfile = () => {
    setProfileReturnTarget(profileAfterDismissal(profileReturnTarget, auth.account?.user.id ?? null, workspace, accountRole, access));
    setWorkspace(null);
  };
  const returnFromProfile = () => {
    if (!allowedProfileReturn) return;
    setPreferredRole(allowedProfileReturn.mode);
    setWorkspace(allowedProfileReturn.workspace);
    setProfileReturnTarget(null);
  };
  useEffect(() => {
    if (profileReturnTarget && !validProfileReturn) setProfileReturnTarget(null);
  }, [auth.account?.user.id, canEnterMarketplace, canEnterAdmin, auth.hasLandlordRole, auth.hasTenantRole, profileReturnTarget]);
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
    if (next) { setPreferredRole('landlord'); setWorkspace(next); }
    else if (canEnterMarketplace) auth.setNotice('Listings and posting require the Landlord role. You can browse homes in Discover.');
  };

  const openDiscovery = () => {
    if (!canEnterMarketplace) return;
    setPreferredRole(auth.hasTenantRole ? 'tenant' : 'landlord');
    setWorkspace({ type: 'discovery', initialScreen: 'home' });
  };
  const finishMatchingIntroduction = async () => {
    if (!await auth.completeMatchingIntroduction()) return false;
    setWorkspace(initialMarketplaceWorkspace(access, accountRole));
    return true;
  };

  useEffect(() => {
    if (auth.entryVersion === 0 || !workspaceDestination || (workspaceDestination === 'discovery' && !canEnterMarketplace)) return;
    if (handledIntroduction.current === auth.entryVersion) return;
    handledIntroduction.current = auth.entryVersion;
    const mode = auth.hasTenantRole ? 'tenant' : 'landlord';
    const offer = canEnterMarketplace && auth.matchingIntroductionRequired;
    setPreferredRole(mode);
    setSavedPreferences(current => current?.userId === auth.account?.user.id ? current : null);
    setWorkspace(offer ? { type: 'discovery', initialScreen: 'matchingPreferences', introduction: true } : initialMarketplaceWorkspace(access, mode));
  }, [auth.entryVersion, workspaceDestination, auth.matchingIntroductionRequired, canEnterMarketplace]);

  useEffect(() => {
    if (auth.signedOutVersion > 0) {
      setWorkspace(null);
      setProfileReturnTarget(null);
      setPreferredRole('tenant');
      setSavedPreferences(null);
      handledIntroduction.current = 0;
    }
  }, [auth.signedOutVersion]);

  useEffect(() => {
    if (!workspace) return;
    if ((workspace.type === 'adminModeration' && !canEnterAdmin) || (workspace.type !== 'adminModeration' && !canEnterMarketplace)) { setWorkspace(null); return; }
    if (canEnterMarketplace && !auth.hasLandlordRole && (workspace.type === 'properties' || (workspace.type === 'priceEstimate' && workspace.actor === 'landlord'))) setWorkspace({ type: 'discovery', initialScreen: 'home' });
  }, [canEnterMarketplace, canEnterAdmin, auth.hasLandlordRole, workspace]);

  return (
    <SafeAreaProvider>
      <AuthProfilesFlowView
        viewModel={auth}
        onProfileBack={!workspace && allowedProfileReturn ? returnFromProfile : undefined}
        marketplaceNavigation={canEnterMarketplace ? <RentLeaseBottomNavigation active={null}
          onDiscover={openDiscovery}
          onListing={() => openProperties('dashboard')}
          onPost={() => openProperties('postingType')}
          onTenancy={() => setWorkspace({ type: 'maintenance' })}
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
          <UserVerificationFlowView tierOneVerified={!!auth.account?.profile.tier1_verified_at} hasLandlordRole={auth.hasLandlordRole} onClose={openProfile} registerBackAction={registerWorkspaceBack} />
        ) : null}
        {workspace?.type === 'discovery' ? (
          <SearchDiscoveryFlowView
            onRootBack={requestMarketplaceExit}
            initialScreen={workspace.initialScreen}
            introduction={workspace.introduction ?? false}
            initialPreferences={savedPreferences && savedPreferences.userId === auth.account?.user.id ? savedPreferences.value : undefined}
            onSavePreferences={(value) => { if (auth.account) setSavedPreferences({ userId: auth.account.user.id, value }); }}
            onIntroductionComplete={finishMatchingIntroduction}
            registerBackAction={registerWorkspaceBack}
            isLandlord={auth.hasLandlordRole}
            onClose={openProfile}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenPriceEstimate={() =>
              setWorkspace({ type: 'priceEstimate', actor: 'tenant', returnTo: 'discovery' })
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
            onOpenNotifications={() => { if (canEnterMarketplace) setWorkspace({ type: 'notifications' }); }}
            onStartInquiry={() =>
              setWorkspace({ type: 'messages', initialScreen: 'newInquiry' })
            }
          />
        ) : null}
        {workspace?.type === 'properties' && auth.hasLandlordRole ? (
          <PropertyListingFlowView
            onRootBack={openDiscovery}
            registerBackAction={registerWorkspaceBack}
            initialScreen={workspace.initialScreen}
            onClose={openProfile}
            onOpenDiscover={openDiscovery}
            onOpenPriceEstimate={() =>
              setWorkspace({ type: 'priceEstimate', actor: 'landlord', returnTo: 'properties' })
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'priceEstimate' ? (
          <RentalPriceEstimationFlowView
            registerBackAction={registerWorkspaceBack}
            actor={workspace.actor}
            isLandlord={auth.hasLandlordRole}
            onClose={() =>
              setWorkspace(
                workspace.returnTo === 'properties' && auth.hasLandlordRole
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
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'messages' ? (
          <MessagingViewingFlowView
            onRootBack={openDiscovery}
            registerBackAction={registerWorkspaceBack}
            actor={accountRole}
            initialScreen={workspace.initialScreen}
            isLandlord={auth.hasLandlordRole}
            onClose={openProfile}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenDiscover={openDiscovery}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'maintenance' ? (
          <MaintenanceRequestsFlowView
            onRootBack={openDiscovery}
            registerBackAction={registerWorkspaceBack}
            actor={accountRole}
            isLandlord={auth.hasLandlordRole}
            onClose={openProfile}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={openDiscovery}
            onOpenListings={() =>
              openProperties('dashboard')
            }
          />
        ) : null}
        {workspace?.type === 'ratingsReports' ? (
          <RatingsReportsFlowView
            registerBackAction={registerWorkspaceBack}
            actor={accountRole}
            isLandlord={auth.hasLandlordRole}
            onClose={openProfile}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={openDiscovery}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'adminModeration' && auth.isAdmin ? (
          <AdminModerationFlowView registerBackAction={registerWorkspaceBack} onClose={openProfile} />
        ) : null}
        {workspace?.type === 'notifications' ? (
          <NotificationsFlowView
            registerBackAction={registerWorkspaceBack}
            isLandlord={auth.hasLandlordRole}
            onClose={openDiscovery}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={openDiscovery}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
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
