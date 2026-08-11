import { expect, test, type Page } from '@playwright/test';

const TOOL_URL = '/tools/dep-question-authoring/';
const GROUP_ID = 'auto-loader-state-locations';

async function openRepresentativeGroup(page: Page) {
  await page.goto(TOOL_URL);
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

test.describe('[DEP][UI] Question authoring / Variant Manager and Selection Inspector', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The local authoring tool is Chromium-only.');
  });

  test('guides first-time use and explains search, editing, validation, and export boundaries', async ({
    page,
  }) => {
    await page.goto(TOOL_URL);
    await expect(page.locator('#status')).toContainText(
      /読み込み完了: \d+ questions \/ \d+ variant groups/
    );
    await expect(page.getByText('はじめて使う方へ — Quick Start')).toBeVisible();
    await expect(page.locator('.groups-panel .help')).toContainText('空欄では全 Variant groups');
    await expect(page.locator('.groups-panel .help')).toContainText(
      'Question ID・問題本文・Group 名'
    );
    await expect(page.locator('#search')).toHaveAttribute('placeholder', /DEP-Q292/);
    await page.locator('#quick-start-title').click();
    const quickStart = page.locator('.quick-start');
    await expect(quickStart.getByRole('heading', { name: '用語解説' })).toBeVisible();
    await expect(quickStart.locator('dt')).toHaveText(['Variant Group', 'followUp']);
    await expect(quickStart).toContainText('同じVariant Groupから最大1問を代表として採用します');
    await expect(quickStart).toContainText('自動遷移そのものを意味しません');
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
    await expect(page.locator('.quick-start strong')).toHaveCount(5);
  });

  test('shows actionable 404 recovery and prevents authoring against unloaded data', async ({
    page,
  }) => {
    await page.route('**/dep-quiz-app/questions.json', (route) =>
      route.fulfill({ status: 404, body: 'not found' })
    );
    await page.goto(TOOL_URL);
    const status = page.locator('#status');
    await expect(status).toContainText('questions.json が見つかりません (404)');
    await expect(status).toContainText('npm run serve:dep-question-authoring');
    await expect(status).toContainText('http://127.0.0.1:4173/tools/dep-question-authoring/');
    await expect(status).toContainText('http://127.0.0.1:4173/dep-quiz-app/questions.json');
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

    const status = page.locator('#status');
    await expect(status).toContainText('questions.json の読み込みに失敗しました');
    await expect(status).toContainText('questions.json に利用可能な問題がありません。');
    await expect(status).not.toContainText('0 questions / 0 variant groups');
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
});
