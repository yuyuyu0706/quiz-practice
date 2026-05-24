import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('dep notes list on desktop', () => {
  test('can create, edit, and delete a note while preserving progress data', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await startDepQuiz(page, '10');

    const questionId = (await page.locator('#quiz-question .quiz-question-id').textContent())?.trim();
    expect(questionId).toBeTruthy();

    await answerCurrentQuestion(page);
    await page.locator('#question-note').fill('初回メモ');
    await page.getByRole('button', { name: 'メモを保存' }).click();
    await expect(page.locator('#note-status')).toContainText('メモを保存しました。');

    await page.getByRole('button', { name: 'ホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();

    await page.getByRole('button', { name: 'メモ一覧' }).click();
    await expect(page.locator('#notes-view')).toBeVisible();

    const card = page.locator('.note-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.note-card-body')).toContainText('初回メモ');

    await card.getByRole('button', { name: '編集' }).click();
    await card.locator('.note-editor textarea').fill('更新後メモ');
    await card.getByRole('button', { name: '保存' }).click();
    await expect(card.locator('.note-card-body')).toContainText('更新後メモ');

    page.once('dialog', (dialog) => dialog.accept());
    await card.getByRole('button', { name: '削除' }).click();
    await expect(page.locator('#notes-empty')).toBeVisible();

    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}'));
    const questionProgress = progress[questionId as string];
    expect(questionProgress).toBeTruthy();
    expect(questionProgress.note).toBe('');
    expect(questionProgress.noteText).toBe('');
    expect(questionProgress.noteUpdatedAt).toBeNull();
    expect(questionProgress.correctCount).toBeGreaterThanOrEqual(0);
    expect(questionProgress.wrongCount).toBeGreaterThanOrEqual(0);
  });
});
