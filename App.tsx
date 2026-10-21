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
import type { EstimateActor } from './src/features/rental-price-estimation/models/RentalPriceEstimate';
import { RentalPriceEstimationFlowView } from './src/features/rental-price-estimation/views/RentalPriceEstimationFlowView';
import { SearchDiscoveryFlowView } from './src/features/search-discovery/views/SearchDiscoveryFlowView';

type DiscoveryEntry = 'home' | 'matchingPreferences';

traceAuthBoot('APP_MODULE_READY');

type AppWorkspace =
  | { type: 'discovery'; initialScreen: DiscoveryEntry }
  | { type: 'properties'; initialScreen: 'dashboard' | 'postingType' }
  | { type: 'priceEstimate'; actor: EstimateActor; returnTo: 'discovery' | 'properties' }
  | { type: 'messages'; initialScreen: 'inbox' | 'newInquiry' }
  | { type: 'maintenance' }
  | { type: 'ratingsReports' }
  | { type: 'adminModeration' }
  | { type: 'notifications' }
  | { type: 'verification' }
  | null;

export default function App() {
  const auth = useAuthProfilesViewModel();
  const [preferredRole, setPreferredRole] = useState<UserRole>('tenant');
  const accountRole: UserRole = auth.hasLandlordRole && (!auth.hasTenantRole || preferredRole === 'landlord') ? 'landlord' : 'tenant';
  const [workspace, setWorkspace] = useState<AppWorkspace>(null);
  const verificationBackAction = useRef<(() => void) | null>(null);
  const registerVerificationBack = useCallback((action: (() => void) | null) => { verificationBackAction.current = action; }, []);
  const workspaceDestination = auth.account ? getWorkspaceDestination(auth.account) : null;
  const canEnterAdmin = workspaceDestination === 'adminModeration';
  const canEnterMarketplace = workspaceDestination === 'discovery';
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
    if (canEnterMarketplace && auth.hasLandlordRole) setWorkspace({ type: 'properties', initialScreen });
  };

  useEffect(() => {
    if (auth.entryVersion === 0 || !workspaceDestination) return;
    setPreferredRole(auth.hasTenantRole ? 'tenant' : 'landlord');
    setWorkspace(workspaceDestination === 'adminModeration'
      ? { type: 'adminModeration' }
      : { type: 'discovery', initialScreen: 'home' });
  }, [auth.entryVersion, workspaceDestination]);

  useEffect(() => {
    if (auth.signedOutVersion > 0) {
      setWorkspace(null);
      setPreferredRole('tenant');
    }
  }, [auth.signedOutVersion]);

  return (
    <SafeAreaProvider>
      <AuthProfilesFlowView
        viewModel={auth}
        activeRole={accountRole}
        onSwitchRole={setPreferredRole}
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
          if (workspace?.type === 'verification') verificationBackAction.current?.();
          else setWorkspace(null);
        }}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={workspace !== null && (workspace?.type === 'adminModeration' ? canEnterAdmin : canEnterMarketplace)}
      >
        {workspace?.type === 'verification' && canEnterMarketplace ? (
          <UserVerificationFlowView tierOneVerified={!!auth.account?.profile.tier1_verified_at} hasLandlordRole={auth.hasLandlordRole} onClose={() => setWorkspace(null)} registerBackAction={registerVerificationBack} />
        ) : null}
        {workspace?.type === 'discovery' ? (
          <SearchDiscoveryFlowView
            initialScreen={workspace.initialScreen}
            isLandlord={accountRole === 'landlord'}
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
            isLandlord={accountRole === 'landlord'}
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
            isLandlord={accountRole === 'landlord'}
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
            isLandlord={accountRole === 'landlord'}
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
            isLandlord={accountRole === 'landlord'}
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
            isLandlord={accountRole === 'landlord'}
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
