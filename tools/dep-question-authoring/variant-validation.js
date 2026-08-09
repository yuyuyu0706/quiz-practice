import { getAppConfig, validateQuestions } from '../../scripts/question-validator.mjs';

const depConfig = getAppConfig('dep');

export function serializeQuestions(questions) {
  return `${JSON.stringify(questions, null, 2)}\n`;
}

export function validateWorkingQuestions(questions) {
  const raw = serializeQuestions(questions);
  const errors = validateQuestions(questions, depConfig, { raw });
  return { valid: errors.length === 0, errors, raw };
}

export function buildQuestionsExport(questions) {
  const validation = validateWorkingQuestions(questions);
  return validation.valid
    ? {
        ok: true,
        filename: 'questions.json',
        content: validation.raw,
        mimeType: 'application/json',
        errors: [],
      }
    : { ok: false, errors: validation.errors };
}
