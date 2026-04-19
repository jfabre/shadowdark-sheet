# Party Portraits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Broadcast each player's portrait (128×128) and character info (name, HP) to all Dark Spire clients on the same TaleSpire board via TS.sync, updating live whenever the portrait or HP/name changes.

**Architecture:** A `PartySync` IIFE module at global scope in `script.js` handles all sending and receiving. Portraits are downscaled to 128×128 and chunked across multiple TS.sync messages (470 chars/chunk, 15ms delay between chunks). Character info (name, hpCurrent, hpTotal) is sent as a single lightweight message. The feature is a no-op outside TaleSpire and never sends if no portrait is set.

**Tech Stack:** Playwright (test runner), Web Audio API (not relevant here), TaleSpire Symbiote API v0.1 (`TS.sync`), vanilla ES5-compatible JS (`var`, no optional chaining).

---

## File Map

| File | Change |
|---|---|
| `manifest.json` | Add `interop.id`, sync subscriptions, `runInBackground` capability |
| `script.js` | Add `DEFAULT_PORTRAIT` constant, `chunkString()`, `reassembleChunks()`, `PartySync` module, `onSyncMessage()`, `onSyncClientEvent()` global callbacks; modify `PortraitStore.set()`, boot() HP/name listeners, boot() init sequence |
| `tests/party-sync.spec.js` | New test file: chunk/reassemble round-trip, guards, peer lifecycle |

---

## Task 1: Update manifest.json

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add interop ID, sync subscriptions, and runInBackground**

Replace the `"api"` block in `manifest.json` with:

```json
{
  "manifestVersion": 1,
  "name": "The Dark Spire - Character Sheet",
  "description": "The best Shadowdark RPG character sheet for TaleSpire",
  "entryPoint": "/index.html",
  "version": "0.8.0",
  "environment": {
    "loadTargetBehavior": "popup",
    "capabilities": ["runInBackground"]
  },
  "about": {
    "authors": [
      "Jeremy Fabre"
    ]
  },
  "api": {
    "version": "0.1",
    "interop": {
      "id": "37ff6976-7da5-48f8-815c-2801420a55f6"
    },
    "subscriptions": {
      "symbiote": {
        "onStateChangeEvent": "onTaleSpireStateChange"
      },
      "dice": {
        "onRollResults": "onRollResults"
      },
      "sync": {
        "onSyncMessage": "onSyncMessage",
        "onClientEvent": "onSyncClientEvent"
      }
    }
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add interopId and sync subscriptions to manifest"
```

---

## Task 2: Add DEFAULT_PORTRAIT constant and pure helper functions

**Files:**
- Modify: `script.js` (after line 98, before the `// ── Storage Adapter` comment)

- [ ] **Step 1: Insert DEFAULT_PORTRAIT and helpers after line 98**

Add the following block between the closing `}` of `sendToTray` (line 98) and the `// ── Storage Adapter` comment (line 100):

```js
    // ── Party sync helpers ─────────────────────────────
    // Default 128×128 portrait shown before a peer's image is received.
    var DEFAULT_PORTRAIT = (function() {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
        '<rect width="128" height="128" fill="#2a2a3e"/>' +
        '<circle cx="64" cy="46" r="24" fill="#5a5a7e"/>' +
        '<ellipse cx="64" cy="108" rx="36" ry="28" fill="#5a5a7e"/>' +
        '</svg>';
      return 'data:image/svg+xml;base64,' + btoa(svg);
    })();

    // Split a string into an array of chunks of at most `size` characters.
    function chunkString(str, size) {
      var chunks = [];
      for (var i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size));
      }
      return chunks;
    }

    // Reassemble an array of chunks back into a string.
    // Returns null if any slot from 0..(total-1) is missing.
    function reassembleChunks(chunks, total) {
      for (var i = 0; i < total; i++) {
        if (chunks[i] === undefined || chunks[i] === null) return null;
      }
      return chunks.slice(0, total).join('');
    }
```

- [ ] **Step 2: Run existing tests to confirm no breakage**

