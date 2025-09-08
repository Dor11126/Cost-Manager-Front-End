import type { Rates, Currency } from '../types';

/**
 * DEFAULT: always fetch from this URL on every new session (unless the user explicitly
 * switches to 'inline JSON' in Settings). No fallback to local cache or sample file.
 */
export const DEFAULT_RATES_URL =
  'https://raw.githubusercontent.com/Dor11126/Cost-Manager-Front-End-exchange-rates/main/rates.json';

// LocalStorage keys for rates config
const LS_URL_KEY = 'ratesUrl';          // persists the chosen URL (optional override)
const LS_SOURCE_KEY = 'ratesSource';     // 'url' | 'inline-json'
const LS_INLINE_KEY = 'ratesInline';     // stringified JSON for inline mode

type Source = 'url' | 'inline-json';

/** -------- In-memory current rates (used by convert) -------- */
let currentRates: Rates | null = null;
export function getCurrentRates(): Rates | null { return currentRates; }
export function getCachedSessionRates(): Rates | null { return currentRates; } // <- for idb.ts compatibility
export function setCurrentRates(r: Rates | null) { currentRates = r; }

/** -------- Source & URL helpers -------- */
export function getRatesSource(): Source {
  const s = (localStorage.getItem(LS_SOURCE_KEY) || 'url') as Source;
  return s === 'inline-json' ? 'inline-json' : 'url';
}
export function setRatesSource(s: Source) { localStorage.setItem(LS_SOURCE_KEY, s); }

export function getRatesUrl(): string {
  return localStorage.getItem(LS_URL_KEY) || DEFAULT_RATES_URL;
}
export function setRatesUrl(url: string) {
  localStorage.setItem(LS_URL_KEY, url || DEFAULT_RATES_URL);
  setRatesSource('url');
}

/** -------- Inline JSON helpers -------- */
export function getInlineRates(): Rates | null {
  try { return JSON.parse(localStorage.getItem(LS_INLINE_KEY) || 'null'); }
  catch { return null; }
}
export function setInlineRates(rates: Rates) {
  localStorage.setItem(LS_INLINE_KEY, JSON.stringify(rates));
  setRatesSource('inline-json');
  // apply immediately in this session
  setCurrentRates(rates);
  // best-effort persist in idb as well
  void applyRatesToIdb(rates);
}

/** -------- Validation (no defaults injected) -------- */
export function normalizeRates(obj: any): Rates {
  const out: any = {};
  (['USD','ILS','GBP','EURO'] as const).forEach((k) => {
    const v = Number(obj?.[k]);
    if (!Number.isFinite(v) || v <= 0) throw new Error('Invalid rate for ' + k);
    out[k] = v;
  });
  return out as Rates;
}

/** -------- Fetch with cache-busting (fresh each session) -------- */
export async function fetchRatesFrom(url: string): Promise<Rates> {
  const finalUrl = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
  const res = await fetch(finalUrl, { mode: 'cors', cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let data: unknown;
  try {
    data = await res.json();
  } catch (e: any) {
    const text = await res.text().catch(()=>'');
    throw new Error('Invalid JSON: ' + (e?.message || '') + (text ? ' | received: ' + text.slice(0,120) : ''));
  }
  return normalizeRates(data);
}

/** -------- Apply rates into idb service if available -------- */
async function applyRatesToIdb(rates: Rates): Promise<void> {
  try {
    const mod: any = await import('./idb');
    if (typeof mod.setRates === 'function') mod.setRates(rates);
    if (typeof mod.saveRates === 'function') await mod.saveRates(rates);
  } catch {
    // if idb module or functions are missing, skip silently
  }
}

/**
 * Initialize rates on app start.
 * Policy:
 * - If source = 'inline-json': use the stored inline JSON (user override), do not fetch.
 * - Else (default): always fetch from URL (default is GitHub raw), ignoring any local cache.
 */
export async function initCurrencyRates(): Promise<void> {
  const source = getRatesSource();
  try {
    if (source === 'inline-json') {
      const inline = getInlineRates();
      if (!inline) throw new Error('Inline JSON not set.');
      setCurrentRates(inline);
      await applyRatesToIdb(inline);
    } else {
      const url = getRatesUrl();
      const rates = await fetchRatesFrom(url);
      setCurrentRates(rates);
      await applyRatesToIdb(rates);
    }
  } finally {
    window.dispatchEvent(new CustomEvent('fx:rates-ready'));
  }
}

/** Manual refresh from the current URL (used by Settings “Refresh rates”). */
export async function refreshRatesFromUrl(): Promise<Rates> {
  const rates = await fetchRatesFrom(getRatesUrl());
  setCurrentRates(rates);
  await applyRatesToIdb(rates);
  return rates;
}

/** Currency conversion used by other modules */
export function convert(amount: number, from: Currency, to: Currency, rates?: Rates): number {
  const r = rates || currentRates;
  if (!r) {
    if (from === to) return Number(amount) || 0;
    throw new Error('Rates are not loaded yet.');
  }
  const rf = r[from as keyof Rates] as number;
  const rt = r[to as keyof Rates] as number;
  if (!rf || !rt) throw new Error('Missing rate for conversion.');
  const value = (Number(amount) || 0) / rf * rt;
  return value;
}

/** Small UI helper */
export function toFixed2(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}
