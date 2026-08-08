import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { gotoDepHome } from './helpers';

type Question = {
  id: string;
  section: string;
  variantGroup?: string;
  followUp?: { questionId: string };
};

type ProgressEntry = {
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  lastAnsweredAt: string | null;
  bookmark: boolean;
  note: string;
  noteText: string;
  noteUpdatedAt: string | null;
  wrongReasonTags: string[];
  wrongReasonUpdatedAt: string | null;
};

const IDS = ['DEP-Q292', 'DEP-Q293', 'DEP-Q294'] as const;
const VARIANT_IDS = IDS.slice(0, 2);
const SETTINGS = { sections: ['2'], mode: 'normal', count: 'all' };
const CONFIDENCE_HISTORY = JSON.stringify({ version: 1, attempts: [] });

async function loadQuestions(request: APIRequestContext) {
  const response = await request.get('/dep-quiz-app/questions.json');
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Question[];
}

async function getRepresentativeQuestions(request: APIRequestContext) {
  const questions = await loadQuestions(request);
  const representatives = IDS.map((id) => questions.find((question) => question.id === id));
  expect(representatives.every(Boolean)).toBe(true);
  const [variantA, variantB] = representatives as Question[];
  expect(variantA.variantGroup).toBe('auto-loader-state-locations');
  expect(variantB.variantGroup).toBe('auto-loader-state-locations');
  expect(variantA.followUp?.questionId).toBe('DEP-Q294');
  return representatives as Question[];
}

function progressEntry(overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  const seenCount = overrides.seenCount ?? 0;
  return {
    seenCount,
    correctCount: overrides.correctCount ?? 0,
    wrongCount: overrides.wrongCount ?? 0,
    lastAnsweredAt: seenCount ? '2026-08-08T00:00:00.000Z' : null,
    bookmark: overrides.bookmark ?? false,
    note: overrides.note ?? '',
    noteText: overrides.noteText ?? overrides.note ?? '',
    noteUpdatedAt: overrides.noteUpdatedAt ?? null,
    wrongReasonTags: overrides.wrongReasonTags ?? [],
    wrongReasonUpdatedAt: overrides.wrongReasonUpdatedAt ?? null,
  };
}

async function seedStorage(page: Page, progress: Record<string, ProgressEntry>) {
  await page.addInitScript(
    ({ progress, settings, confidenceHistory }) => {
      if (sessionStorage.getItem('depVariantSessionSeeded')) return;
      localStorage.clear();
      localStorage.setItem('depQuizProgress', JSON.stringify(progress));
      localStorage.setItem('depQuizSettings', JSON.stringify(settings));
      localStorage.setItem('depQuizConfidenceHistory', confidenceHistory);
      sessionStorage.setItem('depVariantSessionSeeded', 'true');
    },
    { progress, settings: SETTINGS, confidenceHistory: CONFIDENCE_HISTORY }
  );
}

async function getActiveSession(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null'));
}

async function startConfiguredSession(page: Page, mode: string) {
  await gotoDepHome(page);
  if (mode === 'notesOnly') {
    await page.getByRole('button', { name: 'メモあり問題を復習' }).click();
  } else {
    await page.locator(`input[name="mode"][value="${mode}"]`).check();
    await page.getByRole('button', { name: '開始' }).click();
  }
  await expect(page.locator('#quiz-view')).toBeVisible();
  return getActiveSession(page);
}

function expectCollapsed(order: string[], included: string, excluded: string) {
  expect(order).toContain(included);
  expect(order).not.toContain(excluded);
  expect(
    order.filter((id) => VARIANT_IDS.includes(id as (typeof VARIANT_IDS)[number]))
  ).toHaveLength(1);
}

async function verifyEligibilityFirst(
  page: Page,
  request: APIRequestContext,
  mode: string,
  selected: Partial<ProgressEntry>
) {
  await getRepresentativeQuestions(request);
  await seedStorage(page, {
    'DEP-Q292': progressEntry(selected),
    'DEP-Q293': progressEntry(),
  });
  const session = await startConfiguredSession(page, mode);
  expectCollapsed(session.order, 'DEP-Q292', 'DEP-Q293');
}

