import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, gotoDepHome, startDepQuiz } from './helpers';

type ProgressItem = {
  bookmark?: boolean;
  wrongCount?: number;
  note?: string;
  noteText?: string;
};

test.describe('[DEP][FLOW] Review / Desktop modes', () => {
  test('guarantees bookmark-only review includes only bookmarked questions', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');

    const bookmarkedId = (
      await page.locator('#quiz-question .quiz-question-id').textContent()
    )?.trim();
    expect(bookmarkedId).toBeTruthy();

    await answerCurrentQuestion(page);
    await page.getByRole('button', { name: 'ブックマーク☆' }).click();
    await expect(page.getByRole('button', { name: 'ブックマーク★' })).toBeVisible();

    const progressBeforeReview = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')
    );
    expect(progressBeforeReview[bookmarkedId as string]?.bookmark).toBe(true);

    await page.getByRole('button', { name: 'ホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();

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
    expect(reviewSession.order.length).toBeGreaterThan(0);
    expect(reviewSession.order).toContain(bookmarkedId);
    for (const id of reviewSession.order as string[]) {
      expect((reviewProgress[id] as ProgressItem | undefined)?.bookmark).toBe(true);
    }
  });

  test('guarantees wrong-only review includes only questions with wrong answer history', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');

    const wrongQuestionId = (
      await page.locator('#quiz-question .quiz-question-id').textContent()
    )?.trim();
    expect(wrongQuestionId).toBeTruthy();

    await page.locator('#choices-form label').nth(1).click();
    await page.getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);

    const progressAfterAnswer = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')
    );
    expect(progressAfterAnswer[wrongQuestionId as string]?.wrongCount ?? 0).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'ホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();

    await page.locator('input[name="mode"][value="wrongOnly"]').check();
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    const reviewSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );
    const reviewProgress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')
    );

    expect(reviewSession.mode).toBe('wrongOnly');
    expect(reviewSession.order.length).toBeGreaterThan(0);
    expect(reviewSession.order).toContain(wrongQuestionId);
    for (const id of reviewSession.order as string[]) {
      expect(reviewProgress[id]?.wrongCount ?? 0).toBeGreaterThan(0);
    }
  });

  test('guarantees notes-only review empty state appears when no notes exist', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await gotoDepHome(page);
    await page.getByRole('button', { name: 'メモあり問題を復習' }).click();

    await expect(page.locator('#home-message')).toContainText('メモが登録された問題がありません');
    await expect(page.locator('#home-view')).toBeVisible();
  });

  test('guarantees bookmark-only review empty state appears when no bookmarks exist', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await gotoDepHome(page);
    await page.locator('input[name="mode"][value="bookmarks"]').check();
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.locator('#home-message')).toContainText('対象となる問題がありません');
    await expect(page.locator('#home-view')).toBeVisible();
  });

  test('guarantees wrong-only review empty state appears when no wrong answers exist', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await gotoDepHome(page);
    await page.locator('input[name="mode"][value="wrongOnly"]').check();
    await page.getByRole('button', { name: '開始' }).click();

    await expect(page.locator('#home-message')).toContainText('対象となる問題がありません');
    await expect(page.locator('#home-view')).toBeVisible();
  });
});
