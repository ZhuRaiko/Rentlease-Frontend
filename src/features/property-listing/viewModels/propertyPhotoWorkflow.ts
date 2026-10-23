import type { SelectedDocument } from '../../../shared/models/SelectedDocument';
import { isPropertyUuid } from '../models/DraftProperty';
import { MAX_PROPERTY_PHOTOS, safePhotoMessage, validatePropertyPhoto, type PropertyPhoto } from '../models/PropertyPhoto';
import type { PhotoContext, PropertyPhotoService } from '../services/propertyPhotoService';

interface PhotoState {
  propertyId: string | null; photos: PropertyPhoto[]; loaded: boolean; busy: boolean;
  selected: SelectedDocument | null; altText: string; altDrafts: Record<string, string>;
  error: string | null; notice: string | null; needsReconcile: boolean; removeId: string | null;
}
const initial = (propertyId: string | null = null): PhotoState => ({ propertyId, photos: [], loaded: false, busy: false, selected: null, altText: '', altDrafts: {}, error: null, notice: null, needsReconcile: false, removeId: null });
export function createPropertyPhotoWorkflow(service: PropertyPhotoService, pick: () => Promise<SelectedDocument | null>) {
  let state = initial(), generation = 0, disposed = false, context: PhotoContext | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<PhotoState>) => { if (!disposed) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); } };
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
    if (disposed || state.busy || !state.loaded || !context || state.needsReconcile) return;
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
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    activate() { disposed = false; },
    dispose() { disposed = true; generation++; context = null; state = initial(); listeners.clear(); },
    setProperty(propertyId: string | null) {
      if (propertyId === state.propertyId) return;
      generation++; context = null; update(initial(isPropertyUuid(propertyId) ? propertyId : null));
    },
    load,
    checkStatus: async () => {
      if (disposed || state.busy) return;
      const g = generation; await load(true);
      if (alive(g) && !state.needsReconcile && state.loaded) update({ selected: null, altText: '', notice: 'Photo status refreshed. Check the saved photos before selecting another.' });
    },
    dirty: () => !!state.selected || Object.entries(state.altDrafts).some(([id, value]) => value !== (state.photos.find(p => p.id === id)?.alt_text ?? '')),
    async select() {
      if (disposed || state.busy || !context || !state.loaded || state.needsReconcile || state.photos.length >= MAX_PROPERTY_PHOTOS) return;
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
    back() { if (state.busy) return true; if (state.removeId) { update({ removeId: null }); return true; } return false; },
  };
}