```bash
npm test
```
Expected: all 60 tests pass.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add DEFAULT_PORTRAIT constant and chunkString/reassembleChunks helpers"
```

---

## Task 3: Write and run tests for chunkString and reassembleChunks

**Files:**
- Create: `tests/party-sync.spec.js`

- [ ] **Step 1: Create the test file**

```js
// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp } = require('./helpers/test-utils');

// ── chunkString ────────────────────────────────────────

test('chunkString splits evenly', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => chunkString('abcdef', 2));
  expect(result).toEqual(['ab', 'cd', 'ef']);
});

test('chunkString last chunk is shorter when not divisible', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => chunkString('abcde', 2));
  expect(result).toEqual(['ab', 'cd', 'e']);
});

test('chunkString on empty string returns empty array', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => chunkString('', 10));
  expect(result).toEqual([]);
});

test('chunkString on string shorter than size returns single chunk', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => chunkString('hi', 100));
  expect(result).toEqual(['hi']);
});

// ── reassembleChunks ───────────────────────────────────

test('reassembleChunks round-trips with chunkString', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    var original = 'HelloWorldThisIsATest';
    var chunks = chunkString(original, 4);
    return reassembleChunks(chunks, chunks.length);
  });
  expect(result).toBe('HelloWorldThisIsATest');
});

test('reassembleChunks returns null when a chunk is missing', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    var chunks = ['ab', undefined, 'ef'];
    return reassembleChunks(chunks, 3);
  });
  expect(result).toBeNull();
});

test('reassembleChunks returns null when total is larger than chunks array', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    var chunks = ['ab', 'cd'];
    return reassembleChunks(chunks, 3);
  });
  expect(result).toBeNull();
});

test('reassembleChunks handles out-of-order arrival (sparse array)', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    var chunks = [];
    chunks[0] = 'ab';
    chunks[2] = 'ef';
    chunks[1] = 'cd';
    return reassembleChunks(chunks, 3);
  });
  expect(result).toBe('abcdef');
});

// ── DEFAULT_PORTRAIT ───────────────────────────────────

test('DEFAULT_PORTRAIT is a valid data URI', async ({ page }) => {
  await loadApp(page);
  const val = await page.evaluate(() => DEFAULT_PORTRAIT);
  expect(val).toMatch(/^data:image\/svg\+xml;base64,/);
});
```

- [ ] **Step 2: Run tests to verify they all pass**

```bash
npm test -- --grep "chunkString|reassembleChunks|DEFAULT_PORTRAIT"
```
Expected: 9 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/party-sync.spec.js
git commit -m "test: chunkString, reassembleChunks, and DEFAULT_PORTRAIT"
```

---

## Task 4: Add the PartySync module

**Files:**
- Modify: `script.js` (insert after `PortraitStore` closes at line 273)

- [ ] **Step 1: Insert PartySync IIFE module after line 273**

Add the following block immediately after the `})(); // end PortraitStore` line:

