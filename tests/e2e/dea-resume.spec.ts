import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startQuiz } from './helpers';

test.describe('dea resume flow', () => {
  test('can suspend to home and resume the same progress', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only resume coverage.');
    await startQuiz(page, '10');
    await answerCurrentQuestion(page);
    await expect(page.locator('#quiz-progress')).toContainText('1 / 10');

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeVisible();
    await expect(page.locator('#home-message')).toContainText('前回のセッションを検出しました');

    await page.getByRole('button', { name: '続きから再開' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    await expect(page.locator('#quiz-progress')).toContainText('1 / 10');
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
    await expect(page.locator('#explanation')).toBeVisible();

    await page.locator('#next-question').click();
    await expect(page.locator('#quiz-progress')).toContainText('2 / 10');
  });
});
