import { test, expect, type Page } from '@playwright/test';
import { gotoDepHome } from './helpers';

const NOW = '2026-08-02T12:00:00.000Z';
type Attempt = {
  attemptId: string;
  questionId: string;
  section: string;
  result: 'correct' | 'wrong';
  confidence: 'high' | 'medium' | 'low';
  answeredAt: string;
};

function attempt(
  attemptId: string,
  questionId: string,
  section: string,
  result: Attempt['result'],
  confidence: Attempt['confidence'],
  answeredAt: string
): Attempt {
  return { attemptId, questionId, section, result, confidence, answeredAt };
}

const canonicalAttempts: Attempt[] = [
  attempt('a1', 'unknown-change-question', '1', 'wrong', 'high', '2026-08-01T10:00:00.000Z'),
  attempt('a2', 'unknown-change-question', '1', 'correct', 'high', '2026-08-01T11:00:00.000Z'),
  attempt('a3', 'continued-review', '1', 'wrong', 'low', '2026-08-01T12:00:00.000Z'),
  attempt('a4', 'continued-review', '1', 'wrong', 'medium', '2026-08-01T13:00:00.000Z'),
  attempt('a5', 'section-two-old', '2', 'correct', 'low', '2026-07-20T12:00:00.000Z'),
  attempt('a6', 'section-two-old', '2', 'correct', 'high', '2026-07-20T13:00:00.000Z'),
  attempt('a7', 'ninety-days-only', '3', 'correct', 'medium', '2026-06-03T12:00:00.000Z'),
  attempt('a8', 'all-only', '4', 'wrong', 'medium', '2025-01-01T12:00:00.000Z'),
];

async function openHistory(
  page: Page,
  history: unknown = { version: 1, attempts: canonicalAttempts }
) {
  await page.clock.setFixedTime(new Date(NOW));
  await page.addInitScript((storedHistory) => {
    localStorage.clear();
    localStorage.setItem('depQuizProgress', '{}');
    localStorage.setItem('depQuizConfidenceHistory', JSON.stringify(storedHistory));
    localStorage.setItem(
      'depQuizSettings',
      JSON.stringify({ sections: ['1'], mode: 'normal', count: '10' })
    );
    localStorage.setItem('depQuizActiveSession', JSON.stringify(null));
  }, history);
  await gotoDepHome(page);
  await page.getByRole('button', { name: '弱点を分析' }).click();
  const historyPanel = page.locator('.analysis-confidence-history');
  await historyPanel.locator('summary').click();
  return historyPanel;
}

function metric(panel: ReturnType<Page['locator']>, label: string) {
  return panel.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd[1]').first();
}

