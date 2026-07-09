import { test, expect, type Locator, type Page } from '@playwright/test';

import { gotoDepHome } from './helpers';

const storageKeys = ['depQuizProgress', 'depQuizSettings', 'depQuizActiveSession'] as const;
const defaultSettings = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };

const progressFixture = {
  'dep-q-001': {
    seenCount: 2,
    correctCount: 1,
    wrongCount: 1,
    lastAnsweredAt: '2026-07-04T00:00:00.000Z',
    bookmark: true,
    noteText: 'Lakeflow Jobs の復習メモ',
    noteUpdatedAt: '2026-07-04T00:01:00.000Z',
    wrongReasonTags: ['concept-gap'],
    wrongReasonUpdatedAt: '2026-07-04T00:02:00.000Z',
    unknownRetainedAttribute: 'keep me after reset',
  },
  'dep-q-002': {
    seenCount: 1,
    correctCount: 0,
    wrongCount: 1,
    lastAnsweredAt: '2026-07-04T00:03:00.000Z',
    bookmark: false,
    noteText: '',
    noteUpdatedAt: null,
    wrongReasonTags: [],
    wrongReasonUpdatedAt: null,
  },
  'dep-q-003': {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    lastAnsweredAt: null,
    bookmark: true,
    noteText: '  ',
    noteUpdatedAt: null,
    wrongReasonTags: [],
    wrongReasonUpdatedAt: null,
  },
};

const sessionFixture = {
  schemaVersion: 1,
  app: 'dep-quiz-app',
  order: ['dep-q-001'],
  currentIndex: 0,
  answers: {},
  choiceMap: {},
  graded: {},
  completedAt: null,
  explanationOpen: false,
  mode: 'normal',
  startedAt: '2026-07-04T00:00:00.000Z',
  settingsSnapshot: defaultSettings,
};

const analysisProgressFixture = {
  'DEP-Q202': progressFixture['dep-q-001'],
  'DEP-Q203': progressFixture['dep-q-003'],
  'DEP-Q204': progressFixture['dep-q-002'],
};

const analysisSessionFixture = {
  ...sessionFixture,
  order: ['DEP-Q202'],
};

async function seedStorage(page: Page, progress: unknown, session: unknown = null) {
  const expectedStorage = [
    JSON.stringify(progress),
    JSON.stringify(defaultSettings),
    JSON.stringify(session),
  ];
  await page.addInitScript(
    ({ keys, expected }) => {
      localStorage.clear();
      keys.forEach((key, index) => localStorage.setItem(key, expected[index]));
    },
    { keys: storageKeys, expected: expectedStorage }
  );
  return expectedStorage;
}

async function seedStorageOnLoadedPage(page: Page, progress: unknown, session: unknown = null) {
  const expectedStorage = [
    JSON.stringify(progress),
    JSON.stringify(defaultSettings),
    JSON.stringify(session),
  ];
  await gotoDepHome(page);
  await page.evaluate(
    ({ keys, expected }) => {
      localStorage.clear();
      keys.forEach((key, index) => localStorage.setItem(key, expected[index]));
    },
    { keys: storageKeys, expected: expectedStorage }
  );
  await page.reload();
  await expect(page.locator('#home-view')).toBeVisible();
  return expectedStorage;
}

async function expectStorageSnapshot(page: Page, expectedStorage: string[]) {
  await expect
    .poll(() => page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), storageKeys))
    .toEqual(expectedStorage);
}

async function openAnalysis(page: Page) {
  await gotoDepHome(page);
  await openAnalysisFromHome(page);
}

async function openAnalysisFromHome(page: Page) {
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await expect(page.locator('#analysis-view')).toBeVisible();
}

function overallSummary(page: Page) {
  return page.locator('section[aria-labelledby="analysis-summary-title"]');
}

