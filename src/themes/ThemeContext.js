// The active theme object (one entry of themes.js), so shared UI pieces such
// as Button can read it without every caller passing `theme` down.
import { createContext, useContext } from 'react';
import { themes } from './themes';

export const ThemeContext = createContext(themes.dark);
export const useTheme = () => useContext(ThemeContext);
