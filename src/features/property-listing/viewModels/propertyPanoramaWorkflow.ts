import { PANORAMA_SIDES, type PanoramaSide, type PublicPropertyPanorama } from '../../../shared/models/PropertyPanorama';
import type { PanoramaAsset, PanoramaProblem } from '../models/PropertyPanoramaSelection';
import { PropertyPanoramaError, type PanoramaContext, type PropertyPanoramaService } from '../services/propertyPanoramaService';

export type SideStatus = 'idle' | 'picking' | 'uploading' | 'ready' | 'error';
/** One side (Front or Back). `panorama` is the saved one and survives a failed replace; `problem` is what the red tile explains. */
export interface SideState { status: SideStatus; panorama: PublicPropertyPanorama | null; problem: PanoramaProblem | null }
export interface RoomTourState {
  propertyId: string | null; loaded: boolean; loading: boolean; sides: Record<PanoramaSide, SideState>;
  menuSide: PanoramaSide | null; removeSide: PanoramaSide | null; removing: boolean;
  /** Card-level problems that do not belong to one tile: loading the tour, removing a side, an unusable property. */
  notice: string | null;
}
const emptySide = (): SideState => ({ status: 'idle', panorama: null, problem: null });
const initial = (propertyId: string | null = null): RoomTourState => ({ propertyId, loaded: false, loading: false, sides: { front: emptySide(), back: emptySide() }, menuSide: null, removeSide: null, removing: false, notice: null });
/** One change at a time: while any side is being picked or uploaded, or one is being removed, every other action is disabled. */
export const roomTourBusy = (s: RoomTourState): boolean => s.loading || s.removing || PANORAMA_SIDES.some(side => s.sides[side].status === 'picking' || s.sides[side].status === 'uploading');

/** Per-side state for the owner's "360° Room tour" card. Saved the moment an upload finishes; not tied to "Save listing details". */
export function createPropertyPanoramaWorkflow(service: PropertyPanoramaService, pick: () => Promise<PanoramaAsset | null>) {
  let state = initial(), generation = 0, disposed = false, context: PanoramaContext | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<RoomTourState>) => { if (disposed) return; state = { ...state, ...patch }; listeners.forEach(l => l()); };
  const setSide = (side: PanoramaSide, patch: Partial<SideState>) => update({ sides: { ...state.sides, [side]: { ...state.sides[side], ...patch } } });
  const alive = (g: number) => !disposed && generation === g;
  const noticeOf = (error: unknown) => error instanceof PropertyPanoramaError && error.message ? error.message : 'Something went wrong with the room tour. Try again.';
  const load = async () => {
    if (disposed || !state.propertyId || state.loading || roomTourBusy(state)) return;
    const g = generation, id = state.propertyId;
    update({ loading: true, notice: null });
    try {
      const next = await service.context(id); if (!alive(g)) return;
      const rows = await service.list(next); if (!alive(g)) return;
      context = next;
      const sides = { front: emptySide(), back: emptySide() };
      for (const row of rows) sides[row.side] = { status: 'ready', panorama: row, problem: null };
      update({ sides, loaded: true });
    } catch (error) { if (alive(g)) update({ notice: noticeOf(error) }); }
    finally { if (alive(g)) update({ loading: false }); }
  };
  const run = async (side: PanoramaSide) => {
    if (disposed || !context || !state.loaded || roomTourBusy(state)) return;
    const g = generation, c = context, before = state.sides[side];
    update({ menuSide: null, notice: null }); setSide(side, { status: 'picking', problem: null });
    let asset: PanoramaAsset | null;
    try { asset = await pick(); }
    catch { if (alive(g)) setSide(side, { status: 'error', problem: 'pick' }); return; }
    if (!alive(g)) return;
    if (!asset) { setSide(side, { status: before.status, problem: before.problem }); return; }   // picker closed: nothing changes
    setSide(side, { status: 'uploading' });
    try {
      const saved = await service.upload(c, side, asset); if (!alive(g)) return;
      setSide(side, { status: 'ready', panorama: saved, problem: null });
    } catch (error) {
      if (!alive(g)) return;
      const kind = error instanceof PropertyPanoramaError ? error.kind : 'upload';
      if (kind === 'context') { setSide(side, { status: before.panorama ? 'ready' : 'idle', problem: null }); update({ notice: noticeOf(error) }); }
      else setSide(side, { status: 'error', problem: kind === 'remove' ? 'upload' : kind });   // the saved panorama, if any, stays saved
    }
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate: () => { disposed = false; if (state.loading || state.removing) state = { ...state, loading: false, removing: false }; if (state.propertyId && !state.loaded) void load(); },   // re-activation (dev double mount) restarts a load the disposal dropped
    dispose: () => { disposed = true; generation++; listeners.clear(); },
    /** Called with the saved property's id (or null while there is none). A different property starts over. */
    setProperty: (propertyId: string | null) => {
      if (state.propertyId === propertyId) return;
      generation++; context = null; state = initial(propertyId); listeners.forEach(l => l());
      if (propertyId) void load();
    },
    load,
    /** Empty and problem tiles are the Add button: they open the picker. A saved tile uses the menu instead. */
    pick: (side: PanoramaSide) => { const s = state.sides[side]; return s.status === 'idle' || s.status === 'error' ? run(side) : Promise.resolve(); },
    openMenu: (side: PanoramaSide) => { if (!roomTourBusy(state) && state.sides[side].status === 'ready') update({ menuSide: side }); },
    closeMenu: () => update({ menuSide: null }),
    replace: (side: PanoramaSide) => state.sides[side].status === 'ready' ? run(side) : Promise.resolve(),
    requestRemove: (side: PanoramaSide) => { if (!roomTourBusy(state) && state.sides[side].status === 'ready') update({ menuSide: null, removeSide: side }); },
    cancelRemove: () => update({ removeSide: null }),
    confirmRemove: async () => {
      const side = state.removeSide;
      if (disposed || !side || !context || state.removing) return;
      const g = generation, c = context;
      update({ removing: true, notice: null });
      try { await service.remove(c, side); if (!alive(g)) return; setSide(side, { status: 'idle', panorama: null, problem: null }); update({ removeSide: null }); }
      catch (error) { if (alive(g)) update({ removeSide: null, notice: noticeOf(error) }); }
      finally { if (alive(g)) update({ removing: false }); }
    },
  };
}
export type PropertyPanoramaWorkflow = ReturnType<typeof createPropertyPanoramaWorkflow>;
