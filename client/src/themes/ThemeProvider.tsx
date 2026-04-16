import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { ThemeKey, themes } from './index';

interface ThemeContextValue {
  themeKey: ThemeKey;
  setThemeKey: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeKey: 'forest',
  setThemeKey: () => {},
});

const STORAGE_KEY = 'theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKeyState] = useState<ThemeKey>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && themes[stored as ThemeKey]) return stored as ThemeKey;
    return 'forest';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeKey);
  }, [themeKey]);

  const setThemeKey = (key: ThemeKey) => {
    setThemeKeyState(key);
  };

  return (
    <ThemeContext.Provider value={{ themeKey, setThemeKey }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeTokens() {
  const { themeKey } = useTheme();
  return themes[themeKey];
}
