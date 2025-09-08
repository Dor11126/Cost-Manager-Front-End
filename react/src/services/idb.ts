import { convert, getCachedSessionRates, setInlineRates, normalizeRates } from './currency';
import type { Report as UiReport, Currency, Rates } from '../types';

// Cost record shape for IndexedDB
export interface StoredCost {
  id?: number;
  sum: number;
  currency: Currency;
  category: string;
  description?: string;
  Date: { year: number; month: number; day: number };
  dateISO?: string;
}

// DB name and store constants
const DB_NAME = 'costsDB';
const STORE = 'costs';

// Promise for DB instance (singleton)
let dbPromise: Promise<IDBDatabase> | null = null;

// Open DB and create stores if needed
export function openCostsDB(name: string = DB_NAME, version: number = 1): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_date', ['Date.year', 'Date.month', 'Date.day']);
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// Get DB instance (open if not already)
async function getDB(): Promise<IDBDatabase> {
  return dbPromise ?? openCostsDB();
}

// Utility: today's date as {year, month, day}
function today(): { year: number; month: number; day: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

// Add a cost record to DB
export async function addCost(input: {
  sum: number;
  currency: Currency;
  category: string;
  description?: string;
  dateISO?: string;
}) {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  // Parse date from input or use today
  const dateRec =
    input.dateISO
      ? (() => {
          const d = new Date(input.dateISO!);
          return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
        })()
      : today();

  // Build cost item
  const item: StoredCost = {
    sum: Number(input.sum || 0),
    currency: input.currency,
    category: input.category,
    description: input.description ?? '',
    Date: dateRec,
    dateISO: input.dateISO,
  };

  store.add(item as any);
  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// Get current session rates (from currency service)
function sessionRates(): Rates | null {
  return getCachedSessionRates();
}

// Convert value using rates (or return original if missing)
function conv(v: number, from: Currency, to: Currency, r: Rates | null) {
  if (!r || from === to) return v;
  const x = convert(v, from, to, r as Rates); // r checked above
  return Number.isFinite(x) ? x : v;
}

/** Transform stored record -> UI CostItem expected by src/types (Date only with day) */
function toUiCost(c: StoredCost, target: Currency, r: Rates | null) {
  return {
    sum: conv(Number(c.sum || 0), c.currency, target, r),
    currency: target,
    category: c.category,
    description: c.description ?? '',
    Date: { day: c.Date?.day ?? 1 },
  };
}

// Get detailed report for year/month/currency
export async function getReport(year: number, month: number, currency: Currency): Promise<UiReport> {
  const r = sessionRates();
  const db = await getDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);

  // Get all cost records
  const rows: StoredCost[] = await new Promise((res, rej) => {
    const rq = store.getAll();
    rq.onsuccess = () => res((rq.result || []) as StoredCost[]);
    rq.onerror = () => rej(rq.error);
  });

  // Filter by year/month
  const filtered = rows.filter((c) => c.Date?.year === year && c.Date?.month === month);
  // Convert to UI format
  const costs = filtered.map((c) => toUiCost(c, currency, r));
  // Calculate total
  const total = Math.round(costs.reduce((s, c) => s + Number(c.sum || 0), 0) * 100) / 100;

  const report: UiReport = { year, month, costs, total: { currency, total } } as UiReport;
  return report;
}

// Get totals by category for pie chart
export async function getMonthCategoryTotals(
  year: number,
  month: number,
  currency: Currency
): Promise<{ name: string; value: number }[]> {
  const r = sessionRates();
  const db = await getDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);

  // Get all cost records
  const rows: StoredCost[] = await new Promise((res, rej) => {
    const rq = store.getAll();
    rq.onsuccess = () => res((rq.result || []) as StoredCost[]);
    rq.onerror = () => rej(rq.error);
  });

  // Filter by year/month
  const filtered = rows.filter((c) => c.Date?.year === year && c.Date?.month === month);
  // Aggregate by category
  const map = new Map<string, number>();
  for (const c of filtered) {
    const amount = conv(Number(c.sum || 0), c.currency, currency, r);
    map.set(c.category, (map.get(c.category) || 0) + amount);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

// Get totals per month for bar chart
export async function getYearMonthTotals(
  year: number,
  currency: Currency
): Promise<{ month: string; total: number }[]> {
  const r = sessionRates();
  const db = await getDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);

  // Get all cost records
  const rows: StoredCost[] = await new Promise((res, rej) => {
    const rq = store.getAll();
    rq.onsuccess = () => res((rq.result || []) as StoredCost[]);
    rq.onerror = () => rej(rq.error);
  });

  // Filter by year
  const filtered = rows.filter((c) => c.Date?.year === year);
  // Aggregate by month
  const map = new Map<number, number>();
  for (const c of filtered) {
    const amount = conv(Number(c.sum || 0), c.currency, currency, r);
    map.set(c.Date.month, (map.get(c.Date.month) || 0) + amount);
  }
  // Build array for all 12 months
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return { month: String(m).padStart(2, '0'), total: +(map.get(m) || 0) };
  });
}

/* ---- Export / Import ---- */
// Export all costs and rates as JSON
export async function exportAll() {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const all: StoredCost[] = await new Promise((res, rej) => {
    const rq = store.getAll();
    rq.onsuccess = () => res((rq.result || []) as StoredCost[]);
    rq.onerror = () => rej(rq.error);
  });

  // Try to export current session rates (if available)
  let rates: Rates | undefined;
  try {
    const r = getCachedSessionRates();
    if (r) rates = r;
  } catch {}

  return { costs: all, rates };
}

/** Accepts either an array of items or an object with { costs, rates } */
export async function importFromJson(json: any): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);

  // Parse costs array from input
  const arr: any[] = Array.isArray(json) ? json : Array.isArray(json?.costs) ? json.costs : [];
  let added = 0;

  // Add each cost record
  for (const raw of arr) {
    const c: StoredCost = {
      sum: Number(raw.sum || 0),
      currency: raw.currency as Currency,
      category: String(raw.category || ''),
      description: raw.description ?? '',
      Date:
        raw.Date && typeof raw.Date === 'object' && typeof raw.Date.year === 'number'
          ? { year: raw.Date.year, month: raw.Date.month, day: raw.Date.day }
          : today(),
      dateISO: raw.dateISO,
    };
    store.add(c as any);
    added++;
  }

  await new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });

  // Apply rates from the import, if provided
  if (json && typeof json === 'object' && !Array.isArray(json) && typeof json.rates === 'object') {
    try {
      const norm = normalizeRates(json.rates);
      setInlineRates(norm); // applies immediately (switches to inline mode)
      dispatchEvent(new CustomEvent('fx:rates-ready'));
    } catch {
      // ignore invalid rates
    }
  }

  return added;
}
