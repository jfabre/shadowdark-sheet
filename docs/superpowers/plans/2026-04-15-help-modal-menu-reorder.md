# Help Modal + Settings Menu Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app Help modal accessible from the Settings menu, and reorder the Settings menu items to follow the pattern: reference → actions → settings → meta.

**Architecture:** The Help modal reuses the existing `import-overlay` / `import-card` modal pattern already used by the About modal — zero new CSS classes needed. A new `#menu-help` button is inserted into the Settings menu HTML, wired up in the existing Settings menu IIFE in `script.js`, following the exact same pattern as `#menu-about`. Menu items are reordered in both HTML and JS.

**Tech Stack:** Vanilla HTML/CSS/JS, no dependencies, no build step.

---

## Files to Modify

| File | What changes |
|------|-------------|
| `index.html` | (1) Reorder `#menu-dropdown` items + add `#menu-help` button; (2) Add `#help-modal` markup before the About modal |
| `script.js` | (1) Reorder JS event listener blocks in the Settings menu IIFE; (2) Add `#menu-help` click handler + Help modal open/close logic |

---

### Task 1: Reorder the Settings menu HTML and add the Help menu item

**Files:**
- Modify: `index.html:353–376`

The current `#menu-dropdown` block (lines 353–376) must be replaced with the new order:
1. Character Creation
2. **Help** ← new
3. `<hr>`
4. Export Character
5. Import Character
6. `<hr>`
7. Theme
8. `<hr>`
9. About

- [ ] **Step 1: Replace the `#menu-dropdown` contents in `index.html`**

Replace this block (lines 353–376):

```html
  <div id="menu-dropdown" role="menu" aria-label="Settings">
    <button class="menu-item" role="menuitem" id="menu-guide">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M476.72 51.375c-5.28 30.185-124.992 107.9-82.47 16.875c-80.216 45.38-107.557 23.42-78.53-5.656c-54.825 2.8-62.753 88.173-55.345 112.406l17.438 19.125c-2.14-31.218.404-48.445 19.5-71.47c13.764 20.614 18.495 33.702 52.062 6.97c-9.393 53.52 54.61 18.747 88.75 10.938c-15.248 14.048-35.153 32.723-38.875 55.468c-1.24 7.587 6.208 17.925 14.125 25.626c-9.443 2.236-41.474 8.91-38.563 26.22c2.912 17.31 12.14 11.885 3.5 15.28c-12.403 2.766-21.156 5.58-39.593-2.187l18.874 20.717c28.39 14.79 73.904 7.306 83.594-14.875c-14.778-1.22-27.125-4.674-33-11.53c44.022-8.34 66.764-39.243 85.78-75.032c-33.638 18.95-42.158 17.784-56 16.313c35.514-14.365 46.876-108.943 38.75-145.188zM246.874 186.063l-56.78 70.125l79.186 86.906l75.095-50l-97.5-107.03zm-62.344 90.125L21.657 467.625l21.438 23.53l205.75-144.374l-64.313-70.592z"/></svg>
      Character Creation
    </button>
    <button class="menu-item" role="menuitem" id="menu-theme">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M263.844 40.344C234.1 213.202 145.594 248.03 145.594 369.22c0 60.804 60.106 105.5 118.25 105.5c59.45 0 115.937-41.803 115.937-99.533c0-116.332-85.2-162.312-115.936-334.843zm-58.28 217.094c-27.963 75.53-5.105 154.567 54.25 179.375c15.185 6.348 31.724 7.714 47.905 6.28c-116.134 49.787-185.836-79.816-102.158-185.656z"/></svg>
      Theme
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
    <hr class="menu-divider" />
    <button class="menu-item" role="menuitem" id="menu-about">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      About
    </button>
  </div>
```

With this new block:

