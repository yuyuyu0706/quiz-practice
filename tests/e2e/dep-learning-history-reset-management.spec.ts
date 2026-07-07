import { test, expect, type Page } from '@playwright/test';

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

async function expectStorageSnapshot(page: Page, expectedStorage: string[]) {
  await expect
    .poll(() => page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), storageKeys))
    .toEqual(expectedStorage);
}

async function openDataManagement(page: Page) {
  await gotoDepHome(page);
  await page.getByRole('button', { name: '学習データを管理' }).click();
  await expect(page.locator('#data-management-view')).toBeVisible();
}

test.describe('[DEP][UI] Learning data / Reset overview', () => {
  test('guarantees reset overview shows plan impact erased and retained data', async ({ page }) => {
    await seedStorage(page, progressFixture, sessionFixture);
    await openDataManagement(page);

    const view = page.locator('#data-management-view');
    await expect(page.getByRole('heading', { name: '学習データ管理' })).toBeFocused();
    await expect(view).toContainText('2問の学習履歴がリセット対象です');
    await expect(view).toContainText('リセット対象問題');
    await expect(view).toContainText('2問');
    await expect(view).toContainText('保持するメモ');
    await expect(view).toContainText('1件');
    await expect(view).toContainText('保持するブックマーク');
    await expect(view).toContainText('2件');
    await expect(view).toContainText('中断セッション');
    await expect(view).toContainText('削除予定');
    await expect(view).toContainText('正解・不正解の履歴');
    await expect(view).toContainText('最終回答日時');
    await expect(view).toContainText('誤答理由タグ');
    await expect(view).toContainText('自分用メモ');
    await expect(view).toContainText('学習設定');
  });

  test('guarantees reset overview distinguishes session-only and empty states', async ({
    page,
  }) => {
    await seedStorage(page, {}, sessionFixture);
    await openDataManagement(page);
    await expect(page.locator('#data-management-view')).toContainText(
      'リセット対象の学習履歴はありませんが、リセットを確定すると中断データは削除されます。'
    );

    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();
    await page.evaluate(() => localStorage.setItem('depQuizActiveSession', 'null'));
    await page.getByRole('button', { name: '学習データを管理' }).click();
    await expect(page.locator('#data-management-view')).toContainText(
      'リセット対象の学習履歴はありません。'
    );
    await expect(page.locator('#data-management-view')).toContainText('影響なし');
  });

  test('guarantees reset overview mobile has no horizontal overflow and return controls work', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await seedStorage(page, progressFixture, sessionFixture);
    await openDataManagement(page);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
    await expect(page.getByRole('button', { name: '← ホームへ戻る' })).toHaveCSS(
      'min-height',
      '44px'
    );
    await page.getByRole('button', { name: '← ホームへ戻る' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
  });
});

test.describe('[DEP][DATA] Learning data / Reset overview immutability', () => {
  test('guarantees reset overview and home return keep raw storage strings unchanged', async ({
    page,
  }) => {
    const expectedStorage = await seedStorage(page, progressFixture, sessionFixture);
    await openDataManagement(page);
    await page.getByRole('button', { name: 'ホームへ戻る' }).last().click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expectStorageSnapshot(page, expectedStorage);
  });
});
