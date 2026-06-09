import { test, expect, type Page } from '@playwright/test';
import { answerCurrentQuestion, startDepQuiz } from './helpers';

type ProgressEntry = {
  seenCount?: number;
  correctCount?: number;
  wrongCount?: number;
};

async function progressForCurrentQuestion(page: Page): Promise<ProgressEntry> {
  const questionId = await page.locator('#quiz-question .quiz-question-id').textContent();
  expect(questionId).toBeTruthy();
  return page.evaluate((id) => {
    const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
    return progress[id as string] ?? {};
  }, questionId);
}

async function expectNoProgressChangeOnNoteEnter(page: Page) {
  const before = await progressForCurrentQuestion(page);
  await page.locator('#question-note').press('Enter');
  const after = await progressForCurrentQuestion(page);

  expect(after.seenCount ?? 0).toBe(before.seenCount ?? 0);
  expect(after.correctCount ?? 0).toBe(before.correctCount ?? 0);
  expect(after.wrongCount ?? 0).toBe(before.wrongCount ?? 0);
}

test.describe('[DEP][DATA] Notes / Keyboard isolation', () => {
  test('guarantees desktop note textarea keeps multiline drafts and suppresses quiz shortcuts', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only keyboard regression coverage.');
    await startDepQuiz(page, 'all');
    const initialProgress = await page.locator('#quiz-progress').textContent();

    await answerCurrentQuestion(page);
    await expect(page.locator('#question-note')).toBeVisible();
    await expect(page.locator('#next-question')).toBeEnabled();

    const progressAfterAnswer = await progressForCurrentQuestion(page);
    const initiallyCheckedValue = await page
      .locator('#choices-form input[name="choice"]:checked')
      .inputValue();

    const note = page.locator('#question-note');
    await note.fill('1行目');
    await note.press('Enter');
    await note.type('2行目');
    await expect(note).toHaveValue('1行目\n2行目');

    await note.press('Enter');
    await note.press('1');
    await note.press('2');
    await note.press('A');
    await note.press('B');
    await note.press('ArrowRight');
    await note.press('ArrowLeft');

    await expect(note).toHaveValue('1行目\n2行目\n12AB');
    await expect(page.locator('#quiz-progress')).toHaveText(initialProgress ?? '');
    await expect(page.locator('#choices-form input[name="choice"]:checked')).toHaveValue(
      initiallyCheckedValue
    );
    await expect(page.getByRole('button', { name: '回答する' })).toBeDisabled();

    const progressAfterShortcuts = await progressForCurrentQuestion(page);
    expect(progressAfterShortcuts.seenCount ?? 0).toBe(progressAfterAnswer.seenCount ?? 0);
    expect(progressAfterShortcuts.correctCount ?? 0).toBe(progressAfterAnswer.correctCount ?? 0);
    expect(progressAfterShortcuts.wrongCount ?? 0).toBe(progressAfterAnswer.wrongCount ?? 0);
  });

  test('guarantees desktop quiz shortcuts still work while choice radio has focus', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only keyboard shortcut coverage.');
    await startDepQuiz(page, 'all');
    const initialProgress = await page.locator('#quiz-progress').textContent();

    await page.locator('#choices-form input[value="A"]').focus();
    await page.keyboard.press('2');
    await expect(page.locator('#choices-form input[name="choice"]:checked')).toHaveValue('B');
    await expect(page.getByRole('button', { name: '回答する' })).toBeEnabled();

    await page.keyboard.press('Enter');
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
    await expect(page.locator('#quiz-progress')).toHaveText(initialProgress ?? '');

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#quiz-progress')).toContainText(/2\s*\/\s*/);
  });

  test('guarantees answered question Enter does not double count progress while note is focused', async ({
    page,
  }) => {
    await startDepQuiz(page, 'all');
    await answerCurrentQuestion(page);
    await expect(page.locator('#question-note')).toBeVisible();

    const note = page.locator('#question-note');
    await note.focus();
    await expectNoProgressChangeOnNoteEnter(page);
    await expectNoProgressChangeOnNoteEnter(page);
    await expect(note).toHaveValue('\n\n');
  });

  test('guarantees mobile note textarea keeps multiline drafts', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Mobile-only keyboard regression coverage.'
    );
    await startDepQuiz(page, 'all');
    await answerCurrentQuestion(page);

    const note = page.locator('#question-note');
    await expect(note).toBeVisible();
    await note.fill('1行目');
    await note.press('Enter');
    await note.type('2行目');
    await expect(note).toHaveValue('1行目\n2行目');

    const progressAfterMultilineDraft = await progressForCurrentQuestion(page);
    await note.press('Enter');
    await expect(note).toHaveValue('1行目\n2行目\n');
    const progressAfterEnter = await progressForCurrentQuestion(page);
    expect(progressAfterEnter.seenCount ?? 0).toBe(progressAfterMultilineDraft.seenCount ?? 0);
    expect(progressAfterEnter.correctCount ?? 0).toBe(
      progressAfterMultilineDraft.correctCount ?? 0
    );
    expect(progressAfterEnter.wrongCount ?? 0).toBe(progressAfterMultilineDraft.wrongCount ?? 0);
  });
});
