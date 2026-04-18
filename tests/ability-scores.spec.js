// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp, setAbility, getModifier, expectedMod } = require('./helpers/test-utils');

test.describe('Ability Scores & Modifiers', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
  });

  const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  test('default scores show +0 modifier', async ({ page }) => {
    for (const stat of stats) {
      await setAbility(page, stat, 10);
      expect(await getModifier(page, stat)).toBe('+0');
    }
  });

  test('score 1 shows -5 modifier', async ({ page }) => {
    await setAbility(page, 'str', 1);
    expect(await getModifier(page, 'str')).toBe('-5');
  });

  test('score 20 shows +5 modifier', async ({ page }) => {
    await setAbility(page, 'str', 20);
    expect(await getModifier(page, 'str')).toBe('+5');
  });

  test('common ability scores show correct modifiers', async ({ page }) => {
    const cases = [
      [3, '-4'], [6, '-2'], [8, '-1'], [9, '-1'],
      [10, '+0'], [11, '+0'], [12, '+1'], [13, '+1'],
      [14, '+2'], [16, '+3'], [18, '+4'],
    ];
    for (const [score, mod] of cases) {
      await setAbility(page, 'dex', score);
      expect(await getModifier(page, 'dex')).toBe(mod);
    }
  });

  test('modifier updates when score changes', async ({ page }) => {
    await setAbility(page, 'con', 14);
    expect(await getModifier(page, 'con')).toBe('+2');

    await setAbility(page, 'con', 8);
    expect(await getModifier(page, 'con')).toBe('-1');
  });

  test('each stat updates independently', async ({ page }) => {
    await setAbility(page, 'str', 16);
    await setAbility(page, 'dex', 12);
    await setAbility(page, 'con', 8);

    expect(await getModifier(page, 'str')).toBe('+3');
    expect(await getModifier(page, 'dex')).toBe('+1');
    expect(await getModifier(page, 'con')).toBe('-1');
  });
});
