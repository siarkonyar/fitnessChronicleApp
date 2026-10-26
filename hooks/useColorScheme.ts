import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * The system light/dark setting, or null when the system gives none.
 *
 * Since React Native 0.83 the scheme can also be 'unspecified'. Mapping it to
 * null keeps every `useColorScheme() ?? 'light'` caller indexing `Colors` with
 * a real theme.
 */
export function useColorScheme(): 'light' | 'dark' | null {
  const colorScheme = useRNColorScheme();
  return colorScheme === 'light' || colorScheme === 'dark' ? colorScheme : null;
}
