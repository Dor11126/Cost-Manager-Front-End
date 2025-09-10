/** App bootstrap: mounts React root, wraps ThemeProvider, initializes currency rates. */
import React from 'react';
import ReactDOM from 'react-dom/client';
// MUI theme and baseline
import { CssBaseline, ThemeProvider } from '@mui/material';
import App from './App';
import theme from './theme'; // single source of truth
import { initCurrencyRates } from './services/currency';

// Get root element and create React root
const rootEl = document.getElementById('root')!;
const root = ReactDOM.createRoot(rootEl);

// Initialize currency rates on startup (fetch from URL unless inline JSON mode is selected)
initCurrencyRates().catch(() => {
  // don't block rendering on network errors; Settings screen will let you fix it
});

// Render main app with theme and baseline
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
