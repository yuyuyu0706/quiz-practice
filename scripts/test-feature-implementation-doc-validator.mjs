import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatDiagnostic,
  validateFeatureImplementationDocument,
} from './feature-implementation-doc-validator.mjs';

const fixtureRoot = path.join(process.cwd(), 'tests/fixtures/feature-implementation-docs');
const phaseFixtureRoot = path.join(fixtureRoot, 'phase-d/valid/complete');
const phasePath = 'docs/feature-implementation/phase-d-weakness-learning.md';

function readFixture(relativePath) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath), 'utf8');
}

function validateFixture(relativePath, options = {}) {
  return validateFeatureImplementationDocument({
    content: options.content ?? readFixture(relativePath),
    filePath: options.filePath ?? relativePath,
    rootDir: options.rootDir ?? fixtureRoot,
  });
}

function assertRules(relativePath, expected, options) {
  assert.deepEqual(
    validateFixture(relativePath, options).map((diagnostic) => diagnostic.ruleId),
    expected,
    relativePath
  );
}

const commonInvalid = 'common/invalid';
assertRules('common/valid/minimal.md', []);
assertRules(`${commonInvalid}/fdoc-c001-empty.md`, ['FDOC-C001', 'FDOC-C002']);
assertRules(`${commonInvalid}/fdoc-c002-no-h1.md`, ['FDOC-C002']);
assertRules(`${commonInvalid}/fdoc-c002-multiple-h1.md`, ['FDOC-C002']);
assertRules(`${commonInvalid}/fdoc-c003-heading-skip.md`, ['FDOC-C003']);
assertRules(`${commonInvalid}/fdoc-c004-duplicate-heading.md`, ['FDOC-C004']);
assertRules(`${commonInvalid}/fdoc-c005-missing-image.md`, ['FDOC-C005']);
assertRules(`${commonInvalid}/fdoc-c006-missing-document.md`, ['FDOC-C006']);
assertRules(`${commonInvalid}/fdoc-c007-local-path.md`, ['FDOC-C007']);
assertRules(`${commonInvalid}/fdoc-c008-placeholder.md`, ['FDOC-C008']);
assertRules('common/valid/local-links/document.md', []);
assertRules('common/valid/code-exclusion.md', []);
assert.deepEqual(
  validateFixture('common/valid/code-exclusion.md').filter((diagnostic) =>
    ['FDOC-C007', 'FDOC-C008'].includes(diagnostic.ruleId)
  ),
  []
);

const missingImage = validateFixture(`${commonInvalid}/fdoc-c005-missing-image.md`)[0];
assert.deepEqual(
  {
    ruleId: missingImage.ruleId,
    message: missingImage.message,
    line: missingImage.line,
    target: missingImage.target,
  },
  { ruleId: 'FDOC-C005', message: '参照画像が存在しません', line: 3, target: 'missing.png' }
);
const missingH1 = validateFixture(`${commonInvalid}/fdoc-c002-no-h1.md`)[0];
assert.equal(formatDiagnostic(missingH1).includes('Line: -'), true);
assert.equal(formatDiagnostic(missingH1).includes('Target: -'), true);

const phaseValid =
  'phase-d/valid/complete/docs/feature-implementation/phase-d-weakness-learning.md';
const phaseOptions = { filePath: phasePath, rootDir: phaseFixtureRoot };
assertRules(phaseValid, [], phaseOptions);
for (const [fixture, expected] of [
  ['fdoc-pd001-wrong-h1.md', ['FDOC-PD001', 'FDOC-PD006']],
  ['fdoc-pd002-missing-section.md', ['FDOC-PD002']],
  ['fdoc-pd003-wrong-order.md', ['FDOC-PD003']],
  ['fdoc-pd004-missing-image.md', ['FDOC-PD004']],
  ['fdoc-pd005-misplaced-image.md', ['FDOC-PD005']],
  ['fdoc-pd006-internal-name.md', ['FDOC-PD002', 'FDOC-PD006']],
]) {
  assertRules(`phase-d/invalid/${fixture}`, expected, phaseOptions);
}

const missingSection = validateFixture(
  'phase-d/invalid/fdoc-pd002-missing-section.md',
  phaseOptions
)[0];
assert.deepEqual(
  {
    ruleId: missingSection.ruleId,
    message: missingSection.message,
    line: missingSection.line,
    target: missingSection.target,
  },
  {
    ruleId: 'FDOC-PD002',
    message: '必須章がありません',
    line: null,
    target: '第5章 学習周期を切り替える ― 学習履歴リセット',
  }
);

console.log('Feature implementation document validator tests passed.');
