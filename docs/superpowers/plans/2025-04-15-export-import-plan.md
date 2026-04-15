# Export/Import Character Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clipboard-based export/import for character data, consolidating the top-right buttons into a single settings menu.

**Architecture:** Replace two fixed-position buttons (`#guide-reopen`, `#theme-btn`) with a single menu button + dropdown. Add export (clipboard write) and import (paste textarea + modal) features. Include a version stamp and migration registry for future-proofing. All changes are in the 3 existing files: `index.html`, `style.css`, `script.js`.

**Tech Stack:** Vanilla HTML/CSS/JS (no dependencies), TaleSpire Symbiote API (`TS.system.clipboard.setText`, `TS.localStorage`)

**Spec:** `docs/superpowers/specs/2025-04-15-export-import-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | Remove `#guide-reopen` + `#theme-btn` buttons. Add `#menu-btn` + `#menu-dropdown`. Add import modal + confirmation dialog + toast markup. Keep `#theme-popover` and `#creation-guide` as-is (just re-wired). Preserve `<span id="app-version">`. |
| `style.css` | Remove `#guide-reopen` + `#theme-btn` styles. Add `#menu-btn`, `#menu-dropdown`, `.import-modal`, `.import-confirm`, `.toast` styles. |
| `script.js` | Add `APP_VERSION` constant, `compareSemver()`, `MIGRATIONS` array, `runMigrations()`, `copyToClipboard()`, `exportCharacter()`, `importCharacter()` functions. Add menu toggle logic. Rewire theme selector and guide reopen to use menu items. |

---

### Task 1: HTML — Replace top-right buttons with menu button + dropdown

**Files:**
- Modify: `index.html:350-382`

- [ ] **Step 1: Replace the guide-reopen button, theme-btn button, and theme-popover with the new menu structure**

In `index.html`, replace lines 350–382 (the `<!-- ── Theme selector -->` comment through the closing `</div>` of `#theme-popover`) with:

