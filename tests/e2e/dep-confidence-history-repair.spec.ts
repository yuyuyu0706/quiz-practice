import { test, expect, type Page } from '@playwright/test';
import { gotoDepHome } from './helpers';

const key = 'depQuizConfidenceHistory';
const canonicalAttempt = {
  attemptId: 'attempt-1',
  questionId: 'DEP-Q201',
  section: '1',
  result: 'correct',
  confidence: 'high',
  answeredAt: '2026-07-01T00:00:00.000Z',
};

async function seedHistory(page: Page, value: unknown) {
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    { key, value }
  );
}

async function openReset(page: Page) {
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await page.getByRole('button', { name: '学習履歴をリセット' }).click();
}

test.describe('[DEP][DATA] Confidence history / Repair and compatibility', () => {
  test('repairs version 1 on startup and reports confidence history separately', async ({
    page,
  }) => {
    await seedHistory(page, {
      version: 1,
      attempts: [canonicalAttempt, canonicalAttempt, { invalid: true }],
      unknown: true,
    });
    await gotoDepHome(page);
    await expect(page.locator('.storage-repair-notice')).toContainText('回答試行履歴');
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
      .toBe(JSON.stringify({ version: 1, attempts: [canonicalAttempt] }));
  });

  test('initializes a missing key without displaying a repair notice', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await gotoDepHome(page);
    await expect(page.locator('.storage-repair-notice')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
      .toBe(JSON.stringify({ version: 1, attempts: [] }));
  });

  test('keeps unsupported guidance visible after closing home notice and redraws', async ({
    page,
  }) => {
    const raw = '{ "version": 2, "attempts": [{"future":true}] }';
    await seedHistory(page, raw);
    await gotoDepHome(page);
    const compatibility = page.locator('.confidence-history-compatibility-notice');
    await expect(compatibility).toBeVisible();
    await compatibility.getByRole('button', { name: '回答試行履歴の互換性通知を閉じる' }).click();
    await page.locator('#question-count').selectOption('10');
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#quiz-message')).toContainText(
      'データ保護のため回答を保存できません'
    );
    await expect(page.getByRole('button', { name: '回答する' })).toBeDisabled();
    await page.locator('#choices-form label').first().click();
    await page.locator('#confidence-options input[value="medium"]').check();
    await expect(page.locator('#quiz-message')).toContainText(
      'データ保護のため回答を保存できません'
    );
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
  });

  test('explicit reset removes compatibility notice and permits answering again', async ({
    page,
  }) => {
    await seedHistory(page, { version: 2, attempts: [{ future: true }] });
    await gotoDepHome(page);
    await openReset(page);
    await expect(page.getByText('このバージョンでは件数確認不可')).toBeVisible();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    await expect(page.locator('.confidence-history-compatibility-notice')).toHaveCount(0);
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
      .toBe(JSON.stringify({ version: 1, attempts: [] }));
    await page.getByRole('button', { name: '← ホームへ戻る' }).click();
    await page.locator('#question-count').selectOption('10');
    await page.getByRole('button', { name: '開始' }).click();
    await page.locator('#choices-form label').first().click();
    await page.locator('#confidence-options input[value="medium"]').check();
    await expect(page.getByRole('button', { name: '回答する' })).toBeEnabled();
  });

  test('offers reset for version 1 history only and keeps it empty after reload', async ({
    page,
  }) => {
    await gotoDepHome(page);
    await page.evaluate(({ key, history }) => localStorage.setItem(key, JSON.stringify(history)), {
      key,
      history: { version: 1, attempts: [canonicalAttempt] },
    });
    await page.reload();
    await openReset(page);
    await expect(page.locator('#learning-history-reset-dialog')).toContainText(
      '回答試行履歴1件削除予定'
    );
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    await page.reload();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
      .toBe(JSON.stringify({ version: 1, attempts: [] }));
  });
});
