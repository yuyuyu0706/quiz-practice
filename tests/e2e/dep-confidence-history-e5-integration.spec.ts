import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { gotoDepHome, startDepQuiz } from './helpers';

type Question = { id: string; section: string; answer: string };
const HISTORY_KEY = 'depQuizConfidenceHistory';
const STORAGE_KEYS = ['depQuizProgress', HISTORY_KEY, 'depQuizSettings'] as const;

async function loadQuestions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

async function currentQuestion(page: Page, questions: Question[]) {
  const id = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
    return session.order[session.currentIndex] as string;
  });
  const question = questions.find((candidate) => candidate.id === id);
  expect(question).toBeTruthy();
  return question!;
}

async function selectMappedAnswer(page: Page, question: Question, correct: boolean) {
  const label = await page.evaluate(
    ({ id, answer, useCorrect }) => {
      const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? '{}');
      const entries = Object.entries(session.choiceMap[id] ?? {}) as [string, string][];
      return entries.find(([, original]) => (original === answer) === useCorrect)?.[0];
    },
    { id: question.id, answer: question.answer, useCorrect: correct }
  );
  expect(label).toBeTruthy();
  await page.locator(`#choices-form input[value="${label}"]`).check();
  await page.locator('#confidence-options input[value="high"]').check();
  await page.getByRole('button', { name: '回答する' }).click();
  await expect(page.locator('#confidence-outcome')).toHaveAttribute(
    'data-outcome',
    correct ? 'correct_high' : 'wrong_high'
  );
}

async function openAnalysis(page: Page) {
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await expect(page.locator('#analysis-view')).toBeVisible();
}

function historyPanel(page: Page) {
  return page.locator('.analysis-confidence-history');
}

function historyMetric(panel: Locator, label: string) {
  return panel.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]').first();
}

async function storageSnapshot(page: Page) {
  return page.evaluate(
    (keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    STORAGE_KEYS
  );
}

test.describe('[DEP][FLOW] Confidence history / E5 lifecycle', () => {
  test('guarantees real answer commits become one history change and survive reload', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Representative desktop lifecycle.');
    const questions = await loadQuestions(request);
    await page.clock.setFixedTime(new Date('2026-06-01T12:00:00.000Z'));
    await startDepQuiz(page, '10');
    const question = await currentQuestion(page, questions);
    await selectMappedAnswer(page, question, false);
    await page.getByRole('button', { name: '中断してホームへ' }).click();

    await openAnalysis(page);
    await page.locator('.analysis-confidence-summary > summary').click();
    const wrongHigh = page.locator('.analysis-confidence-outcome[data-outcome="wrong_high"]');
    await expect(wrongHigh).toContainText('1問');
    await wrongHigh.getByRole('button', { name: 'この状態の問題を見る' }).click();
    await page.getByRole('button', { name: 'この条件で復習する' }).click();
    await page.clock.setFixedTime(new Date('2026-08-02T12:00:00.000Z'));
    await selectMappedAnswer(page, question, true);
    await page
      .getByLabel('主要操作', { exact: true })
      .getByRole('button', { name: '次へ進む' })
      .click();
    await page.getByRole('button', { name: '弱点分析を見る' }).click();

    await page.locator('.analysis-confidence-summary > summary').click();
    await expect(
      page.locator('.analysis-confidence-outcome[data-outcome="correct_high"]')
    ).toContainText('1問');
    await expect(wrongHigh).toContainText('0問');
    const panel = historyPanel(page);
    await panel.locator('summary').click();
    await expect(historyMetric(panel, '回答試行数')).toHaveText('1件');
    await expect(panel).toContainText('誤った自信を修正');
    await expect(panel).toContainText('要確認から安定理解へ');
    await panel.locator('[data-history-period]').selectOption('all');
    await expect(historyMetric(panel, '回答試行数')).toHaveText('2件');
    await expect(historyMetric(panel, '対象問題数')).toHaveText('1問');
    await expect(historyMetric(panel, '正解')).toHaveText('1件');
    await expect(historyMetric(panel, '不正解')).toHaveText('1件');
    await expect(historyMetric(panel, '試行ベース正答率')).toHaveText('50%');
    await panel.locator('[data-history-section]').selectOption(question.section);
    await expect(historyMetric(panel, '回答試行数')).toHaveText('2件');

    const beforeReload = await storageSnapshot(page);
    await page.reload();
    await openAnalysis(page);
    const reloaded = historyPanel(page);
    await reloaded.locator('summary').click();
    await reloaded.locator('[data-history-period]').selectOption('all');
    await expect(historyMetric(reloaded, '回答試行数')).toHaveText('2件');
    expect(await storageSnapshot(page)).toEqual(beforeReload);
  });
});

