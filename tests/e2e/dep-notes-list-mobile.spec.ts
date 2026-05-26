import { test, expect } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

test.describe('dep notes list on mobile', () => {
  test('shows note cards and supports edit/delete buttons on mobile', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only coverage.');

    await startDepQuiz(page, '10');
    await answerCurrentQuestion(page);
    await page.locator('#question-note').fill('モバイルメモ');
    await page.getByRole('button', { name: 'メモを保存' }).click();

    await page.getByRole('button', { name: 'ホームへ' }).click();
    await page.getByRole('button', { name: 'メモ一覧' }).click();
    await expect(page.locator('#notes-view')).toBeVisible();

    const card = page.locator('.note-card').first();
    await expect(card).toBeVisible();

    await expect(card.getByRole('button', { name: '編集' })).toBeVisible();
    await expect(card.getByRole('button', { name: '削除' })).toBeVisible();

    await card.getByRole('button', { name: '編集' }).click();
    await expect(card.locator('.note-editor textarea')).toBeVisible();

    await page.getByRole('button', { name: 'ホームへ戻る' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
  });
});
