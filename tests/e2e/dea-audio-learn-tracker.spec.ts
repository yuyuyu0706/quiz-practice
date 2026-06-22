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

test.describe('[DEA][UI] Audio Learn / Learning tracker', () => {
  test('tracks initial state, button navigation, reached states, and chapter reset', async ({
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

    await page.getByRole('button', { name: '要点メモへ' }).click();
    await expect(await currentStage(page)).toHaveText('要点メモ');
    await expect(page.locator('[data-stage="audio"] .learning-tracker__status')).toHaveText(
      '到達済み'
    );
    await expect(page.locator('#note-section')).toBeInViewport();

    await page.getByRole('button', { name: 'クイズへ' }).click();
    await expect(await currentStage(page)).toHaveText('ミニクイズ');
    await expect(page.locator('[data-stage="note"] .learning-tracker__status')).toHaveText(
      '到達済み'
    );
    await expect(page.locator('#mini-quiz-section')).toBeInViewport();

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

  test('uses sticky tracking on desktop and compact non-overlapping tracking on mobile', async ({
    page,
  }) => {
    await gotoAudioLearn(page);
    await expect(page.locator('.learning-tracker')).toHaveCSS('position', 'sticky');
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(page.locator('.learning-tracker')).toBeInViewport();

    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAudioLearn(page);
    await expect(page.locator('.learning-tracker')).toHaveCSS('position', 'sticky');
    const overlap = await page.evaluate(() => {
      const tracker = document.querySelector('.learning-tracker')?.getBoundingClientRect();
      const audio = document.querySelector('#audio-material-section')?.getBoundingClientRect();
      return Boolean(tracker && audio && tracker.bottom > audio.top && tracker.top < audio.bottom);
    });
    expect(overlap).toBe(false);
  });

  test('keeps existing quiz feedback behavior working', async ({ page }) => {
    await gotoAudioLearn(page);
    await page.getByRole('button', { name: 'クイズへ' }).click();
    await page.locator('.quiz-question').first().getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('.quiz-feedback--notice').first()).toContainText(
      '選択肢を選んでから回答してください。'
    );
  });
});
