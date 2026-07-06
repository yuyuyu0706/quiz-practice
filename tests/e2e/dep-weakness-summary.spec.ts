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

function activeSessionFixture(questionId: string) {
  return {
    schemaVersion: 1,
    app: 'dep-quiz-app',
    order: [questionId],
    currentIndex: 0,
    answers: {},
    choiceMap: {},
    graded: {},
    completedAt: null,
    explanationOpen: false,
    mode: 'normal',
    startedAt: '2026-07-04T00:00:00.000Z',
    settingsSnapshot: { ...defaultSettings, mode: 'normal' },
  };
}

function storageSnapshot(progress: Record<string, ProgressEntry>, sessionFixture: unknown = null) {
  return [
    JSON.stringify(progress),
    JSON.stringify(defaultSettings),
    JSON.stringify(sessionFixture),
  ];
}

async function seedStorage(
  page: Page,
  progress: Record<string, ProgressEntry>,
  sessionFixture: unknown = null
) {
  const expectedStorage = storageSnapshot(progress, sessionFixture);
  await page.addInitScript(
    ({ keys, expected }) => {
      localStorage.clear();
      keys.forEach((key, index) => localStorage.setItem(key, expected[index]));
    },
    { keys: storageKeys, expected: expectedStorage }
  );
  return expectedStorage;
}

async function expectStorageSnapshot(page: Page, expectedStorage: string[]) {
  const actual = await page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    storageKeys
  );
  expect(actual).toEqual(expectedStorage);
}

async function openAnalysis(page: Page) {
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  await expect(page.locator('#analysis-view')).toBeVisible();
}

function overallSummary(page: Page) {
  return page.locator('section[aria-labelledby="analysis-summary-title"]');
}

function sectionDetails(page: Page) {
  return page.locator('.analysis-sections.analysis-disclosure');
}

function sectionDetailSummary(page: Page) {
  return sectionDetails(page).locator('summary');
}

function sectionSummaries(page: Page) {
  return page.locator('.analysis-section-card');
}

async function expandSectionDetails(page: Page) {
  const details = sectionDetails(page);
  await expect(details).not.toHaveAttribute('open', '');
  await sectionDetailSummary(page).click();
  await expect(details).toHaveAttribute('open', '');
}

function tagSummary(page: Page) {
  return page.locator('[aria-labelledby="analysis-tags-title"]');
}

function focusSummary(page: Page) {
  return page.locator('[aria-labelledby="analysis-focus-title"]');
}

function focusCard(summary: Locator, heading: string) {
  return summary
    .locator('.analysis-focus-card')
    .filter({ has: summary.page().getByRole('heading', { name: heading }) })
    .first();
}

