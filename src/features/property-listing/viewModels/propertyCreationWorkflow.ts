import { PropertyCreationError } from '../models/PropertyCreationError';
import { propertyFloorIssues, draftPropertyError, emptyDraftProperty, hasConfirmedPropertyLocation, propertyCreationInput, type PropertyValidationField, type PropertyValidationSection, type DraftProperty, type PropertyLocationInput } from '../models/DraftProperty';
import type { PropertyCreationService, UncertainDetail } from '../services/propertyCreationService';
import { newestFirst, recoveryMessage } from '../models/RecentProperty';
type Step = 'details' | 'address' | 'review' | 'created';
interface State {
  touchedFields:Partial<Record<PropertyValidationField,true>>; validationAttempted:boolean;
  draft: DraftProperty; step: Step; busy: boolean; loaded: boolean; propertyId: string | null;
  error: string | null; uncertain: boolean; locationRevision: number;
  /** Recovery: the time on the pending marker (null for an older marker without one), and whether the recent properties were looked up. */
  uncertainSince: number | null; recentChecked: boolean;
  /** Recovery with a young marker and nothing found yet: a calm "still confirming" state with Retry. */
  confirming: boolean;
  recent: Awaited<ReturnType<PropertyCreationService['recentOwned']>>;
}
const initial = (): State => ({ touchedFields:{}, validationAttempted:false, draft: emptyDraftProperty(), step: 'details', busy: false, loaded: false, propertyId: null, error: null, uncertain: false, locationRevision: 0, recent: [], uncertainSince: null, recentChecked: false, confirming: false });
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
    else if ((error as { code?: string })?.code === 'property_creation_uncertain') {
      // One state, one message. Properties found for the pending marker arrive with the error and are shown right away, newest first.
      const detail = error as UncertainDetail, recent = newestFirst(detail.recent ?? []), uncertainSince = detail.since ?? null, recentChecked = !!detail.recent, confirming = !!detail.confirming;
      update({ uncertain: true, step: 'review', uncertainSince, recent, recentChecked, confirming, error: recoveryMessage({ recent, uncertainSince, recentChecked, confirming }) });
    }
    else update({ error: error instanceof PropertyCreationError ? error.message : fallback });
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
    markFieldTouched(field:PropertyValidationField) { if(!disposed&&!state.busy&&!state.propertyId&&!state.uncertain)update({touchedFields:{...state.touchedFields,[field]:true}}); },
    markValidationAttempt() { if(!disposed&&!state.busy&&!state.propertyId&&!state.uncertain&&!state.validationAttempted)update({validationAttempted:true}); },
    locationReady: () => hasConfirmedPropertyLocation(state.draft),
    activate() { if (disposed) { disposed = false; update({ busy: false }); } },
    dispose() { disposed = true; epoch++; },
    invalidateLocation() {
      if(disposed||state.busy||state.propertyId||state.uncertain)return;
      update({draft:{...state.draft,exactLatitude:null,exactLongitude:null,publicLatitude:null,publicLongitude:null},error:null,touchedFields:{...state.touchedFields,location:true}});
    },
    discardLocalEdits() {
      if (disposed || state.busy) return;
      // Local discard never clears the durable receipt/uncertain-operation journal.
      epoch++;
      if (state.propertyId) update({ touchedFields:{}, validationAttempted:false, draft: emptyDraftProperty(), error: null });
      else { owner = null; update({...initial(),locationRevision:state.locationRevision+1}); }
    },
    dirty: () => !state.propertyId && JSON.stringify(state.draft) !== JSON.stringify(emptyDraftProperty()),
    updateField<K extends Exclude<keyof DraftProperty, keyof PropertyLocationInput>>(field: K, value: DraftProperty[K]) {
      if (state.busy || state.propertyId || state.uncertain) return;
      const addressChanged = ['city', 'barangay', 'addressLine1', 'addressLine2', 'postalCode'].includes(field) && String(state.draft[field]??'').trim()!==String(value??'').trim();
      update({ draft: { ...state.draft, [field]: value, ...(addressChanged ? { exactLatitude: null, exactLongitude: null, publicLatitude: null, publicLongitude: null } : {}) }, ...(addressChanged ? { locationRevision: state.locationRevision + 1 } : {}), error: null });
    },
    next() {
      if (!state.loaded || state.busy || state.propertyId || state.uncertain) return;
      update({validationAttempted:true});
      if (state.step === 'details') { const floors=propertyFloorIssues(state.draft); if(floors.floorNumber||floors.totalFloors){update({error:floors.floorNumber??floors.totalFloors});return;} if (!state.draft.propertyType) { update({ error: 'Choose a supported property type.' }); return; } update({ step: 'address', error: null }); }
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
      if (hasConfirmedPropertyLocation(draft)) update({ draft, error: null, touchedFields:{...state.touchedFields,location:true} });
    },
    focusValidationSection(section:PropertyValidationSection) { if(!disposed&&!state.busy&&!state.propertyId&&!state.uncertain)update({step:section==='address'||section==='location'?'address':'details'}); },
    async submit(fromComposer = false) {
      if (disposed || state.busy || !state.loaded || state.propertyId || state.uncertain || (!fromComposer && state.step !== 'review')) return;
      if (!fromComposer && !hasConfirmedPropertyLocation(state.draft)) return;
      update({validationAttempted:true});
      const error = draftPropertyError(state.draft); if (error) { update({ error }); return; }
      const attempt = epoch; update({ busy: true, error: null });
      try { const id = await identity(attempt); const receipt = await service.create(id, propertyCreationInput(state.draft)); await identity(attempt); update({ propertyId: receipt.propertyId, step: 'created' }); }
      catch (error) { if (alive(attempt)) fail(error, 'Property could not be saved. Check your details and account, then try again.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
    async checkRecent() {
      if (disposed || state.busy || !state.uncertain) return;
      const attempt = epoch; update({ busy: true, error: null });
      try {
        const id = await identity(attempt), since = state.uncertainSince, found = await service.recentOwned(id, since); await identity(attempt);
        if (since !== null && !found.length && service.markerIsYoung(since)) {
          // Too soon to say: the save may still be landing. Stay calm and let the person check again.
          update({ confirming: true, recent: [], recentChecked: true, error: recoveryMessage({ recent: [], uncertainSince: since, recentChecked: true, confirming: true }) });
        } else if (since !== null && !found.length) {
          // The marker has a time, is old enough, and nothing was created since: the interrupted save never reached the server. Forget it and keep the person's details.
          await service.discardMarker(id); await identity(attempt);
          update({ loaded: true, step: 'details', uncertain: false, error: null, recent: [], recentChecked: false, uncertainSince: null, confirming: false });
        } else { const recent = newestFirst(found); update({ recent, recentChecked: true, confirming: false, error: recoveryMessage({ recent, uncertainSince: since, recentChecked: true }) }); }
      }
      catch (error) { if (alive(attempt)) fail(error, 'Could not check owned properties. Try checking again.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
    async confirmExisting(propertyId: string) {
      if (disposed || state.busy || !state.uncertain || !state.recent.some(row => row.id === propertyId)) return;
      const attempt = epoch; update({ busy: true });
      try { const id = await identity(attempt); const receipt = await service.confirmOwned(id, propertyId); await identity(attempt); update({ propertyId: receipt.propertyId, step: 'created', uncertain: false, error: null, recent: [], uncertainSince: null, recentChecked: false, confirming: false }); }
      catch (error) { if (alive(attempt)) fail(error, 'Could not confirm this property.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
    /** "None of these, start fresh" (the person confirmed it): forget the unconfirmed save and keep the details they typed. Never creates anything. */
    async startFresh() {
      if (disposed || state.busy || !state.uncertain) return;
      const attempt = epoch; update({ busy: true });
      try { const id = await identity(attempt); await service.discardMarker(id); await identity(attempt); update({ loaded: true, step: 'details', uncertain: false, error: null, recent: [], uncertainSince: null, recentChecked: false, confirming: false }); }
      catch (error) { if (alive(attempt)) fail(error, 'Could not start fresh. Try again.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
    async startNew() {
      if (disposed || state.busy || state.uncertain) return;
      const attempt = ++epoch; update({ ...initial(), busy: true, locationRevision: state.locationRevision + 1 });
      try { const id = await service.getEligibleUserId(); if (!alive(attempt)) return; owner = id; await service.beginNew(id); await identity(attempt); update({ ...initial(), loaded: true, locationRevision: state.locationRevision + 1 }); }
      catch (error) { if (alive(attempt)) fail(error, 'Could not start another property.'); }
      finally { if (alive(attempt)) update({ busy: false }); }
    },
  };
}
