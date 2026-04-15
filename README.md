# The Dark Spire — Shadowdark Character Sheet

A digital character sheet for [Shadowdark RPG](https://www.thearcanelibrary.com/pages/shadowdark), built as a [TaleSpire Symbiote](https://symbiote-docs.talespire.com/). Works standalone in any browser too.

![Version](https://img.shields.io/badge/version-1.1.0-orange)
![Platform](https://img.shields.io/badge/platform-TaleSpire%20%7C%20Browser-blue)
![License](https://img.shields.io/badge/license-personal%20use-lightgrey)

## Features

### Core Tab
- **Character identity** — name, class (Fighter / Priest / Thief / Wizard), level, ancestry, alignment
- **Character portrait** — upload and crop an image, stored in-app
- **HP & XP tracking** — current/max HP and XP with next-level target
- **Ability scores** — full 2×3 grid (STR, DEX, CON, INT, WIS, CHA) with auto-computed modifiers
- **Combat stats** — AC (auto-calculated from armor + DEX + shield), initiative (derived from DEX), luck tokens
- **Attacks** — add weapon rows with autocomplete from the full Shadowdark weapon table (15 weapons); auto-fills damage die and stat bonus
- **Spells** — add spell rows with autocomplete for all Tier 1–2 Priest and Wizard spells (34 spells); auto-fills tier, range, duration, and description

### Inventory Tab
- **Encumbrance** — real-time slot tracker with progress bar; accounts for armor, coins, and inventory
- **Armor selector** — custom dropdown for None / Leather / Chainmail / Plate with AC and slot info
- **Mithral & Shield** — toggles that update AC and encumbrance automatically
- **Currency** — GP and SP tracking (auto-counted toward encumbrance at 1 slot per 100 coins)
- **Inventory** — dynamic item list with name, slots, quantity, notes, and delete; includes item autocomplete

### Traits Tab
- **Talents** — shows earned talent slots based on level (at levels 1, 3, 5, 7, 9) with class-specific autocomplete from the talent roll tables; Human ancestry gets a bonus talent at level 1
- **Class features** — collapsible reference for each class's abilities (Hauler, Weapon Mastery, Backstab, Spellcasting, etc.)
- **Background, Languages, Deity, Notes** — free-text fields with auto-growing textareas

### Themes
Six color themes, switchable from the 🎨 button (top-right). **Dungeon** is the default.

| Theme | Vibe |
|-------|------|
| **Dungeon** *(default)* | Pure black, gold accents |
| **Parchment** | Light, warm, old paper feel |
| **Blood Moon** | Deep crimson, dark horror |
| **TaleSpire** | Warm amber, matches TaleSpire UI |
| **Frostgrave** | Icy blue, cold tones |
| **Arcane** | Deep purple, mystical |

### Storage
- **TaleSpire** — saves to campaign blob storage via the Symbiote API; data is shared across all players viewing the same symbiote
- **Browser** — falls back to `localStorage` for standalone use
- Debounced writes prevent data loss on rapid input

## Tech Stack

Zero dependencies. Pure vanilla HTML + CSS + JS.

- `index.html` — single-page layout with three tab panels
- `style.css` — CSS custom properties for theming, responsive layout
- `script.js` — all logic: storage adapter, event bus, autocomplete factory, ability scores, combat, gear, class features, themes
- `manifest.json` — TaleSpire Symbiote manifest

Fonts loaded from Google Fonts:
- **IM Fell English** — headers and labels
- **Crimson Text** — body text
- **Share Tech Mono** — numbers and stats

## Installation

### TaleSpire (macOS)

Run the deploy script to copy files into TaleSpire's local Symbiotes folder:

```bash
./deploy.sh
```

This copies to `~/Library/Application Support/com.bouncyrock.talespire/Symbiotes/the Dark Spire/`.

Then open TaleSpire and add "The Dark Spire" from the Symbiotes panel.

### TaleSpire (Windows)

Copy `index.html`, `script.js`, `style.css`, and `manifest.json` to:

```
%AppData%\com.bouncyrock.talespire\Symbiotes\the Dark Spire\
```

### Browser

Just open `index.html` in any modern browser. No server required.

## Author

**Jeremy Fabre**

## License

The Dark Spire is an independent product published under the [Shadowdark RPG Third-Party License](https://www.thearcanelibrary.com/pages/shadowdark) and is not affiliated with The Arcane Library, LLC. Shadowdark RPG © 2023 The Arcane Library, LLC.