# Export/Import Character Data

**Date**: 2025-04-15
**Status**: Draft
**Version**: 0.5.3 (current app version at time of design)

## Problem

TaleSpire symbiotes store data as files inside the symbiote's own directory. When mod.io pushes an update, the directory is replaced and all stored data (character sheet, portrait, theme) is lost. There is no built-in backup or migration mechanism in the TaleSpire symbiote platform.

## Solution

Add clipboard-based export/import so users can back up their character data before updating. Consolidate the top-right UI buttons into a single menu dropdown to house the new controls alongside existing ones.

## Scope

**In scope:**
- Single menu button + dropdown replacing the guide-reopen and theme-btn fixed buttons
- Export all data (character + portrait + theme) to clipboard as JSON
- Import from a paste textarea with validation, version checking, and confirmation
- Data versioning with migration chain for future schema changes
- Works identically in TaleSpire and standalone browser

**Out of scope:**
- File download/upload
- Partial import / merge
- Cloud sync
- Multi-character management

---

## 1. Toolbar Rework

### Current state

Two fixed-position circular icon buttons in the top-right corner:
- `#theme-btn` at `right: 10px` — opens theme popover
- `#guide-reopen` at `right: 50px` — reopens character creation guide

Each is individually positioned with hardcoded `right` offsets. Adding more buttons this way doesn't scale.

### New design

Replace both buttons with a single **menu button** (gear/cog icon) at `top: 10px; right: 10px`. Clicking it opens a dropdown menu with four items:

| Menu item | Action |
|-----------|--------|
| Theme | Clicking "Theme" opens the existing theme popover (repositioned to align below the dropdown). The dropdown itself closes; the popover acts as a sub-panel. |
| Guide | Reopens the character creation guide overlay (existing behavior) |
| Export Character | Runs the export flow (see section 2) |
| Import Character | Opens the import modal (see section 3) |

The dropdown closes when clicking outside it or after selecting an action. Each menu item is a `<button>` for keyboard accessibility.

### CSS changes

- Remove `#guide-reopen` and `#theme-btn` fixed positioning styles
- Add `#menu-btn` with the same visual treatment (34px circle, `position: fixed`, `top: 10px`, `right: 10px`, `z-index: 100`)
- Add `#menu-dropdown` positioned below the menu button (`top: 46px`, `right: 10px`) styled consistently with the existing `#theme-popover`

---

## 2. Export

### Trigger

User clicks "Export Character" in the menu dropdown.

### Data format

```json
{
  "_version": "0.5.3",
  "_exportedAt": "2025-04-15T12:00:00.000Z",
  "character": { /* full sd_char blob */ },
  "portrait": "data:image/jpeg;base64,...",
  "theme": "dungeon"
}
```

- `_version`: the app version at time of export, read from the hardcoded version string or a JS constant. Used for migration on import.
- `_exportedAt`: ISO 8601 timestamp for user reference.
- `character`: the complete `sd_char` JSON object as returned by `StorageAdapter.getItem('sd_char')` and parsed.
- `portrait`: the base64 data URL from `PortraitStore.get()`, or `null` if no portrait is set.
- `theme`: the current theme string from `StorageAdapter.getItem('sd_theme')`, or `null` if default.

### Clipboard write

```javascript
async function copyToClipboard(text) {
  if (window.TS?.system?.clipboard?.setText) {
    return TS.system.clipboard.setText(text);
  }
  return navigator.clipboard.writeText(text);
}
```

### Feedback

On success: show a brief toast notification ("Character copied to clipboard") that auto-dismisses after ~2 seconds.

On failure: show an error toast ("Failed to copy — please try again").

---

## 3. Import

### Trigger

User clicks "Import Character" in the menu dropdown.

### Modal

Opens a modal overlay with:
- Title: "Import Character"
- A `<textarea>` with placeholder: "Paste your character backup here..."
- An "Import" button (disabled until textarea is non-empty)
- A "Cancel" button
- Inline error display area (below textarea)

### Validation steps (in order)

1. **JSON parse**: attempt `JSON.parse()` on the textarea value. On failure: show "Invalid backup data — make sure you pasted the complete export."

2. **Structure check**: verify the parsed object has a `character` property that is a non-null object. On failure: show "This doesn't look like a Dark Spire backup."

3. **Version check**:
   - If `_version` is absent: treat as v0.5.3 (the first version with export support).
   - If `_version` is newer than the current app version: show "This backup was made with a newer version (vX.Y.Z). Please update The Dark Spire first."
   - If `_version` is older or equal: proceed (running migrations if needed).

4. **Migration**: run any applicable migration functions from export version to current version (see section 4).

