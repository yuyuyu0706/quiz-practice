import { test, expect } from '@playwright/test';
import { startDepQuiz } from './helpers';

test.describe('[DEP][UI] Confidence input', () => {
  test('supports confidence shortcuts, persistence, ARIA, and graded-state locking', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop keyboard coverage.');
    await startDepQuiz(page, 'all');

    await expect(page.locator('input[name="confidence"][value="high"]')).toHaveAttribute(
      'aria-keyshortcuts',
      'H'
    );
    await page.keyboard.press('h');
    await expect(page.locator('input[name="confidence"]:checked')).toHaveValue('high');
    await expect(page.locator('#quiz-message')).toContainText('確信あり');

    const storedConfidence = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
      return session.confidenceByQuestion[session.order[session.currentIndex]];
    });
    expect(storedConfidence).toBe('high');

    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
    await page.keyboard.press('l');
    await expect(page.locator('input[name="confidence"]:checked')).toHaveValue('high');
  });

  test('focuses and highlights the next missing group only after a rejected submission', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop focus coverage.');
    await startDepQuiz(page, 'all');

    await page.keyboard.press('Enter');
    await expect(page.locator('#choices-form input').first()).toBeFocused();
    await expect(page.locator('#choices-form')).toHaveClass(/needs-selection/);
    await expect(page.locator('#confidence-fieldset')).toHaveClass(/needs-selection/);
    await expect(page.locator('#quiz-message')).toHaveAttribute('aria-live', 'polite');

    await page.keyboard.press('1');
    await expect(page.locator('#choices-form')).not.toHaveClass(/needs-selection/);
    await page.keyboard.press('Enter');
    await expect(page.locator('#confidence-options input').first()).toBeFocused();
    await page.keyboard.press('m');
    await expect(page.locator('#confidence-fieldset')).not.toHaveClass(/needs-selection/);

    await page.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'shortcut-isolation-probe';
      input.type = 'text';
      document.querySelector('#quiz-view')?.append(input);
      input.focus();
    });
    await page.keyboard.press('l');
    await expect(page.locator('input[name="confidence"]:checked')).toHaveValue('medium');
  });

  test('keeps confidence controls usable without horizontal overflow at 375px', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile layout coverage.');
    await page.setViewportSize({ width: 375, height: 667 });
    await startDepQuiz(page, 'all');

    const option = page.locator('.confidence-option').first();
    expect((await option.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await option.click();
    await expect(option.locator('input')).toBeChecked();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });
});