test.describe('[DEP][DATA] Confidence history / Reset and reload', () => {
  test('guarantees reset clears recorded E5 data and re-derives empty analyses after reload', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Representative desktop reset lifecycle.');
    const questions = await loadQuestions(request);
    const settings = JSON.stringify({ sections: ['1'], mode: 'normal', count: '10' });
    await page.addInitScript(
      ({ ids, rawSettings }) => {
        localStorage.setItem(rawSettings.key, rawSettings.value);
        localStorage.setItem(
          'depQuizProgress',
          JSON.stringify(
            Object.fromEntries(
              ids.map((id) => [
                id,
                {
                  bookmark: true,
                  noteText: '保持するメモ',
                  noteUpdatedAt: '2026-08-01T00:00:00.000Z',
                  unknownAttribute: 'keep',
                },
              ])
            )
          )
        );
      },
      {
        ids: questions.map(({ id }) => id),
        rawSettings: { key: 'depQuizSettings', value: settings },
      }
    );
    await page.clock.setFixedTime(new Date('2026-08-02T12:00:00.000Z'));
    await startDepQuiz(page, '10');
    const question = await currentQuestion(page, questions);
    await selectMappedAnswer(page, question, false);
    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await openAnalysis(page);
    const panel = historyPanel(page);
    await panel.locator('summary').click();
    await expect(historyMetric(panel, '回答試行数')).toHaveText('1件');

    await page.getByRole('button', { name: '学習履歴をリセット' }).click();
    await expect(page.locator('#learning-history-reset-dialog')).toContainText(
      '回答試行履歴1件削除予定'
    );
    await page.getByRole('button', { name: '学習履歴をリセットする' }).click();
    await page.reload();
    const stored = await page.evaluate(
      (id) => ({
        progress: JSON.parse(localStorage.getItem('depQuizProgress') ?? '{}')[id],
        history: localStorage.getItem('depQuizConfidenceHistory'),
        session: localStorage.getItem('depQuizActiveSession'),
        settings: localStorage.getItem('depQuizSettings'),
      }),
      question.id
    );
    expect(stored.history).toBe(JSON.stringify({ version: 1, attempts: [] }));
    expect(stored.session).toBeNull();
    expect(stored.settings).toBe(settings);
    expect(stored.progress).toEqual({
      bookmark: true,
      noteText: '保持するメモ',
      noteUpdatedAt: '2026-08-01T00:00:00.000Z',
      unknownAttribute: 'keep',
    });
    await openAnalysis(page);
    const empty = historyPanel(page);
    await empty.locator('summary').click();
    await expect(historyMetric(empty, '回答試行数')).toHaveText('0件');
    await expect(historyMetric(empty, '対象問題数')).toHaveText('0問');
    await expect(historyMetric(empty, '試行ベース正答率')).toHaveText('未算出');
    await expect(empty.locator('.analysis-confidence-history__list li')).toHaveCount(0);
    await expect(empty).toContainText('該当する履歴はありません。');
    await expect(page.getByRole('button', { name: '学習履歴をリセット' })).toBeHidden();
  });
});

test.describe('[DEP][UI] Confidence history / Mobile lifecycle', () => {
  test('guarantees the 375px answer-analysis-reset lifecycle remains operable', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Representative mobile lifecycle.');
    await page.setViewportSize({ width: 375, height: 812 });
    await startDepQuiz(page, '10');
    await page.locator('#choices-form label').first().tap();
    await page.locator('.confidence-option').first().tap();
    await page.getByRole('button', { name: '回答する' }).tap();
    await page.getByRole('button', { name: '中断してホームへ' }).tap();
    await openAnalysis(page);
    const panel = historyPanel(page);
    await panel.locator('summary').tap();
    await expect(historyMetric(panel, '回答試行数')).toHaveText('1件');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
    expect(
      (await page.getByRole('button', { name: '学習履歴をリセット' }).boundingBox())?.height
    ).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: '学習履歴をリセット' }).tap();
    await page.getByRole('button', { name: '学習履歴をリセットする' }).tap();
    await expect(historyMetric(panel, '回答試行数')).toHaveText('0件');
    expect(await page.evaluate(() => localStorage.getItem('depQuizConfidenceHistory'))).toBe(
      JSON.stringify({ version: 1, attempts: [] })
    );
  });
});
