import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('[DEP][FLOW] Resume / Cancel suspended session', () => {
  test('guarantees discarding a suspended session starts fresh progress', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');
    await answerCurrentQuestion(page);

    const suspendedSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeVisible();
    await expect(page.getByRole('button', { name: '中断データを削除' })).toBeVisible();

    await page.getByRole('button', { name: '中断データを削除' }).click();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeHidden();

    const discardedSession = await page.evaluate(() =>
      localStorage.getItem('depQuizActiveSession')
    );
    expect(discardedSession).toBeNull();

    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    await expect(page.locator('#quiz-progress')).toContainText(/1\s*\/\s*10/);

    const restartedSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );

    expect(restartedSession).toBeTruthy();
    expect(restartedSession.currentIndex).toBe(0);
    expect(restartedSession.order).toHaveLength(10);
    expect(restartedSession.answers).toEqual({});
    expect(restartedSession.startedAt).not.toBe(suspendedSession.startedAt);
  });
});
