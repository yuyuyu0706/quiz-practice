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
    const progress = await page.locator('#quiz-progress').textContent();
    const total = Number(progress?.match(/\d+\s*\/\s*(\d+)/)?.[1]);
    expect(total).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#quiz-progress')).toContainText(`2 / ${total}`);

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();

    const homeButtons = page.locator('#home-view .button-row button');
    const buttonCount = await homeButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(3);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    for (let i = 0; i < buttonCount; i += 1) {
      await expect(homeButtons.nth(i)).toBeVisible();
      const box = await homeButtons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 200);
    }

    await page.getByRole('button', { name: 'メモ一覧' }).click();
    await expect(page.locator('#notes-view')).toBeVisible();

  });
});