```js
    // ── PartySync ──────────────────────────────────────
    // Broadcasts the local player's portrait and character info to all Dark Spire
    // clients on the same TaleSpire board. No-op when window.TS is absent.
    const PartySync = (function() {
      // Map of clientId → { clientId, name, hpCurrent, hpTotal, portraitUrl, portraitReady }
      var _partyMap = {};
      // Receive buffers: clientId → { chunks: [], total: N, timer: id }
      var _receiveBuffers = {};
      // Incremented on every broadcast to cancel in-flight sends.
      var _sendGeneration = 0;
      // Registered onPartyChange callbacks.
      var _callbacks = [];

      function _notify() {
        _callbacks.forEach(function(fn) { try { fn(_partyMap); } catch(e) {} });
      }

      function onPartyChange(fn) {
        _callbacks.push(fn);
      }

      function getParty() {
        return _partyMap;
      }

      // ── Initialisation ─────────────────────────────
      function init() {
        if (!window.TS) return;
        TS.sync.getClientsConnected()
          .then(function(clients) {
            clients.forEach(function(c) {
              if (!_partyMap[c.id]) {
                _partyMap[c.id] = _skeleton(c.id);
              }
            });
            if (clients.length > 0) {
              // Ask existing peers to send us their data.
              _safeSend({ t: 'pr' }, 'board');
            }
            // Send our own data to all peers.
            broadcastPortraitAndInfo();
            _notify();
          })
          .catch(function(e) {
            if (window.TS && TS.debug) TS.debug.log('[PartySync] init failed: ' + e);
          });
      }

      // ── Broadcasting ───────────────────────────────
      function broadcastPortraitAndInfo() {
        if (!window.TS) return;
        var portrait = PortraitStore.get();
        if (!portrait) return; // No portrait set — do not send anything.

        var name      = (document.getElementById('char-name')  || {}).value || '';
        var hpCurrent = parseInt(((document.getElementById('hp-current') || {}).value || '0'), 10) || 0;
        var hpTotal   = parseInt(((document.getElementById('hp-max')     || {}).value || '0'), 10) || 0;

        // Send lightweight character info immediately (no chunking needed).
        _safeSend({ t: 'ci', name: name, hpCurrent: hpCurrent, hpTotal: hpTotal }, 'board');

        // Downscale portrait to 128×128 then chunk and send.
        var canvas = document.createElement('canvas');
        canvas.width  = 128;
        canvas.height = 128;
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function() {
          ctx.drawImage(img, 0, 0, 128, 128);
          var b64 = canvas.toDataURL('image/jpeg', 0.7)
                          .replace('data:image/jpeg;base64,', '');
          _sendChunks(b64);
        };
        // img.src assignment after onload is set — avoids race on cached images.
        img.src = portrait;
      }

      function _sendChunks(base64) {
        var chunks = chunkString(base64, 470);
        var total  = chunks.length;
        var gen    = ++_sendGeneration;

        function sendNext(i) {
          if (gen !== _sendGeneration) return; // A newer broadcast cancelled this one.
          if (i >= total) return;
          _safeSend({ t: 'pc', s: i, n: total, d: chunks[i] }, 'board');
          setTimeout(function() { sendNext(i + 1); }, 15);
        }
        sendNext(0);
      }

      function _safeSend(obj, target) {
        try {
          TS.sync.send(JSON.stringify(obj), target);
        } catch(e) {
          if (window.TS && TS.debug) TS.debug.log('[PartySync] send error: ' + e);
        }
      }

      // ── Receiving ──────────────────────────────────
      function handleIncoming(senderId, event) {
        var msg;
        try { msg = JSON.parse(event.str); } catch(e) { return; }

        if (msg.t === 'ci') {
          if (!_partyMap[senderId]) _partyMap[senderId] = _skeleton(senderId);
          _partyMap[senderId].name      = msg.name      || '';
          _partyMap[senderId].hpCurrent = msg.hpCurrent || 0;
          _partyMap[senderId].hpTotal   = msg.hpTotal   || 0;
          _notify();

        } else if (msg.t === 'pc') {
          if (!_receiveBuffers[senderId]) {
            _receiveBuffers[senderId] = { chunks: [], total: msg.n, timer: null };
          }
          var buf = _receiveBuffers[senderId];
          buf.chunks[msg.s] = msg.d;

          // Reset the 15-second incomplete-transfer timeout.
          clearTimeout(buf.timer);
          buf.timer = setTimeout(function() {
            delete _receiveBuffers[senderId];
          }, 15000);

          // Count non-null slots to check for completion.
          var received = 0;
          for (var i = 0; i < buf.chunks.length; i++) {
            if (buf.chunks[i] !== undefined) received++;
          }
          if (received === msg.n) {
            if (!_partyMap[senderId]) _partyMap[senderId] = _skeleton(senderId);
            _partyMap[senderId].portraitUrl   = 'data:image/jpeg;base64,' + buf.chunks.join('');
            _partyMap[senderId].portraitReady = true;
            clearTimeout(buf.timer);
            delete _receiveBuffers[senderId];
            _notify();
          }

        } else if (msg.t === 'pr') {
          // Peer is requesting our data (they just joined or reloaded).
          broadcastPortraitAndInfo();
        }
      }

      // ── Peer lifecycle ─────────────────────────────
      function clientConnected(clientId) {
        if (!_partyMap[clientId]) {
          _partyMap[clientId] = _skeleton(clientId);
        }
        // Send our data to the newly connected peer.
        broadcastPortraitAndInfo();
        _notify();
      }

      function clientDisconnected(clientId) {
        delete _partyMap[clientId];
        if (_receiveBuffers[clientId]) {
          clearTimeout(_receiveBuffers[clientId].timer);
          delete _receiveBuffers[clientId];
        }
        _notify();
      }

      // ── Internal helpers ───────────────────────────
      function _skeleton(clientId) {
        return {
          clientId:      clientId,
          name:          '',
          hpCurrent:     0,
          hpTotal:       0,
          portraitUrl:   DEFAULT_PORTRAIT,
          portraitReady: false,
        };
      }

      return {
        init:                  init,
        broadcastPortraitAndInfo: broadcastPortraitAndInfo,
        getParty:              getParty,
        onPartyChange:         onPartyChange,
        handleIncoming:        handleIncoming,
        clientConnected:       clientConnected,
        clientDisconnected:    clientDisconnected,
      };
    })();
```

