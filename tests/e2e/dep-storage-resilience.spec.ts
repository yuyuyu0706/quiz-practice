import { test, expect } from '@playwright/test';
import { answerCurrentQuestion } from './helpers';

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

    expect(state.activeSession === null || state.activeSession === '').toBeTruthy();

    const canParseProgress = (() => {
      try {
        JSON.parse(state.progress ?? '{}');
        return true;
      } catch {
        return false;
      }
    })();

    const canParseSettings = (() => {
      try {
        JSON.parse(state.settings ?? '{}');
        return true;
      } catch {
        return false;
      }
    })();

    if (!canParseProgress) {
      await page.getByRole('button', { name: '開始' }).click();
      await expect(page.locator('#quiz-view')).toBeVisible();
      await answerCurrentQuestion(page);
      const progressAfterAnswer = await page.evaluate(() =>
        localStorage.getItem('depQuizProgress')
      );
      expect(() => JSON.parse(progressAfterAnswer ?? '{}')).not.toThrow();
      await page.getByRole('button', { name: '中断してホームへ' }).click();
      await expect(page.locator('#home-view')).toBeVisible();
    }

    if (!canParseSettings) {
      await page.reload();
      await expect(page.locator('#home-view')).toBeVisible();
      await expect(page.locator('#question-count')).toHaveValue('50');
    }
  });
});
