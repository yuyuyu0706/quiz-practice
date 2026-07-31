import {
  test,
  expect,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

import { CONFIDENCE_OUTCOMES } from '../../dep-quiz-app/confidence-outcome.js';
import { gotoDepHome } from './helpers';

type Question = {
  id: string;
  answer: string;
  choices: Record<string, string>;
};

type StorageSnapshot = Record<(typeof STORAGE_KEYS)[number], string | null>;

const STORAGE_KEYS = ['depQuizProgress', 'depQuizSettings', 'depQuizActiveSession'] as const;
const SETTINGS = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };
const WRONG_HIGH = CONFIDENCE_OUTCOMES.find(({ id }) => id === 'wrong_high');
const CORRECT_HIGH = CONFIDENCE_OUTCOMES.find(({ id }) => id === 'correct_high');

async function loadQuestions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

function wrongHighProgress() {
  expect(WRONG_HIGH).toBeTruthy();
  return {
    seenCount: 1,
    correctCount: 0,
    wrongCount: 1,
    lastAnsweredAt: '2026-07-31T00:00:00.000Z',
    lastConfidenceAnswer: {
      result: WRONG_HIGH!.result,
      confidence: WRONG_HIGH!.confidence,
      answeredAt: '2026-07-31T00:00:00.000Z',
    },
  };
}

async function seedWrongHigh(page: Page, questionId: string) {
  const progress = { [questionId]: wrongHighProgress() };
  const expected: StorageSnapshot = {
    depQuizProgress: JSON.stringify(progress),
    depQuizSettings: JSON.stringify(SETTINGS),
    depQuizActiveSession: null,
  };
  await page.addInitScript(
    ({ progress, settings }) => {
      if (sessionStorage.getItem('depConfidenceReviewReanalysisSeeded') === 'true') return;
      localStorage.clear();
      localStorage.setItem('depQuizProgress', JSON.stringify(progress));
      localStorage.setItem('depQuizSettings', JSON.stringify(settings));
      sessionStorage.setItem('depConfidenceReviewReanalysisSeeded', 'true');
    },
    {
      progress,
      settings: SETTINGS,
    }
  );
  return expected;
}

async function readStorage(page: Page): Promise<StorageSnapshot> {
  return page.evaluate((keys) => {
    return Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  }, STORAGE_KEYS) as Promise<StorageSnapshot>;
}

