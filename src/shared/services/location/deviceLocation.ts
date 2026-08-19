import * as Location from 'expo-location';

export interface DeviceCoordinates { latitude: number; longitude: number }

export async function requestCurrentLocation(): Promise<DeviceCoordinates> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location permission was not granted.');
  const location = await Location.getCurrentPositionAsync({});
  return { latitude: location.coords.latitude, longitude: location.coords.longitude };
}
