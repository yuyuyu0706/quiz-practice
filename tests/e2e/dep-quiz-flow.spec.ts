import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('dep quiz flow on desktop', () => {
  test('completes the main flow and keeps key UI rendering stable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only flow coverage.');
    await startDepQuiz(page, 'all');

    const question = page.locator('#quiz-question');
    await expect(question.locator('.quiz-question-id')).toBeVisible();
    const lineBreakCount = await question.locator('br').count();
    expect(lineBreakCount).toBeGreaterThanOrEqual(1);

    const initialProgress = await page.locator('#quiz-progress').textContent();
    const total = Number(initialProgress?.match(/\d+\s*\/\s*(\d+)/)?.[1]);
    expect(total).toBeGreaterThanOrEqual(3);

    const questionFontSize = await question.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(questionFontSize).toBeGreaterThanOrEqual(15);
    const questionFontWeight = await question.evaluate((element) => getComputedStyle(element).fontWeight);
    expect(Number.parseInt(questionFontWeight, 10)).toBeGreaterThanOrEqual(700);

    await answerCurrentQuestion(page);
    await expect(page.getByRole('button', { name: '解説を非表示' })).toBeVisible();

    if (await page.locator('#explanation .references').count()) {
      await expect(page.locator('#explanation .references a').first()).toBeVisible();
    }

    await page.locator('#next-question').click();
    await expect(page.locator('#quiz-progress')).toContainText(`2 / ${total}`);

    for (let current = 2; current <= total; current += 1) {
      await answerCurrentQuestion(page);
      await page.locator('#next-question').click();

      if (current < total) {
        await expect(page.locator('#quiz-progress')).toContainText(`${current + 1} / ${total}`);
      }
    }

    await expect(page.locator('#result-view')).toBeVisible();
    await expect(page.getByRole('heading', { name: '結果' })).toBeVisible();
    await expect(page.locator('#score-text')).toContainText('スコア:');
  });
});
