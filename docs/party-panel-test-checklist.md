# Party Panel — Pre-release Test Checklist

Two test tracks: a single-device devtools smoke test and a two-player live test.

---

## Track A — Devtools Smoke Test (single device)

Open the sheet in TaleSpire, open DevTools (`F12`), paste the snippets below into the Console.

### A1 — Stub TS and capture outgoing messages

Paste this first — it installs a fake `TS.sync` that records outgoing chunks so you can inspect what the broadcast sends, and then feeds them back in as if from another player.

```js
// Install stub
window.TS = {
  sync: {
    send: function(jsonStr, target) {
      var msg = JSON.parse(jsonStr);
      console.log('[SEND]', msg.t, msg);

      // Immediately echo back as if received from 'peer-01'
      setTimeout(function() {
        PartySync.handleIncoming('peer-01', { str: jsonStr });
      }, 20);
    },
    getClientsConnected: function(cb) { cb([]); }
  }
};
console.log('TS stub installed.');
```

### A2 — Simulate an incoming character info message

Tests that a card renders with the correct name and HP dots.

```js
PartySync.handleIncoming('peer-01', {
  str: JSON.stringify({ t: 'ci', name: 'Grak the Bold', hpCurrent: 8, hpTotal: 12 })
});
renderPartyPanel(PartySync.getParty());
// Expected: one card appears — "Grak the Bold", 2 yellow/hurt dots
```

### A3 — Full portrait round-trip (upload → chunk → receive → render)

First, upload a portrait using the sheet's normal portrait button. Then:

```js
// After uploading a portrait via the UI, trigger a broadcast.
// The A1 stub will echo the 'ci' and all 'pc' chunks back as peer-01.
PartySync.broadcastPortraitAndInfo();

// Wait ~3 seconds for all chunks to send, then:
setTimeout(function() {
  renderPartyPanel(PartySync.getParty());
  var member = PartySync.getParty()['peer-01'];
  console.log('portraitReady:', member && member.portraitReady);
  // Expected: portraitReady === true, card shows your own portrait
}, 3000);
```

### A4 — HP dots respond to incoming updates

```js
// Full HP → 3 green dots
PartySync.handleIncoming('peer-01', { str: JSON.stringify({ t: 'ci', name: 'Grak', hpCurrent: 12, hpTotal: 12 }) });
renderPartyPanel(PartySync.getParty());
// Expected: 3 green (lit-ok) dots

// Half HP → 2 yellow dots
PartySync.handleIncoming('peer-01', { str: JSON.stringify({ t: 'ci', name: 'Grak', hpCurrent: 5, hpTotal: 12 }) });
renderPartyPanel(PartySync.getParty());
// Expected: 2 yellow (lit-hurt) dots

// Critical → 1 red dot
PartySync.handleIncoming('peer-01', { str: JSON.stringify({ t: 'ci', name: 'Grak', hpCurrent: 2, hpTotal: 12 }) });
renderPartyPanel(PartySync.getParty());
// Expected: 1 red (lit-crit) dot
```

### A5 — Disconnect removes the card

```js
PartySync.clientDisconnected('peer-01');
renderPartyPanel(PartySync.getParty());
// Expected: card disappears; if party is now empty, toggle button hides
```

### A6 — Party toggle button visibility

```js
// With a member present:
PartySync.handleIncoming('peer-01', { str: JSON.stringify({ t: 'ci', name: 'Grak', hpCurrent: 8, hpTotal: 12 }) });
renderPartyPanel(PartySync.getParty());
// Expected: #view-toggle button is visible

// After disconnect:
PartySync.clientDisconnected('peer-01');
renderPartyPanel(PartySync.getParty());
// Expected: #view-toggle is hidden (display: none)
```

---

## Track B — Two-Player Live Test (requires two TaleSpire sessions in same campaign)

Player labels: **A** (you) and **B** (second player / GM).

### Setup

- [ ] Both players have the Dark Spire mod loaded and the sheet open
- [ ] Both players are in the **same TaleSpire campaign**

### B1 — Empty party (baseline)

- [ ] With only one player in the campaign, the party toggle button is **not visible** for either player

### B2 — Second player joins

- [ ] Player B opens TaleSpire and joins the campaign
- [ ] Player A's party toggle button becomes **visible** (no portrait yet — default silhouette card appears)
- [ ] Player B's party toggle button becomes **visible** (Player A's card appears with default silhouette)

### B3 — Character info syncs

- [ ] Player A sets **Character Name** and **Current HP / Max HP**
- [ ] Player B opens the party panel → Player A's card shows the correct **name** and correct **HP dots**
- [ ] Repeat from Player B's side → Player A sees Player B's name and dots

### B4 — HP dot states

Player A changes their HP (Player B watches the party panel, or vice versa):

| Player A HP (current / max) | Expected dots on Player B's card |
|-----------------------------|----------------------------------|
| 12 / 12 (full)              | 3 green dots                     |
| 5 / 12 (~half)              | 2 yellow dots                    |
| 2 / 12 (critical)           | 1 red dot                        |
| 0 / 0 (unknown)             | 0 lit dots (3 empty)             |

### B5 — Portrait upload and sync

- [ ] Player A uploads a portrait via the portrait button
- [ ] Within a few seconds, Player A's card on Player B's panel updates from the silhouette to **Player A's portrait**
- [ ] The portrait is recognisably the uploaded image (not scrambled, not blank)

### B6 — Portrait syncs to late-joining player

- [ ] Player A already has a portrait set
- [ ] Player B **leaves** the campaign and **rejoins**
- [ ] Player A's portrait appears on Player B's panel without Player A doing anything (triggered by the `clientConnected` event)

### B7 — Disconnect removes card

- [ ] Player B closes TaleSpire (or leaves the campaign)
- [ ] Player B's card **disappears** from Player A's party panel
- [ ] If Player A is now the only player, the toggle button **hides**

### B8 — Re-join restores state

- [ ] Player B rejoins the campaign
- [ ] Player B's card reappears on Player A's panel with correct name and HP dots
- [ ] Player B's portrait appears within a few seconds

---

## Pass Criteria

All items in Track A should produce the expected console output or DOM result described.  
All items in Track B should match the described UI behaviour on both players' screens.  
No JavaScript errors should appear in the DevTools console during any test.
