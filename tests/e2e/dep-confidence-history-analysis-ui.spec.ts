import { test, expect } from '@playwright/test';
import { gotoDepHome } from './helpers';

const attempts = [
  {
    attemptId: 'a1',
    questionId: 'dep-001',
    section: '1',
    result: 'wrong',
    confidence: 'high',
    answeredAt: '2026-08-01T10:00:00.000Z',
  },
  {
    attemptId: 'a2',
    questionId: 'dep-001',
    section: '1',
    result: 'correct',
    confidence: 'high',
    answeredAt: '2026-08-01T11:00:00.000Z',
  },
  {
    attemptId: 'a3',
    questionId: 'dep-002',
    section: '2',
    result: 'wrong',
    confidence: 'low',
    answeredAt: '2026-08-01T12:00:00.000Z',
  },
  {
    attemptId: 'a4',
    questionId: 'dep-002',
    section: '2',
    result: 'correct',
    confidence: 'low',
    answeredAt: '2026-08-01T13:00:00.000Z',
  },
];

async function openHistory(page) {
  await page.addInitScript((history) => {
    localStorage.clear();
    localStorage.setItem('depQuizProgress', '{}');
    localStorage.setItem(
      'depQuizConfidenceHistory',
      JSON.stringify({ version: 1, attempts: history })
    );
    localStorage.setItem(
      'depQuizSettings',
      JSON.stringify({ sections: ['1'], mode: 'normal', count: '10' })
    );
    localStorage.setItem('depQuizActiveSession', JSON.stringify(null));
  }, attempts);
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  const history = page.locator('.analysis-confidence-history');
  await history.locator('summary').click();
  return history;
}

test.describe('[DEP][UI] Analysis / Confidence history', () => {
  test('renders attempt summary, trends, and canonical controls', async ({ page }) => {
    const history = await openHistory(page);
    await expect(history).toContainText('回答試行数4件');
    await expect(history).toContainText('試行ベース正答率50%');
    await expect(history.locator('[data-history-item]')).toHaveCount(9);
    await expect(history).toContainText('誤った自信を修正');
    await expect(history.locator('[data-history-period]')).toHaveValue('30d');
    await expect(history.locator('[data-history-section] option')).toHaveCount(3);
  });

  test('updates only history content and leaves storage, focus, and other disclosures intact', async ({
    page,
  }) => {
    const history = await openHistory(page);
    const e4 = page.locator('.analysis-confidence-summary');
    await e4.locator('summary').click();
    const before = await page.evaluate(() =>
      Object.fromEntries(
        [
          'depQuizProgress',
          'depQuizConfidenceHistory',
          'depQuizSettings',
          'depQuizActiveSession',
        ].map((key) => [key, localStorage.getItem(key)])
      )
    );
    const section = history.locator('[data-history-section]');
    await section.focus();
    await section.selectOption('1');
    await expect(section).toBeFocused();
    await expect(e4).toHaveJSProperty('open', true);
    await expect(history).toHaveJSProperty('open', true);
    await expect(history.locator('[role="status"]')).toHaveText('確信度の学習履歴を更新しました。');
    expect(
      await page.evaluate(() =>
        Object.fromEntries(
          [
            'depQuizProgress',
            'depQuizConfidenceHistory',
            'depQuizSettings',
            'depQuizActiveSession',
          ].map((key) => [key, localStorage.getItem(key)])
        )
      )
    ).toEqual(before);
  });

  test('has no horizontal overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openHistory(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  });
});
