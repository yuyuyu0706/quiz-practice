import fs from 'node:fs';
import path from 'node:path';

const PHASE_D_PATH = 'docs/feature-implementation/phase-d-weakness-learning.md';
const PHASE_D_TITLE = '弱点分析 機能実装書';
const PHASE_D_SECTIONS = [
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

const messages = {
  'FDOC-C001': '文書本文がありません',
  'FDOC-C002': 'H1 は1つだけにしてください',
  'FDOC-C003': '見出しレベルが1階層を超えて深くなっています',
  'FDOC-C004': '同じ親の配下に重複する見出しがあります',
  'FDOC-C005': '参照画像が存在しません',
  'FDOC-C006': '参照文書が存在しません',
  'FDOC-C007': 'ローカル環境依存パスを含めないでください',
  'FDOC-C008': '未解決プレースホルダーを解消してください',
  'FDOC-PD001': 'H1 は「弱点分析 機能実装書」にしてください',
  'FDOC-PD002': '必須章がありません',
  'FDOC-PD003': '必須章の順序が正しくありません',
  'FDOC-PD004': '必須の章図参照がありません',
  'FDOC-PD005': '章図が対応する章内にありません',
  'FDOC-PD006': '読者向け見出しに内部管理名を使用しないでください',
};

const normalizePath = (value) => value.split(path.sep).join('/');
const isExternal = (target) => /^https?:\/\//i.test(target);
const openingFencePattern = /^\s{0,3}(`{3,}|~{3,})\s*.*$/;
const withoutInlineCodeAndUrls = (text) =>
  text.replace(/(`+)[\s\S]*?\1/g, '').replace(/https?:\/\/[^\s)>]+/gi, '');

function isClosingFence(text, openFence) {
  const closingFencePattern = new RegExp(
    `^\\s{0,3}${openFence.character}{${openFence.length},}\\s*$`
  );
  return closingFencePattern.test(text);
}

export function parseFeatureImplementationMarkdown(content, options = {}) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const headings = [];
  const images = [];
  const links = [];
  const searchableLines = [];
  let openFence = null;

  lines.forEach((text, index) => {
    const line = index + 1;
    if (openFence && isClosingFence(text, openFence)) {
      openFence = null;
      return;
    }
    if (openFence) return;
    const fence = text.match(openingFencePattern);
    if (fence) {
      openFence = { character: fence[1][0], length: fence[1].length };
      return;
    }

    const heading = text.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) headings.push({ level: heading[1].length, text: heading[2], line });

    // A single scanner keeps image links out of the ordinary-link collection.
    for (const match of text.matchAll(/(!?)\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
      const entry = { target: match[2], line };
      if (match[1] === '!') images.push(entry);
      else links.push(entry);
    }
    searchableLines.push({ line, text: withoutInlineCodeAndUrls(text) });
  });

  return {
    filePath: options.filePath ?? '',
    rawContent: content,
    lines,
    headings,
    images,
    links,
    searchableLines,
  };
}

function diagnostic(file, ruleId, line = null, target = null) {
  return { severity: 'ERROR', file, ruleId, line, message: messages[ruleId], target };
}

function localTargetExists(target, document, context) {
  const filePart = target.split('#')[0];
  if (!filePart || isExternal(filePart)) return true;
  return fs.existsSync(path.resolve(context.rootDir, path.dirname(document.filePath), filePart));
}

