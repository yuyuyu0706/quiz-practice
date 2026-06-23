import { test, expect, type Page } from '@playwright/test';

async function gotoAudioLearn(page: Page) {
  await page.goto('/dea-audio-learn/');
  await expect(page.locator('#selected-chapter-title')).toHaveText(
    'Databricks Intelligence Platformの全体像'
  );
  await expect(page.locator('#audio-script-markdown')).toContainText(
    'Databricks Intelligence Platform'
  );
}

async function currentStage(page: Page) {
  return page.locator('.learning-tracker__item.is-current .learning-tracker__label');
}

async function expectHeadingClearOfTracker(page: Page, headingSelector: string) {
  await expect(page.locator(headingSelector)).toBeInViewport();
  const geometry = await page.evaluate((selector) => {
    const heading = document.querySelector(selector)?.getBoundingClientRect();
    const tracker = document.querySelector('.learning-tracker')?.getBoundingClientRect();
    return heading && tracker
      ? {
          headingTop: heading.top,
          headingBottom: heading.bottom,
          trackerBottom: tracker.bottom,
        }
      : null;
  }, headingSelector);
  expect(geometry).not.toBeNull();
  expect(geometry?.headingBottom).toBeGreaterThan(geometry?.trackerBottom ?? 0);
}

async function expectStatusBesideJumpIcon(page: Page, stage: string) {
  const geometry = await page.locator(`[data-stage="${stage}"]`).evaluate((item) => {
    const status = item.querySelector('.learning-tracker__status')?.getBoundingClientRect();
    const jump = item.querySelector('.learning-tracker__jump')?.getBoundingClientRect();
    return status && jump
      ? {
          statusRight: status.right,
          jumpLeft: jump.left,
          verticalDelta: Math.abs(status.top - jump.top),
        }
      : null;
  });
  expect(geometry).not.toBeNull();
  expect(geometry?.statusRight).toBeLessThanOrEqual((geometry?.jumpLeft ?? 0) + 1);
  expect(geometry?.verticalDelta).toBeLessThan(12);
}

async function expectJumpTooltip(page: Page, label: string, tooltip: string) {
  const button = page.getByRole('button', { name: `${tooltip}移動` });
  await expect(button).toHaveAttribute('data-tooltip', tooltip);
  await expect(button).toHaveAttribute('aria-label', label);
  const tooltipContent = await button.evaluate(
    (element) => window.getComputedStyle(element, '::after').content
  );
  expect(tooltipContent).toContain(tooltip);
}

async function expectCompactNormalWeightCards(page: Page) {
  const cards = await page.locator('.learning-tracker__item').evaluateAll((items) =>
    items.map((item) => {
      const marker = item.querySelector('.learning-tracker__marker');
      const label = item.querySelector('.learning-tracker__label');
      const status = item.querySelector('.learning-tracker__status');
      const jump = item.querySelector('.learning-tracker__jump');
      const markerStyle = marker ? window.getComputedStyle(marker) : null;
      const labelStyle = label ? window.getComputedStyle(label) : null;
      const statusStyle = status ? window.getComputedStyle(status) : null;
      const tooltipStyle = jump ? window.getComputedStyle(jump, '::after') : null;
      return {
        height: item.getBoundingClientRect().height,
        isCurrent: item.classList.contains('is-current'),
        markerWeight: markerStyle?.fontWeight,
        labelWeight: labelStyle?.fontWeight,
        statusWeight: statusStyle?.fontWeight,
        tooltipWeight: tooltipStyle?.fontWeight,
      };
    })
  );

  expect(cards).toHaveLength(3);
  for (const card of cards) {
    expect(card.height).toBeLessThanOrEqual(52);
    expect(Number(card.markerWeight)).toBeLessThanOrEqual(500);
    expect(Number(card.labelWeight)).toBeLessThanOrEqual(500);
    expect(Number(card.statusWeight)).toBeLessThanOrEqual(500);
    expect(Number(card.tooltipWeight)).toBeLessThanOrEqual(500);
  }
}

async function expectCurrentStatusBadgeOnly(page: Page, currentStage: string) {
  const statuses = await page.locator('.learning-tracker__item').evaluateAll((items) =>
    items.map((item) => {
      const status = item.querySelector('.learning-tracker__status');
      const style = status ? window.getComputedStyle(status) : null;
      return {
        stage: (item as HTMLElement).dataset.stage,
        text: status?.textContent?.trim(),
        isCurrent: item.classList.contains('is-current'),
        color: style?.color,
        backgroundColor: style?.backgroundColor,
        fontWeight: style?.fontWeight,
      };
    })
  );

  const current = statuses.find((status) => status.stage === currentStage);
  expect(current?.isCurrent).toBe(true);
  expect(current?.text).toBe('現在位置');
  expect(current?.color).toBe('rgb(255, 255, 255)');
  expect(current?.backgroundColor).toBe('rgb(50, 149, 94)');
  expect(Number(current?.fontWeight)).toBeLessThanOrEqual(500);

  for (const status of statuses.filter((candidate) => candidate.stage !== currentStage)) {
    expect(status.isCurrent).toBe(false);
    expect(status.text).not.toBe('現在位置');
    expect(status.color).not.toBe('rgb(255, 255, 255)');
    expect(status.backgroundColor).not.toBe('rgb(50, 149, 94)');
    expect(Number(status.fontWeight)).toBeLessThanOrEqual(500);
  }
}

