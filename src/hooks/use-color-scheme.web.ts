import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Keep web static rendering on a stable light theme until the platform reports a scheme.
 */
export function useColorScheme() {
  return useRNColorScheme() ?? 'light';
}
