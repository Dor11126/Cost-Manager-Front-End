import { createTheme } from '@mui/material/styles';

// MUI theme with custom palette, typography, and shape
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1976d2' },
    secondary: { main: '#9c27b0' },
  },
  typography: {
    fontFamily: 'Inter, Roboto, Helvetica, Arial, sans-serif',
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper: { styleOverrides: { root: { borderRadius: 0 } } },
    MuiCard:  { styleOverrides: { root: { borderRadius: 16 } } },
    MuiButton:{ styleOverrides: { root: { borderRadius: 12, textTransform: 'none' } } },
  },
});

export default theme;