test.describe('[DEP][FLOW] Variant session / Cross-mode selection', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium-focused variant coverage.');
  });

  test('guarantees normal session selects the least-seen representative and keeps follow-up target ordinary', async ({
    page,
    request,
  }) => {
    await getRepresentativeQuestions(request);
    await seedStorage(page, {
      'DEP-Q292': progressEntry({ seenCount: 5 }),
      'DEP-Q293': progressEntry({ seenCount: 1 }),
    });
    const session = await startConfiguredSession(page, 'normal');
    expect(session.mode).toBe('normal');
    expectCollapsed(session.order, 'DEP-Q293', 'DEP-Q292');
    expect(session.order).toContain('DEP-Q294');
  });

  test('guarantees random session keeps one least-seen representative before order randomization', async ({
    page,
    request,
  }) => {
    await getRepresentativeQuestions(request);
    await seedStorage(page, {
      'DEP-Q292': progressEntry({ seenCount: 5 }),
      'DEP-Q293': progressEntry({ seenCount: 1 }),
    });
    const session = await startConfiguredSession(page, 'random');
    expect(session.mode).toBe('random');
    expectCollapsed(session.order, 'DEP-Q293', 'DEP-Q292');
  });

  test('guarantees wrong-only eligibility is applied before variant selection', async ({
    page,
    request,
  }) => {
    await verifyEligibilityFirst(page, request, 'wrongOnly', { wrongCount: 1, seenCount: 5 });
  });

  test('guarantees bookmark-only eligibility is applied before variant selection', async ({
    page,
    request,
  }) => {
    await verifyEligibilityFirst(page, request, 'bookmarks', { bookmark: true, seenCount: 5 });
  });

  test('guarantees notes-only eligibility is applied before variant selection', async ({
    page,
    request,
  }) => {
    await verifyEligibilityFirst(page, request, 'notesOnly', {
      note: 'variant review',
      noteText: 'variant review',
      seenCount: 5,
    });
  });

  test('guarantees weakness review target list and session share the collapsed variant candidates', async ({
    page,
    request,
  }) => {
    await getRepresentativeQuestions(request);
    await seedStorage(page, {
      'DEP-Q292': progressEntry({ seenCount: 5 }),
      'DEP-Q293': progressEntry({ seenCount: 1 }),
    });
    await gotoDepHome(page);
    await page.getByRole('button', { name: '弱点を分析' }).click();
    await page.locator('.analysis-sections.analysis-disclosure > summary').click();
    const sectionCard = page.locator('.analysis-section-card').filter({ hasText: 'Section 2' });
    await sectionCard.getByRole('button', { name: 'このSectionの問題を見る' }).click();
    const panel = page.locator('#weakness-review-targets-panel');
    const displayedIds = (
      await panel.locator('.weakness-review-target-item__id').allTextContents()
    ).map((text) => text.replace('問題ID:', '').trim());
    expectCollapsed(displayedIds, 'DEP-Q293', 'DEP-Q292');
    await panel.getByRole('button', { name: 'この条件で復習する' }).click();
    expect((await getActiveSession(page)).order).toEqual(displayedIds);
  });
});

test.describe('[DEP][DATA] Variant session / Persistence', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium-focused variant coverage.');
  });

  test('guarantees suspended variant session resumes the same selected order after reload', async ({
    page,
    request,
  }) => {
    await getRepresentativeQuestions(request);
    await seedStorage(page, {
      'DEP-Q292': progressEntry({ seenCount: 5 }),
      'DEP-Q293': progressEntry({ seenCount: 1 }),
    });
    const initial = await startConfiguredSession(page, 'normal');
    await page.getByRole('button', { name: '中断してホームへ' }).click();
    await page.reload();
    await page.getByRole('button', { name: '続きから再開' }).click();
    const resumed = await getActiveSession(page);
    expect(resumed.order).toEqual(initial.order);
    expect(resumed.currentIndex).toBe(initial.currentIndex);
    expectCollapsed(resumed.order, 'DEP-Q293', 'DEP-Q292');
  });

  test('guarantees legacy same-group active session restores without automatic dedupe', async ({
    page,
    request,
  }) => {
    await getRepresentativeQuestions(request);
    await seedStorage(page, {});
    await startConfiguredSession(page, 'normal');
    await page.evaluate(
      (order) => {
        const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null');
        session.order = order;
        localStorage.setItem('depQuizActiveSession', JSON.stringify(session));
      },
      [...IDS]
    );
    await page.reload();
    await page.getByRole('button', { name: '続きから再開' }).click();
    expect((await getActiveSession(page)).order).toEqual([...IDS]);
  });

  test('guarantees variant session creation preserves progress and confidence history storage', async ({
    page,
    request,
  }) => {
    await getRepresentativeQuestions(request);
    await seedStorage(page, {
      'DEP-Q292': progressEntry({ seenCount: 5 }),
      'DEP-Q293': progressEntry({ seenCount: 1 }),
    });
    await gotoDepHome(page);
    const before = await page.evaluate(() => ({
      progress: localStorage.getItem('depQuizProgress'),
      confidence: localStorage.getItem('depQuizConfidenceHistory'),
    }));
    await page.getByRole('button', { name: '開始' }).click();
    const after = await page.evaluate(() => ({
      progress: localStorage.getItem('depQuizProgress'),
      confidence: localStorage.getItem('depQuizConfidenceHistory'),
      keys: Object.keys(localStorage),
    }));
    expect(after.progress).toBe(before.progress);
    expect(after.confidence).toBe(before.confidence);
    expect(after.keys.filter((key) => /variant/i.test(key))).toEqual([]);
    expect((await getActiveSession(page)).schemaVersion).toBe(2);
  });
});
