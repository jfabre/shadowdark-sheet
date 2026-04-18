# Advantage / Disadvantage Rolls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Tracking bead:** sd-kz5
**Spec:** [`../specs/2026-04-17-advantage-disadvantage-design.md`](../specs/2026-04-17-advantage-disadvantage-design.md)

**Goal:** Add hover-to-reveal ▲/⚄/▼ buttons on each attack row; advantage/disadvantage rolls send 2d20 to TaleSpire and post the resolved result to board chat.

**Architecture:** Three-layer. (1) The manifest wires the `onRollResults` subscription. (2) A global `Map` tracks in-flight adv/disadv rolls by `rollId`. (3) The handler resolves the kept die (max for adv, min for disadv), applies the stat bonus, and posts a formatted message to `TS.chat.send`. Normal rolls are untouched.

**Tech stack:** Vanilla JS/HTML/CSS, TaleSpire Symbiote API v0.1 (`window.TS`)

---

### Task 1 — manifest.json: add dice.onRollResults subscription

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add subscription**

Replace the `"api"` block in `manifest.json` with:

```json
"api": {
  "version": "0.1",
  "subscriptions": {
    "symbiote": {
      "onStateChangeEvent": "onTaleSpireStateChange"
    },
    "dice": {
      "onRollResults": "onRollResults"
    }
  }
}
```

- [ ] **Step 2: Verify manifest is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: subscribe to dice.onRollResults for advantage resolution"
```

---

### Task 2 — script.js: global pendingAdvRolls Map + onRollResults handler

**Files:**
- Modify: `script.js` (insert after line 19, before the `StorageAdapter` block)

- [ ] **Step 1: Add global state and handler**

Insert after the `requestAnimationFrame(function() { _tsReadyResolve(); });` line:

```js
// ── Advantage / Disadvantage roll tracking ──────────────
// Maps rollId (returned by putDiceInTray) to pending roll metadata.
// Global so onRollResults (called by manifest) can access it.
var pendingAdvRolls = new Map();

// Walk the TaleSpire rollResult tree and collect die values of a given kind.
function _collectDice(node, kind, acc) {
  if (!node) return;
  if (node.kind === kind) { node.results.forEach(function(r) { acc.push(r); }); return; }
  if (node.operands) node.operands.forEach(function(op) { _collectDice(op, kind, acc); });
}

// Recursively evaluate a rollResult tree to an integer total.
function _sumNode(node) {
  if (!node) return 0;
  if (typeof node.value === 'number') return node.value;
  if (node.results) return node.results.reduce(function(a, b) { return a + b; }, 0);
  if (node.operands) {
    var vals = node.operands.map(_sumNode);
    if (node.operator === '+') return vals.reduce(function(a, b) { return a + b; }, 0);
    if (node.operator === '-') return vals[0] - vals.slice(1).reduce(function(a, b) { return a + b; }, 0);
  }
  return 0;
}

// Called by TaleSpire when any dice on the board produce results.
// Manifest wires dice.onRollResults -> "onRollResults".
function onRollResults(event) {
  if (!event.resultsGroups) { pendingAdvRolls.delete(event.rollId); return; }
  var pending = pendingAdvRolls.get(event.rollId);
  if (!pending) return;
  pendingAdvRolls.delete(event.rollId);

  var d20s = [];
  event.resultsGroups.forEach(function(g) { _collectDice(g.result, 'd20', d20s); });
  if (!d20s.length) return;

  var kept  = pending.mode === 'advantage' ? Math.max.apply(null, d20s) : Math.min.apply(null, d20s);
  var total = kept + pending.bonusN;
  var bonus = pending.bonusN >= 0 ? '+' + pending.bonusN : '' + pending.bonusN;

  var dmgTotal = 0;
  event.resultsGroups.forEach(function(g) {
    var tmp = []; _collectDice(g.result, 'd20', tmp);
    if (!tmp.length) dmgTotal += _sumNode(g.result);
  });

  var modeLabel = pending.mode === 'advantage' ? 'ADV' : 'DISADV';
  var msg = '\u2694 ' + pending.name + ' [' + modeLabel + ']'
          + '  Hit: ' + total
          + '  (' + d20s.join(' & ') + ' \u2192 kept ' + kept + ', ' + bonus + ')'
          + '  |  Dmg: ' + dmgTotal;

  if (window.TS && TS.chat && typeof TS.chat.send === 'function') {
    TS.chat.send(msg, 'board');
  }
}
```

- [ ] **Step 2: Smoke-test in browser console**

Open `index.html` in a browser. In DevTools console:

```js
pendingAdvRolls.set('test', { name: 'Shortsword', mode: 'advantage', bonusN: 3, dmgExpr: '1d6' });
onRollResults({
  rollId: 'test',
  resultsGroups: [
    { name: 'hit', result: { operator: '+', operands: [{ kind: 'd20', results: [14] }, { kind: 'd20', results: [7] }] } },
    { name: 'dmg', result: { kind: 'd6', results: [5] } }
  ]
});
console.log('pendingAdvRolls.size:', pendingAdvRolls.size);
```

Expected: no errors; `pendingAdvRolls.size: 0`. `TS.chat.send` won't fire (no `window.TS` in browser) — that's fine.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add onRollResults handler and pendingAdvRolls tracking"
```

