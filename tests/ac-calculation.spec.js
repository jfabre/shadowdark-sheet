// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, setAbility, selectArmor, getAC, switchTab } = require('./helpers/test-utils');

test.describe('AC Calculation', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('no armor: AC = 10 + DEX mod', async ({ page }) => {
    await setAbility(page, 'dex', 14); // +2
    await switchTab(page, 'gear');
    await selectArmor(page, 'none');
    expect(await getAC(page)).toBe('12');
  });

  test('leather armor: AC = 11 + DEX mod', async ({ page }) => {
    await setAbility(page, 'dex', 14); // +2
    await switchTab(page, 'gear');
    await selectArmor(page, 'leather');
    expect(await getAC(page)).toBe('13');
  });

  test('chainmail: AC = 13 + DEX mod', async ({ page }) => {
    await setAbility(page, 'dex', 12); // +1
    await switchTab(page, 'gear');
    await selectArmor(page, 'chainmail');
    expect(await getAC(page)).toBe('14');
  });

  test('plate: AC = 15, no DEX', async ({ page }) => {
    await setAbility(page, 'dex', 18); // +4, should be ignored
    await switchTab(page, 'gear');
    await selectArmor(page, 'plate');
    expect(await getAC(page)).toBe('15');
  });

  test('shield adds +2 AC', async ({ page }) => {
    await setAbility(page, 'dex', 10); // +0
    await switchTab(page, 'gear');
    await selectArmor(page, 'leather'); // AC 11
    await page.locator('#gear-shield').check();
    expect(await getAC(page)).toBe('13');
  });

  test('shield removed subtracts 2 AC', async ({ page }) => {
    await setAbility(page, 'dex', 10);
    await switchTab(page, 'gear');
    await selectArmor(page, 'leather'); // AC 11
    await page.locator('#gear-shield').check();
    expect(await getAC(page)).toBe('13');
    await page.locator('#gear-shield').uncheck();
    expect(await getAC(page)).toBe('11');
  });

  test('mithral does not change AC', async ({ page }) => {
    await setAbility(page, 'dex', 14); // +2
    await switchTab(page, 'gear');
    await selectArmor(page, 'chainmail'); // AC 13 + 2 = 15
    const before = await getAC(page);
    await page.locator('#gear-mithral').check();
    expect(await getAC(page)).toBe(before);
  });

  test('negative DEX mod reduces AC for light armor', async ({ page }) => {
    await setAbility(page, 'dex', 6); // -2
    await switchTab(page, 'gear');
    await selectArmor(page, 'leather'); // 11 - 2 = 9
    expect(await getAC(page)).toBe('9');
  });
});