- [ ] **Step 2: Run existing tests to confirm no breakage**

```bash
npm test
```
Expected: all 60 tests pass.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add PartySync module"
```

---

## Task 5: Add global onSyncMessage and onSyncClientEvent callbacks

**Files:**
- Modify: `script.js` (insert after the `onRollResults` function, at line 89)

The TaleSpire manifest wires subscription callbacks as **global functions**. Add them alongside `onTaleSpireStateChange` and `onRollResults`.

- [ ] **Step 1: Insert global callbacks after the onRollResults closing brace (line 88)**

Add this block between line 88 (`}` — end of `onRollResults`) and line 90 (`// ── Dice tray helper`):

```js
    // ── TaleSpire sync callbacks (global — required by manifest) ──
    function onSyncMessage(event) {
      // event.kind === 'syncMessageReceived'
      // event.str        → the raw JSON string
      // event.fromClient → { id: string }
      if (!event || !event.fromClient) return;
      PartySync.handleIncoming(event.fromClient.id, event);
    }

    function onSyncClientEvent(event) {
      // event.kind === 'clientConnected'  → event.client.id
      // event.kind === 'clientDisconnected' → event.clientId
      if (event.kind === 'clientConnected' && event.client) {
        PartySync.clientConnected(event.client.id);
      } else if (event.kind === 'clientDisconnected') {
        PartySync.clientDisconnected(event.clientId);
      }
    }
```

- [ ] **Step 2: Run existing tests to confirm no breakage**

```bash
npm test
```
Expected: all 60 tests pass.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add onSyncMessage and onSyncClientEvent global callbacks"
```

---

## Task 6: Integrate PortraitStore.set() with PartySync broadcast

**Files:**
- Modify: `script.js` (inside `PortraitStore`, `set()` function, lines ~234–244)

- [ ] **Step 1: Add broadcast call at end of PortraitStore.set()**

The current `set()` function (lines 234–244):

```js
      async function set(dataUrl) {
        if (_isTaleSpire) {
          _map[_campaignId] = dataUrl;
          try {
            await TS.localStorage.global.setBlob(JSON.stringify(_map));
          } catch (e) {
            console.warn('[PortraitStore] global write failed:', e);
          }
        } else {
          localStorage.setItem(PORTRAIT_KEY, dataUrl);
        }
      }
```

Replace with:

```js
      async function set(dataUrl) {
        if (_isTaleSpire) {
          _map[_campaignId] = dataUrl;
          try {
            await TS.localStorage.global.setBlob(JSON.stringify(_map));
          } catch (e) {
            console.warn('[PortraitStore] global write failed:', e);
          }
        } else {
          localStorage.setItem(PORTRAIT_KEY, dataUrl);
        }
        // Broadcast the new portrait to party members whenever it changes.
        PartySync.broadcastPortraitAndInfo();
      }
