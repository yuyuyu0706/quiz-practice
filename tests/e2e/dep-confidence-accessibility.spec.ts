import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

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

  test('keeps native arrow-key selection within answer and confidence radio groups', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop radio keyboard coverage.');
    await startDepQuiz(page, 'all');
    await answerCurrentQuestion(page);
    await page.locator('#next-question').click();
    await expect(page.locator('#quiz-progress')).toContainText(/2\s*\/\s*/);

    const sessionIndex = async () =>
      page.evaluate(() => {
        const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
        return session.currentIndex;
      });
    expect(await sessionIndex()).toBe(1);

    const choices = page.locator('#choices-form input[name="choice"]');
    await choices.nth(1).check();
    await choices.nth(1).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(choices.first()).toBeChecked();
    await expect(page.locator('#quiz-progress')).toContainText(/2\s*\/\s*/);
    expect(await sessionIndex()).toBe(1);
    await expect(page.locator('#quiz-message')).not.toContainText('未回答です');

    const confidence = page.locator('#confidence-options input[name="confidence"]');
    await confidence.first().check();
    await confidence.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(confidence.nth(1)).toBeChecked();
    await expect(page.locator('#quiz-progress')).toContainText(/2\s*\/\s*/);
    expect(await sessionIndex()).toBe(1);
    await expect(page.locator('#quiz-message')).not.toContainText('未回答です');
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
