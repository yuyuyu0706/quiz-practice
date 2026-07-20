import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatDiagnostic,
  validateFeatureImplementationDocument,
} from './feature-implementation-doc-validator.mjs';

const rootDir = process.cwd();
const commonPath = 'tests/fixtures/feature-implementation-docs/common/valid/minimal.md';
const phasePath = 'docs/feature-implementation/phase-d-weakness-learning.md';
const sectionNames = [
  '本文書について',
  '第1章 弱点分析の位置付け',
  '第2章 弱点分析を起点とする学習フィードバックループ',
  '第3章 学習履歴を学習判断へ変える ― 弱点分析の仕組み',
  '第4章 分析を学習行動へつなぐ ― 対象問題一覧と弱点起点の復習',
  '第5章 学習周期を切り替える ― 学習履歴リセット',
  '第6章 弱点分析を支える主要な設計思想',
  '第7章 現在地と今後の発展方向',
  '第8章 参考情報',
];

function validate(content, filePath = commonPath) {
  return validateFeatureImplementationDocument({ content, filePath, rootDir });
}

function assertRules(content, expected, filePath = commonPath) {
  assert.deepEqual(
    validate(content, filePath).map((item) => item.ruleId),
    expected
  );
}

assertRules('# Title\n\n## Section\nText', []);
assertRules('  \n\t', ['FDOC-C001', 'FDOC-C002']);
assertRules('Text only', ['FDOC-C002']);
assertRules('# One\n# Two', ['FDOC-C002']);
assertRules('# Title\n### Skip', ['FDOC-C003']);
assertRules('# Title\n## Parent\n### Same\n### Same', ['FDOC-C004']);
assertRules('# Title\n## One\n### Same\n## Two\n### Same', []);
assertRules('# Title\n![missing](missing.png)', ['FDOC-C005']);
assertRules('# Title\n[missing](missing.md)', ['FDOC-C006']);
assertRules('# Title\nSee C:\\Users\\person\\project', ['FDOC-C007']);
assertRules('# Title\nTODO: write this', ['FDOC-C008']);
assertRules(
  '# Title\nTODOLIST is valid\n`TODO C:\\Users\\person`\nhttps://example.com/home/guide\n[anchor](#here)',
  []
);
assertRules('# Title\n```md\n# Fake\n![bad](missing.png)\nTODO\n```', []);

const localLinksPath =
  'tests/fixtures/feature-implementation-docs/common/valid/local-links/document.md';
const validLinks = fs.readFileSync(path.join(rootDir, localLinksPath), 'utf8');
assertRules(validLinks, [], localLinksPath);

const validPhase = [
  '# 弱点分析 機能実装書',
  ...sectionNames.map((name, index) =>
    index === 0
      ? `## ${name}`
      : `## ${name}\n![図${index}](images/phase-d-weakness-learning-section${index}.png)`
  ),
].join('\n\n');
assertRules(validPhase, [], phasePath);
assertRules(
  validPhase.replace('第4章 分析を学習行動へつなぐ ― 対象問題一覧と弱点起点の復習', '第4章 別名'),
  ['FDOC-PD002'],
  phasePath
);
const reorderedSections = [...sectionNames];
[reorderedSections[1], reorderedSections[2]] = [reorderedSections[2], reorderedSections[1]];
const reordered = [
  '# 弱点分析 機能実装書',
  ...reorderedSections.map((name) => {
    const number = sectionNames.indexOf(name);
    return number === 0
      ? `## ${name}`
      : `## ${name}\n![図${number}](images/phase-d-weakness-learning-section${number}.png)`;
  }),
].join('\n\n');
assertRules(reordered, ['FDOC-PD003'], phasePath);
assertRules(
  validPhase.replace('![図3](images/phase-d-weakness-learning-section3.png)', ''),
  ['FDOC-PD004'],
  phasePath
);
const misplaced = validPhase
  .replace('![図3](images/phase-d-weakness-learning-section3.png)', '')
  .replace(
    '![図2](images/phase-d-weakness-learning-section2.png)',
    '![](images/phase-d-weakness-learning-section2.png)\n![図3](images/phase-d-weakness-learning-section3.png)'
  );
assertRules(misplaced, ['FDOC-PD005'], phasePath);
assertRules(
  validPhase.replace('## 本文書について', '## Phase D overview'),
  ['FDOC-PD002', 'FDOC-PD006'],
  phasePath
);

const missingLine = validate('Text only')[0];
assert.equal(formatDiagnostic(missingLine).includes('Line: -'), true);
assert.equal(formatDiagnostic(missingLine).includes('Target: -'), true);
console.log('Feature implementation document validator tests passed.');
