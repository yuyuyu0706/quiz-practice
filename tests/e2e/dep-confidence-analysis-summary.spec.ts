import { test, expect, type Page, type APIRequestContext, type Locator } from '@playwright/test';
import { CONFIDENCE_OUTCOMES } from '../../dep-quiz-app/confidence-outcome.js';
import { gotoDepHome } from './helpers';

type Question = { id: string };
type StorageSnapshot = Record<
  'depQuizProgress' | 'depQuizSettings' | 'depQuizActiveSession',
  string
>;

const STORAGE_KEYS = ['depQuizProgress', 'depQuizSettings', 'depQuizActiveSession'] as const;
const SETTINGS = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };

async function questions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

async function openAnalysis(page: Page, progress: Record<string, unknown>) {
  const snapshot: StorageSnapshot = {
    depQuizProgress: JSON.stringify(progress),
    depQuizSettings: JSON.stringify(SETTINGS),
    depQuizActiveSession: JSON.stringify(null),
  };
  await page.addInitScript((stored) => {
    localStorage.clear();
    Object.entries(stored).forEach(([key, value]) => localStorage.setItem(key, value));
  }, snapshot);
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  return snapshot;
}

function confidenceSummary(page: Page) {
  return page.locator('details.analysis-confidence-summary');
}

async function expandConfidenceSummary(page: Page) {
  const summary = confidenceSummary(page);
  await expect(summary).not.toHaveAttribute('open', '');
  await summary.locator('summary').click();
  await expect(summary).toHaveAttribute('open', '');
  return summary;
}

function entry(result: 'correct' | 'wrong', confidence: 'high' | 'medium' | 'low') {
  return {
    seenCount: 7,
    // Deliberately contradict the latest result to prove the UI does not use cumulative counts.
    correctCount: result === 'correct' ? 0 : 7,
    wrongCount: result === 'wrong' ? 0 : 7,
    lastAnsweredAt: '2026-07-29T00:00:00.000Z',
    lastConfidenceAnswer: { result, confidence, answeredAt: '2026-07-29T00:00:00.000Z' },
  };
}

function metric(card: Locator, label: string) {
  return card
    .locator('dt', { hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd[1]');
}

async function expectStorageUnchanged(page: Page, expected: StorageSnapshot) {
  const actual = await page.evaluate(
    (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    STORAGE_KEYS
  );
  expect(actual).toEqual(expected);
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    documentClient: document.documentElement.clientWidth,
    documentScroll: document.documentElement.scrollWidth,
    analysisClient: document.querySelector('#analysis-view')?.clientWidth ?? 0,
    analysisScroll: document.querySelector('#analysis-view')?.scrollWidth ?? 0,
  }));
  expect(widths.documentScroll).toBeLessThanOrEqual(widths.documentClient);
  expect(widths.analysisScroll).toBeLessThanOrEqual(widths.analysisClient);
}

