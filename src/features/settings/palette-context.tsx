import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { DEFAULT_PALETTE, parsePaletteKey, type PaletteKey } from '@/constants/theme';

const STORAGE_KEY = 'nikki:palette';

type PaletteContextValue = {
  palette: PaletteKey;
  setPalette: (next: PaletteKey) => void;
};

const PaletteContext = createContext<PaletteContextValue>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
});

/**
 * App-wide palette selection (settings > デザイン), persisted to
 * AsyncStorage. useTheme() resolves tokens through this, so switching
 * re-skins every screen immediately.
 */
export function PaletteProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<PaletteKey>(DEFAULT_PALETTE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      setPaletteState(parsePaletteKey(stored));
    });
  }, []);

  const setPalette = useCallback((next: PaletteKey) => {
    setPaletteState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Selection still applies for this session; persistence is best-effort.
    });
  }, []);

  return (
    <PaletteContext.Provider value={{ palette, setPalette }}>{children}</PaletteContext.Provider>
  );
}

export function usePalette(): PaletteContextValue {
  return useContext(PaletteContext);
}
