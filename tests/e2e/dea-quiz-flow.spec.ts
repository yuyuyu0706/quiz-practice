import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startQuiz } from './helpers';

test.describe('dea quiz flow on desktop', () => {
  test.skip(({ project }) => project.name !== 'chromium', 'Desktop-only flow coverage.');

  test('completes the main flow from start to result', async ({ page }) => {
    await startQuiz(page, '10');

    await answerCurrentQuestion(page);
    await expect(page.getByRole('button', { name: '解説を非表示' })).toBeVisible();
    await page.getByRole('button', { name: '次へ' }).click();
    await expect(page.locator('#quiz-progress')).toContainText('2 / 10');

    for (let index = 2; index <= 10; index += 1) {
      await answerCurrentQuestion(page);
      const nextButton = index === 10
        ? page.getByRole('button', { name: '次へ進む' })
        : page.getByRole('button', { name: '次へ' });
      await nextButton.click();
    }

    await expect(page.locator('#result-view')).toBeVisible();
    await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
    await expect(page.locator('#score-text')).toContainText('スコア:');
    await expect(page.locator('#section-score-text')).toContainText('セクション別:');
  });
});
