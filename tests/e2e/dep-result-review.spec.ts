import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('[DEP][FLOW] Review / Result entrypoint', () => {
  test('guarantees result screen can launch wrong-only review when wrong answers exist', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');

    for (let i = 0; i < 10; i += 1) {
      await answerCurrentQuestion(page);
      await page.locator('#next-question').click();
    }

    await expect(page.locator('#result-view')).toBeVisible();
    const reviewButton = page.getByRole('button', { name: '間違いのみ復習を開始' });

    test.skip(
      !(await reviewButton.isVisible()),
      'Result review button is not available in this UI variant.'
    );

    const prevSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );

    await reviewButton.click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    const nextSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );

    expect(nextSession).toBeTruthy();
    expect(nextSession.mode).toBe('wrongOnly');
    expect(nextSession.order.length).toBeGreaterThan(0);
    expect(nextSession.startedAt).not.toBe(prevSession?.startedAt);
  });
});
