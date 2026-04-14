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

    // ── Storage Adapter ────────────────────────────────
    // Abstracts browser localStorage vs TaleSpire campaign storage.
    // In TaleSpire, all keys are packed into a single JSON blob
    // stored via TS.localStorage.campaign.setBlob/getBlob.
    const StorageAdapter = (function() {
      const _cache = {};
      let _isTaleSpire = false;
      let _dirty = false;
      let _debounceTimer = null;
      const DEBOUNCE_MS = 500;

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

      function _scheduleFlush() {
        if (!_isTaleSpire) return;
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(_flushToTaleSpire, DEBOUNCE_MS);
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

    // ── Boot ───────────────────────────────────────────
    // Wrapped in async IIFE so TaleSpire's async getBlob() resolves
    // before any UI reads from storage. Browser mode resolves instantly.
    (async function boot() {
    // Wait for TaleSpire API to initialize (instant in browser mode)
    await _tsReadyPromise;
    await StorageAdapter.init();

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
    const ABILITY_STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

    const CORE_CLASS_ICONS = {
      fighter: '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75l.063-.062c21.827 21.93 44.04 43.923 66.405 66.25c-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53l68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938l-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593c-43.852-43.8-86.462-85.842-130.125-125.47c-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562l56.81-56.812l13.22 13.187l-56.438 56.44l24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906l200.56 200.53a403 403 0 0 1-13.405 13.032L148.875 153.53zm-76.69 113.28l-28.5 28.532l68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717l28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313c17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655l-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844l-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594c-15.068-18.587-28.38-38.758-39.5-60.625z"/></svg>',
      priest:  '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="m256 21.938l-4.025 2.01c-96 48-93.455 47.175-189.455 63.175l-8.592 1.432l1.15 8.634c16.125 120.934 48.338 217.868 85.022 285.12c18.34 33.627 37.776 59.85 57.263 78.022C216.85 478.502 236.625 489 256 489s39.15-10.497 58.637-28.668s38.922-44.395 57.263-78.02c36.684-67.254 68.897-164.188 85.022-285.123l1.15-8.635l-8.592-1.432c-96-16-93.455-15.174-189.455-63.174zM224 64c16 0 16 0 32 16c16-16 16-16 32-16c-16 16-16 16-16 32l2.666 48h109.158S400 144 416 128c0 16 0 16-16 32c16 16 16 16 16 32c-16-16-32.176-16-32.176-16h-107.38L288 384s0 32 16 64c-16 0-48 0-48-16c0 16-32 16-48 16c16-32 16-64 16-64l11.555-208H128.13S112 176 96 192c0-16 0-16 16-32c-16-16-16-16-16-32c16 16 32.13 16 32.13 16h109.204L240 96c0-16 0-16-16-32"/></svg>',
      thief:   '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M254.07 19.707c-56.303 28.998-106.297 107.317-122.64 168.707c32.445 2.11 58.63 12.963 78.638 30.848l9.334-10.198c-13.336-13.056-30.596-23.9-52.994-34.707c12.68-31.542 32.01-79.29 56.598-82.07c9.62-1.088 19.92 4.722 31.13 21.068c35.08-58.334 68.394 18.705 87.727 61.002c-21.94 11.897-39.132 22.82-52.63 36.024l8.68 9.76c19.68-17.732 45.72-29.358 78.55-31.673C358.24 127.335 311.515 50.14 254.07 19.707M219.617 144.57c-8.894 0-16.103 3.952-16.103 8.826s7.21 8.827 16.103 8.827s16.106-3.95 16.106-8.827c0-4.874-7.212-8.826-16.106-8.826m68.965 0c-8.894 0-16.105 3.952-16.105 8.826s7.21 8.827 16.105 8.827s16.106-3.95 16.106-8.827c0-4.874-7.212-8.826-16.106-8.826m-118.894 70.88a233 233 0 0 0-6.444 11.52c-25.587 48.98-43.26 123.643-43.896 223.48c32.776 18.89 64.322 31.324 95.707 36.988c-35.5-24.36-60.375-80.893-60.375-146.754c0-45.97 12.12-87.39 31.51-116.506a96 96 0 0 0-16.502-8.727zm168.933.35a98.5 98.5 0 0 0-16.298 8.764c19.24 29.095 31.254 70.354 31.254 116.12c0 65.82-24.844 122.322-60.306 146.707c30.88-5.598 62.44-17.812 95.656-36.947c-.638-99.57-18.31-174.163-43.9-223.177a234 234 0 0 0-6.405-11.467zm-97.665 23.61c7.026 22.543 9.128 45.086.98 67.63h-41.552v18.513c10.057-3.24 20.25-5.39 30.502-6.594c.066 50.215 1.313 96.574 19.82 145.435l4.193 11.074l4.485-10.962c19.48-47.615 18.045-95.297 17.933-145.024c10.257 1.333 20.463 3.4 30.545 6.07v-18.515h-41.374c-6.888-22.544-5.932-45.087.803-67.63h-26.335z"/></svg>',
      wizard:  '<svg width="1em" height="1em" viewBox="0 0 512 512" fill="currentColor" style="vertical-align:-.15em"><path d="M319.61 20.654c13.145 33.114 13.144 33.115-5.46 63.5c33.114-13.145 33.116-13.146 63.5 5.457c-13.145-33.114-13.146-33.113 5.457-63.498c-33.114 13.146-33.113 13.145-63.498-5.459zM113.024 38.021c-11.808 21.04-11.808 21.04-35.724 24.217c21.04 11.809 21.04 11.808 24.217 35.725c11.808-21.04 11.808-21.04 35.724-24.217c-21.04-11.808-21.04-11.808-24.217-35.725m76.55 56.184c-.952 50.588-.95 50.588-41.991 80.18c50.587.95 50.588.95 80.18 41.99c.95-50.588.95-50.588 41.99-80.18c-50.588-.95-50.588-.95-80.18-41.99zm191.177 55.885c-.046 24.127-.048 24.125-19.377 38.564c24.127.047 24.127.046 38.566 19.375c.047-24.126.046-24.125 19.375-38.564c-24.126-.047-24.125-.046-38.564-19.375m-184.086 83.88a96 96 0 0 0-3.492.134c-18.591 1.064-41.868 8.416-77.445 22.556L76.012 433.582c78.487-20.734 132.97-21.909 170.99-4.615V247.71c-18.076-8.813-31.79-13.399-46.707-13.737a91 91 0 0 0-3.629-.002zm122.686 11.42a209 209 0 0 0-8.514.098c-12.81.417-27.638 2.215-45.84 4.522v177.135c43.565-7.825 106.85-4.2 171.244 7.566l-39.78-177.197c-35.904-8.37-56.589-11.91-77.11-12.123zm2.289 16.95c18.889.204 36.852 2.768 53.707 5.02l4.437 16.523c-23.78-3.75-65.966-4.906-92.467-.98l-.636-17.805c11.959-2.154 23.625-2.88 34.959-2.758m-250.483 4.658L60.54 313.002h24.094l10.326-46.004H71.158zm345.881 0l39.742 177.031l2.239 9.973l22.591-.152l-40.855-186.852zm-78.857 57.82c16.993.026 33.67.791 49.146 2.223l3.524 17.174c-32.645-3.08-72.58-2.889-102.995 0l-.709-17.174c16.733-1.533 34.04-2.248 51.034-2.223m-281.793 6.18l-6.924 30.004h24.394l6.735-30.004H56.389zm274.418 27.244c4.656.021 9.487.085 14.716.203l2.555 17.498c-19.97-.471-47.115.56-59.728 1.05l-.7-17.985c16.803-.493 29.189-.828 43.157-.766m41.476.447c8.268.042 16.697.334 24.121.069l2.58 17.74c-8.653-.312-24.87-.83-32.064-.502l-2.807-17.234a257 257 0 0 1 8.17-.073m-326.97 20.309l-17.985 77.928l25.035-.17l17.455-77.758H45.313zm303.164 11.848c19.608-.01 38.66.774 56.449 2.572l2.996 20.787c-34.305-4.244-85.755-7.697-119.1-3.244l-.14-17.922c20.02-1.379 40.186-2.183 59.795-2.193m-166.606 44.05c-30.112.09-67.916 6.25-115.408 19.76l-7.22 2.053l187.759-1.27v-6.347c-16.236-9.206-37.42-14.278-65.13-14.196zm134.41 6.174c-19.63.067-37.112 1.439-51.283 4.182v10.064l177.594-1.203c-44.322-8.634-89.137-13.17-126.31-13.043zM26 475v18h460v-18z"/></svg>',
    };

    function updateCoreIcon(className) {
      const el = document.getElementById('core-tab-icon');
      if (el) el.innerHTML = CORE_CLASS_ICONS[(className || '').toLowerCase()] || CORE_CLASS_ICONS.fighter;
    }

    function abilityMod(score) {
      return Math.floor((Number(score) - 10) / 2);
    }

    function fmtMod(mod) {
      return mod >= 0 ? `+${mod}` : `${mod}`;
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
        // Visual updates — synchronous for instant feedback
        const mod = abilityMod(input.value);
        modEl.textContent = fmtMod(mod);
        // Update in-memory model immediately (cheap)
        if (!window.SD.character.abilities) window.SD.character.abilities = {};
        window.SD.character.abilities[stat] = Number(input.value) || 10;
        if (stat === 'DEX' && window.SD.refreshInit) window.SD.refreshInit();
        if (stat === 'DEX' && window.SD.refreshAC) window.SD.refreshAC(true);
        if ((stat === 'STR' || stat === 'DEX') && window.SD.refreshAttackBonuses) window.SD.refreshAttackBonuses();
        if ((stat === 'STR' || stat === 'CON') && window.SD.updateEncumbrance) window.SD.updateEncumbrance();
        // Debounced save — avoids expensive JSON.stringify on every keystroke
        clearTimeout(_abilitySaveTimer);
        _abilitySaveTimer = setTimeout(coreAutoSave, 300);
      });
      // Tap cell to focus score input
      cell.addEventListener('click', e => {
        if (e.target !== input) input.focus();
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
     'hp-current','hp-max','luck-tokens'].forEach(id => {
      document.getElementById(id).addEventListener('input', coreAutoSave);
    });
    // char-class is a <select>, fires 'change'
    document.getElementById('char-class').addEventListener('change', coreAutoSave);

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
      const PORTRAIT_KEY = 'sd_char_portrait';
      const frame = document.getElementById('portrait-frame');
      const img = document.getElementById('portrait-img');
      const placeholder = document.getElementById('portrait-placeholder');
      const clearBtn = document.getElementById('portrait-clear');
      const fileInput = document.getElementById('portrait-file');

      function loadPortrait() {
        const data = StorageAdapter.getItem(PORTRAIT_KEY);
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
          StorageAdapter.setItem(PORTRAIT_KEY, dataUrl);
        } catch (e) {
          console.warn('Could not save portrait:', e);
        }
      }

      function clearPortrait() {
        StorageAdapter.removeItem(PORTRAIT_KEY);
        img.src = '';
        img.style.display = 'none';
        placeholder.style.display = 'flex';
      }

      function resizeImage(file) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const imgEl = new Image();
            imgEl.onload = () => {
              const maxDim = 400;
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
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            imgEl.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      async function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const dataUrl = await resizeImage(file);
        savePortrait(dataUrl);
        img.src = dataUrl;
        img.style.display = 'block';
        placeholder.style.display = 'none';
      }

      let filePickerOpen = false;

      function openFilePicker() {
        if (filePickerOpen) return;
        filePickerOpen = true;
        fileInput.click();
      }

      frame.addEventListener('click', (e) => {
        if (e.target === clearBtn) return;
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

      loadPortrait();
    })();

    const INVENTORY_ITEMS = [
      'Arrows (20)', 'Backpack', 'Caltrops (one bag)', 'Coin', 'Crossbow bolts (20)',
      'Crowbar', 'Flask or bottle', 'Flint and steel', 'Gem', 'Grappling hook',
      'Iron spikes (10)', 'Lantern', 'Mirror', 'Oil (flask)', 'Pole',
      'Rations (3)', 'Rope (60\')', 'Torch',
      'Bastard sword', 'Club', 'Crossbow', 'Dagger', 'Greataxe', 'Greatsword',
      'Javelin', 'Longbow', 'Longsword', 'Mace', 'Shortbow', 'Shortsword',
      'Spear', 'Staff', 'Warhammer'
    ];

    function initInventoryAutocomplete() {
      let activeDropdown = null;
      let activeIdx = -1;
      let matches = [];

      function createDropdown() {
        const dd = document.createElement('div');
        dd.className = 'inv-autocomplete';
        dd.setAttribute('role', 'listbox');
        return dd;
      }

      function renderMatches(inputEl, dd, query) {
        matches = INVENTORY_ITEMS.filter(item =>
          !query || item.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 12);
        dd.innerHTML = '';
        activeIdx = -1;
        if (!matches.length) {
          dd.style.display = 'none';
          return;
        }
        matches.forEach((item, i) => {
          const opt = document.createElement('div');
          opt.className = 'inv-autocomplete-item';
          opt.setAttribute('role', 'option');
          opt.dataset.idx = i;
          const match = item.match(/^(.*?)(\s*\([^)]*\))?$/);
          if (match && match[2]) {
            const mainSpan = document.createElement('span');
            mainSpan.textContent = match[1];
            const suffixSpan = document.createElement('span');
            suffixSpan.className = 'inv-autocomplete-suffix';
            suffixSpan.textContent = match[2];
            opt.appendChild(mainSpan);
            opt.appendChild(suffixSpan);
          } else {
            opt.textContent = item;
          }
          opt.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectItem(inputEl, item);
          });
          dd.appendChild(opt);
        });
        dd.style.display = 'block';
      }

      function selectItem(inputEl, item) {
        hideDropdown();
        inputEl.value = item;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function hideDropdown() {
        if (activeDropdown) {
          activeDropdown.style.display = 'none';
          activeDropdown.remove();
          activeDropdown = null;
        }
        activeIdx = -1;
        matches = [];
      }

      function highlightActive(dd) {
        const items = dd.querySelectorAll('.inv-autocomplete-item');
        items.forEach((el, i) => {
          el.classList.toggle('active', i === activeIdx);
        });
      }

      document.getElementById('inv-list').addEventListener('focusin', (e) => {
        if (e.target.classList.contains('inv-item-name')) {
          if (activeDropdown) hideDropdown();
          activeDropdown = createDropdown();
          const rect = e.target.getBoundingClientRect();
          activeDropdown.style.position = 'fixed';
          activeDropdown.style.top = rect.bottom + 'px';
          activeDropdown.style.left = rect.left + 'px';
          activeDropdown.style.width = rect.width + 'px';
          document.body.appendChild(activeDropdown);
          renderMatches(e.target, activeDropdown, e.target.value.trim());
        }
      });

      document.getElementById('inv-list').addEventListener('input', (e) => {
        if (e.target.classList.contains('inv-item-name') && activeDropdown) {
          const rect = e.target.getBoundingClientRect();
          activeDropdown.style.top = rect.bottom + 'px';
          activeDropdown.style.left = rect.left + 'px';
          activeDropdown.style.width = rect.width + 'px';
          renderMatches(e.target, activeDropdown, e.target.value.trim());
        }
      });

      document.getElementById('inv-list').addEventListener('keydown', (e) => {
        if (!activeDropdown || activeDropdown.style.display === 'none') return;
        if (!e.target.classList.contains('inv-item-name')) return;

        const items = activeDropdown.querySelectorAll('.inv-autocomplete-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIdx = (activeIdx + 1) % items.length;
          highlightActive(activeDropdown);
          items[activeIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
          highlightActive(activeDropdown);
          items[activeIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          if (activeIdx >= 0 && matches[activeIdx]) {
            e.preventDefault();
            selectItem(e.target, matches[activeIdx]);
          }
        } else if (e.key === 'Escape' || e.key === 'Tab') {
          hideDropdown();
        }
      });

      document.getElementById('inv-list').addEventListener('focusout', (e) => {
        setTimeout(() => { if (activeDropdown) hideDropdown(); }, 120);
      });

      document.addEventListener('click', (e) => {
        if (activeDropdown && !activeDropdown.contains(e.target) &&
            !e.target.classList.contains('inv-item-name')) {
          hideDropdown();
        }
      });
    }

    initInventoryAutocomplete();

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

    function initSpellAutocomplete() {
      let activeDropdown = null;
      let activeIdx = -1;
      let matches = [];
      let currentSpellItem = null;

      function createDropdown() {
        const dd = document.createElement('div');
        dd.className = 'spell-autocomplete';
        dd.setAttribute('role', 'listbox');
        return dd;
      }

      function renderMatches(inputEl, dd, query) {
        const charClass = (document.getElementById('char-class').value || '').toLowerCase().trim();
        const isPriest = charClass === 'priest';
        const isWizard = charClass === 'wizard';
        const isCaster = isPriest || isWizard;

        let allMatches = SPELL_DB.filter(spell =>
          !query || spell.name.toLowerCase().includes(query.toLowerCase())
        );

        // Filter to class spells when a caster class is selected
        if (isCaster) {
          allMatches = allMatches.filter(spell =>
            spell.classes.some(c => c.toLowerCase() === charClass)
          );
        }

        allMatches.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
        matches = allMatches.slice(0, 20);

        dd.innerHTML = '';
        activeIdx = -1;
        if (!matches.length) {
          dd.style.display = 'none';
          return;
        }

        matches.forEach((spell, i) => {
          const opt = document.createElement('div');
          opt.className = 'spell-autocomplete-item';
          opt.setAttribute('role', 'option');
          opt.dataset.idx = i;

          const nameSpan = document.createElement('span');
          nameSpan.className = 'spell-ac-name';
          nameSpan.textContent = spell.name;

          const infoSpan = document.createElement('span');
          infoSpan.className = 'spell-ac-info';
          infoSpan.textContent = `T${spell.tier} · ${spell.classes.join('/')}`;

          opt.appendChild(nameSpan);
          opt.appendChild(infoSpan);

          opt.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectSpell(inputEl, spell);
          });
          dd.appendChild(opt);
        });
        dd.style.display = 'block';
      }

      function selectSpell(inputEl, spell) {
        const spellItem = currentSpellItem;
        hideDropdown();
        inputEl.value = spell.name;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));

        if (spellItem) {
          const tierInp = spellItem.querySelector('.sp-tier');
          const rangeInp = spellItem.querySelector('.sp-range');
          const durInp = spellItem.querySelector('.sp-dur');
          const descTa = spellItem.querySelector('.spell-desc-ta');
          const badge = spellItem.querySelector('.spell-tier-badge');

          if (tierInp) {
            tierInp.value = spell.tier;
            tierInp.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (badge) badge.textContent = `T${spell.tier}`;
          if (rangeInp) {
            rangeInp.value = spell.range;
            rangeInp.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (durInp) {
            durInp.value = spell.duration;
            durInp.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (descTa) {
            descTa.value = spell.desc;
            descTa.dispatchEvent(new Event('input', { bubbles: true }));
          }

          const spellData = getCombat().spells;
          const idx = Array.from(document.querySelectorAll('.spell-item')).indexOf(spellItem);
          if (idx >= 0 && spellData[idx]) {
            spellData[idx].tier = spell.tier;
            spellData[idx].range = spell.range;
            spellData[idx].duration = spell.duration;
            spellData[idx].desc = spell.desc;
            window.SD.saveCharacter(window.SD.character);
          }
        }
      }

      function hideDropdown() {
        if (activeDropdown) {
          activeDropdown.style.display = 'none';
          activeDropdown.remove();
          activeDropdown = null;
        }
        activeIdx = -1;
        matches = [];
        currentSpellItem = null;
      }

      function highlightActive(dd) {
        const items = dd.querySelectorAll('.spell-autocomplete-item');
        items.forEach((el, i) => {
          el.classList.toggle('active', i === activeIdx);
        });
      }

      document.getElementById('cbt-spell-list').addEventListener('focusin', (e) => {
        if (e.target.classList.contains('spell-name-inp')) {
          if (activeDropdown) hideDropdown();
          currentSpellItem = e.target.closest('.spell-item');
          activeDropdown = createDropdown();
          const rect = e.target.getBoundingClientRect();
          activeDropdown.style.position = 'fixed';
          activeDropdown.style.top = rect.bottom + 'px';
          activeDropdown.style.left = rect.left + 'px';
          activeDropdown.style.width = Math.max(rect.width, 200) + 'px';
          document.body.appendChild(activeDropdown);
          // Show class-filtered spells immediately on focus
          renderMatches(e.target, activeDropdown, e.target.value.trim());
        }
      });

      document.getElementById('cbt-spell-list').addEventListener('input', (e) => {
        if (e.target.classList.contains('spell-name-inp') && activeDropdown) {
          const rect = e.target.getBoundingClientRect();
          activeDropdown.style.top = rect.bottom + 'px';
          activeDropdown.style.left = rect.left + 'px';
          activeDropdown.style.width = Math.max(rect.width, 200) + 'px';
          renderMatches(e.target, activeDropdown, e.target.value.trim());
        }
      });

      document.getElementById('cbt-spell-list').addEventListener('keydown', (e) => {
        if (!activeDropdown || activeDropdown.style.display === 'none') return;
        if (!e.target.classList.contains('spell-name-inp')) return;

        const items = activeDropdown.querySelectorAll('.spell-autocomplete-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIdx = (activeIdx + 1) % items.length;
          highlightActive(activeDropdown);
          items[activeIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
          highlightActive(activeDropdown);
          items[activeIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          if (activeIdx >= 0 && matches[activeIdx]) {
            e.preventDefault();
            selectSpell(e.target, matches[activeIdx]);
          }
        } else if (e.key === 'Escape' || e.key === 'Tab') {
          hideDropdown();
        }
      });

      document.getElementById('cbt-spell-list').addEventListener('focusout', (e) => {
        setTimeout(() => { if (activeDropdown) hideDropdown(); }, 120);
      });

      document.addEventListener('click', (e) => {
        if (activeDropdown && !activeDropdown.contains(e.target) &&
            !e.target.classList.contains('spell-name-inp')) {
          hideDropdown();
        }
      });
    }

    initSpellAutocomplete();

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
      window.SD.updateEncumbrance = updateEncumbrance;

      // ── Inventory rows ───────────────────────────────
      let rowIdCounter = 0;

      function createInvRow(data) {
        data = data || { name: '', slots: 1, qty: 1, notes: '' };
        const id = ++rowIdCounter;
        const row = document.createElement('div');
        row.className = 'inv-row';
        row.dataset.rowId = id;
        row.innerHTML = `
          <input type="text"   class="inv-item-name"  placeholder="Item"  value="${escHtml(data.name)}" />
          <input type="number" class="inv-item-slots"  min="0" step="1" value="${data.slots}" />
          <input type="number" class="inv-item-qty"    min="1"            value="${data.qty}" />
          <input type="text"   class="inv-item-notes" placeholder="Notes" value="${escHtml(data.notes)}" />
          <button class="inv-del-btn" aria-label="Remove item">🗑</button>
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

      function escHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
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
      }

      // ── Render from saved data ───────────────────────
      function renderGear() {
        const gear = getGear();

        document.getElementById('gear-gp').value          = gear.gp;
        document.getElementById('gear-sp').value          = gear.sp;
        if (window.SD.setArmorType) {
          window.SD.setArmorType(gear.armorType || 'none');
        } else {
          document.getElementById('gear-armor-type').value  = gear.armorType || 'none';
        }
        document.getElementById('gear-mithral').checked   = !!gear.mithral;
        document.getElementById('gear-shield').checked    = !!gear.shield;
        document.getElementById('enc-bonus').value        = gear.bonusSlots || 0;

        const list = document.getElementById('inv-list');
        list.innerHTML = '';
        (gear.inventory || []).forEach(item => {
          list.appendChild(createInvRow(item));
        });

        updateEncumbrance();
      }

      // ── Wire top-level inputs ────────────────────────
      ['gear-gp', 'gear-sp', 'enc-bonus'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
          collectAndSave();
          updateEncumbrance();
        });
      });
      ['gear-armor-type'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
          collectAndSave();
          updateEncumbrance();
          if (window.SD.refreshAC) window.SD.refreshAC();
        });
      });
      ['gear-mithral', 'gear-shield'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
          collectAndSave();
          updateEncumbrance();
          if (id === 'gear-shield' && window.SD.refreshAC) window.SD.refreshAC();
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

        window.SD.setArmorType = function(value) {
          hiddenInput.value = value;
          updateTrigger(value);
        };
      })();

      document.getElementById('inv-add-btn').addEventListener('click', () => {
        const gear = getGear();
        gear.inventory = (gear.inventory || []).concat([{ name: '', slots: 1, qty: 1, notes: '' }]);
        saveGear(gear);
        const list = document.getElementById('inv-list');
        list.innerHTML = '';
        gear.inventory.forEach(item => list.appendChild(createInvRow(item)));
        updateEncumbrance();
        const rows = list.querySelectorAll('.inv-row');
        if (rows.length) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      renderGear();
    })();


    // ── CLASS tab ──────────────────────────────────────
    (function () {
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

      const CLASS_FEATURES = {
        fighter: [
          { name: 'Hauler', desc: 'Add your Constitution modifier, if positive, to your gear slots.' },
          { name: 'Weapon Mastery', desc: 'Choose one type of weapon. You gain +1 to attack and damage with that weapon type. Add half your level to these rolls (round down).' },
          { name: 'Grit', desc: 'Choose Strength or Dexterity. You have advantage on checks of that type to overcome an opposing force, such as kicking open a stuck door (STR) or slipping free of rusty chains (DEX).' },
        ],
        thief: [
          { name: 'Backstab', desc: 'If you hit a creature who is unaware of your attack, you deal an extra weapon die of damage. Add additional weapon dice equal to half your level (round down).' },
          { name: 'Thievery', desc: 'You are adept at thieving skills and have the necessary tools (no gear slots). You have advantage on checks for: climbing, sneaking and hiding, applying disguises, finding and disabling traps, and delicate tasks such as picking pockets and opening locks.' },
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

      // ── helpers ────────────────────────────────────────
      function clsKey(k) { return 'cls_' + k; }

      function load(key, fallback) {
        const char = window.SD.loadCharacter();
        const v = char[clsKey(key)];
        return v !== undefined ? v : fallback;
      }

      function save(key, value) {
        const char = window.SD.loadCharacter();
        char[clsKey(key)] = value;
        window.SD.saveCharacter(char);
        window.SD.character = char;
      }

      function autoGrow(el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
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
      window.SD.renderTalents = renderTalents;

      // ── talent autocomplete ─────────────────────────────
      function initTalentAutocomplete() {
        let activeDropdown = null;
        let activeIdx = -1;
        let matches = [];

        function createDropdown() {
          const dd = document.createElement('div');
          dd.className = 'talent-autocomplete';
          dd.setAttribute('role', 'listbox');
          return dd;
        }

        function getTalents() {
          const cls = (document.getElementById('char-class').value || '').toLowerCase();
          return CLASS_TALENTS[cls] || [];
        }

        function renderMatches(inputEl, dd, query) {
          const talents = getTalents();
          matches = talents.filter(t =>
            !query || t.text.toLowerCase().includes(query.toLowerCase())
          );
          dd.innerHTML = '';
          activeIdx = -1;
          if (!matches.length) {
            dd.style.display = 'none';
            return;
          }
          matches.forEach((t, i) => {
            const opt = document.createElement('div');
            opt.className = 'talent-autocomplete-item';
            opt.setAttribute('role', 'option');
            opt.dataset.idx = i;
            const rollSpan = document.createElement('span');
            rollSpan.className = 'talent-ac-roll';
            rollSpan.textContent = t.roll;
            const textSpan = document.createElement('span');
            textSpan.textContent = t.text;
            opt.appendChild(rollSpan);
            opt.appendChild(textSpan);
            opt.addEventListener('mousedown', (e) => {
              e.preventDefault();
              selectItem(inputEl, t.text);
            });
            dd.appendChild(opt);
          });
          dd.style.display = 'block';
        }

        function selectItem(inputEl, text) {
          hideDropdown();
          inputEl.value = text;
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        function hideDropdown() {
          if (activeDropdown) {
            activeDropdown.style.display = 'none';
            activeDropdown.remove();
            activeDropdown = null;
          }
          activeIdx = -1;
          matches = [];
        }

        function highlightActive(dd) {
          const items = dd.querySelectorAll('.talent-autocomplete-item');
          items.forEach((el, i) => {
            el.classList.toggle('active', i === activeIdx);
          });
        }

        const talentsList = document.getElementById('talents-list');

        talentsList.addEventListener('focusin', (e) => {
          if (e.target.classList.contains('talent-input')) {
            if (activeDropdown) hideDropdown();
            activeDropdown = createDropdown();
            const rect = e.target.getBoundingClientRect();
            activeDropdown.style.position = 'fixed';
            activeDropdown.style.top = rect.bottom + 'px';
            activeDropdown.style.left = rect.left + 'px';
            activeDropdown.style.width = rect.width + 'px';
            document.body.appendChild(activeDropdown);
            renderMatches(e.target, activeDropdown, e.target.value.trim());
          }
        });

        talentsList.addEventListener('input', (e) => {
          if (e.target.classList.contains('talent-input') && activeDropdown) {
            const rect = e.target.getBoundingClientRect();
            activeDropdown.style.top = rect.bottom + 'px';
            activeDropdown.style.left = rect.left + 'px';
            activeDropdown.style.width = rect.width + 'px';
            renderMatches(e.target, activeDropdown, e.target.value.trim());
          }
        });

        talentsList.addEventListener('keydown', (e) => {
          if (!activeDropdown || activeDropdown.style.display === 'none') return;
          if (!e.target.classList.contains('talent-input')) return;

          const items = activeDropdown.querySelectorAll('.talent-autocomplete-item');
          if (!items.length) return;

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = (activeIdx + 1) % items.length;
            highlightActive(activeDropdown);
            items[activeIdx]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
            highlightActive(activeDropdown);
            items[activeIdx]?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter') {
            if (activeIdx >= 0 && matches[activeIdx]) {
              e.preventDefault();
              selectItem(e.target, matches[activeIdx].text);
            }
          } else if (e.key === 'Escape' || e.key === 'Tab') {
            hideDropdown();
          }
        });

        talentsList.addEventListener('focusout', () => {
          setTimeout(() => { if (activeDropdown) hideDropdown(); }, 120);
        });

        document.addEventListener('click', (e) => {
          if (activeDropdown && !activeDropdown.contains(e.target) &&
              !e.target.classList.contains('talent-input')) {
            hideDropdown();
          }
        });
      }

      initTalentAutocomplete();

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

      // ── deity visibility ────────────────────────────────
      function updateDeityVisibility(className) {
        const section = document.getElementById('deity-section');
        const isP = (className || '').toLowerCase().trim() === 'priest';
        section.classList.toggle('dimmed', !isP);
      }

      // ── initialise ─────────────────────────────────────
      function initClassTab() {
        const bgEl    = document.getElementById('cls-background');
        const deityEl = document.getElementById('cls-deity');
        const notesEl = document.getElementById('cls-notes');
        const langEl  = document.getElementById('char-languages');
        const toggle  = document.getElementById('features-toggle');
        const fbody   = document.getElementById('features-body');

        // Restore saved values
        bgEl.value    = load('background', '');
        deityEl.value = load('deity', '');
        notesEl.value = load('notes', '');
        if (window.SD.character.languages) langEl.value = window.SD.character.languages;

        // Read class/level from Core DOM (single source of truth)
        const currentClass = document.getElementById('char-class').value || '';
        const currentLevel = parseInt(document.getElementById('char-level').value, 10) || 1;

        renderTalents(currentLevel);
        renderFeatures(currentClass);
        updateDeityVisibility(currentClass);

        requestAnimationFrame(() => {
          autoGrow(bgEl);
          autoGrow(notesEl);
        });

        // Re-render when Core class/level change
        document.getElementById('char-class').addEventListener('change', (e) => {
          renderFeatures(e.target.value);
          updateDeityVisibility(e.target.value);
          updateCoreIcon(e.target.value);
          if (window.SD.updateEncumbrance) window.SD.updateEncumbrance();
        });
        document.getElementById('char-level').addEventListener('input', (e) => {
          renderTalents(parseInt(e.target.value, 10) || 1);
        });
        
        // Re-render talents when ancestry changes (Human bonus slot)
        document.getElementById('char-ancestry').addEventListener('change', () => {
          const currentLevel = parseInt(document.getElementById('char-level').value, 10) || 1;
          renderTalents(currentLevel);
        });

        // Events
        langEl.addEventListener('input', () => {
          const char = window.SD.loadCharacter();
          char.languages = langEl.value;
          window.SD.saveCharacter(char);
          window.SD.character = char;
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
      }

      // Run once DOM is ready (it is, since script is deferred-inline at body end)
      initClassTab();
    })();



    // ── Combat Tab ────────────────────────────────────────
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
        return Math.floor((val - 10) / 2);
      }

      function fmt(n) { return n >= 0 ? `+${n}` : `${n}`; }

      function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      }

      function esc(s) {
        return String(s ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
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
        document.getElementById('cbt-init').textContent = fmt(getStatMod('DEX'));
      }
      window.SD.refreshInit = refreshInit;

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
      window.SD.refreshAC = refreshAC;

      function refreshAttackBonuses() {
        document.querySelectorAll('.atk-row').forEach(row => {
          const statSel = row.querySelector('.atk-stat');
          const bonusSpn = row.querySelector('.atk-bonus');
          if (statSel && bonusSpn) bonusSpn.textContent = fmt(getStatMod(statSel.value));
        });
      }
      window.SD.refreshAttackBonuses = refreshAttackBonuses;

      // ── Weapon Data (Shadowdark Player Quickstart p.35) ─
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

      // ── Weapon Autocomplete ───────────────────────────────
      let weaponDropdown = null;
      let weaponMatches = [];
      let weaponActiveIdx = -1;
      let weaponCurrentRow = null;

      function showWeaponDropdown(inputEl) {
        hideWeaponDropdown();
        const dd = document.createElement('div');
        dd.className = 'weapon-autocomplete';
        dd.setAttribute('role', 'listbox');
        weaponDropdown = dd;
        document.body.appendChild(dd);
        positionWeaponDropdown(inputEl);
        filterWeapons(inputEl, inputEl.value.trim());
      }

      function positionWeaponDropdown(inputEl) {
        if (!weaponDropdown) return;
        const rect = inputEl.getBoundingClientRect();
        weaponDropdown.style.position = 'fixed';
        weaponDropdown.style.top = rect.bottom + 'px';
        weaponDropdown.style.left = rect.left + 'px';
        weaponDropdown.style.width = Math.max(rect.width, 220) + 'px';
      }

      function filterWeapons(inputEl, query) {
        if (!weaponDropdown) return;
        weaponMatches = WEAPONS.filter(w =>
          !query || w.name.toLowerCase().includes(query.toLowerCase())
        );
        weaponDropdown.innerHTML = '';
        weaponActiveIdx = -1;
        if (!weaponMatches.length) { weaponDropdown.style.display = 'none'; return; }
        weaponMatches.forEach((w, i) => {
          const opt = document.createElement('div');
          opt.className = 'weapon-ac-item';
          opt.setAttribute('role', 'option');
          opt.dataset.idx = i;
          opt.innerHTML =
            `<span class="weapon-ac-name">${esc(w.name)}</span>` +
            `<span class="weapon-ac-info">${esc(w.damage)} · ${esc(w.info)}</span>`;
          opt.addEventListener('mousedown', e => { e.preventDefault(); selectWeapon(inputEl, w); });
          weaponDropdown.appendChild(opt);
        });
        weaponDropdown.style.display = 'block';
      }

      function selectWeapon(inputEl, weapon) {
        const row = weaponCurrentRow;
        hideWeaponDropdown();
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
        row.querySelector('.atk-bonus').textContent = fmt(getStatMod(weapon.stat));
        row.querySelector('[data-f="damage"]').value = weapon.damage;
        persist();
      }

      function hideWeaponDropdown() {
        if (weaponDropdown) { weaponDropdown.remove(); weaponDropdown = null; }
        weaponMatches = [];
        weaponActiveIdx = -1;
        weaponCurrentRow = null;
      }

      function highlightWeaponActive() {
        if (!weaponDropdown) return;
        weaponDropdown.querySelectorAll('.weapon-ac-item').forEach((el, i) => {
          el.classList.toggle('active', i === weaponActiveIdx);
        });
      }

      // Delegated listeners on attack list
      const atkListEl = document.getElementById('cbt-attack-list');

      atkListEl.addEventListener('focusin', e => {
        if (e.target.matches('.atk-f[data-f="name"]')) {
          showWeaponDropdown(e.target);
          weaponCurrentRow = e.target.closest('.atk-row');
        }
      });

      atkListEl.addEventListener('input', e => {
        if (e.target.matches('.atk-f[data-f="name"]') && weaponDropdown) {
          positionWeaponDropdown(e.target);
          filterWeapons(e.target, e.target.value.trim());
        }
      });

      atkListEl.addEventListener('keydown', e => {
        if (!weaponDropdown || weaponDropdown.style.display === 'none') return;
        if (!e.target.matches('.atk-f[data-f="name"]')) return;
        const items = weaponDropdown.querySelectorAll('.weapon-ac-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          weaponActiveIdx = (weaponActiveIdx + 1) % items.length;
          highlightWeaponActive();
          items[weaponActiveIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          weaponActiveIdx = weaponActiveIdx <= 0 ? items.length - 1 : weaponActiveIdx - 1;
          highlightWeaponActive();
          items[weaponActiveIdx]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          if (weaponActiveIdx >= 0 && weaponMatches[weaponActiveIdx]) {
            e.preventDefault();
            selectWeapon(e.target, weaponMatches[weaponActiveIdx]);
          }
        } else if (e.key === 'Escape' || e.key === 'Tab') {
          hideWeaponDropdown();
        }
      });

      atkListEl.addEventListener('focusout', e => {
        setTimeout(() => { if (weaponDropdown) hideWeaponDropdown(); }, 120);
      });

      document.addEventListener('click', e => {
        if (weaponDropdown && !weaponDropdown.contains(e.target) &&
            !e.target.matches('.atk-f[data-f="name"]')) {
          hideWeaponDropdown();
        }
      });

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
          const bonusVal = fmt(getStatMod(stat));
          row.innerHTML =
            `<input class="atk-f" placeholder="Weapon"  value="${esc(atk.name)}"   data-f="name"   />` +
            `<select class="atk-stat" title="Attack stat">` +
              `<option value="STR"${stat === 'STR' ? ' selected' : ''}>STR</option>` +
              `<option value="DEX"${stat === 'DEX' ? ' selected' : ''}>DEX</option>` +
            `</select>` +
            `<span class="atk-bonus">${bonusVal}</span>` +
            `<input class="atk-f" placeholder="1d6" value="${esc(atk.damage)}" data-f="damage" />` +
            `<div class="atk-row-btns">` +
              `<button class="btn-roll"  title="Roll attack &amp; damage">🎲</button>` +
              `<button class="btn-trash" title="Remove attack">🗑</button>` +
            `</div>` +
            `<div class="atk-result"></div>`;

          row.querySelectorAll('input[data-f]').forEach(inp => {
            inp.addEventListener('input', () => { atk[inp.dataset.f] = inp.value; persist(); });
          });

          const statSel  = row.querySelector('.atk-stat');
          const bonusSpn = row.querySelector('.atk-bonus');
          statSel.addEventListener('change', () => {
            atk.stat = statSel.value;
            bonusSpn.textContent = fmt(getStatMod(statSel.value));
            persist();
          });

          row.querySelector('.btn-roll').addEventListener('click', () => rollAttack(atk, row));
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

      function rollAttack(atk, row) {
        const bonusN = getStatMod(atk.stat || 'STR');
        const bonusStr = bonusN >= 0 ? `+${bonusN}` : `${bonusN}`;
        const dmg  = atk.damage || '1d4';
        const name = atk.name || 'Attack';

        if (window.TS && window.TS.dice && typeof window.TS.dice.putDiceInTray === 'function') {
          window.TS.dice.putDiceInTray([
            { notation: `1d20${bonusStr}`, label: `${name} — hit` },
            { notation: dmg,              label: `${name} — dmg` }
          ]);
          return;
        }

        const d20      = Math.ceil(Math.random() * 20);
        const total    = d20 + bonusN;
        const dmgTotal = rollDice(dmg);
        const bonusFmt = bonusStr;

        const resultEl = row.querySelector('.atk-result');
        resultEl.textContent = `${name}: hit ${total} (d20=${d20}${bonusFmt}) — dmg ${dmgTotal}`;
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

          item.innerHTML =
            `<div class="spell-hdr">` +
              `<span class="spell-toggle">▶</span>` +
              `<input class="spell-name-inp" placeholder="Spell name" value="${esc(sp.name)}" />` +
              `<span class="spell-tier-badge">T${sp.tier || 1}</span>` +
              `<button class="btn-trash" title="Remove spell">🗑</button>` +
            `</div>` +
            `<div class="spell-body">` +
              `<div class="spell-meta-row">` +
                `<label>Tier<input type="number" class="sp-tier" min="1" max="9" value="${sp.tier || 1}" inputmode="numeric" /></label>` +
                `<label>Range<input class="sp-range" placeholder="Near" value="${esc(sp.range)}" /></label>` +
                `<label>Duration<input class="sp-dur" placeholder="Instant" value="${esc(sp.duration)}" /></label>` +
              `</div>` +
              `<textarea class="spell-desc-ta" placeholder="Description">${esc(sp.desc)}</textarea>` +
            `</div>`;

          const hdr    = item.querySelector('.spell-hdr');
          const body   = item.querySelector('.spell-body');
          const toggle = item.querySelector('.spell-toggle');
          const badge  = item.querySelector('.spell-tier-badge');

          hdr.addEventListener('click', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            const open = body.style.display === 'block';
            body.style.display = open ? 'none' : 'block';
            toggle.textContent  = open ? '▶' : '▼';
          });

          item.querySelector('.spell-name-inp').addEventListener('input', e => { sp.name = e.target.value; persist(); });
          item.querySelector('.sp-tier').addEventListener('input', e => {
            sp.tier = parseInt(e.target.value) || 1;
            badge.textContent = `T${sp.tier}`;
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
    })();
  
    // ── Theme selector ─────────────────────────────────
    (function() {
      const THEME_KEY = 'sd_theme';
      const btn      = document.getElementById('theme-btn');
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

      function togglePopover(open) {
        popover.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = popover.classList.contains('open');
        togglePopover(!isOpen);
      });

      document.addEventListener('click', function(e) {
        if (!popover.contains(e.target) && e.target !== btn) {
          togglePopover(false);
        }
      });

      swatches.forEach(swatch => {
        swatch.addEventListener('click', function() {
          applyTheme(this.dataset.theme);
          togglePopover(false);
        });
      });

      // Restore saved theme — already inside async boot(), storage is ready
      const saved = StorageAdapter.getItem(THEME_KEY) || 'dungeon';
      applyTheme(saved);
    })();

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

    })(); // end boot()
  