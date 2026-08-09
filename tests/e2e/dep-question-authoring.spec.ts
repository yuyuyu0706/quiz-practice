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

function memberCard(page: Page, questionId: string) {
  return page.locator('#comparison article', {
    has: page.getByRole('heading', { name: questionId }),
  });
}

test.describe('[DEP][UI] Question authoring / Variant Manager and Selection Inspector', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The local authoring tool is Chromium-only.');
  });

  test('guarantees production variant comparison, search, and read-only relations remain visible', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);

    await expect(memberCard(page, 'DEP-Q292').getByText('Choice text multiset')).toBeVisible();
    await expect(memberCard(page, 'DEP-Q292').getByText(/Follow-up:\s*DEP-Q294/)).toBeVisible();
    await expect(memberCard(page, 'DEP-Q293')).toBeVisible();

    await page.locator('#search').fill('DEP-Q293');
    await expect(page.locator('#groups button', { hasText: GROUP_ID })).toContainText('2');
    await expect(page.locator('#comparison h2')).toContainText('2 members');
  });

  test('guarantees Inspector selection modes use eligibility-first rules without persistence', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);
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
    await expect(page.locator('#validation')).toContainText('FAIL');
    await expect(page.locator('#export')).toBeDisabled();
    await expect(page.locator('#dirty')).toHaveText('Unsaved changes');

    await page.locator('#add-form select').selectOption('DEP-Q293');
    await page.locator('#add-form').getByRole('button', { name: 'Add member' }).click();
    await expect(page.locator('#validation')).toContainText('PASS');

    const renamedGroup = 'auto-loader-state-locations-e2e';
    await page.locator('#rename-form input').fill(renamedGroup);
    await page.locator('#rename-form').getByRole('button', { name: 'Rename group' }).click();
    await expect(page.locator('#comparison h2')).toContainText(`${renamedGroup} 2 members`);
    await expect(page.locator('#groups button.active')).toContainText(renamedGroup);
    await expect(page.locator('#validation')).toContainText('PASS');
  });

  test('guarantees empty groups disappear, can be recreated, and Reset restores the source snapshot', async ({
    page,
  }) => {
    await openRepresentativeGroup(page);
    await memberCard(page, 'DEP-Q292').getByRole('button', { name: 'Remove member' }).click();
    await memberCard(page, 'DEP-Q293').getByRole('button', { name: 'Remove member' }).click();

    await expect(page.locator('#groups button', { hasText: GROUP_ID })).toHaveCount(0);
    await expect(page.locator('#comparison h2', { hasText: GROUP_ID })).toHaveCount(0);
    await expect(page.locator('#inspector')).not.toContainText(GROUP_ID);

    await page.locator('#create-search').fill('DEP-Q29');
    await page.locator('#create-list input[value="DEP-Q292"]').check();
    await page.locator('#create-list input[value="DEP-Q293"]').check();
    await page.locator('#create-form input[name="groupId"]').fill('recreated-loader-locations');
    await page.locator('#create-form').getByRole('button', { name: 'Create group' }).click();
    await expect(page.locator('#comparison h2')).toContainText(
      'recreated-loader-locations 2 members'
    );
    await expect(page.locator('#validation')).toContainText('PASS');

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