---

### Task 3 — script.js: update rollAttack to support mode param

**Files:**
- Modify: `script.js:1981-2008`

- [ ] **Step 1: Replace rollAttack function**

Replace the entire `rollAttack` function body (lines 1981–2008) with:

```js
async function rollAttack(atk, row, mode) {
  mode = mode || 'normal';
  var bonusN   = getStatMod(atk.stat || 'STR');
  var bonusStr = bonusN >= 0 ? '+' + bonusN : '' + bonusN;
  var dmg      = atk.damage || '1d4';
  var name     = atk.name || 'Attack';

  if (window.TS && window.TS.dice && typeof window.TS.dice.putDiceInTray === 'function') {
    if (mode === 'normal') {
      window.TS.dice.putDiceInTray([
        { notation: '1d20' + bonusStr, label: name + ' \u2014 hit' },
        { notation: dmg,               label: name + ' \u2014 dmg' }
      ]);
    } else {
      var modeLabel = mode === 'advantage' ? 'ADV' : 'DISADV';
      try {
        var rollId = await window.TS.dice.putDiceInTray([
          { notation: '2d20', label: name + ' \u2014 hit (' + modeLabel + ')' },
          { notation: dmg,    label: name + ' \u2014 dmg' }
        ]);
        pendingAdvRolls.set(rollId, { name: name, mode: mode, bonusN: bonusN, dmgExpr: dmg });
      } catch (e) {
        if (window.TS && TS.debug) TS.debug.log('[rollAttack] putDiceInTray failed: ' + e);
      }
    }
    return;
  }

  // ── Browser fallback (no TaleSpire) ─────────────────────
  var d20a = Math.ceil(Math.random() * 20);
  var d20b = mode !== 'normal' ? Math.ceil(Math.random() * 20) : null;
  var kept, d20Display;

  if (mode === 'normal') {
    kept = d20a;
    d20Display = 'd20=' + d20a;
  } else if (mode === 'advantage') {
    kept = Math.max(d20a, d20b);
    d20Display = 'ADV ' + d20a + '&' + d20b + '\u2192' + kept;
  } else {
    kept = Math.min(d20a, d20b);
    d20Display = 'DISADV ' + d20a + '&' + d20b + '\u2192' + kept;
  }

  var total    = kept + bonusN;
  var dmgTotal = rollDice(dmg);
  var resultEl = row.querySelector('.atk-result');
  resultEl.textContent = name + ': hit ' + total + ' (' + d20Display + bonusStr + ') \u2014 dmg ' + dmgTotal;
  resultEl.classList.add('visible');
  clearTimeout(resultEl._timer);
  resultEl._timer = setTimeout(function() {
    resultEl.classList.remove('visible');
    resultEl.textContent = '';
  }, 8000);
}
```

- [ ] **Step 2: Test normal roll in browser**

Open `index.html`, add an attack named "Shortsword" with damage `1d6`. Click ⚄. Expected: inline result like `Shortsword: hit 14 (d20=11+3) — dmg 4`, disappears after 8s.

- [ ] **Step 3: Test advantage / disadvantage in console**

```js
var row = document.querySelector('.atk-row');
var atk = window.SD.character.combat.attacks[0];
rollAttack(atk, row, 'advantage');
rollAttack(atk, row, 'disadvantage');
```

Expected: inline shows `ADV X&Y→Z+bonus` / `DISADV X&Y→Z+bonus` format.

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "feat: rollAttack supports normal/advantage/disadvantage modes"
```

---

### Task 4 — script.js: attack row HTML + click wiring

**Files:**
- Modify: `script.js:1941-1944` (HTML fragment) and `script.js:1959` (click handler)

- [ ] **Step 1: Update the button HTML in renderAttacks**

Find the `<div class="atk-row-btns">...` block (around line 1941) and restructure to wrap the roll button in a cluster:

```js
`<div class="atk-row-btns">` +
  `<div class="btn-roll-cluster">` +
    `<button class="btn-adv"   title="Roll with advantage">\u25b2</button>` +
    `<button class="btn-roll"  title="Roll attack &amp; damage"><svg ...existing SVG content unchanged...></svg></button>` +
    `<button class="btn-disadv" title="Roll with disadvantage">\u25bc</button>` +
  `</div>` +
  `<button class="btn-trash" title="Remove attack">\u2715</button>` +
