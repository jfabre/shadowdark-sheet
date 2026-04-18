// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, setAbility, switchTab, selectArmor, getEncumbrance } = require('./helpers/test-utils');

test.describe('Encumbrance', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('base capacity equals STR score', async ({ page }) => {
    await setAbility(page, 'str', 14);
    await switchTab(page, 'gear');
    const enc = await getEncumbrance(page);
    expect(enc.max).toBe(14);
  });

  test('fighter gets hauler bonus from CON', async ({ page }) => {
    // Class selector is on core tab
    await page.locator('#char-class').selectOption('Fighter');
    await setAbility(page, 'str', 10);
    await setAbility(page, 'con', 16); // +3
    await switchTab(page, 'gear');
    const enc = await getEncumbrance(page);
    expect(enc.max).toBe(13); // 10 + 3
  });

  test('non-fighter gets no hauler bonus', async ({ page }) => {
    await page.locator('#char-class').selectOption('Wizard');
    await setAbility(page, 'str', 10);
    await setAbility(page, 'con', 18); // +4 but not fighter
    await switchTab(page, 'gear');
    const enc = await getEncumbrance(page);
    expect(enc.max).toBe(10);
  });

  test('fighter with negative CON gets no hauler penalty', async ({ page }) => {
    await page.locator('#char-class').selectOption('Fighter');
    await setAbility(page, 'str', 10);
    await setAbility(page, 'con', 6); // -2, but max(0, -2) = 0
    await switchTab(page, 'gear');
    const enc = await getEncumbrance(page);
    expect(enc.max).toBe(10);
  });

  test('armor adds slots', async ({ page }) => {
    await switchTab(page, 'gear');
    await selectArmor(page, 'plate'); // 3 slots
    const enc = await getEncumbrance(page);
    expect(enc.used).toBe(3);
  });

  test('shield adds 1 slot', async ({ page }) => {
    await switchTab(page, 'gear');
    await selectArmor(page, 'none');
    await page.locator('#gear-shield').check();
    const enc = await getEncumbrance(page);
    expect(enc.used).toBe(1);
  });

  test('mithral reduces armor slots by 1', async ({ page }) => {
    await switchTab(page, 'gear');
    await selectArmor(page, 'chainmail'); // 2 slots
    const before = await getEncumbrance(page);
    await page.locator('#gear-mithral').check();
    const after = await getEncumbrance(page);
    expect(after.used).toBe(before.used - 1);
  });

  test('first 100 coins are free, then 1 slot per 100', async ({ page }) => {
    await switchTab(page, 'gear');
    await selectArmor(page, 'none');
    // 100 coins = free
    await page.locator('#gear-gp').fill('100');
    await page.locator('#gear-gp').dispatchEvent('input');
    let enc = await getEncumbrance(page);
    expect(enc.used).toBe(0);

    // 101 coins = 1 slot
    await page.locator('#gear-gp').fill('101');
    await page.locator('#gear-gp').dispatchEvent('input');
    enc = await getEncumbrance(page);
    expect(enc.used).toBe(1);

    // 300 coins = 2 slots
    await page.locator('#gear-gp').fill('300');
    await page.locator('#gear-gp').dispatchEvent('input');
    enc = await getEncumbrance(page);
    expect(enc.used).toBe(2);
  });

  test('adding inventory items increases slots', async ({ page }) => {
    await switchTab(page, 'gear');
    await page.locator('#inv-add-btn').click();
    const enc = await getEncumbrance(page);
    expect(enc.used).toBeGreaterThanOrEqual(1);
  });
});
