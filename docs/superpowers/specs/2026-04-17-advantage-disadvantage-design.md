# Advantage / Disadvantage Attack Rolls — Design

**Date:** 2026-04-17
**Tracking bead:** sd-kz5

## Goal

Add advantage/disadvantage roll modes to each attack row in the TaleSpire character sheet symbiote. Results are resolved in JavaScript and posted to the TaleSpire board chat so every player at the table sees them in-context.

## UX Pattern — Hover to Reveal, Tap to Toggle

Each attack row's roll button (⚄) gains flanking ▲ and ▼ buttons.

```
Default:      [⚄]
On hover/tap: [▲] [⚄] [▼]
```

- **Desktop (mouse):** Hovering over the ⚄ button fades in ▲ (green) and ▼ (red) on either side via CSS. Click any of the three to roll.
- **Touch:** First tap on ⚄ expands the cluster (CSS `.expanded` class). A subsequent tap on any of the three buttons fires the roll. Tapping outside the cluster collapses it.
- **After any roll:** The cluster collapses back to just ⚄.
- **Normal roll (⚄):** Behaviour unchanged from today.

Rationale: The cluster is visually quiet in the default state (no clutter for a typical roll), but immediately discoverable on hover. Colour-coded chevrons (green up, red down) communicate mode without needing text. Collapse-after-roll keeps each roll a deliberate one-shot choice.

## Dice Mechanics

| Mode          | Sent to TaleSpire tray     | Computed by symbiote     |
|---------------|----------------------------|--------------------------|
| Normal        | `1d20+bonus`, `dmg`        | nothing (unchanged)      |
| Advantage     | `2d20`, `dmg`              | `max(d1, d2) + bonus`    |
| Disadvantage  | `2d20`, `dmg`              | `min(d1, d2) + bonus`    |

The stat bonus is intentionally **omitted** from the tray notation for advantage/disadvantage so TaleSpire's display shows the honest raw dice results. The symbiote applies the bonus after choosing which d20 to keep.

## Chat Output

When `onRollResults` fires with a `rollId` registered as pending, the symbiote posts a formatted message to the board via `TS.chat.send(msg, 'board')`:

```
⚔ Shortsword [ADV] Hit: 17  (14 & 7 → kept 14, +3)  |  Dmg: 5
⚔ Shortsword [DISADV] Hit: 8  (14 & 3 → kept 3, +5)  |  Dmg: 4
```

The message is sent as a plain board message (not `sendAsCreature`) for simplicity — no dependency on having a mini selected or owned on the current board.

Normal rolls do **not** trigger a chat message — TaleSpire's native dice-result UI already handles that. Only advantage/disadvantage rolls need symbiote-side resolution because TaleSpire has no keep-highest/lowest notation.

## Browser Fallback

When `window.TS` is absent (browser dev mode), advantage and disadvantage simulate 2d20 locally and show the kept value inline in the existing `.atk-result` div, matching the style of the existing normal-roll fallback:

```
Longsword: hit 17 (ADV 14&7→14+3) — dmg 5
```

## Technical Architecture

- **`manifest.json`** — gains `dice.onRollResults: "onRollResults"` subscription so TaleSpire calls the symbiote back when dice land.
- **`script.js` globals (before `StorageAdapter`)** — `pendingAdvRolls: Map<rollId, {name, mode, bonusN, dmgExpr}>` tracks in-flight adv/disadv rolls, and the global `onRollResults(event)` handler matches rolls by id, computes kept die + bonus, posts to chat, and deletes the pending entry.
- **`script.js` `rollAttack(atk, row, mode='normal')`** — gains `mode` parameter. For adv/disadv it sends `2d20` (no bonus) + damage to the tray, awaits the rollId, and registers it in `pendingAdvRolls`. Normal mode is unchanged.
- **`script.js` `renderAttacks`** — each row renders a `.btn-roll-cluster` wrapping `.btn-adv`, `.btn-roll`, `.btn-disadv`. Touch-expand and click handlers wire each button to the correct `rollAttack` call.
- **`style.css`** — `.btn-adv` / `.btn-disadv` start at `opacity: 0; pointer-events: none` and transition to visible on `.btn-roll-cluster:hover` or `.btn-roll-cluster.expanded`.

## Non-Goals

- Advantage/disadvantage for spells (spells have no roll button yet — separate feature).
- Advantage/disadvantage for ability checks / saving throws (ability rolls not yet implemented — separate feature).
- Critical hit detection / auto-apply of crit damage (out of scope).
- Per-attack persistent "always advantage" state (all rolls start from neutral; the UI is stateless after each roll).
