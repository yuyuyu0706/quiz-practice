import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { answerCurrentQuestion, startDeaPlusQuiz } from './helpers';

// Keep this fixture aligned with the current DEA Plus question schema.
// It intentionally avoids Phase 2-only fields such as whyWrong or multiple answers.
// Update this fixture when the question schema is extended.
// The fixed route data keeps Markdown rendering coverage stable without depending on
// dea-quiz-app-plus/questions.json content changes. The fixture is also checked by
// scripts/validate-dea-plus-e2e-fixtures.mjs to catch schema or Markdown coverage drift.
const markdownQuestions = JSON.parse(
  readFileSync(new URL('./fixtures/dea-plus-markdown-questions.json', import.meta.url), 'utf8')
);

async function mockDeaPlusQuestions(page: Page) {
  await page.route('**/dea-quiz-app-plus/questions.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(markdownQuestions),
    });
  });
}

test.describe('[DEA][UI] Markdown / Plus rendering', () => {
  test('guarantees DEA Plus markdown renders inline code and code fences', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop-only markdown DOM coverage.');

    await mockDeaPlusQuestions(page);
    await startDeaPlusQuiz(page, 'all');

    const questionInlineCode = page.locator('#quiz-question .inline-code');
    await expect(questionInlineCode).toHaveText('SELECT');
    await expect(page.locator('#quiz-question')).not.toContainText('`SELECT`');

    const questionCodeBlock = page.locator('#quiz-question .code-block.lang-sql code.language-sql');
    await expect(questionCodeBlock).toHaveText('SELECT * FROM samples');
    await expect(questionCodeBlock.locator('xpath=ancestor::pre')).toHaveClass(/\bcode-block\b/);

    const choiceInlineCode = page.locator('#choices-form .inline-code', { hasText: 'SELECT' });
    await expect(choiceInlineCode).toHaveCount(1);
    await expect(page.locator('#choices-form')).not.toContainText('`SELECT`');

    const choiceCodeBlock = page.locator(
      '#choices-form .code-block.lang-python code.language-python'
    );
    await expect(choiceCodeBlock).toHaveText('print("x")');

    await answerCurrentQuestion(page);

    await expect(page.locator('#explanation p')).toContainText('SELECT はSQLの基本です。');
    await expect(page.locator('#explanation strong')).toContainText('重要');
    await expect(page.locator('#explanation ul.explanation-list li')).toHaveCount(2);
    await expect(
      page.locator('#explanation .code-block.lang-python code.language-python')
    ).toHaveText('spark.sql("SELECT 1")');
  });
});
