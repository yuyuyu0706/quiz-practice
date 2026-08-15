import { expect, test, type Page } from '@playwright/test';

const TOOL_URL = '/tools/dep-question-authoring/';
const GROUP_ID = 'auto-loader-state-locations';

async function openRepresentativeGroup(page: Page) {
  await page.goto(TOOL_URL);
  await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
  const groupButton = page.locator('#groups button', { hasText: GROUP_ID });
  await expect(groupButton).toContainText('2');
  await groupButton.click();
  await expect(page.locator('#comparison h2')).toContainText(`${GROUP_ID} 2 members`);
}

async function openInspector(page: Page) {
  await page.locator('#inspector-panel > summary').click();
  await expect(page.locator('#inspector-panel')).toHaveAttribute('open', '');
}

function memberCard(page: Page, questionId: string) {
  return page.locator('#comparison article', {
    has: page.getByRole('heading', { name: questionId }),
  });
}

async function completeVariantForm(page: Page, id: string, groupId?: string) {
  const form = page.locator('#question-form');
  await form.locator('[name="id"]').fill(id);
  await form.locator('[name="question"]').fill('A different authoring perspective?');
  await form.locator('[name="answer"]').selectOption('C');
  await form.locator('[name="explanation"]').fill('A derived explanation.');
  if (groupId !== undefined) await form.locator('[name="newGroupId"]').fill(groupId);
  for (const checkbox of await form.locator('.confirmation-list input').all()) {
    await checkbox.check();
  }
  return form;
}

test.describe('[DEP][UI] Question Preview / Review', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The local authoring tool is Chromium-only.');
  });

  test('reviews complete working Question content without adding learner inputs', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q292');
    await page.locator('[data-question-id="DEP-Q292"]').click();
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
    await page.getByRole('button', { name: 'Preview / Review' }).click();

    const review = page.locator('.question-review');
    await expect(review).toContainText('QUESTION PREVIEW / REVIEW');
    await expect(review).toContainText('Correct Answer');
    await expect(review).toContainText('Explanation');
    await expect(review).toContainText('Metadata');
    await expect(review).toContainText('References');
    await expect(review).toContainText(GROUP_ID);
    await expect(review).toContainText('Global PASS');
    await expect(review).toContainText('Unchanged');
    await expect(review.locator('input, select, textarea')).toHaveCount(0);
    await expect(page.locator('#dirty')).toBeHidden();
    await expect(page.locator('#export')).toBeEnabled();
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
  });

  test('shows field-level working diff and supports Review to Edit', async ({ page }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    await page.getByRole('button', { name: 'Edit Question' }).click();
    await page.locator('#question-form [name="question"]').fill('Modified for review?');
    await page.getByRole('button', { name: 'Save Question' }).click();
    await page.getByRole('button', { name: 'Preview / Review' }).click();
    await expect(page.locator('.question-review')).toContainText('Modified');
    await expect(page.locator('.changed-fields')).toContainText('question');
    await page.getByRole('button', { name: 'Edit Question' }).click();
    await expect(page.locator('#question-form [name="question"]')).toHaveValue(
      'Modified for review?'
    );
  });

  test('keeps Review active across catalog selection and bridges grouped relations', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q29');
    await page.locator('[data-question-id="DEP-Q292"]').click();
    await page.getByRole('button', { name: 'Preview / Review' }).click();
    await page.locator('[data-question-id="DEP-Q293"]').click();
    await expect(page.locator('.question-review h2')).toHaveText('DEP-Q293');
    await page.getByRole('button', { name: 'Open group in Variant Management' }).click();
    await expect(page.locator('#variant-tab')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#comparison h2')).toContainText(GROUP_ID);
  });

  test('reconciles New Question Review through Reset', async ({ page }) => {
    await page.goto(TOOL_URL);
    await page.getByRole('button', { name: 'Create Question', exact: true }).first().click();
    const form = page.locator('#question-form');
    await form.locator('[name="id"]').fill('DEP-Q999-REVIEW');
    await form.locator('[name="question"]').fill('New review question?');
    for (const key of ['A', 'B', 'C', 'D']) {
      await form.locator(`[name="choice-${key}"]`).fill(`Choice ${key}`);
    }
    await form.locator('[name="answer"]').selectOption('A');
    await form.locator('[name="explanation"]').fill('Review explanation.');
    await form.getByRole('button', { name: 'Create Question' }).click();
    await page.getByRole('button', { name: 'Preview / Review' }).click();
    await expect(page.locator('.question-review')).toContainText('New');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#reset').click();
    await expect(page.locator('.question-review')).toHaveCount(0);
    await expect(page.locator('#question-detail')).toContainText('QUESTION DETAIL');
  });

  test('shows canonical same-choice failure as a related error for a grouped Question', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q292');
    await page.locator('[data-question-id="DEP-Q292"]').click();
    const questionCount = await page.locator('#catalog-count').textContent();
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));

    await page.getByRole('button', { name: 'Edit Question' }).click();
    await page.locator('#question-form [name="choice-A"]').fill('A changed grouped choice');
    await page.getByRole('button', { name: 'Save Question' }).click();
    await expect(page.locator('#validation-status')).toContainText('FAIL');
    await page.getByRole('button', { name: 'Preview / Review' }).click();

    const validationReview = page.locator('.validation-review');
    await expect(validationReview).toContainText('Global FAIL');
    await expect(validationReview).toContainText('Related errors (1)');
    await expect(validationReview).toContainText('must use the same choice text multiset');
    await expect(page.locator('#catalog-count')).toHaveText(questionCount ?? '');
    await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
    await expect(page.locator('#export')).toBeDisabled();
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);

    await page.getByRole('button', { name: 'Back to Detail' }).click();
    await expect(page.locator('#validation-status')).toContainText('FAIL');
    await expect(page.locator('#catalog-count')).toHaveText(questionCount ?? '');
    await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
  });

  test('keeps Global FAIL when only another Question has a canonical error', async ({ page }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q292');
    await page.locator('[data-question-id="DEP-Q292"]').click();
    await page.getByRole('button', { name: 'Edit Question' }).click();
    await page.locator('#question-form [name="choice-A"]').fill('A changed grouped choice');
    await page.getByRole('button', { name: 'Save Question' }).click();
    await expect(page.locator('#validation-status')).toContainText('FAIL');

    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
    await page.getByRole('button', { name: 'Preview / Review' }).click();

    const validationReview = page.locator('.validation-review');
    await expect(validationReview).toContainText('Global FAIL');
    await expect(validationReview).toContainText('Related errors (0)');
    await expect(validationReview).toContainText(
      'No related errors. Global validation status remains authoritative.'
    );
    await expect(validationReview).not.toContainText('Global PASS');
    await expect(page.locator('#export')).toBeDisabled();
    await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
  });

  test('exports the working Questions while PASS Review remains open without review state', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    await page.getByRole('button', { name: 'Edit Question' }).click();
    await page.locator('#question-form [name="question"]').fill('Exported from open Review?');
    await page.getByRole('button', { name: 'Save Question' }).click();
    await expect(page.locator('#validation-status')).toContainText('PASS');
    const questionCount = await page.locator('#catalog-count').textContent();
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));

    await page.getByRole('button', { name: 'Preview / Review' }).click();
    await expect(page.locator('.validation-review')).toContainText('Global PASS');
    await expect(page.locator('#export')).toBeEnabled();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadPromise;
    const exported = JSON.parse(
      await (await download.createReadStream()).toArray().then(Buffer.concat).then(String)
    );

    expect(exported.find((question: { id: string }) => question.id === 'DEP-Q201').question).toBe(
      'Exported from open Review?'
    );
    expect(exported).toHaveLength(Number.parseInt(questionCount?.split(' / ')[1] ?? '', 10));
    expect(JSON.stringify(exported)).not.toContain('reviewState');
    await expect(page.locator('.question-review')).toBeVisible();
    await expect(page.locator('#catalog-count')).toHaveText(questionCount ?? '');
    await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
    await expect(page.locator('#validation-status')).toContainText('PASS');
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
  });
});

