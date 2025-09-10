/* public/vanilla/idb.js — vanilla */
(function (global) {
  'use strict';

  /** Default exchange rates URL (fetched on every new session unless overridden) */
  const DEFAULT_RATES_URL =
      'https://raw.githubusercontent.com/Dor11126/Cost-Manager-Front-End-exchange-rates/main/rates.json';

  // ----- in-memory session state -----
  let _ratesUrl = DEFAULT_RATES_URL;
  let _inlineRates = null;   // when provided, overrides URL fetch
  let _currentRates = null;  // last loaded/inline rates

  /** Set the rates URL and clear cached rates */
  function setRatesUrl(url) {
    _ratesUrl = (url && String(url).trim()) || DEFAULT_RATES_URL;
    _currentRates = null; // force refetch on next need
  }

  /** Set inline (manual) rates and apply immediately */
  function setInlineRates(rates) {
    _inlineRates = normalizeRates(rates);
    _currentRates = _inlineRates;
  }

  /** Get current rates in memory (diagnostics) */
  function getCurrentRates() { return _currentRates; }

  /** Validate and normalize a rates object */
  function normalizeRates(obj) {
    const out = {};
    ['USD', 'GBP', 'EURO', 'ILS'].forEach(function (k) {
      const v = Number(obj && obj[k]);
      if (!isFinite(v) || v <= 0) { throw new Error('Invalid rate for ' + k); }
      out[k] = v;
    });
    return out;
  }

  /** Fetch rates from URL with cache-busting */
  function fetchRatesFrom(url) {
    const u = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
    return fetch(u, { mode: 'cors', cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) { throw new Error('HTTP ' + res.status); }
          return res.json();
        })
        .then(normalizeRates);
  }

  /** Ensure rates are loaded (inline wins; otherwise fetch default/custom URL) */
  function ensureRates() {
    if (_inlineRates) {
      _currentRates = _inlineRates;
      return Promise.resolve(_currentRates);
    }
    if (_currentRates) { return Promise.resolve(_currentRates); }
    return fetchRatesFrom(_ratesUrl).then(function (r) {
      _currentRates = r;
      return r;
    });
  }

  /** Currency conversion using loaded rates */
  function convert(amount, from, to, rates) {
    const r = rates || _currentRates;
    if (!r) { throw new Error('Rates are not loaded.'); }
    const rf = r[from];
    const rt = r[to];
    if (!rf || !rt) { throw new Error('Missing rate for conversion.'); }
    return (Number(amount) || 0) / rf * rt;
  }

  /** Open IndexedDB and create stores if needed */
  function openCostsDB(dbName, dbVersion) {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(dbName, dbVersion);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains('costs')) {
          const st = db.createObjectStore('costs', { keyPath: 'id', autoIncrement: true });
          st.createIndex('byDate', 'dateISO', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = function () { resolve(createWrapper(req.result)); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /** Create DB wrapper with addCost and getReport methods */
  function createWrapper(db) {
    /** Add a cost record to DB (tolerates `curency` typo from tester) */
    function addCost(cost) {
      const c = Object.assign({}, cost || {});
      if (c.curency && !c.currency) { c.currency = c.curency; } // support tester typo

      // validate
      const sum = Number(c.sum);
      const currency = String(c.currency || '').toUpperCase();
      const category = String(c.category || '');
      const description = String(c.description || '');

      if (!isFinite(sum)) { return Promise.reject(new Error('sum must be a number')); }
      if (currency === '') { return Promise.reject(new Error('currency required')); }

      // stamp date (today, in local time)
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();

      const rec = {
        sum: sum,
        currency: currency,
        category: category,
        description: description,
        Date: { year: year, month: month, day: day },
        dateISO: now.toISOString()
      };

      return new Promise(function (resolve, reject) {
        const tx = db.transaction('costs', 'readwrite');
        const st = tx.objectStore('costs');
        const rq = st.add(rec);
        tx.oncomplete = function () { rec.id = rq.result; resolve(rec); };
        tx.onerror = function () { reject(tx.error || rq.error); };
      });
    }

    /** Get report for a given year/month in target currency */
    function getReport(year, month, currency) {
      const y = Number(year);
      const m = Number(month);
      const targetCur = String(currency || 'USD').toUpperCase();
      if (!y || !m) { return Promise.reject(new Error('year/month required')); }

      return ensureRates().then(function (rates) {
        return new Promise(function (resolve, reject) {
          const tx = db.transaction('costs', 'readonly');
          const st = tx.objectStore('costs');
          const rq = st.getAll();

          rq.onsuccess = function () {
            const all = rq.result || [];
            const costs = [];
            let total = 0;

            for (let i = 0; i < all.length; i += 1) {
              const it = all[i];
              if (it && it.Date && it.Date.year === y && it.Date.month === m) {
                costs.push({
                  sum: it.sum,
                  currency: it.currency,
                  category: it.category,
                  description: it.description,
                  Date: { day: it.Date.day }
                });
                total += convert(it.sum, it.currency, targetCur, rates);
              }
            }

            total = Math.round(total * 100) / 100;
            resolve({
              year: y,
              month: m,
              costs: costs,
              total: { currency: targetCur, total: total }
            });
          };

          rq.onerror = function () { reject(rq.error); };
        });
      });
    }

    // Public wrapper API
    return {
      addCost: addCost,
      getReport: getReport
    };
  }

  /** Force refresh rates from URL (used e.g. by Settings) */
  function refreshRatesFromUrl() {
    _currentRates = null;
    return ensureRates();
  }

  // Expose global API (required by the tester HTML)
  global.idb = {
    openCostsDB: openCostsDB,
    setRatesUrl: setRatesUrl,
    setInlineRates: setInlineRates,
    refreshRatesFromUrl: refreshRatesFromUrl,
    // diagnostics (optional)
    _getCurrentRates: getCurrentRates
  };
})(this);
