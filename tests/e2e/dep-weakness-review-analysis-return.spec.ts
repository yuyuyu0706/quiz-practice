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
const tagId = 'concept-behavior-gap';
const tagLabel = '概念・挙動がイメージできない';

async function loadQuestions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
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

function activeSessionFixture(questionId: string) {
  return {
    schemaVersion: 1,
    app: 'dep-quiz-app',
    order: [questionId],
    currentIndex: 0,
    answers: {},
    choiceMap: {},
    graded: {},
    completedAt: null,
    explanationOpen: false,
    mode: 'normal',
    startedAt: '2026-07-11T00:00:00.000Z',
    settingsSnapshot: defaultSettings,
  };
}

async function seedStorage(
  page: Page,
  progress: Record<string, ProgressEntry>,
  session: unknown = null
) {
  await page.addInitScript(
    ({ progress, settings, session }) => {
      localStorage.clear();
      localStorage.setItem('depQuizProgress', JSON.stringify(progress));
      localStorage.setItem('depQuizSettings', JSON.stringify(settings));
      if (session) localStorage.setItem('depQuizActiveSession', JSON.stringify(session));
    },
    { progress, settings: defaultSettings, session }
  );
}

async function getStorageSnapshot(page: Page) {
  return page.evaluate(() => ({
    depQuizProgress: localStorage.getItem('depQuizProgress'),
    depQuizSettings: localStorage.getItem('depQuizSettings'),
    depQuizActiveSession: localStorage.getItem('depQuizActiveSession'),
  }));
}

async function overallMetric(page: Page, label: string) {
  return page.locator('[aria-labelledby="analysis-summary-title"] .analysis-metric', {
    has: page.locator('.analysis-metric__label', { hasText: new RegExp(`^${label}$`) }),
  });
}

async function answerCurrentQuestionCorrectly(page: Page) {
  const correctLabel = await page.evaluate(async () => {
    const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
    const questions = await fetch('/dep-quiz-app/questions.json').then((response) =>
      response.json()
    );
    const questionId = session.order[session.currentIndex];
    const question = questions.find((item: { id: string }) => item.id === questionId);
    return Object.entries(session.choiceMap[questionId]).find(
      ([, original]) => original === question.answer
    )?.[0];
  });
  expect(correctLabel).toBeTruthy();
  await page.locator(`#choices-form input[value="${correctLabel}"]`).check();
  await page.getByRole('button', { name: '回答する' }).click();
}

test.describe('[DEP][FLOW] Weakness review / Analysis return', () => {
  test('guarantees weakness review results can return to analysis with latest progress without storage mutation', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop weakness review return coverage.');

    const [taggedQuestion] = await loadQuestions(request);
    const progress = {
      [taggedQuestion.id]: progressEntry({
        seenCount: 1,
        correctCount: 0,
        wrongCount: 1,
        wrongReasonTags: [tagId],
      }),
    };
    await seedStorage(page, progress);

    await gotoDepHome(page);
    await page.getByRole('button', { name: '弱点を分析' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();
    await expect(await overallMetric(page, '累計解答数')).toContainText('1');
    await expect(await overallMetric(page, '正答数')).toContainText('0');

    const tags = page.locator('[aria-labelledby="analysis-tags-title"]');
    await tags.locator('summary').click();
    await tags
      .locator('.analysis-tag-item')
      .filter({ has: page.locator('dt', { hasText: new RegExp(`^${tagLabel}$`) }) })
      .getByRole('button', { name: 'この理由の問題を見る' })
      .click();

    const panel = page.locator('#weakness-review-targets-panel');
    await expect(panel).toContainText('対象件数: 1問');
    await expect(panel).toContainText(taggedQuestion.id);
    await panel.getByRole('button', { name: 'この条件で復習する' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    await answerCurrentQuestionCorrectly(page);
    await page.getByRole('button', { name: '次へ', exact: true }).click();
    await expect(page.locator('#result-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '弱点分析を見る' })).toBeVisible();
    await expect(page.getByRole('button', { name: '弱点分析を見る' })).not.toHaveClass(/hidden/);
    await expect(
      page.evaluate(() => localStorage.getItem('depQuizActiveSession'))
    ).resolves.toBeNull();

    const beforeReturn = await getStorageSnapshot(page);
    await page.getByRole('button', { name: '弱点分析を見る' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();
    await expect(await overallMetric(page, '累計解答数')).toContainText('2');
    await expect(await overallMetric(page, '正答数')).toContainText('1');
    await expect(await getStorageSnapshot(page)).toEqual(beforeReturn);
  });

  test('guarantees normal result screen does not show the weakness analysis return action', async ({
    page,
    request,
  }) => {
    const [question] = await loadQuestions(request);
    await seedStorage(page, {}, activeSessionFixture(question.id));

    await gotoDepHome(page);
    await page.getByRole('button', { name: '続きから再開' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    await answerCurrentQuestionCorrectly(page);
    await page.getByRole('button', { name: '次へ', exact: true }).click();
    await expect(page.locator('#result-view')).toBeVisible();
    await expect(page.locator('#result-analysis-btn')).toHaveClass(/hidden/);
  });
});
