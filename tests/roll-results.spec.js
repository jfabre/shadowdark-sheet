// @ts-check
const { test, expect } = require('@playwright/test');
const { loadApp } = require('./helpers/test-utils');

test.describe('onRollResults – rollId matching', () => {
  test.beforeEach(async ({ page }) => {
    // Inject helpers into the page so they're available in page.evaluate
    await page.addInitScript(() => {
      window.makeD20Group = (name, values) => ({ name, result: { kind: 'd20', results: values } });
      window.makeDmgGroup = (name, values, kind = 'd6') => ({ name, result: { kind, results: values } });
    });
    await loadApp(page);
    await page.evaluate(() => {
      window._chatMessages = [];
      window.TS = {
        chat: { send: (msg) => window._chatMessages.push(msg) },
        dice: { putDiceInTray: () => Promise.resolve('fake-roll-id') }
      };
    });
  });

  test('processes a matching rollId and sends a chat message', async ({ page }) => {
    await page.evaluate(() => {
      // pendingAdvRolls is a top-level const — accessible by name, not via window
      pendingAdvRolls.set('roll-abc', { name: 'STR', mode: 'advantage', bonusN: 2, type: 'check' });

      onRollResults({
        rollId: 'roll-abc',
        clientId: 'client-1',
        resultsGroups: [makeD20Group('STR (ADV)', [14, 9])],
        gmOnly: false, quiet: false
      });
    });

    const messages = await page.evaluate(() => window._chatMessages);
    expect(messages).toHaveLength(1);
    // kept = max(14,9) = 14, total = 14+2 = 16
    expect(messages[0]).toContain('STR');
    expect(messages[0]).toContain('ADV');
    expect(messages[0]).toContain('16');
  });

  test('ignores events with an unknown rollId', async ({ page }) => {
    await page.evaluate(() => {
      pendingAdvRolls.set('roll-xyz', { name: 'DEX', mode: 'disadvantage', bonusN: 0, type: 'check' });

      onRollResults({
        rollId: 'roll-OTHER',
        clientId: 'client-1',
        resultsGroups: [makeD20Group('DEX (DIS)', [5, 18])],
        gmOnly: false, quiet: false
      });
    });

    const messages = await page.evaluate(() => window._chatMessages);
    expect(messages).toHaveLength(0);
    const stillPending = await page.evaluate(() => pendingAdvRolls.has('roll-xyz'));
    expect(stillPending).toBe(true);
  });

  test('two concurrent pending rolls are each matched to their own rollId', async ({ page }) => {
    await page.evaluate(() => {
      pendingAdvRolls.set('roll-1', { name: 'STR', mode: 'advantage',    bonusN: 3, type: 'check' });
      pendingAdvRolls.set('roll-2', { name: 'DEX', mode: 'disadvantage', bonusN: 1, type: 'check' });

      // Fire the second roll's result first — with FIFO this would have given wrong output
      onRollResults({
        rollId: 'roll-2',
        clientId: 'client-1',
        resultsGroups: [makeD20Group('DEX (DIS)', [7, 15])],
        gmOnly: false, quiet: false
      });
      onRollResults({
        rollId: 'roll-1',
        clientId: 'client-1',
        resultsGroups: [makeD20Group('STR (ADV)', [18, 4])],
        gmOnly: false, quiet: false
      });
    });

    const messages = await page.evaluate(() => window._chatMessages);
    expect(messages).toHaveLength(2);
    // DEX DIS: kept=min(7,15)=7, total=7+1=8
    expect(messages[0]).toContain('DEX');
    expect(messages[0]).toContain('DIS');
    expect(messages[0]).toContain('8');
    // STR ADV: kept=max(18,4)=18, total=18+3=21
    expect(messages[1]).toContain('STR');
    expect(messages[1]).toContain('ADV');
    expect(messages[1]).toContain('21');
  });

  test('attack roll with adv includes damage from non-d20 group', async ({ page }) => {
    await page.evaluate(() => {
      pendingAdvRolls.set('roll-atk', { name: 'Sword', mode: 'advantage', bonusN: 2, dmgExpr: '1d6' });

      onRollResults({
        rollId: 'roll-atk',
        clientId: 'client-1',
        resultsGroups: [
          makeD20Group('Sword — hit (ADV)', [12, 7]),
          makeDmgGroup('Sword — dmg', [5])
        ],
        gmOnly: false, quiet: false
      });
    });

    const messages = await page.evaluate(() => window._chatMessages);
    expect(messages).toHaveLength(1);
    // kept=max(12,7)=12, total=12+2=14, dmg=5
    expect(messages[0]).toContain('Sword');
    expect(messages[0]).toContain('ADV');
    expect(messages[0]).toContain('14');
    expect(messages[0]).toContain('5');
  });
});
