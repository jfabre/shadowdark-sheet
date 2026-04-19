# Party Panel UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a live "Party" section in the character sheet showing connected party members' portrait, name, and 3-dot health state — hidden when no party members are present.

**Architecture:** A top-level `renderPartyPanel(party)` function reads the `_partyMap` snapshot passed by `PartySync.onPartyChange` and rebuilds the `#party-list` DOM from scratch on every update. A helper `_hpState(hpCurrent, hpTotal)` maps the HP ratio to a `{ lit, cls }` descriptor used to apply CSS dot classes.

**Tech Stack:** Vanilla JS (ES5-safe, no optional chaining), Playwright for tests, existing CSS custom-property theme.

---

## Files

| Action | Path | Purpose |
|---|---|---|
| Modify | `index.html` | Add `#party-panel` div between `.cbt-stats` and Ability Scores label |
| Modify | `style.css` | Append party panel CSS block |
| Modify | `script.js` | Add `_hpState`, `renderPartyPanel` before `boot()`; register `onPartyChange` in `boot()` |
| Create | `tests/party-panel.spec.js` | 10 Playwright tests |

---

## Task 1: HTML structure + CSS

**Files:**
- Modify: `index.html` (between line 160 `</div>` and line 162 `<!-- Ability scores … -->`)
- Modify: `style.css` (append after line 2646)

- [ ] **Step 1: Insert party panel HTML**

  In `index.html`, find the closing `</div>` of `.cbt-stats` followed immediately by the Ability Scores comment:

  ```html
        </div>
      </div>

      <!-- Ability scores 2×3 grid -->
  ```

  Insert the party panel div **between** the blank line and the comment:

  ```html
        </div>
      </div>

      <!-- Party panel (shown/hidden by JS based on PartySync.getParty()) -->
      <div id="party-panel" style="display:none">
        <div class="section-label">Party</div>
        <div id="party-list" class="party-list"></div>
      </div>

      <!-- Ability scores 2×3 grid -->
  ```

- [ ] **Step 2: Append party panel CSS to `style.css`**

  Add at the very end of the file:

  ```css
  /* ── Party Panel ─────────────────────────────────── */
  #party-panel { margin-bottom: 8px; }

  .party-list {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .party-card {
    flex: 0 0 90px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .party-portrait {
    width: 100%;
    height: 68px;
    object-fit: cover;
    display: block;
    background: var(--surface);
  }

  .party-card-info {
    padding: 5px 6px 7px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }

  .party-name {
    font-size: 0.65rem;
    letter-spacing: 0.04em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
    text-align: center;
  }

  .party-dots {
    display: flex;
    gap: 4px;
    justify-content: center;
  }

  .party-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--border);
  }

  .party-dot.lit-ok   { background: #52b96e; }
  .party-dot.lit-hurt { background: #b87c2a; }
  .party-dot.lit-crit { background: #b84040; }
  ```

- [ ] **Step 3: Run tests — must still pass (no JS changed yet)**

  ```bash
  npm test
  ```

  Expected: all 76 tests pass (party panel div exists but is inert).

- [ ] **Step 4: Commit**

  ```bash
  git add index.html style.css
  git commit -m "feat: add party panel HTML structure and CSS"
  ```

---

## Task 2: Write failing tests

**Files:**
- Create: `tests/party-panel.spec.js`