test.describe('[DEP][UI] Analysis / Confidence history', () => {
  test('uses a fixed asOf and supports every canonical period', async ({ page }) => {
    const panel = await openHistory(page);
    const period = panel.locator('[data-history-period]');
    await expect(period).toHaveValue('30d');
    await expect(metric(panel, '回答試行数')).toHaveText('6件');
    for (const [value, count] of [
      ['7d', '4件'],
      ['90d', '7件'],
      ['all', '8件'],
    ]) {
      await period.selectOption(value);
      await expect(period).toHaveValue(value);
      await expect(metric(panel, '回答試行数')).toHaveText(count);
    }
  });

  test('retains a selected Section as a zero-count option when a period removes it', async ({
    page,
  }) => {
    const panel = await openHistory(page);
    const section = panel.locator('[data-history-section]');
    await section.selectOption('2');
    await expect(metric(panel, '回答試行数')).toHaveText('2件');
    await panel.locator('[data-history-period]').selectOption('7d');
    await expect(section).toHaveValue('2');
    await expect(section.locator('option:checked')).toHaveText('Section 2（0件）');
    await expect(metric(panel, '回答試行数')).toHaveText('0件');
    await expect(panel.locator('[data-history-coverage]')).toHaveAttribute(
      'data-history-coverage',
      'none'
    );
  });

  test('renders empty, repaired-quality, capacity, and unsupported states safely', async ({
    page,
  }) => {
    let panel = await openHistory(page, { version: 1, attempts: [] });
    await expect(metric(panel, '試行ベース正答率')).toHaveText('未算出');

    await page.reload();
    panel = await openHistory(page, { version: 1, attempts: [{ invalid: true }] });
    await expect(panel.locator('[data-history-quality="repaired"]')).toContainText('1件');

    const capacity = Array.from({ length: 5000 }, (_, index) =>
      attempt(
        `capacity-${index}`,
        `q-${index}`,
        '1',
        'correct',
        'medium',
        '2026-08-01T10:00:00.000Z'
      )
    );
    await page.reload();
    panel = await openHistory(page, { version: 1, attempts: capacity });
    await expect(panel).toContainText('保持上限5000件に到達');

    await page.reload();
    panel = await openHistory(page, { version: 2, attempts: canonicalAttempts });
    await expect(panel.locator('[data-history-status="unsupported"]')).toContainText('Version 2');
    await expect(panel.locator('select')).toHaveCount(0);
  });

  test('shows multiple change badges, continued Review, and unknown-question fallback', async ({
    page,
  }) => {
    const panel = await openHistory(page);
    const event = panel.locator('.analysis-confidence-history__list li').first();
    await expect(event.locator('.analysis-confidence-history__badges span')).toHaveCount(2);
    await expect(event).toContainText('誤った自信を修正');
    await expect(event).toContainText('要確認から安定理解へ');
    await expect(event).toContainText('現在の問題データに問題文がありません。');
    await expect(panel).toContainText('連続Review 2回');
  });

  test('limits change events and continued Review questions to the latest 20', async ({ page }) => {
    const many: Attempt[] = [];
    for (let index = 0; index < 21; index += 1) {
      const day = String(index + 1).padStart(2, '0');
      many.push(
        attempt(
          `w-${index}`,
          `change-${index}`,
          '1',
          'wrong',
          'high',
          `2026-07-${day}T10:00:00.000Z`
        )
      );
      many.push(
        attempt(
          `c-${index}`,
          `change-${index}`,
          '1',
          'correct',
          'high',
          `2026-07-${day}T11:00:00.000Z`
        )
      );
      many.push(
        attempt(
          `r1-${index}`,
          `review-${index}`,
          '1',
          'wrong',
          'low',
          `2026-07-${day}T12:00:00.000Z`
        )
      );
      many.push(
        attempt(
          `r2-${index}`,
          `review-${index}`,
          '1',
          'wrong',
          'medium',
          `2026-07-${day}T13:00:00.000Z`
        )
      );
    }
    const panel = await openHistory(page, { version: 1, attempts: many });
    await panel.locator('[data-history-period]').selectOption('all');
    const lists = panel.locator('.analysis-confidence-history__list');
    await expect(lists.nth(0).locator('li')).toHaveCount(20);
    await expect(lists.nth(1).locator('li')).toHaveCount(20);
    await expect(panel).toContainText('最新20件 / 全21件');
  });

  test('preserves focus, disclosure state, storage, and keyboard operation', async ({ page }) => {
    const panel = await openHistory(page);
    const e4 = page.locator('.analysis-confidence-summary');
    await e4.locator('summary').click();
    const before = await page.evaluate(() =>
      Object.fromEntries(
        [
          'depQuizProgress',
          'depQuizConfidenceHistory',
          'depQuizSettings',
          'depQuizActiveSession',
        ].map((key) => [key, localStorage.getItem(key)])
      )
    );
    const section = panel.locator('[data-history-section]');
    await section.focus();
    await section.selectOption('1');
    await expect(section).toBeFocused();
    await expect(e4).toHaveJSProperty('open', true);
    await expect(panel).toHaveJSProperty('open', true);
    await expect(panel.locator('[role="status"]')).toHaveText('確信度の学習履歴を更新しました。');
    expect(
      await page.evaluate(() =>
        Object.fromEntries(
          [
            'depQuizProgress',
            'depQuizConfidenceHistory',
            'depQuizSettings',
            'depQuizActiveSession',
          ].map((key) => [key, localStorage.getItem(key)])
        )
      )
    ).toEqual(before);
    await panel.locator('summary').focus();
    await panel.locator('summary').press('Enter');
    await expect(panel).toHaveJSProperty('open', false);
    await panel.locator('summary').press('Space');
    await expect(panel).toHaveJSProperty('open', true);
  });

  test('has no horizontal overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openHistory(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      )
    ).toBe(true);
  });
});
