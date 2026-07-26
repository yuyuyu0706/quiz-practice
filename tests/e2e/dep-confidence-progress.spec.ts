import { test, expect } from '@playwright/test';
import { startDepQuiz } from './helpers';

test.describe('[DEP][DATA] Confidence answer / Progress persistence', () => {
  test('persists one atomic answer result while preserving existing progress data', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Representative storage integration coverage.');

    const response = await request.get('/dep-quiz-app/questions.json');
    expect(response.ok()).toBeTruthy();
    const questions = (await response.json()) as Array<{ id: string }>;
    const initialAnsweredAt = '2026-07-01T00:00:00.000Z';
    const progress = Object.fromEntries(
      questions.map((question, index) => [
        question.id,
        {
          seenCount: 4,
          correctCount: 2,
          wrongCount: 2,
          lastAnsweredAt: initialAnsweredAt,
          lastConfidenceAnswer: {
            result: 'wrong',
            confidence: 'low',
            answeredAt: initialAnsweredAt,
          },
          bookmark: true,
          noteText: '保持するメモ',
          note: '保持するメモ',
          noteUpdatedAt: initialAnsweredAt,
          wrongReasonTags: ['spec-memory-error'],
          wrongReasonUpdatedAt: initialAnsweredAt,
          compatibilityFlag: 'keep',
          unknownData: { index },
        },
      ])
    );
    await page.addInitScript((seed) => {
      localStorage.setItem('depQuizProgress', JSON.stringify(seed));
    }, progress);

    await startDepQuiz(page, 'all');
    const questionId = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
      return session.order[session.currentIndex] as string;
    });
    const unrelatedQuestionId = questions.find(({ id }) => id !== questionId)!.id;
    const unrelatedBefore = progress[unrelatedQuestionId];

    const beforeIncompleteSubmit = await page.evaluate(() =>
      localStorage.getItem('depQuizProgress')
    );
    await page.locator('#submit-answer').dispatchEvent('click');
    expect(await page.evaluate(() => localStorage.getItem('depQuizProgress'))).toBe(
      beforeIncompleteSubmit
    );

    await page.locator('#choices-form input[name="choice"]').first().check();
    await page.locator('#confidence-options input[value="high"]').check();
    await page.getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);

    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')
    );
    const entry = saved[questionId];
    const result = (await page.locator('#result-indicator').textContent())?.includes('不正解')
      ? 'wrong'
      : 'correct';

    expect(entry).toMatchObject({
      seenCount: 5,
      correctCount: result === 'correct' ? 3 : 2,
      wrongCount: result === 'wrong' ? 3 : 2,
      bookmark: true,
      noteText: '保持するメモ',
      note: '保持するメモ',
      wrongReasonTags: ['spec-memory-error'],
      compatibilityFlag: 'keep',
      unknownData: progress[questionId].unknownData,
      lastConfidenceAnswer: {
        result,
        confidence: 'high',
        answeredAt: entry.lastAnsweredAt,
      },
    });
    expect(entry.lastAnsweredAt).not.toBe(initialAnsweredAt);
    expect(saved[unrelatedQuestionId]).toEqual(unrelatedBefore);

    const afterGrading = JSON.stringify(saved);
    await page.keyboard.press('Enter');
    await page.locator('#submit-answer').dispatchEvent('click');
    expect(await page.evaluate(() => localStorage.getItem('depQuizProgress'))).toBe(afterGrading);
  });
});
