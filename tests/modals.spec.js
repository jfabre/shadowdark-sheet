// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, openMenu } = require('./helpers/test-utils');

test.describe('Modal Management', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('help modal opens and closes', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-help').click();
    await expect(page.locator('#help-modal')).toBeVisible();

    await page.locator('#help-close').click();
    await expect(page.locator('#help-modal')).toBeHidden();
  });

  test('about modal opens and closes', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-about').click();
    await expect(page.locator('#about-modal')).toBeVisible();

    await page.locator('#about-close').click();
    await expect(page.locator('#about-modal')).toBeHidden();
  });

  test('help modal dismisses on overlay click', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-help').click();
    await expect(page.locator('#help-modal')).toBeVisible();

    // Click the overlay (top-left corner, outside the modal content)
    await page.locator('#help-modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#help-modal')).toBeHidden();
  });

  test('about modal dismisses on overlay click', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-about').click();
    await expect(page.locator('#about-modal')).toBeVisible();

    await page.locator('#about-modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#about-modal')).toBeHidden();
  });

  test('creation guide opens from menu', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-guide').click();
    await expect(page.locator('#creation-guide')).toBeVisible();

    await page.locator('#guide-close').click();
    await expect(page.locator('#creation-guide')).toBeHidden();
  });

  test('creation guide dismisses on overlay click', async ({ page }) => {
    await openMenu(page);
    await page.locator('#menu-guide').click();
    await expect(page.locator('#creation-guide')).toBeVisible();

    await page.locator('#creation-guide').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#creation-guide')).toBeHidden();
  });

  test('creation guide auto-shows on empty sheet', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('#creation-guide')).toBeVisible();
  });
});
