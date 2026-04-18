    // ── TaleSpire API readiness ──────────────────────────
    // The manifest subscribes to symbiote.onStateChangeEvent.
    // This global handler resolves a Promise when the API is initialized.
    var _tsReadyResolve;
    var _tsReadyPromise = new Promise(function(resolve) { _tsReadyResolve = resolve; });

    function onTaleSpireStateChange(event) {
      if (event.kind === 'hasInitialized') _tsReadyResolve();
      // Force-flush storage before TaleSpire destroys the webview
      if (event.kind === 'willShutdown' || event.kind === 'willEnterBackground') {
        StorageAdapter.flush();
      }
    }

    // In TaleSpire, window.TS exists before page load but the API isn't ready
    // until hasInitialized fires. Only resolve early for the browser case.
    // Safety timeout: if hasInitialized was somehow missed, resolve after 3s.
    if (window.TS) setTimeout(function() { _tsReadyResolve(); }, 3000);
    else requestAnimationFrame(function() { _tsReadyResolve(); });

    // ── Advantage/Disadvantage roll state ──────────────
    var pendingAdvRolls = new Map(); // rollId -> {name, mode, bonusN, dmgExpr}

    function _collectDice(node, kind, acc) {
      if (!node) return;
      if (node.kind === kind) { node.results.forEach(function(r) { acc.push(r); }); return; }
      if (node.operands) node.operands.forEach(function(op) { _collectDice(op, kind, acc); });
    }

    function _sumNode(node) {
      if (!node) return 0;
      if (typeof node.value === 'number') return node.value;
      if (node.results) return node.results.reduce(function(a, b) { return a + b; }, 0);
      if (node.operands) {
        var vals = node.operands.map(_sumNode);
        if (node.operator === '+') return vals.reduce(function(a, b) { return a + b; }, 0);
        if (node.operator === '-') return vals[0] - vals.slice(1).reduce(function(a, b) { return a + b; }, 0);
      }
      return 0;
    }

    function onRollResults(event) {
      if (!event.resultsGroups) { pendingAdvRolls.delete(event.rollId); return; }
      var pending = pendingAdvRolls.get(event.rollId);
      if (!pending) return;
      pendingAdvRolls.delete(event.rollId);

      var d20s = [];
      event.resultsGroups.forEach(function(g) { _collectDice(g.result, 'd20', d20s); });
      if (!d20s.length) return;

      var kept  = pending.mode === 'advantage' ? Math.max.apply(null, d20s) : Math.min.apply(null, d20s);
      var total = kept + pending.bonusN;
      var bonus = pending.bonusN >= 0 ? '+' + pending.bonusN : '' + pending.bonusN;

      var dmgTotal = 0;
      event.resultsGroups.forEach(function(g) {
        var tmp = []; _collectDice(g.result, 'd20', tmp);
        if (!tmp.length) dmgTotal += _sumNode(g.result);
      });

      var modeLabel = pending.mode === 'advantage' ? 'ADV' : 'DIS';
      var msg = '\u2694 ' + pending.name + ' [' + modeLabel + ']'
              + '  Hit: ' + total
              + '  (' + d20s.join(' & ') + ' \u2192 kept ' + kept + ', ' + bonus + ')'
              + '  |  Dmg: ' + dmgTotal;

      if (window.TS && TS.chat && typeof TS.chat.send === 'function') {
        TS.chat.send(msg, 'board');
      }
    }

    // ── Dice tray helper ───────────────────────────────
    // Returns true if TaleSpire handled the roll; false → caller shows fallback UI.
    function sendToTray(rolls) {
      if (window.TS && window.TS.dice && typeof window.TS.dice.putDiceInTray === 'function') {
        try { window.TS.dice.putDiceInTray(rolls, false); return true; }
        catch (e) { console.warn('TS.dice.putDiceInTray failed, using fallback:', e); }
      }
      return false;
    }

    // ── Storage Adapter ────────────────────────────────
    // Abstracts browser localStorage vs TaleSpire campaign storage.
    // In TaleSpire, all keys are packed into a single JSON blob
    // stored via TS.localStorage.campaign.setBlob/getBlob.
    const StorageAdapter = (function() {
      const _cache = {};
      let _isTaleSpire = false;
      let _dirty = false;
      let _debounceTimer = null;
      const DEBOUNCE_MS = 1500;

      async function _flushToTaleSpire() {
        if (!_isTaleSpire || !_dirty) return;
        _dirty = false;
        try {
          await TS.localStorage.campaign.setBlob(JSON.stringify(_cache));
        } catch (e) {
          _dirty = true; // retry on next flush
          if (window.TS && TS.debug) TS.debug.log('[StorageAdapter] write failed: ' + e);
          console.warn('[StorageAdapter] TaleSpire write failed:', e);
        }
      }

      const _scheduleIdle = window.requestIdleCallback
        ? (fn) => requestIdleCallback(fn, { timeout: 2000 })
        : (fn) => setTimeout(fn, 0);

      function _scheduleFlush() {
        if (!_isTaleSpire) return;
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => _scheduleIdle(_flushToTaleSpire), DEBOUNCE_MS);
      }

      // Immediate flush — cancels any pending debounce. Called on shutdown.
      function flush() {
        if (!_isTaleSpire || !_dirty) return;
        clearTimeout(_debounceTimer);
        _flushToTaleSpire();
      }

      async function init() {
        _isTaleSpire = !!(window.TS &&
                          window.TS.localStorage &&
                          window.TS.localStorage.campaign);

        if (_isTaleSpire) {
          try {
            const raw = await TS.localStorage.campaign.getBlob();
            if (raw) Object.assign(_cache, JSON.parse(raw));
            if (TS.debug) TS.debug.log('[StorageAdapter] loaded ' + Object.keys(_cache).length + ' keys');
          } catch (e) {
            if (TS.debug) TS.debug.log('[StorageAdapter] read failed: ' + e);
            console.warn('[StorageAdapter] TaleSpire read failed:', e);
          }
          // Safety net: flush before the webview is destroyed
          window.addEventListener('beforeunload', flush);
          window.addEventListener('pagehide', flush);
        }
      }

      function getItem(key) {
        if (_isTaleSpire) {
          return _cache[key] !== undefined ? _cache[key] : null;
        }
        return localStorage.getItem(key);
      }

      function setItem(key, value) {
        if (_isTaleSpire) {
          _cache[key] = value;
          _dirty = true;
          _scheduleFlush();
        } else {
          localStorage.setItem(key, value);
        }
      }

      function removeItem(key) {
        if (_isTaleSpire) {
          delete _cache[key];
          _dirty = true;
          _scheduleFlush();
        } else {
          localStorage.removeItem(key);
        }
      }

      function isTaleSpire() { return _isTaleSpire; }

      return { init, getItem, setItem, removeItem, isTaleSpire, flush };
    })();

    // ── Portrait Store ───────────────────────────────────
    // Stores portrait data separately from the main StorageAdapter to
    // keep the campaign blob small and fast to serialize/flush.
    // In TaleSpire: uses global.setBlob with a campaign-keyed JSON map.
    // In browser: uses localStorage directly.
    const PortraitStore = (function() {
      const PORTRAIT_KEY = 'sd_char_portrait';
      let _isTaleSpire = false;
      let _campaignId = null;
      let _map = {}; // { campaignId: dataUrl }

      async function init() {
        _isTaleSpire = !!(window.TS &&
                          window.TS.localStorage &&
                          window.TS.localStorage.global);

        if (_isTaleSpire) {
          try {
            const info = await TS.campaigns.whereAmI();
            _campaignId = info && info.id ? info.id : '_default';
          } catch (e) {
            _campaignId = '_default';
            console.warn('[PortraitStore] could not get campaign ID:', e);
          }

          try {
            const raw = await TS.localStorage.global.getBlob();
            if (raw) _map = JSON.parse(raw);
          } catch (e) {
            console.warn('[PortraitStore] global read failed:', e);
          }
          if (TS.debug) TS.debug.log('[PortraitStore] loaded for campaign ' + _campaignId);
        }
      }

      function get() {
        if (_isTaleSpire) {
          return _map[_campaignId] || null;
        }
        return localStorage.getItem(PORTRAIT_KEY);
      }

      async function set(dataUrl) {
        if (_isTaleSpire) {
          _map[_campaignId] = dataUrl;
          try {
            await TS.localStorage.global.setBlob(JSON.stringify(_map));
          } catch (e) {
            console.warn('[PortraitStore] global write failed:', e);
          }
        } else {
          localStorage.setItem(PORTRAIT_KEY, dataUrl);
        }
      }

      async function remove() {
        if (_isTaleSpire) {
          delete _map[_campaignId];
          try {
            await TS.localStorage.global.setBlob(JSON.stringify(_map));
          } catch (e) {
            console.warn('[PortraitStore] global write failed:', e);
          }
        } else {
          localStorage.removeItem(PORTRAIT_KEY);
        }
      }

      // Migrate portrait from campaign blob (StorageAdapter) → global blob.
      // Called once during init to handle existing users.
      async function migrateFromCampaignBlob() {
        if (!_isTaleSpire) return;
        const existing = StorageAdapter.getItem(PORTRAIT_KEY);
        if (existing) {
          await set(existing);
          StorageAdapter.removeItem(PORTRAIT_KEY);
          if (TS.debug) TS.debug.log('[PortraitStore] migrated portrait from campaign blob');
        }
      }

      return { init, get, set, remove, migrateFromCampaignBlob };
    })();

    // ── Version utilities ───────────────────────────────
    const APP_VERSION = '0.7.1';

    function compareSemver(a, b) {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return 1;
        if ((pa[i] || 0) < (pb[i] || 0)) return -1;
      }
      return 0;
    }

    // Migration registry: each entry transforms export data from one version to the next.
    // To add a migration: { from: "0.5.3", to: "0.6.0", migrate: (data) => { ... return data; } }
    const MIGRATIONS = [];

    function runMigrations(data) {
      let version = data._version || '0.5.3';
      let migrated = data;
      let safety = 0;
      while (safety++ < 100) {
        const m = MIGRATIONS.find(entry => entry.from === version);
        if (!m) break;
        migrated = m.migrate(migrated);
        version = m.to;
      }
      migrated._version = version;
      return migrated;
    }

    // ── Utilities ────────────────────────────────────────
    function esc(s) {
      return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function fmtMod(n) { return n >= 0 ? `+${n}` : `${n}`; }

    function abilityMod(score) {
      return Math.floor((Number(score) - 10) / 2);
    }

    function uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function autoGrow(el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }

    // ── Event Bus ────────────────────────────────────────
    const Events = {
      _h: {},
      on(name, fn) { (this._h[name] ||= []).push(fn); },
      emit(name, ...args) { (this._h[name] || []).forEach(fn => fn(...args)); }
    };

    // ── Autocomplete Factory ─────────────────────────────
    // Reusable dropdown autocomplete. Each call creates an independent
    // instance attached to `containerEl` via event delegation.
    function createAutocomplete({ containerEl, inputSelector, getMatches, onSelect, renderItem, minWidth }) {
      let dd = null;
      let activeIdx = -1;
      let matches = [];
      let focusoutTimer = null;

      function show(inputEl) {
        hide();
        dd = document.createElement('div');
        dd.className = 'ac-dropdown';
        dd.setAttribute('role', 'listbox');
        document.body.appendChild(dd);
        position(inputEl);
        render(inputEl, inputEl.value.trim());
      }

      function position(inputEl) {
        if (!dd) return;
        const rect = inputEl.getBoundingClientRect();
        dd.style.position = 'fixed';
        dd.style.top = rect.bottom + 'px';
        dd.style.left = rect.left + 'px';
        dd.style.width = Math.max(rect.width, minWidth || 0) + 'px';
      }

      function render(inputEl, query) {
        matches = getMatches(query);
        dd.innerHTML = '';
        activeIdx = -1;
        if (!matches.length) { dd.style.display = 'none'; return; }
        matches.forEach((item, i) => {
          const opt = renderItem(item, i);
          opt.classList.add('ac-item');
          opt.setAttribute('role', 'option');
          opt.dataset.idx = i;
          opt.addEventListener('pointerdown', e => {
            e.preventDefault();
            doSelect(inputEl, item);
          });
          dd.appendChild(opt);
        });
        dd.style.display = 'block';
      }

      function doSelect(inputEl, item) {
        hide();
        onSelect(inputEl, item);
      }

      function hide() {
        if (dd) { dd.remove(); dd = null; }
        activeIdx = -1;
        matches = [];
      }

      function highlight() {
        if (!dd) return;
        dd.querySelectorAll('.ac-item').forEach((el, i) => {
          el.classList.toggle('active', i === activeIdx);
        });
      }

      containerEl.addEventListener('focusin', e => {
        if (e.target.matches(inputSelector)) {
          clearTimeout(focusoutTimer);
          show(e.target);
        }
      });

      containerEl.addEventListener('input', e => {
        if (e.target.matches(inputSelector) && dd) {
          position(e.target);
          render(e.target, e.target.value.trim());
        }
      });

      containerEl.addEventListener('keydown', e => {
        if (!dd || dd.style.display === 'none') return;
        if (!e.target.matches(inputSelector)) return;
        const items = dd.querySelectorAll('.ac-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIdx = (activeIdx + 1) % items.length;
          highlight();
          items[activeIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
          highlight();
          items[activeIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          if (activeIdx >= 0 && matches[activeIdx]) {
            e.preventDefault();
            doSelect(e.target, matches[activeIdx]);
          }
        } else if (e.key === 'Escape') {
          hide();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) {
            activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
          } else {
            activeIdx = (activeIdx + 1) % items.length;
          }
          highlight();
          items[activeIdx]?.scrollIntoView({ block: 'nearest' });
        }
      });

      containerEl.addEventListener('focusout', () => {
        focusoutTimer = setTimeout(() => { if (dd) hide(); }, 120);
      });

      document.addEventListener('click', e => {
        if (dd && !dd.contains(e.target) && !e.target.matches(inputSelector)) {
          hide();
        }
      });

      return { hide };
    }

    // ── Boot ───────────────────────────────────────────
    // Wrapped in async IIFE so TaleSpire's async getBlob() resolves
    // before any UI reads from storage. Browser mode resolves instantly.
    (async function boot() {
    // Wait for TaleSpire API to initialize (instant in browser mode)
    await _tsReadyPromise;
    await StorageAdapter.init();
    await PortraitStore.init();
    await PortraitStore.migrateFromCampaignBlob();

    // ══════════════════════════════════════════════════════
    //  GAME DATA — Shadowdark RPG reference tables
    // ══════════════════════════════════════════════════════

    const ABILITY_STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

    const CORE_CLASS_ICONS = {
      fighter: '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75l.063-.062c21.827 21.93 44.04 43.923 66.405 66.25c-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53l68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938l-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593c-43.852-43.8-86.462-85.842-130.125-125.47c-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562l56.81-56.812l13.22 13.187l-56.438 56.44l24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906l200.56 200.53a403 403 0 0 1-13.405 13.032L148.875 153.53zm-76.69 113.28l-28.5 28.532l68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717l28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313c17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655l-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844l-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594c-15.068-18.587-28.38-38.758-39.5-60.625z"/></svg>',
      priest:  '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="m256 21.938l-4.025 2.01c-96 48-93.455 47.175-189.455 63.175l-8.592 1.432l1.15 8.634c16.125 120.934 48.338 217.868 85.022 285.12c18.34 33.627 37.776 59.85 57.263 78.022C216.85 478.502 236.625 489 256 489s39.15-10.497 58.637-28.668s38.922-44.395 57.263-78.02c36.684-67.254 68.897-164.188 85.022-285.123l1.15-8.635l-8.592-1.432c-96-16-93.455-15.174-189.455-63.174zM224 64c16 0 16 0 32 16c16-16 16-16 32-16c-16 16-16 16-16 32l2.666 48h109.158S400 144 416 128c0 16 0 16-16 32c16 16 16 16 16 32c-16-16-32.176-16-32.176-16h-107.38L288 384s0 32 16 64c-16 0-48 0-48-16c0 16-32 16-48 16c16-32 16-64 16-64l11.555-208H128.13S112 176 96 192c0-16 0-16 16-32c-16-16-16-16-16-32c16 16 32.13 16 32.13 16h109.204L240 96c0-16 0-16-16-32"/></svg>',
      thief:   '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M254.07 19.707c-56.303 28.998-106.297 107.317-122.64 168.707c32.445 2.11 58.63 12.963 78.638 30.848l9.334-10.198c-13.336-13.056-30.596-23.9-52.994-34.707c12.68-31.542 32.01-79.29 56.598-82.07c9.62-1.088 19.92 4.722 31.13 21.068c35.08-58.334 68.394 18.705 87.727 61.002c-21.94 11.897-39.132 22.82-52.63 36.024l8.68 9.76c19.68-17.732 45.72-29.358 78.55-31.673C358.24 127.335 311.515 50.14 254.07 19.707M219.617 144.57c-8.894 0-16.103 3.952-16.103 8.826s7.21 8.827 16.103 8.827s16.106-3.95 16.106-8.827c0-4.874-7.212-8.826-16.106-8.826m68.965 0c-8.894 0-16.105 3.952-16.105 8.826s7.21 8.827 16.105 8.827s16.106-3.95 16.106-8.827c0-4.874-7.212-8.826-16.106-8.826m-118.894 70.88a233 233 0 0 0-6.444 11.52c-25.587 48.98-43.26 123.643-43.896 223.48c32.776 18.89 64.322 31.324 95.707 36.988c-35.5-24.36-60.375-80.893-60.375-146.754c0-45.97 12.12-87.39 31.51-116.506a96 96 0 0 0-16.502-8.727zm168.933.35a98.5 98.5 0 0 0-16.298 8.764c19.24 29.095 31.254 70.354 31.254 116.12c0 65.82-24.844 122.322-60.306 146.707c30.88-5.598 62.44-17.812 95.656-36.947c-.638-99.57-18.31-174.163-43.9-223.177a234 234 0 0 0-6.405-11.467zm-97.665 23.61c7.026 22.543 9.128 45.086.98 67.63h-41.552v18.513c10.057-3.24 20.25-5.39 30.502-6.594c.066 50.215 1.313 96.574 19.82 145.435l4.193 11.074l4.485-10.962c19.48-47.615 18.045-95.297 17.933-145.024c10.257 1.333 20.463 3.4 30.545 6.07v-18.515h-41.374c-6.888-22.544-5.932-45.087.803-67.63h-26.335z"/></svg>',
      wizard:  '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M319.61 20.654c13.145 33.114 13.144 33.115-5.46 63.5c33.114-13.145 33.116-13.146 63.5 5.457c-13.145-33.114-13.146-33.113 5.457-63.498c-33.114 13.146-33.113 13.145-63.498-5.459zM113.024 38.021c-11.808 21.04-11.808 21.04-35.724 24.217c21.04 11.809 21.04 11.808 24.217 35.725c11.808-21.04 11.808-21.04 35.724-24.217c-21.04-11.808-21.04-11.808-24.217-35.725m76.55 56.184c-.952 50.588-.95 50.588-41.991 80.18c50.587.95 50.588.95 80.18 41.99c.95-50.588.95-50.588 41.99-80.18c-50.588-.95-50.588-.95-80.18-41.99zm191.177 55.885c-.046 24.127-.048 24.125-19.377 38.564c24.127.047 24.127.046 38.566 19.375c.047-24.126.046-24.125 19.375-38.564c-24.126-.047-24.125-.046-38.564-19.375m-184.086 83.88a96 96 0 0 0-3.492.134c-18.591 1.064-41.868 8.416-77.445 22.556L76.012 433.582c78.487-20.734 132.97-21.909 170.99-4.615V247.71c-18.076-8.813-31.79-13.399-46.707-13.737a91 91 0 0 0-3.629-.002zm122.686 11.42a209 209 0 0 0-8.514.098c-12.81.417-27.638 2.215-45.84 4.522v177.135c43.565-7.825 106.85-4.2 171.244 7.566l-39.78-177.197c-35.904-8.37-56.589-11.91-77.11-12.123zm2.289 16.95c18.889.204 36.852 2.768 53.707 5.02l4.437 16.523c-23.78-3.75-65.966-4.906-92.467-.98l-.636-17.805c11.959-2.154 23.625-2.88 34.959-2.758m-250.483 4.658L60.54 313.002h24.094l10.326-46.004H71.158zm345.881 0l39.742 177.031l2.239 9.973l22.591-.152l-40.855-186.852zm-78.857 57.82c16.993.026 33.67.791 49.146 2.223l3.524 17.174c-32.645-3.08-72.58-2.889-102.995 0l-.709-17.174c16.733-1.533 34.04-2.248 51.034-2.223m-281.793 6.18l-6.924 30.004h24.394l6.735-30.004H56.389zm274.418 27.244c4.656.021 9.487.085 14.716.203l2.555 17.498c-19.97-.471-47.115.56-59.728 1.05l-.7-17.985c16.803-.493 29.189-.828 43.157-.766m41.476.447c8.268.042 16.697.334 24.121.069l2.58 17.74c-8.653-.312-24.87-.83-32.064-.502l-2.807-17.234a257 257 0 0 1 8.17-.073m-326.97 20.309l-17.985 77.928l25.035-.17l17.455-77.758H45.313zm303.164 11.848c19.608-.01 38.66.774 56.449 2.572l2.996 20.787c-34.305-4.244-85.755-7.697-119.1-3.244l-.14-17.922c20.02-1.379 40.186-2.183 59.795-2.193m-166.606 44.05c-30.112.09-67.916 6.25-115.408 19.76l-7.22 2.053l187.759-1.27v-6.347c-16.236-9.206-37.42-14.278-65.13-14.196zm134.41 6.174c-19.63.067-37.112 1.439-51.283 4.182v10.064l177.594-1.203c-44.322-8.634-89.137-13.17-126.31-13.043zM26 475v18h460v-18z"/></svg>',
    };

    const INVENTORY_ITEMS = [
      'Arrows (20)', 'Backpack', 'Caltrops (one bag)', 'Coin', 'Crossbow bolts (20)',
      'Crowbar', 'Flask or bottle', 'Flint and steel', 'Gem', 'Grappling hook',
      'Iron spikes (10)', 'Lantern', 'Mirror', 'Oil (flask)', 'Pole',
      'Rations (3)', 'Rope (60\')', 'Torch',
      'Bastard sword', 'Club', 'Crossbow', 'Dagger', 'Greataxe', 'Greatsword',
      'Javelin', 'Longbow', 'Longsword', 'Mace', 'Shortbow', 'Shortsword',
      'Spear', 'Staff', 'Warhammer'
    ];

    const SPELL_DB = [
      { name: 'Cure Wounds', tier: 1, classes: ['Priest'], duration: 'Instant', range: 'Close', desc: 'Touch restores ebbing life. Roll d6s equal to 1 + half level (rounded down). Target regains that many HP.' },
      { name: 'Holy Weapon', tier: 1, classes: ['Priest'], duration: '5 rounds', range: 'Close', desc: 'Weapon becomes magical, +1 to attack and damage rolls.' },
      { name: 'Light', tier: 1, classes: ['Priest', 'Wizard'], duration: '1 hour real time', range: 'Close', desc: 'Object glows with bright heatless light, illuminating near distance.' },
      { name: 'Protection From Evil', tier: 1, classes: ['Priest', 'Wizard'], duration: 'Focus', range: 'Close', desc: 'Chaotic beings have disadv on attacks/spellcasting vs target. Can\'t possess/compel/beguile. On possessed target, entity makes CHA check vs spellcasting check.' },
      { name: 'Shield of Faith', tier: 1, classes: ['Priest'], duration: '5 rounds', range: 'Self', desc: '+2 bonus to AC.' },
      { name: 'Turn Undead', tier: 1, classes: ['Priest'], duration: 'Instant', range: 'Near', desc: 'Undead must make CHA check vs spellcasting check. Fail by 10+ and <= your level = destroyed. Otherwise flees 5 rounds.' },
      { name: 'Augury', tier: 2, classes: ['Priest'], duration: 'Instant', range: 'Self', desc: 'Ask GM one question about course of action. GM says weal or woe.' },
      { name: 'Bless', tier: 2, classes: ['Priest'], duration: 'Instant', range: 'Close', desc: 'One creature gains a luck token.' },
      { name: 'Blind/Deafen', tier: 2, classes: ['Priest'], duration: 'Focus', range: 'Near', desc: 'Blind or deafen one creature. Disadvantage on tasks requiring lost sense.' },
      { name: 'Cleansing Weapon', tier: 2, classes: ['Priest'], duration: '5 rounds', range: 'Close', desc: 'Weapon wreathed in purifying flames. +1d4 damage (1d6 vs undead).' },
      { name: 'Smite', tier: 2, classes: ['Priest'], duration: 'Instant', range: 'Near', desc: 'Punishing flames on creature you can see. 1d6 damage.' },
      { name: 'Zone of Truth', tier: 2, classes: ['Priest'], duration: 'Focus', range: 'Near', desc: 'Creature can\'t utter a deliberate lie while in range.' },
      { name: 'Alarm', tier: 1, classes: ['Wizard'], duration: '1 day', range: 'Close', desc: 'Set magical alarm on object. Bell sounds in head if unauthorized creature touches it.' },
      { name: 'Burning Hands', tier: 1, classes: ['Wizard'], duration: 'Instant', range: 'Close', desc: 'Circle of flame in close area. 1d6 damage. Flammable objects ignite.' },
      { name: 'Charm Person', tier: 1, classes: ['Wizard'], duration: '1d8 days', range: 'Near', desc: 'Beguile one humanoid LV 2 or less. Regards you as friend.' },
      { name: 'Detect Magic', tier: 1, classes: ['Wizard'], duration: 'Focus', range: 'Near', desc: 'Sense magic within near range. Focus 2 rounds for properties.' },
      { name: 'Feather Fall', tier: 1, classes: ['Wizard'], duration: 'Instant', range: 'Self', desc: 'Cast when falling. Land safely.' },
      { name: 'Floating Disk', tier: 1, classes: ['Wizard'], duration: '10 rounds', range: 'Near', desc: 'Carries up to 20 gear slots. Hovers at waist level, stays within near.' },
      { name: 'Hold Portal', tier: 1, classes: ['Wizard'], duration: '10 rounds', range: 'Near', desc: 'Hold portal closed. STR check vs spellcasting to open. Knock ends it.' },
      { name: 'Mage Armor', tier: 1, classes: ['Wizard'], duration: '10 rounds', range: 'Self', desc: 'AC becomes 14 (18 on crit spellcasting check).' },
      { name: 'Magic Missile', tier: 1, classes: ['Wizard'], duration: 'Instant', range: 'Far', desc: 'Advantage on cast check. 1d4 damage to one target.' },
      { name: 'Sleep', tier: 1, classes: ['Wizard'], duration: 'Instant', range: 'Near', desc: 'Near-sized cube. Living creatures LV 2 or less fall asleep.' },
      { name: 'Acid Arrow', tier: 2, classes: ['Wizard'], duration: 'Focus', range: 'Far', desc: 'Corrosive bolt, 1d6 damage/round while focusing.' },
      { name: 'Alter Self', tier: 2, classes: ['Wizard'], duration: '5 rounds', range: 'Self', desc: 'Change physical form, gain one anatomical feature.' },
      { name: 'Detect Thoughts', tier: 2, classes: ['Priest', 'Wizard'], duration: 'Focus', range: 'Near', desc: 'Learn target\'s thoughts each round. Target WIS check vs spellcasting to notice.' },
      { name: 'Fixed Object', tier: 2, classes: ['Wizard'], duration: '5 rounds', range: 'Close', desc: 'Object <= 5 lbs fixed in place. Supports up to 5000 lbs.' },
      { name: 'Hold Person', tier: 2, classes: ['Wizard'], duration: 'Focus', range: 'Near', desc: 'Paralyze one humanoid LV 4 or less.' },
      { name: 'Invisibility', tier: 2, classes: ['Wizard'], duration: '10 rounds', range: 'Close', desc: 'Target invisible. Ends if target attacks or casts.' },
      { name: 'Knock', tier: 2, classes: ['Wizard'], duration: 'Instant', range: 'Near', desc: 'Door/window/gate/chest opens. Defeats mundane locks. Loud knock audible.' },
      { name: 'Levitate', tier: 2, classes: ['Wizard'], duration: 'Focus', range: 'Self', desc: 'Float near distance vertically per round. Push objects to move horizontally.' },
      { name: 'Mirror Image', tier: 2, classes: ['Wizard'], duration: '5 rounds', range: 'Self', desc: 'Illusory duplicates = half level (min 1). Attacks miss, destroy one duplicate.' },
      { name: 'Misty Step', tier: 2, classes: ['Wizard'], duration: 'Instant', range: 'Self', desc: 'Teleport near distance to area you can see.' },
      { name: 'Silence', tier: 2, classes: ['Wizard'], duration: 'Focus', range: 'Far', desc: 'Mute sound in near cube. Creatures deafened, sounds can\'t be heard.' },
      { name: 'Web', tier: 2, classes: ['Wizard'], duration: '5 rounds', range: 'Far', desc: 'Near-sized cube of sticky web. STR check vs spellcasting to free.' },
    ];

    const TALENT_LEVELS = [1, 3, 5, 7, 9];

    const CLASS_TALENTS = {
      fighter: [
        { roll: '2',     text: 'Gain Weapon Mastery with one additional weapon type' },
        { roll: '3–6',   text: '+1 to melee and ranged attacks' },
        { roll: '7–9',   text: '+2 to Strength, Dexterity, or Constitution stat' },
        { roll: '10–11', text: '+1 AC from a chosen armor type' },
        { roll: '12',    text: 'Choose a talent or +2 points to distribute to stats' },
      ],
      priest: [
        { roll: '2',     text: 'Gain advantage on casting one spell you know' },
        { roll: '3–6',   text: '+1 to melee or ranged attacks' },
        { roll: '7–9',   text: '+1 to priest spellcasting checks' },
        { roll: '10–11', text: '+2 to Strength or Wisdom stat' },
        { roll: '12',    text: 'Choose a talent or +2 points to distribute to stats' },
      ],
      thief: [
        { roll: '2',     text: 'Gain advantage on initiative rolls' },
        { roll: '3–5',   text: 'Backstab deals +1 dice of damage' },
        { roll: '6–9',   text: '+2 to Strength, Dexterity, or Charisma stat' },
        { roll: '10–11', text: '+1 to melee and ranged attacks' },
        { roll: '12',    text: 'Choose a talent or +2 points to distribute to stats' },
      ],
      wizard: [
        { roll: '2',     text: 'Make one random magic item' },
        { roll: '3–7',   text: '+2 to Intelligence stat or +1 to wizard spellcasting checks' },
        { roll: '8–9',   text: 'Gain advantage on casting one spell you know' },
        { roll: '10–11', text: 'Learn one additional wizard spell of any tier you know' },
        { roll: '12',    text: 'Choose a talent or +2 points to distribute to stats' },
      ],
    };

    const ANCESTRY_FEATURES = {
      dwarf:    { languages: 'Common, Dwarvish', traits: [{ name: 'Stout', desc: 'Start with +2 HP. Roll hit points per level with advantage.' }] },
      elf:      { languages: 'Common, Elvish, Sylvan', traits: [{ name: 'Farsight', desc: 'You get a +1 bonus to attack rolls with ranged weapons or a +1 bonus to spellcasting checks.' }] },
      goblin:   { languages: 'Common, Goblin', traits: [{ name: 'Keen Senses', desc: "You can't be surprised." }] },
      halfling: { languages: 'Common', traits: [{ name: 'Stealthy', desc: 'Once per day, you can become invisible for 3 rounds.' }] },
      'half-orc': { languages: 'Common, Orcish', traits: [{ name: 'Mighty', desc: 'You have a +1 bonus to attack and damage rolls with melee weapons.' }] },
      human:    { languages: 'Common + one additional common language', traits: [{ name: 'Ambitious', desc: 'You gain one additional talent roll at 1st level.' }] },
    };

    const CLASS_FEATURES = {
      fighter: [
        { name: 'Hauler', desc: 'Add your Constitution modifier, if positive, to your gear slots.' },
        { name: 'Weapon Mastery', desc: 'Choose one type of weapon. You gain +1 to attack and damage with that weapon type. Add half your level to these rolls (round down).' },
        { name: 'Grit', desc: 'Choose Strength or Dexterity. You have advantage on checks of that type to overcome an opposing force, such as kicking open a stuck door (STR) or slipping free of rusty chains (DEX).' },
      ],
      thief: [
        { name: 'Backstab', desc: 'If you hit a creature who is unaware of your attack, you deal an extra weapon die of damage. Add additional weapon dice equal to half your level (round down).' },
        { name: 'Thievery', desc: 'You carry thieving tools (no gear slots). Advantage on checks for:', list: ['Climbing', 'Sneaking & hiding', 'Applying disguises', 'Finding & disabling traps', 'Picking pockets & opening locks'] },
      ],
      wizard: [
        { name: 'Languages', desc: 'You know two additional common languages and two rare languages.' },
        { name: 'Learning Spells', desc: 'You can permanently learn a wizard spell from a spell scroll by studying it for a day and succeeding on a DC 15 Intelligence check. The scroll is expended whether you succeed or fail. Spells learned this way don\'t count toward your known spells.' },
        { name: 'Spellcasting', desc: 'You can cast wizard spells you know. You know three tier 1 spells at level 1. To cast, roll 1d20 + INT mod vs. DC 10 + spell tier. On failure, you can\'t cast that spell again until you rest. Natural 1: roll on the Wizard Mishap table.' },
      ],
      priest: [
        { name: 'Languages', desc: 'You know either Celestial, Diabolic, or Primordial.' },
        { name: 'Turn Undead', desc: 'You know the turn undead spell. It doesn\'t count toward your number of known spells.' },
        { name: 'Deity', desc: 'Choose a god to serve who matches your alignment. You have a holy symbol for your god (takes up no gear slots).' },
        { name: 'Spellcasting', desc: 'You can cast priest spells you know. You know two tier 1 spells at level 1. To cast, roll 1d20 + WIS mod vs. DC 10 + spell tier. On failure, you can\'t cast that spell again until you rest. Natural 1: your deity revokes the spell until penance and a rest.' },
      ],
    };

    const WEAPONS = [
      { name: 'Bastard sword', damage: '1d8',  stat: 'STR', info: 'M · C · V, 2 slots' },
      { name: 'Club',          damage: '1d4',  stat: 'STR', info: 'M · C' },
      { name: 'Crossbow',      damage: '1d6',  stat: 'DEX', info: 'R · F · 2H, L' },
      { name: 'Dagger',        damage: '1d4',  stat: 'STR', info: 'M/R · C/N · F, Th' },
      { name: 'Greataxe',      damage: '1d8',  stat: 'STR', info: 'M · C · V, 2 slots' },
      { name: 'Greatsword',    damage: '1d12', stat: 'STR', info: 'M · C · 2H, 2 slots' },
      { name: 'Javelin',       damage: '1d4',  stat: 'STR', info: 'M/R · C/F · Th' },
      { name: 'Longbow',       damage: '1d8',  stat: 'DEX', info: 'R · F · 2H' },
      { name: 'Longsword',     damage: '1d8',  stat: 'STR', info: 'M · C' },
      { name: 'Mace',          damage: '1d6',  stat: 'STR', info: 'M · C' },
      { name: 'Shortbow',      damage: '1d4',  stat: 'DEX', info: 'R · F · 2H' },
      { name: 'Shortsword',    damage: '1d6',  stat: 'STR', info: 'M · C' },
      { name: 'Spear',         damage: '1d6',  stat: 'STR', info: 'M/R · C/N · Th' },
      { name: 'Staff',         damage: '1d4',  stat: 'STR', info: 'M · C · 2H' },
      { name: 'Warhammer',     damage: '1d10', stat: 'STR', info: 'M · C · 2H' },
    ];

    // ══════════════════════════════════════════════════════
    //  UI INITIALIZATION
    // ══════════════════════════════════════════════════════

    // ── Tab switching ──────────────────────────────────
    const tabBtns   = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    function switchTab(panelName) {
      tabBtns.forEach(btn => {
        const active = btn.dataset.panel === panelName;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active);
      });
      tabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${panelName}`);
      });
    }

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.panel));
    });

    // ── localStorage ───────────────────────────────────
    const STORAGE_KEY = 'sd_char';

    function loadCharacter() {
      try {
        const raw = StorageAdapter.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    function saveCharacter(data) {
      try {
        StorageAdapter.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('Could not save character data:', e);
      }
    }

    window.SD = { loadCharacter, saveCharacter };
    window.SD.character = loadCharacter();

    // ── CORE tab ───────────────────────────────────────
    function updateCoreIcon(className) {
      const el = document.getElementById('core-tab-icon');
      if (el) el.innerHTML = CORE_CLASS_ICONS[(className || '').toLowerCase()] || CORE_CLASS_ICONS.fighter;
    }

    // Build ability grid cells
    const abilityGrid = document.getElementById('ability-grid');
    ABILITY_STATS.forEach(stat => {
      const cell = document.createElement('div');
      cell.className = 'ability-cell';
      cell.innerHTML = `
        <span class="ability-stat-name">${stat}</span>
        <input class="ability-score" id="ability-${stat.toLowerCase()}"
               type="number" min="1" max="20" value="10"
               inputmode="numeric" />
        <span class="ability-mod" id="mod-${stat.toLowerCase()}">+0</span>
      `;
      abilityGrid.appendChild(cell);

      const input = cell.querySelector('.ability-score');
      const modEl = cell.querySelector('.ability-mod');

      let _abilitySaveTimer = null;
      input.addEventListener('input', () => {
        const mod = abilityMod(input.value);
        modEl.textContent = fmtMod(mod);
        if (!window.SD.character.abilities) window.SD.character.abilities = {};
        window.SD.character.abilities[stat] = Number(input.value) || 10;
        Events.emit('ability:change', stat);
        clearTimeout(_abilitySaveTimer);
        _abilitySaveTimer = setTimeout(coreAutoSave, 300);
      });
      // Tap cell to focus score input
      cell.addEventListener('click', e => {
        if (e.target !== input && e.target !== modEl) input.focus();
      });
      // Mod badge rolls a stat check
      modEl.setAttribute('role', 'button');
      modEl.setAttribute('tabindex', '0');
      modEl.title = `Roll ${stat} check`;
      function rollStatCheck() {
        const bonusN = abilityMod(input.value);
        const bonusStr = bonusN === 0 ? '' : (bonusN > 0 ? `+${bonusN}` : `${bonusN}`);
        const label = `${stat} (${fmtMod(bonusN)})`;
        if (!sendToTray([{ name: label, roll: `1d20${bonusStr}` }])) {
          const d20 = Math.ceil(Math.random() * 20);
          showToast(`${label}: ${d20 + bonusN} (d20=${d20}${bonusStr})`);
        }
      }
      modEl.addEventListener('click', rollStatCheck);
      modEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rollStatCheck(); } });
    });

    // Alignment selector
    let alignment = '';
    document.getElementById('alignment-selector').addEventListener('click', e => {
      const btn = e.target.closest('.align-btn');
      if (!btn) return;
      document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
      if (alignment === btn.dataset.value) {
        alignment = '';
      } else {
        alignment = btn.dataset.value;
        btn.classList.add('active');
      }
      coreAutoSave();
    });

    document.getElementById('char-ancestry').addEventListener('change', () => {
      coreAutoSave();
    });

    // Auto-save all CORE fields to localStorage
    function coreAutoSave() {
      const char = window.SD.character;
      char.name      = document.getElementById('char-name').value;
      char.class     = document.getElementById('char-class').value;
      char.level     = Number(document.getElementById('char-level').value) || 1;
      char.ancestry  = document.getElementById('char-ancestry').value;
      char.alignment = alignment;
      char.xp        = Number(document.getElementById('char-xp').value) || 0;
      char.xpNext    = Number(document.getElementById('char-xp-next').value) || 0;
      char.hpCurrent = Number(document.getElementById('hp-current').value) || 0;
      char.hpMax     = Number(document.getElementById('hp-max').value) || 0;
      char.luckTokens = Number(document.getElementById('luck-tokens').value) || 0;
      char.abilities = {};
      ABILITY_STATS.forEach(stat => {
        char.abilities[stat] = Number(document.getElementById(`ability-${stat.toLowerCase()}`).value) || 10;
      });
      window.SD.saveCharacter(char);
    }

    // Wire up auto-save for plain inputs
    ['char-name','char-level','char-xp','char-xp-next',
     'hp-current','hp-max','luck-tokens'].forEach(id => {
      document.getElementById(id).addEventListener('input', coreAutoSave);
    });
    // char-class is a <select>, fires 'change'
    document.getElementById('char-class').addEventListener('change', () => {
      coreAutoSave();
      window.SD.renderSpells?.();
    });

    // Load saved values into CORE fields
    function coreLoad() {
      const c = window.SD.character;
      if (c.name)      document.getElementById('char-name').value = c.name;
      if (c.class)     document.getElementById('char-class').value = c.class;
      if (c.level)     document.getElementById('char-level').value = c.level;
      if (c.ancestry)  document.getElementById('char-ancestry').value = c.ancestry;
      if (c.xp  != null) document.getElementById('char-xp').value = c.xp;
      if (c.xpNext != null) document.getElementById('char-xp-next').value = c.xpNext;
      if (c.hpCurrent != null) document.getElementById('hp-current').value = c.hpCurrent;
      if (c.hpMax     != null) document.getElementById('hp-max').value = c.hpMax;
      if (c.luckTokens != null) document.getElementById('luck-tokens').value = c.luckTokens;

      if (c.alignment) {
        alignment = c.alignment;
        document.querySelectorAll('.align-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.value === alignment);
        });
      }

      if (c.abilities) {
        ABILITY_STATS.forEach(stat => {
          const score = c.abilities[stat];
          if (score != null) {
            const input = document.getElementById(`ability-${stat.toLowerCase()}`);
            const modEl = document.getElementById(`mod-${stat.toLowerCase()}`);
            input.value = score;
            modEl.textContent = fmtMod(abilityMod(score));
          }
        });
      }

    }

    coreLoad();
    updateCoreIcon(document.getElementById('char-class').value);

    // ── Portrait ─────────────────────────────────────────
    (function () {
      const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB
      const MAX_OUTPUT_SIZE = 200 * 1024; // 200KB
      const frame = document.getElementById('portrait-frame');
      const img = document.getElementById('portrait-img');
      const placeholder = document.getElementById('portrait-placeholder');
      const clearBtn = document.getElementById('portrait-clear');
      const fileInput = document.getElementById('portrait-file');

      function loadPortrait() {
        const data = PortraitStore.get();
        if (data) {
          img.src = data;
          img.style.display = 'block';
          placeholder.style.display = 'none';
        } else {
          img.style.display = 'none';
          placeholder.style.display = 'flex';
        }
      }

      function savePortrait(dataUrl) {
        try {
          PortraitStore.set(dataUrl);
        } catch (e) {
          console.warn('Could not save portrait:', e);
        }
      }

      function clearPortrait() {
        PortraitStore.remove();
        img.src = '';
        img.style.display = 'none';
        placeholder.style.display = 'flex';
      }

      function resizeImage(file) {
        return new Promise((resolve, reject) => {
          if (file.size > MAX_INPUT_SIZE) {
            reject(new Error('Image too large (max 10MB)'));
            return;
          }
          const reader = new FileReader();
          reader.onload = (e) => {
            const imgEl = new Image();
            imgEl.onload = () => {
              const maxDim = 256;
              let w = imgEl.width;
              let h = imgEl.height;
              if (w > maxDim || h > maxDim) {
                const scale = maxDim / Math.max(w, h);
                w = Math.round(w * scale);
                h = Math.round(h * scale);
              }
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(imgEl, 0, 0, w, h);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              if (dataUrl.length > MAX_OUTPUT_SIZE) {
                reject(new Error('Compressed portrait too large'));
                return;
              }
              resolve(dataUrl);
            };
            imgEl.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      async function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        try {
          const dataUrl = await resizeImage(file);
          savePortrait(dataUrl);
          img.src = dataUrl;
          img.style.display = 'block';
          placeholder.style.display = 'none';
        } catch (e) {
          console.warn('Portrait processing failed:', e.message);
        }
      }

      let filePickerOpen = false;

      async function openFilePicker() {
        if (filePickerOpen) return;
        filePickerOpen = true;

        // Prefer async File System Access API (non-blocking)
        if (window.showOpenFilePicker) {
          try {
            const [handle] = await window.showOpenFilePicker({
              multiple: false,
              types: [{ description: 'Images', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] } }]
            });
            const file = await handle.getFile();
            filePickerOpen = false;
            handleFile(file);
            return;
          } catch (e) {
            filePickerOpen = false;
            if (e.name !== 'AbortError') console.warn('File picker error:', e);
            return;
          }
        }

        // Fallback: defer click() off the call stack to reduce UI freeze
        setTimeout(() => fileInput.click(), 0);

        // Reset guard when window regains focus (covers browsers where
        // the input 'cancel' event doesn't fire, e.g. older Chromium)
        const onFocus = () => {
          window.removeEventListener('focus', onFocus);
          setTimeout(() => { filePickerOpen = false; }, 300);
        };
        window.addEventListener('focus', onFocus);
      }

      frame.addEventListener('click', (e) => {
        if (e.target.closest('.portrait-clear')) return;
        openFilePicker();
      });

      frame.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFilePicker();
        }
      });

      fileInput.addEventListener('change', (e) => {
        filePickerOpen = false;
        if (e.target.files && e.target.files[0]) {
          handleFile(e.target.files[0]);
        }
        fileInput.value = '';
      });

      fileInput.addEventListener('cancel', () => { filePickerOpen = false; });

      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearPortrait();
      });

      frame.addEventListener('dragover', (e) => {
        e.preventDefault();
        frame.classList.add('drag-over');
      });

      frame.addEventListener('dragleave', () => {
        frame.classList.remove('drag-over');
      });

      frame.addEventListener('drop', (e) => {
        e.preventDefault();
        frame.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
        }
      });

      // Clipboard paste support — paste an image directly onto the portrait
      document.addEventListener('paste', (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            handleFile(item.getAsFile());
            return;
          }
        }
      });

      loadPortrait();
    })();

    // ── Inventory autocomplete ──────────────────────────
    createAutocomplete({
      containerEl: document.getElementById('inv-list'),
      inputSelector: '.inv-item-name',
      getMatches(query) {
        return INVENTORY_ITEMS
          .filter(item => !query || item.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 12)
          .map(name => ({ label: name }));
      },
      onSelect(inputEl, item) {
        inputEl.value = item.label;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      },
      renderItem(item) {
        const opt = document.createElement('div');
        const match = item.label.match(/^(.*?)(\s*\([^)]*\))?$/);
        if (match && match[2]) {
          const main = document.createElement('span');
          main.textContent = match[1];
          const suffix = document.createElement('span');
          suffix.className = 'ac-suffix';
          suffix.textContent = match[2];
          opt.appendChild(main);
          opt.appendChild(suffix);
        } else {
          opt.textContent = item.label;
        }
        return opt;
      }
    });

    // ── Spell autocomplete ──────────────────────────────
    createAutocomplete({
      containerEl: document.getElementById('cbt-spell-list'),
      inputSelector: '.spell-name-inp',
      minWidth: 200,
      getMatches(query) {
        const charClass = (document.getElementById('char-class').value || '').toLowerCase().trim();
        const isPriest = charClass === 'priest';
        const isWizard = charClass === 'wizard';
        let pool = SPELL_DB.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()));
        if (isPriest || isWizard) {
          pool = pool.filter(s => s.classes.some(c => c.toLowerCase() === charClass));
        }
        pool.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
        return pool.slice(0, 20);
      },
      onSelect(inputEl, spell) {
        inputEl.value = spell.name;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        const spellItem = inputEl.closest('.spell-item');
        if (!spellItem) return;
        const tierInp = spellItem.querySelector('.sp-tier');
        const rangeInp = spellItem.querySelector('.sp-range');
        const durInp = spellItem.querySelector('.sp-dur');
        const descTa = spellItem.querySelector('.spell-desc-ta');
        const badge = spellItem.querySelector('.spell-tier-badge');
        if (tierInp) { tierInp.value = spell.tier; tierInp.dispatchEvent(new Event('input', { bubbles: true })); }
        if (badge) badge.textContent = `T${spell.tier}`;
        if (rangeInp) { rangeInp.value = spell.range; rangeInp.dispatchEvent(new Event('input', { bubbles: true })); }
        if (durInp) { durInp.value = spell.duration; durInp.dispatchEvent(new Event('input', { bubbles: true })); }
        if (descTa) { descTa.value = spell.desc; descTa.dispatchEvent(new Event('input', { bubbles: true })); }
      },
      renderItem(spell) {
        const opt = document.createElement('div');
        opt.classList.add('ac-item--detail');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'ac-name';
        nameSpan.textContent = spell.name;
        const infoSpan = document.createElement('span');
        infoSpan.className = 'ac-info';
        infoSpan.textContent = `T${spell.tier} · ${spell.classes.join('/')}`;
        opt.appendChild(nameSpan);
        opt.appendChild(infoSpan);
        return opt;
      }
    });

    // ── GEAR tab (Inventory) ─────────────────────────────
    (function () {
      const GEAR_DEFAULTS = {
        gp: 0, sp: 0,
        armorType: 'none', mithral: false, shield: false,
        bonusSlots: 0,
        torches: 0, burnTime: 1,
        inventory: []
      };

      function getGear() {
        return Object.assign({}, GEAR_DEFAULTS, window.SD.character.gear || {});
      }

      function saveGear(gear) {
        window.SD.character.gear = gear;
        window.SD.saveCharacter(window.SD.character);
      }

      function getStrMax() {
        const str = (window.SD.character.abilities || {}).STR;
        return Math.max(10, Number(str) || 10);
      }

      // ── Encumbrance bar ──────────────────────────────
      function getHaulerBonus() {
        const cls = (document.getElementById('char-class').value || '').toLowerCase();
        if (cls !== 'fighter') return 0;
        const con = (window.SD.character.abilities || {}).CON ?? 10;
        const mod = Math.floor((con - 10) / 2);
        return Math.max(0, mod);
      }

      function updateEncumbrance() {
        // Item slots from inventory rows
        const rows = document.querySelectorAll('#inv-list .inv-row');
        let itemSlots = 0;
        rows.forEach(row => {
          itemSlots += parseFloat(row.querySelector('.inv-item-slots').value) || 0;
        });

        // Armor slots
        const armorSlotMap = { none: 0, leather: 1, chainmail: 2, plate: 3 };
        const armorType = document.getElementById('gear-armor-type').value;
        const baseArmorSlots = armorSlotMap[armorType] || 0;
        const mithral = document.getElementById('gear-mithral').checked;
        const shield = document.getElementById('gear-shield').checked;
        const armorSlots = Math.max(0, baseArmorSlots + (mithral ? -1 : 0)) + (shield ? 1 : 0);

        // Coin slots: first 100 GP+SP are free, then 1 slot per 100
        const gp = parseFloat(document.getElementById('gear-gp').value) || 0;
        const sp = parseFloat(document.getElementById('gear-sp').value) || 0;
        const totalCoins = gp + sp;
        const coinSlots = Math.max(0, Math.ceil((totalCoins - 100) / 100));

        // Bonus slots: Hauler (auto for Fighters) + manual override
        const haulerBonus = getHaulerBonus();
        const manualBonus = parseFloat(document.getElementById('enc-bonus').value) || 0;
        const bonusSlots = haulerBonus + manualBonus;

        const used = armorSlots + coinSlots + itemSlots;
        const max = getStrMax() + bonusSlots;

        document.getElementById('enc-used').textContent = used;
        document.getElementById('enc-max').textContent = max;
        document.getElementById('enc-breakdown').textContent =
          `armor ${armorSlots} · coins ${coinSlots} · items ${itemSlots}`;

        const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
        const bar = document.getElementById('enc-bar');
        bar.style.width = pct + '%';
        bar.classList.toggle('over-limit', used > max);
      }
      Events.on('ability:change', stat => {
        if (stat === 'STR' || stat === 'CON') updateEncumbrance();
      });
      Events.on('class:change', () => updateEncumbrance());

      // ── Inventory rows ───────────────────────────────
      let rowIdCounter = 0;

      function createInvRow(data) {
        data = data || { name: '', slots: 1, qty: 1, notes: '' };
        const id = ++rowIdCounter;
        const row = document.createElement('div');
        row.className = 'inv-row';
        row.dataset.rowId = id;
        row.innerHTML = `
          <input type="text"   class="inv-item-name"  placeholder="Item"  value="${esc(data.name)}" />
          <input type="number" class="inv-item-slots"  min="0" step="1" value="${data.slots}" />
          <input type="number" class="inv-item-qty"    min="1"            value="${data.qty}" />
          <input type="text"   class="inv-item-notes" placeholder="Notes" value="${esc(data.notes)}" />
          <button class="inv-del-btn" aria-label="Remove item">✕</button>
        `;

        row.querySelector('.inv-del-btn').addEventListener('click', () => {
          row.remove();
          updateEncumbrance();
          collectAndSave();
        });

        row.querySelectorAll('input').forEach(inp => {
          inp.addEventListener('input', () => {
            if (inp.classList.contains('inv-item-slots')) updateEncumbrance();
            collectAndSave();
          });
        });

        return row;
      }

      function collectInventory() {
        return Array.from(document.querySelectorAll('#inv-list .inv-row')).map(row => ({
          name:  row.querySelector('.inv-item-name').value,
          slots: parseFloat(row.querySelector('.inv-item-slots').value) || 0,
          qty:   parseInt(row.querySelector('.inv-item-qty').value, 10) || 1,
          notes: row.querySelector('.inv-item-notes').value
        }));
      }

      function collectAndSave() {
        saveGear({
          gp:         parseFloat(document.getElementById('gear-gp').value) || 0,
          sp:         parseFloat(document.getElementById('gear-sp').value) || 0,
          armorType:  document.getElementById('gear-armor-type').value,
          mithral:    document.getElementById('gear-mithral').checked,
          shield:     document.getElementById('gear-shield').checked,
          bonusSlots: parseFloat(document.getElementById('enc-bonus').value) || 0,
          inventory:  collectInventory()
        });
        updateInvEmpty();
      }

      function updateInvEmpty() {
        const hasItems = document.querySelectorAll('#inv-list .inv-row').length > 0;
        document.getElementById('inv-empty').hidden = hasItems;
        document.querySelector('.inv-col-heads').style.display = hasItems ? '' : 'none';
      }

      // ── Render from saved data ───────────────────────
      function renderGear() {
        const gear = getGear();

        document.getElementById('gear-gp').value          = gear.gp;
        document.getElementById('gear-sp').value          = gear.sp;
        document.getElementById('gear-armor-type').value  = gear.armorType || 'none';
        Events.emit('armor:change');
        document.getElementById('gear-mithral').checked   = !!gear.mithral;
        document.getElementById('gear-shield').checked    = !!gear.shield;
        document.getElementById('enc-bonus').value        = gear.bonusSlots || 0;

        const list = document.getElementById('inv-list');
        list.innerHTML = '';
        (gear.inventory || []).forEach(item => {
          list.appendChild(createInvRow(item));
        });

        updateEncumbrance();
        updateInvEmpty();
      }

      // ── Wire top-level inputs ────────────────────────
      ['gear-gp', 'gear-sp', 'enc-bonus'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
          collectAndSave();
          updateEncumbrance();
        });
      });

      document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = document.getElementById(btn.dataset.target);
          const delta = parseInt(btn.dataset.delta, 10);
          input.value = Math.max(0, (parseFloat(input.value) || 0) + delta);
          input.dispatchEvent(new Event('input'));
        });
      });
      ['gear-armor-type'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
          collectAndSave();
          updateEncumbrance();
          Events.emit('armor:change');
        });
      });
      ['gear-mithral', 'gear-shield'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
          collectAndSave();
          updateEncumbrance();
          if (id === 'gear-shield') Events.emit('armor:change');
        });
      });

      // ── Custom armor dropdown ─────────────────────────────
      (function initArmorDropdown() {
        const trigger = document.getElementById('armor-select-trigger');
        const panel = document.getElementById('armor-dropdown-panel');
        const hiddenInput = document.getElementById('gear-armor-type');
        const options = panel.querySelectorAll('.armor-custom-option');

        let isOpen = false;
        let activeIdx = -1;

        const ARMOR_DATA = {
          none: { name: 'No armor', suffix: 'AC 10+DEX · 0 slots' },
          leather: { name: 'Leather', suffix: 'AC 11+DEX · 1 slot' },
          chainmail: { name: 'Chainmail', suffix: 'AC 13+DEX · 2 slots' },
          plate: { name: 'Plate', suffix: 'AC 15 · 3 slots' }
        };

        function updateTrigger(value) {
          const data = ARMOR_DATA[value] || ARMOR_DATA.none;
          trigger.querySelector('.armor-select-name').textContent = data.name;
          trigger.querySelector('.armor-select-suffix').textContent = data.suffix;
        }

        function positionPanel() {
          const rect = trigger.getBoundingClientRect();
          panel.style.top = rect.bottom + 'px';
          panel.style.left = rect.left + 'px';
          panel.style.width = rect.width + 'px';
        }

        function openDropdown() {
          if (isOpen) return;
          isOpen = true;
          positionPanel();
          panel.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
          activeIdx = -1;
        }

        function closeDropdown() {
          if (!isOpen) return;
          isOpen = false;
          panel.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
          activeIdx = -1;
          options.forEach(opt => opt.classList.remove('active'));
        }

        function selectValue(value) {
          hiddenInput.value = value;
          updateTrigger(value);
          hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
          closeDropdown();
        }

        function highlightOption(idx) {
          options.forEach((opt, i) => {
            opt.classList.toggle('active', i === idx);
          });
          activeIdx = idx;
        }

        trigger.addEventListener('click', () => {
          if (isOpen) closeDropdown();
          else openDropdown();
        });

        trigger.addEventListener('keydown', (e) => {
          if (!isOpen && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openDropdown();
          } else if (isOpen) {
            if (e.key === 'Escape') {
              e.preventDefault();
              closeDropdown();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              const next = activeIdx < options.length - 1 ? activeIdx + 1 : 0;
              highlightOption(next);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              const prev = activeIdx > 0 ? activeIdx - 1 : options.length - 1;
              highlightOption(prev);
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (activeIdx >= 0) {
                selectValue(options[activeIdx].dataset.value);
              }
            }
          }
        });

        options.forEach((opt, i) => {
          opt.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectValue(opt.dataset.value);
          });
          opt.addEventListener('mouseenter', () => {
            highlightOption(i);
          });
        });

        document.addEventListener('click', (e) => {
          if (isOpen && !trigger.contains(e.target) && !panel.contains(e.target)) {
            closeDropdown();
          }
        });

        window.addEventListener('resize', () => {
          if (isOpen) positionPanel();
        });

        Events.on('armor:change', () => {
          updateTrigger(hiddenInput.value);
        });
      })();

      document.getElementById('inv-add-btn').addEventListener('click', () => {
        const gear = getGear();
        gear.inventory = (gear.inventory || []).concat([{ name: '', slots: 1, qty: 1, notes: '' }]);
        saveGear(gear);
        const list = document.getElementById('inv-list');
        list.innerHTML = '';
        gear.inventory.forEach(item => list.appendChild(createInvRow(item)));
        updateEncumbrance();
        updateInvEmpty();
        const rows = list.querySelectorAll('.inv-row');
        if (rows.length) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      renderGear();
    })();


    // ── CLASS tab ──────────────────────────────────────
    (function () {
      // ── helpers ────────────────────────────────────────
      function clsKey(k) { return 'cls_' + k; }

      function load(key, fallback) {
        const v = window.SD.character[clsKey(key)];
        return v !== undefined ? v : fallback;
      }

      function save(key, value) {
        window.SD.character[clsKey(key)] = value;
        window.SD.saveCharacter(window.SD.character);
      }

      // ── talents ────────────────────────────────────────
      function renderTalents(level) {
        const list = document.getElementById('talents-list');
        const saved = load('talents', ['', '', '', '', '', '']);
        const ancestry = window.SD.character.ancestry || '';
        const isHuman = ancestry === 'Human';
        const hasBonus = isHuman && level >= 1;

        list.innerHTML = '';
        
        if (hasBonus) {
          const row = document.createElement('div');
          row.className = 'talent-row';
          
          const badge = document.createElement('span');
          badge.className = 'level-badge earned';
          badge.textContent = 'LVL 1';
          
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'talent-input';
          input.placeholder = 'Talent description…';
          input.value = saved[5] || '';
          input.setAttribute('aria-label', 'Level 1 Human bonus talent');
          input.addEventListener('input', () => {
            const talents = load('talents', ['', '', '', '', '', '']);
            talents[5] = input.value;
            save('talents', talents);
          });
          
          const clearBtn = document.createElement('button');
          clearBtn.className = 'talent-clear';
          clearBtn.textContent = '✕';
          clearBtn.setAttribute('aria-label', 'Clear talent');
          clearBtn.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input'));
          });
          
          row.appendChild(badge);
          row.appendChild(input);
          row.appendChild(clearBtn);
          list.appendChild(row);
        }
        
        let shownNextLocked = false;
        TALENT_LEVELS.forEach((talentLvl, i) => {
          const earned = level >= talentLvl;

          // Show earned + the first locked one only; skip the rest
          if (!earned) {
            if (shownNextLocked) return;
            shownNextLocked = true;
          }

          const row = document.createElement('div');
          row.className = 'talent-row';

          const badge = document.createElement('span');
          badge.className = 'level-badge' + (earned ? ' earned' : '');
          badge.textContent = 'LVL ' + talentLvl;

          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'talent-input';
          input.placeholder = earned ? 'Talent description…' : 'Unlocked at level ' + talentLvl;
          input.value = saved[i] || '';
          input.disabled = !earned;
          input.setAttribute('aria-label', 'Level ' + talentLvl + ' talent');
          input.addEventListener('input', () => {
            const talents = load('talents', ['', '', '', '', '', '']);
            talents[i] = input.value;
            save('talents', talents);
          });

          const clearBtn = document.createElement('button');
          clearBtn.className = 'talent-clear';
          clearBtn.textContent = '✕';
          clearBtn.setAttribute('aria-label', 'Clear talent');
          clearBtn.disabled = !earned;
          clearBtn.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input'));
          });

          row.appendChild(badge);
          row.appendChild(input);
          row.appendChild(clearBtn);
          list.appendChild(row);
        });
      }

      // ── talent autocomplete ─────────────────────────────
      createAutocomplete({
        containerEl: document.getElementById('talents-list'),
        inputSelector: '.talent-input',
        getMatches(query) {
          const cls = (document.getElementById('char-class').value || '').toLowerCase();
          const talents = CLASS_TALENTS[cls] || [];
          return talents.filter(t => !query || t.text.toLowerCase().includes(query.toLowerCase()));
        },
        onSelect(inputEl, item) {
          inputEl.value = item.text;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        },
        renderItem(item) {
          const opt = document.createElement('div');
          const rollSpan = document.createElement('span');
          rollSpan.className = 'ac-roll';
          rollSpan.textContent = item.roll;
          const textSpan = document.createElement('span');
          textSpan.textContent = item.text;
          opt.appendChild(rollSpan);
          opt.appendChild(textSpan);
          return opt;
        }
      });

      // ── class features ─────────────────────────────────
      function renderFeatures(className) {
        const body = document.getElementById('features-body');
        const key = (className || '').toLowerCase().trim();
        const features = CLASS_FEATURES[key];

        body.innerHTML = '';

        if (features) {
          features.forEach(f => {
            const item = document.createElement('div');
            item.className = 'feature-item';

            const name = document.createElement('div');
            name.className = 'feature-name';
            name.textContent = f.name;

            const desc = document.createElement('div');
            desc.className = 'feature-desc';
            desc.textContent = f.desc;

            item.appendChild(name);
            item.appendChild(desc);

            if (f.list) {
              const ul = document.createElement('ul');
              ul.className = 'feature-list';
              f.list.forEach(li => {
                const el = document.createElement('li');
                el.textContent = li;
                ul.appendChild(el);
              });
              item.appendChild(ul);
            }

            body.appendChild(item);
          });
        } else {
          const item = document.createElement('div');
          item.className = 'feature-item';

          const name = document.createElement('div');
          name.className = 'feature-name';
          name.textContent = 'Class Notes';

          const textarea = document.createElement('textarea');
          textarea.className = 'feature-notes-input auto-grow';
          textarea.placeholder = 'Enter class features and special abilities…';
          textarea.value = load('class_notes', '');
          textarea.setAttribute('aria-label', 'Class feature notes');
          textarea.addEventListener('input', () => {
            save('class_notes', textarea.value);
            autoGrow(textarea);
          });
          requestAnimationFrame(() => autoGrow(textarea));

          item.appendChild(name);
          item.appendChild(textarea);
          body.appendChild(item);
        }
      }

      function renderAncestryFeatures(ancestry) {
        const body = document.getElementById('racial-features-body');
        const key = (ancestry || '').toLowerCase().trim();
        const data = ANCESTRY_FEATURES[key];

        body.innerHTML = '';

        if (data) {
          if (data.languages) {
            const langItem = document.createElement('div');
            langItem.className = 'feature-item';
            const langName = document.createElement('div');
            langName.className = 'feature-name';
            langName.textContent = 'Languages';
            const langDesc = document.createElement('div');
            langDesc.className = 'feature-desc';
            langDesc.textContent = data.languages;
            langItem.appendChild(langName);
            langItem.appendChild(langDesc);
            body.appendChild(langItem);
          }
          if (data.traits) {
            data.traits.forEach(t => {
              const item = document.createElement('div');
              item.className = 'feature-item';
              const name = document.createElement('div');
              name.className = 'feature-name';
              name.textContent = t.name;
              const desc = document.createElement('div');
              desc.className = 'feature-desc';
              desc.textContent = t.desc;
              item.appendChild(name);
              item.appendChild(desc);
              body.appendChild(item);
            });
          }
        } else {
          const item = document.createElement('div');
          item.className = 'feature-item';
          const name = document.createElement('div');
          name.className = 'feature-name';
          name.textContent = 'Ancestry Notes';
          const textarea = document.createElement('textarea');
          textarea.className = 'feature-notes-input auto-grow';
          textarea.placeholder = 'Enter ancestry features and traits…';
          textarea.value = load('ancestry_notes', '');
          textarea.setAttribute('aria-label', 'Ancestry feature notes');
          textarea.addEventListener('input', () => {
            save('ancestry_notes', textarea.value);
            autoGrow(textarea);
          });
          requestAnimationFrame(() => autoGrow(textarea));
          item.appendChild(name);
          item.appendChild(textarea);
          body.appendChild(item);
        }
      }

      // ── initialise ─────────────────────────────────────
      function initClassTab() {
        const bgEl    = document.getElementById('cls-background');
        const deityEl = document.getElementById('cls-deity');
        const notesEl = document.getElementById('cls-notes');
        const langEl  = document.getElementById('char-languages');
        const toggle  = document.getElementById('features-toggle');
        const fbody   = document.getElementById('features-body');
        const racialToggle = document.getElementById('racial-toggle');
        const racialBody   = document.getElementById('racial-features-body');

        // Restore saved values
        bgEl.value    = load('background', '');
        deityEl.value = load('deity', '');
        notesEl.value = load('notes', '');
        if (window.SD.character.languages) langEl.value = window.SD.character.languages;

        // Read class/level from Core DOM (single source of truth)
        const currentClass = document.getElementById('char-class').value || '';
        const currentLevel = parseInt(document.getElementById('char-level').value, 10) || 1;
        const currentAncestry = document.getElementById('char-ancestry').value || '';

        renderTalents(currentLevel);
        renderFeatures(currentClass);
        renderAncestryFeatures(currentAncestry);

        requestAnimationFrame(() => {
          autoGrow(bgEl);
          autoGrow(notesEl);
        });

        // Re-render when Core class/level change
        document.getElementById('char-class').addEventListener('change', (e) => {
          renderFeatures(e.target.value);
          updateCoreIcon(e.target.value);
          Events.emit('class:change', e.target.value);
        });
        document.getElementById('char-level').addEventListener('input', (e) => {
          renderTalents(parseInt(e.target.value, 10) || 1);
        });
        
        // Re-render talents and racial features when ancestry changes
        document.getElementById('char-ancestry').addEventListener('change', (e) => {
          const currentLevel = parseInt(document.getElementById('char-level').value, 10) || 1;
          renderTalents(currentLevel);
          renderAncestryFeatures(e.target.value);
        });

        // Events
        langEl.addEventListener('input', () => {
          window.SD.character.languages = langEl.value;
          window.SD.saveCharacter(window.SD.character);
        });

        bgEl.addEventListener('input', () => {
          save('background', bgEl.value);
          autoGrow(bgEl);
        });

        deityEl.addEventListener('input', () => save('deity', deityEl.value));

        notesEl.addEventListener('input', () => {
          save('notes', notesEl.value);
          autoGrow(notesEl);
        });

        // Collapsible features
        toggle.addEventListener('click', () => {
          const expanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!expanded));
          fbody.classList.toggle('collapsed', expanded);
        });

        // Collapsible racial features
        if (racialToggle && racialBody) {
          racialToggle.addEventListener('click', () => {
            const expanded = racialToggle.getAttribute('aria-expanded') === 'true';
            racialToggle.setAttribute('aria-expanded', String(!expanded));
            racialBody.classList.toggle('collapsed', expanded);
          });
        }
      }

      // Run once DOM is ready (it is, since script is deferred-inline at body end)
      initClassTab();
    })();



    // ── Combat (AC, attacks, spells) ─────────────────────
    (function () {

      function getCombat() {
        const c = window.SD.character;
        if (!c.combat) c.combat = {};
        const cb = c.combat;
        if (cb.ac == null)                      cb.ac = 10;
        if (!Array.isArray(cb.attacks))         cb.attacks = [];
        if (!Array.isArray(cb.spells))          cb.spells = [];
        return cb;
      }

      function persist() { window.SD.saveCharacter(window.SD.character); }

      function getStatMod(stat) {
        const val = (window.SD.character.abilities || {})[stat.toUpperCase()] ?? 10;
        return abilityMod(val);
      }

      // ── AC / Initiative ──────────────────────────────────
      function initStats() {
        const cb = getCombat();

        const acEl = document.getElementById('cbt-ac');
        acEl.value = cb.ac;
        acEl.addEventListener('input', () => { getCombat().ac = parseInt(acEl.value) || 0; persist(); });

        refreshInit();
        refreshAC();
      }

      function refreshInit() {
        const initEl = document.getElementById('cbt-init');
        const mod = getStatMod('DEX');
        initEl.textContent = fmtMod(mod);
        // Wire roll on first call only
        if (!initEl._rollWired) {
          initEl._rollWired = true;
          initEl.setAttribute('role', 'button');
          initEl.setAttribute('tabindex', '0');
          initEl.title = 'Roll Initiative';
          function rollInitiative() {
            const bonusN = getStatMod('DEX');
            const bonusStr = bonusN === 0 ? '' : (bonusN > 0 ? `+${bonusN}` : `${bonusN}`);
            const label = `Initiative (${fmtMod(bonusN)})`;
            if (!sendToTray([{ name: label, roll: `1d20${bonusStr}` }])) {
              const d20 = Math.ceil(Math.random() * 20);
              showToast(`${label}: ${d20 + bonusN} (d20=${d20}${bonusStr})`);
            }
          }
          initEl.addEventListener('click', rollInitiative);
          initEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rollInitiative(); } });
        }
      }

      function refreshAC(skipPersist) {
        const armorType = document.getElementById('gear-armor-type').value;
        const shield = document.getElementById('gear-shield').checked;
        const dexMod = getStatMod('DEX');
        const armorAC = { none: 10, leather: 11, chainmail: 13, plate: 15 };
        const usesDex = armorType !== 'plate';
        const ac = (armorAC[armorType] || 10) + (usesDex ? dexMod : 0) + (shield ? 2 : 0);
        document.getElementById('cbt-ac').value = ac;
        getCombat().ac = ac;
        if (!skipPersist) persist();
      }

      function refreshAttackBonuses() {
        document.querySelectorAll('.atk-row').forEach(row => {
          const statSel = row.querySelector('.atk-stat');
          const bonusSpn = row.querySelector('.atk-bonus');
          if (statSel && bonusSpn) bonusSpn.textContent = fmtMod(getStatMod(statSel.value));
        });
      }

      Events.on('ability:change', stat => {
        if (stat === 'DEX') { refreshInit(); refreshAC(true); }
        if (stat === 'STR' || stat === 'DEX') refreshAttackBonuses();
      });
      Events.on('armor:change', () => refreshAC());

      // ── Weapon Autocomplete ───────────────────────────────
      createAutocomplete({
        containerEl: document.getElementById('cbt-attack-list'),
        inputSelector: '.atk-f[data-f="name"]',
        minWidth: 220,
        getMatches(query) {
          return WEAPONS.filter(w => !query || w.name.toLowerCase().includes(query.toLowerCase()));
        },
        onSelect(inputEl, weapon) {
          const row = inputEl.closest('.atk-row');
          if (!row) return;
          const idx = row._atkIdx;
          const attacks = getCombat().attacks;
          const atk = attacks[idx];
          if (!atk) return;
          atk.name = weapon.name;
          atk.stat = weapon.stat;
          atk.damage = weapon.damage;
          row.querySelector('[data-f="name"]').value = weapon.name;
          row.querySelector('.atk-stat').value = weapon.stat;
          row.querySelector('.atk-bonus').textContent = fmtMod(getStatMod(weapon.stat));
          row.querySelector('[data-f="damage"]').value = weapon.damage;
          persist();
        },
        renderItem(w) {
          const opt = document.createElement('div');
          opt.classList.add('ac-item--detail');
          opt.innerHTML =
            `<span class="ac-name">${esc(w.name)}</span>` +
            `<span class="ac-info">${esc(w.damage)} · ${esc(w.info)}</span>`;
          return opt;
        }
      });

      // Dismiss all autocomplete dropdowns on scroll
      document.getElementById('content').addEventListener('scroll', () => {
        document.querySelectorAll('.ac-dropdown').forEach(dd => dd.remove());
      }, { passive: true });

      // ── Attacks ──────────────────────────────────────────
      function renderAttacks() {
        const list = document.getElementById('cbt-attack-list');
        const attacks = getCombat().attacks;
        list.innerHTML = '';

        if (!attacks.length) {
          list.innerHTML = '<p class="cbt-empty">No attacks. Tap ＋ to add one.</p>';
          return;
        }

        attacks.forEach((atk, idx) => {
          const row = document.createElement('div');
          row.className = 'atk-row';
          row._atkIdx = idx;
          const stat = atk.stat || 'STR';
          const bonusVal = fmtMod(getStatMod(stat));
          row.innerHTML =
            `<input class="atk-f" placeholder="Weapon"  value="${esc(atk.name)}"   data-f="name"   />` +
            `<select class="atk-stat" title="Attack stat">` +
              `<option value="STR"${stat === 'STR' ? ' selected' : ''}>STR</option>` +
              `<option value="DEX"${stat === 'DEX' ? ' selected' : ''}>DEX</option>` +
            `</select>` +
            `<span class="atk-bonus">${bonusVal}</span>` +
            `<input class="atk-f" placeholder="1d6" value="${esc(atk.damage)}" data-f="damage" />` +
            `<div class="atk-row-btns">` +
              `<div class="btn-roll-cluster">` +
                `<button class="btn-adv" title="Roll with advantage">▲</button>` +
                `<button class="btn-roll" title="Roll attack &amp; damage"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M248 20.3L72.33 132.6L248 128.8zm16 0v108.5l175.7 3.8zm51.4 58.9c6.1 3.5 8.2 7.2 15.1 4.2c10.7.8 22.3 5.8 27.6 15.7c4.7 4.5 1.5 12.6-5.2 12.6c-9.7.1-19.7-6.1-14.6-8.3c4.7-2 14.7.9 10-5.5c-3.6-4.5-11-7.8-16.3-5.9c-1.6 6.8-9.4 4-12-.7c-2.3-5.8-9.1-8.2-15-7.9c-6.1 2.7 1.6 8.8 5.3 9.9c7.9 2.2.2 7.5-4.1 5.1c-4.2-2.4-15-9.6-13.5-18.3c5.8-7.39 15.8-4.62 22.7-.9m-108.5-3.5c5.5.5 12.3 3 10.2 9.9c-4.3 7-9.8 13.1-18.1 14.8c-6.5 3.4-14.9 4.4-21.6 1.9c-3.7-2.3-13.5-9.3-14.9-3.4c-2.1 14.8.7 13.1-11.1 17.8V92.3c9.9-3.9 21.1-4.5 30.3 1.3c8 4.2 19.4 1.5 24.2-5.7c1.4-6.5-8.1-4.6-12.2-3.4c-2.7-8.2 7.9-7.5 13.2-8.8m35 69.2L55.39 149l71.21 192.9zm28.2 0l115.3 197L456.6 149zm-14.1 7.5L138.9 352.6h234.2zm133.3 21.1c13.9 8.3 21.5 26.2 22.1 43c-1.3 13.6-.7 19.8-15.2 21.4s-23.9-19.2-29.7-32.6c-3.4-9.9-5.8-24 1.7-31.3c6.1-4.8 15-4.1 21.1-.5m-223.7 16.1c2.1 4-.5 11.4-4.8 12.1c-4.9.7-3.8-9.3-9.4-11.6c-6.9-2.3-13.6 5.6-15 11.6c10.4-4 20.3 7.1 20.3 17c-.4 11.7-7.9 24.8-19.7 28.1h-5.6c-12.7-.7-18.3-15.8-14.2-26.6c4.4-15.8 10.8-33.9 27.2-40.6c8.5-3.9 19 3.2 21.2 10m213.9-8.4c-7.1-.1-4.4 10-3.3 14.5c3.5 11.5 7.3 26.6 18.9 30c6.8-1.2 4.4-12.8 3.7-16.5c-4.7-10.9-7.1-23.3-19.3-28M52 186v173.2l61.9-5.7zm408 0l-61.9 167.5l61.9 5.7zm-117.9.7l28.5 63.5l-10 4.4l-20-43.3c-6.1 3-13 8.9-14.6-1.4c-1.3-3.9 8.5-5.1 8.1-11.9c-.3-6.9 2.2-12.2 8-11.3m-212 27.4c-2.4 5.1-4.1 10.3-2.7 15.9c1.7 8.8 13.5 6.4 15.6-.8c2.7-5 3.9-11.7-.5-15.7c-4.1-3.4-8.9-2.8-12.4.6m328.4 41.6c-.1 18.6 1.1 39.2-9.7 55.3c-.9 1.2-2.2 1.9-3.7 2.5c-5.8-4.1-3-11.3 1.2-15.5c1 7.3 5.5-2.9 6.6-5.6c1.3-3.2 3.6-17.7-1-10.2c.7 4-6.8 13.1-9.3 8.1c-5-14.4 0-30.5 7-43.5c5.7-6.2 9.9 4.4 8.9 8.9M434 266.8V328l-4.4 6.7v-42.3c-4.6 7.5-9.1 9.1-6.1-.9c6.1-7.1 4.8-17.4 10.5-24.7M83.85 279c.8 3.6 5.12 17.8 2.04 14.8c-1.97-1.3-3.62-4.9-3.41-6.1c-1.55-3-2.96-6.1-4.21-9.2c-2.95 4-3.96 8.3-3.14 13.4c.2-1.6 1.18-2.3 3.39-.7c7.84 12.6 12.17 29.1 7.29 43.5l-2.22 1.1c-10.36-5.8-11.4-19.4-13.43-30c-1.55-12.3-.79-24.7 2.3-36.7c5.2-3.8 9.16 5.4 11.39 9.9m-7.05 20.2c-4.06 4.7-2.26 12.8-.38 18.4c1.11 5.5 6.92 10.2 6.06 1.6c.69-11.1-2.33-12.7-5.68-20m66.4 69.4L256 491.7l112.8-123.1zm-21.4.3l-53.84 4.9l64.24 41.1c-2.6-2.7-4.9-5.7-7.1-8.8c-5.2-6.9-10.5-13.6-18.9-16.6c-8.75-6.5-4.2-5.3 2.9-2.6c-1-1.8-.7-2.6.1-2.6c2.2-.2 8.4 4.2 9.8 6.3l24.7 31.6l65.1 41.7zm268.4 0l-42.4 46.3c6.4-3.1 11.3-8.5 17-12.4c2.4-1.4 3.7-1.9 4.3-1.9c2.1 0-5.4 7.1-7.7 10.3c-9.4 9.8-16 23-28.6 29.1l18.9-24.5c-2.3 1.3-6 3.2-8.2 4.1l-40.3 44l74.5-47.6c5.4-6.7 1.9-5.6-5.7-.9l-11.4 6c11.4-13.7 30.8-28.3 40-35.6s15.9-9.8 8.2-1.5l-12.6 16c10-7.6.9 3.9-4.5 5.5c-.7 1-1.4 2-2.2 2.9l54.5-34.9zM236 385.8v43.4h-13.4v-30c-5-1.4-10.4 1.7-15.3-.3c-3.8-2.9 1-6.8 4.5-5.9c3.3-.1 7.6.2 9.3-3.2c4.4-4.5 9.6-4.4 14.9-4m29 .5c12.1 1.2 24.2.6 36.6.6c1.5 3 .8 7.8-3.3 7.9c-7.7.3-21-1.6-25.9.6c-8.2 10.5 5.7 3.8 11.4 5.2c7 1.1 15 2.9 19.1 9.2c2.1 3.1 2.7 7.3.7 10.7c-5.8 6.8-17 11.5-25.3 10.9c-7.3-.6-15.6-1.1-20.6-7.1c-6.4-10.6 10.5-6.7 12.2-3.2c6 5.3 20.3 1.9 20.7-4.7c.6-4.2-2.1-6.3-6.9-7.8s-12.6 1-17.3 1.8s-9.6.5-9-4.4c.8-4.2 2.7-8.1 2.7-12.5c.1-3 1.7-7 4.9-7.2m133.5 5c-.2-.2-7 5.8-9.9 8.1l-15.8 13.1c10.6-6.5 19.3-12 25.7-21.2m-247 14.2c2.4 0 7.5 4.6 9.4 7l26.1 31.1c-7.7-2.1-13.3-7.1-17.6-13.7c-6.5-7.3-11.3-16.6-21.2-19.6c-9-5-5.2-6.4 2.1-2.2c-.3-1.9.2-2.6 1.2-2.6"/></svg></button>` +
                `<button class="btn-disadv" title="Roll with disadvantage">▼</button>` +
              `</div>` +
              `<button class="btn-trash" title="Remove attack">✕</button>` +
            `</div>` +
            `<div class="atk-result"></div>`;

          row.querySelectorAll('input[data-f]').forEach(inp => {
            inp.addEventListener('input', () => { atk[inp.dataset.f] = inp.value; persist(); });
          });

          const statSel  = row.querySelector('.atk-stat');
          const bonusSpn = row.querySelector('.atk-bonus');
          statSel.addEventListener('change', () => {
            atk.stat = statSel.value;
            bonusSpn.textContent = fmtMod(getStatMod(statSel.value));
            persist();
          });

          const cluster = row.querySelector('.btn-roll-cluster');

          function collapseCluster() { cluster.classList.remove('expanded'); }

          cluster.querySelector('.btn-roll').addEventListener('click', () => {
            rollAttack(atk, row, 'normal');
            collapseCluster();
          });
          cluster.querySelector('.btn-adv').addEventListener('click', () => {
            rollAttack(atk, row, 'advantage');
            collapseCluster();
          });
          cluster.querySelector('.btn-disadv').addEventListener('click', () => {
            rollAttack(atk, row, 'disadvantage');
            collapseCluster();
          });

          // Touch: tap cluster to expand; tap outside to collapse
          cluster.addEventListener('pointerdown', function(e) {
            if (e.pointerType === 'touch' && !cluster.classList.contains('expanded')) {
              cluster.classList.add('expanded');
              e.preventDefault();
            }
          });
          document.addEventListener('pointerdown', function onDocPD(e) {
            if (!cluster.isConnected) { document.removeEventListener('pointerdown', onDocPD); return; }
            if (!cluster.contains(e.target)) collapseCluster();
          });

          row.querySelector('.btn-trash').addEventListener('click', () => {
            getCombat().attacks.splice(idx, 1);
            persist();
            renderAttacks();
          });

          list.appendChild(row);
        });
      }

      function rollDice(expr) {
        const m = String(expr).match(/^(\d*)d(\d+)([+-]\d+)?$/i);
        if (!m) return expr;
        const count = parseInt(m[1] || '1');
        const sides = parseInt(m[2]);
        const mod   = parseInt(m[3] || '0');
        let total = mod;
        for (let i = 0; i < count; i++) total += Math.ceil(Math.random() * sides);
        return String(total);
      }

      async function rollAttack(atk, row, mode) {
        if (mode === undefined) mode = 'normal';
        const bonusN = getStatMod(atk.stat || 'STR');
        const bonusStr = bonusN === 0 ? '' : (bonusN > 0 ? `+${bonusN}` : `${bonusN}`);
        const dmg  = atk.damage || '1d4';
        const name = atk.name || 'Attack';

        // TaleSpire path — put dice in the 3D tray
        if (window.TS && window.TS.dice && typeof window.TS.dice.putDiceInTray === 'function') {
          try {
            if (mode === 'normal') {
              window.TS.dice.putDiceInTray([
                { name: `${name} — hit`, roll: `1d20${bonusStr}` },
                { name: `${name} — dmg`, roll: dmg }
              ], false);
            } else {
              const modeLabel = mode === 'advantage' ? 'ADV' : 'DIS';
              const result = await window.TS.dice.putDiceInTray([
                { name: `${name} — hit (${modeLabel})`, roll: '2d20' },
                { name: `${name} — dmg`, roll: dmg }
              ], false);
              if (result && result.rollId) {
                pendingAdvRolls.set(result.rollId, { name, mode, bonusN, dmgExpr: dmg });
              }
            }
            return;
          } catch (e) {
            // Fall through to browser roller (e.g. notInBoard)
            console.warn('TS.dice.putDiceInTray failed, using fallback:', e);
          }
        }

        // Browser fallback
        const resultEl = row.querySelector('.atk-result');

        if (mode === 'normal') {
          const d20      = Math.ceil(Math.random() * 20);
          const total    = d20 + bonusN;
          const dmgTotal = rollDice(dmg);
          resultEl.textContent = `${name}: hit ${total} (d20=${d20}${bonusStr}) — dmg ${dmgTotal}`;
        } else {
          const r1 = Math.ceil(Math.random() * 20);
          const r2 = Math.ceil(Math.random() * 20);
          const kept = mode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
          const total = kept + bonusN;
          const dmgTotal = rollDice(dmg);
          const modeLabel = mode === 'advantage' ? 'ADV' : 'DIS';
          resultEl.textContent = `${modeLabel} ${r1}&${r2}\u2192${kept}${bonusStr} \u2014 dmg ${dmgTotal}`;
        }

        resultEl.classList.add('visible');
        clearTimeout(resultEl._timer);
        resultEl._timer = setTimeout(() => {
          resultEl.classList.remove('visible');
          resultEl.textContent = '';
        }, 8000);
      }

      // ── Spells ───────────────────────────────────────────
      function renderSpells() {
        const list   = document.getElementById('cbt-spell-list');
        const spells = getCombat().spells;
        list.innerHTML = '';

        if (!spells.length) {
          list.innerHTML = '<p class="cbt-empty">No spells. Tap ＋ to add one.</p>';
          return;
        }

        spells.forEach((sp, idx) => {
          const item = document.createElement('div');
          item.className = 'spell-item';

          const tier = sp.tier || 1;
          const dc   = 10 + tier;
          const cls  = (window.SD.character.class || '').toLowerCase();
          const castStat = cls === 'wizard' ? 'INT' : cls === 'priest' ? 'WIS' : null;
          const castBtnHtml = castStat
            ? `<div class="btn-roll-cluster spell-cast-cluster">` +
                `<button class="btn-cast btn-roll" title="Cast ${esc(sp.name) || 'spell'} (DC ${dc}, ${castStat})">` +
                  `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>` +
                `</button>` +
              `</div>`
            : '';

          item.innerHTML =
            `<div class="spell-hdr">` +
              `<span class="spell-toggle">▶</span>` +
              `<input class="spell-name-inp" placeholder="Spell name" value="${esc(sp.name)}" />` +
              `<span class="spell-tier-badge">T${tier}</span>` +
              `<span class="spell-dc">DC ${dc}</span>` +
              castBtnHtml +
              `<button class="btn-trash" title="Remove spell">✕</button>` +
            `</div>` +
            `<div class="spell-body">` +
              `<div class="spell-meta-row">` +
                `<label>Tier<input type="number" class="sp-tier" min="1" max="9" value="${tier}" inputmode="numeric" /></label>` +
                `<label>Range<input class="sp-range" placeholder="Near" value="${esc(sp.range)}" /></label>` +
                `<label>Duration<input class="sp-dur" placeholder="Instant" value="${esc(sp.duration)}" /></label>` +
              `</div>` +
              `<textarea class="spell-desc-ta" placeholder="Description">${esc(sp.desc)}</textarea>` +
            `</div>`;

          const hdr    = item.querySelector('.spell-hdr');
          const body   = item.querySelector('.spell-body');
          const toggle = item.querySelector('.spell-toggle');
          const badge  = item.querySelector('.spell-tier-badge');
          const dcChip = item.querySelector('.spell-dc');

          hdr.addEventListener('click', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('.btn-roll-cluster')) return;
            const open = body.style.display === 'block';
            body.style.display = open ? 'none' : 'block';
            toggle.textContent  = open ? '▶' : '▼';
          });

          item.querySelector('.spell-name-inp').addEventListener('input', e => { sp.name = e.target.value; persist(); });
          item.querySelector('.sp-tier').addEventListener('input', e => {
            sp.tier = parseInt(e.target.value) || 1;
            badge.textContent = `T${sp.tier}`;
            dcChip.textContent = `DC ${10 + sp.tier}`;
            const castBtn = item.querySelector('.btn-cast');
            if (castBtn) castBtn.title = `Cast ${sp.name || 'spell'} (DC ${10 + sp.tier}, ${castStat})`;
            persist();
          });
          item.querySelector('.sp-range').addEventListener('input',    e => { sp.range    = e.target.value; persist(); });
          item.querySelector('.sp-dur').addEventListener('input',      e => { sp.duration = e.target.value; persist(); });
          item.querySelector('.spell-desc-ta').addEventListener('input', e => { sp.desc   = e.target.value; persist(); });
          item.querySelector('.btn-trash').addEventListener('click', () => {
            getCombat().spells.splice(idx, 1);
            persist();
            renderSpells();
          });

          // Cast roll button
          if (castStat) {
            item.querySelector('.btn-cast').addEventListener('click', () => {
              const bonusN   = getStatMod(castStat);
              const bonusStr = bonusN === 0 ? '' : (bonusN > 0 ? `+${bonusN}` : `${bonusN}`);
              const spellName = sp.name || 'Spell';
              const spellDC   = 10 + (sp.tier || 1);
              const label = `Cast ${spellName} (DC ${spellDC})`;
              if (!sendToTray([{ name: label, roll: `1d20${bonusStr}` }])) {
                const d20   = Math.ceil(Math.random() * 20);
                const total = d20 + bonusN;
                const result = total >= spellDC ? 'success' : 'fail';
                showToast(`${label}: ${total} (d20=${d20}${bonusStr}) — ${result}`);
              }
            });
          }

          list.appendChild(item);
        });
      }

      // ── Boot ─────────────────────────────────────────────
      function bootCombat() {
        initStats();
        renderAttacks();
        renderSpells();

        document.getElementById('cbt-add-attack').addEventListener('click', () => {
          const stat = 'STR';
          getCombat().attacks.push({ id: uid(), name: '', stat, damage: '' });
          persist();
          renderAttacks();
        });

        document.getElementById('cbt-add-spell').addEventListener('click', () => {
          getCombat().spells.push({ id: uid(), name: '', tier: 1, range: '', duration: '', desc: '' });
          persist();
          renderSpells();
        });
      }

      bootCombat();
      window.SD.renderSpells = renderSpells;
    })();
  
    // ── Theme selector ─────────────────────────────────
    (function() {
      const THEME_KEY = 'sd_theme';
      const popover  = document.getElementById('theme-popover');
      const swatches = document.querySelectorAll('.theme-swatch');

      function applyTheme(theme) {
        const root = document.documentElement;
        root.classList.add('theme-switching');
        root.setAttribute('data-theme', theme);
        swatches.forEach(s => {
          s.setAttribute('aria-pressed', s.dataset.theme === theme ? 'true' : 'false');
        });
        StorageAdapter.setItem(THEME_KEY, theme);
        setTimeout(() => root.classList.remove('theme-switching'), 300);
      }

      window._toggleThemePopover = function(open) {
        popover.classList.toggle('open', open);
      };

      swatches.forEach(swatch => {
        swatch.addEventListener('click', function() {
          applyTheme(this.dataset.theme);
          window._toggleThemePopover(false);
        });
      });

      // Close theme popover on outside click
      document.addEventListener('click', function(e) {
        if (!popover.contains(e.target) && popover.classList.contains('open')) {
          window._toggleThemePopover(false);
        }
      });

      // Restore saved theme
      const saved = StorageAdapter.getItem(THEME_KEY) || 'dungeon';
      applyTheme(saved);
    })();

    // ── Toast notification ─────────────────────────────
    let _toastTimer = null;
    function showToast(message, isError) {
      const el     = document.getElementById('toast');
      const labelEl  = el.querySelector('.toast-label');
      const detailEl = el.querySelector('.toast-detail');
      const barEl    = el.querySelector('.toast-bar');

      // Parse "Label: detail" or fall back to single line
      const colonIdx = message.indexOf(':');
      if (colonIdx !== -1) {
        labelEl.textContent  = message.slice(0, colonIdx).trim();
        detailEl.textContent = message.slice(colonIdx + 1).trim();
        detailEl.hidden = false;
      } else {
        labelEl.textContent  = message;
        detailEl.textContent = '';
        detailEl.hidden = true;
      }

      el.classList.toggle('toast--error', !!isError);
      el.hidden = false;
      // Reset bar animation
      barEl.style.animation = 'none';
      void el.offsetWidth;
      el.classList.add('show');
      barEl.style.animation = '';

      if (_toastTimer) clearTimeout(_toastTimer);
      _toastTimer = setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => { el.hidden = true; }, 350);
      }, 4500);
    }

    // Click-to-dismiss toast
    document.getElementById('toast').addEventListener('click', () => {
      const el = document.getElementById('toast');
      if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; }, 350);
    });

    // ── Clipboard helper ──────────────────────────────
    async function copyToClipboard(text) {
      if (window.TS && TS.system && TS.system.clipboard && TS.system.clipboard.setText) {
        return TS.system.clipboard.setText(text);
      }
      return navigator.clipboard.writeText(text);
    }

    // ── Export character ───────────────────────────────
    async function exportCharacter() {
      try {
        const charRaw = StorageAdapter.getItem('sd_char');
        const character = charRaw ? JSON.parse(charRaw) : {};
        const portrait = PortraitStore.get();
        const theme = StorageAdapter.getItem('sd_theme') || null;

        const payload = {
          _version: APP_VERSION,
          _exportedAt: new Date().toISOString(),
          character: character,
          portrait: portrait,
          theme: theme
        };

        await copyToClipboard(JSON.stringify(payload, null, 2));
        showToast('Character copied to clipboard');
      } catch (e) {
        console.error('[Export] failed:', e);
        showToast('Failed to copy \u2014 please try again', true);
      }
    }

    // ── Import character ──────────────────────────────
    function importCharacter() {
      const modal     = document.getElementById('import-modal');
      const textarea  = document.getElementById('import-textarea');
      const errorEl   = document.getElementById('import-error');
      const submitBtn = document.getElementById('import-submit');
      const cancelBtn = document.getElementById('import-cancel');
      const confirmModal  = document.getElementById('import-confirm');
      const confirmMsg    = document.getElementById('confirm-message');
      const confirmCancel = document.getElementById('confirm-cancel');
      const confirmReplace = document.getElementById('confirm-replace');

      // Reset state
      textarea.value = '';
      errorEl.hidden = true;
      errorEl.textContent = '';
      submitBtn.disabled = true;

      // Show modal
      modal.hidden = false;
      textarea.focus();

      function showError(msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }

      function closeModal() {
        modal.hidden = true;
        textarea.value = '';
        errorEl.hidden = true;
      }

      function closeConfirm() {
        confirmModal.hidden = true;
      }

      // Enable submit when textarea is non-empty
      function onInput() {
        submitBtn.disabled = !textarea.value.trim();
        errorEl.hidden = true;
      }

      function onCancel() { closeModal(); cleanup(); }

      function onSubmit() {
        const raw = textarea.value.trim();

        // 1. JSON parse
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          showError('Invalid backup data \u2014 make sure you pasted the complete export.');
          return;
        }

        // 2. Structure check
        if (!data || typeof data.character !== 'object' || data.character === null) {
          showError("This doesn't look like a Dark Spire backup.");
          return;
        }

        // 3. Version check
        const exportVersion = data._version || '0.5.3';
        if (compareSemver(exportVersion, APP_VERSION) > 0) {
          showError('This backup was made with a newer version (v' + exportVersion + '). Please update The Dark Spire first.');
          return;
        }

        // 4. Run migrations
        data = runMigrations(data);

        // 5. Confirmation
        closeModal();
        cleanup();
        const charName = data.character.name || '';
        const currentName = (window.SD.character && window.SD.character.name) || '';
        if (currentName && charName) {
          confirmMsg.innerHTML = 'Your current character <strong>' + currentName.replace(/</g, '&lt;') + '</strong> will be replaced with <strong>' + charName.replace(/</g, '&lt;') + '</strong>. This cannot be undone.';
        } else if (currentName) {
          confirmMsg.innerHTML = 'Your current character <strong>' + currentName.replace(/</g, '&lt;') + '</strong> will be permanently replaced. This cannot be undone.';
        } else {
          confirmMsg.innerHTML = 'Your current character data will be permanently replaced. This cannot be undone.';
        }
        confirmModal.hidden = false;

        function onConfirmReplace() {
          // Write data
          window.SD.saveCharacter(data.character);
          if (data.portrait) {
            PortraitStore.set(data.portrait);
          } else {
            PortraitStore.remove();
          }
          if (data.theme) {
            StorageAdapter.setItem('sd_theme', data.theme);
          }
          StorageAdapter.flush();

          closeConfirm();
          cleanupConfirm();
          showToast('Character imported successfully');
          setTimeout(() => location.reload(), 500);
        }

        function onConfirmCancel() {
          closeConfirm();
          cleanupConfirm();
        }

        function cleanupConfirm() {
          confirmReplace.removeEventListener('click', onConfirmReplace);
          confirmCancel.removeEventListener('click', onConfirmCancel);
        }

        confirmReplace.addEventListener('click', onConfirmReplace);
        confirmCancel.addEventListener('click', onConfirmCancel);
      }

      function cleanup() {
        textarea.removeEventListener('input', onInput);
        cancelBtn.removeEventListener('click', onCancel);
        submitBtn.removeEventListener('click', onSubmit);
      }

      textarea.addEventListener('input', onInput);
      cancelBtn.addEventListener('click', onCancel);
      submitBtn.addEventListener('click', onSubmit);
    }


    // ── Custom stepper buttons for AC and Luck ──────────────────────────────
    document.querySelectorAll('.cbt-stat-stepper').forEach(stepper => {
      const input = stepper.querySelector('input[type="number"]');
      stepper.querySelectorAll('.cbt-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const step  = btn.classList.contains('cbt-step-up') ? 1 : -1;
          const min   = input.min !== '' ? Number(input.min) : -Infinity;
          const max   = input.max !== '' ? Number(input.max) :  Infinity;
          const next  = Math.min(max, Math.max(min, (Number(input.value) || 0) + step));
          input.value = next;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    });

    // ── Character Creation Guide ──────────────────────────────────────────
    (function() {
      const overlay = document.getElementById('creation-guide');
      const closeBtn = document.getElementById('guide-close');

      window._openGuide = function() { overlay.hidden = false; };
      function closeGuide() { overlay.hidden = true; }

      closeBtn.addEventListener('click', closeGuide);
      document.getElementById('guide-x').addEventListener('click', closeGuide);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeGuide();
      });

      // Auto-show when sheet is empty (no name and no class)
      const c = window.SD.character;
      if (!c.name && !c.class) window._openGuide();
    })();

    // ── Settings menu ─────────────────────────────────
    (function() {
      const btn      = document.getElementById('menu-btn');
      const dropdown = document.getElementById('menu-dropdown');

      function toggleMenu(open) {
        dropdown.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        toggleMenu(!isOpen);
      });

      document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && e.target !== btn) {
          toggleMenu(false);
        }
      });

      // Guide — open guide, close dropdown
      document.getElementById('menu-guide').addEventListener('click', function() {
        toggleMenu(false);
        window._openGuide();
      });

      // Help
      var helpModal = document.getElementById('help-modal');
      document.getElementById('menu-help').addEventListener('click', function() {
        toggleMenu(false);
        helpModal.hidden = false;
      });
      document.getElementById('help-close').addEventListener('click', function() {
        helpModal.hidden = true;
      });
      helpModal.addEventListener('click', function(e) {
        if (e.target === helpModal) helpModal.hidden = true;
      });

      // Export
      document.getElementById('menu-export').addEventListener('click', function() {
        toggleMenu(false);
        exportCharacter();
      });

      // Import
      document.getElementById('menu-import').addEventListener('click', function() {
        toggleMenu(false);
        importCharacter();
      });

      // Theme — open popover, close dropdown
      document.getElementById('menu-theme').addEventListener('click', function(e) {
        e.stopPropagation();
        toggleMenu(false);
        window._toggleThemePopover(true);
      });

      // About
      var aboutModal = document.getElementById('about-modal');
      document.getElementById('menu-about').addEventListener('click', function() {
        toggleMenu(false);
        aboutModal.hidden = false;
      });
      document.getElementById('about-close').addEventListener('click', function() {
        aboutModal.hidden = true;
      });
      aboutModal.addEventListener('click', function(e) {
        if (e.target === aboutModal) aboutModal.hidden = true;
      });
    })();

    })(); // end boot()
  