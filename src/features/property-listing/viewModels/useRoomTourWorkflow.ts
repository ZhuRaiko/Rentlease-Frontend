import { useEffect, useState, useSyncExternalStore } from 'react';
import { propertyPanoramaService, selectPropertyPanorama } from '../services/propertyPanoramaDependencies';
import { createPropertyPanoramaWorkflow } from './propertyPanoramaWorkflow';

/** Owner's room tour for the saved property being edited. Composed into usePropertyListingViewModel as `roomTour`; the View only renders this state and calls its actions. */
export function useRoomTourWorkflow(propertyId: string | null) {
  const [workflow] = useState(() => createPropertyPanoramaWorkflow(propertyPanoramaService, selectPropertyPanorama));
  const state = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot);
  useEffect(() => { workflow.activate(); return () => workflow.dispose(); }, [workflow]);
  useEffect(() => { workflow.setProperty(propertyId); }, [workflow, propertyId]);
  return { state, ...workflow };
}
export type RoomTourViewModel = ReturnType<typeof useRoomTourWorkflow>;
