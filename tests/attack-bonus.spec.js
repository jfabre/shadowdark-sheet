// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, setAbility } = require('./helpers/test-utils');

async function addAttack(page) {
  await page.locator('#cbt-add-attack').click();
}

async function getBonusValue(page, idx) {
  return page.locator('.atk-bonus').nth(idx).inputValue();
}

async function setBonusValue(page, idx, value) {
  const inp = page.locator('.atk-bonus').nth(idx);
  await inp.fill(value);
  await inp.dispatchEvent('input');
  await inp.dispatchEvent('blur');
}

test.describe('Attack bonus', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  test('bonus is auto-calculated from STR modifier', async ({ page }) => {
    await setAbility(page, 'str', 16); // +3
    await addAttack(page);
    expect(await getBonusValue(page, 0)).toBe('+3');
  });

  test('bonus updates when ability score changes', async ({ page }) => {
    await setAbility(page, 'str', 10); // +0
    await addAttack(page);
    expect(await getBonusValue(page, 0)).toBe('+0');

    await setAbility(page, 'str', 14); // +2
    expect(await getBonusValue(page, 0)).toBe('+2');
  });

  test('bonus can be manually overridden', async ({ page }) => {
    await setAbility(page, 'str', 10); // +0
    await addAttack(page);
    await setBonusValue(page, 0, '+3');
    expect(await getBonusValue(page, 0)).toBe('+3');
  });

  test('override indicator class added when bonus is manually set', async ({ page }) => {
    await addAttack(page);
    await setBonusValue(page, 0, '+5');
    await expect(page.locator('.atk-bonus').nth(0)).toHaveClass(/atk-bonus--override/);
  });

  test('typing back the calculated value clears the override indicator', async ({ page }) => {
    await setAbility(page, 'str', 14); // +2
    await addAttack(page);
    await setBonusValue(page, 0, '+5');
    await expect(page.locator('.atk-bonus').nth(0)).toHaveClass(/atk-bonus--override/);

    // Type the calculated value back — indicator should clear
    await setBonusValue(page, 0, '+2');
    await expect(page.locator('.atk-bonus').nth(0)).not.toHaveClass(/atk-bonus--override/);
  });

  test('override does not update when ability score changes', async ({ page }) => {
    await setAbility(page, 'str', 10); // +0
    await addAttack(page);
    await setBonusValue(page, 0, '+5');
    await setAbility(page, 'str', 18); // +4 — should not overwrite manual override
    expect(await getBonusValue(page, 0)).toBe('+5');
  });

  test('changing stat dropdown resets override to new stat mod', async ({ page }) => {
    await setAbility(page, 'str', 10); // +0
    await setAbility(page, 'dex', 16); // +3
    await addAttack(page);
    await setBonusValue(page, 0, '+5');

    // Change to DEX — should reset override to +3
    await page.locator('.atk-stat').nth(0).selectOption('DEX');
    expect(await getBonusValue(page, 0)).toBe('+3');
    await expect(page.locator('.atk-bonus').nth(0)).not.toHaveClass(/atk-bonus--override/);
  });
});
