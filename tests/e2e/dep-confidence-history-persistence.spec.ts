import { test, expect } from '@playwright/test';
import { startDepQuiz } from './helpers';

test.describe('[DEP][DATA] Confidence answer / History transaction', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Representative storage integration coverage.');
  });

  test('persists matching progress and one canonical attempt without duplicate writes', async ({
    page,
  }) => {
    const previousAttempt = {
      attemptId: 'previous-attempt',
      questionId: 'previous-question',
      section: '1',
      result: 'correct',
      confidence: 'medium',
      answeredAt: '2026-07-01T00:00:00.000Z',
    };
    await page.addInitScript((attempt) => {
      if (localStorage.getItem('depQuizConfidenceHistory') === null) {
        localStorage.setItem(
          'depQuizConfidenceHistory',
          JSON.stringify({ version: 1, attempts: [attempt] })
        );
      }
    }, previousAttempt);

    await startDepQuiz(page);
    const question = await page.evaluate(async () => {
      const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
      const questions = await fetch('./questions.json').then((response) => response.json());
      return questions.find(({ id }: { id: string }) => id === session.order[session.currentIndex]);
    });
    const beforeProgress = await page.evaluate(() => localStorage.getItem('depQuizProgress'));
    const beforeHistory = await page.evaluate(() =>
      localStorage.getItem('depQuizConfidenceHistory')
    );
    await page.locator('#submit-answer').dispatchEvent('click');
    expect(await page.evaluate(() => localStorage.getItem('depQuizProgress'))).toBe(beforeProgress);
    expect(await page.evaluate(() => localStorage.getItem('depQuizConfidenceHistory'))).toBe(
      beforeHistory
    );

    await page.locator('#choices-form input[name="choice"]').first().check();
    await page.locator('#confidence-options input[value="high"]').check();
    await page.getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);

    const saved = await page.evaluate(() => ({
      progress: JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}'),
      history: JSON.parse(localStorage.getItem('depQuizConfidenceHistory') ?? '{}'),
    }));
    const attempt = saved.history.attempts.at(-1);
    const progressAnswer = saved.progress[question.id].lastConfidenceAnswer;
    expect(saved.history.version).toBe(1);
    expect(saved.history.attempts).toHaveLength(2);
    expect(saved.history.attempts[0]).toEqual(previousAttempt);
    expect(attempt).toMatchObject({
      questionId: question.id,
      section: question.section,
      confidence: 'high',
      result: progressAnswer.result,
      answeredAt: progressAnswer.answeredAt,
    });
    expect(attempt.attemptId).toBeTruthy();

    const committedRaw = await page.evaluate(() => ({
      progress: localStorage.getItem('depQuizProgress'),
      history: localStorage.getItem('depQuizConfidenceHistory'),
    }));
    await page.keyboard.press('Enter');
    await page.locator('#submit-answer').dispatchEvent('click');
    expect(
      await page.evaluate(() => ({
        progress: localStorage.getItem('depQuizProgress'),
        history: localStorage.getItem('depQuizConfidenceHistory'),
      }))
    ).toEqual(committedRaw);
    await page.reload();
    expect(
      await page.evaluate(() => ({
        progress: localStorage.getItem('depQuizProgress'),
        history: localStorage.getItem('depQuizConfidenceHistory'),
      }))
    ).toEqual(committedRaw);
  });

  test('rolls both keys back, keeps the answer ungraded, and permits retry', async ({ page }) => {
    await startDepQuiz(page);
    await page.locator('#choices-form input[name="choice"]').first().check();
    await page.locator('#confidence-options input[value="low"]').check();
    const before = await page.evaluate(() => ({
      progress: localStorage.getItem('depQuizProgress'),
      history: localStorage.getItem('depQuizConfidenceHistory'),
    }));
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      let shouldFail = true;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'depQuizConfidenceHistory' && shouldFail) {
          shouldFail = false;
          throw new DOMException('Injected history failure', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });

    await page.getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('#quiz-message')).toContainText('もう一度お試しください');
    await expect(page.locator('#result-indicator')).toBeHidden();
    await expect(page.locator('#explanation')).toBeHidden();
    expect(
      await page.evaluate(() => ({
        progress: localStorage.getItem('depQuizProgress'),
        history: localStorage.getItem('depQuizConfidenceHistory'),
      }))
    ).toEqual(before);
    await expect(page.locator('#choices-form input[name="choice"]:checked')).toHaveCount(1);
    await expect(page.locator('#confidence-options input[value="low"]')).toBeChecked();
    await expect(page.getByRole('button', { name: '回答する' })).toBeEnabled();

    await page.getByRole('button', { name: '回答する' }).click();
    await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
  });
});
