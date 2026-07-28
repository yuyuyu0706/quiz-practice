import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { CONFIDENCE_OUTCOMES } from '../../dep-quiz-app/confidence-outcome.js';
import { startDepQuiz } from './helpers';

type Confidence = 'high' | 'medium' | 'low';
type Result = 'correct' | 'wrong';
type Question = { id: string; answer: string; whyWrong?: Record<string, string> };

async function loadQuestions(request: APIRequestContext): Promise<Question[]> {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function chooseResult(page: Page, question: Question, result: Result) {
  const choiceMap = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
    const questionId = session.order[session.currentIndex];
    return session.choiceMap[questionId] as Record<string, string>;
  });
  const label = Object.keys(choiceMap).find((candidate) =>
    result === 'correct'
      ? choiceMap[candidate] === question.answer
      : choiceMap[candidate] !== question.answer
  );
  expect(label).toBeTruthy();
  await page.locator(`#choices-form input[name="choice"][value="${label}"]`).check();
}

async function grade(
  page: Page,
  request: APIRequestContext,
  result: Result,
  confidence: Confidence
) {
  const questions = await loadQuestions(request);
  const questionId = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
    return session.order[session.currentIndex] as string;
  });
  const question = questions.find(({ id }) => id === questionId);
  expect(question).toBeTruthy();
  await chooseResult(page, question!, result);
  await page.locator(`#confidence-options input[value="${confidence}"]`).check();
  await page.getByRole('button', { name: '回答する' }).click();
  await expect(page.locator('#result-indicator')).toContainText(
    result === 'correct' ? '正解' : '不正解'
  );
  return question!;
}

async function resetAndStart(page: Page) {
  await page.goto('/dep-quiz-app/');
  await page.evaluate(() => localStorage.clear());
  await startDepQuiz(page, '10');
}

test.describe('[DEP][UI] Confidence feedback / Six outcomes', () => {
  test('connects all six graded outcomes to the canonical feedback DOM', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop outcome matrix coverage.');

    for (const outcome of CONFIDENCE_OUTCOMES) {
      await resetAndStart(page);
      const card = page.locator('#confidence-outcome');
      await expect(card).toBeHidden();

      await grade(page, request, outcome.result, outcome.confidence);
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('data-outcome', outcome.id);
      await expect(card).toHaveAttribute(
        'data-guidance',
        outcome.id === 'correct_high' ? 'advance' : 'review'
      );
      await expect(card).toHaveClass(new RegExp(`confidence-outcome--${outcome.result}`));
      await expect(page.locator('#confidence-outcome-title')).toHaveText(outcome.title);
      await expect(page.locator('#confidence-outcome-meaning')).toHaveText(outcome.meaning);
      await expect(page.locator('#confidence-outcome-action')).toHaveText(outcome.action);
      await expect(card).toBeFocused();

      const primary = outcome.id === 'correct_high' ? '#next-question' : '#review-explanation';
      const secondary = outcome.id === 'correct_high' ? '#review-explanation' : '#next-question';
      await expect(page.locator(primary)).toHaveClass(/primary/);
      await expect(page.locator(primary)).toBeEnabled();
      await expect(page.locator(secondary)).not.toHaveClass(/primary/);
      await expect(page.locator('#next-question')).toBeEnabled();
    }
  });
});

test.describe('[DEP][FLOW] Confidence feedback / Guidance and disclosures', () => {
  test('keeps disclosure ARIA exclusive and routes review guidance to its targets', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop guidance coverage.');
    await resetAndStart(page);
    const question = await grade(page, request, 'wrong', 'high');
    const card = page.locator('#confidence-outcome');
    await expect(card).toHaveAttribute('aria-labelledby', 'confidence-outcome-title');
    await expect(card).toHaveAttribute('aria-describedby', 'confidence-outcome-instruction');

    const meaning = page.locator('#confidence-outcome-meaning-toggle');
    const action = page.locator('#confidence-outcome-action-toggle');
    await expect(meaning).toHaveAttribute('aria-controls', 'confidence-outcome-meaning-panel');
    await expect(action).toHaveAttribute('aria-controls', 'confidence-outcome-action-panel');
    await expect(meaning).toHaveAttribute('aria-expanded', 'false');
    await expect(action).toHaveAttribute('aria-expanded', 'false');
    await meaning.click();
    await expect(meaning).toHaveAttribute('aria-expanded', 'true');
    await action.click();
    await expect(action).toHaveAttribute('aria-expanded', 'true');
    await expect(meaning).toHaveAttribute('aria-expanded', 'false');

    await page.locator('#review-explanation').click();
    await expect(page.locator('#explanation')).toBeFocused();
    const jump = page.locator('#confidence-outcome-why-wrong');
    if (question.whyWrong && Object.keys(question.whyWrong).length > 0) {
      await expect(jump).toBeVisible();
      await jump.click();
      await expect(page.locator('#why-wrong')).toBeFocused();
    }

    await page.locator('#next-question').click();
    await page.locator('#prev-question').click();
    await expect(card).toBeVisible();
    await expect(card).not.toBeFocused();
    await expect(meaning).toHaveAttribute('aria-expanded', 'false');
    await expect(action).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await page.reload();
    await page.getByRole('button', { name: '続きから再開' }).click();
    await expect(card).toBeVisible();
    await expect(card).not.toBeFocused();
  });

  test('hides the wrong-answer jump when the question has no whyWrong detail', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop optional-target coverage.');
    const questions = await loadQuestions(request);
    await page.route('**/dep-quiz-app/questions.json', async (route) => {
      const withoutWhyWrong = questions.map((question, index) =>
        index === 0 ? { ...question, whyWrong: undefined } : question
      );
      await route.fulfill({ json: withoutWhyWrong });
    });
    await resetAndStart(page);
    await grade(page, request, 'wrong', 'high');
    await expect(page.locator('#confidence-outcome-why-wrong')).toBeHidden();
  });
});

test.describe('[DEP][UI] Confidence feedback / Mobile layout', () => {
  test('keeps feedback pills responsive and applies guidance-specific sticky behavior', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', '375px mobile contract.');

    for (const scenario of [
      { result: 'correct', confidence: 'high', position: 'sticky' },
      { result: 'wrong', confidence: 'medium', position: 'static' },
    ] as const) {
      await resetAndStart(page);
      await grade(page, request, scenario.result, scenario.confidence);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBeTruthy();
      const toggles = page.locator('.confidence-outcome__toggle');
      await expect(toggles).toHaveCount(2);
      for (const toggle of await toggles.all()) {
        const dimensions = await toggle.evaluate((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            width: rect.width,
            parentWidth: element.parentElement!.clientWidth,
            radius: style.borderRadius,
          };
        });
        expect(dimensions.width).toBeLessThan(dimensions.parentWidth);
        expect(parseFloat(dimensions.radius)).toBeGreaterThan(100);
      }
      await expect(page.getByLabel('主要操作', { exact: true })).toHaveCSS(
        'position',
        scenario.position
      );
    }
  });
});
