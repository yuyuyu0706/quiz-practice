import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { gotoDepHome, startDepQuiz } from './helpers';

type Question = { id: string; section: string };
type Mode = 'normal' | 'random' | 'wrongOnly' | 'bookmarks' | 'notesOnly';

async function loadQuestions(request: APIRequestContext): Promise<Question[]> {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function seedEntry(index: number) {
  const answeredAt = '2026-07-01T00:00:00.000Z';
  return {
    seenCount: 2,
    correctCount: 1,
    wrongCount: 1,
    lastAnsweredAt: answeredAt,
    bookmark: true,
    noteText: `横断テスト用メモ ${index}`,
    note: `横断テスト用メモ ${index}`,
    noteUpdatedAt: answeredAt,
    wrongReasonTags: [],
    wrongReasonUpdatedAt: null,
  };
}

async function seedReviewProgress(page: Page, questions: Question[]) {
  const progress = Object.fromEntries(
    questions.map((question, index) => [question.id, seedEntry(index)])
  );
  await page.addInitScript((value) => {
    localStorage.setItem('depQuizProgress', JSON.stringify(value));
  }, progress);
}

async function startMode(page: Page, mode: Mode) {
  await gotoDepHome(page);
  if (mode === 'notesOnly') {
    await page.getByRole('button', { name: 'メモあり問題を復習' }).click();
  } else {
    await page.locator(`input[name="mode"][value="${mode}"]`).check();
    await page.locator('#question-count').selectOption('10');
    await page.getByRole('button', { name: '開始' }).click();
  }
  await expect(page.locator('#quiz-view')).toBeVisible();
}

async function currentQuestionId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
    return session.order[session.currentIndex];
  });
}

async function gradeAndAssertAtomicSave(page: Page, confidence: 'low' | 'medium' | 'high') {
  const questionId = await currentQuestionId(page);
  const before = await page.evaluate((id) => {
    const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
    return progress[id] ?? { seenCount: 0, correctCount: 0, wrongCount: 0 };
  }, questionId);

  await page.locator('#choices-form input[name="choice"]').first().check();
  await page.locator(`#confidence-options input[value="${confidence}"]`).check();
  await page.getByRole('button', { name: '回答する' }).click();
  await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);

  const after = await page.evaluate((id) => {
    const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
    return progress[id];
  }, questionId);
  expect(after.seenCount).toBe((before.seenCount ?? 0) + 1);
  expect(after.correctCount + after.wrongCount).toBe(
    (before.correctCount ?? 0) + (before.wrongCount ?? 0) + 1
  );
  expect(after.lastConfidenceAnswer.confidence).toBe(confidence);
  expect(after.lastConfidenceAnswer.answeredAt).toBe(after.lastAnsweredAt);
}

test.describe('[DEP][FLOW] Confidence input / Cross-flow contract', () => {
  test('restores an ungraded answer and confidence after suspend and reload, then saves once', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Representative desktop resume coverage.');
    await startDepQuiz(page, '10');

    const progressBefore = await page.evaluate(() => localStorage.getItem('depQuizProgress'));
    const answer = page.locator('#choices-form input[name="choice"]').nth(1);
    await answer.check();
    await page.locator('#confidence-options input[value="high"]').check();
    const questionId = await currentQuestionId(page);

    await page.getByRole('button', { name: '中断してホームへ' }).click();
    expect(await page.evaluate(() => localStorage.getItem('depQuizProgress'))).toBe(progressBefore);
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('depQuizProgress'))).toBe(progressBefore);
    await page.getByRole('button', { name: '続きから再開' }).click();

    await expect(page.locator('#choices-form input[name="choice"]').nth(1)).toBeChecked();
    await expect(page.locator('#confidence-options input[value="high"]')).toBeChecked();
    const resumedSession = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}')
    );
    expect(resumedSession.answers[questionId]).toBe(await answer.getAttribute('value'));
    expect(resumedSession.confidenceByQuestion[questionId]).toBe('high');
    expect(await page.evaluate(() => localStorage.getItem('depQuizProgress'))).toBe(progressBefore);

    await gradeAndAssertAtomicSave(page, 'high');
    const afterGrading = await page.evaluate(() => localStorage.getItem('depQuizProgress'));
    await page.keyboard.press('Enter');
    await page.locator('#submit-answer').dispatchEvent('click');
    expect(await page.evaluate(() => localStorage.getItem('depQuizProgress'))).toBe(afterGrading);
  });

  for (const mode of ['normal', 'random', 'wrongOnly', 'bookmarks', 'notesOnly'] as const) {
    test(`${mode} uses the shared confidence grading and persistence path`, async ({
      page,
      request,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Desktop mode matrix coverage.');
      if (mode !== 'normal' && mode !== 'random') {
        await seedReviewProgress(page, await loadQuestions(request));
      }
      await startMode(page, mode);
      const sessionMode = await page.evaluate(
        () => JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}').mode
      );
      expect(sessionMode).toBe(mode);

      if (mode === 'random') {
        await page.keyboard.press('1');
        await page.keyboard.press('m');
        await page.keyboard.press('Enter');
        await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
        const saved = await page.evaluate(
          (id) => {
            const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
            return progress[id];
          },
          await currentQuestionId(page)
        );
        expect(saved.lastConfidenceAnswer.confidence).toBe('medium');
        expect(saved.lastConfidenceAnswer.answeredAt).toBe(saved.lastAnsweredAt);
      } else {
        await gradeAndAssertAtomicSave(page, 'medium');
      }
    });
  }

  test('weakness review uses the shared confidence grading and persistence path', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop weakness review coverage.');
    await seedReviewProgress(page, await loadQuestions(request));
    await gotoDepHome(page);
    await page.getByRole('button', { name: '弱点を分析' }).click();
    await page.locator('.analysis-sections.analysis-disclosure > summary').click();
    await page
      .locator('.analysis-section-card')
      .first()
      .getByRole('button', { name: 'このSectionの問題を見る' })
      .click();
    await page.getByRole('button', { name: 'この条件で復習する' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}').mode
      )
    ).toBe('weaknessReview');
    await gradeAndAssertAtomicSave(page, 'low');
  });

  test('mobile touch input saves the selected confidence with the answer', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Representative mobile touch coverage.');
    await startDepQuiz(page, '10');
    await page.locator('#choices-form label').first().tap();
    await page.locator('.confidence-option').last().tap();
    await page.getByRole('button', { name: '回答する' }).tap();
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
    const saved = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
      const progress = JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}');
      return progress[session.order[session.currentIndex]];
    });
    expect(saved.lastConfidenceAnswer.confidence).toBe('low');
    expect(saved.lastConfidenceAnswer.answeredAt).toBe(saved.lastAnsweredAt);
  });
});