```html
  <div id="menu-dropdown" role="menu" aria-label="Settings">
    <button class="menu-item" role="menuitem" id="menu-guide">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M476.72 51.375c-5.28 30.185-124.992 107.9-82.47 16.875c-80.216 45.38-107.557 23.42-78.53-5.656c-54.825 2.8-62.753 88.173-55.345 112.406l17.438 19.125c-2.14-31.218.404-48.445 19.5-71.47c13.764 20.614 18.495 33.702 52.062 6.97c-9.393 53.52 54.61 18.747 88.75 10.938c-15.248 14.048-35.153 32.723-38.875 55.468c-1.24 7.587 6.208 17.925 14.125 25.626c-9.443 2.236-41.474 8.91-38.563 26.22c2.912 17.31 12.14 11.885 3.5 15.28c-12.403 2.766-21.156 5.58-39.593-2.187l18.874 20.717c28.39 14.79 73.904 7.306 83.594-14.875c-14.778-1.22-27.125-4.674-33-11.53c44.022-8.34 66.764-39.243 85.78-75.032c-33.638 18.95-42.158 17.784-56 16.313c35.514-14.365 46.876-108.943 38.75-145.188zM246.874 186.063l-56.78 70.125l79.186 86.906l75.095-50l-97.5-107.03zm-62.344 90.125L21.657 467.625l21.438 23.53l205.75-144.374l-64.313-70.592z"/></svg>
      Character Creation
    </button>
    <button class="menu-item" role="menuitem" id="menu-help">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41c0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
      Help
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
    <hr class="menu-divider" />
    <button class="menu-item" role="menuitem" id="menu-theme">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 512 512"><path fill="currentColor" d="M263.844 40.344C234.1 213.202 145.594 248.03 145.594 369.22c0 60.804 60.106 105.5 118.25 105.5c59.45 0 115.937-41.803 115.937-99.533c0-116.332-85.2-162.312-115.936-334.843zm-58.28 217.094c-27.963 75.53-5.105 154.567 54.25 179.375c15.185 6.348 31.724 7.714 47.905 6.28c-116.134 49.787-185.836-79.816-102.158-185.656z"/></svg>
      Theme
    </button>
    <hr class="menu-divider" />
    <button class="menu-item" role="menuitem" id="menu-about">
      <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
      About
    </button>
  </div>
```

- [ ] **Step 2: Verify the HTML looks correct**

Open `index.html` in a browser. Click the gear icon. Confirm the menu shows in this order:
- Character Creation
- Help
- *(divider)*
- Export Character
- Import Character
- *(divider)*
- Theme
- *(divider)*
- About

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "ux: reorder settings menu and add Help placeholder item"
```

---

### Task 2: Add the Help modal HTML

**Files:**
- Modify: `index.html` — insert `#help-modal` immediately before `<!-- ── About modal ──` (currently line 460)

The Help modal reuses `import-overlay` (backdrop) and `import-card` (card) exactly like the About modal. It is a scrollable card with two sections: **Tips & Shortcuts** and **FAQ**.

- [ ] **Step 1: Insert the Help modal markup in `index.html`**

Insert the following block immediately before the `<!-- ── About modal ──` comment:

```html
  <!-- ── Help modal ─────────────────────────────────── -->
  <div id="help-modal" class="import-overlay" hidden>
    <div class="import-card">
      <h2 class="import-title">Help</h2>

      <h3 class="help-section-title">Tips &amp; Shortcuts</h3>
      <ul class="help-list">
        <li><strong>Portrait</strong> — Click the portrait frame to upload an image, drag-and-drop an image onto it, or paste an image from your clipboard anywhere on the page.</li>
        <li><strong>Autocomplete</strong> — Use arrow keys to navigate suggestions, Enter to select, Tab / Shift+Tab to cycle through options, Escape to dismiss.</li>
        <li><strong>Armor Class</strong> — AC is calculated automatically from your armor type, shield, mithral checkbox, and DEX modifier. Use the − / + buttons to override it manually.</li>
        <li><strong>Encumbrance</strong> — Your max slots equal your STR score (minimum 10). Fighters automatically add their CON modifier (Hauler feature).</li>
        <li><strong>Auto-save</strong> — All changes are saved automatically. There is no Save button.</li>
        <li><strong>Talent slots</strong> — Only earned slots are shown, plus the next locked one. Slots unlock at odd levels (1, 3, 5, 7, 9). Humans get a bonus slot at level 1.</li>
        <li><strong>Themes</strong> — 9 themes available via Settings → Theme.</li>
      </ul>

      <h3 class="help-section-title">FAQ</h3>
      <dl class="help-faq">
        <dt>My data disappeared after an update. What happened?</dt>
        <dd>When mod.io updates the symbiote it replaces the installation folder, which includes the saved data files. <strong>Always export your character before updating</strong> (Settings → Export Character), then re-import after the update (Settings → Import Character).</dd>

        <dt>How do I back up my character?</dt>
        <dd>Open Settings → Export Character. Your character data is copied to your clipboard as text. Paste it somewhere safe (a note, a text file, etc.).</dd>

        <dt>How do I restore a backup?</dt>
        <dd>Open Settings → Import Character, paste your previously exported text into the box, and click Import. You will be asked to confirm before anything is overwritten.</dd>

        <dt>Why did my AC change when I didn't touch it?</dt>
        <dd>AC is recalculated automatically whenever you change your armor type, shield, mithral checkbox, or DEX ability score.</dd>

        <dt>Why can't I edit some talent slots?</dt>
        <dd>Only talent slots you have earned are editable. Slots unlock at levels 1, 3, 5, 7, and 9. Humans earn a bonus slot at level 1.</dd>

        <dt>The dice roll button doesn't do anything in my browser.</dt>
        <dd>The dice tray integration is a TaleSpire feature. When running in a regular browser, the roll result is shown inline next to the button for a few seconds instead.</dd>

        <dt>How do I change the visual theme?</dt>
        <dd>Open Settings → Theme and pick from 9 options: Dungeon, Parchment, Blood Moon, TaleSpire, Frostgrave, Arcane, Emerald Grove, Sunfire, or Shadowfell.</dd>
      </dl>

      <div class="import-actions" style="justify-content:center">
        <button id="help-close" class="import-btn import-btn--cancel">Close</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add Help modal HTML"
```