test.describe('[DEP][UI] Analysis / Confidence summary', () => {
  test('shows none and keeps zero-count canonical cards', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop disclosure and empty-state coverage.');
    const snapshot = await openAnalysis(page, {});
    const summary = confidenceSummary(page);
    const toggle = summary.locator('summary');

    await expect(summary).toHaveAttribute('aria-labelledby', 'analysis-confidence-title');
    await expect(summary).not.toHaveAttribute('open', '');
    await expect(summary.locator('.analysis-disclosure__content')).not.toBeVisible();
    await expectStorageUnchanged(page, snapshot);

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(summary).toHaveAttribute('open', '');
    await expectStorageUnchanged(page, snapshot);
    await page.keyboard.press('Space');
    await expect(summary).not.toHaveAttribute('open', '');
    await expectStorageUnchanged(page, snapshot);

    await toggle.click();
    await expect(summary).toHaveAttribute('open', '');
    await expect(summary.locator('.analysis-confidence-status')).toHaveAttribute(
      'data-coverage-status',
      'none'
    );
    await expect(summary.locator('.analysis-confidence-level')).toHaveCount(3);
    for (const level of ['high', 'medium', 'low']) {
      const card = summary.locator(`.analysis-confidence-level[data-confidence-level="${level}"]`);
      await expect(metric(card, '最新評価ベース正答率')).toHaveText('未算出');
      await expect(card).not.toContainText('0%');
    }
    await expect(summary.locator('.analysis-confidence-outcome')).toHaveCount(6);
    await expect(summary.locator('.analysis-confidence-highlight')).toHaveCount(0);
    await expect(summary.locator('.analysis-confidence-outcome__priority')).toHaveCount(2);
    const buttons = summary.locator('[data-review-target-type]');
    await expect(buttons).toHaveCount(7);
    for (let index = 0; index < 7; index += 1) await expect(buttons.nth(index)).toBeDisabled();
    await expectStorageUnchanged(page, snapshot);
  });

  test('renders complete canonical counts from latest answers and preserves storage boundaries', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop data and matrix coverage.');
    const source = await questions(request);
    const progress: Record<string, unknown> = {};
    source.forEach((question, index) => {
      const outcome = CONFIDENCE_OUTCOMES[index % CONFIDENCE_OUTCOMES.length];
      progress[question.id] = entry(outcome.result, outcome.confidence);
    });
    const snapshot = await openAnalysis(page, progress);
    const summary = await expandConfidenceSummary(page);

    await expect(summary.locator('.analysis-confidence-status')).toHaveAttribute(
      'data-coverage-status',
      'complete'
    );
    await expect(summary.locator('.analysis-confidence-status')).toHaveText(
      '全問題の最新理解状態を分析できています。'
    );

    const coverage = summary.locator('.analysis-confidence-coverage');
    await expect(
      coverage
        .locator(':scope > div')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-confidence-metric')))
    ).resolves.toEqual(['advance', 'review', 'classified', 'unclassified']);
    await expect(metric(coverage, '安定理解')).toHaveText('16問');
    await expect(metric(coverage, '要確認')).toHaveText('75問');
    await expect(metric(coverage, '分析対象')).toHaveText(`${source.length}問`);
    await expect(metric(coverage, '未判定')).toHaveText('0問');

    const primaryAction = summary.locator('[data-review-target-type="confidenceGuidance"]');
    await expect(primaryAction).toHaveClass(/analysis-confidence-primary-action/);
    await expect(primaryAction).toHaveAttribute('data-review-target-guidance', 'review');
    await expect(primaryAction).toBeEnabled();

    const expectedLevels = [
      { id: 'high', questions: '31問', correct: '16問', wrong: '15問', rate: '52%' },
      { id: 'medium', questions: '30問', correct: '15問', wrong: '15問', rate: '50%' },
      { id: 'low', questions: '30問', correct: '15問', wrong: '15問', rate: '50%' },
    ];
    await expect(
      summary
        .locator('.analysis-confidence-level')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-confidence-level')))
    ).resolves.toEqual(['high', 'medium', 'low']);
    for (const expected of expectedLevels) {
      const card = summary.locator(
        `.analysis-confidence-level[data-confidence-level="${expected.id}"]`
      );
      await expect(metric(card, '最新評価ベース正答率')).toHaveText(expected.rate);
      await expect(metric(card, '問題数')).toHaveText(expected.questions);
      await expect(metric(card, '正解数')).toHaveText(expected.correct);
      await expect(metric(card, '誤答数')).toHaveText(expected.wrong);
    }

    const matrix = summary.locator('.analysis-confidence-matrix');
    await expect(matrix).toHaveAttribute('role', 'table');
    await expect(matrix.locator('.analysis-confidence-matrix__column-heading')).toHaveText([
      '確信あり',
      '迷いあり',
      '自信なし',
    ]);
    await expect(
      matrix
        .locator('.analysis-confidence-matrix__row')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-result')))
    ).resolves.toEqual(['correct', 'wrong']);

    const expectedOutcomeCounts = [16, 15, 15, 15, 15, 15];
    await expect(
      matrix
        .locator('.analysis-confidence-outcome')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-outcome')))
    ).resolves.toEqual(CONFIDENCE_OUTCOMES.map(({ id }) => id));
    for (const [index, outcome] of CONFIDENCE_OUTCOMES.entries()) {
      const card = matrix.locator(`.analysis-confidence-outcome[data-outcome="${outcome.id}"]`);
      await expect(card).toHaveAttribute('data-guidance', outcome.guidance);
      await expect(card).toHaveAttribute('data-result', outcome.result);
      await expect(card).toHaveAttribute('data-confidence-level', outcome.confidence);
      await expect(card).toContainText(`${expectedOutcomeCounts[index]}問`);
      await expect(card.getByRole('button', { name: 'この状態の問題を見る' })).toBeEnabled();
    }

    const misconception = matrix.locator(
      '[data-outcome="wrong_high"] .analysis-confidence-outcome__priority'
    );
    await expect(misconception).toHaveAttribute('data-priority-reason', 'misconception-risk');
    await expect(misconception).toContainText('重点');
    await expect(misconception).toContainText('誤認リスク');
    const unstable = matrix.locator(
      '[data-outcome="correct_low"] .analysis-confidence-outcome__priority'
    );
    await expect(unstable).toHaveAttribute('data-priority-reason', 'unstable-correctness');
    await expect(unstable).toContainText('重点');
    await expect(unstable).toContainText('正解の再現性不足');
    await expect(matrix.locator('.analysis-confidence-outcome__priority')).toHaveCount(2);
    await expect(summary.locator('.analysis-confidence-highlight')).toHaveCount(0);
    await expect(summary.getByRole('button')).toHaveCount(7);
    await expectStorageUnchanged(page, snapshot);
  });

  test('shows partial coverage and reports invalid latest data separately', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop quality-state coverage.');
    const source = await questions(request);
    const progress = {
      [source[0].id]: entry('wrong', 'high'),
      [source[1].id]: {
        lastConfidenceAnswer: { result: 'wrong', confidence: 'invalid' },
      },
    };
    const snapshot = await openAnalysis(page, progress);
    const summary = await expandConfidenceSummary(page);
    await expect(summary.locator('.analysis-confidence-status')).toHaveAttribute(
      'data-coverage-status',
      'partial'
    );
    await expect(summary.locator('.analysis-confidence-quality')).toHaveAttribute(
      'data-quality-status',
      'invalid-data-excluded'
    );
    await expectStorageUnchanged(page, snapshot);
  });

  test('has no horizontal overflow at 375px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only layout coverage.');
    await page.setViewportSize({ width: 375, height: 812 });
    const snapshot = await openAnalysis(page, {});
    const summary = await expandConfidenceSummary(page);
    await expect(summary.locator('.analysis-confidence-matrix__column-headings')).not.toBeVisible();
    await expect(summary.locator('.analysis-confidence-outcome__axis-label')).toHaveCount(6);
    await expect(summary.locator('.analysis-confidence-outcome__axis-label').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectStorageUnchanged(page, snapshot);
  });
});
