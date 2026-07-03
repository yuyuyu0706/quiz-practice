import { test, expect, type Page } from '@playwright/test';
import { startDepQuiz } from './helpers';

type ProgressEntry = {
  seenCount?: number;
  correctCount?: number;
  wrongCount?: number;
  bookmark?: boolean;
  noteText?: string;
  note?: string;
  wrongReasonTags?: string[];
  wrongReasonUpdatedAt?: string | null;
};

const TAG_COUNT = 7;

async function currentQuestionContext(page: Page) {
  return page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
    const questions = await fetch('/dep-quiz-app/questions.json').then((response) =>
      response.json()
    );
    const questionId = session.order[session.currentIndex];
    const question = questions.find((item: { id: string }) => item.id === questionId);
    const choiceMap = session.choiceMap[questionId];
    const correctLabel = Object.entries(choiceMap).find(
      ([, original]) => original === question.answer
    )?.[0];
    const wrongLabel = Object.keys(choiceMap).find((label) => label !== correctLabel);
    return { questionId, correctLabel, wrongLabel };
  });
}

async function progressForQuestion(page: Page, questionId: string): Promise<ProgressEntry> {
  return page.evaluate((id) => {
    const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
    return progress[id] ?? {};
  }, questionId);
}

async function answerCurrentQuestionAs(page: Page, correctness: 'correct' | 'wrong') {
  await expect(page.locator('#choices-form label')).toHaveCount(4);
  const context = await currentQuestionContext(page);
  const label = correctness === 'correct' ? context.correctLabel : context.wrongLabel;
  expect(label).toBeTruthy();
  await page.locator(`#choices-form input[value="${label}"]`).check();
  await expect(page.getByRole('button', { name: '回答する' })).toBeEnabled();
  await page.getByRole('button', { name: '回答する' }).click();
  await expect(page.locator('#result-indicator')).toContainText(
    correctness === 'correct' ? '正解' : '不正解'
  );
  return context.questionId;
}

