# XP Level-Up Ding — Design Spec

## Problem

Players have no audio feedback when their character earns enough XP to level up.
Adding a satisfying `ding.mp3` sound when current XP reaches the target makes the
moment feel rewarding without requiring any UI disruption.

## Scope

- Play `ding.mp3` when `char-xp >= char-xp-next` (and both are > 0)
- Trigger from both keyboard input on `#char-xp` and button clicks
- 30-second cooldown so the sound doesn't repeat while the player is still typing
- Add `+1 / −1` stepper buttons to the XP row (following the currency button pattern)
- No visual indicator needed — sound only

## Architecture

### HTML changes (`index.html`)

Wrap `#char-xp` in a `currency-stepper`-style structure with `−1` and `+1` buttons
using the existing `currency-btn` pattern (`data-target="char-xp"`, `data-delta`).
The existing `.currency-btn` JS block auto-wires these via `querySelectorAll`.

```html
<div class="xp-row">
  <span class="field-label">XP</span>
  <div class="xp-stepper">
    <button class="currency-btn xp-btn xp-btn--minus" data-target="char-xp" data-delta="-1">−1</button>
    <input type="number" id="char-xp" min="0" value="0" />
    <span class="xp-sep">/</span>
    <input type="number" id="char-xp-next" min="0" value="10" />
    <button class="currency-btn xp-btn xp-btn--plus" data-target="char-xp" data-delta="1">+1</button>
  </div>
</div>
```

> **Note:** If the user already has XP buttons in a local edit, skip the HTML change
> and only add the ding logic.

### JS changes (`script.js`)

**Constants (near top with other constants):**
```js
const DING_COOLDOWN_MS = 30_000;
```

**Audio object (near top, after constants):**
```js
const _dingAudio = new Audio('ding.mp3');
```

**Helper function (near the XP-related listeners):**
```js
let _lastDingAt = 0;
function _maybePlayDing() {
  const xp     = Number(document.getElementById('char-xp').value) || 0;
  const xpNext = Number(document.getElementById('char-xp-next').value) || 0;
  if (xpNext > 0 && xp >= xpNext && Date.now() - _lastDingAt > DING_COOLDOWN_MS) {
    _lastDingAt = Date.now();
    _dingAudio.currentTime = 0;
    _dingAudio.play().catch(() => {});  // silence autoplay policy errors
  }
}
```

**Listener wired after other XP listeners:**
```js
document.getElementById('char-xp').addEventListener('input', _maybePlayDing);
```

Since the currency-btn click handler already dispatches `new Event('input')` on
the target input, this one listener covers both keyboard typing and button clicks.

## Behaviour details

| Scenario | Ding? |
|---|---|
| User types XP equal to target | ✅ |
| User types XP above target | ✅ |
| User clicks +1 button to reach target | ✅ |
| Sound fired < 30s ago | ❌ (cooldown) |
| Both XP fields are 0 (empty sheet) | ❌ (guard: `xpNext > 0`) |
| Page load with XP already at target | ❌ (only on input events) |
| Browser autoplay policy blocks audio | Silent fail (`.catch(() => {})`) |

## Files changed

- `index.html` — add `−1`/`+1` buttons to XP row (if not already present)
- `script.js` — add `DING_COOLDOWN_MS`, `_dingAudio`, `_lastDingAt`, `_maybePlayDing`, wire listener