async function openConfidenceAnalysis(page: Page) {
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await expect(page.locator('#analysis-view')).toBeVisible();
  const summary = page.locator('.analysis-confidence-summary');
  if (!(await summary.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await summary.locator('summary').click();
  }
  await expect(summary).toHaveJSProperty('open', true);
  return summary;
}

function outcomeCard(summary: Locator, outcomeId: string) {
  return summary.locator(`.analysis-confidence-outcome[data-outcome="${outcomeId}"]`);
}

function confidenceMetric(summary: Locator, metric: 'advance' | 'review') {
  return summary.locator(`[data-confidence-metric="${metric}"] dd`);
}

async function answerCurrentQuestionCorrectlyWithHighConfidence(page: Page) {
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
  await page.locator('#confidence-options input[value="high"]').check();
  await page.getByRole('button', { name: '回答する' }).click();
  await expect(page.locator('#result-indicator')).toContainText('正解');
}

async function expectNoHorizontalOverflow(page: Page, viewSelector: string) {
  await expect(
    page.evaluate((selector) => {
      const view = document.querySelector(selector);
      return {
        document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        view: view !== null && view.scrollWidth <= view.clientWidth,
      };
    }, viewSelector)
  ).resolves.toEqual({ document: true, view: true });
}

async function expectTouchTarget(button: Locator) {
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test.describe('[DEP][FLOW] Confidence analysis / Review and reanalysis', () => {
  test('reclassifies wrong high to correct high after suspend reload resume and completion', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop end-to-end reanalysis coverage.');
    expect(WRONG_HIGH).toBeTruthy();
    expect(CORRECT_HIGH).toBeTruthy();
    const [question] = await loadQuestions(request);
    const initialStorage = await seedWrongHigh(page, question.id);

    const summary = await openConfidenceAnalysis(page);
    const wrongHigh = outcomeCard(summary, WRONG_HIGH!.id);
    const correctHigh = outcomeCard(summary, CORRECT_HIGH!.id);
    await expect(wrongHigh).toContainText('1問・要確認');
    await expect(correctHigh).toContainText('0問・安定理解');
    await expect(confidenceMetric(summary, 'review')).toHaveText('1問');
    await expect(confidenceMetric(summary, 'advance')).toHaveText('0問');
    await expect(
      summary.getByRole('button', { name: '要確認の問題を見る' })
    ).toBeEnabled();
    const wrongHighButton = wrongHigh.getByRole('button', {
      name: 'この状態の問題を見る',
    });
    await expect(wrongHighButton).toBeEnabled();
    await expect(
      correctHigh.getByRole('button', { name: 'この状態の問題を見る' })
    ).toBeDisabled();
    await expect(readStorage(page)).resolves.toEqual(initialStorage);

    await wrongHighButton.click();
    const panel = page.locator('#weakness-review-targets-panel');
    await expect(page.locator('#weakness-review-targets-view')).toBeVisible();
    await expect(panel).toContainText(WRONG_HIGH!.title);
    await expect(panel).toContainText('対象件数: 1問');
    await expect(panel).toContainText(question.id);
    await expect(readStorage(page)).resolves.toEqual(initialStorage);

    await panel.getByRole('button', { name: 'この条件で復習する' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    const startedStorage = await readStorage(page);
    expect(startedStorage.depQuizProgress).toBe(initialStorage.depQuizProgress);
    expect(startedStorage.depQuizSettings).toBe(initialStorage.depQuizSettings);
    const startedSession = JSON.parse(startedStorage.depQuizActiveSession ?? 'null');
    expect(startedSession.mode).toBe('weaknessReview');
    expect(startedSession.order).toEqual([question.id]);
    expect(startedSession.currentIndex).toBe(0);
    expect(startedSession.settingsSnapshot.source).toBe('weaknessReviewTargets');
    expect(startedSession.settingsSnapshot.condition).toMatchObject({
      type: 'confidenceOutcome',
      value: WRONG_HIGH!.id,
    });

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    const suspendedSession = JSON.parse(
      (await readStorage(page)).depQuizActiveSession ?? 'null'
    );
    await page.reload();
    await expect(page.locator('#home-view')).toBeVisible();
    await page.getByRole('button', { name: '続きから再開' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    const resumedSession = JSON.parse((await readStorage(page)).depQuizActiveSession ?? 'null');
    expect(resumedSession.mode).toBe(suspendedSession.mode);
    expect(resumedSession.order).toEqual(suspendedSession.order);
    expect(resumedSession.currentIndex).toBe(suspendedSession.currentIndex);
    expect(resumedSession.settingsSnapshot.condition).toEqual(
      suspendedSession.settingsSnapshot.condition
    );

    await answerCurrentQuestionCorrectlyWithHighConfidence(page);
    const progressAfterAnswer = JSON.parse(
      (await readStorage(page)).depQuizProgress ?? '{}'
    );
    expect(progressAfterAnswer[question.id]).toMatchObject({
      seenCount: 2,
      correctCount: 1,
      wrongCount: 1,
      lastConfidenceAnswer: {
        result: CORRECT_HIGH!.result,
        confidence: CORRECT_HIGH!.confidence,
      },
    });
    expect((await readStorage(page)).depQuizSettings).toBe(initialStorage.depQuizSettings);

    await page
      .getByLabel('主要操作', { exact: true })
      .getByRole('button', { name: '次へ進む' })
      .click();
    await expect(page.locator('#result-view')).toBeVisible();
    await expect(page.getByRole('button', { name: '弱点分析を見る' })).toBeVisible();
    await expect(
      page.evaluate(() => localStorage.getItem('depQuizActiveSession'))
    ).resolves.toBeNull();

    const beforeReturn = await readStorage(page);
    await page.getByRole('button', { name: '弱点分析を見る' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();
    await expect(readStorage(page)).resolves.toEqual(beforeReturn);
    const refreshedSummary = page.locator('.analysis-confidence-summary');
    if (!(await refreshedSummary.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await refreshedSummary.locator('summary').click();
    }
    await expect(outcomeCard(refreshedSummary, WRONG_HIGH!.id)).toContainText('0問・要確認');
    await expect(outcomeCard(refreshedSummary, CORRECT_HIGH!.id)).toContainText(
      '1問・安定理解'
    );
    await expect(confidenceMetric(refreshedSummary, 'review')).toHaveText('0問');
    await expect(confidenceMetric(refreshedSummary, 'advance')).toHaveText('1問');
    await expect(
      outcomeCard(refreshedSummary, WRONG_HIGH!.id).getByRole('button', {
        name: 'この状態の問題を見る',
      })
    ).toBeDisabled();
    await expect(
      refreshedSummary.getByRole('button', { name: '要確認の問題を見る' })
    ).toBeDisabled();
    await expect(
      outcomeCard(refreshedSummary, CORRECT_HIGH!.id).getByRole('button', {
        name: 'この状態の問題を見る',
      })
    ).toBeEnabled();
  });

  test('rederives the empty confidence analysis after learning history reset', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop reset reanalysis coverage.');
    expect(WRONG_HIGH).toBeTruthy();
    const [question] = await loadQuestions(request);
    await seedWrongHigh(page, question.id);

    const summary = await openConfidenceAnalysis(page);
    await outcomeCard(summary, WRONG_HIGH!.id)
      .getByRole('button', { name: 'この状態の問題を見る' })
      .click();
    await expect(page.locator('#weakness-review-targets-view')).toBeVisible();
    await page.getByRole('button', { name: '分析画面へ戻る' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();

    await page.getByRole('button', { name: '学習履歴をリセット', exact: true }).click();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    await expect(page.locator('#learning-history-reset-dialog')).toBeHidden();
    await expect(page.locator('#learning-history-reset-success')).toBeVisible();

    const refreshedSummary = page.locator('.analysis-confidence-summary');
    if (!(await refreshedSummary.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await refreshedSummary.locator('summary').click();
    }
    await expect(refreshedSummary.locator('.analysis-confidence-status')).toHaveAttribute(
      'data-coverage-status',
      'none'
    );
    await expect(refreshedSummary.locator('.analysis-confidence-outcome')).toHaveCount(6);
    const buttons = refreshedSummary.locator('[data-review-target-type]');
    await expect(buttons).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) {
      await expect(buttons.nth(index)).toBeDisabled();
    }
    await expect(page.locator('#weakness-review-targets-view')).toBeHidden();
  });

  test('reaches the quiz from the confidence analysis without mobile overflow', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Mobile confidence review smoke coverage.'
    );
    expect(WRONG_HIGH).toBeTruthy();
    const [question] = await loadQuestions(request);
    await seedWrongHigh(page, question.id);

    const summary = await openConfidenceAnalysis(page);
    const wrongHighButton = outcomeCard(summary, WRONG_HIGH!.id).getByRole('button', {
      name: 'この状態の問題を見る',
    });
    await expectTouchTarget(wrongHighButton);
    await expectNoHorizontalOverflow(page, '#analysis-view');
    await wrongHighButton.click();

    const targetView = page.locator('#weakness-review-targets-view');
    await expect(targetView).toBeVisible();
    const startButton = targetView.getByRole('button', { name: 'この条件で復習する' });
    await expectTouchTarget(startButton);
    await expectNoHorizontalOverflow(page, '#weakness-review-targets-view');
    await startButton.click();

    await expect(page.locator('#quiz-view')).toBeVisible();
    await expectTouchTarget(page.getByRole('button', { name: '回答する' }));
    await expectNoHorizontalOverflow(page, '#quiz-view');
  });
});