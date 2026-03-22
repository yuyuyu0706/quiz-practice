import { test, expect } from '@playwright/test';
import { gotoDeaHome } from './helpers';

test.describe('dea home screen', () => {
  test('renders the initial learning settings UI', async ({ page }) => {
    await gotoDeaHome(page);

    await expect(page.getByText('4択・解説つき')).toBeVisible();
    await expect(page.locator('#section-checkboxes input[type="checkbox"]')).toHaveCount(5);
    await expect(page.locator('input[name="mode"]')).toHaveCount(4);
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.locator('#discard-session-btn')).toBeHidden();
  });
});
