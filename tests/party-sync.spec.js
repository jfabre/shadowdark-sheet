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
