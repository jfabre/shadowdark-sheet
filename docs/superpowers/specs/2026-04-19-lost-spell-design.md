# Lost Spell Indicator — Design Spec
_2026-04-19_

## Problem

In Shadowdark RPG, a failed spellcasting check means the caster cannot cast that spell again until they rest. The sheet has no way to track this — players must remember it mentally.

## Scope

Mark individual spells as "lost" (cannot be cast until rest). No automated rest recovery in this iteration.

## Out of Scope

- Automatic marking on failed roll
- Rest button / HP recovery
- Ration consumption
- Priest penance tracking
- Wizard mishap rolls

## Visual Design

**Option C selected:** Red left border + muted card.

- Normal state: card unchanged
- Lost state:
  - `border-left: 3px solid` in a dark red
  - Card opacity reduced (~0.5)
  - Spell name color muted
  - All buttons (cast, adv, disadv) remain **fully visible and functional** — the player can still attempt a roll even on a lost spell
  - A small ◉ toggle button sits between the cast cluster and the trash button
  - When lost, the toggle turns red; clicking it restores the spell

## Data Model

Add a `lost` boolean field to each spell object in `character.combat.spells[]`:

```json
{
  "id": "uid-abc",
  "name": "Magic Missile",
  "tier": 1,
  "range": "Far",
  "duration": "Instant",
  "desc": "...",
  "lost": false
}
```

`lost` defaults to `false` (or absent = false). Persisted to localStorage / TaleSpire blob via the existing save path.

## Implementation

### `script.js` — `renderSpells()`

1. Add `.spell-lost` class to `.spell-item` when `spell.lost === true`
2. Add a `<button class="btn-spell-lost">` (◉) to each spell header row, between the cast cluster and the trash button
3. On click: toggle `spell.lost`, save character, re-render spell row (or just toggle class + persist without full re-render)

### `style.css`

Add rules for:
- `.spell-item.spell-lost` — red left border, reduced opacity, muted name color
- `.btn-spell-lost` — muted ◉ by default, red when `.spell-lost` is active

### No changes needed to

- `index.html` — spells are rendered by JS
- `data.js` — no data changes
- Export/import — `lost` field round-trips with existing JSON serialization