```

- [ ] **Step 2: Run existing tests to confirm no breakage**

```bash
npm test
```
Expected: all 60 tests pass.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: broadcast portrait via PartySync on PortraitStore.set()"
```

---

## Task 7: Add HP and name change CI broadcast triggers in boot()

**Files:**
- Modify: `script.js` (in `boot()`, after the existing `hp-current`/`hp-max`/`char-name` listeners, around lines 694–702)

Character info is re-sent (without portrait chunks) whenever name or HP changes. A 300ms debounce prevents flooding on rapid typing.

- [ ] **Step 1: Insert debounce helper and CI triggers after the existing listeners block**

Find the block (around lines 694–702):

```js
      ['char-name','char-level','char-xp','char-xp-next',
       'hp-current','hp-max','luck-tokens'].forEach(function(id) {
        document.getElementById(id).addEventListener('input', coreAutoSave);
      });

      ['hp-current','hp-max'].forEach(function(id) {
        document.getElementById(id).addEventListener('input', updateHpBar);
      });
```

Insert the following immediately after that block:

```js
      // ── Party sync: re-broadcast CI on name or HP change ──────────
      (function() {
        var _ciTimer = null;
        function broadcastCi() {
          clearTimeout(_ciTimer);
          _ciTimer = setTimeout(function() {
            PartySync.broadcastPortraitAndInfo();
          }, 300);
        }
        ['char-name', 'hp-current', 'hp-max'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.addEventListener('input', broadcastCi);
        });
      })();
```

- [ ] **Step 2: Run existing tests to confirm no breakage**

