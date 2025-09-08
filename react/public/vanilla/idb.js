(function (global) {
  'use strict';

  // Default exchange rates URL (always fetched unless overridden)
  var DEFAULT_RATES_URL = 'https://raw.githubusercontent.com/Dor11126/Cost-Manager-Front-End-exchange-rates/main/rates.json';

  // ----- in-memory session state -----
  var _ratesUrl = DEFAULT_RATES_URL;
  var _inlineRates = null; // when provided, overrides URL
  var _currentRates = null;

  // Set the rates URL and clear cached rates
  function setRatesUrl(url) {
    _ratesUrl = (url && String(url).trim()) || DEFAULT_RATES_URL;
    _currentRates = null; // force refetch on next need
  }
  // Set inline rates (manual mode) and apply immediately
  function setInlineRates(rates) {
    _inlineRates = normalizeRates(rates);
    _currentRates = _inlineRates;
  }
  // Get current rates in memory
  function getCurrentRates() { return _currentRates; }

  // Validate and normalize rates object
  function normalizeRates(obj) {
    var out = {};
    ['USD','GBP','EURO','ILS'].forEach(function(k){
      var v = Number(obj && obj[k]);
      if (!isFinite(v) || v <= 0) throw new Error('Invalid rate for ' + k);
      out[k] = v;
    });
    return out;
  }

  // Fetch rates from URL with cache-busting
  function fetchRatesFrom(url) {
    var u = url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
    return fetch(u, { mode: 'cors', cache: 'no-store' })
      .then(function(res){
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(normalizeRates);
  }

  // Ensure rates are loaded (inline or fetch from URL)
  function ensureRates() {
    if (_inlineRates) {
      _currentRates = _inlineRates;
      return Promise.resolve(_currentRates);
    }
    if (_currentRates) return Promise.resolve(_currentRates);
    return fetchRatesFrom(_ratesUrl).then(function(r){
      _currentRates = r;
      return r;
    });
  }

  // Currency conversion using loaded rates
  function convert(amount, from, to, rates) {
    var r = rates || _currentRates;
    if (!r) throw new Error('Rates are not loaded.');
    var rf = r[from]; var rt = r[to];
    if (!rf || !rt) throw new Error('Missing rate for conversion.');
    return (Number(amount) || 0) / rf * rt;
  }

  // Open IndexedDB and create stores if needed
  function openCostsDB(dbName, dbVersion) {
    return new Promise(function(resolve, reject){
      var req = indexedDB.open(dbName, dbVersion);
      req.onupgradeneeded = function(e){
        var db = req.result;
        if (!db.objectStoreNames.contains('costs')) {
          var st = db.createObjectStore('costs', { keyPath: 'id', autoIncrement: true });
          st.createIndex('byDate', 'dateISO', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = function(){ resolve(createWrapper(req.result)); };
      req.onerror = function(){ reject(req.error); };
    });
  }

  // Create DB wrapper with addCost and getReport methods
  function createWrapper(db) {
    // Add a cost record to DB
    function addCost(cost) {
      var c = Object.assign({}, cost || {});
      // tolerate 'curency' typo from the sample tester
      if (c.curency && !c.currency) c.currency = c.curency;
      // validate
      var sum = Number(c.sum);
      var currency = String(c.currency || '').toUpperCase();
      var category = String(c.category || '');
      var description = String(c.description || '');
      if (!isFinite(sum)) return Promise.reject(new Error('sum must be a number'));
      if (!currency) return Promise.reject(new Error('currency required'));
      // stamp date (today, in local time)
      var now = new Date();
      var year = now.getFullYear();
      var month = now.getMonth() + 1;
      var day = now.getDate();
      var rec = {
        sum: sum,
        currency: currency,
        category: category,
        description: description,
        Date: { year: year, month: month, day: day },
        dateISO: now.toISOString()
      };
      return new Promise(function(resolve, reject){
        var tx = db.transaction('costs', 'readwrite');
        var st = tx.objectStore('costs');
        var req = st.add(rec);
        tx.oncomplete = function(){ rec.id = req.result; resolve(rec); };
        tx.onerror = function(){ reject(tx.error || req.error); };
      });
    }

    // Get report for a given year/month/currency
    function getReport(year, month, currency) {
      var y = Number(year), m = Number(month);
      var targetCur = String(currency || 'USD').toUpperCase();
      if (!y || !m) return Promise.reject(new Error('year/month required'));

      return ensureRates().then(function(rates){
        return new Promise(function(resolve, reject){
          var tx = db.transaction('costs', 'readonly');
          var st = tx.objectStore('costs');
          var req = st.getAll();
          req.onsuccess = function(){
            var all = req.result || [];
            var costs = [];
            var total = 0;
            for (var i=0;i<all.length;i++){
              var it = all[i];
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
          req.onerror = function(){ reject(req.error); };
        });
      });
    }

    // Return public DB API
    return {
      addCost: addCost,
      getReport: getReport
    };
  }

  // Force refresh rates from URL (used in Settings)
  function refreshRatesFromUrl() {
    _currentRates = null;
    return ensureRates();
  }

  // Expose global API
  global.idb = {
    openCostsDB: openCostsDB,
    setRatesUrl: setRatesUrl,
    setInlineRates: setInlineRates,
    refreshRatesFromUrl: refreshRatesFromUrl,
    // for diagnostics
    _getCurrentRates: getCurrentRates
  };
})(this);
