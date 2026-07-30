import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { CONFIDENCE_OUTCOMES } from '../../dep-quiz-app/confidence-outcome.js';
import { gotoDepHome } from './helpers';

type Question = { id: string; section: string };
type StorageSnapshot = Record<(typeof STORAGE_KEYS)[number], string | null>;

const STORAGE_KEYS = ['depQuizProgress', 'depQuizSettings', 'depQuizActiveSession'] as const;
const settings = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };

async function loadQuestions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

function existingSession(questionId: string) {
  return {
    schemaVersion: 2,
    app: 'dep-quiz-app',
    order: [questionId],
    currentIndex: 0,
    answers: {},
    confidenceByQuestion: {},
    choiceMap: {},
    graded: {},
    completedAt: null,
    explanationOpen: false,
    mode: 'normal',
    startedAt: '2026-07-30T00:00:00.000Z',
    settingsSnapshot: settings,
  };
}

async function readStorage(page: Page): Promise<StorageSnapshot> {
  return page.evaluate((keys) => {
    return Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  }, STORAGE_KEYS) as Promise<StorageSnapshot>;
}

async function seedAnalysis(page: Page, questions: Question[], withProgress = true) {
  const progress = withProgress
    ? Object.fromEntries(
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
      )
    : {};
  const snapshot = {
    depQuizProgress: JSON.stringify(progress),
    depQuizSettings: JSON.stringify(settings),
    depQuizActiveSession: JSON.stringify(existingSession(questions[6].id)),
  };
  await page.addInitScript((values) => {
    localStorage.clear();
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  }, snapshot);
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  expect(await readStorage(page)).toEqual(snapshot);
  return snapshot;
}

test.describe('[DEP][FLOW] Confidence analysis / Review targets', () => {
  test('all six outcome CTAs show only their matching question and preserve storage on return', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop six-outcome coverage.');
    const questions = await loadQuestions(request);
    const snapshot = await seedAnalysis(page, questions);

    for (const [index, outcome] of CONFIDENCE_OUTCOMES.entries()) {
      const button = page
        .locator(`.analysis-confidence-outcome[data-outcome="${outcome.id}"]`)
        .getByRole('button', { name: 'この状態の問題を見る' });
      await expect(button).toBeEnabled();
      await button.click();

      const cards = page.locator('.weakness-review-target-item');
      await expect(cards).toHaveCount(1);
      await expect(cards).toContainText(`問題ID: ${questions[index].id}`);
      await expect(page.locator('#weakness-review-targets-panel')).toContainText(outcome.title);
      expect(await readStorage(page)).toEqual(snapshot);

      await page.getByRole('button', { name: '分析画面へ戻る' }).click();
      await expect(button).toBeFocused();
      expect(await readStorage(page)).toEqual(snapshot);
    }
  });

  test('review CTA shows five matches and explicit start replaces only active session', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop aggregate/session coverage.');
    const questions = await loadQuestions(request);
    const snapshot = await seedAnalysis(page, questions);
    const reviewButton = page.getByRole('button', { name: '要確認の問題を見る' });

    await reviewButton.click();
    const cards = page.locator('.weakness-review-target-item');
    await expect(cards).toHaveCount(5);
    await expect(
      cards.locator('.weakness-review-target-item__id').allTextContents()
    ).resolves.toEqual(questions.slice(1, 6).map((question) => `問題ID: ${question.id}`));
    expect(await readStorage(page)).toEqual(snapshot);

    await page.getByRole('button', { name: '分析画面へ戻る' }).click();
    await expect(reviewButton).toBeFocused();
    expect(await readStorage(page)).toEqual(snapshot);
    await reviewButton.click();
    await page.getByRole('button', { name: 'この条件で復習する' }).click();

    const afterStart = await readStorage(page);
    expect(afterStart.depQuizProgress).toBe(snapshot.depQuizProgress);
    expect(afterStart.depQuizSettings).toBe(snapshot.depQuizSettings);
    expect(afterStart.depQuizActiveSession).not.toBe(snapshot.depQuizActiveSession);
    const session = JSON.parse(afterStart.depQuizActiveSession ?? 'null');
    expect(session.mode).toBe('weaknessReview');
    expect(session.order).toEqual(questions.slice(1, 6).map((question) => question.id));
    expect(session.settingsSnapshot.count).toBe(5);
    expect(session.settingsSnapshot.source).toBe('weaknessReviewTargets');
    expect(session.settingsSnapshot.condition).toEqual({
      type: 'confidenceGuidance',
      value: 'review',
      label: '要確認（5分類）',
    });
  });

  test('zero-count analysis disables all seven CTAs without storage mutation or overflow', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile empty/responsive coverage.');
    const questions = await loadQuestions(request);
    const snapshot = await seedAnalysis(page, questions, false);
    const buttons = page.locator('.analysis-confidence-summary [data-review-target-type]');

    await expect(buttons).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) await expect(buttons.nth(index)).toBeDisabled();
    expect(await readStorage(page)).toEqual(snapshot);
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  });
});
