import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { startDeaPlusQuiz } from './helpers';

// Fixed route data keeps whyWrong UI coverage independent from
// dea-quiz-app-plus/questions.json until real question content is updated in a later phase.
const whyWrongQuestions = JSON.parse(
  readFileSync(new URL('./fixtures/dea-plus-why-wrong-questions.json', import.meta.url), 'utf8')
);

async function mockDeaPlusQuestions(page: Page) {
  await page.route('**/dea-quiz-app-plus/questions.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(whyWrongQuestions),
    });
  });
}

async function startWhyWrongQuiz(page: Page) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.addInitScript(() => {
    const values = [0.3, 0.4, 0.1];
    let index = 0;
    Math.random = () => values[index++ % values.length];
  });
  await mockDeaPlusQuestions(page);
  await startDeaPlusQuiz(page, 'all');
}

async function answerByChoiceText(page: Page, choiceText: string) {
  await page.locator('#choices-form label', { hasText: choiceText }).click();
  await expect(page.getByRole('button', { name: '回答する' })).toBeEnabled();
  await page.getByRole('button', { name: '回答する' }).click();
  await expect(page.locator('#result-indicator')).toContainText(/正解|不正解/);
  await expect(page.locator('#explanation')).toBeVisible();
}

async function getDisplayedChoiceTextByLabel(page: Page) {
  return page.locator('#choices-form label').evaluateAll((labels) =>
    Object.fromEntries(
      labels.map((label) => {
        const text = (label.textContent ?? '').trim().replace(/\s+/g, ' ');
        const match = text.match(/^([A-E])\.\s*(.*)$/);
        return [match?.[1] ?? '', match?.[2] ?? ''];
      })
    )
  );
}

async function getWhyWrongTitleTextByLabel(page: Page) {
  return page.locator('.why-wrong-label').evaluateAll((labels) =>
    Object.fromEntries(
      labels.map((label) => {
        const text = (label.textContent ?? '').trim().replace(/\s+/g, ' ');
        const match = text.match(/^([A-E])\.\s*(.*)$/);
        return [match?.[1] ?? '', match?.[2] ?? ''];
      })
    )
  );
}

async function expectAllWhyWrongEntries(page: Page) {
  const panel = page.locator('.why-wrong-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: '各選択肢が違う理由' })).toBeVisible();
  await expect(panel.locator('.why-wrong-item')).toHaveCount(3);

  const labels = panel.locator('.why-wrong-label');
  await expect(labels.nth(0)).toHaveText('A. Delta Sharingの受信者設定');
  await expect(labels.nth(1)).toHaveText('C. ノートブックのバージョン管理機能');
  await expect(labels.nth(2)).toHaveText('D. Unity Catalogのメタストアそのもの');

  await expect(panel.locator('.why-wrong-body .inline-code')).toHaveText('Unity Catalog');
  await expect(panel.locator('.why-wrong-body strong')).toHaveText('Delta Sharing');
  await expect(panel).toContainText('ノートブックのバージョン管理とは用途が異なります。');
}

test.describe('[DEA][UI] Explanation / Why wrong', () => {
  test('guarantees DEA Plus shows all whyWrong entries after a wrong answer', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only whyWrong DOM coverage.');

    await startWhyWrongQuiz(page);
    await expect(page.locator('.why-wrong-panel')).toHaveCount(0);

    await answerByChoiceText(page, 'Unity Catalogのメタストアそのもの');

    await expect(page.locator('#result-indicator')).toContainText('不正解');
    await expectAllWhyWrongEntries(page);
  });

  test('guarantees DEA Plus shows all whyWrong entries after a correct answer', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only whyWrong DOM coverage.');

    await startWhyWrongQuiz(page);
    await expect(page.locator('.why-wrong-panel')).toHaveCount(0);

    await answerByChoiceText(page, 'SQLクエリ実行に使うコンピュートリソース');

    await expect(page.locator('#result-indicator')).toContainText('正解');
    await expectAllWhyWrongEntries(page);
  });

  test('guarantees DEA Plus keeps whyWrong aligned with shuffled choices', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only whyWrong DOM coverage.');

    await startWhyWrongQuiz(page);
    await answerByChoiceText(page, 'Unity Catalogのメタストアそのもの');

    const displayedChoices = await getDisplayedChoiceTextByLabel(page);
    const whyWrongChoices = await getWhyWrongTitleTextByLabel(page);

    expect(displayedChoices).toMatchObject({
      A: 'Delta Sharingの受信者設定',
      B: 'SQLクエリ実行に使うコンピュートリソース',
      C: 'ノートブックのバージョン管理機能',
      D: 'Unity Catalogのメタストアそのもの',
    });
    expect(whyWrongChoices).toEqual({
      A: displayedChoices.A,
      C: displayedChoices.C,
      D: displayedChoices.D,
    });

    const items = page.locator('.why-wrong-item');
    await expect(items.nth(0)).toContainText('Delta Sharing はデータ共有機能です。');
    await expect(items.nth(1)).toContainText('ノートブックのバージョン管理とは用途が異なります。');
    await expect(items.nth(2)).toContainText(
      'Unity Catalog はガバナンス機能であり、SQL Warehouseそのものではありません。'
    );
  });

  test('guarantees DEA Plus hides whyWrong panel when entries are missing', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only whyWrong DOM coverage.');

    await startWhyWrongQuiz(page);
    await answerByChoiceText(page, 'SQLクエリ実行に使うコンピュートリソース');
    await page.getByRole('button', { name: '次へ' }).first().click();
    await expect(page.locator('#quiz-question')).toContainText('WW002');

    await answerByChoiceText(page, '正答');

    await expect(page.locator('#explanation')).toContainText('通常の解説のみを表示します。');
    await expect(page.locator('.why-wrong-panel')).toHaveCount(0);
  });
});
