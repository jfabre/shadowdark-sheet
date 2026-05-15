// @ts-check
// Tests for the persistence-hardening layer in script.js — the
// StorageAdapter load-state machine, the recovery banner, the
// last-known-good native-localStorage backup, and the restore flow.
//
// Strategy: install a fake `window.TS` *before* the app script runs so
// the in-page StorageAdapter takes the TaleSpire code path. The fake
// records every getBlob/setBlob call and lets each test configure
// success/failure behavior.

const { test, expect } = require('@playwright/test');

/**
 * Install a mocked window.TS before the page script executes.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} opts
 * @param {'ok'|'throw'|'corrupt'|'newer-schema'} [opts.getBlobMode='ok']
 * @param {string|null} [opts.initialBlob=null]   raw value for getBlob in 'ok' mode
 * @param {boolean} [opts.fireHasInitialized=true] whether to dispatch hasInitialized
 */
async function installFakeTS(page, opts) {
  opts = opts || {};
  const getBlobMode = opts.getBlobMode || 'ok';
  const initialBlob = opts.initialBlob === undefined ? null : opts.initialBlob;
  const fireHasInitialized = opts.fireHasInitialized !== false;

  await page.addInitScript(({ getBlobMode, initialBlob, fireHasInitialized }) => {
    /** @type {{calls: Array<{api: string, payload?: string}>, campaignBlob: string|null, globalBlob: string|null}} */
    const recorder = { calls: [], campaignBlob: initialBlob, globalBlob: null };

    function makeBlobApi(which) {
      return {
        async getBlob() {
          recorder.calls.push({ api: which + '.getBlob' });
          if (which === 'campaign') {
            if (getBlobMode === 'throw') throw new Error('simulated read failure');
            if (getBlobMode === 'corrupt') return '{not valid json';
            if (getBlobMode === 'newer-schema') return JSON.stringify({ _schemaVersion: 999, sd_char: '{"name":"future"}' });
            return recorder.campaignBlob;
          }
          return recorder.globalBlob;
        },
        async setBlob(payload) {
          recorder.calls.push({ api: which + '.setBlob', payload: payload });
          if (which === 'campaign') recorder.campaignBlob = payload;
          else recorder.globalBlob = payload;
        },
      };
    }

    window.__tsRecorder = recorder;
    window.TS = {
      localStorage: {
        campaign: makeBlobApi('campaign'),
        global: makeBlobApi('global'),
      },
      campaigns: { whereAmI: async () => ({ id: 'test-campaign' }) },
      debug: { log: () => {} },
    };

    if (fireHasInitialized) {
      // Dispatch hasInitialized once the page registers the global handler.
      const fire = () => {
        if (typeof window.onTaleSpireStateChange === 'function') {
          window.onTaleSpireStateChange({ kind: 'hasInitialized' });
        } else {
          setTimeout(fire, 10);
        }
      };
      fire();
    }
  }, { getBlobMode, initialBlob, fireHasInitialized });
}

/** Read the recorder back from the page. */
async function getRecorder(page) {
  return page.evaluate(() => window.__tsRecorder);
}

/** Wait for boot() to have run far enough that the banner state is settled. */
async function waitForBootSettled(page) {
  await page.waitForFunction(() => window.SD && typeof window.SD.getBackupInfo === 'function');
}

