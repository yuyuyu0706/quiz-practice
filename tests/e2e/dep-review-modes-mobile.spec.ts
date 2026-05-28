import { test, expect } from '@playwright/test';
import { gotoDepHome } from './helpers';

test.describe('dep mobile review mode navigation', () => {
  test('shows review mode controls and allows transitions on mobile', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only coverage.');

    await gotoDepHome(page);

    await expect(page.locator('input[name="mode"][value="normal"]')).toBeVisible();
    await expect(page.locator('input[name="mode"][value="bookmarks"]')).toBeVisible();
    await expect(page.locator('input[name="mode"][value="wrongOnly"]')).toBeVisible();

    const modeContainer = page.locator('#home-view .mode-selector, #home-view fieldset').first();
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const box = await modeContainer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);

    await page.locator('input[name="mode"][value="bookmarks"]').check();
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#home-message')).toContainText('対象となる問題がありません');

    await page.locator('input[name="mode"][value="wrongOnly"]').check();
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#home-message')).toContainText('対象となる問題がありません');

    await page.locator('input[name="mode"][value="normal"]').check();
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
  });
});
