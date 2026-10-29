import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import { isPropertyUuid } from '../models/DraftProperty';
import { MAX_PROPERTY_PHOTOS, safePhotoMessage, validatePropertyPhoto, type PropertyPhoto } from '../models/PropertyPhoto';
import type { PhotoContext, PropertyPhotoService } from '../services/propertyPhotoService';

interface PhotoState {
  propertyId: string | null; photos: PropertyPhoto[]; loaded: boolean; busy: boolean;
  selected: SelectedDocument | null; altText: string; altDrafts: Record<string, string>;
  error: string | null; notice: string | null; needsReconcile: boolean; removeId: string | null;
  pendingSelections: SelectedDocument[]; uncertainSelection: SelectedDocument | null;
  activeMediaIndex: number; mediaViewerOpen: boolean;
  batch: { total: number; completed: number; current: number; status: 'idle' | 'running' | 'paused' | 'complete' };
}
const initial = (propertyId: string | null = null): PhotoState => ({ propertyId, photos: [], loaded: false, busy: false, selected: null, altText: '', altDrafts: {}, error: null, notice: null, needsReconcile: false, removeId: null, pendingSelections: [], uncertainSelection: null, activeMediaIndex: 0, mediaViewerOpen: false, batch: { total: 0, completed: 0, current: 0, status: 'idle' } });
export function createPropertyPhotoWorkflow(service: PropertyPhotoService, pick: () => Promise<SelectedDocument | null>, pickImages?: (remaining: number) => Promise<SelectedDocument[]>) {
  let state = initial(), generation = 0, disposed = false, context: PhotoContext | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<PhotoState>) => { if (!disposed) { state = { ...state, ...patch }; const count = state.photos.length + state.pendingSelections.length + Number(!!state.uncertainSelection); state = { ...state, activeMediaIndex: Math.max(0, Math.min(state.activeMediaIndex, count - 1)), mediaViewerOpen: count > 0 && state.mediaViewerOpen }; listeners.forEach(fn => fn()); } };
  const selectMedia = (index: number, open = false) => { const count = state.photos.length + state.pendingSelections.length + Number(!!state.uncertainSelection); if (!disposed && Number.isInteger(index) && index >= 0 && index < count) update({ activeMediaIndex: index, mediaViewerOpen: open || state.mediaViewerOpen }); };
  const alive = (g: number) => !disposed && generation === g;
  const identity = async (g: number) => {
    if (!alive(g) || !context) throw new Error('Closed');
    try { await service.assertContext(context); }
    catch (error) { if (alive(g)) { context = null; generation++; update({ ...initial(), error: 'Your account or property access changed. Reopen property setup.' }); } throw error; }
    if (!alive(g)) throw new Error('Closed');
    return context;
  };
  const applyPhotos = (photos: PropertyPhoto[]) => update({ photos, altDrafts: Object.fromEntries(photos.map(p => [p.id, p.alt_text ?? ''])), loaded: true });
  const load = async (reconcile = false) => {
    if (disposed || state.busy || !state.propertyId) return;
    const g = generation, id = state.propertyId; update({ busy: true, error: null });
    try {
      const next = await service.context(id); if (!alive(g)) return;
      if (context && context.ownerId !== next.ownerId) { context = null; generation++; update({ ...initial(), error: 'Your account changed. Reopen property setup.' }); return; }
      context = next;
      const photos = await service.list(next); await identity(g); applyPhotos(photos);
      const pending = await service.hasPending(next); await identity(g);
      if (pending && reconcile) { await service.reconcile(next); const refreshed = await service.list(next); await identity(g); applyPhotos(refreshed); }
      update({ needsReconcile: pending && !reconcile, ...(pending && !reconcile ? { error: 'A previous photo operation needs checking before further changes.' } : {}) });
    } catch (error) {
      if (alive(g)) {
        if (context) { try { await identity(g); } catch { /* Drop prior-owner data when access changes. */ } }
        if (alive(g)) update({ error: safePhotoMessage(error), needsReconcile: true });
      }
    }
    finally { if (alive(g)) update({ busy: false }); }
  };
  const mutate = async (operation: (c: PhotoContext) => Promise<unknown>, message: string, clearSelection = false) => {
    if (disposed || state.busy || !state.loaded || !context || state.needsReconcile || state.pendingSelections.length) return;
    const g = generation; update({ busy: true, error: null, notice: null, removeId: null });
    try {
      const c = await identity(g); await operation(c); await identity(g);
      // A failed refresh must not lead to another upload of the same selection.
      if (clearSelection) update({ selected: null, altText: '' });
      const photos = await service.list(c); await identity(g); applyPhotos(photos); update({ notice: message });
    } catch (error) {
      if (alive(g)) {
        try { await identity(g); } catch { /* Identity invalidation clears the previous owner's state. */ }
        if (alive(g)) update({ error: safePhotoMessage(error), needsReconcile: true });
      }
    }
    finally { if (alive(g)) update({ busy: false }); }
  };
  // One durable, service-owned upload at a time. Never replay an attempted item after an unknown outcome.
  const drainQueue = async (g: number) => {
    while (alive(g) && state.pendingSelections.length && !state.needsReconcile) {
      if (state.photos.length >= MAX_PROPERTY_PHOTOS) { update({ error: 'This property has reached the 10-photo limit.', batch: { ...state.batch, status: 'paused' } }); return; }
      const file = state.pendingSelections[0]!;
      let attempted = false;
      try {
        const c = await identity(g);
        update({ batch: { ...state.batch, current: state.batch.completed + 1, status: 'running' } });
        attempted = true;
        await service.upload(c, file, ''); await identity(g);
        update({ pendingSelections: state.pendingSelections.slice(1), batch: { ...state.batch, completed: state.batch.completed + 1 } });
        const photos = await service.list(c); await identity(g); applyPhotos(photos);
      } catch (error) {
        if (!alive(g)) return;
        try { await identity(g); } catch { /* Identity change clears all local selections. */ }
        if (!alive(g)) return;
        const stillQueued = state.pendingSelections[0] === file;
        update({ ...(attempted && stillQueued ? { pendingSelections: state.pendingSelections.slice(1), uncertainSelection: file } : {}), needsReconcile: true, error: safePhotoMessage(error), batch: { ...state.batch, status: 'paused' }, notice: `${state.batch.completed} of ${state.batch.total} photos confirmed. Check photo status before continuing.` });
        return;
      }
    }
    if (alive(g) && !state.needsReconcile && !state.pendingSelections.length) update({ batch: { ...state.batch, current: 0, status: 'complete' }, notice: state.batch.completed === state.batch.total ? 'Selected photos saved to the property.' : 'Remaining photos saved. Review the saved photos for the previously checked upload.' });
  };
  const resumeQueue = async () => {
    if (disposed || state.busy || !context || !state.loaded || state.needsReconcile || !state.pendingSelections.length) return;
    const g = generation; update({ busy: true, error: null, notice: null });
    try { await drainQueue(g); } finally { if (alive(g)) update({ busy: false }); }
  };
  return {
    getSnapshot: () => state,
    selectMedia,
    openMedia: (index: number) => selectMedia(index, true),
    closeMedia() { update({ mediaViewerOpen: false }); },
    nextMedia: () => selectMedia(state.activeMediaIndex + 1),
    previousMedia: () => selectMedia(state.activeMediaIndex - 1),
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; },
    dispose() { disposed = true; generation++; context = null; state = initial(); listeners.clear(); },
    setProperty(propertyId: string | null, preserveLocalSelections = false) {
      if (propertyId === state.propertyId) return;
      const pendingSelections = preserveLocalSelections && state.propertyId === null && isPropertyUuid(propertyId) ? state.pendingSelections : [];
      generation++; context = null; update({ ...initial(isPropertyUuid(propertyId) ? propertyId : null), pendingSelections, batch: { total: pendingSelections.length, completed: 0, current: 0, status: 'idle' } });
    },
    load,
    checkStatus: async () => {
      if (disposed || state.busy) return;
      const g = generation; await load(true);
      if (alive(g) && !state.needsReconcile && state.loaded) update({ selected: null, uncertainSelection: null, altText: '', notice: state.pendingSelections.length ? 'Photo status refreshed. Review saved photos, then continue the remaining selections.' : 'Photo status refreshed. Check the saved photos before selecting another.' });
    },
    discardLocalEdits() {
      if (disposed || state.busy) return;
      update({ selected: null, pendingSelections: [], altText: '', removeId: null, altDrafts: Object.fromEntries(state.photos.map(photo => [photo.id, photo.alt_text ?? ''])) });
    },
    dirty: () => !!state.selected || !!state.pendingSelections.length || Object.entries(state.altDrafts).some(([id, value]) => value !== (state.photos.find(p => p.id === id)?.alt_text ?? '')),
    resumeQueue,
    async addPhotos() {
      if (disposed || state.busy || (state.propertyId && (!context || !state.loaded)) || state.needsReconcile || state.selected || !pickImages) return;
      const remaining = MAX_PROPERTY_PHOTOS - state.photos.length - state.pendingSelections.length;
      if (remaining <= 0) return;
      const g = generation; update({ busy: true, error: null, notice: null });
      try {
        if (state.propertyId) await identity(g);
        const selections = await pickImages(remaining);
        if (!alive(g)) return;
        if (state.propertyId) await identity(g);
        if (!selections.length) return;
        if (selections.length > remaining) throw new Error('Too many photos');
        selections.forEach(validatePropertyPhoto);
        const pendingSelections = [...state.pendingSelections, ...selections];
        update({ pendingSelections, batch: { total: pendingSelections.length, completed: 0, current: 0, status: 'running' } });
        if (state.propertyId) await drainQueue(g);
        else update({ batch: { ...state.batch, status: 'idle' }, notice: 'Photos are local until you save the property.' });
      } catch { if (alive(g)) update({ error: 'Choose JPEG, PNG or WebP photos up to 10 MB each, within the remaining photo limit.' }); }
      finally { if (alive(g)) update({ busy: false }); }
    },
    removePending(index: number) { if (!state.busy && index >= 0) update({ pendingSelections: state.pendingSelections.filter((_, i) => i !== index) }); },
    async select() {
      if (disposed || state.busy || !context || !state.loaded || state.needsReconcile || state.pendingSelections.length || state.photos.length >= MAX_PROPERTY_PHOTOS) return;
      const g = generation; update({ busy: true, error: null, notice: null });
      try { await identity(g); const selected = await pick(); await identity(g); if (selected) { validatePropertyPhoto(selected); update({ selected, altText: '' }); } }
      catch (error) { if (alive(g)) update({ error: safePhotoMessage(error) }); }
      finally { if (alive(g)) update({ busy: false }); }
    },
    setAlt(value: string) { if (!state.busy) update({ altText: value }); },
    cancelSelection() { if (!state.busy) update({ selected: null, altText: '' }); },
    async upload() {
      if (!state.selected || state.photos.length >= MAX_PROPERTY_PHOTOS) return;
      const selected = state.selected, altText = state.altText;
      await mutate(c => service.upload(c, selected, altText), 'Photo saved.', true);
    },
    setAltDraft(id: string, value: string) { if (!state.busy && state.photos.some(p => p.id === id)) update({ altDrafts: { ...state.altDrafts, [id]: value } }); },
    saveAlt: (id: string) => mutate(c => service.updateAlt(c, id, state.altDrafts[id] ?? ''), 'Photo description saved.'),
    setCover: (id: string) => mutate(c => service.setCover(c, id), 'Cover photo updated.'),
    move: (id: string, direction: -1 | 1) => mutate(c => service.move(c, id, direction), 'Photo order saved.'),
    requestRemove(id: string) { if (!state.busy && !state.needsReconcile && state.photos.some(p => p.id === id)) update({ removeId: id }); },
    cancelRemove() { if (!state.busy) update({ removeId: null }); },
    confirmRemove: async () => { const id = state.removeId; if (id) await mutate(c => service.remove(c, id), 'Photo removed. Choose a cover if needed.'); },
    back() { if (state.mediaViewerOpen) { update({ mediaViewerOpen: false }); return true; } if (state.busy) return true; if (state.removeId) { update({ removeId: null }); return true; } return false; },
  };
}
