import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startQuiz } from './helpers';

test.describe('dea mobile quiz flow', () => {
  test('supports the main controls and collapsible secondary actions on mobile', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only coverage.');
    await startQuiz(page, '10');

    await expect(page.getByRole('button', { name: 'その他の操作' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'その他の操作' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await page.getByRole('button', { name: 'その他の操作' }).click();
    await expect(page.getByRole('button', { name: 'その他の操作' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(page.getByRole('button', { name: '中断してホームへ' })).toBeVisible();

    await answerCurrentQuestion(page);
    await expect(page.locator('#next-question')).toBeVisible();
    await page.locator('#next-question').click();
    await expect(page.locator('#quiz-progress')).toContainText('2 / 10');
  });
});