```bash
npm test
```
Expected: all 60 tests pass.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: debounced CI broadcast on name and HP input changes"
```

---

## Task 8: Wire PartySync.init() into the boot() initialization sequence

**Files:**
- Modify: `script.js` (inside `boot()`, around lines 482–488)

- [ ] **Step 1: Add PartySync.init() after PortraitStore.migrateFromCampaignBlob()**

Find (lines 482–488):

```js
    (async function boot() {
    // Wait for TaleSpire API to initialize (instant in browser mode)
    await _tsReadyPromise;
    await StorageAdapter.init();
    await PortraitStore.init();
    await PortraitStore.migrateFromCampaignBlob();
```

Replace with:

```js
    (async function boot() {
    // Wait for TaleSpire API to initialize (instant in browser mode)
    await _tsReadyPromise;
    await StorageAdapter.init();
    await PortraitStore.init();
    await PortraitStore.migrateFromCampaignBlob();
    PartySync.init();
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```
Expected: all 60 tests pass.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: call PartySync.init() on boot"
```

---

## Task 9: Write remaining tests for PartySync guards and message handling

**Files:**
- Modify: `tests/party-sync.spec.js`

- [ ] **Step 1: Add guard and message-handling tests**

Append to `tests/party-sync.spec.js`:

```js
// ── PartySync guards ───────────────────────────────────

test('PartySync.broadcastPortraitAndInfo is a no-op when window.TS is absent', async ({ page }) => {
  await loadApp(page);
  // In the browser (no TaleSpire), TS is absent — calling broadcast should not throw.
  const threw = await page.evaluate(() => {
    try {
      PartySync.broadcastPortraitAndInfo();
      return false;
    } catch(e) {
      return true;
    }
  });
  expect(threw).toBe(false);
});

test('PartySync.broadcastPortraitAndInfo does not attempt to send when no portrait is set', async ({ page }) => {
  await loadApp(page);
  // Patch TS.sync.send so we can detect if it gets called.
  const callCount = await page.evaluate(() => {
    var calls = 0;
    window.TS = window.TS || {};
    TS.sync = TS.sync || {};
    TS.sync.send = function() { calls++; };
    PartySync.broadcastPortraitAndInfo();
    return calls;
  });
  expect(callCount).toBe(0);
});

// ── PartySync.handleIncoming ───────────────────────────

test('handleIncoming "ci" message updates partyMap name and HP', async ({ page }) => {
  await loadApp(page);
  const member = await page.evaluate(() => {
    var fakeEvent = { str: JSON.stringify({ t: 'ci', name: 'Aldric', hpCurrent: 8, hpTotal: 12 }) };
    PartySync.handleIncoming('client-001', fakeEvent);
    return PartySync.getParty()['client-001'];
  });
  expect(member.name).toBe('Aldric');
  expect(member.hpCurrent).toBe(8);
  expect(member.hpTotal).toBe(12);
  expect(member.portraitUrl).toMatch(/^data:image\/svg\+xml;base64,/); // default portrait
  expect(member.portraitReady).toBe(false);
});

test('handleIncoming "pc" chunks reassemble into a portrait', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    // Simulate sending a small "portrait" as 3 chunks of 4 chars each.
    var fakeB64 = 'aabbccdd'; // 8 chars → 2 chunks of 4
    var chunks = chunkString(fakeB64, 4);
    chunks.forEach(function(chunk, i) {
      var fakeEvent = { str: JSON.stringify({ t: 'pc', s: i, n: chunks.length, d: chunk }) };
      PartySync.handleIncoming('client-002', fakeEvent);
    });
    var member = PartySync.getParty()['client-002'];
    return { portraitReady: member.portraitReady, url: member.portraitUrl };
  });
  expect(result.portraitReady).toBe(true);
  expect(result.url).toBe('data:image/jpeg;base64,aabbccdd');
});

test('handleIncoming "pc" partial transfer leaves portraitReady false', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    // Send only chunk 0 of a 3-chunk transfer.
    var fakeEvent = { str: JSON.stringify({ t: 'pc', s: 0, n: 3, d: 'aaaa' }) };
    PartySync.handleIncoming('client-003', fakeEvent);
    var member = PartySync.getParty()['client-003'];
    return member ? member.portraitReady : null;
  });
  expect(result).toBe(false);
});

test('clientDisconnected removes peer from party map', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    var fakeEvent = { str: JSON.stringify({ t: 'ci', name: 'Bob', hpCurrent: 5, hpTotal: 10 }) };
    PartySync.handleIncoming('client-004', fakeEvent);
    PartySync.clientDisconnected('client-004');
    return PartySync.getParty()['client-004'];
  });
  expect(result).toBeUndefined();
});

test('handleIncoming drops malformed JSON silently', async ({ page }) => {
  await loadApp(page);
  const threw = await page.evaluate(() => {
    try {
      PartySync.handleIncoming('client-005', { str: '{not valid json' });
      return false;
    } catch(e) {
      return true;
    }
  });
  expect(threw).toBe(false);
});
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```
Expected: all tests pass (60 original + new party-sync tests).

- [ ] **Step 3: Commit**

```bash
git add tests/party-sync.spec.js
git commit -m "test: PartySync guards, handleIncoming, and peer lifecycle"
```

---

## Task 10: Final verification and push

- [ ] **Step 1: Run the full suite one last time**

```bash
npm test
```
Expected: all tests pass, no failures.

- [ ] **Step 2: Push to remote**

```bash
git pull --rebase
git push
```

---

## Implementation Notes

### Event field reference (verified from TaleSpire API docs)

| Event | Fields used |
|---|---|
| `syncMessageReceived` | `event.str` (the JSON string), `event.fromClient.id` (sender client ID) |
| `clientConnected` | `event.kind === 'clientConnected'`, `event.client.id` |
| `clientDisconnected` | `event.kind === 'clientDisconnected'`, `event.clientId` |

### What the party panel UI consumes (deferred to separate design)

`PartySync.getParty()` returns a plain object keyed by clientId:
```js
{
  "abc-123": {
    clientId:      "abc-123",
    name:          "Aldric",
    hpCurrent:     8,
    hpTotal:       12,
    portraitUrl:   "data:image/jpeg;base64,...",
    portraitReady: true
  }
}
```
`PartySync.onPartyChange(fn)` fires `fn(partyMap)` whenever the map changes. The UI panel (a separate feature) registers a callback here and re-renders accordingly.
