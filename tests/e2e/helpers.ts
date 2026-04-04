import { expect, type Page } from '@playwright/test';

async function gotoHome(page: Page, app: 'dea' | 'dep') {
  await page.goto(`/${app}-quiz-app/`);

  if (app === 'dea') {
    await expect(page.getByRole('heading', { name: 'Databricks DEA 練習問題' })).toBeVisible();
  } else {
    await expect(page.getByRole('heading', { name: 'Databricks Certified DEP 練習問題' })).toBeVisible();
  }

  await expect(page.getByRole('heading', { name: '学習設定' })).toBeVisible();
}

async function startQuizInternal(
  page: Page,
  app: 'dea' | 'dep',
  count: '10' | '20' | '50' | 'all' = '10',
) {
  await gotoHome(page, app);
  await page.locator('#question-count').selectOption(count);
  await page.getByRole('button', { name: '開始' }).click();
  await expect(page.locator('#quiz-view')).toBeVisible();
  await expect(page.locator('#quiz-progress')).toContainText(/1\s*\/\s*/);
}

export async function gotoDeaHome(page: Page) {
  await gotoHome(page, 'dea');
}

export async function gotoDepHome(page: Page) {
  await gotoHome(page, 'dep');
}

export async function startQuiz(page: Page, count: '10' | '20' | '50' | 'all' = '10') {
  await startQuizInternal(page, 'dea', count);
}

export async function startDepQuiz(page: Page, count: '10' | '20' | '50' | 'all' = 'all') {
  await startQuizInternal(page, 'dep', count);
}

export async function answerCurrentQuestion(page: Page) {
  await expect(page.locator('#choices-form label')).toHaveCount(4);
  await page.locator('#choices-form label').first().click();
  await expect(page.getByRole('button', { name: '回答する' })).toBeEnabled();
  await page.getByRole('button', { name: '回答する' }).click();
  await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
  await expect(page.locator('#explanation')).toBeVisible();
}
