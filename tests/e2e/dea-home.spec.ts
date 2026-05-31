import { test, expect } from '@playwright/test';
import { gotoDeaHome } from './helpers';

test.describe('[DEA][UI] Home / Learning settings', () => {
  test('guarantees initial learning settings, modes, and hidden resume controls are visible states', async ({
    page,
  }) => {
    await gotoDeaHome(page);

    await expect(page.getByText('4択・解説つき')).toBeVisible();
    await expect(page.locator('#section-checkboxes input[type="checkbox"]')).toHaveCount(5);
    await expect(page.locator('input[name="mode"]')).toHaveCount(4);
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.locator('#discard-session-btn')).toBeHidden();
  });
});
