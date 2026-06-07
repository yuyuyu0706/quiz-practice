import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const fixtureConfigs = [
  {
    path: resolve('tests/e2e/fixtures/dea-plus-markdown-questions.json'),
    allowWhyWrong: false,
    requiredMarkdownCoverage: ['inlineCode', 'codeFence', 'strong', 'list'],
  },
  {
    path: resolve('tests/e2e/fixtures/dea-plus-why-wrong-questions.json'),
    allowWhyWrong: true,
    requiredMarkdownCoverage: ['inlineCode', 'strong'],
  },
];
const requiredFields = [
  'id',
  'section',
  'sectionTitle',
  'question',
  'choices',
  'answer',
  'explanation',
];
const answerLabels = ['A', 'B', 'C', 'D'];
const phase2OnlyFields = new Set([
  'type',
  'questionType',
  'selectionType',
  'answers',
  'correctAnswer',
  'correctAnswers',
  'correctChoice',
  'correctChoices',
  'correctChoiceKeys',
  'answerCount',
]);

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

function collectQuestionText(question) {
  const choiceText = isPlainObject(question.choices)
    ? Object.values(question.choices).join('\n')
    : '';
  const whyWrongText = isPlainObject(question.whyWrong)
    ? Object.values(question.whyWrong).join('\n')
    : '';
  return [question.question, choiceText, question.explanation, whyWrongText]
    .filter(Boolean)
    .join('\n');
}

function hasInlineCode(text) {
  const withoutCodeFences = text.replace(/```[\s\S]*?```/g, '');
  return /`[^`\n]+`/.test(withoutCodeFences);
}

function hasCodeFence(text) {
  return /```\s*[a-zA-Z0-9_-]*\s*\n[\s\S]+?\n?```/.test(text);
}

function hasStrong(text) {
  return /\*\*[^*\n][\s\S]*?\*\*/.test(text);
}

function hasList(text) {
  return /^\s*-\s+\S+/m.test(text);
}

function validateQuestion(question, index, errors, markdownCoverage, options) {
  const label = `question[${index}]${isNonEmptyString(question?.id) ? ` (${question.id})` : ''}`;

  if (!isPlainObject(question)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  for (const field of requiredFields) {
    if (!(field in question)) {
      errors.push(`${label} is missing required field: ${field}.`);
    }
  }

  for (const field of Object.keys(question)) {
    if (phase2OnlyFields.has(field) || (field === 'whyWrong' && !options.allowWhyWrong)) {
      errors.push(`${label} must not include Phase 2-only field: ${field}.`);
    }
  }

  for (const field of ['id', 'section', 'sectionTitle', 'question']) {
    if (!isNonEmptyString(question[field])) {
      errors.push(`${label}.${field} must be a non-empty string.`);
    }
  }

  if (typeof question.explanation !== 'string') {
    errors.push(`${label}.explanation must be a string.`);
  }

  if (!isPlainObject(question.choices)) {
    errors.push(`${label}.choices must be an object.`);
  } else {
    const choiceKeys = Object.keys(question.choices).sort();
    if (
      choiceKeys.length !== answerLabels.length ||
      !answerLabels.every((choiceKey) => choiceKeys.includes(choiceKey))
    ) {
      errors.push(`${label}.choices must contain exactly A/B/C/D for current DEA Plus schema.`);
    }

    for (const choiceKey of answerLabels) {
      if (!isNonEmptyString(question.choices[choiceKey])) {
        errors.push(`${label}.choices.${choiceKey} must be a non-empty string.`);
      }
    }
  }

  if (Array.isArray(question.answer)) {
    errors.push(`${label}.answer must be a single string, not an array.`);
  } else if (!isNonEmptyString(question.answer)) {
    errors.push(`${label}.answer must be a non-empty string.`);
  } else if (!isPlainObject(question.choices) || !(question.answer in question.choices)) {
    errors.push(`${label}.answer must exist as a key in choices.`);
  }

  if ('whyWrong' in question && question.whyWrong !== undefined && options.allowWhyWrong) {
    if (!isPlainObject(question.whyWrong)) {
      errors.push(`${label}.whyWrong must be an object when present.`);
    } else if (isPlainObject(question.choices)) {
      Object.entries(question.whyWrong).forEach(([choiceKey, reason]) => {
        if (!(choiceKey in question.choices)) {
          errors.push(`${label}.whyWrong.${choiceKey} must reference an existing choice key.`);
        }
        if (choiceKey === question.answer) {
          errors.push(`${label}.whyWrong must not include the correct answer key ${choiceKey}.`);
        }
        if (!isNonEmptyString(reason)) {
          errors.push(`${label}.whyWrong.${choiceKey} must be a non-empty string.`);
        }
      });
    }
  }

  if ('references' in question && question.references !== undefined) {
    if (!Array.isArray(question.references)) {
      errors.push(`${label}.references must be an array when present.`);
    } else {
      question.references.forEach((reference, referenceIndex) => {
        const referenceLabel = `${label}.references[${referenceIndex}]`;
        if (!isPlainObject(reference)) {
          errors.push(`${referenceLabel} must be an object.`);
          return;
        }
        if (!isNonEmptyString(reference.title)) {
          errors.push(`${referenceLabel}.title must be a non-empty string.`);
        }
        if (!isNonEmptyString(reference.url)) {
          errors.push(`${referenceLabel}.url must be a non-empty string.`);
        }
      });
    }
  }

  const markdownText = collectQuestionText(question);
  markdownCoverage.inlineCode ||= hasInlineCode(markdownText);
  markdownCoverage.codeFence ||= hasCodeFence(markdownText);
  markdownCoverage.strong ||= hasStrong(markdownText);
  markdownCoverage.list ||= hasList(markdownText);
}

let totalQuestions = 0;
const allErrors = [];

for (const fixtureConfig of fixtureConfigs) {
  const fixturePath = fixtureConfig.path;
  const displayPath = relative(process.cwd(), fixturePath);
  const errors = [];
  const markdownCoverage = {
    inlineCode: false,
    codeFence: false,
    strong: false,
    list: false,
  };

  let questions;
  try {
    questions = JSON.parse(await readFile(fixturePath, 'utf8'));
  } catch (error) {
    allErrors.push(`${displayPath}: failed to read or parse JSON: ${error.message}`);
    continue;
  }

  if (!Array.isArray(questions)) {
    errors.push('fixture must be an array of questions.');
  } else if (questions.length === 0) {
    errors.push('fixture must include at least one question.');
  } else {
    questions.forEach((question, index) =>
      validateQuestion(question, index, errors, markdownCoverage, fixtureConfig)
    );
    totalQuestions += questions.length;
  }

  for (const feature of fixtureConfig.requiredMarkdownCoverage) {
    if (!markdownCoverage[feature]) {
      errors.push(`fixture must include Markdown coverage for ${feature}.`);
    }
  }

  allErrors.push(...errors.map((error) => `${displayPath}: ${error}`));
}

if (allErrors.length > 0) {
  console.error(`DEA Plus E2E fixture validation failed with ${allErrors.length} error(s):`);
  for (const error of allErrors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `DEA Plus E2E fixture validation passed (${fixtureConfigs.length} fixture file(s), ${totalQuestions} question(s) checked).`
  );
}