`</div>` +
```

Keep the existing SVG markup inside `.btn-roll` exactly as-is — only the wrapping structure changes.

- [ ] **Step 2: Replace the click wiring**

Find (around line 1959):
```js
row.querySelector('.btn-roll').addEventListener('click', () => rollAttack(atk, row));
```

Replace with:

```js
var cluster   = row.querySelector('.btn-roll-cluster');
var btnRoll   = row.querySelector('.btn-roll');
var btnAdv    = row.querySelector('.btn-adv');
var btnDisadv = row.querySelector('.btn-disadv');

function collapseCluster() { cluster.classList.remove('expanded'); }

// Touch: first tap expands; outside tap collapses
cluster.addEventListener('pointerdown', function(e) {
  if (e.pointerType !== 'touch') return;
  if (!cluster.classList.contains('expanded')) {
    e.preventDefault();
    cluster.classList.add('expanded');
    function onOutside(ev) {
      if (!cluster.contains(ev.target)) {
        collapseCluster();
        document.removeEventListener('pointerdown', onOutside);
      }
    }
    document.addEventListener('pointerdown', onOutside);
  }
});

btnRoll.addEventListener('click',   function() { rollAttack(atk, row, 'normal');       collapseCluster(); });
btnAdv.addEventListener('click',    function() { rollAttack(atk, row, 'advantage');    collapseCluster(); });
btnDisadv.addEventListener('click', function() { rollAttack(atk, row, 'disadvantage'); collapseCluster(); });
```

- [ ] **Step 3: Verify page loads without errors**

Open `index.html`. Zero console errors. Attack list renders. The ⚄ button works. ▲ and ▼ are present in the DOM but not yet visible (CSS in Task 5).

- [ ] **Step 4: Commit**

```bash
git add script.js
git commit -m "feat: attack row gains adv/disadv cluster and click wiring"
```

---

### Task 5 — style.css: cluster hover / tap-expand styling

**Files:**
- Modify: `style.css` (after line 1720)

- [ ] **Step 1: Add cluster CSS**

After line 1720 (`.btn-roll:active, .btn-trash:active { opacity: 1; }`) insert:

```css
/* Advantage / disadvantage button cluster */
.btn-roll-cluster {
  display: flex;
  align-items: center;
  gap: 2px;
}

.btn-adv, .btn-disadv {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.65rem;
  padding: 3px 4px;
  line-height: 1;
  -webkit-tap-highlight-color: transparent;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.btn-adv    { color: #6dca8a; }
.btn-disadv { color: #c07070; }

.btn-roll-cluster:hover .btn-adv,
.btn-roll-cluster:hover .btn-disadv,
.btn-roll-cluster.expanded .btn-adv,
.btn-roll-cluster.expanded .btn-disadv {
  opacity: 1;
  pointer-events: auto;
}
```

- [ ] **Step 2: Visual verification**

Open `index.html`, add an attack. Hover over the ⚄ button — ▲ (green) and ▼ (red) fade in on either side. Moving the mouse away fades them back out. The row layout does not shift when the buttons appear (they're already in the flex flow, just invisible).

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: hover-expand / tap-expand CSS for adv/disadv cluster"
```

---

### Task 6 — End-to-end verification

- [ ] **Step 1: Browser test — all three modes**

Open `index.html`. Add a "Longsword" attack (STR, `1d8`). In console:

```js
var row = document.querySelector('.atk-row');
var atk = window.SD.character.combat.attacks[0];
rollAttack(atk, row, 'normal');
rollAttack(atk, row, 'advantage');
rollAttack(atk, row, 'disadvantage');
```

Expected: three successive inline messages in the existing `.atk-result` format.

- [ ] **Step 2: Cluster interaction test**

Hover ⚄ — ▲/▼ fade in. Click ▲ — cluster collapses; result shows. Click ⚄ — normal roll; cluster collapses.

- [ ] **Step 3: TaleSpire test (requires game)**

Load symbiote in TaleSpire. Add an attack. Click ▲ → dice tray shows 2d20 + damage → roll → board chat shows `⚔ [Name] [ADV] Hit: N  (X & Y → kept Z, +bonus)  |  Dmg: W`. Repeat with ▼ — lower die kept. Normal ⚄ — dice tray behaviour unchanged, no chat message.

- [ ] **Step 4: Push to main**

```bash
git status
git push
```

Expected: `Your branch is up to date with 'origin/main'.`