5. **Confirmation dialog**: "This will replace your current character data. Continue?" with "Replace" and "Cancel" buttons. If the current character has a name, include it: "This will replace **[Name]**. Continue?"

### On confirm

1. Write `character` data via `saveCharacter()` (which goes through `StorageAdapter.setItem('sd_char', ...)`)
2. Write `portrait` via `PortraitStore.set()` (if present in export; if `null`, remove existing portrait)
3. Write `theme` via `StorageAdapter.setItem('sd_theme', ...)` (if present; if `null`, leave current)
4. Flush storage: call `StorageAdapter.flush()` to ensure TaleSpire campaign blob is written immediately
5. Reload the page (`location.reload()`) to repopulate the entire UI from the new data

### Why full page reload?

The app initializes UI state from storage on load. Re-reading every field and updating every DOM element manually would be fragile and duplicate the boot logic. A reload is simple and correct.

---

## 4. Data Versioning

### Version stamp

Every export includes `_version` set to the current app version string (e.g., `"0.5.3"`). This is the same version shown in the UI and defined in `manifest.json`.

### Migration registry

A simple ordered array of migration entries:

```javascript
const MIGRATIONS = [
  // { from: "0.5.3", to: "0.6.0", migrate: (data) => { ... return data; } },
];
```

Each entry transforms the export data shape from one version to the next. On import, the system:

1. Determines the export version (from `_version`, defaulting to `"0.5.3"`)
2. Starting from the export version, finds the migration whose `from` matches, applies it, then repeats with the resulting `to` version until no more migrations match (chained sequential application)
3. The final result has the current version's schema

### Today

There are zero migrations. The `MIGRATIONS` array is empty. The mechanism exists so that any future schema change comes with a migration function, and old exports remain importable.

### Version comparison

Use simple semver string comparison (split on `.`, compare major/minor/patch as integers). No need for a library — the version format is controlled by us.

---

## 5. Browser Compatibility

The feature works identically in TaleSpire and a standalone browser. The existing abstraction layers handle all differences:

| Concern | TaleSpire | Browser |
|---------|-----------|---------|
| Export to clipboard | `TS.system.clipboard.setText()` | `navigator.clipboard.writeText()` |
| Read character data | `StorageAdapter.getItem()` → campaign blob | `StorageAdapter.getItem()` → localStorage |
| Read portrait | `PortraitStore.get()` → global blob | `PortraitStore.get()` → localStorage |
| Write on import | `StorageAdapter.setItem()` / `PortraitStore.set()` | Same — adapter routes automatically |
| Flush after import | `StorageAdapter.flush()` → `TS.localStorage.campaign.setBlob()` | No-op (localStorage writes are synchronous) |
| UI reload | `location.reload()` | `location.reload()` |

Developers can test the full export/import flow in a regular browser during development without TaleSpire.

---

## 6. Files Changed

| File | Changes |
|------|---------|
| `index.html` | Remove `#guide-reopen` and `#theme-btn` buttons. Add `#menu-btn` + `#menu-dropdown`. Add import modal markup. |
| `style.css` | Remove/replace guide-reopen and theme-btn styles. Add menu button, dropdown, modal, and toast styles. |
| `script.js` | Add: `copyToClipboard()`, `exportCharacter()`, `importCharacter()`, `MIGRATIONS` array, `compareSemver()`, menu toggle logic. Modify: theme selector to work from menu dropdown instead of standalone button. |
| `manifest.json` | No changes needed. |

### Deployment Scripts

Neither `deploy.sh` nor `deploy-modio.sh` require changes. The feature only modifies existing files (`index.html`, `script.js`, `style.css`), all of which are already included in both deployment pipelines.

**Constraint**: The `<span id="app-version">` element must remain in `index.html` with the exact `id` and format `vX.Y.Z`. The `deploy-modio.sh` script uses a perl regex (`s|(<span id="app-version">)v[\d.]+|...`) to update the version during releases. When relocating this span from the theme popover into the new menu dropdown, preserve the id and value format.

**Verification**: After implementation, both deployment scripts should be run to confirm they still work:
- `./deploy.sh` — copies files to local TaleSpire symbiotes folder
- `./deploy-modio.sh --version X.Y.Z` — bumps version, generates changelog, creates zip

---

## 7. Accessibility

- Menu button has `aria-label="Settings menu"` and `aria-expanded` toggled on open/close
- Dropdown has `role="menu"`, items have `role="menuitem"`
- Import modal traps focus while open, returns focus to menu button on close
- Confirmation dialog uses native-style buttons with clear labels ("Replace" / "Cancel")
- Toast notification uses `role="status"` and `aria-live="polite"`
- All interactive elements are keyboard-navigable
