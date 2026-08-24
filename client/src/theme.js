import { createTheme, alpha } from '@mui/material/styles';
import { NAVY, TEAL, TEAL_DARK } from './utils/constants';

export const getTheme = (mode = 'light') => {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#7fa6cc' : NAVY,
        light: '#33507a',
        dark: '#051423',
        contrastText: '#ffffff',
      },
      secondary: {
        main: TEAL,
        light: '#5cd6c3',
        dark: TEAL_DARK,
        contrastText: '#ffffff',
      },
      success: { main: '#16a34a' },
      error:   { main: '#dc2626' },
      warning: { main: '#d97706' },
      background: {
        default: isDark ? '#0d1117' : '#f0f4f8',
        paper:   isDark ? '#161b22' : '#ffffff',
      },
      divider: isDark ? 'rgba(255,255,255,0.09)' : '#e2e8f0',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 800 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 8 },
          containedSecondary: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none', backgroundColor: TEAL_DARK },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : '#e2e8f0'}`,
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(10,37,64,0.05)',
            backgroundImage: 'none',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: TEAL },
            '&:hover:not(.Mui-focused) .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(TEAL, 0.6),
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { '&.Mui-focused': { color: TEAL_DARK } },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: NAVY,
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.78rem',
            letterSpacing: '0.04em',
            paddingTop: 10,
            paddingBottom: 10,
            whiteSpace: 'nowrap',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': { backgroundColor: alpha(TEAL, 0.06) },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 14, backgroundImage: 'none' } },
      },
      MuiDrawer: {
        styleOverrides: { paper: { backgroundImage: 'none' } },
      },
      MuiAppBar: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
    },
  });
};

export default getTheme('light');
