import {useCallback, useEffect, useRef, useState} from 'react';
import {useTenancyCareViewModel} from '../viewModels/useTenancyCareViewModel';
import {MaintenanceInboxView} from './MaintenanceInboxView';
import {MaintenanceListView} from './MaintenanceListView';
import {MaintenanceReportView} from './MaintenanceReportView';
import {MaintenanceRequestView} from './MaintenanceRequestView';

export type MaintenanceStart = {kind: 'list'} | {kind: 'report'} | {kind: 'request'; requestId: string};
type Route = {kind: 'list'} | {kind: 'report'} | {kind: 'request'; requestId: string; name: string};
export const maintenanceTitle = (kind: Route['kind'], role: 'tenant' | 'landlord', propertyTitle: string): string =>
  kind === 'report' ? 'Report an issue' : kind === 'request' ? 'Request' : role === 'tenant' ? 'My maintenance requests' : propertyTitle ? `Maintenance · ${propertyTitle}` : 'Maintenance';

interface Props {
  accountId: string | undefined;
  role: 'tenant' | 'landlord';
  /** Tenant: the tenancy. Landlord: the property the inbox is filtered to (null = all properties). */
  tenancyId?: string | undefined;
  propertyId?: string | null;
  propertyTitle: string;
  /** The other person in the tenancy (the landlord for a tenant). Landlords get tenant names per tenancy instead. */
  otherName?: string | undefined;
  start?: MaintenanceStart | undefined;
  /** Registers "back inside the flow": returns true when the flow is at its first screen and the caller should leave. */
  registerExitGuard: (guard: (() => boolean) | null) => void;
  onTitle?: ((title: string) => void) | undefined;
}

/** Tenant: list, report, request. Landlord: inbox, request. One back step at a time; the caller leaves only from the first screen. */
export function MaintenanceFlowView({accountId, role, tenancyId, propertyId = null, propertyTitle, otherName = 'your landlord', start, registerExitGuard, onTitle}: Props) {
  const first: Route = start?.kind === 'report' ? {kind: 'report'} : start?.kind === 'request' ? {kind: 'request', requestId: start.requestId, name: otherName} : {kind: 'list'};
  const [route, setRoute] = useState<Route>(first), root = useRef<Route['kind']>(first.kind);
  const care = useTenancyCareViewModel(role === 'tenant' ? accountId : undefined, tenancyId ?? '');
  const createdHandled = useRef<string | null>(null);
  useEffect(() => {onTitle?.(maintenanceTitle(route.kind, role, propertyTitle));}, [route.kind, role, propertyTitle, onTitle]);
  const guard = useCallback(() => {
    if (route.kind === 'list' || route.kind === root.current) return true;
    if (role === 'tenant') void care.workflow.load();
    setRoute({kind: 'list'});
    return false;
  }, [route.kind, role, care.workflow]);
  useEffect(() => {registerExitGuard(guard); return () => registerExitGuard(null);}, [guard, registerExitGuard]);
  // A request that was just sent opens its detail.
  useEffect(() => {
    if (care.created && createdHandled.current !== care.created && route.kind === 'report') {createdHandled.current = care.created; setRoute({kind: 'request', requestId: care.created, name: otherName});}
  }, [care.created, route.kind, otherName]);
  if (route.kind === 'request') return <MaintenanceRequestView key={route.requestId} accountId={accountId} requestId={route.requestId} otherName={route.name} propertyTitle={propertyTitle}/>;
  if (role === 'landlord') return <MaintenanceInboxView accountId={accountId} propertyId={propertyId} onOpen={(row, name) => setRoute({kind: 'request', requestId: row.id, name})}/>;
  if (route.kind === 'report') return <MaintenanceReportView care={care} propertyTitle={propertyTitle} landlordName={otherName}/>;
  return <MaintenanceListView care={care} propertyTitle={propertyTitle} landlordName={otherName} onReport={() => setRoute({kind: 'report'})} onOpen={id => setRoute({kind: 'request', requestId: id, name: otherName})}/>;
}