test.describe('[DEP][UI] Question Catalog and authoring shell', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The local authoring tool is Chromium-only.');
  });

  test('loads the complete catalog by default and supports read-only search and detail', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await expect(page.locator('#catalog-tab')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#catalog-workspace')).toBeVisible();
    await expect(page.locator('#variant-workspace')).toBeHidden();
    const total = await page.locator('#catalog-list [data-question-id]').count();
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('#catalog-count')).toHaveText(`${total} / ${total} questions`);
    await expect(page.locator('#question-detail')).toContainText('QUESTION DETAIL');
    await expect(page.locator('.future-actions button')).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Preview / Review' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Edit Question' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Clone Question' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Create Variant', exact: true })).toBeEnabled();

    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
    await page.locator('#catalog-search').fill('DEP-Q292');
    await expect(page.locator('#catalog-list [data-question-id]')).toHaveCount(1);
    await expect(page.locator('#catalog-count')).toHaveText(`1 / ${total} questions`);
    await expect(page.locator('#dirty')).toBeHidden();
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
  });

  test('creates and edits Questions through an isolated draft', async ({ page }) => {
    await page.goto(TOOL_URL);
    const originalCount = await page.locator('#catalog-list [data-question-id]').count();
    await page.getByRole('button', { name: 'Create Question', exact: true }).click();
    await expect(page.locator('#dirty')).toBeHidden();
    await expect(page.locator('#export')).toBeDisabled();
    const form = page.locator('#question-form');
    await form.locator('[name="id"]').fill('DEP-Q999');
    await form.locator('[name="section"]').selectOption('10');
    await form.locator('[name="question"]').fill('Created question?');
    for (const key of ['A', 'B', 'C', 'D']) {
      await form.locator(`[name="choice-${key}"]`).fill(`Choice ${key}`);
    }
    await form.locator('[name="answer"]').selectOption('B');
    await form.locator('[name="explanation"]').fill('Created explanation');
    await form.getByRole('button', { name: 'Create Question' }).click();
    await expect(page.locator('#question-detail h2')).toHaveText('DEP-Q999');
    await expect(page.locator('#question-detail .meta').first()).toContainText(
      'Section 10 · Data Modelling'
    );
    await expect(page.locator('#dirty')).toBeVisible();
    await expect(page.locator('#catalog-count')).toContainText(`${originalCount + 1}`);

    await page.getByRole('button', { name: 'Edit Question' }).click();
    await expect(form.locator('[name="id"]')).toBeVisible();
    await expect(page.locator('#question-form [name="id"]')).toHaveAttribute('readonly', '');
    await page.locator('#question-form [name="question"]').fill('Edited question?');
    await page.getByRole('button', { name: 'Save Question' }).click();
    await expect(page.locator('#question-detail')).toContainText('Edited question?');
  });

  test('clones editable fields into an independent Question without relations', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q292');
    await page.locator('[data-question-id="DEP-Q292"]').click();
    await page.getByRole('button', { name: 'Clone Question' }).click();
    const form = page.locator('#question-form');
    await expect(form).toContainText('variantGroup / followUpは継承されません');
    await expect(form).not.toContainText('same-choice契約を壊す可能性');
    await expect(form.locator('[name="id"]')).toHaveValue('');
    await form.locator('[name="id"]').fill('DEP-Q999-CLONE');
    await form.getByRole('button', { name: 'Create Clone' }).click();
    await expect(page.locator('#question-detail h2')).toHaveText('DEP-Q999-CLONE');
    await expect(page.locator('#question-detail .relation-detail')).toContainText('Ungrouped');
    await expect(page.locator('#dirty')).toBeVisible();
  });

  test('creates a grouped Variant with locked choices and explicit confirmations', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q292');
    await page.locator('[data-question-id="DEP-Q292"]').click();
    await page.getByRole('button', { name: 'Create Variant', exact: true }).click();
    const form = page.locator('#question-form');
    await expect(form.locator('[name="choice-A"]')).toHaveAttribute('readonly', '');
    await expect(form.locator('[name="answer"]')).toHaveValue('');
    await expect(form).toContainText(GROUP_ID);
    await form.locator('[name="id"]').fill('DEP-Q999-VARIANT');
    await form.locator('[name="question"]').fill('A different question?');
    await form.locator('[name="answer"]').selectOption('B');
    await form.locator('[name="explanation"]').fill('A new explanation.');
    await form.getByRole('button', { name: 'Create Variant' }).click();
    await expect(form.getByText('すべての条件を確認してください。')).toBeVisible();
    for (const checkbox of await form.locator('.confirmation-list input').all()) {
      await checkbox.check();
    }
    await form.getByRole('button', { name: 'Create Variant' }).click();
    await expect(page.locator('#question-detail h2')).toHaveText('DEP-Q999-VARIANT');
    await expect(page.locator('#question-detail .relation-detail')).toContainText(GROUP_ID);
    await expect(page.locator('#validation-status')).toContainText('PASS');
  });

  test('creates a new group atomically for an ungrouped Variant', async ({ page }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    await page.getByRole('button', { name: 'Create Variant', exact: true }).click();
    const form = page.locator('#question-form');
    await expect(form.locator('[name="newGroupId"]')).toBeVisible();
    await form.locator('[name="id"]').fill('DEP-Q999-UNGROUPED-VARIANT');
    await form.locator('[name="question"]').fill('A new perspective?');
    await form.locator('[name="answer"]').selectOption('C');
    await form.locator('[name="explanation"]').fill('New explanation.');
    await form.locator('[name="newGroupId"]').fill('new-authoring-group');
    for (const checkbox of await form.locator('.confirmation-list input').all()) {
      await checkbox.check();
    }
    await form.getByRole('button', { name: 'Create Variant' }).click();
    await expect(page.locator('#question-detail .relation-detail')).toContainText(
      'new-authoring-group'
    );
  });

  test('rejects a whitespace-padded New Group Name without partial mutation', async ({ page }) => {
    await page.goto(TOOL_URL);
    const totalBefore = (await page.locator('#catalog-count').textContent())?.split(' / ')[1];
    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    await page.getByRole('button', { name: 'Create Variant', exact: true }).click();
    const form = await completeVariantForm(page, 'DEP-Q999-WHITESPACE', ' padded-group ');

    await form.getByRole('button', { name: 'Create Variant' }).click();

    await expect(page.locator('#form-error-summary')).toHaveText(
      'Group ID must not have leading or trailing whitespace.'
    );
    await expect(form).toBeVisible();
    await expect(page.locator('#dirty')).toBeHidden();
    await expect(page.locator('#catalog-count')).toHaveText(`1 / ${totalBefore}`);
    await expect(page.locator('#export')).toBeDisabled();

    page.once('dialog', (dialog) => dialog.accept());
    await form.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('#question-detail .relation-detail')).toContainText('Ungrouped');
    await page.locator('#catalog-search').fill('DEP-Q999-WHITESPACE');
    await expect(page.locator('#catalog-list [data-question-id]')).toHaveCount(0);
  });

  test('guards touched Clone and Create Variant drafts without changing working Questions', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    const countBefore = await page.locator('#catalog-count').textContent();
    await page.getByRole('button', { name: 'Clone Question' }).click();
    await page.locator('#question-form [name="id"]').fill('DEP-Q999-GUARDED-CLONE');
    await expect(page.locator('#export')).toBeDisabled();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
    await expect(page.locator('#question-form')).toBeVisible();
    await expect(page.locator('#dirty')).toBeHidden();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Create Variant', exact: true }).click();
    await page.locator('#question-form [name="id"]').fill('DEP-Q999-GUARDED-VARIANT');
    await expect(page.locator('#export')).toBeDisabled();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
    await expect(page.locator('#variant-workspace')).toBeVisible();
    await expect(page.locator('#dirty')).toBeHidden();
    await page.getByRole('button', { name: 'QUESTION CATALOG' }).click();
    await expect(page.locator('#catalog-count')).toHaveText(countBefore ?? '');
  });

  test('Reset removes a derived Question and restores its source relation', async ({ page }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    await page.getByRole('button', { name: 'Create Variant', exact: true }).click();
    const form = await completeVariantForm(page, 'DEP-Q999-RESET', 'reset-derived-group');
    await form.getByRole('button', { name: 'Create Variant' }).click();
    await expect(page.locator('#question-detail .relation-detail')).toContainText(
      'reset-derived-group'
    );

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#reset').click();
    await expect(page.locator('#dirty')).toBeHidden();
    await page.locator('#catalog-search').fill('DEP-Q999-RESET');
    await expect(page.locator('#catalog-list [data-question-id]')).toHaveCount(0);
    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    await expect(page.locator('#question-detail .relation-detail')).toContainText('Ungrouped');
  });

  test('guards touched drafts and keeps working data unchanged when discard is cancelled', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.getByRole('button', { name: 'Create Question', exact: true }).click();
    await page.locator('#question-form [name="id"]').fill('DEP-Q998');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
    await expect(page.locator('#question-form')).toBeVisible();
    await expect(page.locator('#catalog-workspace')).toBeVisible();
    await expect(page.locator('#dirty')).toBeHidden();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
    await expect(page.locator('#variant-workspace')).toBeVisible();
    await expect(page.locator('#dirty')).toBeHidden();
  });

  test('bridges grouped and ungrouped questions into Variant Management without mutation', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q292');
    await page.locator('[data-question-id="DEP-Q292"]').click();
    await page.getByRole('button', { name: 'Open group in Variant Management' }).click();
    await expect(page.locator('#variant-tab')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#comparison h2')).toContainText(GROUP_ID);
    await expect(page.locator('#comparison-panel')).toHaveAttribute('open', '');
    await expect(page.locator('#dirty')).toBeHidden();

    await page.locator('#catalog-tab').click();
    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    await page.getByRole('button', { name: 'Find in Create Variant Group' }).click();
    await expect(page.locator('#create-panel')).toHaveAttribute('open', '');
    await expect(page.locator('#create-search')).toHaveValue('DEP-Q201');
    await expect(page.locator('#create-list input:checked')).toHaveCount(0);
    await expect(page.locator('#candidate-seed')).toHaveValue('');
    await expect(page.locator('#dirty')).toBeHidden();
  });

  test('keeps catalog and authoring data unchanged during a workspace round trip', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q292');
    await page.locator('[data-question-id="DEP-Q292"]').click();

    const countBefore = await page.locator('#catalog-count').textContent();
    const validationBefore = await page.locator('#validation-status').textContent();
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
    await expect(page.locator('#question-detail h2')).toHaveText('DEP-Q292');
    await expect(page.locator('#dirty')).toBeHidden();

    await page.locator('#variant-tab').click();
    await expect(page.locator('#variant-workspace')).toBeVisible();
    await page.locator('#catalog-tab').click();

    await expect(page.locator('#catalog-workspace')).toBeVisible();
    await expect(page.locator('#catalog-count')).toHaveText(countBefore ?? '');
    await expect(page.locator('#catalog-list button.active')).toHaveAttribute(
      'data-question-id',
      'DEP-Q292'
    );
    await expect(page.locator('#question-detail h2')).toHaveText('DEP-Q292');
    await expect(page.locator('#validation-status')).toHaveText(validationBefore ?? '');
    await expect(page.locator('#dirty')).toBeHidden();
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
  });
});

