import { draftPropertyError, emptyDraftProperty, hasConfirmedPropertyLocation, propertyCreationInput, type DraftProperty, type PropertyLocationInput } from '../models/DraftProperty';
import type { PropertyCreationService } from '../services/propertyCreationService';
type Step = 'details' | 'address' | 'review' | 'created';
interface State {
  draft: DraftProperty; step: Step; busy: boolean; loaded: boolean; propertyId: string | null;
  error: string | null; uncertain: boolean; locationRevision: number;
  recent: Awaited<ReturnType<PropertyCreationService['recentOwned']>>;
}
const initial = (): State => ({ draft: emptyDraftProperty(), step: 'details', busy: false, loaded: false, propertyId: null, error: null, uncertain: false, locationRevision: 0, recent: [] });
export function createPropertyCreationWorkflow(service: PropertyCreationService) {
  let state = initial(), epoch = 0, disposed = false, owner: string | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
  const alive = (attempt: number) => !disposed && attempt === epoch;
  const identity = async (attempt: number) => {
    if (!owner || !alive(attempt)) throw new Error('Closed.');
    await service.assertIdentity(owner); if (!alive(attempt)) throw new Error('Closed.'); return owner;
  };
  const fail = (error: unknown, fallback: string) => {
    if ((error as { code?: string })?.code === 'property_identity_changed') { epoch++; owner = null; update({ ...initial(), error: 'Your account changed. Reopen property setup.' }); }
    else { const uncertain = (error as { code?: string })?.code === 'property_creation_uncertain'; update({ error: uncertain ? 'Creation could not be confirmed. A property may already exist. Check recent owned properties before continuing; do not create another blindly.' : fallback, ...(uncertain ? { uncertain: true, step: 'review' as const } : {}) }); }
  };
  const initialize = async () => {
    if (disposed || state.busy) return;
    const attempt = epoch; update({ busy: true, error: null });
    try {
      const id = await service.getEligibleUserId(); if (!alive(attempt)) return; owner = id;
      const receipt = await service.restore(id); await identity(attempt);
      update({ loaded: true, ...(receipt ? { propertyId: receipt.propertyId, step: 'created' as const } : {}) });
    } catch (error) { if (alive(attempt)) fail(error, 'Property setup could not load. Check your account and connection.'); }
    finally { if (alive(attempt)) update({ busy: false }); }
  };
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    initialize,
    locationReady: () => hasConfirmedPropertyLocation(state.draft),
    activate() { if (disposed) { disposed = false; update({ busy: false }); } },
    dispose() { disposed = true; epoch++; listeners.clear(); },
    discardLocalEdits() {
      if (disposed || state.busy) return;
      // Local discard never clears the durable receipt/uncertain-operation journal.
      epoch++;
      if (state.propertyId) update({ draft: emptyDraftProperty(), error: null });
      else { owner = null; update(initial()); }
    },
    dirty: () => !state.propertyId && JSON.stringify(state.draft) !== JSON.stringify(emptyDraftProperty()),
    updateField<K extends Exclude<keyof DraftProperty, keyof PropertyLocationInput>>(field: K, value: DraftProperty[K]) {
      if (state.busy || state.propertyId || state.uncertain) return;
      const addressChanged = ['city', 'barangay', 'addressLine1', 'addressLine2', 'postalCode'].includes(field);
      update({ draft: { ...state.draft, [field]: value, ...(addressChanged ? { exactLatitude: null, exactLongitude: null, publicLatitude: null, publicLongitude: null } : {}) }, ...(addressChanged ? { locationRevision: state.locationRevision + 1 } : {}), error: null });
    },
    next() {
      if (!state.loaded || state.busy || state.propertyId || state.uncertain) return;
      if (state.step === 'details') { if (!state.draft.propertyType) { update({ error: 'Choose a property type.' }); return; } update({ step: 'address', error: null }); }
      else { const error = draftPropertyError(state.draft, false); update({ ...(error ? {} : { step: 'review' as const }), error }); }
    },
    back() {
      if (state.busy) return true;
      if (state.uncertain) return false;
      if (state.step === 'address') { update({ step: 'details', error: null }); return true; }
      if (state.step === 'review') { update({ step: 'address', error: null }); return true; }
      return false;
    },
    // Future location integration supplies a confirmed exact point and approved public point.
    // Revision is captured when that workflow opens; stale address results are ignored.
    provideConfirmedLocation(location: PropertyLocationInput, expectedAddressRevision: number) {
      if (disposed || state.busy || !state.loaded || state.propertyId || state.uncertain || expectedAddressRevision !== state.locationRevision) return;
      const draft = { ...state.draft, ...location };
      if (hasConfirmedPropertyLocation(draft)) update({ draft, error: null });
    },
    async submit() {
      if (disposed || state.busy || !state.loaded || state.propertyId || state.uncertain || state.step !== 'review') return;
      if (!hasConfirmedPropertyLocation(state.draft)) return;
      const error = draftPropertyError(state.draft); if (error) { update({ error }); return; }
      const attempt = epoch; update({ busy: true, error: null });
      try { const id = await identity(attempt); const receipt = await service.create(id, propertyCreationInput(state.draft)); await identity(attempt); update({ propertyId: receipt.propertyId, step: 'created' }); }
      catch (error) { if (alive(attempt)) fail(error, 'Property could not be saved. Check your details and account, then try again.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
    async checkRecent() {
      if (disposed || state.busy || !state.uncertain) return;
      const attempt = epoch; update({ busy: true, error: null });
      try { const id = await identity(attempt); const recent = await service.recentOwned(id); await identity(attempt); update({ recent, error: recent.length ? 'Only select a property you recognize as this setup. Older records may also be listed.' : 'No recent property could be confirmed. Do not retry creation until its backend outcome is checked.' }); }
      catch (error) { if (alive(attempt)) fail(error, 'Could not check owned properties. Try checking again.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
    async confirmExisting(propertyId: string) {
      if (disposed || state.busy || !state.uncertain || !state.recent.some(row => row.id === propertyId)) return;
      const attempt = epoch; update({ busy: true });
      try { const id = await identity(attempt); const receipt = await service.confirmOwned(id, propertyId); await identity(attempt); update({ propertyId: receipt.propertyId, step: 'created', uncertain: false, error: null, recent: [] }); }
      catch (error) { if (alive(attempt)) fail(error, 'Could not confirm this property.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
    async startNew() {
      if (disposed || state.busy || state.uncertain) return;
      const attempt = epoch; update({ busy: true });
      try { const id = await identity(attempt); await service.beginNew(id); await identity(attempt); update({ ...initial(), loaded: true, locationRevision: state.locationRevision + 1 }); }
      catch (error) { if (alive(attempt)) fail(error, 'Could not start another property.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
  };
}