```html
  <!-- ── Settings menu ───────────────────────────────── -->
  <button id="menu-btn" aria-label="Settings menu" aria-expanded="false" aria-controls="menu-dropdown">
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M234.875 18.78c-29.01 3.423-56.727 22.8-61.563 52.876l-1.687 10.5l-10.25 2.75c-11.59 3.112-22.704 7.22-33.22 12.22l-9.56 4.562l-7.97-6.782c-22.252-18.937-52.103-22.267-73.28-1.094l-.002.002c-21.18 21.173-17.846 51.024 1.094 73.28l6.78 7.97l-4.56 9.562c-4.998 10.514-9.107 21.63-12.218 33.22l-2.75 10.25l-10.5 1.686C-4.564 233.728-6.86 262.89 18.78 277.125l.002.002l9.375 5.22l.812 10.624c.893 11.788 2.894 23.285 5.936 34.374l2.72 9.906l-5.938 8.5c-16.545 23.69-14.578 52.924 9.938 69.78c24.518 16.86 53.456 7.906 73.063-10.06l7.062-6.44l9.72 3.845c11.05 4.368 22.565 7.76 34.468 10.063l10.375 2l3 10.125c8.38 28.34 33.717 42.218 65.5 37.656c29.01-3.424 56.725-22.8 61.562-52.876l1.688-10.5l10.25-2.75c11.59-3.112 22.672-7.22 33.186-12.22l9.563-4.56l7.97 6.78c22.252 18.937 52.104 22.267 73.28 1.093c21.18-21.174 17.846-51.025-1.094-73.28l-6.78-7.97l4.563-9.562c4.997-10.515 9.105-21.63 12.217-33.22l2.75-10.25l10.5-1.686c30.075-4.836 32.373-33.998 6.53-48.233l-.002-.002l-9.374-5.188l-.813-10.625c-.892-11.787-2.893-23.284-5.936-34.374l-2.72-9.906l5.94-8.5c16.544-23.69 14.577-52.925-9.94-69.78c-24.517-16.86-53.454-7.907-73.06 10.06l-7.064 6.438l-9.72-3.844c-11.05-4.37-22.564-7.76-34.467-10.063l-10.375-2l-3-10.125c-8.38-28.34-33.716-42.216-65.5-37.655zM256 176c44.183 0 80 35.817 80 80s-35.817 80-80 80s-80-35.817-80-80s35.817-80 80-80z"/></svg>
  </button>
  <div id="menu-dropdown" role="menu" aria-label="Settings">
    <button class="menu-item" role="menuitem" id="menu-theme">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M263.844 40.344C234.1 213.202 145.594 248.03 145.594 369.22c0 60.804 60.106 105.5 118.25 105.5c59.45 0 115.937-41.803 115.937-99.533c0-116.332-85.2-162.312-115.936-334.843zm-58.28 217.094c-27.963 75.53-5.105 154.567 54.25 179.375c15.185 6.348 31.724 7.714 47.905 6.28c-116.134 49.787-185.836-79.816-102.158-185.656z"/></svg>
      Theme
    </button>
    <button class="menu-item" role="menuitem" id="menu-guide">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M476.72 51.375c-5.28 30.185-124.992 107.9-82.47 16.875c-80.216 45.38-107.557 23.42-78.53-5.656c-54.825 2.8-62.753 88.173-55.345 112.406l17.438 19.125c-2.14-31.218.404-48.445 19.5-71.47c13.764 20.614 18.495 33.702 52.062 6.97c-9.393 53.52 54.61 18.747 88.75 10.938c-15.248 14.048-35.153 32.723-38.875 55.468c-1.24 7.587 6.208 17.925 14.125 25.626c-9.443 2.236-41.474 8.91-38.563 26.22c2.912 17.31 12.14 11.885 3.5 15.28c-12.403 2.766-21.156 5.58-39.593-2.187l18.874 20.717c28.39 14.79 73.904 7.306 83.594-14.875c-14.778-1.22-27.125-4.674-33-11.53c44.022-8.34 66.764-39.243 85.78-75.032c-33.638 18.95-42.158 17.784-56 16.313c35.514-14.365 46.876-108.943 38.75-145.188zM246.874 186.063l-56.78 70.125l79.186 86.906l75.095-50l-97.5-107.03zm-62.344 90.125L21.657 467.625l21.438 23.53l205.75-144.374l-64.313-70.592z"/></svg>
      Guide
    </button>
    <hr class="menu-divider" />
    <button class="menu-item" role="menuitem" id="menu-export">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5v2zm7-18l-5.5 7h4v6h3v-6h4L12 2z"/></svg>
      Export Character
    </button>
    <button class="menu-item" role="menuitem" id="menu-import">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5v2zm7-2l5.5-7h-4V5h-3v6h-4l5.5 7z"/></svg>
      Import Character
    </button>
    <span id="app-version">v0.5.3</span>
  </div>
  <div id="theme-popover" role="dialog" aria-label="Theme selection">
    <span class="theme-popover-title">Theme</span>
    <div class="theme-swatches">
      <button class="theme-swatch" data-theme="dungeon" aria-pressed="true" title="Dungeon">
        <span class="theme-swatch-circle" style="background:#1a1510; border:1px solid #2a2520;"></span>
        <span class="theme-swatch-label">Dungeon</span>
      </button>
      <button class="theme-swatch" data-theme="parchment" aria-pressed="false" title="Parchment">
        <span class="theme-swatch-circle" style="background:#f2e8cc; border:1px solid #c8b080;"></span>
        <span class="theme-swatch-label">Parchment</span>
      </button>
      <button class="theme-swatch" data-theme="blood-moon" aria-pressed="false" title="Blood Moon">
        <span class="theme-swatch-circle" style="background:#3d0808; border:1px solid #5a1010;"></span>
        <span class="theme-swatch-label">Blood Moon</span>
      </button>
      <button class="theme-swatch" data-theme="talespire" aria-pressed="false" title="TaleSpire">
        <span class="theme-swatch-circle" style="background:#1a1714; border:1px solid #e07830;"></span>
        <span class="theme-swatch-label">TaleSpire</span>
      </button>
      <button class="theme-swatch" data-theme="frostgrave" aria-pressed="false" title="Frostgrave">
        <span class="theme-swatch-circle" style="background:#080c14; border:1px solid #6aaad4;"></span>
        <span class="theme-swatch-label">Frostgrave</span>
      </button>
      <button class="theme-swatch" data-theme="arcane" aria-pressed="false" title="Arcane">
        <span class="theme-swatch-circle" style="background:#0c0812; border:1px solid #9b59b6;"></span>
        <span class="theme-swatch-label">Arcane</span>
      </button>
    </div>
  </div>
```

Note: `<span id="app-version">v0.5.3</span>` is now inside `#menu-dropdown` instead of `#theme-popover`. The `id` and `vX.Y.Z` format are preserved for `deploy-modio.sh` compatibility.

- [ ] **Step 2: Add import modal and toast markup before the closing `</body>` tag**

Insert before `<script src="script.js"></script>` (line 397 of the original file):

