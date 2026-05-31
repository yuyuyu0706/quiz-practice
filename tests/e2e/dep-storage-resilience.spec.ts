import { test, expect } from '@playwright/test';

const DEP_STORAGE_KEYS = ['depQuizProgress', 'depQuizSettings', 'depQuizActiveSession'] as const;

async function expectStorageKeysToBeParseable(page, keys: readonly string[]) {
  const parseResults = await page.evaluate((storageKeys) => {
    return storageKeys.map((key) => {
      const value = localStorage.getItem(key);
      try {
        JSON.parse(value ?? 'null');
        return { key, canParse: true };
      } catch {
        return { key, canParse: false };
      }
    });
  }, keys);

  expect(parseResults).toEqual(keys.map((key) => ({ key, canParse: true })));
}

test.describe('[DEP][DATA] Storage / Corruption recovery', () => {
  test('guarantees corrupted localStorage payloads recover without app crash', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await page.addInitScript(() => {
      localStorage.setItem('depQuizProgress', '{broken-json');
      localStorage.setItem('depQuizSettings', '{bad-settings');
      localStorage.setItem('depQuizActiveSession', '{bad-session');
    });

    await page.goto('/dep-quiz-app/');

    await expect(page.locator('#home-view')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Databricks Certified DEP 練習問題' })
    ).toBeVisible();
    await expectStorageKeysToBeParseable(page, DEP_STORAGE_KEYS);
  });

  test('guarantees corrupted progress data repair shows the repaired key', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await page.addInitScript(() => {
      localStorage.setItem('depQuizProgress', '{broken-json');
    });

    await page.goto('/dep-quiz-app/');

    await expect(page.locator('#home-view')).toBeVisible();
    const notice = page.locator('.storage-repair-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('保存データの一部が破損していたため、自動修復しました。');
    await expect(notice).toContainText('学習進捗データ（depQuizProgress）');
    await expectStorageKeysToBeParseable(page, ['depQuizProgress']);
  });

  test('guarantees multiple corrupted storage keys are repaired and listed', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await page.addInitScript(() => {
      localStorage.setItem('depQuizProgress', '{broken-json');
      localStorage.setItem('depQuizSettings', '{bad-settings');
      localStorage.setItem('depQuizActiveSession', '{bad-session');
    });

    await page.goto('/dep-quiz-app/');

    const notice = page.locator('.storage-repair-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('学習進捗データ（depQuizProgress）');
    await expect(notice).toContainText('設定データ（depQuizSettings）');
    await expect(notice).toContainText('前回セッションデータ（depQuizActiveSession）');
    await expectStorageKeysToBeParseable(page, DEP_STORAGE_KEYS);
  });

  test('guarantees storage repair notice can be dismissed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await page.addInitScript(() => {
      localStorage.setItem('depQuizProgress', '{broken-json');
    });

    await page.goto('/dep-quiz-app/');

    const notice = page.locator('.storage-repair-notice');
    await expect(notice).toBeVisible();
    await page.getByRole('button', { name: '保存データ修復通知を閉じる' }).click();
    await expect(notice).toBeHidden();
  });
});
