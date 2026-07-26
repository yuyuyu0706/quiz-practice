import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('[DEP][UI] Confidence input', () => {
  test('shows compact equal-width choices and only the selected confidence detail', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop visual-state coverage.');
    await startDepQuiz(page, 'all');

    const options = page.locator('.confidence-option');
    await expect(options).toHaveCount(3);
    await expect(options).toHaveText(['確信あり/High', '迷いあり/Medium', '自信なし/Low']);
    const optionPositions = await options.evaluateAll((nodes) =>
      nodes.map((node) => ({
        left: Math.round(node.getBoundingClientRect().left),
        right: Math.round(node.getBoundingClientRect().right),
      }))
    );
    expect(optionPositions[0].left).toBe(
      Math.round((await page.locator('#confidence-options').boundingBox())?.x ?? -1)
    );
    expect(optionPositions[2].right).toBeLessThan(
      Math.round((await page.locator('#confidence-options').boundingBox())?.x ?? 0) +
        Math.round((await page.locator('#confidence-options').boundingBox())?.width ?? 0)
    );
    await expect(page.locator('#confidence-detail')).toBeHidden();
    await expect(page.locator('#confidence-hint')).toHaveCount(0);
    expect(
      await page
        .locator('#confidence-fieldset')
        .evaluate((fieldset) => getComputedStyle(fieldset).borderStyle)
    ).toBe('none');
    expect(await options.allTextContents()).not.toContain('根拠を持って正しいと判断している');

    const descriptions = [
      '確信あり : High : 根拠を持って正しいと判断している',
      '迷いあり : Medium : 候補は絞れたが、判断に迷いがある',
      '自信なし : Low : 勘に近い、または十分な根拠が持てない',
    ];
    for (let index = 0; index < descriptions.length; index += 1) {
      await options.nth(index).click();
      await expect(page.locator('#confidence-detail')).toHaveText(descriptions[index]);
      await expect(page.locator('#confidence-detail')).toHaveAttribute('data-state', 'selected');
    }
    await expect(page.locator('#confidence-detail strong')).toHaveText('自信なし');
    await expect(page.locator('#confidence-detail .confidence-detail__level')).toHaveText('Low');
    const detailStyles = await page.locator('#confidence-detail').evaluate((detail) => ({
      labelWeight: getComputedStyle(detail.querySelector('strong')!).fontWeight,
      detailColor: getComputedStyle(detail).color,
      levelColor: getComputedStyle(detail.querySelector('.confidence-detail__level')!).color,
    }));
    expect(Number(detailStyles.labelWeight)).toBeGreaterThanOrEqual(600);
    expect(detailStyles.levelColor).not.toBe(detailStyles.detailColor);
    await options.nth(1).click();
    await expect(page.locator('#selection-hint')).toContainText('選択肢を選んでください。');

    await page.locator('#choices-form label').first().click();
    await expect(page.locator('#selection-hint')).toBeHidden();
    await page.getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('#confidence-detail')).toHaveText(
      '迷いあり : Medium : 候補は絞れたが、判断に迷いがある'
    );
    await expect(page.locator('#confidence-detail')).toHaveAttribute('data-state', 'graded');
    expect(
      await page
        .locator('input[name="confidence"]')
        .evaluateAll((inputs) => inputs.every((input) => (input as HTMLInputElement).disabled))
    ).toBe(true);
  });

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
    await expect(page.locator('.confidence-option')).toHaveCount(3);
    const rows = await page
      .locator('.confidence-option')
      .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)));
    expect(new Set(rows).size).toBe(1);
    for (const confidenceOption of await page.locator('.confidence-option').all()) {
      await confidenceOption.click();
      await expect(confidenceOption.locator('input')).toBeChecked();
      expect(
        await page
          .locator('#confidence-detail')
          .evaluate((detail) => detail.scrollWidth <= detail.clientWidth)
      ).toBe(true);
    }
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow).toBe(false);
  });
});
