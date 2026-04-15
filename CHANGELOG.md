# Changelog

All notable changes to **The Dark Spire** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

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
