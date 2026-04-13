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
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    function saveCharacter(data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('Could not save character data:', e);
      }
    }

    window.SD = { loadCharacter, saveCharacter };
    window.SD.character = loadCharacter();

    // ── CORE tab ───────────────────────────────────────
    const ABILITY_STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

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

      input.addEventListener('input', () => {
        const mod = abilityMod(input.value);
        modEl.textContent = fmtMod(mod);
        coreAutoSave();
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
    ['char-name','char-class','char-level','char-xp','char-xp-next',
     'hp-current','hp-max','luck-tokens'].forEach(id => {
      document.getElementById(id).addEventListener('input', coreAutoSave);
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

    // ── Portrait ─────────────────────────────────────────
    (function () {
      const PORTRAIT_KEY = 'sd_char_portrait';
      const frame = document.getElementById('portrait-frame');
      const img = document.getElementById('portrait-img');
      const placeholder = document.getElementById('portrait-placeholder');
      const clearBtn = document.getElementById('portrait-clear');
      const fileInput = document.getElementById('portrait-file');

      function loadPortrait() {
        const data = localStorage.getItem(PORTRAIT_KEY);
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
          localStorage.setItem(PORTRAIT_KEY, dataUrl);
        } catch (e) {
          console.warn('Could not save portrait:', e);
        }
      }

      function clearPortrait() {
        localStorage.removeItem(PORTRAIT_KEY);
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

      frame.addEventListener('click', (e) => {
        if (e.target === clearBtn) return;
        fileInput.click();
      });

      frame.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          fileInput.click();
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFile(e.target.files[0]);
        }
        fileInput.value = '';
      });

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
          item.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 8);
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
        }
      });

      document.getElementById('inv-list').addEventListener('input', (e) => {
        if (e.target.classList.contains('inv-item-name') && activeDropdown) {
          const rect = e.target.getBoundingClientRect();
          activeDropdown.style.top = rect.bottom + 'px';
          activeDropdown.style.left = rect.left + 'px';
          activeDropdown.style.width = rect.width + 'px';
          const val = e.target.value.trim();
          if (val.length > 0) {
            renderMatches(e.target, activeDropdown, val);
          } else {
            hideDropdown();
          }
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
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIdx = activeIdx <= 0 ? items.length - 1 : activeIdx - 1;
          highlightActive(activeDropdown);
        } else if (e.key === 'Enter') {
          if (activeIdx >= 0 && matches[activeIdx]) {
            e.preventDefault();
            selectItem(e.target, matches[activeIdx]);
          }
        } else if (e.key === 'Escape') {
          hideDropdown();
        }
      });

      document.addEventListener('click', (e) => {
        if (activeDropdown && !activeDropdown.contains(e.target) &&
            !e.target.classList.contains('inv-item-name')) {
          hideDropdown();
        }
      });
    }

    initInventoryAutocomplete();

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

        // Bonus slots (Hauler talent / DM ruling)
        const bonusSlots = parseFloat(document.getElementById('enc-bonus').value) || 0;

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
          <input type="number" class="inv-item-slots"  min="0" step="0.5" value="${data.slots}" />
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
        });
      });
      ['gear-mithral', 'gear-shield'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
          collectAndSave();
          updateEncumbrance();
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

      const CLASS_FEATURES = {
        fighter: [
          { name: 'Weapon Mastery', desc: 'Choose a weapon. Gain +1 to attack and damage with that weapon. At every odd level, choose another weapon to master.' },
          { name: 'Combat Superiority', desc: 'When you roll a natural 19–20 on an attack, you may attempt a combat maneuver (disarm, knockdown, etc.) in addition to dealing damage.' },
        ],
        thief: [
          { name: 'Backstab', desc: 'When you attack a creature who is unaware of you or who is flanked by an ally, deal +1d6 damage per every 3 character levels.' },
          { name: 'Thievery', desc: 'You know how to pick locks, disarm traps, move silently, and perform other roguish skills. Roll Dex + Level for thievery checks.' },
          { name: 'Sneak Attack', desc: 'Once per round, when you have advantage on an attack roll, you may add +1d6 damage to the hit.' },
        ],
        wizard: [
          { name: 'Spellcasting', desc: 'You cast arcane spells. Roll Int + Level vs. DC 12 to cast. On failure, the spell is lost but not spent.' },
          { name: 'Learning Spells', desc: 'When you gain a level or find a scroll/spellbook, you may attempt to learn new spells (Int check, DC 12).' },
          { name: 'Spell Loss on 1', desc: 'When you roll a natural 1 on a spellcasting check, you lose the spell and suffer 1d4 damage.' },
        ],
        priest: [
          { name: 'Deity', desc: "You serve a god. Your powers flow from your faith. Betraying your deity's tenets may cost you spellcasting until atonement." },
          { name: 'Turn Undead', desc: 'Roll Cha + Level (DC 12 per HD of the undead). On success, the undead flee or are destroyed for 1 round per level.' },
          { name: 'Spellcasting', desc: 'You cast divine spells. Roll Wis + Level vs. DC 12 to cast. On failure, the spell is not lost.' },
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
        
        TALENT_LEVELS.forEach((talentLvl, i) => {
          const earned = level >= talentLvl;
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
        document.getElementById('char-class').addEventListener('input', (e) => {
          renderFeatures(e.target.value);
          updateDeityVisibility(e.target.value);
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
        if (!cb.speed)                          cb.speed = '30 ft';
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

      // ── AC / Speed / Initiative ──────────────────────────
      function initStats() {
        const cb = getCombat();

        const acEl = document.getElementById('cbt-ac');
        acEl.value = cb.ac;
        acEl.addEventListener('input', () => { getCombat().ac = parseInt(acEl.value) || 0; persist(); });

        const spEl = document.getElementById('cbt-speed');
        spEl.value = cb.speed;
        spEl.addEventListener('input', () => { getCombat().speed = spEl.value; persist(); });

        refreshInit();
      }

      function refreshInit() {
        document.getElementById('cbt-init').textContent = fmt(getStatMod('DEX'));
      }

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
          const stat = atk.stat || 'STR';
          const bonusVal = atk.bonus != null && atk.bonus !== '' ? atk.bonus : String(getStatMod(stat));
          row.innerHTML =
            `<input class="atk-f" placeholder="Weapon"  value="${esc(atk.name)}"   data-f="name"   />` +
            `<select class="atk-stat" title="Attack stat">` +
              `<option value="STR"${stat === 'STR' ? ' selected' : ''}>STR</option>` +
              `<option value="DEX"${stat === 'DEX' ? ' selected' : ''}>DEX</option>` +
            `</select>` +
            `<input class="atk-f" placeholder="0"   value="${esc(bonusVal)}"  data-f="bonus"  inputmode="numeric" />` +
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
          const bonusInp = row.querySelector('[data-f="bonus"]');
          statSel.addEventListener('change', () => {
            atk.stat  = statSel.value;
            atk.bonus = String(getStatMod(statSel.value));
            bonusInp.value = atk.bonus;
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
        const rawBonus = String(atk.bonus ?? '').replace(/\s/g, '');
        const bonusStr = /^[+-]/.test(rawBonus) ? rawBonus : (rawBonus ? `+${rawBonus}` : '+0');
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
        const bonusN   = parseInt(bonusStr) || 0;
        const total    = d20 + bonusN;
        const dmgTotal = rollDice(dmg);
        const bonusFmt = bonusN >= 0 ? `+${bonusN}` : `${bonusN}`;

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
          getCombat().attacks.push({ id: uid(), name: '', stat, bonus: String(getStatMod(stat)), damage: '' });
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
        localStorage.setItem(THEME_KEY, theme);
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

      // Restore saved theme on DOMContentLoaded (default: dungeon)
      document.addEventListener('DOMContentLoaded', function() {
        const saved = localStorage.getItem(THEME_KEY) || 'dungeon';
        applyTheme(saved);
      });
    })();
  