test.describe('[DEA][UI] Audio Learn / Learning tracker', () => {
  test('tracks initial state, icon navigation, reached states, and chapter reset', async ({
    page,
  }) => {
    await gotoAudioLearn(page);

    await expect(page.locator('#learning-tracker-current')).toHaveText('現在：音声教材');
    await expect(await currentStage(page)).toHaveText('音声教材');
    await expect(page.locator('[data-stage="note"] .learning-tracker__status')).toHaveText(
      '未到達'
    );
    await expect(page.locator('[data-stage="quiz"] .learning-tracker__status')).toHaveText(
      '未到達'
    );
    await expect(page.locator('.learning-tracker__actions')).toHaveCount(0);
    await expectJumpTooltip(page, '音声教材へ移動', '音声教材へ');
    await expectJumpTooltip(page, '要点メモへ移動', '要点メモへ');
    await expectJumpTooltip(page, 'ミニクイズへ移動', 'ミニクイズへ');
    await expectStatusBesideJumpIcon(page, 'audio');
    await expectStatusBesideJumpIcon(page, 'note');
    await expectStatusBesideJumpIcon(page, 'quiz');
    await expectCompactNormalWeightCards(page);
    await expectCurrentStatusBadgeOnly(page, 'audio');

    await page.getByRole('button', { name: '要点メモへ移動' }).click();
    await expect(await currentStage(page)).toHaveText('要点メモ');
    await expect(page.locator('[data-stage="audio"] .learning-tracker__status')).toHaveText(
      '到達済み'
    );
    await expectCurrentStatusBadgeOnly(page, 'note');
    await expectHeadingClearOfTracker(page, '#note-title');

    await page.getByRole('button', { name: 'ミニクイズへ移動' }).click();
    await expect(await currentStage(page)).toHaveText('ミニクイズ');
    await expect(page.locator('[data-stage="note"] .learning-tracker__status')).toHaveText(
      '到達済み'
    );
    await expectCurrentStatusBadgeOnly(page, 'quiz');
    await expectHeadingClearOfTracker(page, '#mini-quiz-title');

    await page.locator('#next-chapter').click();
    await expect(page.locator('#selected-chapter-title')).toHaveText(
      'LakehouseとDelta Lakeの位置づけ'
    );
    await expect(page.locator('#learning-tracker-current')).toHaveText('現在：音声教材');
    await expect(await currentStage(page)).toHaveText('音声教材');
    await expect(page.locator('[data-stage="note"] .learning-tracker__status')).toHaveText(
      '未到達'
    );
  });

  test('updates the current stage from scrolling near the viewport center', async ({ page }) => {
    await gotoAudioLearn(page);

    await page.locator('#note-section').scrollIntoViewIfNeeded();
    await expect(await currentStage(page)).toHaveText('要点メモ');

    await page.locator('#mini-quiz-section').scrollIntoViewIfNeeded();
    await expect(await currentStage(page)).toHaveText('ミニクイズ');
  });

  test('keeps icon jumps clear of the sticky tracker on desktop and mobile', async ({ page }) => {
    await gotoAudioLearn(page);
    await expect(page.locator('.learning-tracker')).toHaveCSS('position', 'sticky');
    await page.getByRole('button', { name: '要点メモへ移動' }).click();
    await expectHeadingClearOfTracker(page, '#note-title');
    await page.getByRole('button', { name: '音声教材へ移動' }).click();
    await expectHeadingClearOfTracker(page, '#audio-material-title');

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAudioLearn(page);
    await expect(page.locator('.learning-tracker')).toHaveCSS('position', 'sticky');
    await expectStatusBesideJumpIcon(page, 'quiz');
    await expectCompactNormalWeightCards(page);
    await page.getByRole('button', { name: 'ミニクイズへ移動' }).click();
    await expectHeadingClearOfTracker(page, '#mini-quiz-title');
  });

  test('keeps existing quiz feedback behavior working', async ({ page }) => {
    await gotoAudioLearn(page);
    await page.getByRole('button', { name: 'ミニクイズへ移動' }).click();
    await page.locator('.quiz-question').first().getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('.quiz-feedback--notice').first()).toContainText(
      '選択肢を選んでから回答してください。'
    );
  });
});
