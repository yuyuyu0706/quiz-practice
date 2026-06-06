import { test, expect, type Page } from '@playwright/test';
import { answerCurrentQuestion, startDeaPlusQuiz } from './helpers';

type DeaPlusProgressItem = {
  seenCount?: number;
  correctCount?: number;
  wrongCount?: number;
  bookmark?: boolean;
  noteText?: string;
  noteUpdatedAt?: string | null;
};

type DeaPlusSession = {
  mode?: string;
  order?: string[];
};

async function getCurrentQuestionId(page: Page): Promise<string> {
  const questionId = (await page.locator('#quiz-question .quiz-question-id').textContent())?.trim();
  expect(questionId).toBeTruthy();
  return questionId as string;
}

async function loadDeaPlusProgress(page: Page): Promise<Record<string, DeaPlusProgressItem>> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('deaPlusQuizProgress') ?? '{}'));
}

async function saveCurrentNote(page: Page, noteText: string) {
  await page.locator('#question-note').fill(noteText);
  await page.getByRole('button', { name: 'メモを保存' }).click();
  await expect(page.locator('#note-status')).toContainText('メモを保存しました。');
}

test.describe('[DEA][DATA] Notes / Plus persistence', () => {
  test('guarantees DEA Plus note create restore and delete preserves progress data', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDeaPlusQuiz(page, '10');
    await expect(page.locator('#note-panel')).toBeHidden();

    const questionId = await getCurrentQuestionId(page);
    await answerCurrentQuestion(page);
    await expect(page.locator('#note-panel')).toBeVisible();

    await saveCurrentNote(page, 'DEA Plus 復元確認メモ');

    const progressAfterSave = await loadDeaPlusProgress(page);
    const savedProgress = progressAfterSave[questionId];
    expect(savedProgress).toBeTruthy();
    expect(savedProgress.noteText).toBe('DEA Plus 復元確認メモ');
    expect(savedProgress.noteUpdatedAt).toBeTruthy();
    expect(savedProgress.seenCount).toBeGreaterThanOrEqual(1);
    expect(
      (savedProgress.correctCount ?? 0) + (savedProgress.wrongCount ?? 0)
    ).toBeGreaterThanOrEqual(1);

    await page.getByRole('button', { name: 'ブックマーク☆' }).click();
    await expect(page.getByRole('button', { name: 'ブックマーク★' })).toBeVisible();

    const progressAfterBookmark = await loadDeaPlusProgress(page);
    expect(progressAfterBookmark[questionId].bookmark).toBe(true);
    expect(progressAfterBookmark[questionId].noteText).toBe('DEA Plus 復元確認メモ');
    const seenCountAfterBookmark = progressAfterBookmark[questionId].seenCount;

    await page.getByRole('button', { name: '次へ', exact: true }).click();
    await expect(page.locator('#quiz-progress')).toContainText('2 / 10');
    await page.getByRole('button', { name: '前へ', exact: true }).click();
    await expect(page.locator('#quiz-progress')).toContainText('1 / 10');
    await expect(page.locator('#question-note')).toHaveValue('DEA Plus 復元確認メモ');
    await expect(page.getByRole('button', { name: 'ブックマーク★' })).toBeVisible();

    await page.getByRole('button', { name: 'メモを削除' }).click();
    await expect(page.locator('#note-status')).toContainText('メモを削除しました。');

    const progressAfterDelete = await loadDeaPlusProgress(page);
    const deletedProgress = progressAfterDelete[questionId];
    expect(deletedProgress).toBeTruthy();
    expect(deletedProgress.noteText).toBe('');
    expect(deletedProgress.noteUpdatedAt).toBeNull();
    expect(deletedProgress.bookmark).toBe(true);
    expect(deletedProgress.seenCount).toBe(seenCountAfterBookmark);
    expect(
      (deletedProgress.correctCount ?? 0) + (deletedProgress.wrongCount ?? 0)
    ).toBeGreaterThanOrEqual(1);
  });

  test('guarantees DEA Plus notes-only review includes only questions with saved notes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDeaPlusQuiz(page, '10');

    const notedQuestionId = await getCurrentQuestionId(page);
    await answerCurrentQuestion(page);
    await saveCurrentNote(page, 'DEA Plus notesOnly 対象メモ');

    const progressBeforeReview = await loadDeaPlusProgress(page);
    const notedProgress = progressBeforeReview[notedQuestionId];
    expect(notedProgress).toBeTruthy();
    expect(notedProgress.noteText).toBe('DEA Plus notesOnly 対象メモ');
    expect(notedProgress.noteUpdatedAt).toBeTruthy();

    const notedIds = Object.entries(progressBeforeReview)
      .filter(([, value]) => String(value.noteText ?? '').trim().length > 0)
      .map(([id]) => id);
    expect(notedIds).toEqual([notedQuestionId]);

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();

    await page.locator('input[name="mode"][value="notesOnly"]').check();
    await page.locator('#question-count').selectOption('10');
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    const reviewQuestionId = await getCurrentQuestionId(page);
    expect(reviewQuestionId).toBe(notedQuestionId);

    const reviewSession = (await page.evaluate(() =>
      JSON.parse(localStorage.getItem('deaPlusQuizActiveSession') ?? 'null')
    )) as DeaPlusSession;
    const reviewProgress = await loadDeaPlusProgress(page);

    expect(reviewSession).toBeTruthy();
    expect(reviewSession.mode).toBe('notesOnly');
    expect(reviewSession.order).toEqual(notedIds);
    for (const id of reviewSession.order ?? []) {
      expect(String(reviewProgress[id]?.noteText ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  test('guarantees DEA Plus mobile notes controls remain usable after answering', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only coverage.');

    await startDeaPlusQuiz(page, '10');
    await expect(page.locator('#note-panel')).toBeHidden();

    await answerCurrentQuestion(page);
    await expect(page.locator('#note-panel')).toBeVisible();

    await expect(page.getByRole('button', { name: 'その他の操作' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await page.getByRole('button', { name: 'その他の操作' }).click();
    await expect(page.getByRole('button', { name: 'その他の操作' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(page.getByRole('button', { name: 'ブックマーク☆' })).toBeVisible();

    await saveCurrentNote(page, 'DEA Plus モバイルメモ');
    await expect(page.getByRole('button', { name: '次へ', exact: true })).toBeEnabled();
  });
});
