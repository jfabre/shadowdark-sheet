    // ── TaleSpire API readiness ──────────────────────────
    // The manifest subscribes to symbiote.onStateChangeEvent.
    // This global handler resolves a Promise when the API is initialized.
    let _tsReadyResolve;
    const _tsReadyPromise = new Promise(function(resolve) { _tsReadyResolve = resolve; });

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
    // type: 'attack' | 'check' | 'spell'
    // attack: { name, mode, bonusN, dmgExpr }
    // check:  { name, mode, bonusN, type }
    // spell:  { name, mode, bonusN, type, spellDC }
    const pendingAdvRolls = new Map();

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
      var modeLabel = pending.mode === 'advantage' ? 'ADV' : 'DIS';
      var rollDetail = d20s.join(' & ') + ' \u2192 kept ' + kept + ', ' + bonus;
      var msg;

      if (pending.type === 'check') {
        msg = pending.name + ' [' + modeLabel + ']'
            + '  \u2192 ' + total
            + '  (' + rollDetail + ')';
      } else if (pending.type === 'spell') {
        var outcome = total >= pending.spellDC ? 'success' : 'fail';
        msg = '\u2728 ' + pending.name + ' [' + modeLabel + ']'
            + '  \u2192 ' + total + ' vs DC ' + pending.spellDC + ' \u2014 ' + outcome
            + '  (' + rollDetail + ')';
      } else {
        // attack
        var dmgTotal = 0;
        event.resultsGroups.forEach(function(g) {
          var tmp = []; _collectDice(g.result, 'd20', tmp);
          if (!tmp.length) dmgTotal += _sumNode(g.result);
        });
        msg = '\u2694 ' + pending.name + ' [' + modeLabel + ']'
            + '  Hit: ' + total
            + '  (' + rollDetail + ')'
            + '  |  Dmg: ' + dmgTotal;
      }

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

    // ── Modal helper ────────────────────────────────────
    // Creates open/close methods and auto-dismisses on overlay click.
    function Modal(id, closeId) {
      const el = document.getElementById(id);
      const modal = {
        el,
        open()  { el.hidden = false; },
        close() { el.hidden = true; },
      };
      if (closeId) {
        document.getElementById(closeId).addEventListener('click', function() { modal.close(); });
      }
      el.addEventListener('click', function(e) { if (e.target === el) modal.close(); });
      return modal;
    }

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

    // Game data (ABILITY_STATS, WEAPONS, SPELL_DB, etc.) loaded from data.js

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

    // ── Generic check/spell roller (stat checks, initiative, spellcasting) ──
    // opts: { type: 'check' | 'spell', spellDC?: number }
    async function rollCheck(label, bonusN, mode, opts) {
      const bonusStr = bonusN === 0 ? '' : (bonusN > 0 ? `+${bonusN}` : `${bonusN}`);
      const type = opts.type || 'check';

      if (window.TS && window.TS.dice && typeof window.TS.dice.putDiceInTray === 'function') {
        try {
          if (mode === 'normal') {
            window.TS.dice.putDiceInTray([{ name: label, roll: `1d20${bonusStr}` }], false);
          } else {
            const modeLabel = mode === 'advantage' ? 'ADV' : 'DIS';
            const result = await window.TS.dice.putDiceInTray(
              [{ name: `${label} (${modeLabel})`, roll: '2d20' }], false
            );
            if (result && result.rollId) {
              pendingAdvRolls.set(result.rollId, { name: label, mode, bonusN, type, spellDC: opts.spellDC });
            }
          }
          return;
        } catch (e) {
          console.warn('TS.dice.putDiceInTray failed, using fallback:', e);
        }
      }

      // Browser fallback
      const modeLabel = mode === 'advantage' ? 'ADV' : 'DIS';
      let d20, total, detail;
      if (mode === 'normal') {
        d20   = Math.ceil(Math.random() * 20);
        total = d20 + bonusN;
        detail = `d20=${d20}${bonusStr}`;
      } else {
        const r1 = Math.ceil(Math.random() * 20);
        const r2 = Math.ceil(Math.random() * 20);
        d20   = mode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
        total = d20 + bonusN;
        detail = `${modeLabel} ${r1}&${r2}\u2192${d20}${bonusStr}`;
      }
      if (type === 'spell') {
        const outcome = total >= opts.spellDC ? 'success' : 'fail';
        showToast(`${label}: ${total} (${detail}) \u2014 ${outcome}`);
      } else {
        showToast(`${label}: ${total} (${detail})`);
      }
    }

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
        <div class="btn-roll-cluster ability-roll-cluster">
          <button class="btn-adv"    title="Roll ${stat} check with advantage">▲</button>
          <span class="ability-mod" id="mod-${stat.toLowerCase()}"><span class="mod-inner">+0</span></span>
          <button class="btn-disadv" title="Roll ${stat} check with disadvantage">▼</button>
        </div>
      `;
      abilityGrid.appendChild(cell);

      const input  = cell.querySelector('.ability-score');
      const modEl  = cell.querySelector('.ability-mod');
      const cluster = cell.querySelector('.ability-roll-cluster');

      let _abilitySaveTimer = null;
      input.addEventListener('input', () => {
        const mod = abilityMod(input.value);
        modEl.querySelector('.mod-inner').textContent = fmtMod(mod);
        if (!window.SD.character.abilities) window.SD.character.abilities = {};
        window.SD.character.abilities[stat] = Number(input.value) || 10;
        Events.emit('ability:change', stat);
        clearTimeout(_abilitySaveTimer);
        _abilitySaveTimer = setTimeout(coreAutoSave, 300);
      });
      // Tap cell to focus score input (but not when interacting with the roll cluster)
      cell.addEventListener('click', e => {
        if (e.target !== input && !cluster.contains(e.target)) input.focus();
      });
      // Mod badge rolls a normal stat check
      modEl.setAttribute('role', 'button');
      modEl.setAttribute('tabindex', '0');
      modEl.title = `Roll ${stat} check`;
      function rollStatCheck(mode) {
        const bonusN = abilityMod(input.value);
        const label  = `${stat} (${fmtMod(bonusN)})`;
        rollCheck(label, bonusN, mode || 'normal', { type: 'check' });
      }
      modEl.addEventListener('click', () => { rollStatCheck('normal'); collapseStatCluster(); });
      modEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rollStatCheck('normal'); } });
      cluster.querySelector('.btn-adv').addEventListener('click',    () => { rollStatCheck('advantage');    collapseStatCluster(); });
      cluster.querySelector('.btn-disadv').addEventListener('click', () => { rollStatCheck('disadvantage'); collapseStatCluster(); });

      function collapseStatCluster() { cluster.classList.remove('expanded'); }

      // Touch: tap cluster to expand; tap outside to collapse
      cluster.addEventListener('pointerdown', function(e) {
        if (e.pointerType === 'touch' && !cluster.classList.contains('expanded')) {
          cluster.classList.add('expanded');
          e.preventDefault();
        }
      });
      document.addEventListener('pointerdown', function onDocPD(e) {
        if (!cluster.isConnected) { document.removeEventListener('pointerdown', onDocPD); return; }
        if (!cluster.contains(e.target)) collapseStatCluster();
      });
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
     'hp-current','hp-max','luck-tokens'].forEach(function(id) {
      document.getElementById(id).addEventListener('input', coreAutoSave);
    });
    // HP + XP inputs also update the bars on every keystroke
    ['hp-current','hp-max'].forEach(function(id) {
      document.getElementById(id).addEventListener('input', updateHpBar);
    });
    ['char-xp','char-xp-next'].forEach(function(id) {
      document.getElementById(id).addEventListener('input', updateXpBar);
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
            modEl.querySelector('.mod-inner').textContent = fmtMod(abilityMod(score));
          }
        });
      }

    }

    coreLoad();
    updateHpBar();
    updateXpBar();
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
          itemSlots += parseFloat(row.querySelector('.slot-badge').dataset.slots) || 0;
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

        const slotCycles = [1, 2, 3, 4];
        const initSlots = Math.max(1, Math.round(parseFloat(data.slots) || 1));
        const initQty   = parseInt(data.qty, 10) || 1;
        const slotLabel = s => `▣ ${s}`;

        row.innerHTML = `
          <input type="text" class="inv-item-name"  placeholder="Item"  value="${esc(data.name)}" />
          <button class="slot-badge" data-slots="${initSlots}" title="Gear slots — click to change">${slotLabel(initSlots)}</button>
          <div class="qty-stepper">
            <button class="qty-btn qty-down" aria-label="Decrease quantity">−</button>
            <span class="qty-val" data-qty="${initQty}">${initQty}</span>
            <button class="qty-btn qty-up" aria-label="Increase quantity">+</button>
          </div>
          <input type="text" class="inv-item-notes" placeholder="Notes" value="${esc(data.notes)}" />
          <button class="inv-del-btn" aria-label="Remove item">✕</button>
        `;

        const badge  = row.querySelector('.slot-badge');
        const qtyVal = row.querySelector('.qty-val');

        badge.addEventListener('click', () => {
          const cur  = parseFloat(badge.dataset.slots) || 1;
          const idx  = slotCycles.indexOf(cur);
          const next = slotCycles[idx === -1 ? 1 : (idx + 1) % slotCycles.length];
          badge.dataset.slots = next;
          badge.textContent   = slotLabel(next);
          updateEncumbrance();
          collectAndSave();
        });

        row.querySelector('.qty-down').addEventListener('click', () => {
          const v = Math.max(1, parseInt(qtyVal.dataset.qty, 10) - 1);
          qtyVal.dataset.qty = v;
          qtyVal.textContent = v;
          collectAndSave();
        });

        row.querySelector('.qty-up').addEventListener('click', () => {
          const v = parseInt(qtyVal.dataset.qty, 10) + 1;
          qtyVal.dataset.qty = v;
          qtyVal.textContent = v;
          collectAndSave();
        });

        row.querySelector('.inv-del-btn').addEventListener('click', () => {
          row.remove();
          updateEncumbrance();
          collectAndSave();
        });

        row.querySelector('.inv-item-name').addEventListener('input', collectAndSave);
        row.querySelector('.inv-item-notes').addEventListener('input', collectAndSave);

        return row;
      }

      function collectInventory() {
        return Array.from(document.querySelectorAll('#inv-list .inv-row')).map(row => ({
          name:  row.querySelector('.inv-item-name').value,
          slots: parseFloat(row.querySelector('.slot-badge').dataset.slots) || 1,
          qty:   parseInt(row.querySelector('.qty-val').dataset.qty, 10) || 1,
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

        const ARMOR_DATA = ARMOR_TABLE;

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
        if (!initEl._rollWired) {
          initEl._rollWired = true;
          initEl.innerHTML =
            `<div class="btn-roll-cluster init-roll-cluster">` +
              `<button class="btn-adv"    title="Roll Initiative with advantage">▲</button>` +
              `<span class="init-val">${fmtMod(mod)}</span>` +
              `<button class="btn-disadv" title="Roll Initiative with disadvantage">▼</button>` +
            `</div>`;

          const cluster  = initEl.querySelector('.init-roll-cluster');
          const valSpan  = initEl.querySelector('.init-val');

          function rollInitiative(mode) {
            const bonusN = getStatMod('DEX');
            const label  = `Initiative (${fmtMod(bonusN)})`;
            rollCheck(label, bonusN, mode || 'normal', { type: 'check' });
          }

          valSpan.setAttribute('role', 'button');
          valSpan.setAttribute('tabindex', '0');
          valSpan.title = 'Roll Initiative';
          valSpan.addEventListener('click', () => { rollInitiative('normal'); collapseInitCluster(); });
          valSpan.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rollInitiative('normal'); } });
          cluster.querySelector('.btn-adv').addEventListener('click',    () => { rollInitiative('advantage');    collapseInitCluster(); });
          cluster.querySelector('.btn-disadv').addEventListener('click', () => { rollInitiative('disadvantage'); collapseInitCluster(); });

          function collapseInitCluster() { cluster.classList.remove('expanded'); }

          cluster.addEventListener('pointerdown', function(e) {
            if (e.pointerType === 'touch' && !cluster.classList.contains('expanded')) {
              cluster.classList.add('expanded');
              e.preventDefault();
            }
          });
          document.addEventListener('pointerdown', function onDocPD(e) {
            if (!cluster.isConnected) { document.removeEventListener('pointerdown', onDocPD); return; }
            if (!cluster.contains(e.target)) collapseInitCluster();
          });
        } else {
          initEl.querySelector('.init-val').textContent = fmtMod(mod);
        }
      }

      function refreshAC(skipPersist) {
        const armorType = document.getElementById('gear-armor-type').value;
        const shield = document.getElementById('gear-shield').checked;
        const dexMod = getStatMod('DEX');
        const armor = ARMOR_TABLE[armorType] || ARMOR_TABLE.none;
        const ac = armor.ac + (armor.usesDex ? dexMod : 0) + (shield ? 2 : 0);
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
                `<button class="btn-roll" title="Roll attack &amp; damage">${ICON_SWORD}</button>` +
                `<button class="btn-disadv" title="Roll with disadvantage">▼</button>` +
              `</div>` +
              `<button class="btn-trash" title="Remove attack">✕</button>` +
            `</div>`;

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
        if (mode === 'normal') {
          const d20      = Math.ceil(Math.random() * 20);
          const total    = d20 + bonusN;
          const dmgTotal = rollDice(dmg);
          showToast(`${name}: hit ${total} (d20=${d20}${bonusStr}) · dmg ${dmgTotal}`);
        } else {
          const r1 = Math.ceil(Math.random() * 20);
          const r2 = Math.ceil(Math.random() * 20);
          const kept = mode === 'advantage' ? Math.max(r1, r2) : Math.min(r1, r2);
          const total = kept + bonusN;
          const dmgTotal = rollDice(dmg);
          const modeLabel = mode === 'advantage' ? 'ADV' : 'DIS';
          showToast(`${name} (${modeLabel}): hit ${total} (${r1}&${r2}→${kept}${bonusStr}) · dmg ${dmgTotal}`);
        }
      }

      // ── Spells ───────────────────────────────────────────
      function renderSpells() {
        const charClass = (document.getElementById('char-class').value || '').toLowerCase().trim();
        const isCaster  = charClass === 'priest' || charClass === 'wizard';
        const section   = document.getElementById('spell-section');
        section.hidden  = !isCaster;
        if (!isCaster) return;

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
                `<button class="btn-adv"    title="Cast ${esc(sp.name) || 'spell'} with advantage">▲</button>` +
                `<button class="btn-cast btn-roll" title="Cast ${esc(sp.name) || 'spell'} (DC ${dc}, ${castStat})">` +
                  `${ICON_WAND}` +
                `</button>` +
                `<button class="btn-disadv" title="Cast ${esc(sp.name) || 'spell'} with disadvantage">▼</button>` +
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
            const advBtn    = item.querySelector('.spell-cast-cluster .btn-adv');
            const disadvBtn = item.querySelector('.spell-cast-cluster .btn-disadv');
            if (advBtn)    advBtn.title    = `Cast ${sp.name || 'spell'} with advantage`;
            if (disadvBtn) disadvBtn.title = `Cast ${sp.name || 'spell'} with disadvantage`;
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

          // Cast roll buttons (normal, adv, disadv)
          if (castStat) {
            const castCluster = item.querySelector('.spell-cast-cluster');

            function rollCast(mode) {
              const bonusN  = getStatMod(castStat);
              const spellName = sp.name || 'Spell';
              const spellDC   = 10 + (sp.tier || 1);
              const label = `Cast ${spellName} (DC ${spellDC})`;
              rollCheck(label, bonusN, mode, { type: 'spell', spellDC });
            }

            function collapseSpellCluster() { castCluster.classList.remove('expanded'); }

            item.querySelector('.btn-cast').addEventListener('click', () => { rollCast('normal'); collapseSpellCluster(); });
            castCluster.querySelector('.btn-adv').addEventListener('click',    () => { rollCast('advantage');    collapseSpellCluster(); });
            castCluster.querySelector('.btn-disadv').addEventListener('click', () => { rollCast('disadvantage'); collapseSpellCluster(); });

            castCluster.addEventListener('pointerdown', function(e) {
              if (e.pointerType === 'touch' && !castCluster.classList.contains('expanded')) {
                castCluster.classList.add('expanded');
                e.preventDefault();
              }
            });
            document.addEventListener('pointerdown', function onDocPD(e) {
              if (!castCluster.isConnected) { document.removeEventListener('pointerdown', onDocPD); return; }
              if (!castCluster.contains(e.target)) collapseSpellCluster();
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

    // ── HP + XP bar update functions ────────────────────────────────────────
    function updateHpBar() {
      var card    = document.getElementById('hp-card');
      var bar     = document.getElementById('hp-bar');
      var current = parseInt(document.getElementById('hp-current').value, 10) || 0;
      var max     = parseInt(document.getElementById('hp-max').value,     10) || 0;
      var pct     = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
      bar.style.width = (pct * 100) + '%';
      card.classList.remove('hp-ok', 'hp-hurt', 'hp-crit', 'hp-dying');
      if (current <= 0)      card.classList.add('hp-dying');
      else if (pct <= 0.25)  card.classList.add('hp-crit');
      else if (pct <= 0.50)  card.classList.add('hp-hurt');
      else                   card.classList.add('hp-ok');
    }

    function updateXpBar() {
      var bar     = document.getElementById('xp-bar');
      var current = parseInt(document.getElementById('char-xp').value,      10) || 0;
      var max     = parseInt(document.getElementById('char-xp-next').value,  10) || 0;
      var pct     = max > 0 ? Math.min(1, Math.max(0, current / max)) : 0;
      bar.style.width = (pct * 100) + '%';
    }

    // ── Stat card stepper buttons (HP + XP) ─────────────────────────────────
    document.querySelectorAll('.stat-step-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var currentId = btn.getAttribute('data-target');
        var maxId     = btn.getAttribute('data-max');
        var inp       = document.getElementById(currentId);
        var maxVal    = parseInt(document.getElementById(maxId).value, 10) || 0;
        var step      = btn.classList.contains('stat-step-up') ? 1 : -1;
        var next      = Math.min(maxVal, Math.max(0, (parseInt(inp.value, 10) || 0) + step));
        inp.value = next;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });


    (function() {
      const guide = Modal('creation-guide', 'guide-close');
      document.getElementById('guide-x').addEventListener('click', function() { guide.close(); });

      window._openGuide = function() { guide.open(); };

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
      const helpModal = Modal('help-modal', 'help-close');
      document.getElementById('menu-help').addEventListener('click', function() {
        toggleMenu(false);
        helpModal.open();
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
      const aboutModal = Modal('about-modal', 'about-close');
      document.getElementById('menu-about').addEventListener('click', function() {
        toggleMenu(false);
        aboutModal.open();
      });
    })();

    })(); // end boot()
  