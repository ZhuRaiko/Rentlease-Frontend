import { useState } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { UserRole } from './src/features/authentication/models/AuthProfile';
import { AuthProfilesFlowView } from './src/features/authentication/views/AuthProfilesFlowView';
import { AdminModerationFlowView } from './src/features/admin-moderation/views/AdminModerationFlowView';
import { MessagingViewingFlowView } from './src/features/messaging-viewing/views/MessagingViewingFlowView';
import { MaintenanceRequestsFlowView } from './src/features/maintenance/views/MaintenanceRequestsFlowView';
import { NotificationsFlowView } from './src/features/notifications/views/NotificationsFlowView';
import { PropertyListingFlowView } from './src/features/property-listing/views/PropertyListingFlowView';
import { RatingsReportsFlowView } from './src/features/ratings-reports/views/RatingsReportsFlowView';
import type { EstimateActor } from './src/features/rental-price-estimation/models/RentalPriceEstimate';
import { RentalPriceEstimationFlowView } from './src/features/rental-price-estimation/views/RentalPriceEstimationFlowView';
import { SearchDiscoveryFlowView } from './src/features/search-discovery/views/SearchDiscoveryFlowView';
import { UserVerificationFlowView } from './src/features/user-verification/views/UserVerificationFlowView';

type DiscoveryEntry = 'home' | 'matchingPreferences';

type AppWorkspace =
  | { type: 'discovery'; initialScreen: DiscoveryEntry }
  | { type: 'properties'; initialScreen: 'dashboard' | 'postingType' }
  | { type: 'priceEstimate'; actor: EstimateActor; returnTo: 'discovery' | 'properties' }
  | { type: 'messages'; initialScreen: 'inbox' | 'newInquiry' }
  | { type: 'maintenance' }
  | { type: 'ratingsReports' }
  | { type: 'adminModeration' }
  | { type: 'notifications' }
  | null;

export default function App() {
  const [accountRole, setAccountRole] = useState<UserRole>('tenant');
  const [showVerification, setShowVerification] = useState(false);
  const [workspace, setWorkspace] = useState<AppWorkspace>(null);

  return (
    <SafeAreaProvider>
      <AuthProfilesFlowView
        accountRole={accountRole}
        onOpenAdminModeration={() => setWorkspace({ type: 'adminModeration' })}
        onOpenDiscovery={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
        onSignInComplete={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
        onOpenMatchingPreferences={() =>
          setWorkspace({ type: 'discovery', initialScreen: 'matchingPreferences' })
        }
        onOpenNotifications={() => setWorkspace({ type: 'notifications' })}
        onOpenProperties={() => setWorkspace({ type: 'properties', initialScreen: 'dashboard' })}
        onOpenRatingsReports={() => setWorkspace({ type: 'ratingsReports' })}
        onOpenVerification={() => setShowVerification(true)}
      />

      <Modal
        animationType="slide"
        onRequestClose={() => setWorkspace(null)}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={workspace !== null}
      >
        {workspace?.type === 'discovery' ? (
          <SearchDiscoveryFlowView
            initialScreen={workspace.initialScreen}
            isLandlord={accountRole === 'landlord'}
            onClose={() => setWorkspace(null)}
            onCreateListing={() =>
              setWorkspace({ type: 'properties', initialScreen: 'postingType' })
            }
            onOpenListings={() =>
              setWorkspace({ type: 'properties', initialScreen: 'dashboard' })
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
        {workspace?.type === 'properties' && accountRole === 'landlord' ? (
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
                workspace.returnTo === 'properties' && accountRole === 'landlord'
                  ? { type: 'properties', initialScreen: 'dashboard' }
                  : { type: 'discovery', initialScreen: 'home' },
              )
            }
            onCreateListing={() =>
              setWorkspace({ type: 'properties', initialScreen: 'postingType' })
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              setWorkspace({ type: 'properties', initialScreen: 'dashboard' })
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
              setWorkspace({ type: 'properties', initialScreen: 'postingType' })
            }
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              setWorkspace({ type: 'properties', initialScreen: 'dashboard' })
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
              setWorkspace({ type: 'properties', initialScreen: 'postingType' })
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              setWorkspace({ type: 'properties', initialScreen: 'dashboard' })
            }
          />
        ) : null}
        {workspace?.type === 'ratingsReports' ? (
          <RatingsReportsFlowView
            actor={accountRole}
            isLandlord={accountRole === 'landlord'}
            onClose={() => setWorkspace(null)}
            onCreateListing={() =>
              setWorkspace({ type: 'properties', initialScreen: 'postingType' })
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              setWorkspace({ type: 'properties', initialScreen: 'dashboard' })
            }
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
          />
        ) : null}
        {workspace?.type === 'adminModeration' ? (
          <AdminModerationFlowView onClose={() => setWorkspace(null)} />
        ) : null}
        {workspace?.type === 'notifications' ? (
          <NotificationsFlowView
            isLandlord={accountRole === 'landlord'}
            onClose={() => setWorkspace(null)}
            onCreateListing={() =>
              setWorkspace({ type: 'properties', initialScreen: 'postingType' })
            }
            onOpenChat={() => setWorkspace({ type: 'messages', initialScreen: 'inbox' })}
            onOpenDiscover={() => setWorkspace({ type: 'discovery', initialScreen: 'home' })}
            onOpenListings={() =>
              setWorkspace({ type: 'properties', initialScreen: 'dashboard' })
            }
            onOpenMaintenance={() => setWorkspace({ type: 'maintenance' })}
            onOpenRatingsReports={() => setWorkspace({ type: 'ratingsReports' })}
            onOpenVerification={() => {
              setWorkspace(null);
              setShowVerification(true);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowVerification(false)}
        presentationStyle="fullScreen"
        statusBarTranslucent
        visible={showVerification}
      >
        <UserVerificationFlowView
          initialActor={accountRole}
          onClose={() => setShowVerification(false)}
          onLandlordVerified={() => setAccountRole('landlord')}
        />
      </Modal>
    </SafeAreaProvider>
  );
}
