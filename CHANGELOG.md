# Changelog

All notable changes to **The Dark Spire** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

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