test.describe('[DEP][UI] Question authoring / Variant Manager and Selection Inspector', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The local authoring tool is Chromium-only.');
  });

  test('guides first-time use and explains search, editing, validation, and export boundaries', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
    await expect(page.locator('#status')).toContainText(
      /読み込み完了: \d+ questions \/ \d+ variant groups/
    );
    await expect(page).toHaveTitle('DEP Question Authoring Tool');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('DEP Question Authoring Tool');
    await expect(page.getByText('はじめて使う方へ — Quick Start')).toBeVisible();
    await expect(page.locator('.groups-panel .help')).toContainText('空欄では全 Variant groups');
    await expect(page.locator('.groups-panel .help')).toContainText(
      'Question ID・問題本文・Group 名'
    );
    await expect(page.locator('#search')).toHaveAttribute('placeholder', /DEP-Q292/);
    await page.locator('#quick-start-title').click();
    const quickStart = page.locator('.quick-start');
    await expect(quickStart.locator('li')).toHaveCount(6);
    await expect(quickStart.locator('li').nth(5)).toContainText('dep-quiz-app/questions.json');
    await expect(quickStart.locator('li').nth(5)).toContainText('commit');
    await expect(quickStart.locator('li').nth(5)).toContainText('PR / mergeフロー');
    await expect(page.locator('.manual-panel')).toHaveCount(3);
    await expect(page.locator('#glossary')).not.toHaveAttribute('open', '');
    await page.locator('#glossary > summary').click();
    const glossary = page.locator('#glossary');
    await expect(glossary.locator('dt')).toHaveText([
      'バリアント問題',
      'Variant Group',
      'followUp',
    ]);
    await expect(glossary).toContainText('同じ選択肢を使い、問い方を変えた問題です。');
    await expect(glossary).toContainText('同じVariant Groupから最大1問を代表として採用します');
    await expect(glossary).toContainText('自動遷移そのものを意味しません');
    await page.locator('#error-help > summary').click();
    await expect(page.locator('#choice-multiset-help')).toContainText(
      'Variant Groupは、選択肢本文が一致している必要があります。'
    );
    const troubleshooting = page.locator('.troubleshooting-options');
    await expect(troubleshooting.locator('dt')).toHaveText([
      'Variant Groupとして扱いたい場合',
      'Variant Groupではなく類似問題としたい場合',
    ]);
    await expect(troubleshooting.locator('dd')).toHaveText([
      '同じ選択肢で、別の問題文（問い方）を作成してください。',
      'tagsで集約することを検討してください。',
    ]);
    await expect(page.locator('#choice-multiset-help')).not.toContainText('DEP-Q208');
    await expect(page.locator('#choice-multiset-help')).not.toContainText('DEP-Q226');
    await page.locator('#create-panel > summary').click();
    await expect(
      page.locator('#create-form').locator('..').getByText('新しい group')
    ).toBeVisible();
    await expect(page.locator('body')).not.toContainText(
      'Canonical validation が PASS の場合のみ Export できます。'
    );
    await expect(page.locator('body')).not.toContainText(
      'Reset はbrowser memory上の未export編集を破棄します。'
    );
    await expect(page.locator('body')).not.toContainText(
      'Export は download only で、元データを直接更新しません。'
    );
    await expect(page.locator('#reset')).toHaveAttribute(
      'title',
      'Browser memory上の未export編集を破棄します。'
    );
    await expect(page.locator('#export')).toHaveAttribute(
      'title',
      'Canonical validation が PASS の場合のみ Export できます。'
    );
  });

  test('presents the authoring workflow as exclusive accordions with global actions', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);
    const validationStatus = page.locator('#validation-status');
    await expect(page.locator('#validation')).not.toHaveAttribute('open', '');
    await expect(validationStatus).toBeVisible();
    await expect(validationStatus).toHaveText('Validation ✓ PASS · 0 errors');
    await expect(page.locator('#validation-result')).toBeVisible();
    await expect(page.locator('#validation-result')).toHaveText(
      'Result : OK — Canonical DEP validator found no errors.'
    );
    await expect(page.locator('#validation')).toBeHidden();
    const summaries = page.locator('.accordion > summary');
    await expect(summaries).toHaveText([
      '1. CREATE VARIANT GROUP',
      '2. MEMBER COMPARISON & EDIT',
      '3. SELECTION INSPECTOR',
    ]);
    await expect(page.locator('#comparison-panel')).toHaveAttribute('open', '');
    await page.locator('#inspector-panel > summary').click();
    await expect(page.locator('#comparison-panel')).not.toHaveAttribute('open', '');
    await expect(page.locator('#inspector-panel')).toHaveAttribute('open', '');
    await expect(page.locator('#inspector')).toContainText(
      'Variant Groupから1sessionに採用される問題は最大1問です。'
    );
    await expect(page.locator('#inspector')).toContainText(
      'どの問題が代表として選ばれるかを、本機能でシミュレーションできます。'
    );
    await expect(page.locator('#inspector')).not.toContainText('Browser memory内だけで行い');
    await expect(page.getByLabel('Session Mode（出題モード）')).toBeVisible();
    await expect(page.getByLabel('Target Section（出題対象Section）')).toBeVisible();
    await expect(page.locator('header #validation-status')).toBeVisible();
    await expect(page.locator('header #reset')).toBeVisible();
    await expect(page.locator('header #export')).toBeVisible();
    await expect(page.locator('.quick-start strong')).toHaveCount(6);
  });

  test('shows actionable 404 recovery and prevents authoring against unloaded data', async ({
    page,
  }) => {
    await page.route('**/dep-quiz-app/questions.json', (route) =>
      route.fulfill({ status: 404, body: 'not found' })
    );
    await page.goto(TOOL_URL);
    const status = page.locator('#catalog-status');
    await expect(page.locator('#catalog-workspace')).toBeVisible();
    await expect(status).toContainText('questions.json が見つかりません (404)');
    await expect(status).toContainText('npm run serve:dep-question-authoring');
    await expect(status).toContainText('http://127.0.0.1:4173/tools/dep-question-authoring/');
    await expect(status).toContainText('http://127.0.0.1:4173/dep-quiz-app/questions.json');
    await expect(page.locator('#catalog-search')).toBeDisabled();
    await expect(page.locator('#catalog-list')).toContainText('Questionを読み込めませんでした。');
    await expect(page.locator('#question-detail')).toContainText('Question Detailを表示できません');
    await expect(page.locator('.future-actions button')).toHaveCount(0);
    await expect(page.locator('#create-form button[type="submit"]')).toBeDisabled();
    await expect(page.locator('#reset')).toBeDisabled();
    await expect(page.locator('#export')).toBeDisabled();
  });

  test('rejects an empty questions payload and keeps authoring actions disabled', async ({
    page,
  }) => {
    await page.route('**/dep-quiz-app/questions.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto(TOOL_URL);

    const status = page.locator('#catalog-status');
    await expect(page.locator('#catalog-workspace')).toBeVisible();
    await expect(status).toContainText('questions.json の読み込みに失敗しました');
    await expect(status).toContainText('questions.json に利用可能な問題がありません。');
    await expect(status).not.toContainText('0 questions / 0 variant groups');
    await expect(page.locator('#catalog-search')).toBeDisabled();
    await expect(page.locator('#catalog-list')).toContainText('Questionを読み込めませんでした。');
    await expect(page.locator('#question-detail')).toContainText('Question Detailを表示できません');
    await expect(page.locator('.future-actions button')).toHaveCount(0);
    await expect(page.locator('#create-form button[type="submit"]')).toBeDisabled();
    await expect(page.locator('#reset')).toBeDisabled();
    await expect(page.locator('#export')).toBeDisabled();
  });

  test('guarantees production variant comparison, search, and read-only relations remain visible', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);

    await expect(memberCard(page, 'DEP-Q292').getByText('Choice text multiset')).toBeVisible();
    await expect(memberCard(page, 'DEP-Q292').getByText(/Follow-up:\s*DEP-Q294/)).toBeVisible();
    await expect(memberCard(page, 'DEP-Q293')).toBeVisible();
    const comparisonGuide = page.locator('.comparison-guide');
    await expect(comparisonGuide.locator('p')).toHaveCount(2);
    await expect(comparisonGuide.locator('li')).toHaveText([
      '問題本文・選択肢・正解・followUpを比較する',
      'Variant Groupのメンバーを追加・削除する',
      'Group Nameを変更する',
    ]);
    const relationshipMap = page.locator('.relationship-map');
    await expect(relationshipMap).toContainText('DEP-Q292');
    await expect(relationshipMap).toContainText('DEP-Q293');
    await expect(relationshipMap).toContainText('DEP-Q294');
    await expect(relationshipMap.locator('.relation-graph')).toHaveCount(1);
    await expect(relationshipMap.locator('.variant-relation')).toHaveAttribute(
      'aria-label',
      'Variant Group members: DEP-Q292, DEP-Q293'
    );
    await expect(relationshipMap.locator('.follow-up-relation')).toHaveAttribute(
      'aria-label',
      'DEP-Q292 followUp to DEP-Q294'
    );
    await expect(relationshipMap.locator('.relation-legend')).toHaveCount(0);

    await page.locator('#search').fill('DEP-Q293');
    await expect(page.locator('#groups button', { hasText: GROUP_ID })).toContainText('2');
    await expect(page.locator('#comparison h2')).toContainText('2 members');
  });

  test('guarantees Inspector selection modes use eligibility-first rules without persistence', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);
    await openInspector(page);
    const beforeStorage = await page.evaluate(() => JSON.stringify(localStorage));
    const inspector = page.locator('#inspector');
    const field = (id: string, name: string) =>
      inspector.locator(`[data-id="${id}"][data-field="${name}"]`);

    await field('DEP-Q292', 'seenCount').fill('5');
    await field('DEP-Q293', 'seenCount').fill('1');
    await expect(inspector.locator('#result')).toContainText('Winner: DEP-Q293');

    await field('DEP-Q292', 'wrongCount').fill('1');
    await inspector.locator('#mode').selectOption('wrongOnly');
    await expect(inspector.locator('#result')).toContainText('Winner: DEP-Q292');

    await field('DEP-Q293', 'bookmark').check();
    await inspector.locator('#mode').selectOption('bookmarks');
    await expect(inspector.locator('#result')).toContainText('Winner: DEP-Q293');

    await field('DEP-Q292', 'noteText').fill('inspection only');
    await inspector.locator('#mode').selectOption('notesOnly');
    await expect(inspector.locator('#result')).toContainText('Winner: DEP-Q292');

    await inspector.locator('#mode').selectOption('random');
    await expect(inspector.locator('#result')).toContainText(
      'Representative is selected before session shuffle.'
    );
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(beforeStorage);
  });
});

