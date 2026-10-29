import { validateCoordinates, type Coordinates } from '@rentlease/gps-local';

export type DeviceLocationResult = { kind: 'granted'; coordinates: Coordinates } | { kind: 'denied' | 'blocked' | 'services_disabled' | 'position_failed' | 'cancelled' };
interface LocationPort {
  permission(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  enabled(): Promise<boolean>;
  position(): Promise<Coordinates>;
}
// Pure service adapter. The native wrapper supplies foreground, one-shot APIs only.
export function createDeviceLocationAdapter(port: LocationPort, timeoutMs = 20000) {
  return async (signal?: AbortSignal): Promise<DeviceLocationResult> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (signal?.aborted) return { kind: 'cancelled' };
      const permission = await port.permission();
      if (signal?.aborted) return { kind: 'cancelled' };
      if (!permission.granted) return { kind: permission.canAskAgain ? 'denied' : 'blocked' };
      if (!await port.enabled()) return { kind: 'services_disabled' };
      if (signal?.aborted) return { kind: 'cancelled' };
      const coordinates = await Promise.race([
        port.position(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Position timeout')), timeoutMs); }),
      ]);
      if (signal?.aborted) return { kind: 'cancelled' };
      return { kind: 'granted', coordinates: validateCoordinates(coordinates) };
    } catch { return { kind: signal?.aborted ? 'cancelled' : 'position_failed' }; }
    finally { if (timer !== undefined) clearTimeout(timer); }
  };
}
