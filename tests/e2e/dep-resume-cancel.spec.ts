import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('dep resume cancel flow', () => {
  test('discards suspended session and starts a fresh one', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');
    await answerCurrentQuestion(page);

    const suspendedSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeVisible();
    await expect(page.getByRole('button', { name: '再開しない' })).toBeVisible();

    await page.getByRole('button', { name: '再開しない' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    await expect(page.locator('#quiz-progress')).toContainText(/1\s*\/\s*10/);

    const restartedSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );

    expect(restartedSession).toBeTruthy();
    expect(restartedSession.currentIndex).toBe(0);
    expect(restartedSession.order).toHaveLength(10);
    expect(restartedSession.order).not.toEqual(suspendedSession.order);
    expect(restartedSession.startedAt).not.toBe(suspendedSession.startedAt);
  });
});
