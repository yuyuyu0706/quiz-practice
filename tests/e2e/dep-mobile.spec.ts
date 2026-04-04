import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('dep mobile quiz flow', () => {
  test('supports mobile primary flow and secondary actions menu', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only coverage.');
    await startDepQuiz(page, 'all');

    await expect(page.locator('#section-checkboxes .section-title').first()).not.toHaveText(/^\s*$/);
    await expect(page.getByRole('button', { name: '回答する' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'その他の操作' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'その他の操作' })).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'その他の操作' }).click();
    await expect(page.getByRole('button', { name: 'その他の操作' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: '中断してホームへ' })).toBeVisible();

    await answerCurrentQuestion(page);
    await expect(page.locator('#next-question')).toBeVisible();
    await page.locator('#next-question').click();
    await expect(page.locator('#quiz-progress')).toContainText('2 / 3');
  });
});
