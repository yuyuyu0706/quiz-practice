import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { CONFIDENCE_OUTCOMES } from '../../dep-quiz-app/confidence-outcome.js';
import { gotoDepHome } from './helpers';

type Question = { id: string; section: string };

const settings = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };

async function loadQuestions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

async function seedAnalysis(page: Page, questions: Question[]) {
  const progress = Object.fromEntries(
    questions.slice(0, 6).map((question, index) => {
      const outcome = CONFIDENCE_OUTCOMES[index];
      return [
        question.id,
        {
          seenCount: 4,
          correctCount: outcome.result === 'wrong' ? 4 : 0,
          wrongCount: outcome.result === 'correct' ? 4 : 0,
          lastAnsweredAt: '2026-07-30T00:00:00.000Z',
          lastConfidenceAnswer: {
            result: outcome.result,
            confidence: outcome.confidence,
            answeredAt: '2026-07-30T00:00:00.000Z',
          },
        },
      ];
    })
  );
  const snapshot = {
    depQuizProgress: JSON.stringify(progress),
    depQuizSettings: JSON.stringify(settings),
    depQuizActiveSession: JSON.stringify({
      schemaVersion: 1,
      app: 'dep-quiz-app',
      order: [questions[0].id],
      currentIndex: 0,
      answers: {},
      confidences: {},
      choiceMap: {},
      graded: {},
      completedAt: null,
      explanationOpen: false,
      mode: 'normal',
      startedAt: '2026-07-30T00:00:00.000Z',
      settingsSnapshot: settings,
    }),
  };
  await page.addInitScript((values) => {
    localStorage.clear();
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  }, snapshot);
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  return snapshot;
}

test.describe('[DEP][FLOW] Confidence analysis / Review targets', () => {
  test('opens each canonical outcome, restores focus, and starts the displayed weakness review', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop interaction coverage.');
    const questions = await loadQuestions(request);
    const snapshot = await seedAnalysis(page, questions);
    const correctHigh = page.locator('[data-outcome="correct_high"]');
    const wrongHighButton = page
      .locator('[data-outcome="wrong_high"]')
      .getByRole('button', { name: 'この状態の問題を見る' });

    await expect(correctHigh.getByRole('button')).toBeEnabled();
    await expect(page.locator('[data-outcome="correct_medium"] button')).toBeEnabled();
    await wrongHighButton.click();
    const panel = page.locator('#weakness-review-targets-panel');
    await expect(panel).toContainText(CONFIDENCE_OUTCOMES[3].title);
    await expect(panel.locator('.weakness-review-target-item')).toHaveCount(1);
    await expect(panel).toContainText(`問題ID: ${questions[3].id}`);
    await expect(panel).toContainText('最新理解状態');
    await expect(panel).toContainText('不正解');
    await expect(panel).toContainText('確信あり');
    await expect(panel).toContainText('要確認');
    await expect(page.evaluate(() => localStorage.getItem('depQuizActiveSession'))).resolves.toBe(
      snapshot.depQuizActiveSession
    );

    await page.getByRole('button', { name: '分析画面へ戻る' }).click();
    await expect(wrongHighButton).toBeFocused();
    await wrongHighButton.click();
    await panel.getByRole('button', { name: 'この条件で復習する' }).click();
    const activeSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );
    expect(activeSession.mode).toBe('weaknessReview');
    expect(activeSession.order).toEqual([questions[3].id]);
    expect(activeSession.settingsSnapshot.condition).toEqual({
      type: 'confidenceOutcome',
      value: 'wrong_high',
      label: CONFIDENCE_OUTCOMES[3].title,
    });
    expect(await page.evaluate(() => localStorage.getItem('depQuizProgress'))).toBe(
      snapshot.depQuizProgress
    );
  });

  test('opens all five review outcomes without horizontal overflow at 375px', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile quality coverage.');
    const questions = await loadQuestions(request);
    await seedAnalysis(page, questions);
    await page.getByRole('button', { name: '要確認の問題を見る' }).click();
    await expect(page.locator('.weakness-review-target-item')).toHaveCount(5);
    await expect(page.locator('#weakness-review-targets-panel')).toContainText('要確認（5分類）');
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  });
});
