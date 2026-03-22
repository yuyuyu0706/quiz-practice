import { expect, type Page } from '@playwright/test';

export async function gotoDeaHome(page: Page) {
  await page.goto('/dea-quiz-app/');
  await expect(page.getByRole('heading', { name: 'Databricks DEA 練習問題' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '学習設定' })).toBeVisible();
}

export async function startQuiz(page: Page, count: '10' | '20' | '50' | 'all' = '10') {
  await gotoDeaHome(page);
  await page.locator('#question-count').selectOption(count);
  await page.getByRole('button', { name: '開始' }).click();
  await expect(page.locator('#quiz-view')).toBeVisible();
  await expect(page.locator('#quiz-progress')).toContainText(/1\s*\/\s*/);
}

export async function answerCurrentQuestion(page: Page) {
  await expect(page.locator('#choices-form label')).toHaveCount(4);
  await page.locator('#choices-form label').first().click();
  await expect(page.getByRole('button', { name: '回答する' })).toBeEnabled();
  await page.getByRole('button', { name: '回答する' }).click();
  await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
  await expect(page.locator('#explanation')).toBeVisible();
}
