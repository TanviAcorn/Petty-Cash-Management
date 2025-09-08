import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const ColorModeContext = createContext({ mode: 'light', toggle: () => {}, setMode: () => {} });

export const useColorMode = () => useContext(ColorModeContext);

export const ColorModeProvider = ({ children }) => {
  const getInitialMode = () => {
    try {
      const saved = localStorage.getItem('themeMode');
      if (saved === 'light' || saved === 'dark') return saved;
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  };

  const [mode, setMode] = useState(getInitialMode);

  useEffect(() => {
    try { localStorage.setItem('themeMode', mode); } catch {}
  }, [mode]);

  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode]);

  const value = useMemo(() => ({ mode, setMode, toggle: () => setMode(m => (m === 'light' ? 'dark' : 'light')) }), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
