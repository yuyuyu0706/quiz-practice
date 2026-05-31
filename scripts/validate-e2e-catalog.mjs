import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const E2E_DIR = path.join('tests', 'e2e');
const CATALOG_PATH = path.join('docs', 'testing', 'e2e-test-catalog.md');
const DEP_SPEC_PATTERN = /^dep-.*\.spec\.ts$/;
const DESCRIBE_NAME_PATTERN = /^\[DEP\]\[(UI|FLOW|DATA)\]\s+.+$/;

function readQuotedString(source, openParenIndex) {
  let index = openParenIndex + 1;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }

  const quote = source[index];
  if (!['"', "'", '`'].includes(quote)) {
    return null;
  }

  let value = '';
  index += 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') {
      value += char;
      if (index + 1 < source.length) {
        value += source[index + 1];
        index += 2;
        continue;
      }
    }

    if (char === quote) {
      return value;
    }

    value += char;
    index += 1;
  }

  return null;
}

function extractNames(source, callPattern) {
  const names = [];
  for (const match of source.matchAll(callPattern)) {
    const openParenIndex = match.index + match[0].lastIndexOf('(');
    const name = readQuotedString(source, openParenIndex);
    if (name) {
      names.push(name);
    }
  }
  return names;
}

function unique(values) {
  return [...new Set(values)];
}

const catalog = readFileSync(CATALOG_PATH, 'utf8');
const specFiles = readdirSync(E2E_DIR)
  .filter((fileName) => DEP_SPEC_PATTERN.test(fileName))
  .sort();
const expectedSpecPaths = specFiles.map((fileName) => path.join(E2E_DIR, fileName));
const documentedSpecPaths = unique(
  [...catalog.matchAll(/`(tests\/e2e\/dep-[^`]+\.spec\.ts)`/g)].map((match) => match[1])
);

const failures = [];
const entries = [];

for (const documentedSpecPath of documentedSpecPaths) {
  if (!expectedSpecPaths.includes(documentedSpecPath)) {
    failures.push(
      `${CATALOG_PATH}: documented DEP spec does not exist or no longer matches ${DEP_SPEC_PATTERN}: ${documentedSpecPath}`
    );
  }
}

for (const fileName of specFiles) {
  const specPath = path.join(E2E_DIR, fileName);
  const source = readFileSync(specPath, 'utf8');
  const describeNames = unique(
    extractNames(source, /\btest\.describe(?:\.(?:only|skip|fixme|serial|parallel))?\s*\(/g)
  );
  const testNames = unique(extractNames(source, /\btest(?:\.(?:only|skip|fixme))?\s*\(/g));

  if (!catalog.includes(specPath)) {
    failures.push(`${specPath}: spec path is missing from ${CATALOG_PATH}`);
  }

  if (describeNames.length === 0) {
    failures.push(`${specPath}: no test.describe name found`);
  }

  for (const describeName of describeNames) {
    if (!DESCRIBE_NAME_PATTERN.test(describeName)) {
      failures.push(
        `${specPath}: describe name must match [DEP][UI|FLOW|DATA] Feature / Screen: ${describeName}`
      );
    }

    if (!catalog.includes(describeName)) {
      failures.push(`${specPath}: describe name is missing from ${CATALOG_PATH}: ${describeName}`);
    }
  }

  for (const testName of testNames) {
    if (!catalog.includes(testName)) {
      failures.push(`${specPath}: test name is missing from ${CATALOG_PATH}: ${testName}`);
    }
  }

  entries.push({ specPath, describeNames, testNames });
}

if (failures.length > 0) {
  console.error('E2E catalog validation failed.');
  console.error(`Catalog: ${CATALOG_PATH}`);
  console.error('');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const testCount = entries.reduce((sum, entry) => sum + entry.testNames.length, 0);
const suiteCount = entries.reduce((sum, entry) => sum + entry.describeNames.length, 0);
console.log(
  `E2E catalog validation passed: ${specFiles.length} DEP spec files, ${suiteCount} suite names, ${testCount} test names documented in ${CATALOG_PATH}.`
);
