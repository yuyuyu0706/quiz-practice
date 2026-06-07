import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getAppConfig, getSupportedAppNames, validateQuestions } from './question-validator.mjs';

const appName = process.argv[2] ?? 'dea';
const config = getAppConfig(appName);

if (!config) {
  throw new Error(
    `Unsupported app name: ${appName}. Use one of ${getSupportedAppNames().join(', ')}.`
  );
}

const questionPath = resolve(config.questionPath);
const raw = await readFile(questionPath, 'utf8');

let questions;
try {
  questions = JSON.parse(raw);
} catch (error) {
  console.error(`Invalid JSON in ${questionPath}`);
  throw error;
}

const errors = validateQuestions(questions, config, { raw });

if (errors.length > 0) {
  console.error(`${config.label} question validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(
    `${config.label} question validation passed (${questions.length} questions checked).`
  );
}
