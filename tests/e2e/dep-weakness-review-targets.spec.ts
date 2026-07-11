import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { gotoDepHome } from './helpers';

type Question = { id: string; section: string; sectionTitle?: string };
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

const storageKeys = ['depQuizProgress', 'depQuizActiveSession', 'depQuizSettings'] as const;
const defaultSettings = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };
const tagId = 'concept-behavior-gap';
const tagLabel = '概念・挙動がイメージできない';

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

async function seedStorage(page: Page, progress: Record<string, ProgressEntry>, session: unknown) {
  const snapshot = {
    depQuizProgress: JSON.stringify(progress),
    depQuizActiveSession: JSON.stringify(session),
    depQuizSettings: JSON.stringify(defaultSettings),
  };

  await page.addInitScript((values) => {
    localStorage.clear();
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  }, snapshot);

  return snapshot;
}

async function getStorageSnapshot(page: Page) {
  return page.evaluate((keys) => {
    return Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  }, storageKeys);
}

async function openAnalysis(page: Page) {
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await expect(page.locator('#analysis-view')).toBeVisible();
}

async function expectTargetsViewAtTop(page: Page) {
  await expect(page.locator('#weakness-review-targets-view')).toBeVisible();
  await expect(page.locator('#analysis-view')).not.toBeVisible();
  await expect(page.locator('#weakness-review-targets-panel')).toBeVisible();
  await expect(page.locator('#weakness-review-targets-view')).toContainText(
    '弱点分析画面で選択した条件に該当する問題を表示しています。'
  );
  await expect(page.locator('#weakness-review-targets-view')).toContainText(
    '別の条件を確認する場合は、弱点分析画面に戻って選び直してください。'
  );
  await page.waitForFunction(() => window.scrollY === 0);
}

async function expectBackToAnalysis(page: Page) {
  await page.getByRole('button', { name: '← 弱点分析へ戻る' }).click();
  await expect(page.locator('#analysis-view')).toBeVisible();
  await expect(page.locator('#weakness-review-targets-view')).not.toBeVisible();
  await expect(page.locator('#weakness-review-targets-panel')).toBeHidden();
  await expect(page.locator('#analysis-view .weakness-review-targets-panel')).toHaveCount(0);
}

test.describe('[DEP][FLOW] Weakness review targets / Analysis entrypoints', () => {
  test('guarantees section entrypoint opens target list and returns without mutating storage', async ({
    page,
    request,
  }) => {
    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups[0].length).toBeGreaterThanOrEqual(2);

    const progress = {
      [groups[0][0].id]: progressEntry({ seenCount: 1, correctCount: 0, wrongCount: 1 }),
      [groups[0][1].id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
    };
    await seedStorage(page, progress, activeSessionFixture(groups[0][0].id));
    await openAnalysis(page);

    const before = await getStorageSnapshot(page);
    await page.locator('.analysis-sections.analysis-disclosure > summary').click();
    const sectionCard = page.locator('.analysis-section-card').first();
    await sectionCard.getByRole('button', { name: 'このSectionの問題を見る' }).click();

    await expectTargetsViewAtTop(page);
    const panel = page.locator('#weakness-review-targets-panel');
    await expect(panel).toContainText('復習対象の問題');
    await expect(panel).toContainText(
      `条件: Section ${groups[0][0].section}：${groups[0][0].sectionTitle}`
    );
    await expect(panel).toContainText(`対象件数: ${groups[0].length}問`);
    await expect(panel).toContainText(groups[0][0].id);
    await expect(panel).toContainText(groups[0][1].id);

    await expectBackToAnalysis(page);
    await expect(getStorageSnapshot(page)).resolves.toEqual(before);
  });

  test('guarantees wrong-reason tag entrypoint opens target list and returns without mutating storage', async ({
    page,
    request,
  }) => {
    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups.length).toBeGreaterThanOrEqual(2);

    const taggedQuestion = groups[0][0];
    const untaggedQuestion = groups[0][1];
    const otherTaggedQuestion = groups[1][0];
    const progress = {
      [taggedQuestion.id]: progressEntry({
        seenCount: 1,
        correctCount: 0,
        wrongCount: 1,
        wrongReasonTags: [tagId],
        noteText: 'Bronze層の目的を復習',
        bookmark: true,
      }),
      [untaggedQuestion.id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
      [otherTaggedQuestion.id]: progressEntry({
        seenCount: 2,
        correctCount: 1,
        wrongCount: 1,
        wrongReasonTags: [tagId],
      }),
    };
    await seedStorage(page, progress, activeSessionFixture(taggedQuestion.id));
    await openAnalysis(page);

    const before = await getStorageSnapshot(page);
    await page.locator('.analysis-sections.analysis-disclosure > summary').click();
    await page
      .locator('.analysis-section-card')
      .first()
      .getByRole('button', { name: 'このSectionの問題を見る' })
      .click();

    await expectTargetsViewAtTop(page);
    const panel = page.locator('#weakness-review-targets-panel');
    const firstSectionCondition = `条件: Section ${taggedQuestion.section}：${taggedQuestion.sectionTitle}`;
    await expect(panel).toContainText(firstSectionCondition);
    await expectBackToAnalysis(page);

    const tags = page.locator('[aria-labelledby="analysis-tags-title"]');
    await tags.locator('summary').click();
    await tags
      .locator('.analysis-tag-item')
      .filter({ has: page.locator('dt', { hasText: new RegExp(`^${tagLabel}$`) }) })
      .getByRole('button', { name: 'この理由の問題を見る' })
      .click();

    await expectTargetsViewAtTop(page);
    await expect(panel).toContainText('復習対象の問題');
    await expect(panel).toContainText(`条件: ${tagLabel}`);
    await expect(panel).not.toContainText(firstSectionCondition);
    await expect(panel).toContainText('対象件数: 2問');
    await expect(panel).toContainText(taggedQuestion.id);
    await expect(panel).toContainText(otherTaggedQuestion.id);
    await expect(panel).not.toContainText(untaggedQuestion.id);

    await expectBackToAnalysis(page);
    await expect(getStorageSnapshot(page)).resolves.toEqual(before);
  });
});
