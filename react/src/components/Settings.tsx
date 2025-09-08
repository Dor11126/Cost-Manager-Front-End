import { useEffect, useRef, useState } from 'react';
// MUI imports for layout and controls
import {
  Paper, Stack, TextField, Button, Typography, Alert, Divider,
  RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import type { Rates } from '../types';
// Currency service helpers for rates management
import {
  getRatesSource, setRatesSource,
  getRatesUrl, setRatesUrl,
  setInlineRates, getInlineRates,
  refreshRatesFromUrl, normalizeRates, DEFAULT_RATES_URL
} from '../services/currency';

type Props = { onRatesSaved?: () => void; onImported?: () => void; };

export default function Settings({ onRatesSaved, onImported }: Props) {
  // State for source mode, URL, inline JSON, messages, errors
  const [source, setSource] = useState<'url'|'inline-json'>('url');
  const [url, setUrl] = useState('');
  const [inlineJson, setInlineJson] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  // Refs for file inputs
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // On mount: load current source, URL, and inline JSON
  useEffect(() => {
    const s = getRatesSource();
    setSource(s);
    setUrl(getRatesUrl());
    const inline = getInlineRates();
    if (inline) setInlineJson(JSON.stringify(inline, null, 2));
  }, []);

  // ---- Rates: URL mode ----
  async function saveUrl() {
    setMsg(''); setErr('');
    try {
      const finalUrl = (url || DEFAULT_RATES_URL).trim();
      setRatesUrl(finalUrl);
      setRatesSource('url');
      await refreshRatesFromUrl(); // test-fetch + persist if idb functions exist
      setMsg('URL saved & rates fetched.');
      onRatesSaved?.();
    } catch (e: any) {
      setErr('Failed to fetch: ' + (e?.message ?? e));
    }
  }

  // ---- Rates: Inline JSON mode ----
  async function saveInline() {
    setMsg(''); setErr('');
    try {
      const parsed = JSON.parse(inlineJson);
      const norm: Rates = normalizeRates(parsed);
      setInlineRates(norm); // switches source + applies immediately
      setMsg('Inline JSON saved.');
      onRatesSaved?.();
    } catch (e: any) {
      setErr('Invalid JSON: ' + (e?.message ?? e));
    }
  }

  // Load inline JSON from file
  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(''); setErr('');
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const text = await f.text();
      setInlineJson(text);
      setSource('inline-json');
      setRatesSource('inline-json');
      setMsg('Loaded JSON from file. Click "Save Inline JSON" to apply.');
      (e.target as any).value = '';
    } catch (e: any) {
      setErr('Failed reading file: ' + (e?.message ?? e));
    }
  }

  // ---- Backup & Restore ----
  async function exportData() {
    setMsg(''); setErr('');
    try {
      const mod: any = await import('../services/idb');
      let payload: any;
      if (typeof mod.exportAll === 'function') {
        payload = await mod.exportAll();
      } else {
        // Fallback: read directly from DB
        const db = await mod.openCostsDB('costsDB', 1);
        const costs: any[] = await new Promise((resolve, reject) => {
          const tx = db.transaction('costs', 'readonly');
          const store = tx.objectStore('costs');
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result as any[]);
          req.onerror = () => reject(req.error);
        });
        const curMod: any = await import('../services/currency');
        const rates = typeof curMod.getCurrentRates === 'function' ? curMod.getCurrentRates() : null;
        payload = { costs, rates };
      }
      // Download as JSON file
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `cost-manager-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg('Export complete.');
    } catch (e: any) {
      setErr('Export failed: ' + (e?.message ?? e));
    }
  }

  // Import data from file
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(''); setErr('');
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const mod: any = await import('../services/idb');
      if (typeof mod.importFromJson === 'function') {
        const added = await mod.importFromJson(json);
        setMsg(`Import complete. Added ${added} records.`);
      } else {
        // Fallback import logic
        const db = await mod.openCostsDB('costsDB', 1);
        const costs = Array.isArray(json?.costs) ? json.costs : [];
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('costs', 'readwrite');
          const store = tx.objectStore('costs');
          for (const item of costs) {
            const copy = { ...item };
            delete (copy as any).id; // let autoIncrement assign new id
            store.add(copy);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        if (json?.rates) {
          try {
            const norm = normalizeRates(json.rates);
            setInlineRates(norm); // apply + switch source to inline
          } catch { /* ignore rates if invalid */ }
        }
        setMsg(`Import complete. Added ${costs.length} records.`);
      }
      onImported?.();
    } catch (e: any) {
      setErr('Import failed: ' + (e?.message ?? e));
    } finally {
      (e.target as any).value = '';
    }
  }

  return (
    <Paper sx={{ p:2 }}>
      {/* Settings header */}
      <Typography variant="h6" sx={{ mb: 1 }}>Settings</Typography>

      {/* Rates source selection */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Rates source</Typography>
      <RadioGroup row value={source} onChange={(e)=>setSource(e.target.value as any)}>
        <FormControlLabel value="url" control={<Radio />} label="Fetch from URL (default)" onClick={()=>setRatesSource('url')} />
        <FormControlLabel value="inline-json" control={<Radio />} label="Inline JSON (manual)" onClick={()=>setRatesSource('inline-json')} />
      </RadioGroup>

      {/* URL mode controls */}
      {source === 'url' && (
        <Stack direction={{ xs:'column', sm:'row' }} spacing={2} alignItems="stretch" sx={{ mt: 1 }}>
          <TextField
            fullWidth label="Rates JSON URL"
            value={url}
            onChange={(e)=>setUrl(e.target.value)}
            placeholder={DEFAULT_RATES_URL}
          />
          <Stack direction="column" spacing={1} sx={{ minWidth: 220 }}>
            <Button variant="contained" onClick={saveUrl}>Save URL & Fetch</Button>
            <Button variant="outlined" onClick={async ()=>{ setMsg(''); setErr(''); try { await refreshRatesFromUrl(); setMsg('Rates refreshed.'); } catch(e:any){ setErr('Refresh failed: '+(e?.message??e)); } }}>Refresh rates</Button>
          </Stack>
        </Stack>
      )}

      {/* Inline JSON mode controls */}
      {source === 'inline-json' && (
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            fullWidth multiline minRows={6}
            label="Inline Rates JSON"
            value={inlineJson}
            onChange={(e)=>setInlineJson(e.target.value)}
            placeholder='{"USD":1,"GBP":1.8,"EURO":0.7,"ILS":3.4}'
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={saveInline}>Save Inline JSON</Button>
            <Button variant="outlined" onClick={()=>fileRef.current?.click()}>Load from file…</Button>
            <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onFileChange} />
          </Stack>
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Backup & Restore controls */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Backup & Restore</Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Button variant="outlined" onClick={exportData}>Export data (JSON)</Button>
        <Button variant="outlined" onClick={()=>importRef.current?.click()}>Import data (JSON)</Button>
        <input ref={importRef} type="file" accept="application/json" style={{ display:'none' }} onChange={onImportFile} />
      </Stack>

      {/* Status messages */}
      {msg && <Alert sx={{ mt:2 }} severity="success">{msg}</Alert>}
      {err && <Alert sx={{ mt:2 }} severity="error">{err}</Alert>}

      <Divider sx={{ my: 3 }} />

      {/* Info about rates policy */}
      <Typography variant="body2">
        Default URL: <code>{DEFAULT_RATES_URL}</code><br/>
        Each new session loads rates from the default URL. Override with a custom URL, or use Inline JSON for manual rates.
      </Typography>
    </Paper>
  );
}