```html
  <!-- ── Import modal ────────────────────────────────── -->
  <div id="import-modal" class="import-overlay" hidden>
    <div class="import-card">
      <h2 class="import-title">Import Character</h2>
      <textarea id="import-textarea" class="import-textarea" placeholder="Paste your character backup here..."></textarea>
      <div id="import-error" class="import-error" hidden></div>
      <div class="import-actions">
        <button id="import-cancel" class="import-btn import-btn--cancel">Cancel</button>
        <button id="import-submit" class="import-btn import-btn--submit" disabled>Import</button>
      </div>
    </div>
  </div>

  <!-- ── Import confirmation ─────────────────────────── -->
  <div id="import-confirm" class="import-overlay" hidden>
    <div class="import-card import-card--narrow">
      <p id="confirm-message" class="confirm-message"></p>
      <div class="import-actions">
        <button id="confirm-cancel" class="import-btn import-btn--cancel">Cancel</button>
        <button id="confirm-replace" class="import-btn import-btn--danger">Replace</button>
      </div>
    </div>
  </div>

  <!-- ── Toast notification ──────────────────────────── -->
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
```

- [ ] **Step 3: Verify the HTML is valid**

Open `index.html` in a browser. Confirm the page loads without console errors (script.js will have runtime errors since the JS isn't updated yet — that's expected). Visually confirm the old guide-reopen and theme-btn buttons are gone.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: replace top-right buttons with settings menu + add import modal markup"
```

---

### Task 2: CSS — Menu button, dropdown, modal, and toast styles

**Files:**
- Modify: `style.css:240-388`

- [ ] **Step 1: Replace `#guide-reopen` styles with `#menu-btn` styles**

Replace the `#guide-reopen` block (lines 240–270) with:

```css
#menu-btn {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 100;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--surface);
  border: 1.5px solid var(--border);
  color: var(--muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  transition: color 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s;
}
#menu-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: scale(1.12);
  box-shadow: 0 3px 14px rgba(0,0,0,0.5);
}
#menu-btn[aria-expanded="true"] {
  color: var(--accent);
  border-color: var(--accent);
  transform: scale(1.06);
}
#menu-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
```

- [ ] **Step 2: Remove the `#theme-btn` styles**

Delete the entire `/* ── Theme selector */` comment and `#theme-btn` block (lines 272–308 of the original file):

```css
/* ── Theme selector ─────────────────────────────────── */
#theme-btn { ... }
#theme-btn:hover { ... }
#theme-btn[aria-expanded="true"] { ... }
#theme-btn:focus-visible { ... }
```

- [ ] **Step 3: Add `#menu-dropdown` styles**

Insert right after the `#menu-btn:focus-visible` block:

```css
/* ── Settings dropdown ─────────────────────────────── */
#menu-dropdown {
  display: none;
  position: fixed;
  top: 46px;
  right: 10px;
  z-index: 99;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px 0;
  box-shadow: 0 4px 20px rgba(0,0,0,0.65);
  min-width: 170px;
}
#menu-dropdown.open { display: block; }

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  background: none;
  border: none;
  color: var(--fg);
  font-family: var(--font-hdr);
  font-size: 0.82rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, color 0.12s;
}
.menu-item:hover {
  background: rgba(255,255,255,0.06);
  color: var(--accent);
}
.menu-item svg {
  flex-shrink: 0;
  opacity: 0.7;
}
.menu-item:hover svg {
  opacity: 1;
}
.menu-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 4px 12px;
}

#menu-dropdown #app-version {
  display: block;
  font-family: var(--font-num);
  font-size: 0.6rem;
  color: var(--muted);
  text-align: center;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
  letter-spacing: 0.05em;
}
```

- [ ] **Step 4: Remove the standalone `#app-version` style block**

Delete the old `#app-version` block (lines 380–388 of the original file) since it's now scoped inside `#menu-dropdown #app-version`.

```css
#app-version {
  display: block;
  font-family: var(--font-num);
  font-size: 0.65rem;
  color: var(--muted);
  text-align: center;
  margin-top: 8px;
  letter-spacing: 0.05em;
}
```

- [ ] **Step 5: Add import modal, confirmation dialog, and toast styles**

Append after the theme-switching block (after line ~393 of the original, but the exact position will have shifted):

