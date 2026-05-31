import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('[DEP][DATA] Resume / Storage restore', () => {
  test('guarantees DEP-specific storage keys save and restore suspended progress', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only resume coverage.');
    await startDepQuiz(page, 'all');
    await answerCurrentQuestion(page);

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeVisible();

    const storageState = await page.evaluate(() => ({
      depSession: localStorage.getItem('depQuizActiveSession'),
      deaSession: localStorage.getItem('deaQuizActiveSession'),
    }));

    expect(storageState.depSession).toBeTruthy();
    expect(storageState.deaSession).toBeNull();

    await page.getByRole('button', { name: '続きから再開' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    const resumedProgress = await page.locator('#quiz-progress').textContent();
    const total = Number(resumedProgress?.match(/\d+\s*\/\s*(\d+)/)?.[1]);
    expect(total).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#quiz-progress')).toContainText(`1 / ${total}`);
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);

    await page.locator('#next-question').click();
    await expect(page.locator('#quiz-progress')).toContainText(`2 / ${total}`);
  });
});