export function validateCommonRules(document, context = {}) {
  const diagnostics = [];
  const file = document.filePath;
  if (!document.rawContent.trim()) diagnostics.push(diagnostic(file, 'FDOC-C001'));

  const h1s = document.headings.filter((heading) => heading.level === 1);
  if (h1s.length !== 1) diagnostics.push(diagnostic(file, 'FDOC-C002'));

  let previousLevel = 1;
  document.headings.forEach((heading) => {
    if (heading.level - previousLevel >= 2)
      diagnostics.push(diagnostic(file, 'FDOC-C003', heading.line, heading.text));
    previousLevel = heading.level;
  });

  const stacks = [];
  const seen = new Set();
  document.headings.forEach((heading) => {
    stacks.length = heading.level - 1;
    const parent = stacks[heading.level - 2]?.id ?? '__root__';
    const key = `${parent}\u0000${heading.level}\u0000${heading.text}`;
    if (seen.has(key)) diagnostics.push(diagnostic(file, 'FDOC-C004', heading.line, heading.text));
    seen.add(key);
    stacks[heading.level - 1] = { id: `heading-${heading.line}` };
  });

  document.images.forEach((image) => {
    if (!isExternal(image.target) && !localTargetExists(image.target, document, context)) {
      diagnostics.push(diagnostic(file, 'FDOC-C005', image.line, image.target));
    }
  });
  document.links.forEach((link) => {
    if (!isExternal(link.target) && !localTargetExists(link.target, document, context)) {
      diagnostics.push(diagnostic(file, 'FDOC-C006', link.line, link.target));
    }
  });

  const localPathPattern = /[A-Za-z]:\\Users\\|\/Users\/|\/home\/|file:\/\//;
  const placeholderPattern = /\b(?:TODO|TBD|FIXME)\b|\{\{PLACEHOLDER\}\}|<未入力>/;
  document.searchableLines.forEach(({ line, text }) => {
    if (localPathPattern.test(text)) diagnostics.push(diagnostic(file, 'FDOC-C007', line));
    if (placeholderPattern.test(text)) diagnostics.push(diagnostic(file, 'FDOC-C008', line));
  });
  return diagnostics;
}

export function validatePhaseDRules(document) {
  if (normalizePath(document.filePath) !== PHASE_D_PATH) return [];
  const diagnostics = [];
  const file = document.filePath;
  const h1s = document.headings.filter((heading) => heading.level === 1);
  if (h1s.length !== 1 || h1s[0].text !== PHASE_D_TITLE)
    diagnostics.push(
      diagnostic(
        file,
        'FDOC-PD001',
        h1s.length === 1 ? h1s[0].line : null,
        h1s.length === 1 ? h1s[0].text : null
      )
    );

  const h2s = document.headings.filter((heading) => heading.level === 2);
  const sections = new Map(h2s.map((heading) => [heading.text, heading]));
  const missing = PHASE_D_SECTIONS.filter((section) => !sections.has(section));
  missing.forEach((section) => diagnostics.push(diagnostic(file, 'FDOC-PD002', null, section)));
  if (!missing.length) {
    const positions = PHASE_D_SECTIONS.map((section) => sections.get(section).line);
    if (positions.some((line, index) => index > 0 && line < positions[index - 1]))
      diagnostics.push(diagnostic(file, 'FDOC-PD003'));
  }

  for (let number = 1; number <= 8; number += 1) {
    const target = `images/phase-d-weakness-learning-section${number}.png`;
    const image = document.images.find((entry) => entry.target === target);
    if (!image) {
      diagnostics.push(diagnostic(file, 'FDOC-PD004', null, target));
      continue;
    }
    const section = sections.get(PHASE_D_SECTIONS[number]);
    if (!section) continue;
    const nextH2 = h2s.find((heading) => heading.line > section.line);
    if (image.line <= section.line || (nextH2 && image.line >= nextH2.line))
      diagnostics.push(diagnostic(file, 'FDOC-PD005', image.line, target));
  }

  const internalName = /Phase D|Lv3|Lv4|DX-|Issue #|PR #/;
  document.headings
    .filter((heading) => heading.level <= 2 && internalName.test(heading.text))
    .forEach((heading) => {
      diagnostics.push(diagnostic(file, 'FDOC-PD006', heading.line, heading.text));
    });
  return diagnostics;
}

export function validateFeatureImplementationDocument({
  content,
  filePath,
  rootDir = process.cwd(),
}) {
  const document = parseFeatureImplementationMarkdown(content, {
    filePath: normalizePath(filePath),
  });
  return [
    ...validateCommonRules(document, { rootDir }),
    ...validatePhaseDRules(document, { rootDir }),
  ];
}

export function formatDiagnostic({ severity, file, ruleId, line, message, target }) {
  return `[${severity}] ${file}\nRule: ${ruleId}\nLine: ${line ?? '-'}\nMessage: ${message}\nTarget: ${target ?? '-'}`;
}