function metric(summary: Locator, label: string) {
  return summary
    .locator('.analysis-metric')
    .filter({ has: summary.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .first();
}

async function expectMetric(summary: Locator, label: string, value: string) {
  await expect(metric(summary, label).locator('dd.analysis-metric__value')).toHaveText(value);
}

function tagItem(summary: Locator, label: string) {
  return summary
    .locator('.analysis-tag-item')
    .filter({ has: summary.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .first();
}

async function expectTagCount(summary: Locator, label: string, value: string) {
  await expect(tagItem(summary, label).locator('dd.analysis-tag-item__count')).toHaveText(value);
}

test.describe('[DEP][UI] Weakness analysis / Reset entry', () => {
  test('guarantees reset entry opens dialog with plan impact erased and retained data', async ({
    page,
  }) => {
    await seedStorage(page, progressFixture, sessionFixture);
    await openAnalysis(page);

    const view = page.locator('#analysis-view');
    await expect(page.getByRole('button', { name: '← ホームへ戻る' })).toBeVisible();
    const resetButton = page.getByRole('button', { name: '学習履歴をリセット' });
    const resetMessage = page.locator('.analysis-reset-message');
    await expect(resetMessage).toHaveText('最新の学習状況から弱点分析を表示します。');
    await expect(resetButton).toBeVisible();
    const [viewBox, resetPanelBox, resetButtonBox, resetMessageBox, summaryBox] = await Promise.all(
      [
        view.boundingBox(),
        page.locator('.analysis-reset-panel').boundingBox(),
        resetButton.boundingBox(),
        resetMessage.boundingBox(),
        page.getByRole('heading', { name: '学習全体サマリ' }).boundingBox(),
      ]
    );
    expect(viewBox).not.toBeNull();
    expect(resetPanelBox).not.toBeNull();
    expect(resetButtonBox).not.toBeNull();
    expect(resetMessageBox).not.toBeNull();
    expect(summaryBox).not.toBeNull();
    expect(resetMessageBox!.x).toBeLessThanOrEqual(resetPanelBox!.x + 1);
    await expect(resetMessage).toHaveCSS('text-align', 'left');
    if ((page.viewportSize()?.width ?? 0) >= 600) {
      expect(resetButtonBox!.x).toBeGreaterThan(resetMessageBox!.x + resetMessageBox!.width - 1);
      expect(resetButtonBox!.x + resetButtonBox!.width).toBeGreaterThan(
        viewBox!.x + viewBox!.width - 32
      );
      expect(
        Math.abs(
          resetButtonBox!.y +
            resetButtonBox!.height / 2 -
            (resetMessageBox!.y + resetMessageBox!.height / 2)
        )
      ).toBeLessThan(8);
    }
    expect(resetButtonBox!.y).toBeLessThan(summaryBox!.y);
    await expect(view).not.toContainText('2問の学習履歴がリセット対象です');
    await expect(view).not.toContainText('リセット対象問題');
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    const dialog = page.locator('#learning-history-reset-dialog');
    await expect(dialog).toContainText('2問の学習履歴がリセット対象です');
    await expect(dialog).toContainText('リセット対象問題');
    await expect(dialog).toContainText('2問');
    await expect(dialog).toContainText('保持するメモ');
    await expect(dialog).toContainText('1件');
    await expect(dialog).toContainText('保持するブックマーク');
    await expect(dialog).toContainText('2件');
    await expect(dialog).toContainText('中断セッション');
    await expect(dialog).toContainText('削除予定');
    await expect(dialog).toContainText('正解・不正解の履歴');
    await expect(dialog).toContainText('最終回答日時');
    await expect(dialog).toContainText('誤答理由タグ');
    await expect(dialog).toContainText('自分用メモ');
    await expect(dialog).toContainText('学習設定');
  });

  test('guarantees reset entry distinguishes session-only and empty states', async ({ page }) => {
    await seedStorage(page, {}, sessionFixture);
    await openAnalysis(page);
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeVisible();
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await expect(page.locator('#learning-history-reset-dialog')).toContainText(
      'リセット対象の学習履歴はありませんが、リセットを確定すると中断データは削除されます。'
    );
    await page.getByRole('button', { name: 'キャンセル' }).click();

    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();
    await page.evaluate(() => localStorage.setItem('depQuizActiveSession', 'null'));
    await page.getByRole('button', { name: '弱点を分析' }).click();
    await expect(page.locator('.analysis-reset-message')).toBeVisible();
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeHidden();
  });

  test('guarantees reset entry mobile has no horizontal overflow and return controls work', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await seedStorage(page, progressFixture, sessionFixture);
    await openAnalysis(page);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
    const resetButton = page.getByRole('button', { name: '学習履歴をリセット' });
    await expect(resetButton).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: '← ホームへ戻る' })).toHaveCSS(
      'min-height',
      '44px'
    );
    await page.getByRole('button', { name: '← ホームへ戻る' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
  });
});

test.describe('[DEP][DATA] Weakness analysis / Reset reload consistency', () => {
  test('guarantees committed reset survives reload with retained data only and refreshed analysis', async ({
    page,
  }) => {
    await seedStorageOnLoadedPage(page, analysisProgressFixture, analysisSessionFixture);
    await openAnalysisFromHome(page);
    await expectMetric(overallSummary(page), '誤答数', '2');
    await expectMetric(overallSummary(page), '正答率 ※', '33%');
    await expect(page.locator('[aria-labelledby="analysis-tags-title"]')).toContainText(
      '概念・挙動がイメージできない'
    );

    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    await expect(page.locator('#learning-history-reset-success')).toContainText(
      '学習履歴をリセットしました。メモ・ブックマーク・学習設定は保持されています。'
    );

    await page.reload();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.getByRole('button', { name: '中断データを削除' })).toBeHidden();

    const storage = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      storageKeys
    );
    const progress = JSON.parse(storage[0] ?? '{}');
    expect(storage[1]).toBe(JSON.stringify(defaultSettings));
    expect(storage[2]).toBeNull();
    expect(progress['DEP-Q202']).toEqual({
      bookmark: true,
      noteText: 'Lakeflow Jobs の復習メモ',
      noteUpdatedAt: '2026-07-04T00:01:00.000Z',
      unknownRetainedAttribute: 'keep me after reset',
    });
    expect(progress['DEP-Q202']).not.toHaveProperty('seenCount');
    expect(progress['DEP-Q202']).not.toHaveProperty('correctCount');
    expect(progress['DEP-Q202']).not.toHaveProperty('wrongCount');
    expect(progress['DEP-Q202']).not.toHaveProperty('lastAnsweredAt');
    expect(progress['DEP-Q202']).not.toHaveProperty('wrongReasonTags');
    expect(progress['DEP-Q202']).not.toHaveProperty('wrongReasonUpdatedAt');
    expect(progress['DEP-Q204']).toBeUndefined();
    expect(progress['DEP-Q203']).toMatchObject({ bookmark: true });

    await openAnalysisFromHome(page);
    await expectMetric(overallSummary(page), '誤答数', '0');
    await expectMetric(overallSummary(page), '正答率 ※', '未算出');
    await expect(page.locator('#analysis-view')).not.toContainText('33%');
    await expectTagCount(
      page.locator('[aria-labelledby="analysis-tags-title"]'),
      '概念・挙動がイメージできない',
      '0問'
    );
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeHidden();
  });

  test('guarantees session-only reset survives reload without changing progress or settings raw strings', async ({
    page,
  }) => {
    const expectedStorage = await seedStorageOnLoadedPage(page, {}, analysisSessionFixture);
    await openAnalysisFromHome(page);
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();

    await page.reload();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.getByRole('button', { name: '中断データを削除' })).toBeHidden();

    const storage = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      storageKeys
    );
    expect(storage[0]).toBe(expectedStorage[0]);
    expect(storage[1]).toBe(expectedStorage[1]);
    expect(storage[2]).toBeNull();

    await openAnalysisFromHome(page);
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeHidden();
  });
});

