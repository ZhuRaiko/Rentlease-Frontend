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
            <Stack.Screen name="home" options={{ animation: 'none' }} />
            <Stack.Screen name="listing/[id]" />
            <Stack.Screen name="listing/[id]/reviews" />
            <Stack.Screen name="listings/map" />
            <Stack.Screen name="listings/filters" />
            <Stack.Screen name="listings/new/index" />
            <Stack.Screen name="listings/new/media" />
            <Stack.Screen name="listings/new/details" />
            <Stack.Screen name="listings/new/specs" />
            <Stack.Screen name="listings/new/location" />
            <Stack.Screen name="listings/new/pricing" />
            <Stack.Screen name="chat" options={{ animation: 'none' }} />
            <Stack.Screen name="chat/[threadId]" />
            <Stack.Screen name="schedule" />
            <Stack.Screen name="maintenance" options={{ animation: 'none' }} />
            <Stack.Screen name="maintenance/new" />
            <Stack.Screen name="reminders" />
            <Stack.Screen name="recommendations/intro" />
            <Stack.Screen name="recommendations/survey" />
            <Stack.Screen name="recommendations/results" options={{ animation: 'none' }} />
            <Stack.Screen name="profile" options={{ animation: 'none' }} />
            <Stack.Screen name="verification" />
            <Stack.Screen name="verification/tier2" />
            <Stack.Screen name="verification/tier3" />
            <Stack.Screen name="admin/verifications" />
            <Stack.Screen name="trust/rate" />
            <Stack.Screen name="trust/report" />
            <Stack.Screen name="admin/reports" />
          </Stack>
        </ThemeProvider>
      </ListingDraftProvider>
    </AuthProvider>
  );
}
