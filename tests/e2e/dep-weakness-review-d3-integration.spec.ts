import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { gotoDepHome } from './helpers';

type Question = {
  id: string;
  section: string;
  sectionTitle?: string;
  answer: string;
  choices: Record<string, string>;
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
const storageKeys = ['depQuizProgress', 'depQuizSettings', 'depQuizActiveSession'] as const;

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

function selectSmallestSection(groups: Question[][]) {
  return groups.reduce((smallest, current) =>
    current.length < smallest.length ? current : smallest
  );
}

function progressEntry(overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  const seenCount = overrides.seenCount ?? 0;
  const wrongReasonTags = overrides.wrongReasonTags ?? [];
  return {
    seenCount,
    correctCount: overrides.correctCount ?? 0,
    wrongCount: overrides.wrongCount ?? 0,
    lastAnsweredAt: overrides.lastAnsweredAt ?? (seenCount > 0 ? '2026-07-11T00:00:00.000Z' : null),
    bookmark: overrides.bookmark ?? false,
    noteText: overrides.noteText ?? '',
    note: overrides.note ?? overrides.noteText ?? '',
    noteUpdatedAt: overrides.noteUpdatedAt ?? null,
    wrongReasonTags,
    wrongReasonUpdatedAt:
      overrides.wrongReasonUpdatedAt ??
      (wrongReasonTags.length > 0 ? '2026-07-11T00:00:00.000Z' : null),
  };
}

function progressFixtureForSection(sectionQuestions: Question[]) {
  return Object.fromEntries(
    sectionQuestions.map((question, index) => [
      question.id,
      progressEntry({ seenCount: 1, correctCount: index % 2, wrongCount: index % 2 === 0 ? 1 : 0 }),
    ])
  );
}

async function seedStorage(page: Page, progress: Record<string, ProgressEntry>) {
  await page.addInitScript(
    ({ progress, settings }) => {
      localStorage.clear();
      localStorage.setItem('depQuizProgress', JSON.stringify(progress));
      localStorage.setItem('depQuizSettings', JSON.stringify(settings));
    },
    { progress, settings: defaultSettings }
  );
}

async function getStorageSnapshot(page: Page) {
  return page.evaluate((keys) => {
    return Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  }, storageKeys);
}

async function getOverallMetricValue(page: Page, label: string) {
  const text = await page
    .locator('[aria-labelledby="analysis-summary-title"] .analysis-metric', {
      has: page.locator('.analysis-metric__label', { hasText: new RegExp(`^${label}$`) }),
    })
    .locator('.analysis-metric__value')
    .textContent();
  const value = Number(text?.match(/\d+/)?.[0]);
  expect(Number.isNaN(value)).toBe(false);
  return value;
}

async function answerCurrentQuestionCorrectly(page: Page) {
  const correctLabel = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
    const questions = (await fetch('/dep-quiz-app/questions.json').then((response) =>
      response.json()
    )) as Question[];
    const questionId = session.order[session.currentIndex];
    const question = questions.find((item) => item.id === questionId);
    return Object.entries(session.choiceMap[questionId]).find(
      ([, original]) => original === question?.answer
    )?.[0];
  });
  expect(correctLabel).toBeTruthy();
  await page.locator(`#choices-form input[value="${correctLabel}"]`).check();
  await page.getByRole('button', { name: '回答する' }).click();
}

test.describe('[DEP][FLOW] Weakness review / D3 end-to-end', () => {
  test('guarantees section weakness review completes the D3 loop from analysis back to refreshed analysis', async ({
    page,
    request,
  }) => {
    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups.length).toBeGreaterThan(0);
    const targetSection = selectSmallestSection(groups);
    const progress = progressFixtureForSection(targetSection);
    await seedStorage(page, progress);

    await gotoDepHome(page);
    await page.getByRole('button', { name: '弱点を分析' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();
    const attemptsBefore = await getOverallMetricValue(page, '累計解答数');
    const correctBefore = await getOverallMetricValue(page, '正答数');

    await page.locator('.analysis-sections.analysis-disclosure > summary').click();
    await page
      .locator('.analysis-section-card')
      .filter({ hasText: `Section ${targetSection[0].section}` })
      .getByRole('button', { name: 'このSectionの問題を見る' })
      .click();

    const panel = page.locator('#weakness-review-targets-panel');
    await expect(page.locator('#weakness-review-targets-view')).toBeVisible();
    await expect(panel).toContainText(
      `条件: Section ${targetSection[0].section}：${targetSection[0].sectionTitle}`
    );
    await expect(panel).toContainText(`対象件数: ${targetSection.length}問`);
    await expect(panel.getByRole('button', { name: 'この条件で復習する' })).toBeVisible();

    const beforeStart = await getStorageSnapshot(page);
    await panel.getByRole('button', { name: 'この条件で復習する' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    const afterStart = await getStorageSnapshot(page);
    expect(afterStart.depQuizProgress).toBe(beforeStart.depQuizProgress);
    expect(afterStart.depQuizSettings).toBe(beforeStart.depQuizSettings);
    const activeSession = JSON.parse(afterStart.depQuizActiveSession ?? 'null');
    expect(activeSession.mode).toBe('weaknessReview');
    expect(activeSession.settingsSnapshot.condition.type).toBe('section');

    for (let index = 0; index < targetSection.length; index += 1) {
      await answerCurrentQuestionCorrectly(page);
      await page.getByRole('button', { name: '次へ', exact: true }).click();
    }

    await expect(page.locator('#result-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '弱点分析を見る' })).toBeVisible();
    await expect(
      page.evaluate(() => localStorage.getItem('depQuizActiveSession'))
    ).resolves.toBeNull();

    const progressAfter = JSON.parse(
      (await page.evaluate(() => localStorage.getItem('depQuizProgress'))) ?? '{}'
    );
    const attemptsAfterReview = targetSection.reduce(
      (total, question) => total + progressAfter[question.id].seenCount,
      0
    );
    const correctAfterReview = targetSection.reduce(
      (total, question) => total + progressAfter[question.id].correctCount,
      0
    );
    expect(attemptsAfterReview).toBe(attemptsBefore + targetSection.length);
    expect(correctAfterReview).toBe(correctBefore + targetSection.length);

    const beforeReturn = await getStorageSnapshot(page);
    await page.getByRole('button', { name: '弱点分析を見る' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();
    expect(await getOverallMetricValue(page, '累計解答数')).toBe(attemptsAfterReview);
    expect(await getOverallMetricValue(page, '正答数')).toBe(correctAfterReview);
    await expect(getStorageSnapshot(page)).resolves.toEqual(beforeReturn);
  });
});
