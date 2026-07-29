import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { CONFIDENCE_OUTCOMES } from '../../dep-quiz-app/confidence-outcome.js';
import { gotoDepHome } from './helpers';

type Question = { id: string };

async function questions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

async function openAnalysis(page: Page, progress: Record<string, unknown>) {
  const stored = JSON.stringify(progress);
  await page.addInitScript((value) => {
    localStorage.clear();
    localStorage.setItem('depQuizProgress', value);
  }, stored);
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  return stored;
}

function entry(result: 'correct' | 'wrong', confidence: 'high' | 'medium' | 'low') {
  return {
    seenCount: 1,
    correctCount: result === 'correct' ? 1 : 0,
    wrongCount: result === 'wrong' ? 1 : 0,
    lastAnsweredAt: '2026-07-29T00:00:00.000Z',
    lastConfidenceAnswer: { result, confidence, answeredAt: '2026-07-29T00:00:00.000Z' },
  };
}

test.describe('[DEP][UI] Confidence analysis summary', () => {
  test('shows none and keeps zero-count canonical cards', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop state coverage.');
    await openAnalysis(page, {});
    const summary = page.locator('.analysis-confidence-summary');
    await expect(summary).toHaveAttribute('aria-labelledby', 'analysis-confidence-title');
    await expect(summary.locator('.analysis-confidence-status')).toHaveAttribute(
      'data-coverage-status',
      'none'
    );
    await expect(summary.locator('.analysis-confidence-level')).toHaveCount(3);
    await expect(summary.locator('.analysis-confidence-level').last()).toContainText('未算出');
    await expect(summary.locator('.analysis-confidence-outcome')).toHaveCount(6);
    await expect(summary.locator('.analysis-confidence-highlight')).toHaveCount(2);
  });

  test('renders canonical order, rates, quality notice, and immutable storage', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop data coverage.');
    const source = await questions(request);
    const progress: Record<string, unknown> = {};
    CONFIDENCE_OUTCOMES.forEach((outcome, index) => {
      progress[source[index].id] = entry(outcome.result, outcome.confidence);
    });
    progress[source[6].id] = { lastConfidenceAnswer: { result: 'wrong', confidence: 'invalid' } };
    const stored = await openAnalysis(page, progress);
    const summary = page.locator('.analysis-confidence-summary');
    await expect(summary.locator('.analysis-confidence-status')).toHaveAttribute(
      'data-coverage-status',
      'partial'
    );
    await expect(summary.locator('.analysis-confidence-quality')).toHaveAttribute(
      'data-quality-status',
      'invalid-data-excluded'
    );
    await expect(
      summary
        .locator('.analysis-confidence-level')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-confidence-level')))
    ).resolves.toEqual(['high', 'medium', 'low']);
    await expect(
      summary
        .locator('.analysis-confidence-outcome')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-outcome')))
    ).resolves.toEqual(CONFIDENCE_OUTCOMES.map(({ id }) => id));
    await expect(summary.locator('[data-confidence-level="high"]')).toContainText('50%');
    await expect(page.evaluate(() => localStorage.getItem('depQuizProgress'))).resolves.toBe(
      stored
    );
  });

  test('has no horizontal overflow at 375px', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile-only layout coverage.');
    await page.setViewportSize({ width: 375, height: 812 });
    await openAnalysis(page, {});
    await expect(
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).resolves.toBe(true);
  });
});
