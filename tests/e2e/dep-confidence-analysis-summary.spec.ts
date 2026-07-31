import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
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

function metric(card: ReturnType<Page['locator']>, label: string) {
  return card.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]');
}

async function expectStorageUnchanged(page: Page, expected: StorageSnapshot) {
  const actual = await page.evaluate(
    (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    STORAGE_KEYS
  );
  expect(actual).toEqual(expected);
}

test.describe('[DEP][UI] Analysis / Confidence summary', () => {
  test('shows none and keeps zero-count canonical cards', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop state coverage.');
    await openAnalysis(page, {});
    const summary = page.locator('.analysis-confidence-summary');
    await expect(summary).toHaveJSProperty('open', false);
    await expect(summary).toHaveAttribute('aria-labelledby', 'analysis-confidence-title');
    const disclosureTrigger = summary.locator('summary');
    await disclosureTrigger.click();
    await expect(summary).toHaveJSProperty('open', true);
    await disclosureTrigger.press('Enter');
    await expect(summary).toHaveJSProperty('open', false);
    await disclosureTrigger.press('Space');
    await expect(summary).toHaveJSProperty('open', true);
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
    await expect(summary.locator('.analysis-confidence-outcome__highlight')).toHaveCount(2);
  });

  test('renders complete canonical counts from latest answers and preserves storage boundaries', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop data coverage.');
    const source = await questions(request);
    const progress: Record<string, unknown> = {};
    source.forEach((question, index) => {
      const outcome = CONFIDENCE_OUTCOMES[index % CONFIDENCE_OUTCOMES.length];
      progress[question.id] = entry(outcome.result, outcome.confidence);
    });
    const snapshot = await openAnalysis(page, progress);
    const summary = page.locator('.analysis-confidence-summary');
    await summary.locator('summary').click();
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
    await expect(metric(coverage, '分析対象')).toHaveText(`${source.length}問`);
    await expect(metric(coverage, '未判定')).toHaveText('0問');
    await expect(metric(coverage, '安定理解')).toHaveText('16問');
    await expect(metric(coverage, '要確認')).toHaveText('75問');

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
      await expect(metric(card, '問題数')).toHaveText(expected.questions);
      await expect(metric(card, '正解数')).toHaveText(expected.correct);
      await expect(metric(card, '誤答数')).toHaveText(expected.wrong);
      await expect(metric(card, '最新評価ベース正答率')).toHaveText(expected.rate);
    }

    const expectedOutcomeCounts = [16, 15, 15, 15, 15, 15];
    await expect(
      summary
        .locator('.analysis-confidence-outcome')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-outcome')))
    ).resolves.toEqual(CONFIDENCE_OUTCOMES.map(({ id }) => id));
    for (const [index, outcome] of CONFIDENCE_OUTCOMES.entries()) {
      const card = summary.locator(`.analysis-confidence-outcome[data-outcome="${outcome.id}"]`);
      await expect(card).toHaveAttribute('data-guidance', outcome.guidance);
      await expect(card).toContainText(`${expectedOutcomeCounts[index]}問`);
    }

    const highlights = summary.locator('.analysis-confidence-outcome__highlight');
    await expect(
      highlights.evaluateAll((items) =>
        items.map((item) => item.closest('[data-outcome]')?.getAttribute('data-outcome'))
      )
    ).resolves.toEqual(['correct_low', 'wrong_high']);
    await expect(
      summary.locator('[data-outcome="wrong_high"] .analysis-confidence-outcome__highlight')
    ).toContainText('重点誤認リスク');
    await expect(
      summary.locator('[data-outcome="correct_low"] .analysis-confidence-outcome__highlight')
    ).toContainText('重点正解の再現性不足');
    await expect(summary.locator('.analysis-confidence-highlights')).toHaveCount(0);
    const matrix = summary.locator('.analysis-confidence-outcomes');
    await expect(
      matrix
        .locator('.analysis-confidence-outcomes__header [role="columnheader"]')
        .allTextContents()
    ).resolves.toEqual(['', '確信あり', '迷いあり', '自信なし']);
    const rows = matrix.locator('.analysis-confidence-outcomes__row');
    await expect(rows).toHaveCount(2);
    await expect(rows.locator('[role="rowheader"]').allTextContents()).resolves.toEqual([
      '正解',
      '不正解',
    ]);
    for (const row of ['correct', 'wrong']) {
      await expect(
        matrix.locator(`.analysis-confidence-outcomes__row[data-result="${row}"] > [role="cell"]`)
      ).toHaveCount(3);
    }
    await expect(
      matrix.locator('[role="cell"]').evaluateAll((cells) =>
        cells.map((cell) => ({
          result: (cell as HTMLElement).dataset.result,
          confidenceLevel: (cell as HTMLElement).dataset.confidenceLevel,
        }))
      )
    ).resolves.toEqual([
      { result: 'correct', confidenceLevel: 'high' },
      { result: 'correct', confidenceLevel: 'medium' },
      { result: 'correct', confidenceLevel: 'low' },
      { result: 'wrong', confidenceLevel: 'high' },
      { result: 'wrong', confidenceLevel: 'medium' },
      { result: 'wrong', confidenceLevel: 'low' },
    ]);
    await expect(summary.getByRole('button')).toHaveCount(7);
    await expect(summary.locator('[data-review-target-type="confidenceOutcome"]')).toHaveCount(6);
    await expect(summary.locator('[data-review-target-type="confidenceGuidance"]')).toHaveAttribute(
      'data-review-target-guidance',
      'review'
    );
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
    await openAnalysis(page, progress);
    const summary = page.locator('.analysis-confidence-summary');
    await expect(summary.locator('.analysis-confidence-status')).toHaveAttribute(
      'data-coverage-status',
      'partial'
    );
    await expect(summary.locator('.analysis-confidence-quality')).toHaveAttribute(
      'data-quality-status',
      'invalid-data-excluded'
    );
  });

  test('has no horizontal overflow at 375px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only layout coverage.');
    await page.setViewportSize({ width: 375, height: 812 });
    await openAnalysis(page, {});
    await page.locator('.analysis-confidence-summary > summary').click();
    const matrix = page.locator('.analysis-confidence-outcomes');
    await expect(matrix.locator('[role="rowheader"]').allTextContents()).resolves.toEqual([
      '正解',
      '不正解',
    ]);
    await expect(
      matrix.locator('.analysis-confidence-outcome__axis').allTextContents()
    ).resolves.toEqual(['確信あり', '迷いあり', '自信なし', '確信あり', '迷いあり', '自信なし']);
    await expect(
      matrix.locator('[role="cell"]').evaluateAll((cells) => {
        const positions = cells.map((cell) => ({
          outcome: (cell as HTMLElement).dataset.outcome,
          left: cell.getBoundingClientRect().left,
          top: cell.getBoundingClientRect().top,
        }));
        return (
          positions.map(({ outcome }) => outcome).join(',') ===
            'correct_high,correct_medium,correct_low,wrong_high,wrong_medium,wrong_low' &&
          new Set(positions.map(({ left }) => Math.round(left))).size === 1 &&
          positions.every(
            (position, index) => index === 0 || position.top > positions[index - 1].top
          )
        );
      })
    ).resolves.toBe(true);
    const ctaHeights = await page
      .locator('.analysis-confidence-summary [data-review-target-type]')
      .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(ctaHeights).toHaveLength(7);
    expect(ctaHeights.every((height) => height >= 44)).toBe(true);
    await expect(
      page.evaluate(() => ({
        document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        analysis: (() => {
          const view = document.querySelector('#analysis-view');
          return view !== null && view.scrollWidth <= view.clientWidth;
        })(),
      }))
    ).resolves.toEqual({ document: true, analysis: true });
  });
});