```css
/* ── Import modal ──────────────────────────────────── */
.import-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 12px;
}
.import-overlay[hidden] { display: none; }

.import-card {
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 12px;
  max-width: 420px;
  width: 100%;
  padding: 24px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.65);
}
.import-card--narrow {
  max-width: 320px;
  text-align: center;
}

.import-title {
  font-family: var(--font-hdr);
  font-size: 1.2rem;
  color: var(--accent);
  margin: 0 0 16px;
}

.import-textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: var(--font-num);
  font-size: 0.78rem;
  resize: vertical;
  box-sizing: border-box;
}
.import-textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.import-error {
  color: #e74c3c;
  font-size: 0.8rem;
  margin-top: 8px;
}
.import-error[hidden] { display: none; }

.import-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.import-btn {
  padding: 8px 18px;
  border-radius: 6px;
  font-family: var(--font-hdr);
  font-size: 0.82rem;
  cursor: pointer;
  border: 1px solid var(--border);
  transition: background 0.15s, color 0.15s;
}
.import-btn--cancel {
  background: var(--surface);
  color: var(--muted);
}
.import-btn--cancel:hover {
  color: var(--fg);
}
.import-btn--submit {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}
.import-btn--submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.import-btn--submit:not(:disabled):hover {
  filter: brightness(1.15);
}
.import-btn--danger {
  background: #c0392b;
  color: #fff;
  border-color: #c0392b;
}
.import-btn--danger:hover {
  filter: brightness(1.15);
}

.confirm-message {
  font-size: 0.92rem;
  line-height: 1.5;
  margin: 0 0 8px;
}
.confirm-message strong {
  color: var(--accent);
}

/* ── Toast ─────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 300;
  background: var(--surface);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 20px;
  font-family: var(--font-hdr);
  font-size: 0.82rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}
.toast.show {
  opacity: 1;
}
.toast[hidden] { display: none; }
.toast--error {
  border-color: #c0392b;
  color: #e74c3c;
}
```

- [ ] **Step 6: Open in browser and verify styling**

Open `index.html` in a browser. The menu button should appear in the top-right. The old theme and guide buttons should be gone. The dropdown, modal, and toast won't be functional yet (JS not updated), but the CSS should load without errors.

- [ ] **Step 7: Commit**

```bash
git add style.css
git commit -m "feat: add CSS for settings menu, import modal, and toast"
```

---

### Task 3: JS — Version utilities and migration registry

**Files:**
- Modify: `script.js` (insert after the PortraitStore IIFE, before the boot function)

- [ ] **Step 1: Add the APP_VERSION constant, compareSemver, and MIGRATIONS array**

Insert after the `PortraitStore` IIFE closing (after line 193 `return { init, get, set, remove, migrateFromCampaignBlob };`) and its closing `})();`, add:

```javascript
    // ── Version utilities ───────────────────────────────
    const APP_VERSION = '0.5.3';

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
```

- [ ] **Step 2: Verify syntax**

Open `index.html` in a browser. Confirm no JS syntax errors in the console. The constants are defined but not yet used — that's fine.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add APP_VERSION, compareSemver, and migration registry"
```

---

### Task 4: JS — Clipboard helper, export, and toast

**Files:**
- Modify: `script.js` (insert inside the `boot()` async function, after the theme selector IIFE)

- [ ] **Step 1: Add copyToClipboard and showToast helpers, and the exportCharacter function**

Insert after the theme selector IIFE closing `})();` (after line 1929 of the original file), add:

```javascript
    // ── Toast notification ─────────────────────────────
    function showToast(message, isError) {
      const el = document.getElementById('toast');
      el.textContent = message;
      el.classList.toggle('toast--error', !!isError);
      el.hidden = false;
      // Force reflow so transition triggers
      void el.offsetWidth;
      el.classList.add('show');
      setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => { el.hidden = true; }, 300);
      }, 2000);
    }

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
        showToast('Failed to copy — please try again', true);
      }
    }
```

- [ ] **Step 2: Verify by testing in browser**

Open `index.html` in a browser. Open the dev console and run `exportCharacter()`. Check that the clipboard contains valid JSON with `_version`, `_exportedAt`, `character`, `portrait`, and `theme` fields.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add clipboard helper, toast, and export function"
```

---

### Task 5: JS — Import character function

**Files:**
- Modify: `script.js` (insert right after the `exportCharacter` function)

- [ ] **Step 1: Add the importCharacter function**

Insert right after the `exportCharacter` function:

```javascript
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
        const charName = data.character.name || '';
        confirmMsg.innerHTML = charName
          ? 'This will replace <strong>' + charName.replace(/</g, '&lt;') + '</strong>. Continue?'
          : 'This will replace your current character data. Continue?';
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
```

- [ ] **Step 2: Verify import modal opens**

