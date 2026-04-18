# Changelog

All notable changes to **The Dark Spire** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [0.8.1] - 2026-04-18

### Themes & UX
- feat: theme popover has an Apply button — click swatches to preview live, Apply to commit; close without applying reverts to the saved theme
- ux: portrait frame enlarged to 140px

### Dice Rolls (TaleSpire)
- fix: unwrap `event.payload` in onRollResults — TaleSpire wraps dice events as `{kind, payload}`
- fix: match advantage/disadvantage pending roll by FIFO (TaleSpire sends `event.rollId=undefined`)
- fix: adv/dis roll messages use TaleSpire arithmetic format (e.g. 12 + 3 = 15)
- fix: remove redundant "vs DC" from spell adv/dis chat message

### Inventory & Encumbrance
- ux: encumbrance section moved to bottom of inventory page
- ux: 0-slot option added to inventory item slot badge cycle

### Scrollbar
- fix: scrollbar hidden with `width:0` for Chromium 111 compatibility
- ux: scrollbar auto-hides after 1.5s of scroll inactivity

## [0.8.0] - 2026-04-18

### Dice Integration
- feat: roll stat checks, initiative, and spellcasting from the sheet directly into TaleSpire
- feat: advantage / disadvantage buttons on attack rolls — sends 2d20, keeps the right one
- feat: advantage / disadvantage buttons on stat checks, initiative, and spells
- ux: roll results displayed in a bottom-panel toast card (monospace detail line, centred on screen)
- ux: attack results shown in toast instead of inline text

### Combat Tab
- ux: attack rows now show sword icon; hover glow on attack and spell buttons
- ux: advantage / disadvantage buttons enlarged for easier tapping
- fix: attack table header / column misalignment corrected
- fix: correct TaleSpire dice API field names (notation/label → name/roll)

### HP & XP
- ux: HP and XP redesigned as compact side-by-side stat cards
- ux: HP bar uses green at full health (instead of theme accent)
- ux: Dying label repositioned to HP title — no layout shift
- ux: level-up sparkles and shimmer on XP card when XP reaches maximum
- fix: HP defaults to 1/1 on new or empty sheets (prevents false Dying state on load)

### Core Sheet
- ux: ability modifier styled as a rotated diamond badge (d20 aesthetic)
- ux: AC, Luck, and Initiative numbers unified to 1.1rem to match modifier size
- ux: spells section hidden automatically for non-caster classes
- ux: character creation guide popup shown exactly once per new sheet
- fix: spells correctly re-render when class is changed in the dropdown
- fix: portrait placeholder text centred
- fix: portrait picker fixed in TaleSpire (uses input.click() fallback)

### Gear / Inventory
- ux: inventory slots/qty inputs replaced with slot badge and qty stepper
- fix: half-slot option removed (not a Shadowdark rule)

### Themes & Polish
- feat: scrollbar styled to match the active theme
- ux: Inventory section heading restored in Gear tab

## [0.7.1] - 2026-04-15

- fix: update APP_VERSION to 0.7.0 and sync version bump in deploy script

## [0.7.0] - 2026-04-15

- docs: add help modal and menu reorder implementation plan
- fix: help modal hierarchy - titles, strong, and questions use --accent for visual distinction
- fix: help modal contrast - open groups use --bg, answers use opacity for readable hierarchy
- fix: improve help modal text contrast - use --text instead of --muted for body copy
- typeset: fix help modal typography - consistent font-hdr, stronger hierarchy, larger body text
- ux: redesign help modal with collapsible sections for better readability
- fix: use id selector to force-hide spin buttons on bonus slots input
- ux: hide spin buttons on bonus slots input for cleaner look
- ux: widen bonus slots input from 36px to 48px
- ux: move bonus slots below encumbrance bar in a footer row with breakdown
- ux: replace card boxes with subtle divider lines between gear sections
- ux: rework inventory page - card sections, inline encumbrance, Items subhead, empty state
- fix: replace all var(--fg) with var(--text) to match actual theme variable names
- ux: replace Sunfire theme with Silverstone (cool light grey, slate blue accent)
- feat: add Help modal and reorder Settings menu (sd-e3n)

## [0.6.0] - 2026-04-15

- ux: move Character Creation to top of menu, add 3 new themes (Emerald Grove, Sunfire, Shadowfell)
- ux: redesign import confirmation dialog with warning icon and clearer messaging
- ux: move toast to top-center with accent background for better visibility
- ux: rename Guide to Character Creation and move license notice to About
- feat: add About modal with version, author, and license info
- fix: stop click propagation on theme menu item so popover stays open
- fix: restore missing #theme-popover selector so popover is hidden by default
- fix: update APP_VERSION to match v0.5.4 release
- feat: add export/import functions and wire settings menu with all actions
- feat: add APP_VERSION, compareSemver, and migration registry
- feat: add CSS for settings menu, import modal, and toast
- feat: replace top-right buttons with settings menu + add import modal markup
- docs: add export/import feature spec and implementation plan

## [0.5.4] - 2026-04-15

- ux: reorder traits tab sections and remove deity dimming feature
- fix: separate portrait from campaign blob to prevent UI freezing

## [0.5.3] - 2026-04-15

- fix: portrait click not working after changing image
- fix: non-blocking file picker + clipboard paste for portrait
- fix: slow file picker by using extensions instead of MIME types

## [0.5.2] - 2026-04-15

- feat: Tab/Shift+Tab cycles through autocomplete choices
- style: make version label more readable
- refactor: hardcode version in HTML instead of fetching manifest
- feat: show app version in theme popover

## [0.5.1] - 2026-04-15

- feat: add mod.io deploy script and changelog
- docs: fix incorrect claim about shared storage in README
- docs: update README to match current UI and architecture
- feat: change default theme to dungeon and clean up theme popover
- fix: restore missing containerEl for inventory autocomplete
- refactor: consolidate game data, section separators, and shared CSS input base
- refactor: consolidate autocomplete, utilities, event bus, and CSS
- Add Shadowdark TPL attribution notice and clean up modal icons

## [0.5.0] - 2026-04-14

Initial tracked release.

### Features
- Three-tab character sheet: Core, Inventory, Traits
- Six color themes: Dungeon, Parchment, Blood Moon, TaleSpire, Frostgrave, Arcane
- Autocomplete for weapons (15), spells (34), inventory items, and talents
- Portrait upload and crop
- Auto-calculated AC, initiative, encumbrance, and ability modifiers
- TaleSpire Symbiote integration with campaign-scoped local storage
- Browser fallback via localStorage
- Character creation guide modal
