import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('[DEP][DATA] Notes / Bulk delete', () => {
  test('guarantees bulk note deletion preserves progress records', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');

    const firstQuestionId = (
      await page.locator('#quiz-question .quiz-question-id').textContent()
    )?.trim();
    expect(firstQuestionId).toBeTruthy();

    await answerCurrentQuestion(page);
    await page.locator('#question-note').fill('メモ1');
    await page.getByRole('button', { name: 'メモを保存' }).click();
    await expect(page.locator('#note-status')).toContainText('メモを保存しました。');

    await page.locator('#next-question').click();
    await expect(page.locator('#quiz-question .quiz-question-id')).not.toHaveText(
      firstQuestionId as string
    );

    const secondQuestionId = (
      await page.locator('#quiz-question .quiz-question-id').textContent()
    )?.trim();
    expect(secondQuestionId).toBeTruthy();
    expect(secondQuestionId).not.toBe(firstQuestionId);

    await answerCurrentQuestion(page);
    const secondNoteInput = page.locator('#question-note:visible');
    await secondNoteInput.click();
    await secondNoteInput.fill('メモ2');
    await expect(secondNoteInput).toHaveValue('メモ2');
    await page.getByRole('button', { name: 'メモを保存' }).click();

    await page.waitForFunction(
      ({ questionId, expected }) => {
        const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
        return progress?.[questionId]?.noteText === expected;
      },
      { questionId: secondQuestionId, expected: 'メモ2' }
    );

    await page.getByRole('button', { name: 'ホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();

    await page.getByRole('button', { name: 'メモ一覧' }).click();
    await expect(page.locator('#notes-view')).toBeVisible();

    const notesBeforeDelete = page.locator('.note-card');
    await expect(notesBeforeDelete).toHaveCount(2);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'メモを全削除' }).click();

    await expect(page.locator('#notes-empty')).toBeVisible();
    await expect(page.locator('.note-card')).toHaveCount(0);

    const progressAfterDelete = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')
    );

    const notedEntries = Object.entries(progressAfterDelete).filter(([, value]) => {
      const item = value as { note?: string; noteText?: string; noteUpdatedAt?: string | null };
      return Boolean(item.note || item.noteText || item.noteUpdatedAt);
    });
    expect(notedEntries).toHaveLength(0);

    const firstProgress = progressAfterDelete[firstQuestionId as string];
    const secondProgress = progressAfterDelete[secondQuestionId as string];

    expect(firstProgress).toBeTruthy();
    expect(secondProgress).toBeTruthy();

    expect(firstProgress.note).toBe('');
    expect(firstProgress.noteText).toBe('');
    expect(firstProgress.noteUpdatedAt).toBeNull();
    expect(secondProgress.note).toBe('');
    expect(secondProgress.noteText).toBe('');
    expect(secondProgress.noteUpdatedAt).toBeNull();

    for (const questionProgress of [firstProgress, secondProgress]) {
      expect(questionProgress.correctCount + questionProgress.wrongCount).toBeGreaterThanOrEqual(1);
      expect(questionProgress.seenCount).toBeGreaterThanOrEqual(1);
    }
  });
});
