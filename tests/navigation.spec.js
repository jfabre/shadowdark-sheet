// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, openMenu } = require('./helpers/test-utils');

test.describe('Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('core tab is visible by default', async ({ page }) => {
    await expect(page.locator('#panel-core')).toBeVisible();
    await expect(page.locator('#panel-gear')).toBeHidden();
    await expect(page.locator('#panel-class')).toBeHidden();
  });

  test('clicking Gear tab shows gear panel', async ({ page }) => {
    await page.locator('button.tab-btn[data-panel="gear"]').click();
    await expect(page.locator('#panel-gear')).toBeVisible();
    await expect(page.locator('#panel-core')).toBeHidden();
    await expect(page.locator('#panel-class')).toBeHidden();
  });

  test('clicking Traits tab shows class panel', async ({ page }) => {
    await page.locator('button.tab-btn[data-panel="class"]').click();
    await expect(page.locator('#panel-class')).toBeVisible();
    await expect(page.locator('#panel-core')).toBeHidden();
    await expect(page.locator('#panel-gear')).toBeHidden();
  });

  test('switching back to Core tab works', async ({ page }) => {
    await page.locator('button.tab-btn[data-panel="gear"]').click();
    await expect(page.locator('#panel-gear')).toBeVisible();

    await page.locator('button.tab-btn[data-panel="core"]').click();
    await expect(page.locator('#panel-core')).toBeVisible();
    await expect(page.locator('#panel-gear')).toBeHidden();
  });

  test('active tab has aria-selected="true"', async ({ page }) => {
    const coreTab = page.locator('button.tab-btn[data-panel="core"]');
    await expect(coreTab).toHaveAttribute('aria-selected', 'true');

    await page.locator('button.tab-btn[data-panel="gear"]').click();
    await expect(coreTab).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('button.tab-btn[data-panel="gear"]')).toHaveAttribute('aria-selected', 'true');
  });
});
