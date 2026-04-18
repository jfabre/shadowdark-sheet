// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, switchTab, selectCustomOption } = require('./helpers/test-utils');

test.describe('Class & Ancestry Selection', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    // Class/ancestry selectors are on the core tab (default)
  });

  test('selecting Fighter shows fighter features', async ({ page }) => {
    await selectCustomOption(page, 'class-select-trigger', 'Fighter');
    await switchTab(page, 'class');

    const featuresBody = page.locator('#features-body');
    if (!(await featuresBody.isVisible())) {
      await page.locator('#features-toggle').click();
    }

    const text = await featuresBody.textContent();
    expect(text).toContain('Hauler');
    expect(text).toContain('Weapon Mastery');
  });

  test('selecting Wizard shows wizard features', async ({ page }) => {
    await selectCustomOption(page, 'class-select-trigger', 'Wizard');
    await switchTab(page, 'class');

    const featuresBody = page.locator('#features-body');
    if (!(await featuresBody.isVisible())) {
      await page.locator('#features-toggle').click();
    }

    const text = await featuresBody.textContent();
    expect(text).toContain('Learning Spells');
  });

  test('selecting Thief shows thief features', async ({ page }) => {
    await selectCustomOption(page, 'class-select-trigger', 'Thief');
    await switchTab(page, 'class');

    const featuresBody = page.locator('#features-body');
    if (!(await featuresBody.isVisible())) {
      await page.locator('#features-toggle').click();
    }

    const text = await featuresBody.textContent();
    expect(text).toContain('Backstab');
  });

  test('selecting Priest shows priest features', async ({ page }) => {
    await selectCustomOption(page, 'class-select-trigger', 'Priest');
    await switchTab(page, 'class');

    const featuresBody = page.locator('#features-body');
    if (!(await featuresBody.isVisible())) {
      await page.locator('#features-toggle').click();
    }

    const text = await featuresBody.textContent();
    expect(text).toContain('Turn Undead');
  });

  test('selecting Human ancestry shows human trait', async ({ page }) => {
    await selectCustomOption(page, 'ancestry-select-trigger', 'Human');
    await switchTab(page, 'class');

    const racialBody = page.locator('#racial-features-body');
    if (!(await racialBody.isVisible())) {
      await page.locator('#racial-toggle').click();
    }

    const text = await racialBody.textContent();
    expect(text).toContain('Ambitious');
  });

  test('selecting Elf ancestry shows elf traits', async ({ page }) => {
    await selectCustomOption(page, 'ancestry-select-trigger', 'Elf');
    await switchTab(page, 'class');

    const racialBody = page.locator('#racial-features-body');
    if (!(await racialBody.isVisible())) {
      await page.locator('#racial-toggle').click();
    }

    const text = await racialBody.textContent();
    expect(text).toContain('Farsight');
  });

  test('selecting Dwarf ancestry shows dwarf traits', async ({ page }) => {
    await selectCustomOption(page, 'ancestry-select-trigger', 'Dwarf');
    await switchTab(page, 'class');

    const racialBody = page.locator('#racial-features-body');
    if (!(await racialBody.isVisible())) {
      await page.locator('#racial-toggle').click();
    }

    const text = await racialBody.textContent();
    expect(text).toContain('Stout');
  });

  test('changing class updates features', async ({ page }) => {
    await selectCustomOption(page, 'class-select-trigger', 'Fighter');
    await switchTab(page, 'class');

    const featuresBody = page.locator('#features-body');
    if (!(await featuresBody.isVisible())) {
      await page.locator('#features-toggle').click();
    }

    let text = await featuresBody.textContent();
    expect(text).toContain('Weapon Mastery');

    // Switch back to core to change class
    await switchTab(page, 'core');
    await selectCustomOption(page, 'class-select-trigger', 'Wizard');
    await switchTab(page, 'class');

    text = await featuresBody.textContent();
    expect(text).not.toContain('Weapon Mastery');
    expect(text).toContain('Learning Spells');
  });
});
