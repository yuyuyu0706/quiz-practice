import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('[DEP][DATA] Notes / Bookmark coexistence', () => {
  test('guarantees note deletion preserves bookmarks and bookmark deletion preserves notes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');
    const qid = (await page.locator('#quiz-question .quiz-question-id').textContent())?.trim();
    expect(qid).toBeTruthy();

    await answerCurrentQuestion(page);

    await page.getByRole('button', { name: 'ブックマーク☆' }).click();
    await expect(page.getByRole('button', { name: 'ブックマーク★' })).toBeVisible();

    await page.locator('#question-note').fill('共存確認メモ');
    await page.getByRole('button', { name: 'メモを保存' }).click();

    const beforeDelete = await page.evaluate((id) => {
      const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
      return progress[id];
    }, qid as string);
    expect(beforeDelete.bookmark).toBe(true);
    expect(beforeDelete.note || beforeDelete.noteText).toBeTruthy();

    await page.locator('#question-note').fill('');
    await page.getByRole('button', { name: 'メモを保存' }).click();

    const afterNoteDelete = await page.evaluate((id) => {
      const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
      return progress[id];
    }, qid as string);
    expect(afterNoteDelete.bookmark).toBe(true);
    expect((afterNoteDelete.note ?? '').trim()).toBe('');
    expect((afterNoteDelete.noteText ?? '').trim()).toBe('');

    await page.getByRole('button', { name: 'ブックマーク★' }).click();
    await expect(page.getByRole('button', { name: 'ブックマーク☆' })).toBeVisible();

    await page.locator('#question-note').fill('ブックマーク解除後メモ');
    await page.getByRole('button', { name: 'メモを保存' }).click();

    const afterBookmarkRemove = await page.evaluate((id) => {
      const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
      return progress[id];
    }, qid as string);
    expect(afterBookmarkRemove.bookmark ?? false).toBe(false);
    expect((afterBookmarkRemove.note || afterBookmarkRemove.noteText) ?? '').toContain('メモ');
  });
});
