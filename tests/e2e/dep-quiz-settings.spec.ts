import { test, expect } from '@playwright/test';
import { gotoDepHome } from './helpers';

test.describe('[DEP][DATA] Quiz settings / Session filters', () => {
  test('guarantees question count setting limits active session order length', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await gotoDepHome(page);
    await page.locator('#question-count').selectOption('10');
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    const session = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null')
    );

    expect(session).toBeTruthy();
    expect(session.order).toHaveLength(10);
  });

  test('guarantees section filter limits active session to the selected section', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only coverage.');

    await gotoDepHome(page);

    const checkboxes = page.locator('#section-checkboxes input[type="checkbox"]');
    const firstSection = await checkboxes.first().getAttribute('value');
    expect(firstSection).toBeTruthy();

    const total = await checkboxes.count();
    for (let i = 0; i < total; i += 1) {
      const box = checkboxes.nth(i);
      const value = await box.getAttribute('value');
      if (value === firstSection) await box.check();
      else await box.uncheck();
    }

    await page.locator('#question-count').selectOption('10');
    await page.getByRole('button', { name: '開始' }).click();
    await expect(page.locator('#quiz-view')).toBeVisible();

    const { sessionOrder, questionSectionMap } = await page.evaluate(async () => {
      const session = JSON.parse(localStorage.getItem('depQuizActiveSession') ?? 'null');
      const questions = await fetch('./questions.json').then((res) => res.json());
      const map: Record<string, string> = {};
      for (const q of questions) map[q.id] = q.section;
      return {
        sessionOrder: session?.order ?? [],
        questionSectionMap: map,
      };
    });

    expect(sessionOrder.length).toBeGreaterThan(0);
    for (const id of sessionOrder as string[]) {
      expect(questionSectionMap[id]).toBe(firstSection);
    }
  });
});
