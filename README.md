# Cost Manager Front-End

**Developers**
- Dor Cohen
- Maor Levin

## Overview
**Cost Manager** is a front‑end web application built with **React + TypeScript** and **Material UI (MUI)** for recording expenses, producing monthly reports, and visualizing totals with charts (Recharts). Data is stored locally in the browser via **IndexedDB**, accessed through a custom `idb` helper library. Exchange rates are **fetched from a server API** and can also be **entered manually** from *Settings* when needed.

The app is deployed at:https://frontend-course-maorlevin-dorcohen.netlify.app/

This project helps users track expenses, create monthly reports, and visualize spending with charts, supporting multiple currencies and live exchange rates:
1. **Add cost items** — amount, currency, category, description (date is set automatically on insert).
2. **Monthly report** — detailed report for a selected year/month in a chosen currency (conversion applied).
3. **Pie chart** — totals **by category** for a selected month/year.
4. **Bar chart** — totals **per month** for all 12 months of a selected year.
5. **Currency selection** for reports/charts with **rates retrieved from a server**.
6. **Settings screen** to specify the **Rates JSON URL** (or paste/upload JSON manually).

---

## Currency conversion (API‑first design)

### Default behavior (each new session)
- On every app start (new session), the app **always fetches exchange rates from a default API URL**.
- Default API URL:
  ```
  https://raw.githubusercontent.com/Dor11126/Cost-Manager-Front-End-exchange-rates/main/rates.json
  ```
- The request is made with cache‑busting to ensure **fresh data** on each session.

### Settings — two modes
- **Fetch from URL (default):** set a custom URL and click **Save & Fetch** (or **Refresh rates**) to pull fresh rates.
- **Inline JSON (manual):** paste JSON directly or **Load from file…**; click **Save Inline JSON** to apply. This mode overrides the URL until you switch back.

### Expected JSON shape (USD baseline)
The API must respond with this JSON schema (all four currencies required):
```json
{ "USD": 1, "GBP": 1.8, "EURO": 0.7, "ILS": 3.4 }
```
Interpretation: values are **units per 1 USD** (e.g., `1 USD = 3.4 ILS`).

### Conversion formula (used everywhere)
```
valueInTarget = sum / rate[fromCurrency] * rate[targetCurrency]
```
All totals in reports and charts use the same formula, then **rounded to two decimals** for display consistency.

### Troubleshooting
- The URL must return valid JSON with CORS (`Access-Control-Allow-Origin: *`).  
- Local file paths like `file:///...` won’t work; serve JSON over HTTP/HTTPS instead (e.g., GitHub Raw or your own host).
- Inline mode supports pasting JSON or using a `data:application/json,...` URL if needed.

---

### IndexedDB schema
- **DB name:** `costsDB`  
- **Stores:**
  - `costs` (keyPath `id`, autoIncrement)  
  - `meta` (keyPath `key`) — optional, for metadata such as `rates`

---

## Core services

### `src/services/idb.ts`
- `openCostsDB(name, version)` — creates/opens the DB and stores.
- `addCost({ sum, currency, category, description })` — inserts a new cost with `Date: { year, month, day }` and `dateISO`.
- `getReport(year, month, currency)` — returns a detailed report:
  ```json
  {
    "year": 2025,
    "month": 9,
    "costs": [
      { "sum": 200, "currency": "USD", "category": "Food", "description": "Milk 3%", "Date": { "day": 12 } }
    ],
    "total": { "currency": "USD", "total": 440 }
  }
  ```
- `getMonthCategoryTotals(year, month, currency)` — totals by category (pie).
- `getYearMonthTotals(year, currency)` — totals per month (bar).
- **Export/Import:**
  - `exportAll()` → `{ costs, rates }`
  - `importFromJson({ costs, rates })` → adds records and (optionally) applies rates.

### `src/services/currency.ts`
- **API‑first policy**: fetch rates from the default URL on **every new session**, no built‑in/sample fallback.
- `getRatesUrl()` / `setRatesUrl(url)` — configure the URL in *Settings*.
- `initCurrencyRates()` — loads rates on startup according to the selected source (URL or Inline).
- `refreshRatesFromUrl()` — force refresh from current URL.
- `setInlineRates(rates)` / `getInlineRates()` — manual (inline) mode.
- `convert(amount, from, to, rates?)` — conversion function used by reports/charts.
- `toFixed2(n)` — UI helper for formatting.

---

## Vanilla `idb.js` (for automated grading)
A vanilla build exposes a global `idb` object when included via `<script src="idb.js"></script>`:
- `idb.openCostsDB(name, version)`
- `db.addCost({ sum, currency, category, description })`
- `db.getReport(year, month, currency)`

> If the grader needs currency conversion during vanilla tests, they can preload rates by calling:  
> `saveRates({ "USD":1, "GBP":1.8, "EURO":0.7, "ILS":3.4 })` before `getReport(...)`.

---

## Running the project
**Prerequisites:** Node.js LTS and npm.

```powershell
cd react
npm i
npm run dev
```
The dev server runs on a **fixed port** (`http://localhost:5182/`), so your IndexedDB/LocalStorage data persists across restarts for the same origin.

### First‑time setup
1. Open **Settings**.
2. Use the default API URL (or set your own) and click **Save & Fetch**.  
   Alternatively, switch to **Inline JSON** and paste/upload:
   ```json
   { "USD": 1, "GBP": 1.8, "EURO": 0.7, "ILS": 3.4 }
   ```
3. Go to **Report** and select Year/Month/Currency.

### Reset data
Chrome DevTools → Application → **Clear storage** (or delete the `costsDB` and related LocalStorage keys).

### Export / Import
- In **Settings**:
  - **Export data (JSON)** — downloads `{ costs, rates }`.
  - **Import data (JSON)** — restores from a previous export.

---

## Notes
- Supported currencies: `USD`, `ILS`, `GBP`, `EURO`.
- All totals and charts use identical conversion logic (see formula above).
