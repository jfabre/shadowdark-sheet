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

    // Luck tokens — update note visibility based on ancestry
    function updateLuckNote() {
      const ancestry = document.getElementById('char-ancestry').value;
      const note = document.getElementById('luck-note');
      note.style.opacity = ancestry === 'Halfling' ? '1' : '0.35';
    }
    document.getElementById('char-ancestry').addEventListener('change', () => {
      updateLuckNote();
      coreAutoSave();
    });

    // Roll HP button
    document.getElementById('roll-hp-btn').addEventListener('click', () => {
      const conMod = abilityMod(document.getElementById('ability-con').value);
      try {
        if (typeof TS !== 'undefined' && TS.dice && TS.dice.putDiceInTray) {
          TS.dice.putDiceInTray([{ sides: 8, count: 1, modifier: conMod }], true);
        } else {
          // Fallback: simple local roll
          const roll = Math.floor(Math.random() * 8) + 1 + conMod;
          const hp = Math.max(1, roll);
          const current = document.getElementById('hp-current');
          current.value = hp;
          coreAutoSave();
        }
      } catch (e) {
        console.warn('TS.dice unavailable:', e);
      }
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

      updateLuckNote();
    }

    coreLoad();
  
    // ── GEAR TAB ────────────────────────────────────────
    (function () {
      const GEAR_DEFAULTS = {
        gp: 0, sp: 0, cp: 0,
        armorName: '', armorAc: 0,
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
        return (window.SD.character.core && window.SD.character.core.str)
          ? Number(window.SD.character.core.str) || 10
          : 10;
      }

      // ── Encumbrance bar ──────────────────────────────
      function updateEncumbrance() {
        const rows = document.querySelectorAll('#inv-list .inv-row');
        let used = 0;
        rows.forEach(row => {
          const slots = parseFloat(row.querySelector('.inv-item-slots').value) || 0;
          used += slots;
        });
        const max = getStrMax();
        document.getElementById('enc-used').textContent = used;
        document.getElementById('enc-max').textContent = max;
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
          gp:        parseFloat(document.getElementById('gear-gp').value) || 0,
          sp:        parseFloat(document.getElementById('gear-sp').value) || 0,
          armorName: document.getElementById('gear-armor-name').value,
          armorAc:   parseFloat(document.getElementById('gear-armor-ac').value) || 0,
          torches:   parseInt(document.getElementById('gear-torches').value, 10) || 0,
          burnTime:  parseFloat(document.getElementById('gear-burn-time').value) || 0,
          inventory: collectInventory()
        });
      }

      // ── Render from saved data ───────────────────────
      function renderGear() {
        const gear = getGear();

        document.getElementById('gear-gp').value       = gear.gp;
        document.getElementById('gear-sp').value       = gear.sp;
        document.getElementById('gear-armor-name').value = gear.armorName;
        document.getElementById('gear-armor-ac').value = gear.armorAc;
        document.getElementById('gear-torches').value  = gear.torches;
        document.getElementById('gear-burn-time').value = gear.burnTime;

        const list = document.getElementById('inv-list');
        list.innerHTML = '';
        (gear.inventory || []).forEach(item => {
          list.appendChild(createInvRow(item));
        });

        updateEncumbrance();
      }

      // ── Wire top-level inputs ────────────────────────
      ['gear-gp','gear-sp','gear-armor-name','gear-armor-ac',
       'gear-torches','gear-burn-time'].forEach(id => {
        document.getElementById(id).addEventListener('input', collectAndSave);
      });

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
      const TALENT_LEVELS = [2, 4, 6, 8, 10];

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
        const saved = load('talents', ['', '', '', '', '']);

        list.innerHTML = '';
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
            const talents = load('talents', ['', '', '', '', '']);
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

        // Read class/level from Core (single source of truth)
        const currentClass = window.SD.character.class || '';
        const currentLevel = Number(window.SD.character.level) || 0;

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
          renderTalents(parseInt(e.target.value, 10) || 0);
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
      const SAVES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

      function getCombat() {
        const c = window.SD.character;
        if (!c.combat) c.combat = {};
        const cb = c.combat;
        if (cb.ac == null)                      cb.ac = 10;
        if (!cb.speed)                          cb.speed = '30 ft';
        if (!Array.isArray(cb.attacks))         cb.attacks = [];
        if (!Array.isArray(cb.spells))          cb.spells = [];
        if (!Array.isArray(cb.classSaves))      cb.classSaves = [];
        return cb;
      }

      function persist() { window.SD.saveCharacter(window.SD.character); }

      function getStatMod(stat) {
        const val = (window.SD.character.abilities || {})[stat.toUpperCase()] ?? 10;
        return Math.floor((val - 10) / 2);
      }

      function getLevel() { return window.SD.character.level || 1; }

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

      // ── Saving Throws ────────────────────────────────────
      function renderSaves() {
        const grid = document.getElementById('cbt-saves-grid');
        grid.innerHTML = '';
        const cb = getCombat();

        SAVES.forEach(stat => {
          const isCls  = cb.classSaves.includes(stat);
          const total  = getStatMod(stat) + (isCls ? getLevel() : 0);

          const box    = document.createElement('div');
          box.className = 'save-box';
          box.innerHTML =
            `<label class="save-label">` +
              `<input type="checkbox" ${isCls ? 'checked' : ''} />` +
              `<span class="save-stat">${stat}</span>` +
            `</label>` +
            `<span class="save-val">${fmt(total)}</span>`;

          box.querySelector('input').addEventListener('change', e => {
            const saves = getCombat().classSaves;
            if (e.target.checked) { if (!saves.includes(stat)) saves.push(stat); }
            else                  { const i = saves.indexOf(stat); if (i >= 0) saves.splice(i, 1); }
            persist();
            renderSaves();
          });

          grid.appendChild(box);
        });
      }

      // ── Boot ─────────────────────────────────────────────
      function bootCombat() {
        initStats();
        renderAttacks();
        renderSpells();
        renderSaves();

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
  