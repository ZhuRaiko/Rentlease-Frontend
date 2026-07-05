import type { Href } from 'expo-router';

export const authRoutes = {
  welcome: '/' as Href,
  login: '/login' as Href,
  home: '/home' as Href,
  signupName: '/signup/name' as Href,
  signupNickname: '/signup/nickname' as Href,
  signupEmail: '/signup/email' as Href,
  signupPhone: '/signup/phone' as Href,
  signupPassword: '/signup/password' as Href,
  signupOtp: '/signup/otp' as Href,
  signupComplete: '/signup/complete' as Href,
} as const;