test.describe('[DEP][FLOW] Question authoring / Editing and validation', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The local authoring tool is Chromium-only.');
  });

  test('guarantees singleton validation failure recovers through add and rename', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);
    await memberCard(page, 'DEP-Q293').getByRole('button', { name: 'Remove member' }).click();

    await expect(page.locator('#comparison h2')).toContainText('1 members');
    await expect(page.locator('#validation-status')).toContainText('FAIL · 1 errors');
    await expect(page.locator('#validation-result')).toHaveText(
      'Result : NG — 1 validation errors found.'
    );
    await expect(page.locator('#validation-result')).toBeVisible();
    await expect(page.locator('#validation')).toBeVisible();
    await expect(page.locator('#export')).toBeDisabled();
    await expect(page.locator('#dirty')).toHaveText('Unsaved changes');

    await page.locator('#add-form select').selectOption('DEP-Q293');
    await page.locator('#add-form').getByRole('button', { name: 'Add member' }).click();
    await expect(page.locator('#validation-status')).toContainText('PASS · 0 errors');

    const renamedGroup = 'auto-loader-state-locations-e2e';
    await page.locator('#rename-form input').fill(renamedGroup);
    await page.locator('#rename-form').getByRole('button', { name: 'Rename group' }).click();
    await expect(page.locator('#comparison h2')).toContainText(`${renamedGroup} 2 members`);
    await expect(page.locator('#groups button.active')).toContainText(renamedGroup);
    await expect(page.locator('#validation-status')).toContainText('PASS · 0 errors');
  });

  test('deletes only the group relation after confirmation and supports cancel and Reset', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);
    const deleteButton = page.getByRole('button', { name: 'Delete Group' });
    await expect(page.locator('.group-management')).toContainText(
      'Delete Groupは問題自体を削除しません。2 questionsは残り'
    );

    page.once('dialog', (dialog) => dialog.dismiss());
    await deleteButton.click();
    await expect(page.locator('#groups button', { hasText: GROUP_ID })).toHaveCount(1);
    await expect(page.locator('#dirty')).toBeHidden();

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(`Delete Variant Group "${GROUP_ID}"?`);
      expect(dialog.message()).toContain('2 questions will remain and return to Ungrouped.');
      await dialog.accept();
    });
    await deleteButton.click();
    await expect(page.locator('#groups button', { hasText: GROUP_ID })).toHaveCount(0);
    await expect(page.locator('#dirty')).toHaveText('Unsaved changes');
    await expect(page.locator('#validation-status')).toContainText('PASS');

    await page.locator('#create-panel > summary').click();
    await page.locator('#create-search').fill('DEP-Q29');
    await expect(page.locator('#create-list input[value="DEP-Q292"]')).toHaveCount(1);
    await expect(page.locator('#create-list input[value="DEP-Q293"]')).toHaveCount(1);

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#reset').click();
    await expect(page.locator('#groups button', { hasText: GROUP_ID })).toContainText('2');
    await expect(page.locator('#dirty')).toBeHidden();
  });

  test('offers deterministic same-choice candidates without selecting or persisting them', async ({
    page,
  }) => {
    await page.route('**/dep-quiz-app/questions.json', async (route) => {
      const response = await route.fetch();
      const questions = await response.json();
      const seed = { ...questions[0], id: 'CANDIDATE-SEED', variantGroup: undefined };
      const match = {
        ...questions[0],
        id: 'CANDIDATE-MATCH',
        question: '同じ選択肢を持つ別の問い',
        variantGroup: undefined,
      };
      delete seed.followUp;
      delete match.followUp;
      await route.fulfill({ response, json: [seed, match, ...questions] });
    });
    await page.goto(TOOL_URL);
    await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
    await page.locator('#create-panel > summary').click();
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
    await page.locator('#candidate-seed').selectOption('CANDIDATE-SEED');
    const results = page.locator('#candidate-results');
    await expect(results).toContainText(/候補 [1-9]\d*件/);
    await expect(results).toContainText('CANDIDATE-MATCH');
    await expect(results).toContainText('Same choice set');
    await expect(page.locator('#create-list input:checked')).toHaveCount(0);
    await expect(page.locator('#dirty')).toBeHidden();
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);

    await results
      .locator('li', { hasText: 'CANDIDATE-MATCH' })
      .getByRole('button', { name: 'Show in list' })
      .click();
    await expect(page.locator('#create-search')).toHaveValue('CANDIDATE-MATCH');
    await expect(page.locator('#create-list input[value="CANDIDATE-MATCH"]')).not.toBeChecked();
    await page.locator('#candidate-seed').selectOption('CANDIDATE-MATCH');
    await expect(results).toContainText(/候補 [1-9]\d*件/);
  });

  test('shows the Candidate Assist empty state without editing or grouping questions', async ({
    page,
  }) => {
    await page.route('**/dep-quiz-app/questions.json', async (route) => {
      const response = await route.fetch();
      const questions = await response.json();
      const seed = {
        ...questions[0],
        id: 'CANDIDATE-NO-MATCH',
        question: 'exact same choice setを持たない候補確認用の問い',
        choices: Object.fromEntries(
          Object.keys(questions[0].choices).map((label) => [
            label,
            `candidate-empty-${label}-unique-choice`,
          ])
        ),
        variantGroup: undefined,
      };
      delete seed.followUp;
      await route.fulfill({ response, json: [seed, ...questions] });
    });
    await page.goto(TOOL_URL);
    await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
    await page.locator('#create-panel > summary').click();
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
    const groupCountBefore = await page.locator('#groups button').count();

    await page.locator('#candidate-seed').selectOption('CANDIDATE-NO-MATCH');

    const emptyState = page.locator('#candidate-results .empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveText(
      'Same choice set のUngrouped候補はありません。別のSeed Questionを選んでください。'
    );
    await expect(page.locator('#create-list input:checked')).toHaveCount(0);
    await expect(page.locator('#dirty')).toBeHidden();
    await expect(page.locator('#groups button')).toHaveCount(groupCountBefore);
    await expect(page.locator('#groups')).not.toContainText('CANDIDATE-NO-MATCH');
    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
  });

  test('keeps a duplicate Group Name rename error visible in Comparison', async ({ page }) => {
    await openRepresentativeGroup(page);
    await page.locator('#create-panel > summary').click();
    const ungrouped = page.locator('#create-list input[name="questionIds"]');
    await ungrouped.nth(0).check();
    await ungrouped.nth(1).check();
    await page.locator('#create-form input[name="groupId"]').fill('comparison-error-e2e');
    await page.locator('#create-form').getByRole('button', { name: 'Create group' }).click();

    await expect(page.locator('#comparison-panel')).toHaveAttribute('open', '');
    await page.locator('#rename-form input').fill(GROUP_ID);
    await page.locator('#rename-form').getByRole('button', { name: 'Rename group' }).click();

    const error = page.locator('#comparison-operation-error');
    await expect(page.locator('#comparison-panel')).toHaveAttribute('open', '');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(`Group ${GROUP_ID} already exists.`);
    await expect(page.locator('#operation-error')).toBeHidden();
  });

  test('links a choice multiset validation failure to its troubleshooting guide', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await page.getByRole('button', { name: 'VARIANT MANAGEMENT' }).click();
    await page.locator('#create-panel > summary').click();
    await page.locator('#create-list input[value="DEP-Q208"]').check();
    await page.locator('#create-list input[value="DEP-Q226"]').check();
    await page.locator('#create-form input[name="groupId"]').fill('invalid-choice-multiset-e2e');
    await page.locator('#create-form').getByRole('button', { name: 'Create group' }).click();

    await expect(page.locator('#validation-content')).toContainText(
      'must use the same choice text multiset'
    );
    await page.locator('#validation > summary').click();
    const helpLink = page.locator('#choice-multiset-help-link');
    await expect(helpLink).toBeVisible();
    await helpLink.click();
    await expect(page.locator('#error-help')).toHaveAttribute('open', '');
    await expect(page.locator('#choice-multiset-help')).toBeVisible();
  });

  test('guarantees empty groups disappear, can be recreated, and Reset restores the source snapshot', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);
    await memberCard(page, 'DEP-Q292').getByRole('button', { name: 'Remove member' }).click();
    await memberCard(page, 'DEP-Q293').getByRole('button', { name: 'Remove member' }).click();

    await expect(page.locator('#groups button', { hasText: GROUP_ID })).toHaveCount(0);
    await expect(page.locator('#comparison h2', { hasText: GROUP_ID })).toHaveCount(0);
    await expect(page.locator('#inspector [data-id="DEP-Q292"]')).toHaveCount(0);
    await expect(page.locator('#inspector [data-id="DEP-Q293"]')).toHaveCount(0);

    await page.locator('#create-panel > summary').click();
    await page.locator('#create-search').fill('DEP-Q29');
    await page.locator('#create-list input[value="DEP-Q292"]').check();
    await page.locator('#create-list input[value="DEP-Q293"]').check();
    await page.locator('#create-form input[name="groupId"]').fill('recreated-loader-locations');
    await page.locator('#create-form').getByRole('button', { name: 'Create group' }).click();
    await expect(page.locator('#comparison h2')).toContainText(
      'recreated-loader-locations 2 members'
    );
    await expect(page.locator('#validation-status')).toContainText('PASS');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#reset').click();
    await expect(page.locator('#dirty')).toBeHidden();
    await expect(page.locator('#reset')).toBeDisabled();
    await expect(page.locator('#groups button', { hasText: GROUP_ID })).toContainText('2');
  });
});

