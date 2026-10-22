import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';
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
import { initialMarketplaceWorkspace, propertiesWorkspace, switchMarketplaceMode, type AppWorkspace } from './src/shared/models/marketplaceNavigation';
import type { MatchingPreferences } from './src/features/search-discovery/models/SearchDiscovery';
import { RentalPriceEstimationFlowView } from './src/features/rental-price-estimation/views/RentalPriceEstimationFlowView';
import { SearchDiscoveryFlowView } from './src/features/search-discovery/views/SearchDiscoveryFlowView';

traceAuthBoot('APP_MODULE_READY');

export default function App() {
  const auth = useAuthProfilesViewModel();
  const [preferredRole, setPreferredRole] = useState<UserRole>('tenant');
  const accountRole: UserRole = auth.hasLandlordRole && (!auth.hasTenantRole || preferredRole === 'landlord') ? 'landlord' : 'tenant';
  const [workspace, setWorkspace] = useState<AppWorkspace>(null);
  const [savedPreferences, setSavedPreferences] = useState<{ userId: string; value: MatchingPreferences } | null>(null);
  const handledIntroduction = useRef(0);
  const workspaceBackAction = useRef<(() => void) | null>(null);
  const registerWorkspaceBack = useCallback((action: (() => void) | null) => { workspaceBackAction.current = action; }, []);
  const workspaceDestination = auth.account ? getWorkspaceDestination(auth.account) : null;
  const canEnterAdmin = workspaceDestination === 'adminModeration';
  const canEnterMarketplace = workspaceDestination === 'discovery' && !auth.matchingIntroductionGate;
  const access = { marketplace: canEnterMarketplace, admin: canEnterAdmin, tenant: auth.hasTenantRole, landlord: auth.hasLandlordRole };
  useEffect(() => {
    traceAuthBoot('APP_MOUNT', { initialMetricsPresent: initialWindowMetrics !== null });
    return () => traceAuthBoot('APP_UNMOUNT');
  }, []);
  useEffect(() => {
    traceAuthBoot('APP_DESTINATION', { screen: auth.screen, asyncState: auth.asyncState,
      accountPresent: auth.account !== null, destination: workspaceDestination, workspace: workspace?.type ?? null,
      modalVisible: workspace !== null && (workspace.type === 'adminModeration' ? canEnterAdmin : canEnterMarketplace) });
  }, [auth.screen, auth.asyncState, auth.account, workspaceDestination, workspace, canEnterAdmin, canEnterMarketplace]);
  const openProperties = (initialScreen: 'dashboard' | 'postingType') => {
    const next = propertiesWorkspace(access, initialScreen);
    if (next) { setPreferredRole('landlord'); setWorkspace(next); }
  };

  const switchMode = (mode: UserRole) => {
    const next = switchMarketplaceMode(access, mode);
    if (next) { setPreferredRole(next.mode); setWorkspace(next.workspace); }
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
      setPreferredRole('tenant');
      setSavedPreferences(null);
      handledIntroduction.current = 0;
    }
  }, [auth.signedOutVersion]);

  useEffect(() => {
    if (canEnterMarketplace && workspace?.type === 'properties' && !auth.hasLandlordRole) setWorkspace({ type: 'discovery', initialScreen: 'home' });
  }, [canEnterMarketplace, auth.hasLandlordRole, workspace?.type]);

  return (
    <SafeAreaProvider>
      <AuthProfilesFlowView
        viewModel={auth}
        activeRole={accountRole}
        onSwitchRole={switchMode}
        onOpenAdminModeration={() => { if (canEnterAdmin) setWorkspace({ type: 'adminModeration' }); }}
        onOpenDiscovery={() => { if (canEnterMarketplace) setWorkspace({ type: 'discovery', initialScreen: 'home' }); }}
        onOpenMatchingPreferences={() => { if (canEnterMarketplace) setWorkspace({ type: 'discovery', initialScreen: 'matchingPreferences' }); }}
        onOpenNotifications={() => { if (canEnterMarketplace) setWorkspace({ type: 'notifications' }); }}
        onOpenProperties={() => openProperties('dashboard')}
        onOpenRatingsReports={() => { if (canEnterMarketplace) setWorkspace({ type: 'ratingsReports' }); }}
        onOpenVerification={() => { if (canEnterMarketplace) setWorkspace({ type: 'verification' }); }}
      />

      <Modal
        key={auth.account?.user.id ?? 'signed-out'}
        animationType="slide"
        onRequestClose={() => {
          if (workspaceBackAction.current) workspaceBackAction.current();
          else setWorkspace(null);
        }}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={workspace !== null && (workspace?.type === 'adminModeration' ? canEnterAdmin : canEnterMarketplace)}
      >
        {workspace?.type === 'verification' && canEnterMarketplace ? (
          <UserVerificationFlowView tierOneVerified={!!auth.account?.profile.tier1_verified_at} hasLandlordRole={auth.hasLandlordRole} onClose={() => setWorkspace(null)} registerBackAction={registerWorkspaceBack} />
        ) : null}
        {workspace?.type === 'discovery' ? (
          <SearchDiscoveryFlowView
            initialScreen={workspace.initialScreen}
            introduction={workspace.introduction ?? false}
            initialPreferences={savedPreferences && savedPreferences.userId === auth.account?.user.id ? savedPreferences.value : undefined}
            onSavePreferences={(value) => { if (auth.account) setSavedPreferences({ userId: auth.account.user.id, value }); }}
            onIntroductionComplete={finishMatchingIntroduction}
            registerBackAction={registerWorkspaceBack}
            isLandlord={auth.hasLandlordRole}
            onClose={() => setWorkspace(null)}
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
            onStartInquiry={() =>
              setWorkspace({ type: 'messages', initialScreen: 'newInquiry' })
            }
          />
        ) : null}
        {workspace?.type === 'properties' && auth.hasLandlordRole ? (
          <PropertyListingFlowView
            registerBackAction={registerWorkspaceBack}
            initialScreen={workspace.initialScreen}
            onClose={() => setWorkspace(null)}
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenPriceEstimate={() =>
              setWorkspace({ type: 'priceEstimate', actor: 'landlord', returnTo: 'properties' })
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'priceEstimate' ? (
          <RentalPriceEstimationFlowView
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
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'messages' ? (
          <MessagingViewingFlowView
            actor={accountRole}
            initialScreen={workspace.initialScreen}
            isLandlord={auth.hasLandlordRole}
            onClose={() => setWorkspace(null)}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'maintenance' ? (
          <MaintenanceRequestsFlowView
            actor={accountRole}
            isLandlord={auth.hasLandlordRole}
            onClose={() => setWorkspace(null)}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              openProperties('dashboard')
            }
          />
        ) : null}
        {workspace?.type === 'ratingsReports' ? (
          <RatingsReportsFlowView
            actor={accountRole}
            isLandlord={auth.hasLandlordRole}
            onClose={() => setWorkspace(null)}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              openProperties('dashboard')
            }
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'adminModeration' && auth.isAdmin ? (
          <AdminModerationFlowView onClose={() => setWorkspace(null)} />
        ) : null}
        {workspace?.type === 'notifications' ? (
          <NotificationsFlowView
            isLandlord={auth.hasLandlordRole}
            onClose={() => setWorkspace(null)}
            onCreateListing={() =>
              openProperties('postingType')
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
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
