//Application shell — top app bar + tabbed navigation (Form, Report, Pie, Bar, Settings)
import { useEffect, useMemo, useState } from 'react';
// MUI components for layout and controls
import { AppBar, Toolbar, Typography, Container, Tabs, Tab, FormControl, InputLabel, Select, MenuItem, Stack, Snackbar, Alert } from '@mui/material';
// Import main feature components
import CostForm from './components/CostForm';
import ReportTable from './components/ReportTable';
import PieByCategory from './components/PieByCategory';
import BarByMonth from './components/BarByMonth';
import Settings from './components/Settings';
// Types and DB helper
import { Currency } from './types';
import { openCostsDB } from './services/idb';

// Utility: get current year
function thisYear() { return new Date().getFullYear(); }
// Utility: get current month (1-based)
function thisMonth() { return new Date().getMonth() + 1; }

export default function App() {
  // Main tab state (0 = Add Cost, 1 = Report, etc.)
  const [tab, setTab] = useState(0);
  // Selected year/month/currency for reports/charts
  const [year, setYear] = useState(thisYear());
  const [month, setMonth] = useState(thisMonth());
  const [currency, setCurrency] = useState<Currency>('USD');
  // Snackbar message state
  const [snack, setSnack] = useState<string>('');

  // On mount: open IndexedDB and show status
  useEffect(() => {
    openCostsDB('costsDB', 1)
      .then(() => setSnack('Database ready.'))
      .catch((e) => setSnack('DB error: ' + e.message));
  }, []);

  // Memoized year/month lists for dropdowns
  const years = useMemo(() => { const y = thisYear(); return Array.from({length:6},(_,i)=>y-i); }, []);
  const months = useMemo(() => Array.from({length:12},(_,i)=>i+1), []);

  return (<>
    {/* AppBar: Title and currency selector */}
    <AppBar position="static" color="primary" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Cost Manager</Typography>
        <FormControl size="small" sx={{ mr: 2, minWidth: 100 }}>
          <InputLabel>Currency</InputLabel>
          <Select label="Currency" value={currency} onChange={(e)=>setCurrency(e.target.value as Currency)}>
            <MenuItem value="USD">USD</MenuItem><MenuItem value="ILS">ILS</MenuItem><MenuItem value="GBP">GBP</MenuItem><MenuItem value="EURO">EURO</MenuItem>
          </Select>
        </FormControl>
      </Toolbar>
    </AppBar>

    {/* Main container: year/month selectors, tabs, and content */}
    <Container sx={{ mt: 3, mb: 4 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        {/* Year selector */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Year</InputLabel>
          <Select label="Year" value={year} onChange={(e)=>setYear(Number(e.target.value))}>
            {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        {/* Month selector */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Month</InputLabel>
          <Select label="Month" value={month} onChange={(e)=>setMonth(Number(e.target.value))}>
            {months.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {/* Tabs for navigation */}
      <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Add Cost" /><Tab label="Report" /><Tab label="Pie by Category" /><Tab label="Bar by Month" /><Tab label="Settings" />
      </Tabs>

      {/* Tab content: show relevant component */}
      {tab===0 && <CostForm onAdded={()=>setSnack('Cost added.')} />}
      {tab===1 && <ReportTable year={year} month={month} currency={currency} />}
      {tab===2 && <PieByCategory year={year} month={month} currency={currency} />}
      {tab===3 && <BarByMonth year={year} currency={currency} />}
      {tab===4 && <Settings onRatesSaved={()=>setSnack('Rates saved.')} onImported={()=>setSnack('Import complete.')} />}
    </Container>

    {/* Snackbar for status messages */}
    <Snackbar open={!!snack} autoHideDuration={2500} onClose={()=>setSnack('')}>
      <Alert severity="info" onClose={()=>setSnack('')}>{snack}</Alert>
    </Snackbar>
  </>);
}
