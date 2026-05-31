import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startQuiz } from './helpers';

test.describe('[DEA][FLOW] Quiz / Desktop result', () => {
  test('guarantees a desktop quiz can be completed from start to result summary', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only flow coverage.');
    await startQuiz(page, '10');

    await answerCurrentQuestion(page);
    await expect(page.getByRole('button', { name: '解説を非表示' })).toBeVisible();
    await page.locator('#next-question').click();
    await expect(page.locator('#quiz-progress')).toContainText('2 / 10');

    for (let index = 2; index <= 10; index += 1) {
      await answerCurrentQuestion(page);
      await page.locator('#next-question').click();
    }

    await expect(page.locator('#result-view')).toBeVisible();
    await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
    await expect(page.locator('#score-text')).toContainText('スコア:');
    await expect(page.locator('#section-score-text')).toContainText('セクション別:');
  });
});
