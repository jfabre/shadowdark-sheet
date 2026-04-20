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

// ── broadcastCi ───────────────────────────────────────

test('PartySync.broadcastCi is a no-op when window.TS is absent', async ({ page }) => {
  await loadApp(page);
  const threw = await page.evaluate(() => {
    try {
      PartySync.broadcastCi();
      return false;
    } catch(e) {
      return true;
    }
  });
  expect(threw).toBe(false);
});

test('PartySync.broadcastCi sends ci but no pc chunks even when a portrait is set', async ({ page }) => {
  await loadApp(page);
  const types = await page.evaluate(() => {
    var seen = [];
    window.TS = { sync: { send: function(jsonStr) { seen.push(JSON.parse(jsonStr).t); } } };
    // Simulate a portrait being present.
    PortraitStore._testOverride = 'data:image/jpeg;base64,fakedata';
    var origGet = PortraitStore.get;
    PortraitStore.get = function() { return 'data:image/jpeg;base64,fakedata'; };
    PartySync.broadcastCi();
    PortraitStore.get = origGet;
    return seen;
  });
  expect(types).toEqual(['ci']);
  expect(types).not.toContain('pc');
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
    // Simulate sending a small "portrait" as 2 chunks of 4 chars each.
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

test('handleIncoming "pc" partial transfer does not create a party entry', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    // Send only chunk 0 of a 3-chunk transfer.
    var fakeEvent = { str: JSON.stringify({ t: 'pc', s: 0, n: 3, d: 'aaaa' }) };
    PartySync.handleIncoming('client-003', fakeEvent);
    // Partial pc transfer uses _receiveBuffers, not _partyMap — no entry yet.
    return PartySync.getParty()['client-003'];
  });
  expect(result).toBeUndefined();
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

// ── pc guard: invalid n/s fields ───────────────────────

test('handleIncoming "pc" with missing n drops the message', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    PartySync.handleIncoming('client-006', { str: JSON.stringify({ t: 'pc', s: 0, d: 'aaaa' }) });
    return PartySync.getParty()['client-006'];
  });
  expect(result).toBeUndefined();
});

test('handleIncoming "pc" with n=0 drops the message', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    PartySync.handleIncoming('client-007', { str: JSON.stringify({ t: 'pc', s: 0, n: 0, d: 'aaaa' }) });
    return PartySync.getParty()['client-007'];
  });
  expect(result).toBeUndefined();
});

test('handleIncoming "pc" with s >= n drops the message', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    PartySync.handleIncoming('client-008', { str: JSON.stringify({ t: 'pc', s: 3, n: 3, d: 'aaaa' }) });
    return PartySync.getParty()['client-008'];
  });
  expect(result).toBeUndefined();
});

test('handleIncoming "pc" with string-coercible n and s still works', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    var fakeB64 = 'aabbccdd';
    var chunks = chunkString(fakeB64, 4);
    chunks.forEach(function(chunk, i) {
      // Send n and s as strings to verify coercion tolerance.
      var fakeEvent = { str: JSON.stringify({ t: 'pc', s: String(i), n: String(chunks.length), d: chunk }) };
      PartySync.handleIncoming('client-009', fakeEvent);
    });
    var member = PartySync.getParty()['client-009'];
    return member ? member.portraitReady : false;
  });
  expect(result).toBe(true);
});

// ── clientConnected guard ──────────────────────────────

test('clientConnected with undefined id creates no ghost entry', async ({ page }) => {
  await loadApp(page);
  const result = await page.evaluate(() => {
    PartySync.clientConnected(undefined);
    return PartySync.getParty()[undefined];
  });
  expect(result).toBeUndefined();
});
