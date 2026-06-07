import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const rootDir = process.cwd();
const sourceEntrypoints = [
  'swa-root/index.html',
  'dea-quiz-app/index.html',
  'dea-quiz-app-plus/index.html',
  'dep-quiz-app/index.html',
];
const requiredTopPageLinks = ['./dea-quiz-app/', './dep-quiz-app/', './dea-quiz-app-plus/'];
const forbiddenTopPageLink = './dep-quiz-app-plus/';
const artifactEntrypoints = [
  'index.html',
  'dea-quiz-app/index.html',
  'dea-quiz-app-plus/index.html',
  'dep-quiz-app/index.html',
];

function assertFileExists(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  assert.ok(fs.existsSync(filePath), `${relativePath} must exist`);
  assert.ok(fs.statSync(filePath).isFile(), `${relativePath} must be a file`);
}

function copyDirectoryContents(sourceDir, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir)) {
    fs.cpSync(path.join(sourceDir, entry), path.join(destinationDir, entry), { recursive: true });
  }
}

function createArtifact() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'swa-artifact-validation-'));
  const artifactDir = path.join(tmpRoot, 'swa-site');

  fs.mkdirSync(artifactDir, { recursive: true });
  copyDirectoryContents(path.join(rootDir, 'swa-root'), artifactDir);
  fs.cpSync(path.join(rootDir, 'dea-quiz-app'), path.join(artifactDir, 'dea-quiz-app'), {
    recursive: true,
  });
  fs.cpSync(path.join(rootDir, 'dea-quiz-app-plus'), path.join(artifactDir, 'dea-quiz-app-plus'), {
    recursive: true,
  });
  fs.cpSync(path.join(rootDir, 'dep-quiz-app'), path.join(artifactDir, 'dep-quiz-app'), {
    recursive: true,
  });

  return { artifactDir, cleanupDir: tmpRoot };
}

function resolveArtifact() {
  const existingArtifactDir = path.join(rootDir, 'swa-site');

  if (fs.existsSync(existingArtifactDir)) {
    assert.ok(fs.statSync(existingArtifactDir).isDirectory(), 'swa-site must be a directory');
    return { artifactDir: existingArtifactDir, cleanupDir: null };
  }

  return createArtifact();
}

for (const entrypoint of sourceEntrypoints) {
  assertFileExists(entrypoint);
}

console.log('✓ Source files exist');

const topPageHtml = fs.readFileSync(path.join(rootDir, 'swa-root/index.html'), 'utf8');

for (const link of requiredTopPageLinks) {
  assert.ok(topPageHtml.includes(link), `swa-root/index.html must include ${link}`);
}

assert.ok(
  !topPageHtml.includes(forbiddenTopPageLink),
  `swa-root/index.html must not link to undeveloped ${forbiddenTopPageLink}`
);

console.log('✓ Entrypoint links are valid');

const { artifactDir, cleanupDir } = resolveArtifact();

try {
  for (const entrypoint of artifactEntrypoints) {
    const filePath = path.join(artifactDir, entrypoint);
    assert.ok(fs.existsSync(filePath), `SWA artifact must include ${entrypoint}`);
    assert.ok(fs.statSync(filePath).isFile(), `SWA artifact ${entrypoint} must be a file`);
  }

  console.log('✓ SWA artifact contains expected app entrypoints');
} finally {
  if (cleanupDir) {
    fs.rmSync(cleanupDir, { recursive: true, force: true });
  }
}