---

### Task 3: Add Help modal CSS

**Files:**
- Modify: `style.css` — append new rules at the end

The modal itself reuses existing classes. Only two small additions are needed for the section headings and the FAQ definition list inside the modal.

- [ ] **Step 1: Append the following CSS to `style.css`**

```css
/* ── Help modal ─────────────────────────────────────── */
.help-section-title {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 1.25rem 0 0.5rem;
}
.help-section-title:first-of-type {
  margin-top: 0;
}
.help-list {
  margin: 0 0 0 1rem;
  padding: 0;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--text-secondary, var(--text));
}
.help-list li {
  margin-bottom: 0.4rem;
}
.help-faq {
  font-size: 0.82rem;
  line-height: 1.6;
  margin: 0;
}
.help-faq dt {
  font-weight: 600;
  color: var(--text);
  margin-top: 0.85rem;
}
.help-faq dt:first-child {
  margin-top: 0;
}
.help-faq dd {
  margin: 0.15rem 0 0 0;
  color: var(--text-secondary, var(--text));
}
```

- [ ] **Step 2: Open `index.html` in a browser, open Settings → Help, and verify:**
  - Modal opens
  - Section headings "Tips & Shortcuts" and "FAQ" are styled with accent color
  - List and FAQ text is readable
  - Close button works

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add CSS for Help modal sections"
```

---

### Task 4: Wire Help modal in script.js

**Files:**
- Modify: `script.js:2159–2218` — the Settings menu IIFE

Two changes:
1. Reorder the existing JS event listener blocks to match the new menu order
2. Add the `#menu-help` click handler + Help modal open/close logic

- [ ] **Step 1: Replace the entire Settings menu IIFE in `script.js`**

Replace lines 2159–2218 (from `// ── Settings menu` through the closing `})();`) with:

```js
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

      // Character Creation
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
```

- [ ] **Step 2: Open `index.html` in a browser and verify end-to-end:**
  - Settings menu opens with items in the correct order
  - Character Creation opens the guide modal
  - Help opens the Help modal; Close button and backdrop click both close it
  - Export Character copies to clipboard and shows toast
  - Import Character opens the import modal
  - Theme opens the theme popover
  - About opens the About modal

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: wire Help modal and reorder settings menu JS handlers"
```

---

### Task 5: Final check and push

- [ ] **Step 1: Open `index.html` in a browser and do a complete smoke test**

  - [ ] Settings menu order: Character Creation → Help → *divider* → Export → Import → *divider* → Theme → *divider* → About
  - [ ] Help modal opens from menu
  - [ ] Help modal closes via Close button
  - [ ] Help modal closes by clicking the backdrop
  - [ ] Tips & Shortcuts section displays all 7 items
  - [ ] FAQ section displays all 7 questions and answers
  - [ ] All other menu items still work (Character Creation, Export, Import, Theme, About)
  - [ ] Theme switching still works
  - [ ] No JS errors in browser console

- [ ] **Step 2: Push**

```bash
git push
```
