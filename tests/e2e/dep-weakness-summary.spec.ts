import { test, expect, type Locator, type Page, type APIRequestContext } from '@playwright/test';

import { gotoDepHome } from './helpers';

type Question = { id: string; section: string; sectionTitle?: string };
type ProgressEntry = {
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  lastAnsweredAt: string | null;
  bookmark: boolean;
  noteText: string;
  note: string;
  noteUpdatedAt: string | null;
  wrongReasonTags: string[];
  wrongReasonUpdatedAt: string | null;
};

const storageKeys = ['depQuizProgress', 'depQuizSettings', 'depQuizActiveSession'] as const;
const defaultSettings = { sections: ['1', '2', '3', '4', '5'], mode: 'normal', count: '50' };
const activeSessionFixture = {
  order: [],
  idx: 0,
  answers: [],
  mode: 'normal',
  count: '10',
};

async function loadQuestions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

function groupQuestionsBySection(questions: Question[]) {
  const groups = new Map<string, Question[]>();
  for (const question of questions) {
    const section = String(question.section ?? '').trim();
    if (!section) continue;
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section)!.push(question);
  }
  return [...groups.values()].sort((a, b) => compareSections(a[0].section, b[0].section));
}

function compareSections(a: string, b: string) {
  const aNumber = Number(a);
  const bNumber = Number(b);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
  return String(a).localeCompare(String(b), 'ja-JP', { numeric: true });
}

function progressEntry(overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  const seenCount = overrides.seenCount ?? 0;
  const wrongReasonTags = overrides.wrongReasonTags ?? [];
  return {
    seenCount,
    correctCount: overrides.correctCount ?? 0,
    wrongCount: overrides.wrongCount ?? 0,
    lastAnsweredAt: overrides.lastAnsweredAt ?? (seenCount > 0 ? '2026-07-04T00:00:00.000Z' : null),
    bookmark: overrides.bookmark ?? false,
    noteText: overrides.noteText ?? '',
    note: overrides.note ?? overrides.noteText ?? '',
    noteUpdatedAt: overrides.noteUpdatedAt ?? null,
    wrongReasonTags,
    wrongReasonUpdatedAt:
      overrides.wrongReasonUpdatedAt ??
      (wrongReasonTags.length > 0 ? '2026-07-04T00:00:00.000Z' : null),
  };
}

async function seedStorage(page: Page, progress: Record<string, ProgressEntry>) {
  await page.addInitScript(
    ({ progressFixture, settingsFixture, sessionFixture, keys }) => {
      localStorage.clear();
      localStorage.setItem(keys[0], JSON.stringify(progressFixture));
      localStorage.setItem(keys[1], JSON.stringify(settingsFixture));
      localStorage.setItem(keys[2], JSON.stringify(sessionFixture));
    },
    {
      progressFixture: progress,
      settingsFixture: defaultSettings,
      sessionFixture: activeSessionFixture,
      keys: storageKeys,
    }
  );
}

async function openAnalysis(page: Page) {
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await expect(page.locator('#analysis-view')).toBeVisible();
}

function overallSummary(page: Page) {
  return page.locator('section[aria-labelledby="analysis-summary-title"]');
}

function sectionSummaries(page: Page) {
  return page.locator('.analysis-section-card');
}

