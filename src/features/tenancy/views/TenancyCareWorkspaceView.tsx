import {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, ScrollView, Text, View} from 'react-native';
import {useBottomClearance} from '../../../shared/components/useBottomClearance';
import {ScreenContainer} from '../../../shared/components/ScreenContainer';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {AppButton} from '../../../shared/components/AppButton';
import {ui} from '../../../shared/theme/ui';
import {useTenancyCareListViewModel} from '../viewModels/useTenancyCareListViewModel';
import {MaintenanceFlowView} from './MaintenanceFlowView';

/** Maintenance for one rental, chosen from a list. Tenants get their requests and the report form; landlords get the inbox for that property. */
export function TenancyCareWorkspaceView({accountId, onBack, registerBackAction}: {accountId: string | undefined; onBack: () => void; registerBackAction: ((action: (() => void) | null) => void)}) {
  const bottom = useBottomClearance();
  const vm = useTenancyCareListViewModel(accountId), [selected, setSelected] = useState<{owner: string | undefined; id: string; propertyId: string; landlord: boolean} | null>(null);
  const [title, setTitle] = useState('Maintenance'), guard = useRef<(() => boolean) | null>(null), registerGuard = useCallback((g: (() => boolean) | null) => {guard.current = g;}, []);
  const current = selected?.owner === accountId ? selected : null;
  const back = () => {if (current) {if (guard.current && !guard.current()) return; setSelected(null);} else onBack();};
  useEffect(() => {registerBackAction(back); return () => registerBackAction(null);});
  return <ScreenContainer padded={false}><ScreenHeader title={current ? title : 'Maintenance'} onBack={back}/>
    {current ? <MaintenanceFlowView key={`${accountId}:${current.id}`} accountId={accountId} role={current.landlord ? 'landlord' : 'tenant'} tenancyId={current.id} propertyId={current.propertyId} propertyTitle="" registerExitGuard={registerGuard} onTitle={setTitle}/>
      : <ScrollView contentContainerStyle={{padding: 16, gap: 14, paddingBottom: bottom}}>
        <Text style={ui.body}>Choose a rental to see its maintenance requests. Ended rentals keep a read-only history.</Text>
        {vm.busy ? <ActivityIndicator accessibilityLabel="Loading rentals"/> : null}
        {vm.error ? <Text accessibilityRole="alert" style={ui.supporting}>{vm.error}</Text> : null}
        {!vm.busy && !vm.error && !vm.rows.length ? <Text style={ui.body}>No active or ended rentals yet.</Text> : null}
        {vm.rows.map(t => <View key={t.id} style={{gap: 8}}><AppButton label={accountId === t.landlord_id ? `Your property · started ${t.start_date}` : `Your rental · started ${t.start_date}`} variant="secondary" onPress={() => setSelected({owner: accountId, id: t.id, propertyId: t.property_id, landlord: accountId === t.landlord_id})}/></View>)}
        {vm.error ? <AppButton label="Retry" variant="secondary" disabled={vm.busy} onPress={vm.refresh}/> : null}
      </ScrollView>}
  </ScreenContainer>;
}
