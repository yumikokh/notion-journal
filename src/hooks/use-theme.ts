/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Palettes } from '@/constants/theme';
import { usePalette } from '@/features/settings/palette-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const { palette } = usePalette();
  const theme = scheme === 'unspecified' ? 'light' : scheme;

  return Palettes[palette][theme];
}
