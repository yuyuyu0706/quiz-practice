import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startQuiz } from './helpers';

test.describe('dea mobile quiz flow', () => {
  test.skip(({ project }) => project.name !== 'mobile-chrome', 'Mobile-only coverage.');

  test('supports the main controls and collapsible secondary actions on mobile', async ({ page }) => {
    await startQuiz(page, '10');

    await expect(page.getByRole('button', { name: 'その他の操作' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'その他の操作' })).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'その他の操作' }).click();
    await expect(page.getByRole('button', { name: 'その他の操作' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: '中断してホームへ' })).toBeVisible();

    await answerCurrentQuestion(page);
    await expect(page.getByRole('button', { name: '次へ' })).toBeVisible();
    await page.getByRole('button', { name: '次へ' }).click();
    await expect(page.locator('#quiz-progress')).toContainText('2 / 10');
  });
});
