import { test, expect } from '@playwright/test';
import { gotoDepHome } from './helpers';

test.describe('dep home screen', () => {
  test('renders DEP learning settings and home action buttons without layout issues', async ({ page }) => {
    await gotoDepHome(page);

    await expect(page.getByText('Professional 試験対策・4択・解説つき')).toBeVisible();

    const sectionCheckboxes = page.locator('#section-checkboxes input[type="checkbox"]');
    const sectionTitles = page.locator('#section-checkboxes .section-title');

    const sectionCount = await sectionCheckboxes.count();
    expect(sectionCount).toBeGreaterThan(0);
    await expect(sectionTitles).toHaveCount(sectionCount);
    await expect(sectionTitles.first()).not.toHaveText(/^\s*$/);

    await expect(page.locator('input[name="mode"]')).toHaveCount(4);
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.locator('#discard-session-btn')).toBeHidden();

    await expect(page.getByRole('button', { name: '開始' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'メモあり問題を復習' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'メモ一覧' })).toBeVisible();

    const primaryHomeButtons = page.locator('#home-view .button-row').first().locator('button:visible');
    await expect(primaryHomeButtons).toHaveCount(1);

    const notesActionButtons = page.locator('#home-view .button-row').nth(1).locator('button:visible');
    await expect(notesActionButtons).toHaveCount(2);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const visibleButtons = [
      page.getByRole('button', { name: '開始' }),
      page.getByRole('button', { name: 'メモあり問題を復習' }),
      page.getByRole('button', { name: 'メモ一覧' }),
    ];
    for (const button of visibleButtons) {
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    }

    await page.getByRole('button', { name: 'メモ一覧' }).click();
    await expect(page.locator('#notes-view')).toBeVisible();
    await page.getByRole('button', { name: 'ホームへ戻る' }).click();
    await expect(page.locator('#home-view')).toBeVisible();

  });
});
