import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider } from '@/features/auth/auth-context';
import { ListingDraftProvider } from '@/features/listings/listing-draft-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <ListingDraftProvider>
        <ThemeProvider value={DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup/name" />
            <Stack.Screen name="signup/nickname" />
            <Stack.Screen name="signup/email" />
            <Stack.Screen name="signup/phone" />
            <Stack.Screen name="signup/password" />
            <Stack.Screen name="signup/otp" />
            <Stack.Screen name="signup/complete" />
            <Stack.Screen name="home" />
            <Stack.Screen name="listing/[id]" />
            <Stack.Screen name="listings/map" />
            <Stack.Screen name="listings/filters" />
            <Stack.Screen name="listings/new/index" />
            <Stack.Screen name="listings/new/media" />
            <Stack.Screen name="listings/new/details" />
            <Stack.Screen name="listings/new/specs" />
            <Stack.Screen name="listings/new/location" />
            <Stack.Screen name="listings/new/pricing" />
          </Stack>
        </ThemeProvider>
      </ListingDraftProvider>
    </AuthProvider>
  );
}
