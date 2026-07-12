import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { gotoDepHome } from './helpers';

type Question = {
  id: string;
  section: string;
  sectionTitle?: string;
  question?: string;
  choices: Record<string, string>;
  answer: string;
};

type ProgressEntry = {
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  lastAnsweredAt: string | null;
  bookmark: boolean;
  noteText: string;
  note: string;
  noteUpdatedAt: string | null;
  wrongReasonTags: string[];
  wrongReasonUpdatedAt: string | null;
};

const defaultSettings = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };
const initialAnsweredAt = '2026-07-11T00:00:00.000Z';
const noteText = '条件付き復習から保存した共存確認メモ';

async function loadQuestions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

function groupQuestionsBySection(questions: Question[]) {
  const groups = new Map<string, Question[]>();
  for (const question of questions) {
    const section = String(question.section ?? '').trim();
    if (!section) continue;
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section)!.push(question);
  }
  return [...groups.values()].sort((a, b) => Number(a[0].section) - Number(b[0].section));
}

function progressEntry(overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  const seenCount = overrides.seenCount ?? 0;
  const wrongReasonTags = overrides.wrongReasonTags ?? [];
  return {
    seenCount,
    correctCount: overrides.correctCount ?? 0,
    wrongCount: overrides.wrongCount ?? 0,
    lastAnsweredAt: overrides.lastAnsweredAt ?? (seenCount > 0 ? initialAnsweredAt : null),
    bookmark: overrides.bookmark ?? false,
    noteText: overrides.noteText ?? '',
    note: overrides.note ?? overrides.noteText ?? '',
    noteUpdatedAt: overrides.noteUpdatedAt ?? null,
    wrongReasonTags,
    wrongReasonUpdatedAt:
      overrides.wrongReasonUpdatedAt ?? (wrongReasonTags.length ? initialAnsweredAt : null),
  };
}

async function seedStorage(page: Page, progress: Record<string, ProgressEntry>) {
  await page.addInitScript(
    (values) => {
      localStorage.clear();
      localStorage.setItem('depQuizProgress', JSON.stringify(values.progress));
      localStorage.setItem('depQuizSettings', JSON.stringify(values.settings));
    },
    { progress, settings: defaultSettings }
  );
}

async function startSectionWeaknessReview(page: Page) {
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await expect(page.locator('#analysis-view')).toBeVisible();
  await page.locator('.analysis-sections.analysis-disclosure > summary').click();
  await page
    .locator('.analysis-section-card')
    .first()
    .getByRole('button', { name: 'このSectionの問題を見る' })
    .click();

  const panel = page.locator('#weakness-review-targets-panel');
  await expect(panel.getByRole('button', { name: 'この条件で復習する' })).toBeVisible();
  await panel.getByRole('button', { name: 'この条件で復習する' }).click();
  await expect(page.locator('#quiz-view')).toBeVisible();
}

async function getProgress(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}'));
}

async function getProgressEntry(page: Page, questionId: string): Promise<ProgressEntry> {
  return page.evaluate((id) => {
    const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
    return progress[id];
  }, questionId);
}

async function getActiveSession(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null'));
}

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

function expectLastAnsweredAtUpdated(before: string | null, after: string | null) {
  expect(after).toBeTruthy();
  expect(after).not.toBe(before);
  expect(Number.isNaN(Date.parse(after as string))).toBe(false);
}

