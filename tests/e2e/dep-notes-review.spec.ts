import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('[DEP][FLOW] Review / Notes-only session', () => {
  test('guarantees notes-only review starts with only questions that have notes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');

    const notedQuestionId = (
      await page.locator('#quiz-question .quiz-question-id').textContent()
    )?.trim();
    expect(notedQuestionId).toBeTruthy();

    await answerCurrentQuestion(page);
    await page.locator('#question-note').fill('復習対象メモ');
    await page.getByRole('button', { name: 'メモを保存' }).click();
    await expect(page.locator('#note-status')).toContainText('メモを保存しました。');

    const progressBeforeReview = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')
    );
    const notedProgress = progressBeforeReview[notedQuestionId as string];
    expect(notedProgress).toBeTruthy();
    expect(notedProgress.note).toBeTruthy();
    expect(notedProgress.noteText).toBe('復習対象メモ');
    expect(notedProgress.noteUpdatedAt).toBeTruthy();

    const notedIds = Object.entries(progressBeforeReview)
      .filter(([, value]) => {
        const item = value as { note?: string; noteText?: string };
        return Boolean((item.note ?? '').trim() || (item.noteText ?? '').trim());
      })
      .map(([id]) => id);

    expect(notedIds.length).toBeGreaterThan(0);
    expect(notedIds).toContain(notedQuestionId);

    await page.getByRole('button', { name: 'ホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.getByRole('button', { name: 'メモあり問題を復習' })).toBeVisible();

    await page.getByRole('button', { name: 'メモあり問題を復習' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    const reviewQuestionId = (
      await page.locator('#quiz-question .quiz-question-id').textContent()
    )?.trim();
    expect(reviewQuestionId).toBeTruthy();
    expect(reviewQuestionId).toBe(notedQuestionId);
    expect(notedIds).toContain(reviewQuestionId as string);

    const reviewSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );
    expect(reviewSession).toBeTruthy();
    expect(reviewSession.mode).toBe('notesOnly');
    expect(reviewSession.order).toEqual(notedIds);
  });
});
