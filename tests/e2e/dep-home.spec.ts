import { test, expect } from '@playwright/test';
import { gotoDepHome } from './helpers';

test.describe('dep home screen', () => {
  test('renders DEP learning settings and section labels', async ({ page }) => {
    await gotoDepHome(page);

    await expect(page.getByText('Professional 試験対策・4択・解説つき')).toBeVisible();
    await expect(page.locator('#section-checkboxes input[type="checkbox"]')).toHaveCount(5);
    await expect(page.locator('#section-checkboxes .section-title')).toHaveCount(5);
    await expect(page.locator('#section-checkboxes .section-title').first()).not.toHaveText(/^\s*$/);
    await expect(page.locator('input[name="mode"]')).toHaveCount(4);
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.locator('#discard-session-btn')).toBeHidden();
  });
});