test.describe('[DEP][DATA] Question authoring / Export and browser isolation', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The local authoring tool is Chromium-only.');
  });

  test('guarantees valid edited JSON downloads without mutating source or browser storage', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);
    const sourceBefore = await page.evaluate(async () =>
      (await fetch('/dep-quiz-app/questions.json')).text()
    );
    const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
    const renamedGroup = 'exported-loader-locations';

    await page.locator('#rename-form input').fill(renamedGroup);
    await page.locator('#rename-form').getByRole('button', { name: 'Rename group' }).click();
    await openInspector(page);
    await page.locator('#inspector [data-id="DEP-Q292"][data-field="seenCount"]').fill('9');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('questions.json');

    const exported = JSON.parse(
      await (await download.createReadStream()).toArray().then(Buffer.concat).then(String)
    );
    expect(
      exported.find((question: { id: string }) => question.id === 'DEP-Q292').variantGroup
    ).toBe(renamedGroup);
    expect(
      exported.find((question: { id: string }) => question.id === 'DEP-Q293').variantGroup
    ).toBe(renamedGroup);
    expect(JSON.stringify(exported)).not.toContain('"progress"');
    expect(JSON.stringify(exported)).not.toContain('"sections"');
    expect(JSON.stringify(exported)).not.toContain('"mode"');
    await expect(page.locator('#dirty')).toHaveText('Unsaved changes');

    expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storageBefore);
    expect(
      await page.evaluate(async () => (await fetch('/dep-quiz-app/questions.json')).text())
    ).toBe(sourceBefore);
  });

  test('exports a derived Question together with its atomic Variant relation', async ({ page }) => {
    await page.goto(TOOL_URL);
    await page.locator('#catalog-search').fill('DEP-Q201');
    await page.locator('[data-question-id="DEP-Q201"]').click();
    await page.getByRole('button', { name: 'Create Variant', exact: true }).click();
    const form = await completeVariantForm(page, 'DEP-Q999-EXPORT', 'export-derived-group');
    await form.getByRole('button', { name: 'Create Variant' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export').click();
    const download = await downloadPromise;
    const exported = JSON.parse(
      await (await download.createReadStream()).toArray().then(Buffer.concat).then(String)
    );
    const source = exported.find((question: { id: string }) => question.id === 'DEP-Q201');
    const derived = exported.find((question: { id: string }) => question.id === 'DEP-Q999-EXPORT');
    expect(source.variantGroup).toBe('export-derived-group');
    expect(derived.variantGroup).toBe('export-derived-group');
    expect(derived.choices).toEqual(source.choices);
    expect(derived.followUp).toBeUndefined();
    expect(JSON.stringify(exported)).not.toContain('confirm-knowledge');
  });
});
