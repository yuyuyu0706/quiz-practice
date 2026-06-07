import { expect, test, type Page } from '@playwright/test';

import { answerCurrentQuestion, startDeaPlusQuiz } from './helpers';

// Keep this fixture aligned with the current DEA Plus question schema.
// It intentionally avoids Phase 2-only fields such as whyWrong or multiple answers.
// Update this fixture when the question schema is extended.
// The fixed route data keeps Markdown rendering coverage stable without depending on
// dea-quiz-app-plus/questions.json content changes.
const markdownQuestions = [
  {
    id: 'MD001',
    section: '1',
    sectionTitle: 'Markdown E2E',
    question: 'Databricks SQLで `SELECT` を確認します。\n```sql\nSELECT * FROM samples\n```',
    choices: {
      A: '`SELECT` は行を取得する',
      B: '通常のテキスト',
      C: 'Python例\n```python\nprint("x")\n```',
      D: '通常の補足テキスト',
    },
    answer: 'A',
    explanation:
      '**重要**: `SELECT` はSQLの基本です。\n\n- inline codeを確認\n- list renderingを確認\n\n```python\nspark.sql("SELECT 1")\n```',
    references: [
      {
        title: 'Markdown E2E fixture reference',
        url: 'https://example.com/markdown-e2e-fixture',
      },
    ],
  },
];

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
