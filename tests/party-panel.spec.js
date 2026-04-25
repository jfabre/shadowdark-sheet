const { test, expect } = require('@playwright/test');
const { loadApp } = require('./helpers/test-utils');

test.beforeEach(async ({ page }) => {
  await loadApp(page);
});

// ── Visibility ──────────────────────────────────────────────────────────────

test('view toggle hidden when party is empty', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({}));
  const display = await page.$eval('#view-toggle', el => el.style.display);
  expect(display).toBe('none');
});

test('view toggle visible when party has one member', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  const display = await page.$eval('#view-toggle', el => el.style.display);
  expect(display).toBe('');
});

test('view toggle hidden again when party empties', async ({ page }) => {
  await page.evaluate(() => {
    renderPartyPanel({ 'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false } });
    renderPartyPanel({});
  });
  const display = await page.$eval('#view-toggle', el => el.style.display);
  expect(display).toBe('none');
});

test('char-pane visible and party-pane hidden when party empties', async ({ page }) => {
  await page.evaluate(() => {
    renderPartyPanel({ 'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false } });
    renderPartyPanel({});
  });
  const charDisplay  = await page.$eval('#char-pane',  el => el.style.display);
  const partyDisplay = await page.$eval('#party-pane', el => el.style.display);
  expect(charDisplay).toBe('');
  expect(partyDisplay).toBe('none');
});

// ── Card count ───────────────────────────────────────────────────────────────

test('renders one card per party member', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false },
    'c2': { clientId: 'c2', name: 'Brom', hpCurrent: 5, hpTotal: 10, portraitUrl: '', portraitReady: false },
    'c3': { clientId: 'c3', name: 'Cael', hpCurrent: 2, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  const count = await page.$$eval('.party-card', cards => cards.length);
  expect(count).toBe(3);
});

test('cards are rendered inside #party-pane', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  const count = await page.$$eval('#party-pane .party-card', cards => cards.length);
  expect(count).toBe(1);
});

// ── Portrait ─────────────────────────────────────────────────────────────────

test('portrait uses portraitUrl when portraitReady is true', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: 'data:image/png;base64,abc', portraitReady: true }
  }));
  const src = await page.$eval('.party-portrait', img => img.src);
  expect(src).toContain('data:image/png;base64,abc');
});

// ── Name ─────────────────────────────────────────────────────────────────────

test('renders member name in party-name element', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  const name = await page.$eval('.party-name', el => el.textContent);
  expect(name).toBe('Aria');
});

test('renders Adventurer when name is empty', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: '', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  const name = await page.$eval('.party-name', el => el.textContent);
  expect(name).toBe('Adventurer');
});

// ── Dot states ───────────────────────────────────────────────────────────────

test('3 lit-ok dots when hp is full', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  const dots = await page.$$eval('.party-dot', dots => dots.map(d => d.className));
  expect(dots).toEqual(['party-dot lit-ok', 'party-dot lit-ok', 'party-dot lit-ok']);
});

test('2 lit-hurt dots when hp is about half', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 5, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  const dots = await page.$$eval('.party-dot', dots => dots.map(d => d.className));
  expect(dots).toEqual(['party-dot lit-hurt', 'party-dot lit-hurt', 'party-dot']);
});

test('1 lit-crit dot when hp is critical', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 2, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  const dots = await page.$$eval('.party-dot', dots => dots.map(d => d.className));
  expect(dots).toEqual(['party-dot lit-crit', 'party-dot', 'party-dot']);
});

test('0 lit dots when hp total is unknown', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 0, hpTotal: 0, portraitUrl: '', portraitReady: false }
  }));
  const dots = await page.$$eval('.party-dot', dots => dots.map(d => d.className));
  expect(dots).toEqual(['party-dot', 'party-dot', 'party-dot']);
});

// ── Toggle interaction ────────────────────────────────────────────────────────

test('btn-party becomes active after clicking party button', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  await page.click('#btn-party');
  const partyActive = await page.$eval('#btn-party', el => el.classList.contains('active'));
  const charActive  = await page.$eval('#btn-char',  el => el.classList.contains('active'));
  expect(partyActive).toBe(true);
  expect(charActive).toBe(false);
});

test('party-pane visible after clicking party button', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  await page.click('#btn-party');
  const partyDisplay = await page.$eval('#party-pane', el => el.style.display);
  const charDisplay  = await page.$eval('#char-pane',  el => el.style.display);
  expect(partyDisplay).toBe('');
  expect(charDisplay).toBe('none');
});

test('char-pane restored after switching back to character view', async ({ page }) => {
  await page.evaluate(() => renderPartyPanel({
    'c1': { clientId: 'c1', name: 'Aria', hpCurrent: 10, hpTotal: 10, portraitUrl: '', portraitReady: false }
  }));
  await page.click('#btn-party');
  await page.click('#btn-char');
  const charDisplay  = await page.$eval('#char-pane',  el => el.style.display);
  const partyDisplay = await page.$eval('#party-pane', el => el.style.display);
  expect(charDisplay).toBe('');
  expect(partyDisplay).toBe('none');
});