test.describe('[DEP][DATA] Weakness review / Progress persistence', () => {
  test('guarantees correct answers accumulate into existing depQuizProgress without mutating unrelated records', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop storage contract coverage.');

    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups.length).toBeGreaterThan(1);
    expect(groups[0].length).toBeGreaterThanOrEqual(2);
    const [answeredQuestion, unansweredQuestion] = groups[0];
    const outsideQuestion = groups[1][0];
    const progress = {
      [answeredQuestion.id]: progressEntry({ seenCount: 3, correctCount: 1, wrongCount: 2 }),
      [unansweredQuestion.id]: progressEntry({ seenCount: 2, correctCount: 2, wrongCount: 0 }),
      [outsideQuestion.id]: progressEntry({ seenCount: 4, correctCount: 1, wrongCount: 3 }),
    };
    await seedStorage(page, progress);

    await startSectionWeaknessReview(page);
    const activeSession = await getActiveSession(page);
    expect(activeSession.mode).toBe('weaknessReview');
    expect(activeSession.order).toEqual(groups[0].map((question) => question.id));
    expect(activeSession.settingsSnapshot.condition).toMatchObject({
      type: 'section',
      value: answeredQuestion.section,
    });
    await expect(page.locator('#quiz-question')).toContainText(
      (answeredQuestion.question ?? '').slice(0, 20)
    );

    const beforeSettings = await page.evaluate(() => localStorage.getItem('depQuizSettings'));
    const beforeProgress = await getProgress(page);
    const questionId = await answerCurrentQuestionAs(page, 'correct');
    expect(questionId).toBe(answeredQuestion.id);

    const afterProgress = await getProgress(page);
    expect(afterProgress[questionId].seenCount).toBe(beforeProgress[questionId].seenCount + 1);
    expect(afterProgress[questionId].correctCount).toBe(
      beforeProgress[questionId].correctCount + 1
    );
    expect(afterProgress[questionId].wrongCount).toBe(beforeProgress[questionId].wrongCount);
    expectLastAnsweredAtUpdated(
      beforeProgress[questionId].lastAnsweredAt,
      afterProgress[questionId].lastAnsweredAt
    );
    expect(afterProgress[unansweredQuestion.id]).toEqual(beforeProgress[unansweredQuestion.id]);
    expect(afterProgress[outsideQuestion.id]).toEqual(beforeProgress[outsideQuestion.id]);
    await expect(page.evaluate(() => localStorage.getItem('depQuizSettings'))).resolves.toBe(
      beforeSettings
    );
  });

  test('guarantees wrong answers and support data coexist on the same weakness review progress record', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop storage contract coverage.');

    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups.length).toBeGreaterThan(1);
    expect(groups[0].length).toBeGreaterThanOrEqual(2);
    const [answeredQuestion, unansweredQuestion] = groups[0];
    const outsideQuestion = groups[1][0];
    await seedStorage(page, {
      [answeredQuestion.id]: progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
      [unansweredQuestion.id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
      [outsideQuestion.id]: progressEntry({ seenCount: 5, correctCount: 3, wrongCount: 2 }),
    });

    await startSectionWeaknessReview(page);
    const beforeSettings = await page.evaluate(() => localStorage.getItem('depQuizSettings'));
    const beforeProgress = await getProgress(page);
    const questionId = await answerCurrentQuestionAs(page, 'wrong');
    expect(questionId).toBe(answeredQuestion.id);

    const afterWrong = await getProgressEntry(page, questionId);
    expect(afterWrong.seenCount).toBe(beforeProgress[questionId].seenCount + 1);
    expect(afterWrong.correctCount).toBe(beforeProgress[questionId].correctCount);
    expect(afterWrong.wrongCount).toBe(beforeProgress[questionId].wrongCount + 1);
    expectLastAnsweredAtUpdated(
      beforeProgress[questionId].lastAnsweredAt,
      afterWrong.lastAnsweredAt
    );

    await page.locator('#wrong-reason-tags label').nth(0).click();
    await page.locator('#wrong-reason-tags label').nth(2).click();
    await expect(page.locator('#wrong-reason-status')).toContainText('タグを保存しました。');
    const afterTags = await getProgressEntry(page, questionId);
    expect(afterTags).toMatchObject({
      seenCount: afterWrong.seenCount,
      correctCount: afterWrong.correctCount,
      wrongCount: afterWrong.wrongCount,
      bookmark: false,
    });
    expect(afterTags.wrongReasonTags).toHaveLength(2);

    await page.locator('#question-note').fill(noteText);
    await page.getByRole('button', { name: 'メモを保存' }).click();
    await expect(page.locator('#note-status')).toContainText('メモを保存しました。');
    const afterNote = await getProgressEntry(page, questionId);
    expect(afterNote).toMatchObject({
      seenCount: afterWrong.seenCount,
      correctCount: afterWrong.correctCount,
      wrongCount: afterWrong.wrongCount,
      wrongReasonTags: afterTags.wrongReasonTags,
      noteText,
      note: noteText,
      bookmark: false,
    });

    await page.getByRole('button', { name: 'ブックマーク☆' }).click();
    await expect(page.getByRole('button', { name: 'ブックマーク★' })).toBeVisible();
    const finalProgress = await getProgress(page);
    expect(finalProgress[questionId]).toMatchObject({
      seenCount: afterWrong.seenCount,
      correctCount: afterWrong.correctCount,
      wrongCount: afterWrong.wrongCount,
      wrongReasonTags: afterTags.wrongReasonTags,
      noteText,
      note: noteText,
      bookmark: true,
    });
    expect(finalProgress[unansweredQuestion.id]).toEqual(beforeProgress[unansweredQuestion.id]);
    expect(finalProgress[outsideQuestion.id]).toEqual(beforeProgress[outsideQuestion.id]);
    await expect(page.evaluate(() => localStorage.getItem('depQuizSettings'))).resolves.toBe(
      beforeSettings
    );
  });
});