function metric(summary: Locator, label: string) {
  return summary
    .locator('.analysis-metric')
    .filter({ has: summary.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .first();
}

async function expectMetric(summary: Locator, label: string, value: string) {
  await expect(metric(summary, label).locator('dd.analysis-metric__value')).toHaveText(value);
}

test.describe('[DEP][UI] Analysis / Weakness summary', () => {
  test('guarantees empty progress shows unstarted overall and section summaries without fallback rates', async ({
    page,
    request,
  }) => {
    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups.length).toBeGreaterThan(0);

    await seedStorage(page, {});
    await openAnalysis(page);

    const overall = overallSummary(page);
    await expect(overall).toContainText('回答履歴がまだない');
    await expectMetric(overall, '回答済み問題数', `0 / ${groups.flat().length}`);
    await expectMetric(overall, '正答率', '未算出');
    await expect(overall).not.toContainText('0%');

    const cards = sectionSummaries(page);
    await expect(cards).toHaveCount(groups.length);
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const card = cards.nth(index);
      await expect(card.getByRole('heading')).toHaveText(
        `Section ${group[0].section}：${group[0].sectionTitle}`
      );
      await expect(card).toContainText('回答履歴がまだない');
      await expectMetric(card, '回答済み問題数', `0 / ${group.length}`);
      await expectMetric(card, '正答率', '未算出');
      await expect(card).not.toContainText('0%');
    }

    await page.getByRole('button', { name: 'ホームへ戻る' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
  });

  test('guarantees mixed progress preserves section order and ready insufficient unstarted indicators', async ({
    page,
    request,
  }) => {
    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(groups[0].length).toBeGreaterThanOrEqual(3);
    expect(groups[1].length).toBeGreaterThanOrEqual(1);

    const progress: Record<string, ProgressEntry> = {
      [groups[0][0].id]: progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
      [groups[0][1].id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
      [groups[0][2].id]: progressEntry({
        seenCount: 1,
        correctCount: 0,
        wrongCount: 1,
        wrongReasonTags: ['concept-behavior-gap'],
      }),
      [groups[1][0].id]: progressEntry({
        seenCount: 2,
        correctCount: 1,
        wrongCount: 1,
        wrongReasonTags: ['careless-mistake'],
      }),
    };

    await seedStorage(page, progress);
    await openAnalysis(page);

    const overall = overallSummary(page);
    await expect(overall).toContainText('回答履歴を基に学習状況を集計');
    await expectMetric(overall, '回答済み問題数', `4 / ${groups.flat().length}`);
    await expectMetric(overall, '累計解答数', '6');
    await expectMetric(overall, '正答数', '3');
    await expectMetric(overall, '誤答数', '3');
    await expectMetric(overall, '正答率', '50%');
    await expectMetric(overall, '誤答理由タグ付き問題数', '2');

    const cards = sectionSummaries(page);
    await expect(cards).toHaveCount(groups.length);
    await expect(cards.getByRole('heading')).toHaveText(
      groups.map((group) => `Section ${group[0].section}：${group[0].sectionTitle}`)
    );

    const ready = cards.nth(0);
    await expect(ready).toContainText('回答履歴を基に学習状況を集計');
    await expectMetric(ready, '回答済み問題数', `3 / ${groups[0].length}`);
    await expectMetric(ready, '正答率', '50%');
    await expectMetric(ready, '誤答理由タグ付き問題数', '1');

    const insufficient = cards.nth(1);
    await expect(insufficient).toContainText('参考値');
    await expectMetric(insufficient, '回答済み問題数', `1 / ${groups[1].length}`);
    await expectMetric(insufficient, '正答率', '50%');
    await expect(metric(insufficient, '正答率').locator('dd.analysis-metric__note')).toHaveText(
      '累計解答数ベースで算出しています。'
    );
    await expectMetric(insufficient, '誤答理由タグ付き問題数', '1');

    const unstarted = cards.nth(2);
    await expect(unstarted).toContainText('回答履歴がまだない');
    await expectMetric(unstarted, '回答済み問題数', `0 / ${groups[2].length}`);
    await expectMetric(unstarted, '正答率', '未算出');
  });
});

test.describe('[DEP][DATA] Analysis / Storage immutability', () => {
  test('guarantees inconsistent progress remains unmodified while analysis shows unresolved counts', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Storage string immutability is asserted once on the desktop Chromium project.'
    );

    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups[0].length).toBeGreaterThanOrEqual(1);
    const inconsistentQuestion = groups[0][0];
    const progress: Record<string, ProgressEntry> = {
      [inconsistentQuestion.id]: progressEntry({ seenCount: 3, correctCount: 3, wrongCount: 1 }),
    };

    await seedStorage(page, progress);
    await gotoDepHome(page);
    const before = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      storageKeys
    );

    await page.getByRole('button', { name: '弱点を分析' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();

    const overall = overallSummary(page);
    await expect(overall).toContainText('参考値');
    await expectMetric(overall, '回答済み問題数', `1 / ${groups.flat().length}`);
    await expectMetric(overall, '累計解答数', '3');
    await expectMetric(overall, '正答数', '3');
    await expectMetric(overall, '誤答数', '1');
    await expectMetric(overall, '正答率', '未算出');
    await expect(metric(overall, '正答率').locator('dd.analysis-metric__note')).toHaveText(
      '記録の不整合により率を判定できません。'
    );

    const card = sectionSummaries(page).nth(0);
    await expect(card).toContainText('参考値');
    await expectMetric(card, '回答済み問題数', `1 / ${groups[0].length}`);
    await expectMetric(card, '累計解答数', '3');
    await expectMetric(card, '正答数', '3');
    await expectMetric(card, '誤答数', '1');
    await expectMetric(card, '正答率', '未算出');
    await expect(metric(card, '正答率').locator('dd.analysis-metric__note')).toHaveText(
      '記録の不整合により率を判定できません。'
    );

    await page.getByRole('button', { name: 'ホームへ戻る' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    const after = await page.evaluate(
      (keys) => keys.map((key) => localStorage.getItem(key)),
      storageKeys
    );
    expect(after).toEqual(before);
  });
});