function tagItem(summary: Locator, label: string) {
  return summary
    .locator('.analysis-tag-item')
    .filter({ has: summary.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .first();
}

async function expectTagCount(summary: Locator, label: string, value: string) {
  await expect(tagItem(summary, label).locator('dd.analysis-tag-item__count')).toHaveText(value);
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

async function expectMetricLabelsNotToContain(summary: Locator, text: string) {
  const labels = await summary.locator('.analysis-metric__label').allTextContents();
  expect(labels).not.toContain(text);
}

async function expectNoHorizontalOverflow(page: Page) {
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    analysisClientWidth: document.querySelector('#analysis-view')?.clientWidth ?? 0,
    analysisScrollWidth: document.querySelector('#analysis-view')?.scrollWidth ?? 0,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  expect(viewport.analysisScrollWidth).toBeLessThanOrEqual(viewport.analysisClientWidth);
}

async function expectGridColumnCount(locator: Locator, expectedColumns: number) {
  await expect(locator).toBeVisible();
  const columns = await locator.evaluate((element) =>
    getComputedStyle(element)
      .gridTemplateColumns.split(' ')
      .filter((column) => column.trim().length > 0)
  );
  expect(columns).toHaveLength(expectedColumns);
}

async function expectDesktopGridColumnCount(page: Page, locator: Locator, expectedColumns: number) {
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  if (viewportWidth < 769) return;
  await expectGridColumnCount(locator, expectedColumns);
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
    await expectMetric(overall, '正答率 ※', '未算出');
    await expect(overall).not.toContainText('0%');

    const tags = tagSummary(page);
    await tags.locator('summary').click();
    await expect(tags).toContainText('誤答理由はまだ記録されていません');
    await expectTagCount(tags, 'ケアレスミス', '0問');
    await expectTagCount(tags, '概念・挙動がイメージできない', '0問');

    const focus = focusSummary(page);
    await focus.locator('summary').click();
    await expect(focus).toContainText(
      '回答履歴がないため、優先して見直すSectionや誤答理由はまだ判定しません。'
    );
    await expect(focus.locator('.analysis-focus-card')).toHaveCount(0);

    await expandSectionDetails(page);

    const cards = sectionSummaries(page);
    await expect(cards).toHaveCount(groups.length);
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const card = cards.nth(index);
      await expect(card.getByRole('heading')).toHaveAttribute(
        'aria-label',
        `Section ${group[0].section}：${group[0].sectionTitle}`
      );
      await expect(card).toContainText('回答履歴がまだない');
      await expectMetric(card, '回答済み問題数', `0 / ${group.length}`);
      await expectMetric(card, '正答率 ※', '未算出');
      await expect(card).not.toContainText('0%');
    }

    await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
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
    await expectMetric(overall, '正答率 ※', '50%');
    await expectMetric(overall, '理由タグ問題数', '2');
    await expectMetricLabelsNotToContain(overall, '誤答理由タグ付き問題数');
    await expectDesktopGridColumnCount(page, overall.locator('.analysis-metrics'), 6);

    const tags = tagSummary(page);
    await tags.locator('summary').click();
    await expect(tags).toContainText('誤答した問題で記録した理由を、タグ別に集計しています。');
    await expectTagCount(tags, 'ケアレスミス', '1問');
    await expectTagCount(tags, '概念・挙動がイメージできない', '1問');
    await expectTagCount(tags, '用語・機能の意味を混同した', '0問');
    await expect(tags).toContainText('タグ別件数の合計は理由タグ問題数と一致しない場合があります');

    const focus = focusSummary(page);
    await focus.locator('summary').click();
    await expect(focus).toContainText('分析結果から、次に見直す候補を表示しています。');

    const sectionFocus = focusCard(focus, '優先して見直すSection');
    await expect(sectionFocus.locator('.analysis-focus-card__target')).toHaveText(
      `Section ${groups[0][0].section}：${groups[0][0].sectionTitle}`
    );
    await expectMetric(sectionFocus, '回答済み問題数', '3');
    await expectMetric(sectionFocus, '累計解答数', '4');
    await expectMetric(sectionFocus, '誤答数', '2');
    await expectMetric(sectionFocus, '正答率 ※', '50%');
    await expect(sectionFocus).toContainText('誤答数が最も多い領域です');

    const tagFocus = focusCard(focus, '最も多く記録された誤答理由');
    await expect(tagFocus.locator('.analysis-focus-card__target')).toHaveText(
      '概念・挙動がイメージできない'
    );
    await expectMetric(tagFocus, '理由タグ問題数', '1問');
    await expect(tagFocus).toContainText('記録済みの理由の中で、最も多いパターンです。');

    await expandSectionDetails(page);

    const cards = sectionSummaries(page);
    await expect(cards).toHaveCount(groups.length);
    await expect(
      cards
        .getByRole('heading')
        .evaluateAll((headings) => headings.map((heading) => heading.getAttribute('aria-label')))
    ).resolves.toEqual(
      groups.map((group) => `Section ${group[0].section}：${group[0].sectionTitle}`)
    );
    await expect(cards.nth(0).locator('.analysis-section-card__pin')).toHaveText(
      `Section ${groups[0][0].section}`
    );
    await expect(cards.nth(0).locator('.analysis-section-card__name')).toHaveText(
      groups[0][0].sectionTitle ?? ''
    );

    const ready = cards.nth(0);
    await expect(ready).toContainText('回答履歴を基に学習状況を集計');
    await expectMetric(ready, '回答済み問題数', `3 / ${groups[0].length}`);
    await expectMetric(ready, '正答率 ※', '50%');
    await expectMetric(ready, '理由タグ問題数', '1');
    await expectMetricLabelsNotToContain(ready, '誤答理由タグ付き問題数');
    await expectDesktopGridColumnCount(page, ready.locator('.analysis-metrics'), 3);

    const insufficient = cards.nth(1);
    await expect(insufficient).toContainText('参考値');
    await expectMetric(insufficient, '回答済み問題数', `1 / ${groups[1].length}`);
    await expectMetric(insufficient, '正答率 ※', '50%');
    await expect(insufficient.locator('.analysis-accuracy-footnote')).toHaveText(
      '※ 正答率は累計解答数ベースで算出しています。'
    );
    await expectMetric(insufficient, '理由タグ問題数', '1');

    const unstarted = cards.nth(2);
    await expect(unstarted).toContainText('回答履歴がまだない');
    await expectMetric(unstarted, '回答済み問題数', `0 / ${groups[2].length}`);
    await expectMetric(unstarted, '正答率 ※', '未算出');
  });

  test('guarantees analysis prioritizes focus and reveals section details on demand', async ({
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

    await expect(
      page
        .locator('#analysis-container > *')
        .evaluateAll((regions) => regions.map((region) => region.getAttribute('aria-labelledby')))
    ).resolves.toEqual([
      'analysis-summary-title',
      'analysis-focus-title',
      'analysis-tags-title',
      'analysis-sections-title',
    ]);

    const details = sectionDetails(page);
    await expect(details).not.toHaveAttribute('open', '');
    await expect(sectionDetailSummary(page)).toContainText('Section別サマリ');
    await expect(sectionSummaries(page).first()).not.toBeVisible();

    await sectionDetailSummary(page).click();
    await expect(details).toHaveAttribute('open', '');

    const cards = sectionSummaries(page);
    await expect(cards).toHaveCount(groups.length);
    await expect(cards.first()).toBeVisible();
    await expect(
      cards
        .getByRole('heading')
        .evaluateAll((headings) => headings.map((heading) => heading.getAttribute('aria-label')))
    ).resolves.toEqual(
      groups.map((group) => `Section ${group[0].section}：${group[0].sectionTitle}`)
    );
    await expect(cards.nth(0).locator('.analysis-section-card__pin')).toHaveText(
      `Section ${groups[0][0].section}`
    );
    await expect(cards.nth(0).locator('.analysis-section-card__name')).toHaveText(
      groups[0][0].sectionTitle ?? ''
    );
    await expectMetric(cards.nth(0), '回答済み問題数', `3 / ${groups[0].length}`);
    await expectMetric(cards.nth(0), '累計解答数', '4');
    await expectMetric(cards.nth(0), '正答率 ※', '50%');
    await expectDesktopGridColumnCount(page, cards.nth(0).locator('.analysis-metrics'), 3);

    await sectionDetailSummary(page).click();
    await expect(details).not.toHaveAttribute('open', '');
    await expect(cards.first()).not.toBeVisible();

    await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await page.getByRole('button', { name: '弱点を分析' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();
    await expect(sectionDetails(page)).not.toHaveAttribute('open', '');
    await expect(sectionSummaries(page).first()).not.toBeVisible();
  });

  test('guarantees analysis disclosures return paths and accuracy footnotes remain usable', async ({
    page,
    request,
  }) => {
    const groups = groupQuestionsBySection(await loadQuestions(request));
    const progress: Record<string, ProgressEntry> = {
      [groups[0][0].id]: progressEntry({ seenCount: 2, correctCount: 1, wrongCount: 1 }),
      [groups[0][1].id]: progressEntry({
        seenCount: 1,
        correctCount: 0,
        wrongCount: 1,
        wrongReasonTags: ['concept-behavior-gap'],
      }),
      [groups[0][2].id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
      [groups[1][0].id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
    };

    await seedStorage(page, progress);
    await openAnalysis(page);

    const disclosures = page.locator('.analysis-disclosure');
    await expect(disclosures).toHaveCount(3);
    await expect(
      disclosures.evaluateAll((items) => items.every((item) => !item.hasAttribute('open')))
    ).resolves.toBe(true);
    await expect(page.getByRole('button', { name: '← ホームへ戻る' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ホームへ戻る', exact: true })).toBeVisible();

    await expectMetric(overallSummary(page), '正答率 ※', '60%');
    await expect(overallSummary(page).locator('.analysis-accuracy-footnote')).toHaveText(
      '※ 正答率は累計解答数ベースで算出しています。'
    );
    await expect(metric(overallSummary(page), '正答率 ※')).not.toContainText(
      '累計解答数ベースで算出しています。'
    );
    await expect(overallSummary(page).locator('.analysis-metric__note')).toHaveCount(0);

    const focusSummaryElement = focusSummary(page).locator('summary');
    await focusSummaryElement.focus();
    await page.keyboard.press('Enter');
    await expect(focusSummary(page)).toHaveAttribute('open', '');
    await expect(focusCard(focusSummary(page), '優先して見直すSection')).toBeVisible();
    await expect(focusSummary(page).locator('.analysis-accuracy-footnote')).toHaveText(
      '※ 正答率は累計解答数ベースで算出しています。'
    );
    await page.keyboard.press('Space');
    await expect(focusSummary(page)).not.toHaveAttribute('open', '');

    for (const summary of [tagSummary(page).locator('summary'), sectionDetailSummary(page)]) {
      const height = await summary.evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
      await summary.click();
    }
    await expect(tagSummary(page)).toHaveAttribute('open', '');
    await expect(sectionDetails(page)).toHaveAttribute('open', '');
    await expect(
      sectionSummaries(page).first().locator('.analysis-accuracy-footnote')
    ).toBeVisible();

    await page.getByRole('button', { name: '← ホームへ戻る' }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await page.getByRole('button', { name: '弱点を分析' }).click();
    await expect(disclosures).toHaveCount(3);
    await expect(
      disclosures.evaluateAll((items) => items.every((item) => !item.hasAttribute('open')))
    ).resolves.toBe(true);
  });

  test('guarantees mobile analysis keeps compact grids without horizontal overflow', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Mobile analysis layout is asserted only on the Pixel 5 mobile-chrome project.'
    );

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
    await expectNoHorizontalOverflow(page);

    const overall = overallSummary(page);
    await expect(overall).toContainText('回答履歴を基に学習状況を集計');
    await expectMetric(overall, '回答済み問題数', `4 / ${groups.flat().length}`);
    await expectMetric(overall, '正答率 ※', '50%');
    await expectGridColumnCount(overall.locator('.analysis-metrics'), 2);

    const focus = focusSummary(page);
    await focus.locator('summary').click();
    await expect(focus).toContainText('分析結果から、次に見直す候補を表示しています。');
    await expectGridColumnCount(focus.locator('.analysis-focus-list'), 1);
    await expectGridColumnCount(
      focusCard(focus, '優先して見直すSection').locator('.analysis-focus-metrics'),
      2
    );
    await expect(
      focusCard(focus, '最も多く記録された誤答理由').locator('.analysis-metric')
    ).toHaveCSS('grid-column-start', '1');
    await expect(
      focusCard(focus, '最も多く記録された誤答理由').locator('.analysis-metric')
    ).toHaveCSS('grid-column-end', '-1');

    const tags = tagSummary(page);
    await tags.locator('summary').click();
    await expectTagCount(tags, 'ケアレスミス', '1問');
    await expectTagCount(tags, '概念・挙動がイメージできない', '1問');
    await expectGridColumnCount(tags.locator('.analysis-tag-list'), 2);

    const details = sectionDetails(page);
    await expect(details).not.toHaveAttribute('open', '');
    await expect(sectionSummaries(page).first()).not.toBeVisible();
    await expectNoHorizontalOverflow(page);

    await expandSectionDetails(page);
    await expectGridColumnCount(page.locator('.analysis-section-list'), 1);

    const cards = sectionSummaries(page);
    await expect(cards).toHaveCount(groups.length);
    await expect(cards.first()).toBeVisible();
    await expectMetric(cards.nth(0), '回答済み問題数', `3 / ${groups[0].length}`);
    await expectMetric(cards.nth(0), '正答率 ※', '50%');
    await expectGridColumnCount(cards.nth(0).locator('.analysis-metrics'), 2);
    await expectNoHorizontalOverflow(page);
  });

  test('shows section not-enough-data guidance when overall is ready but every section is insufficient', async ({
    page,
    request,
  }) => {
    const groups = groupQuestionsBySection(await loadQuestions(request));
    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(groups[0].length).toBeGreaterThanOrEqual(1);
    expect(groups[1].length).toBeGreaterThanOrEqual(1);
    expect(groups[2].length).toBeGreaterThanOrEqual(1);

    const progress: Record<string, ProgressEntry> = {
      [groups[0][0].id]: progressEntry({
        seenCount: 1,
        correctCount: 0,
        wrongCount: 1,
        wrongReasonTags: ['careless-mistake'],
      }),
      [groups[1][0].id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
      [groups[2][0].id]: progressEntry({ seenCount: 1, correctCount: 1, wrongCount: 0 }),
    };

    await seedStorage(page, progress);
    await openAnalysis(page);

    const overall = overallSummary(page);
    await expect(overall).toContainText('回答履歴を基に学習状況を集計');
    await expectMetric(overall, '回答済み問題数', `3 / ${groups.flat().length}`);
    await expectMetric(overall, '累計解答数', '3');
    await expectMetric(overall, '正答数', '2');
    await expectMetric(overall, '誤答数', '1');
    await expectMetric(overall, '正答率 ※', '67%');
    await expectMetric(overall, '理由タグ問題数', '1');

    const tags = tagSummary(page);
    await tags.locator('summary').click();
    await expect(tags).toContainText('誤答した問題で記録した理由を、タグ別に集計しています。');
    await expectTagCount(tags, 'ケアレスミス', '1問');
    await expectTagCount(tags, '概念・挙動がイメージできない', '0問');

    const focus = focusSummary(page);
    await focus.locator('summary').click();
    await expect(focus).toContainText('分析結果から、次に見直す候補を表示しています。');

    const sectionFocus = focusCard(focus, '優先して見直すSection');
    await expect(sectionFocus.locator('.analysis-focus-card__target')).toHaveText(
      '重点Sectionはまだ表示しません'
    );
    await expect(sectionFocus).toContainText(
      'Sectionごとの回答済み問題数が少ないため、重点Sectionはまだ表示しません。'
    );
    await expect(sectionFocus).not.toContainText('重点Sectionを準備できません');

    const tagFocus = focusCard(focus, '最も多く記録された誤答理由');
    await expect(tagFocus.locator('.analysis-focus-card__target')).toHaveText('ケアレスミス');
    await expectMetric(tagFocus, '理由タグ問題数', '1問');

    await expandSectionDetails(page);

    const cards = sectionSummaries(page);
    await expect(cards).toHaveCount(groups.length);
    for (let index = 0; index < 3; index += 1) {
      await expect(cards.nth(index)).toContainText('参考値');
      await expectMetric(cards.nth(index), '回答済み問題数', `1 / ${groups[index].length}`);
    }
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
    const sessionFixture = activeSessionFixture(inconsistentQuestion.id);
    const expectedStorage = await seedStorage(page, progress, sessionFixture);

    await gotoDepHome(page);
    await expectStorageSnapshot(page, expectedStorage);

    await page.getByRole('button', { name: '弱点を分析' }).click();
    await expect(page.locator('#analysis-view')).toBeVisible();
    await expectStorageSnapshot(page, expectedStorage);

    const overall = overallSummary(page);
    await expect(overall).toContainText('参考値');
    await expectMetric(overall, '回答済み問題数', `1 / ${groups.flat().length}`);
    await expectMetric(overall, '累計解答数', '3');
    await expectMetric(overall, '正答数', '3');
    await expectMetric(overall, '誤答数', '1');
    await expectMetric(overall, '正答率 ※', '未算出');
    await expect(overall.locator('.analysis-accuracy-footnote')).toHaveText(
      '※ 正答率は記録の不整合により率を判定できません。'
    );

    await expandSectionDetails(page);

    const card = sectionSummaries(page).nth(0);
    await expect(card).toContainText('参考値');
    await expectMetric(card, '回答済み問題数', `1 / ${groups[0].length}`);
    await expectMetric(card, '累計解答数', '3');
    await expectMetric(card, '正答数', '3');
    await expectMetric(card, '誤答数', '1');
    await expectMetric(card, '正答率 ※', '未算出');
    await expect(card.locator('.analysis-accuracy-footnote')).toHaveText(
      '※ 正答率は記録の不整合により率を判定できません。'
    );

    await page.getByRole('button', { name: 'ホームへ戻る', exact: true }).click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expectStorageSnapshot(page, expectedStorage);
  });
});
