import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { gotoDepHome } from './helpers';

type Question = { id: string; answer: string };
type StorageSnapshot = Record<(typeof STORAGE_KEYS)[number], string | null>;

const STORAGE_KEYS = ['depQuizProgress', 'depQuizSettings', 'depQuizActiveSession'] as const;
const SETTINGS = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };

async function loadTarget(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as Question[])[0];
}

function wrongHighProgress(question: Question) {
  return {
    [question.id]: {
      seenCount: 1,
      correctCount: 0,
      wrongCount: 1,
      lastAnsweredAt: '2026-07-31T00:00:00.000Z',
      lastConfidenceAnswer: {
        result: 'wrong',
        confidence: 'high',
        answeredAt: '2026-07-31T00:00:00.000Z',
      },
    },
  };
}

async function readStorage(page: Page): Promise<StorageSnapshot> {
  return page.evaluate((keys) => {
    return Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  }, STORAGE_KEYS) as Promise<StorageSnapshot>;
}

async function seedAndOpenAnalysis(page: Page, question: Question) {
  const snapshot: StorageSnapshot = {
    depQuizProgress: JSON.stringify(wrongHighProgress(question)),
    depQuizSettings: JSON.stringify(SETTINGS),
    depQuizActiveSession: null,
  };
  await page.addInitScript((values) => {
    if (sessionStorage.getItem('depConfidenceReanalysisSeeded') === 'true') return;
    localStorage.clear();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null) localStorage.setItem(key, value);
    });
    sessionStorage.setItem('depConfidenceReanalysisSeeded', 'true');
  }, snapshot);
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await page.locator('.analysis-confidence-summary > summary').click();
  expect(await readStorage(page)).toEqual(snapshot);
  return snapshot;
}

function outcomeCard(page: Page, outcome: 'wrong_high' | 'correct_high') {
  return page.locator(`.analysis-confidence-outcome[data-outcome="${outcome}"]`);
}

function decisionMetric(page: Page, metric: 'review' | 'advance') {
  return page.locator(`.analysis-confidence-coverage [data-confidence-metric="${metric}"] dd`);
}

async function startWrongHighReview(page: Page, question: Question, before: StorageSnapshot) {
  const wrongHigh = outcomeCard(page, 'wrong_high');
  await expect(wrongHigh).toContainText('1問');
  await expect(outcomeCard(page, 'correct_high')).toContainText('0問');
  await expect(decisionMetric(page, 'review')).toHaveText('1問');
  await expect(wrongHigh.getByRole('button', { name: 'この状態の問題を見る' })).toBeEnabled();
  await expect(
    outcomeCard(page, 'correct_high').getByRole('button', { name: 'この状態の問題を見る' })
  ).toBeDisabled();

  await wrongHigh.getByRole('button', { name: 'この状態の問題を見る' }).click();
  const panel = page.locator('#weakness-review-targets-panel');
  await expect(panel).toContainText('対象件数: 1問');
  await expect(panel).toContainText(question.id);
  expect(await readStorage(page)).toEqual(before);

  await panel.getByRole('button', { name: 'この条件で復習する' }).click();
  await expect(page.locator('#quiz-view')).toBeVisible();
  const afterStart = await readStorage(page);
  expect(afterStart.depQuizProgress).toBe(before.depQuizProgress);
  expect(afterStart.depQuizSettings).toBe(before.depQuizSettings);
  const session = JSON.parse(afterStart.depQuizActiveSession ?? 'null');
  expect(session.mode).toBe('weaknessReview');
  expect(session.order).toEqual([question.id]);
  expect(session.settingsSnapshot.source).toBe('weaknessReviewTargets');
  expect(session.settingsSnapshot.condition).toEqual({
    type: 'confidenceOutcome',
    value: 'wrong_high',
    label: '誤認です。前提から見直しましょう',
  });
  return session;
}

async function chooseCorrectHighAnswer(page: Page, question: Question) {
  const label = await page.evaluate(
    ({ questionId, answer }) => {
      const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
      return Object.entries(session.choiceMap[questionId] ?? {}).find(
        ([, original]) => original === answer
      )?.[0];
    },
    { questionId: question.id, answer: question.answer }
  );
  expect(label).toBeTruthy();
  await page.locator(`#choices-form input[value="${label}"]`).check();
  await page.locator('#confidence-options input[value="high"]').check();
  await page.getByRole('button', { name: '回答する' }).click();
}

async function expectNoHorizontalOverflow(page: Page, view: Locator) {
  await expect(view).toBeVisible();
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
}