test.describe('[DEP][FLOW] Learning history reset / Review routes after reset', () => {
  test('guarantees wrong-only review uses no stale wrong history after reset', async ({ page }) => {
    await seedStorageOnLoadedPage(page, analysisProgressFixture, analysisSessionFixture);
    await openAnalysisFromHome(page);
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.getByRole('button', { name: '中断データを削除' })).toBeHidden();

    await page.locator('input[name="mode"][value="wrongOnly"]').check();
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.locator('#quiz-view')).toBeHidden();
    await expect(page.locator('#home-message')).toContainText('対象となる問題がありません');
    const storage = await page.evaluate(() => ({
      progress: JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}'),
      session: localStorage.getItem('depQuizActiveSession'),
    }));
    expect(storage.session).toBeNull();
    expect(storage.progress['DEP-Q202']).not.toHaveProperty('wrongCount');
    expect(storage.progress['DEP-Q202']).not.toHaveProperty('wrongReasonTags');
    expect(storage.progress['DEP-Q204']).toBeUndefined();
  });

  test('guarantees bookmark review keeps retained bookmarks without restoring old history', async ({
    page,
  }) => {
    await seedStorageOnLoadedPage(page, analysisProgressFixture, analysisSessionFixture);
    await openAnalysisFromHome(page);
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();

    await page.locator('input[name="mode"][value="bookmarks"]').check();
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    const reviewSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );
    const reviewProgress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')
    );
    expect(reviewSession.mode).toBe('bookmarks');
    expect(reviewSession.order).toEqual(['DEP-Q202', 'DEP-Q203']);
    for (const id of reviewSession.order as string[]) {
      expect(reviewProgress[id]?.bookmark).toBe(true);
      expect(reviewProgress[id]).not.toHaveProperty('seenCount');
      expect(reviewProgress[id]).not.toHaveProperty('correctCount');
      expect(reviewProgress[id]).not.toHaveProperty('wrongCount');
      expect(reviewProgress[id]).not.toHaveProperty('wrongReasonTags');
    }
  });

  test('guarantees notes-only review keeps retained memo text after reset', async ({ page }) => {
    await seedStorageOnLoadedPage(page, analysisProgressFixture, analysisSessionFixture);
    await openAnalysisFromHome(page);
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();

    await page.getByRole('button', { name: 'メモあり問題を復習' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    await expect(page.locator('#quiz-question .quiz-question-id')).toHaveText('DEP-Q202');
    await expect(page.locator('#question-note')).toHaveValue('Lakeflow Jobs の復習メモ');

    const reviewSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );
    const reviewProgress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')
    );
    expect(reviewSession.mode).toBe('notesOnly');
    expect(reviewSession.order).toEqual(['DEP-Q202']);
    expect(reviewProgress['DEP-Q202'].noteText).toBe('Lakeflow Jobs の復習メモ');
    expect(reviewProgress['DEP-Q202']).not.toHaveProperty('wrongCount');
    expect(reviewProgress['DEP-Q202']).not.toHaveProperty('wrongReasonTags');
  });
});

