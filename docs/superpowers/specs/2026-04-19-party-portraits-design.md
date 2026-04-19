# Design Spec: Party Portraits via TS.sync

**Date:** 2026-04-19
**Feature:** Real-time portrait sharing between Dark Spire clients on the same board

---

## Overview

When a player sets or updates their portrait, a downscaled (128×128) version is automatically
chunked and broadcast to all other Dark Spire clients on the same board via `TS.sync`. Each
client reassembles the chunks and displays portraits in a new party panel. Works entirely within
TaleSpire's existing API — no external infrastructure.

The feature is silently disabled when running outside TaleSpire (e.g. in a plain browser).
A client never sends portrait data if it has no portrait set.

---

## Manifest Changes

Three additions to `manifest.json`:

**1. interopId** — enables `TS.sync`:
```json
"interop": {
  "id": "37ff6976-7da5-48f8-815c-2801420a55f6"
}
```

**2. Sync subscriptions** — to receive messages and peer connect/disconnect events:
```json
"sync": {
  "onSyncMessage": "onSyncMessage",
  "onClientEvent": "onSyncClientEvent"
}
```

**3. `runInBackground` capability** — required so that sync messages are received even when the
panel is not the focused symbiote:
```json
"capabilities": ["runInBackground"]
```

---

## Default Portrait

A 128×128 placeholder SVG (a generic silhouette, inline data URI) is shown in the party panel
whenever a peer's portrait has not yet been received. It is defined as a constant in `script.js`
and never transmitted over the network — it is purely a local UI fallback.

---

## PartySync Module

A new self-contained module added to `script.js`, alongside `PortraitStore`. Responsible for all
sending and receiving. Exposes a minimal interface to the rest of the sheet:

```js
PartySync.init()                          // called once on TS hasInitialized
PartySync.broadcastPortraitAndInfo()      // called by PortraitStore.set() after every portrait save
                                          // also called when HP or name changes
PartySync.getParty()                      // returns Map<clientId, PartyMember>
PartySync.onPartyChange(fn)               // register callback — fired whenever map changes
```

**PartyMember shape:**
```js
{
  clientId:       string,
  name:           string,   // character name, empty string if not yet received
  hpCurrent:      number,   // current HP
  hpTotal:        number,   // max HP
  portraitUrl:    string,   // data URL, or DEFAULT_PORTRAIT if not yet received
  portraitReady:  boolean,  // false until first complete portrait transfer received
}
```

### TaleSpire guard

`PartySync.init()` checks for the presence of `window.TS` before doing anything. If absent
(plain browser), it returns immediately and all subsequent calls are no-ops. No errors are thrown.

---

## Protocol

### Message types

**Character info (`ci`)**
```json
{ "t": "ci", "name": "Aldric", "hpCurrent": 8, "hpTotal": 12 }
```
Sent to `"board"` immediately when triggered. Lightweight — one message, no chunking. Sent:
- On `PartySync.init()` if a portrait exists
- Whenever name, hpCurrent, or hpTotal changes
- As the first message before portrait chunks begin

**Portrait chunk (`pc`)**
```json
{ "t": "pc", "s": 3, "n": 42, "d": "...470 chars of base64..." }
```
- `s` = zero-based sequence number
- `n` = total chunk count
- `d` = base64 data slice (max 470 chars, leaving headroom within the 500-char TS.sync limit)

**Portrait request (`pr`)**
```json
{ "t": "pr" }
```
Sent to `"board"` on init. Asks all connected peers to re-broadcast their portrait and info.
Used by late joiners to catch up.

---

## Send Flow

```
broadcastPortraitAndInfo(charInfo):
  // Guard: do nothing if not in TaleSpire
  if (!window.TS) return

  // Guard: do nothing if no portrait is set
  if (!PortraitStore.has()) return

  1. Send { t:"ci", name, hpCurrent, hpTotal } to "board"

  2. Generate 128×128 share portrait:
       draw stored portrait onto 128×128 canvas
       base64 = canvas.toDataURL('image/jpeg', 0.7)
                      .replace('data:image/jpeg;base64,', '')

  3. Increment generation counter (cancels any in-progress send)
     gen = ++_sendGeneration

  4. Split base64 into chunks of 470 chars
     For each chunk i (0-indexed), with 15ms delay between sends:
       if (gen !== _sendGeneration) return  // cancelled
       TS.sync.send(JSON.stringify({ t:"pc", s:i, n:total, d:chunk }), "board")
```

