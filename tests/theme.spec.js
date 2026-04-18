// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, openMenu } = require('./helpers/test-utils');

async function openThemePopover(page) {
  await openMenu(page);
  await page.locator('#menu-theme').click();
  await expect(page.locator('#theme-popover')).toHaveClass(/open/);
}

test.describe('Theme selector', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('popover opens from menu', async ({ page }) => {
    await openThemePopover(page);
    await expect(page.locator('#theme-popover')).toBeVisible();
  });

  test('clicking a swatch previews the theme without saving', async ({ page }) => {
    await openThemePopover(page);

    // Default theme is dungeon — preview parchment
    await page.locator('.theme-swatch[data-theme="parchment"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'parchment');

    // Close without applying
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#theme-popover')).not.toHaveClass(/open/);

    // Theme should revert to dungeon
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dungeon');
  });

  test('Apply button commits the previewed theme', async ({ page }) => {
    await openThemePopover(page);

    await page.locator('.theme-swatch[data-theme="blood-moon"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'blood-moon');

    await page.locator('#theme-apply').click();
    await expect(page.locator('#theme-popover')).not.toHaveClass(/open/);

    // Theme persists after popover closes
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'blood-moon');

    // Reload and confirm it was saved
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'blood-moon');
  });

  test('closing without Apply reverts to previously saved theme', async ({ page }) => {
    // First commit arcane
    await openThemePopover(page);
    await page.locator('.theme-swatch[data-theme="arcane"]').click();
    await page.locator('#theme-apply').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'arcane');

    // Now open again, preview frostgrave, close without applying
    await openThemePopover(page);
    await page.locator('.theme-swatch[data-theme="frostgrave"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'frostgrave');

    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'arcane');
  });

  test('Apply button is visible in the popover', async ({ page }) => {
    await openThemePopover(page);
    await expect(page.locator('#theme-apply')).toBeVisible();
  });
});