test.describe('[DEP][DATA] Weakness analysis / Reset entry immutability', () => {
  test('guarantees reset entry and home return keep raw storage strings unchanged', async ({
    page,
  }) => {
    const expectedStorage = await seedStorage(page, progressFixture, sessionFixture);
    await openAnalysis(page);
    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expectStorageSnapshot(page, expectedStorage);
  });
});

test.describe('[DEP][FLOW] Weakness analysis / Reset confirmation', () => {
  test('guarantees final confirmation cancel and escape keep raw storage unchanged', async ({
    page,
  }) => {
    const expectedStorage = await seedStorage(page, progressFixture, sessionFixture);
    await openAnalysis(page);

    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    const dialog = page.locator('#learning-history-reset-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'キャンセル' })).toBeFocused();
    await expect(dialog).toContainText('2問の学習履歴がリセット対象です');
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeFocused();
    await expectStorageSnapshot(page, expectedStorage);

    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeFocused();
    await expectStorageSnapshot(page, expectedStorage);
  });

  test('guarantees reset commit preserves notes bookmarks settings and clears history session', async ({
    page,
  }) => {
    await seedStorage(page, progressFixture, sessionFixture);
    await openAnalysis(page);
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();

    await expect(page.locator('#learning-history-reset-dialog')).toBeHidden();
    await expect(page.locator('#learning-history-reset-success')).toContainText(
      '学習履歴をリセットしました。メモ・ブックマーク・学習設定は保持されています。'
    );
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeHidden();

    const storage = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      storageKeys
    );
    const progress = JSON.parse(storage[0] ?? '{}');
    expect(storage[1]).toBe(JSON.stringify(defaultSettings));
    expect(storage[2]).toBeNull();
    expect(progress['dep-q-001']).toEqual({
      bookmark: true,
      noteText: 'Lakeflow Jobs の復習メモ',
      noteUpdatedAt: '2026-07-04T00:01:00.000Z',
      unknownRetainedAttribute: 'keep me after reset',
    });
    expect(progress['dep-q-002']).toBeUndefined();
    expect(progress['dep-q-003']).toMatchObject({ bookmark: true });

    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.getByRole('button', { name: '中断データを削除' })).toBeHidden();
  });

  test('guarantees session-only reset clears only active session and keeps raw progress settings', async ({
    page,
  }) => {
    const expectedStorage = await seedStorage(page, {}, sessionFixture);
    await openAnalysis(page);

    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeVisible();
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();

    await expect(page.locator('#learning-history-reset-dialog')).toBeHidden();
    await expect(page.locator('#learning-history-reset-success')).toContainText(
      '学習履歴をリセットしました。メモ・ブックマーク・学習設定は保持されています。'
    );
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeHidden();

    const storage = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      storageKeys
    );
    expect(storage[0]).toBe(expectedStorage[0]);
    expect(storage[1]).toBe(expectedStorage[1]);
    expect(storage[2]).toBeNull();

    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();
    await expect(page.locator('#resume-btn')).toBeHidden();
    await expect(page.getByRole('button', { name: '中断データを削除' })).toBeHidden();
  });

  test('guarantees empty reset state has no confirmation entry and keeps raw storage unchanged', async ({
    page,
  }) => {
    const expectedStorage = await seedStorage(page, {}, null);
    await openAnalysis(page);

    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeHidden();
    await expect(page.locator('#learning-history-reset-dialog')).toBeHidden();
    await expectStorageSnapshot(page, expectedStorage);

    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expectStorageSnapshot(page, expectedStorage);
  });

  test('guarantees storage failure keeps dialog open and allows retry without success state', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const originalRemoveItem = Storage.prototype.removeItem;
      let failed = false;
      Storage.prototype.removeItem = function removeItem(key) {
        if (key === 'depQuizActiveSession' && !failed) {
          failed = true;
          throw new Error('Injected removeItem failure');
        }
        return originalRemoveItem.call(this, key);
      };
    });
    const expectedStorage = await seedStorage(page, progressFixture, sessionFixture);
    await openAnalysis(page);
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();

    await expect(page.locator('#learning-history-reset-dialog')).toBeVisible();
    await expect(page.locator('#learning-history-reset-dialog-error')).toContainText(
      '保存に失敗しました。データの状態を確認してから再試行してください。'
    );
    await expect(page.getByRole('button', { name: '再試行' })).toBeEnabled();
    await expect(page.locator('#learning-history-reset-success')).toBeHidden();
    await expectStorageSnapshot(page, expectedStorage);
  });

  test('guarantees restore failure keeps reset blocked after closing and reopening dialog', async ({
    page,
  }) => {
    const expectedStorage = await seedStorage(page, progressFixture, sessionFixture);
    await openAnalysis(page);
    await page.evaluate(() => {
      const originalRemoveItem = Storage.prototype.removeItem;
      const originalSetItem = Storage.prototype.setItem;
      let sessionRemovalFailed = false;
      Storage.prototype.removeItem = function removeItem(key) {
        if (key === 'depQuizActiveSession' && !sessionRemovalFailed) {
          sessionRemovalFailed = true;
          throw new Error('Injected removeItem failure');
        }
        return originalRemoveItem.call(this, key);
      };
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === 'depQuizActiveSession' && sessionRemovalFailed) {
          throw new Error('Injected restore setItem failure');
        }
        return originalSetItem.call(this, key, value);
      };
    });

    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();

    const dialog = page.locator('#learning-history-reset-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#learning-history-reset-dialog-error')).toContainText(
      '画面を閉じ、再読み込みして状態を確認してください。'
    );
    await expect(page.getByRole('button', { name: '再試行できません' })).toBeDisabled();
    await expectStorageSnapshot(page, expectedStorage);

    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await expect(dialog).toBeVisible();
    await expect(page.locator('#learning-history-reset-dialog-error')).toContainText(
      '画面を閉じ、再読み込みして状態を確認してください。'
    );
    await expect(page.getByRole('button', { name: '再試行できません' })).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await expect(page.getByRole('button', { name: '再試行できません' })).toBeDisabled();
    await expectStorageSnapshot(page, expectedStorage);
  });

  test('guarantees mobile confirmation dialog has no horizontal overflow and touch targets', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await seedStorage(page, progressFixture, sessionFixture);
    await openAnalysis(page);
    await page.getByRole('button', { name: '学習履歴をリセット' }).click();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
    await expect(page.getByRole('button', { name: 'キャンセル' })).toHaveCSS('min-height', '44px');
    await expect(page.getByRole('button', { name: '学習履歴をリセットする' })).toHaveCSS(
      'min-height',
      '44px'
    );
  });
});
