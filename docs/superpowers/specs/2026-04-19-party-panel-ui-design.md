# Party Panel UI — Design Spec

**Date:** 2026-04-19  
**Status:** Approved  
**Depends on:** `PartySync` backend (Tasks 1–10, complete and pushed)

---

## Problem

The `PartySync` module broadcasts and receives party member data (portrait, name, HP current/max) in real time, but there is no UI consumer. Players on the same TaleSpire board have no way to see their party's status from their own character sheet.

---

## Goal

Render a live "Party" section in the character sheet that shows all connected party members' portraits, names, and a 3-dot health state indicator — visible only when at least one other player is acknowledged by the sync API.

---

## Design Decision

Three design options were prototyped in `docs/party-panel-concepts.html`. **Design B (Party Cards)** was chosen, modified to replace HP bars/numbers with a 3-dot health state indicator.

The 3-dot system encodes health tier without revealing exact HP values:

| Dots | State | HP ratio |
|---|---|---|
| ●●● (green) | Healthy | > 66% |
| ●●· (amber) | Hurt | > 33% and ≤ 66% |
| ●·· (red) | Critical | ≤ 33% |
| ··· (muted) | Unknown | hpTotal = 0 |

---

## Layout

Placed between `.cbt-stats` (AC / Initiative / Luck Token) and the Ability Scores section label.

```
[ AC / Initiative / Luck Token row ]
─────────────────────────────────── ← party section (hidden when empty)
  PARTY
  ┌──────┐ ┌──────┐ ┌──────┐
  │      │ │      │ │      │  ← portraits (68px tall, 90px wide cards)
  │  A   │ │  M   │ │  G   │
  ├──────┤ ├──────┤ ├──────┤
  │Aldric│ │Mireth│ │Grond │
  │ ●●● │ │ ●●· │ │ ●·· │
  └──────┘ └──────┘ └──────┘
─────────────────────────────────── ← always present below
  ABILITY SCORES
```

Scrolls horizontally if more than ~4 players.

---

## Data Source

`PartySync.getParty()` returns:

```js
{
  "<clientId>": {
    clientId:      string,
    name:          string,        // "" if not yet received
    hpCurrent:     number,
    hpTotal:       number,
    portraitUrl:   string,        // data URL or DEFAULT_PORTRAIT
    portraitReady: boolean
  }
}
```

The panel registers a callback via `PartySync.onPartyChange(renderPartyPanel)` in `boot()`. Any update to `_partyMap` triggers a re-render.

---

## Visibility Logic

```
Object.keys(party).length === 0  →  panel.style.display = 'none'
Object.keys(party).length  >= 1  →  panel.style.display = ''
```

`display: none` used (not CSS transitions) for Chromium 111 compatibility.

---

## HTML Structure

Inserted in `index.html` between the `.cbt-stats` closing `</div>` and the
`<!-- Ability scores -->` comment:

```html
<!-- Party panel (populated and shown/hidden by JS) -->
<div id="party-panel" style="display:none">
  <div class="section-label">Party</div>
  <div id="party-list" class="party-list"></div>
</div>
```

Each card rendered by JS:

```html
<div class="party-card">
  <img class="party-portrait" src="…" alt="…" />
  <div class="party-card-info">
    <span class="party-name">…</span>
    <div class="party-dots">
      <div class="party-dot [lit-ok|lit-hurt|lit-crit]"></div>
      <div class="party-dot [lit-ok|lit-hurt|lit-crit]"></div>
      <div class="party-dot [lit-ok|lit-hurt|lit-crit]"></div>
    </div>
  </div>
</div>
```

---

## CSS

Appended to `style.css`:

```css
/* ── Party Panel ─────────────────────────────────── */
#party-panel { margin-bottom: 8px; }

.party-list {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.party-card {
  flex: 0 0 90px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.party-portrait {
  width: 100%;
  height: 68px;
  object-fit: cover;
  display: block;
  background: var(--surface);
}

.party-card-info {
  padding: 5px 6px 7px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.party-name {
  font-size: 0.65rem;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: center;
}

.party-dots {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.party-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border);
}

.party-dot.lit-ok   { background: #52b96e; }
.party-dot.lit-hurt { background: #b87c2a; }
.party-dot.lit-crit { background: #b84040; }
```

---

## JavaScript

### `_hpState(hpCurrent, hpTotal)`

Helper that maps HP ratio → `{ lit: number, cls: string }`:

```js
function _hpState(hpCurrent, hpTotal) {
  if (hpTotal <= 0) return { lit: 0, cls: '' };
  var ratio = hpCurrent / hpTotal;
  if (ratio > 0.66) return { lit: 3, cls: 'lit-ok' };
  if (ratio > 0.33) return { lit: 2, cls: 'lit-hurt' };
  return { lit: 1, cls: 'lit-crit' };
}
```

### `renderPartyPanel(party)`

Placed just before the `(async function boot()` IIFE:

```js
function renderPartyPanel(party) {
  var panel = document.getElementById('party-panel');
  var list  = document.getElementById('party-list');
  if (!panel || !list) return;

  var ids = Object.keys(party);
  panel.style.display = ids.length ? '' : 'none';
  if (!ids.length) return;

  list.innerHTML = '';
  ids.forEach(function(id) {
    var m = party[id];

    var card = document.createElement('div');
    card.className = 'party-card';

    var img = document.createElement('img');
    img.className = 'party-portrait';
    img.src = m.portraitUrl || DEFAULT_PORTRAIT;
    img.alt = m.name || 'Party member';
    card.appendChild(img);

    var info = document.createElement('div');
    info.className = 'party-card-info';

    var nameEl = document.createElement('span');
    nameEl.className = 'party-name';
    nameEl.textContent = m.name || '\u2026';
    info.appendChild(nameEl);

    var dotsEl = document.createElement('div');
    dotsEl.className = 'party-dots';
    var state = _hpState(m.hpCurrent, m.hpTotal);
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement('div');
      dot.className = 'party-dot' + (i < state.lit ? ' ' + state.cls : '');
      dotsEl.appendChild(dot);
    }
    info.appendChild(dotsEl);
    card.appendChild(info);
    list.appendChild(card);
  });
}
```

Registered in `boot()` after `PartySync.init()`:

```js
PartySync.onPartyChange(renderPartyPanel);
```

---

## Out of Scope

- Clicking a party member card (no interaction in this iteration)
- Sorting party members (rendered in insertion/connection order)
- Scrollable list cap / max player count enforcement
- Portrait full-size lightbox view

---

## Tests (`tests/party-panel.spec.js`)

| # | Behaviour |
|---|---|
| 1 | Panel hidden when `renderPartyPanel({})` called |
| 2 | Panel visible when called with one member |
| 3 | Panel hidden again after re-call with `{}` |
| 4 | One `.party-card` per party member |
| 5 | Portrait `img.src` matches member `portraitUrl` |
| 6 | Name span shows member name; falls back to `"…"` when name is `""` |
| 7 | HP > 66%: all 3 dots have class `lit-ok` |
| 8 | HP > 33% and ≤ 66%: first 2 dots `lit-hurt`, third unlit |
| 9 | HP ≤ 33%: first dot `lit-crit`, other two unlit |
| 10 | hpTotal = 0: no dot has a `lit-*` class |
