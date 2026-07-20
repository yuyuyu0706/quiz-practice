import fs from 'node:fs';
import path from 'node:path';
import {
  formatDiagnostic,
  validateFeatureImplementationDocument,
} from './feature-implementation-doc-validator.mjs';

const rootDir = process.cwd();
const documentsDir = path.join(rootDir, 'docs/feature-implementation');

try {
  const files = fs
    .readdirSync(documentsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `docs/feature-implementation/${entry.name}`)
    .sort();
  const diagnostics = files.flatMap((file) =>
    validateFeatureImplementationDocument({
      content: fs.readFileSync(path.join(rootDir, file), 'utf8'),
      filePath: file,
      rootDir,
    })
  );
  if (diagnostics.length) {
    console.error(diagnostics.map(formatDiagnostic).join('\n\n'));
    process.exitCode = 1;
  } else {
    console.log(`Validated ${files.length} feature implementation document(s): PASS`);
  }
} catch (error) {
  console.error(`Feature implementation document validation failed: ${error.message}`);
  process.exitCode = 1;
}
