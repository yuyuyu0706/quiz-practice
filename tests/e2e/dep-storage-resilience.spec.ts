import { test, expect } from '@playwright/test';

test.describe('dep storage resilience', () => {
  test('recovers from corrupted localStorage payloads without crashing', async ({
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

    const state = await page.evaluate(() => ({
      progress: localStorage.getItem('depQuizProgress'),
      settings: localStorage.getItem('depQuizSettings'),
      activeSession: localStorage.getItem('depQuizActiveSession'),
    }));

    expect(() => JSON.parse(state.progress ?? '{}')).not.toThrow();
    expect(() => JSON.parse(state.settings ?? '{}')).not.toThrow();
    expect(state.activeSession === null || state.activeSession === '').toBeTruthy();
  });
});