test.describe('[DEP][FLOW] Confidence analysis / Review and reanalysis', () => {
  test('reclassifies wrong-high after suspend, resume, and correct high-confidence review', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop end-to-end coverage.');
    const question = await loadTarget(request);
    const initial = await seedAndOpenAnalysis(page, question);
    const startedSession = await startWrongHighReview(page, question, initial);

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: '続きから再開' })).toBeVisible();
    await page.getByRole('button', { name: '続きから再開' }).click();
    const resumed = JSON.parse((await readStorage(page)).depQuizActiveSession ?? 'null');
    expect(resumed.mode).toBe(startedSession.mode);
    expect(resumed.order).toEqual(startedSession.order);
    expect(resumed.currentIndex).toBe(startedSession.currentIndex);
    expect(resumed.settingsSnapshot.condition).toEqual(startedSession.settingsSnapshot.condition);

    await chooseCorrectHighAnswer(page, question);
    const afterAnswer = await readStorage(page);
    const progress = JSON.parse(afterAnswer.depQuizProgress ?? '{}')[question.id];
    expect(progress.seenCount).toBe(2);
    expect(progress.correctCount).toBe(1);
    expect(progress.wrongCount).toBe(1);
    expect(progress.lastConfidenceAnswer).toMatchObject({ result: 'correct', confidence: 'high' });
    expect(afterAnswer.depQuizSettings).toBe(initial.depQuizSettings);

    await page
      .getByLabel('主要操作', { exact: true })
      .getByRole('button', { name: '次へ進む' })
      .click();
    await expect(page.locator('#result-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '弱点分析を見る' })).toBeVisible();
    expect((await readStorage(page)).depQuizActiveSession).toBeNull();

    const beforeReturn = await readStorage(page);
    await page.getByRole('button', { name: '弱点分析を見る' }).click();
    expect(await readStorage(page)).toEqual(beforeReturn);
    await page.locator('.analysis-confidence-summary > summary').click();
    await expect(outcomeCard(page, 'wrong_high')).toContainText('0問');
    await expect(outcomeCard(page, 'correct_high')).toContainText('1問');
    await expect(decisionMetric(page, 'review')).toHaveText('0問');
    await expect(decisionMetric(page, 'advance')).toHaveText('1問');
    await expect(
      outcomeCard(page, 'wrong_high').getByRole('button', { name: 'この状態の問題を見る' })
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: '要確認の問題を見る' })).toBeDisabled();
    await expect(
      outcomeCard(page, 'correct_high').getByRole('button', { name: 'この状態の問題を見る' })
    ).toBeEnabled();
  });

  test('re-derives the empty analysis after learning-history reset', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop reset coverage.');
    const question = await loadTarget(request);
    const initial = await seedAndOpenAnalysis(page, question);
    const wrongHighButton = outcomeCard(page, 'wrong_high').getByRole('button', {
      name: 'この状態の問題を見る',
    });
    await wrongHighButton.click();
    await page.getByRole('button', { name: '分析画面へ戻る' }).click();
    expect(await readStorage(page)).toEqual(initial);

    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    const summary = page.locator('.analysis-confidence-summary');
    await expect(summary.locator('.analysis-confidence-status')).toHaveAttribute(
      'data-coverage-status',
      'none'
    );
    await expect(summary.locator('.analysis-confidence-outcome')).toHaveCount(6);
    const targetButtons = summary.locator('[data-review-target-type]');
    await expect(targetButtons).toHaveCount(7);
    for (let index = 0; index < 7; index += 1)
      await expect(targetButtons.nth(index)).toBeDisabled();
    await expect(outcomeCard(page, 'wrong_high')).toContainText('0問');
    await expect(page.locator('#weakness-review-targets-view')).toBeHidden();
  });

  test('keeps the 375px analysis-to-review path operable without horizontal overflow', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile smoke coverage.');
    const question = await loadTarget(request);
    const initial = await seedAndOpenAnalysis(page, question);
    await expectNoHorizontalOverflow(page, page.locator('#analysis-view'));
    const targetButton = outcomeCard(page, 'wrong_high').getByRole('button', {
      name: 'この状態の問題を見る',
    });
    expect((await targetButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await targetButton.click();
    await expectNoHorizontalOverflow(page, page.locator('#weakness-review-targets-view'));
    const startButton = page.getByRole('button', { name: 'この条件で復習する' });
    expect((await startButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await readStorage(page)).toEqual(initial);
    await startButton.click();
    await expectNoHorizontalOverflow(page, page.locator('#quiz-view'));
  });
});
