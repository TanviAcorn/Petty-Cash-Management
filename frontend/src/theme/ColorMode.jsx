import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, responsiveFontSizes } from '@mui/material';

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

  const theme = useMemo(() => {
    // Brand tokens
    const palette = {
      mode,
      primary: { main: '#3B82F6', light: '#60A5FA', dark: '#1D4ED8' },
      secondary: { main: '#8B5CF6', light: '#A78BFA', dark: '#6D28D9' },
      success: { main: '#22C55E' },
      warning: { main: '#F59E0B' },
      error: { main: '#EF4444' },
      info: { main: '#06B6D4' },
      background: {
        default: mode === 'light' ? '#F8FAFC' : '#0B1020',
        paper: mode === 'light' ? '#FFFFFF' : '#0F172A',
      },
    };

    let base = createTheme({
      palette,
      shape: { borderRadius: 12 },
      typography: {
        fontFamily: `Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"`,
        h4: { fontWeight: 800, letterSpacing: -0.2 },
        h5: { fontWeight: 700 },
        subtitle1: { fontWeight: 600 },
        button: { fontWeight: 600, textTransform: 'none' },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundImage:
                mode === 'light'
                  ? 'radial-gradient(circle at 10% 0%, rgba(59,130,246,0.06) 0, transparent 40%), radial-gradient(circle at 90% 20%, rgba(139,92,246,0.06) 0, transparent 42%)'
                  : 'radial-gradient(circle at 10% 0%, rgba(59,130,246,0.12) 0, transparent 40%), radial-gradient(circle at 90% 20%, rgba(139,92,246,0.10) 0, transparent 42%)',
            },
          },
        },
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              borderRadius: 12,
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backdropFilter: 'saturate(180%) blur(8px)',
              backgroundColor: mode === 'light'
                ? 'rgba(255,255,255,0.8)'
                : 'rgba(15,23,42,0.8)',
            },
          },
        },
        MuiCard: {
          defaultProps: { elevation: 0 },
          styleOverrides: {
            root: {
              border: '1px solid',
              borderColor: palette.mode === 'light' ? '#EEF2F7' : '#1F2A44',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: { borderRadius: 10 },
            contained: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: { fontWeight: 600, letterSpacing: 0.2 },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              backgroundImage: 'none',
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: 10,
            },
          },
        },
        MuiTableHead: {
          styleOverrides: {
            root: {
              backgroundColor: mode === 'light' ? '#F1F5F9' : '#0B1222',
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: { borderRadius: 10 },
          },
        },
        MuiTooltip: {
          styleOverrides: {
            tooltip: { fontSize: 12 },
          },
        },
      },
    });

    base = responsiveFontSizes(base);
    return base;
  }, [mode]);

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
