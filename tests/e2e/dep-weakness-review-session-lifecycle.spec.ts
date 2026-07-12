import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { gotoDepHome } from './helpers';

type Question = { id: string; section: string; sectionTitle?: string; question?: string };
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

async function seedStorage(page: Page, progress: Record<string, ProgressEntry>) {
  await page.addInitScript(
    (values) => {
      if (sessionStorage.getItem('depWeaknessReviewLifecycleSeeded') === 'true') return;
      localStorage.clear();
      localStorage.setItem('depQuizProgress', JSON.stringify(values.progress));
      localStorage.setItem('depQuizSettings', JSON.stringify(values.settings));
      sessionStorage.setItem('depWeaknessReviewLifecycleSeeded', 'true');
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

async function getActiveSession(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null'));
}

test.describe('[DEP][FLOW] Weakness review / Session lifecycle', () => {
  test('resumes an interrupted section weakness review after reload without changing session state', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only lifecycle storage coverage.');

    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups[0].length).toBeGreaterThanOrEqual(2);
    const [firstQuestion, secondQuestion] = groups[0];
    await seedStorage(page, {
      [firstQuestion.id]: progressEntry({ seenCount: 1, correctCount: 0, wrongCount: 1 }),
      [secondQuestion.id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
    });

    await startSectionWeaknessReview(page);
    const initialSession = await getActiveSession(page);
    expect(initialSession.mode).toBe('weaknessReview');
    expect(initialSession.order).toEqual(groups[0].map((question) => question.id));
    expect(initialSession.settingsSnapshot.condition).toMatchObject({
      type: 'section',
      value: firstQuestion.section,
    });

    await expect(page.locator('#quiz-question')).toContainText(
      (firstQuestion.question ?? '').slice(0, 20)
    );
    await page.locator('#choices-form label').first().click();
    await page.getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
    await page.getByRole('button', { name: '次へ' }).first().click();
    await expect(page.locator('#quiz-progress')).toContainText(`2 / ${groups[0].length}`);
    await expect(page.locator('#quiz-question')).toContainText(
      (secondQuestion.question ?? '').slice(0, 20)
    );

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeVisible();
    const suspendedSession = await getActiveSession(page);
    expect(suspendedSession.mode).toBe('weaknessReview');
    expect(suspendedSession.order).toEqual(initialSession.order);
    expect(suspendedSession.currentIndex).toBe(1);
    expect(suspendedSession.answers[firstQuestion.id]).toBeTruthy();
    expect(suspendedSession.choiceMap[firstQuestion.id]).toBeTruthy();
    expect(suspendedSession.graded[firstQuestion.id]).toBe(true);
    expect(suspendedSession.settingsSnapshot.condition).toEqual(
      initialSession.settingsSnapshot.condition
    );

    await page.reload();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeVisible();
    await page.getByRole('button', { name: '続きから再開' }).click();

    await expect(page.locator('#quiz-view')).toBeVisible();
    await expect(page.locator('#quiz-progress')).toContainText(`2 / ${groups[0].length}`);
    await expect(page.locator('#quiz-question')).toContainText(
      (secondQuestion.question ?? '').slice(0, 20)
    );
    const resumedSession = await getActiveSession(page);
    expect(resumedSession.mode).toBe('weaknessReview');
    expect(resumedSession.order).toEqual(suspendedSession.order);
    expect(resumedSession.currentIndex).toBe(1);
    expect(resumedSession.answers).toEqual(suspendedSession.answers);
    expect(resumedSession.choiceMap).toEqual(suspendedSession.choiceMap);
    expect(resumedSession.graded).toEqual(suspendedSession.graded);
    expect(resumedSession.settingsSnapshot.condition).toEqual(
      suspendedSession.settingsSnapshot.condition
    );
  });

  test('discards an interrupted section weakness review without mutating progress or settings', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only discard storage coverage.');

    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups[0].length).toBeGreaterThanOrEqual(2);
    const [firstQuestion, secondQuestion] = groups[0];
    await seedStorage(page, {
      [firstQuestion.id]: progressEntry({ seenCount: 1, correctCount: 0, wrongCount: 1 }),
      [secondQuestion.id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
    });

    await startSectionWeaknessReview(page);
    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.getByRole('button', { name: '中断データを削除' })).toBeVisible();
    const beforeDiscard = await page.evaluate(() => ({
      progress: localStorage.getItem('depQuizProgress'),
      settings: localStorage.getItem('depQuizSettings'),
    }));

    await page.getByRole('button', { name: '中断データを削除' }).click();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeHidden();
    await expect(page.getByRole('button', { name: '中断データを削除' })).toBeHidden();
    await expect(getActiveSession(page)).resolves.toBeNull();
    await expect(
      page.evaluate(() => ({
        progress: localStorage.getItem('depQuizProgress'),
        settings: localStorage.getItem('depQuizSettings'),
      }))
    ).resolves.toEqual(beforeDiscard);

    await page.reload();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeHidden();
    await expect(getActiveSession(page)).resolves.toBeNull();
  });
});