test.describe('StorageAdapter — failed-load → overwrite protection', () => {
  test('healthy load: edits eventually flush to setBlob', async ({ page }) => {
    await installFakeTS(page, { getBlobMode: 'ok', initialBlob: null });
    await page.goto('/');
    await waitForBootSettled(page);

    // Banner should be hidden when storage is healthy.
    await expect(page.locator('#storage-banner')).toBeHidden();

    // Dismiss the creation guide if it appeared.
    const guide = page.locator('#creation-guide');
    if (await guide.isVisible()) await page.locator('#guide-close').click();

    await page.locator('#char-name').fill('Wulfgar');
    await page.locator('#char-name').dispatchEvent('input');

    // Wait for debounced flush (500ms) + safety margin
    await page.waitForTimeout(900);

    const rec = await getRecorder(page);
    const setBlobs = rec.calls.filter(c => c.api === 'campaign.setBlob');
    expect(setBlobs.length).toBeGreaterThan(0);
    const lastPayload = JSON.parse(setBlobs[setBlobs.length - 1].payload);
    expect(lastPayload.sd_char).toContain('Wulfgar');
    expect(lastPayload._schemaVersion).toBe(1);
  });

  test('getBlob throws → banner appears, NO setBlob is ever called', async ({ page }) => {
    await installFakeTS(page, { getBlobMode: 'throw' });
    await page.goto('/');
    await waitForBootSettled(page);

    await expect(page.locator('#storage-banner')).toBeVisible();

    // User types something — but writes must be blocked.
    const guide = page.locator('#creation-guide');
    if (await guide.isVisible()) await page.locator('#guide-close').click();
    await page.locator('#char-name').fill('ShouldNotPersist');
    await page.locator('#char-name').dispatchEvent('input');
    await page.waitForTimeout(900);

    const rec = await getRecorder(page);
    const setBlobs = rec.calls.filter(c => c.api === 'campaign.setBlob');
    expect(setBlobs).toEqual([]);
  });

  test('corrupt blob → banner appears, no overwrite', async ({ page }) => {
    await installFakeTS(page, { getBlobMode: 'corrupt' });
    await page.goto('/');
    await waitForBootSettled(page);

    await expect(page.locator('#storage-banner')).toBeVisible();

    const rec = await getRecorder(page);
    const setBlobs = rec.calls.filter(c => c.api === 'campaign.setBlob');
    expect(setBlobs).toEqual([]);
  });

  test('newer schema → refuses to write to avoid downgrading', async ({ page }) => {
    await installFakeTS(page, { getBlobMode: 'newer-schema' });
    await page.goto('/');
    await waitForBootSettled(page);

    await expect(page.locator('#storage-banner')).toBeVisible();

    const guide = page.locator('#creation-guide');
    if (await guide.isVisible()) await page.locator('#guide-close').click();
    await page.locator('#char-name').fill('rollback');
    await page.locator('#char-name').dispatchEvent('input');
    await page.waitForTimeout(900);

    const rec = await getRecorder(page);
    const setBlobs = rec.calls.filter(c => c.api === 'campaign.setBlob');
    expect(setBlobs).toEqual([]);
  });

  test('TS-ready timeout (hasInitialized never fires) → banner + no writes', async ({ page }) => {
    await installFakeTS(page, { getBlobMode: 'ok', initialBlob: '{"sd_char":"{}"}', fireHasInitialized: false });
    await page.goto('/');
    // Boot waits 3s for hasInitialized before proceeding.
    await waitForBootSettled(page);
    await expect(page.locator('#storage-banner')).toBeVisible({ timeout: 6000 });

    const rec = await getRecorder(page);
    // getBlob may or may not have been called (depends on whether init
    // returned early); the critical invariant is that we did not write.
    const setBlobs = rec.calls.filter(c => c.api === 'campaign.setBlob');
    expect(setBlobs).toEqual([]);
  });
});

test.describe('Last-known-good backup snapshot', () => {
  test('saving a new character writes prior value to native localStorage backup', async ({ page }) => {
    await installFakeTS(page, {
      getBlobMode: 'ok',
      initialBlob: JSON.stringify({
        _schemaVersion: 1,
        sd_char: JSON.stringify({ name: 'OldHero' }),
      }),
    });
    await page.goto('/');
    await waitForBootSettled(page);

    // Sanity: name input is populated from the stored blob — but the app
    // reads sd_char into window.SD.character on boot.
    const initial = await page.evaluate(() => window.SD.character.name);
    expect(initial).toBe('OldHero');

    const guide = page.locator('#creation-guide');
    if (await guide.isVisible()) await page.locator('#guide-close').click();

    await page.locator('#char-name').fill('NewHero');
    await page.locator('#char-name').dispatchEvent('input');
    await page.waitForTimeout(900);

    const backup = await page.evaluate(() => ({
      raw: window.localStorage.getItem('sd_char_backup'),
      name: window.localStorage.getItem('sd_char_backup_name'),
      at: window.localStorage.getItem('sd_char_backup_at'),
    }));
    expect(backup.raw).toBeTruthy();
    const parsed = JSON.parse(backup.raw);
    expect(parsed.name).toBe('OldHero');
    expect(backup.name).toBe('OldHero');
    expect(backup.at).toBeTruthy();
  });

  test('Restore menu item appears once a backup exists and differs from current', async ({ page }) => {
    await installFakeTS(page, {
      getBlobMode: 'ok',
      initialBlob: JSON.stringify({
        _schemaVersion: 1,
        sd_char: JSON.stringify({ name: 'OldHero' }),
      }),
    });
    await page.goto('/');
    await waitForBootSettled(page);

    const guide = page.locator('#creation-guide');
    if (await guide.isVisible()) await page.locator('#guide-close').click();

    // Boot normalizes the character (adds combat defaults etc.) which on
    // its own already produces a snapshot of the previous-boot state.
    // Make an explicit edit to be thorough, then verify menu shows it.
    await page.locator('#char-name').fill('NewHero');
    await page.locator('#char-name').dispatchEvent('input');
    await page.waitForTimeout(900);

    await page.locator('#menu-btn').click();
    await expect(page.locator('#menu-restore')).toBeVisible();

    // And the backup payload still contains the prior name.
    const backupName = await page.evaluate(() => window.localStorage.getItem('sd_char_backup_name'));
    expect(backupName).toBe('OldHero');
  });
});

test.describe('Recovery banner Export button', () => {
  test('banner export copies the in-memory character even when storage failed', async ({ page }) => {
    await installFakeTS(page, { getBlobMode: 'throw' });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await waitForBootSettled(page);
    await expect(page.locator('#storage-banner')).toBeVisible();

    // Inject an in-memory character (simulating a user who somehow has data loaded).
    await page.evaluate(() => { window.SD.character = { name: 'Lost' }; });

    await page.locator('#storage-banner-export').click();
    // Allow async clipboard write.
    await page.waitForTimeout(150);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const payload = JSON.parse(text);
    expect(payload.character.name).toBe('Lost');
  });
});
