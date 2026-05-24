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

    const homeButtonRow = page.locator('#home-view .button-row').first();
    const homeButtons = homeButtonRow.locator('button');
    const buttonCount = await homeButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(3);

    const rowBox = await homeButtonRow.boundingBox();
    expect(rowBox).not.toBeNull();
    for (let i = 0; i < buttonCount; i += 1) {
      const box = await homeButtons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(rowBox!.x - 1);
      expect(box!.y).toBeGreaterThanOrEqual(rowBox!.y - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(rowBox!.y + rowBox!.height + 1);
    }

    await page.getByRole('button', { name: 'メモ一覧' }).click();
    await expect(page.locator('#notes-view')).toBeVisible();
    await page.getByRole('button', { name: 'ホームへ戻る' }).click();
    await expect(page.locator('#home-view')).toBeVisible();

  });
});