---

## Receive Flow

```
onSyncMessage(event):
  senderId = event.payload.senderId
  msg = JSON.parse(event.payload.message)

  switch msg.t:

    case "ci":
      update partyMap[senderId].name, hpCurrent, hpTotal
      if partyMap[senderId] is new: set portraitUrl = DEFAULT_PORTRAIT, portraitReady = false
      notify onPartyChange callbacks

    case "pc":
      buf = receiveBuffers[senderId] or create { chunks:[], total:msg.n, timer:null }
      buf.chunks[msg.s] = msg.d
      reset buf.timer to 15 second timeout (on expire: delete receiveBuffers[senderId])
      if non-null chunk count === msg.n:
        partyMap[senderId].portraitUrl = "data:image/jpeg;base64," + buf.chunks.join("")
        partyMap[senderId].portraitReady = true
        delete receiveBuffers[senderId]
        notify onPartyChange callbacks

    case "pr":
      // A peer is requesting our data (they just joined or reloaded)
      broadcastPortraitAndInfo()
```

---

## Peer Lifecycle

**`onSyncClientEvent`:**
- `clientConnected`:
  - Add skeleton entry to partyMap with `portraitUrl = DEFAULT_PORTRAIT`
  - Call `broadcastPortraitAndInfo()` so they receive our data
  - Notify party panel (shows placeholder immediately)
- `clientDisconnected`:
  - Remove from partyMap
  - Delete any in-progress receive buffer for this sender
  - Notify party panel

**On `PartySync.init()`:**
1. If `!window.TS` → return (no-op)
2. Call `TS.sync.getClientsConnected()` → populate partyMap skeletons with DEFAULT_PORTRAIT
3. Send `{ t:"pr" }` to `"board"` → triggers existing peers to broadcast to us
4. If portrait is set: call `broadcastPortraitAndInfo()` → sends our data to existing peers

---

## Character Info Sync Triggers

`broadcastPortraitAndInfo()` is called (in addition to portrait set) whenever:
- Character name changes (`#char-name` input)
- Current HP changes (`#char-hp` input)
- Max HP changes (`#char-hp-max` input)

These send only a `ci` message (no portrait chunks) since the portrait hasn't changed.
Implementation: debounced 300ms to avoid flooding on rapid typing.

---

## Error Handling

| Scenario | Handling |
|---|---|
| Running outside TaleSpire (`!window.TS`) | `init()` returns immediately; all calls are no-ops |
| No portrait set | `broadcastPortraitAndInfo()` returns immediately without sending |
| Chunk lost / transfer incomplete | 15s timeout discards receive buffer; next portrait update re-sends |
| Portrait updated mid-send | Generation counter cancels in-flight chunks |
| Peer disconnects mid-receive | `clientDisconnected` clears their receive buffer |
| `TS.sync.send` throws | Caught, logged via `TS.debug.log`, send aborted |
| Malformed JSON in `onSyncMessage` | try/catch around `JSON.parse`, message silently dropped |

---

## Testing

The chunking/reassembly logic is extracted into pure functions testable without TS:

- `chunkString(str, size)` → array of chunks
- `reassembleChunks(chunks, total)` → string or null if incomplete

Tests:
- `chunkString` splits correctly at boundary, last chunk may be shorter
- `chunkString` then `reassembleChunks` round-trips correctly
- `reassembleChunks` returns null if any chunk missing
- Generation counter: second `broadcastPortraitAndInfo()` call cancels first
- TaleSpire guard: all public methods are no-ops when `window.TS` is absent
- No-portrait guard: `broadcastPortraitAndInfo()` does not call `TS.sync.send` if no portrait
- 15s timeout: incomplete receive buffer is discarded after timeout fires

Existing 60 tests must stay green.

---

## Out of Scope

- Party panel UI/layout (separate design pass)
- Syncing any character data beyond name, hpCurrent, hpTotal
- Supporting different symbiotes (Dark Spire only, same interopId)
- Guaranteed delivery / acknowledgement protocol
- HP change broadcasting without a portrait (ci-only sends still require portrait to be set)
