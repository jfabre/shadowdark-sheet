// @ts-check
const { expect } = require('@playwright/test');

/**
 * Navigate to the app and dismiss the creation guide if it appears.
 */
async function loadApp(page) {
  await page.goto('/');
  // The creation guide auto-opens on empty sheets — close it
  const guide = page.locator('#creation-guide');
  if (await guide.isVisible()) {
    await page.locator('#guide-close').click();
    await expect(guide).toBeHidden();
  }
}

/**
 * Set an ability score by clearing and typing a value.
 */
async function setAbility(page, stat, value) {
  const input = page.locator('#ability-' + stat);
  await input.fill(String(value));
  await input.dispatchEvent('input');
}

/**
 * Read the displayed modifier text for an ability stat.
 * Returns the trimmed text like "+2" or "-1".
 */
async function getModifier(page, stat) {
  return (await page.locator('#mod-' + stat + ' .mod-inner').textContent()).trim();
}

/**
 * Switch to a tab by clicking its button.
 * @param {'core'|'gear'|'class'} tab
 */
async function switchTab(page, tab) {
  await page.locator('button.tab-btn[data-panel="' + tab + '"]').click();
}

/**
 * Select an armor type from the custom dropdown.
 */
async function selectArmor(page, armorValue) {
  await page.locator('#armor-select-trigger').click();
  await page.locator('#armor-dropdown-panel .armor-custom-option[data-value="' + armorValue + '"]').click();
}

/**
 * Get the current AC value from the display.
 */
async function getAC(page) {
  return page.locator('#cbt-ac').inputValue();
}

/**
 * Get encumbrance used/max as numbers.
 */
async function getEncumbrance(page) {
  const used = await page.locator('#enc-used').textContent();
  const max = await page.locator('#enc-max').textContent();
  return { used: parseFloat(used), max: parseInt(max, 10) };
}

/**
 * Clear localStorage to start fresh.
 */
async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Open the settings menu.
 */
async function openMenu(page) {
  await page.locator('#menu-btn').click();
  await expect(page.locator('#menu-dropdown')).toHaveClass(/open/);
}

/**
 * Compute expected ability modifier.
 */
function expectedMod(score) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? '+' + m : String(m);
}

/**
 * Select a value from a custom dropdown (class or ancestry).
 * @param {import('@playwright/test').Page} page
 * @param {string} triggerId - e.g. 'class-select-trigger'
 * @param {string} value - the data-value of the option to select
 */
async function selectCustomOption(page, triggerId, value) {
  await page.locator('#' + triggerId).click();
  await page.locator('.custom-select-option[data-value="' + value + '"]').click();
}

module.exports = {
  loadApp,
  setAbility,
  getModifier,
  switchTab,
  selectArmor,
  getAC,
  getEncumbrance,
  clearStorage,
  openMenu,
  expectedMod,
  selectCustomOption,
};