- [ ] **Step 1: Create `tests/party-panel.spec.js`**

  ```js
  const { test, expect } = require('@playwright/test');

  test.describe('Party panel', function() {
    test.beforeEach(async function({ page }) {
      await page.goto('http://localhost:3000');
    });

    // ── visibility ──────────────────────────────────────

    test('hidden when party is empty', async function({ page }) {
      var display = await page.evaluate(function() {
        renderPartyPanel({});
        return document.getElementById('party-panel').style.display;
      });
      expect(display).toBe('none');
    });

    test('visible when party has one member', async function({ page }) {
      var display = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Aldric', hpCurrent: 10, hpTotal: 12,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true }
        });
        return document.getElementById('party-panel').style.display;
      });
      expect(display).toBe('');
    });

    test('hidden again when party becomes empty', async function({ page }) {
      var display = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Aldric', hpCurrent: 10, hpTotal: 12,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true }
        });
        renderPartyPanel({});
        return document.getElementById('party-panel').style.display;
      });
      expect(display).toBe('none');
    });

    // ── card count ──────────────────────────────────────

    test('renders one card per party member', async function({ page }) {
      var count = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Aldric', hpCurrent: 10, hpTotal: 12,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true },
          c2: { clientId: 'c2', name: 'Mireth', hpCurrent: 5, hpTotal: 12,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true }
        });
        return document.querySelectorAll('.party-card').length;
      });
      expect(count).toBe(2);
    });

    // ── portrait ────────────────────────────────────────

    test('portrait src matches portraitUrl', async function({ page }) {
      var src = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Aldric', hpCurrent: 10, hpTotal: 12,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true }
        });
        return document.querySelector('.party-portrait').src;
      });
      // src is an absolute URL in the browser; check it ends with the data URI
      expect(src).toContain('data:image');
    });

    // ── name ────────────────────────────────────────────

    test('name span shows member name', async function({ page }) {
      var name = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Aldric', hpCurrent: 10, hpTotal: 12,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true }
        });
        return document.querySelector('.party-name').textContent;
      });
      expect(name).toBe('Aldric');
    });

    test('name falls back to ellipsis when name is empty string', async function({ page }) {
      var name = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: '', hpCurrent: 0, hpTotal: 0,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: false }
        });
        return document.querySelector('.party-name').textContent;
      });
      expect(name).toBe('\u2026');
    });

    // ── dots ────────────────────────────────────────────

    test('three lit-ok dots when HP > 66%', async function({ page }) {
      var classes = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Aldric', hpCurrent: 10, hpTotal: 12,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true }
        });
        return Array.from(document.querySelectorAll('.party-dot'))
          .map(function(d) { return d.className; });
      });
      expect(classes).toHaveLength(3);
      expect(classes[0]).toContain('lit-ok');
      expect(classes[1]).toContain('lit-ok');
      expect(classes[2]).toContain('lit-ok');
    });

    test('two lit-hurt dots and one unlit when HP > 33% and <= 66%', async function({ page }) {
      var classes = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Mireth', hpCurrent: 5, hpTotal: 12,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true }
        });
        return Array.from(document.querySelectorAll('.party-dot'))
          .map(function(d) { return d.className; });
      });
      expect(classes[0]).toContain('lit-hurt');
      expect(classes[1]).toContain('lit-hurt');
      expect(classes[2]).not.toContain('lit-');
    });

    test('one lit-crit dot and two unlit when HP <= 33%', async function({ page }) {
      var classes = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Grond', hpCurrent: 2, hpTotal: 14,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: true }
        });
        return Array.from(document.querySelectorAll('.party-dot'))
          .map(function(d) { return d.className; });
      });
      expect(classes[0]).toContain('lit-crit');
      expect(classes[1]).not.toContain('lit-');
      expect(classes[2]).not.toContain('lit-');
    });

    test('no lit dots when hpTotal is 0', async function({ page }) {
      var classes = await page.evaluate(function() {
        renderPartyPanel({
          c1: { clientId: 'c1', name: 'Silas', hpCurrent: 0, hpTotal: 0,
                portraitUrl: DEFAULT_PORTRAIT, portraitReady: false }
        });
        return Array.from(document.querySelectorAll('.party-dot'))
          .map(function(d) { return d.className; });
      });
      expect(classes.every(function(c) { return !c.includes('lit-'); })).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run tests — verify 10 new failures**

  ```bash
  npm test
  ```

  Expected: 76 pass, 10 fail with `ReferenceError: renderPartyPanel is not defined`.

---

## Task 3: Implement `_hpState` + `renderPartyPanel` + register callback

**Files:**
- Modify: `script.js` (insert before `// ── Boot` comment at line ~720; add one line in `boot()`)

- [ ] **Step 1: Add `_hpState` and `renderPartyPanel` before the boot IIFE**

  Find this comment in `script.js`:

  ```js
      // ── Boot ───────────────────────────────────────────
  ```

  Insert the two functions immediately before it:

  ```js
      // ── Party Panel renderer ───────────────────────────
      function _hpState(hpCurrent, hpTotal) {
        if (hpTotal <= 0) return { lit: 0, cls: '' };
        var ratio = hpCurrent / hpTotal;
        if (ratio > 0.66) return { lit: 3, cls: 'lit-ok' };
        if (ratio > 0.33) return { lit: 2, cls: 'lit-hurt' };
        return { lit: 1, cls: 'lit-crit' };
      }

      function renderPartyPanel(party) {
        var panel = document.getElementById('party-panel');
        var list  = document.getElementById('party-list');
        if (!panel || !list) return;

        var ids = Object.keys(party);
        panel.style.display = ids.length ? '' : 'none';
        if (!ids.length) return;

        list.innerHTML = '';
        ids.forEach(function(id) {
          var m = party[id];

          var card = document.createElement('div');
          card.className = 'party-card';

          var img = document.createElement('img');
          img.className = 'party-portrait';
          img.src = m.portraitUrl || DEFAULT_PORTRAIT;
          img.alt = m.name || 'Party member';
          card.appendChild(img);

          var info = document.createElement('div');
          info.className = 'party-card-info';

          var nameEl = document.createElement('span');
          nameEl.className = 'party-name';
          nameEl.textContent = m.name || '\u2026';
          info.appendChild(nameEl);

          var dotsEl = document.createElement('div');
          dotsEl.className = 'party-dots';
          var state = _hpState(m.hpCurrent, m.hpTotal);
          for (var i = 0; i < 3; i++) {
            var dot = document.createElement('div');
            dot.className = 'party-dot' + (i < state.lit ? ' ' + state.cls : '');
            dotsEl.appendChild(dot);
          }
          info.appendChild(dotsEl);

          card.appendChild(info);
          list.appendChild(card);
        });
      }

      // ── Boot ───────────────────────────────────────────
  ```

- [ ] **Step 2: Register the callback in `boot()`**

  Find this line in `boot()`:

  ```js
      PartySync.init();
  ```

  Add the registration immediately after it:

  ```js
      PartySync.init();
      PartySync.onPartyChange(renderPartyPanel);
  ```

- [ ] **Step 3: Run tests — all must pass**

  ```bash
  npm test
  ```

  Expected: **86 tests pass**, 0 fail.

- [ ] **Step 4: Commit**

  ```bash
  git add script.js tests/party-panel.spec.js
  git commit -m "feat: party panel UI with portrait cards and 3-dot health state"
  ```

---

## Task 4: Final verification + push

- [ ] **Step 1: Full clean test run**

  ```bash
  npm test
  ```

  Expected: 86 tests pass, 0 fail.

- [ ] **Step 2: Pull and push**

  ```bash
  git pull --rebase && git push
  ```
