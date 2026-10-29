import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { createDeviceLocationAdapter } from './deviceLocationAdapter';

export interface DeviceCoordinates { latitude: number; longitude: number }

export const requestCurrentLocation = createDeviceLocationAdapter({
  permission: () => Location.requestForegroundPermissionsAsync(),
  enabled: () => Location.hasServicesEnabledAsync(),
  position: async () => {
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: location.coords.latitude, longitude: location.coords.longitude };
  },
});
export const openLocationSettings = () => Linking.openSettings();
