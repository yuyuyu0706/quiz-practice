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

    await page.getByRole('button', { name: '要点メモへ移動' }).click();
    await expect(await currentStage(page)).toHaveText('要点メモ');
    await expect(page.locator('[data-stage="audio"] .learning-tracker__status')).toHaveText(
      '到達済み'
    );
    await expectHeadingClearOfTracker(page, '#note-title');

    await page.getByRole('button', { name: 'ミニクイズへ移動' }).click();
    await expect(await currentStage(page)).toHaveText('ミニクイズ');
    await expect(page.locator('[data-stage="note"] .learning-tracker__status')).toHaveText(
      '到達済み'
    );
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