async function openWrongReasonPanel(page: Page) {
  const questionId = await answerCurrentQuestionAs(page, 'wrong');
  const panel = page.locator('#wrong-reason-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('input[name="wrong-reason-tags"]')).toHaveCount(TAG_COUNT);
  return questionId;
}

async function selectedWrongReasonTags(page: Page, questionId: string) {
  const progress = await progressForQuestion(page, questionId);
  return progress.wrongReasonTags ?? [];
}

test.describe('[DEP][DATA] Wrong reason tags / Persistence and isolation', () => {
  test('guarantees wrong answer tags render only after an incorrect answer and persist selections after reload', async ({
    page,
  }) => {
    await startDepQuiz(page, 'all');
    await answerCurrentQuestionAs(page, 'correct');
    await expect(page.locator('#wrong-reason-panel')).toBeHidden();

    await page.locator('#next-question').click();
    const questionId = await openWrongReasonPanel(page);
    const tags = page.locator('#wrong-reason-tags label');
    await tags.nth(0).click();
    await tags.nth(2).click();
    await expect(page.locator('#wrong-reason-status')).toContainText('タグを保存しました。');
    expect(await selectedWrongReasonTags(page, questionId)).toHaveLength(2);

    await page.reload();
    await expect(page.locator('#quiz-view')).toBeVisible();
    await expect(page.locator('#wrong-reason-panel')).toBeVisible();
    await expect(
      page.locator('#wrong-reason-tags input[name="wrong-reason-tags"]:checked')
    ).toHaveCount(2);
    expect(await selectedWrongReasonTags(page, questionId)).toHaveLength(2);
  });

  test('guarantees wrong answer tag changes and clear preserve note bookmark and progress data', async ({
    page,
  }) => {
    await startDepQuiz(page, 'all');
    const questionId = await openWrongReasonPanel(page);
    const before = await progressForQuestion(page, questionId);

    await page.locator('#question-note').fill('誤答理由タグとの共存メモ');
    await page.getByRole('button', { name: 'メモを保存' }).click();
    await page.getByRole('button', { name: 'ブックマーク☆' }).click();
    await page.locator('#wrong-reason-tags label').nth(1).click();
    await page.locator('#wrong-reason-tags label').nth(4).click();
    await page.locator('#wrong-reason-tags label').nth(1).click();

    const changed = await progressForQuestion(page, questionId);
    expect(changed.seenCount).toBe(before.seenCount);
    expect(changed.correctCount).toBe(before.correctCount);
    expect(changed.wrongCount).toBe(before.wrongCount);
    expect(changed.noteText).toBe('誤答理由タグとの共存メモ');
    expect(changed.bookmark).toBe(true);
    expect(changed.wrongReasonTags).toHaveLength(1);

    await page.getByRole('button', { name: 'すべて解除' }).click();
    const cleared = await progressForQuestion(page, questionId);
    expect(cleared.seenCount).toBe(before.seenCount);
    expect(cleared.correctCount).toBe(before.correctCount);
    expect(cleared.wrongCount).toBe(before.wrongCount);
    expect(cleared.noteText).toBe('誤答理由タグとの共存メモ');
    expect(cleared.bookmark).toBe(true);
    expect(cleared.wrongReasonTags).toEqual([]);
    expect(cleared.wrongReasonUpdatedAt).toBeNull();
  });

  test('guarantees wrong answer tag keyboard scope suppresses quiz shortcuts and choice shortcuts still work outside it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only keyboard regression coverage.');
    await startDepQuiz(page, 'all');
    const questionId = await openWrongReasonPanel(page);
    const progressAfterAnswer = await progressForQuestion(page, questionId);
    const initialProgressText = await page.locator('#quiz-progress').textContent();
    const checkedValue = await page
      .locator('#choices-form input[name="choice"]:checked')
      .inputValue();
    const firstTag = page.locator('#wrong-reason-tags input[name="wrong-reason-tags"]').first();
    await firstTag.focus();
    for (const key of ['Enter', '1', 'A', 'ArrowRight', 'ArrowLeft'])
      await page.keyboard.press(key);
    await expect(page.locator('#quiz-progress')).toHaveText(initialProgressText ?? '');
    await expect(page.locator('#choices-form input[name="choice"]:checked')).toHaveValue(
      checkedValue
    );
    expect(await progressForQuestion(page, questionId)).toMatchObject(progressAfterAnswer);

    await page.locator('#next-question').click();
    await page.locator('#choices-form input[value="A"]').focus();
    await page.keyboard.press('2');
    await expect(page.locator('#choices-form input[name="choice"]:checked')).toHaveValue('B');
    await page.keyboard.press('Enter');
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#quiz-progress')).toContainText(/3\s*\/\s*/);
  });
});

test.describe('[DEP][UI] Wrong reason tags / Mobile chips', () => {
  test('guarantees mobile wrong answer tag chips remain tappable with a compact clear action', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only chip coverage.');
    await startDepQuiz(page, 'all');
    const questionId = await openWrongReasonPanel(page);
    const panel = page.locator('#wrong-reason-panel');
    const firstTag = panel.locator('.wrong-reason-tag').first();
    await firstTag.click();
    await expect(firstTag.locator('input')).toBeChecked();
    await firstTag.click();
    await expect(firstTag.locator('input')).not.toBeChecked();

    const boxes = await panel.locator('.wrong-reason-tag').evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height, right: rect.right };
      })
    );
    expect(boxes.length).toBe(TAG_COUNT);
    expect(Math.min(...boxes.map((box) => box.height))).toBeGreaterThanOrEqual(42);
    expect(Math.max(...boxes.map((box) => box.right))).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375
    );

    await panel.locator('.wrong-reason-tag').last().click();
    const clear = page.getByRole('button', { name: 'すべて解除' });
    const clearBox = await clear.boundingBox();
    expect(clearBox?.width ?? 0).toBeLessThan(180);
    expect(clearBox?.height ?? 0).toBeLessThan(52);
    await clear.click();
    expect(await selectedWrongReasonTags(page, questionId)).toEqual([]);
  });
});