Open `index.html` in a browser console and run `importCharacter()`. Verify the modal appears with a textarea, Cancel button, and disabled Import button. Type something and confirm Import becomes enabled. Click Cancel to close.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add import character function with validation and migration"
```

---

### Task 6: JS — Menu toggle logic (wire everything together)

**Files:**
- Modify: `script.js:1884-1929` (theme selector IIFE) and `script.js:1948-1967` (guide IIFE)

- [ ] **Step 1: Rewrite the theme selector IIFE to work via the menu**

Replace the entire theme selector IIFE (lines 1884–1929) with:

```javascript
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
```

- [ ] **Step 2: Rewrite the guide IIFE to remove reference to `#guide-reopen`**

Replace the Character Creation Guide IIFE (lines 1948–1967) with:

```javascript
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
```

- [ ] **Step 3: Add the menu toggle IIFE after the guide IIFE**

Insert right before the `})(); // end boot()` closing:

```javascript
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

      // Theme — open popover, close dropdown
      document.getElementById('menu-theme').addEventListener('click', function() {
        toggleMenu(false);
        window._toggleThemePopover(true);
      });

      // Guide — open guide, close dropdown
      document.getElementById('menu-guide').addEventListener('click', function() {
        toggleMenu(false);
        window._openGuide();
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
    })();
```

- [ ] **Step 4: Full browser test**

Open `index.html` in a browser. Test the complete flow:
1. Click the gear icon — dropdown should appear with Theme, Guide, Export Character, Import Character
2. Click "Theme" — dropdown closes, theme popover opens with swatches
3. Click a swatch — theme changes, popover closes
4. Click gear → "Guide" — guide overlay opens
5. Click gear → "Export Character" — toast shows "Character copied to clipboard"
6. Verify clipboard contains valid JSON with `_version`, `_exportedAt`, `character`, `portrait`, `theme`
7. Click gear → "Import Character" — import modal opens
8. Paste the exported JSON — Import button enables
9. Click Import — confirmation dialog appears
10. Click Replace — toast shows success, page reloads

- [ ] **Step 5: Commit**

```bash
git add script.js
git commit -m "feat: wire settings menu with theme, guide, export, and import"
```

---

### Task 7: Verify deployment scripts

**Files:**
- No file changes — verification only

- [ ] **Step 1: Run deploy.sh (local deploy)**

```bash
./deploy.sh
```

Expected: copies `index.html`, `script.js`, `style.css`, `manifest.json` to `~/Library/Application Support/com.bouncyrock.talespire/Symbiotes/the Dark Spire/`. Should print "Deployed to: ..." and list the files. If the TaleSpire Symbiotes directory doesn't exist, the script will create it.

- [ ] **Step 2: Verify deploy-modio.sh version regex still works**

Test that the perl regex in `deploy-modio.sh` can find the `<span id="app-version">` element in the updated `index.html`:

```bash
perl -ne 'print if /id="app-version"/' index.html
```

Expected output: a line containing `<span id="app-version">v0.5.3</span>`.

Also test the substitution pattern (dry run, does not modify the file):

```bash
perl -pe 's|(<span id="app-version">)v[\d.]+|${1}v9.9.9|' index.html | perl -ne 'print if /app-version/'
```

Expected output: `<span id="app-version">v9.9.9</span>`

- [ ] **Step 3: Commit (no changes expected — this is verification only)**

If any fixes were needed, commit them:

```bash
git add -A && git commit -m "fix: adjust markup for deploy script compatibility"
```

---

### Task 8: Final integration test

**Files:**
- No file changes — testing only

- [ ] **Step 1: Test export/import round-trip in browser**

1. Open `index.html` in a browser
2. Fill in some character data (name, class, stats, add an item, set a portrait)
3. Click gear → Export Character
4. Open a new tab with `index.html` (or clear localStorage and reload)
5. Click gear → Import Character
6. Paste the JSON, click Import, confirm Replace
7. Verify all data matches: name, class, stats, inventory, portrait, theme

- [ ] **Step 2: Test import validation — invalid JSON**

1. Click gear → Import Character
2. Paste `this is not json`
3. Click Import
4. Expected: error "Invalid backup data — make sure you pasted the complete export."

- [ ] **Step 3: Test import validation — missing character field**

1. Click gear → Import Character
2. Paste `{"_version": "0.5.3", "theme": "dungeon"}`
3. Click Import
4. Expected: error "This doesn't look like a Dark Spire backup."

- [ ] **Step 4: Test import validation — newer version**

1. Click gear → Import Character
2. Paste `{"_version": "99.0.0", "character": {}}`
3. Click Import
4. Expected: error "This backup was made with a newer version (v99.0.0). Please update The Dark Spire first."

- [ ] **Step 5: Test cancel flows**

1. Open import modal → click Cancel → modal closes
2. Open import modal → paste valid JSON → click Import → confirmation shows → click Cancel → both close

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix: address issues found during integration testing"
```
