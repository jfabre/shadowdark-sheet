// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, setAbility, openMenu } = require('./helpers/test-utils');

test.describe('Import / Export Roundtrip', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('export produces valid JSON with character data', async ({ page }) => {
    await page.locator('#char-name').fill('Thorin');
    await page.locator('#char-name').dispatchEvent('input');
    await setAbility(page, 'str', 16);
    await setAbility(page, 'dex', 12);

    // Wait for debounced auto-save (300ms + margin)
    await page.waitForTimeout(500);

    // Grant clipboard permission and intercept
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await openMenu(page);
    await page.locator('#menu-export').click();

    // Read clipboard
    const json = await page.evaluate(() => navigator.clipboard.readText());

    expect(json).toBeTruthy();
    const data = JSON.parse(json);
    expect(data.character).toBeDefined();
    expect(data.character.name).toBe('Thorin');
    expect(data.character.abilities.STR).toBe(16);
    expect(data.character.abilities.DEX).toBe(12);
  });

  test('import restores character fields', async ({ page }) => {
    const payload = {
      _version: '0.7.1',
      character: {
        name: 'Gandalf',
        class: 'Wizard',
        abilities: { STR: 10, DEX: 14, CON: 12, INT: 18, WIS: 16, CHA: 14 },
        hpCurrent: 4, hpMax: 4, level: 1
      }
    };

    await openMenu(page);
    await page.locator('#menu-import').click();
    await expect(page.locator('#import-modal')).toBeVisible();

    await page.locator('#import-textarea').fill(JSON.stringify(payload));
    await page.locator('#import-textarea').dispatchEvent('input');
    await page.locator('#import-submit').click();

    // Confirm the import
    await expect(page.locator('#import-confirm')).toBeVisible();
    await page.locator('#confirm-replace').click();

    // Import triggers location.reload() after 500ms
    await page.waitForLoadState('load');
    // Dismiss guide if it appears
    const guide = page.locator('#creation-guide');
    if (await guide.isVisible()) {
      await page.locator('#guide-close').click();
    }

    // Verify fields
    await expect(page.locator('#char-name')).toHaveValue('Gandalf');
    await expect(page.locator('#ability-int')).toHaveValue('18');
    await expect(page.locator('#ability-str')).toHaveValue('10');
  });

  test('import with invalid JSON shows error', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-import').click();

    await page.locator('#import-textarea').fill('not valid json {{{');
    await page.locator('#import-textarea').dispatchEvent('input');
    await page.locator('#import-submit').click();

    await expect(page.locator('#import-error')).toBeVisible();
  });

  test('import with missing character object shows error', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-import').click();

    await page.locator('#import-textarea').fill('{"name": "test"}');
    await page.locator('#import-textarea').dispatchEvent('input');
    await page.locator('#import-submit').click();

    await expect(page.locator('#import-error')).toBeVisible();
  });

  test('import cancel closes modal', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-import').click();
    await expect(page.locator('#import-modal')).toBeVisible();

    await page.locator('#import-cancel').click();
    await expect(page.locator('#import-modal')).toBeHidden();
  });
});
