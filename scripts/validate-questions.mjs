import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appName = process.argv[2] ?? 'dea';
const supportedApps = new Set(['dea', 'dep']);

if (!supportedApps.has(appName)) {
  throw new Error(`Unsupported app name: ${appName}. Use one of ${Array.from(supportedApps).join(', ')}.`);
}

const questionPath = resolve(`${appName}-quiz-app/questions.json`);
const raw = await readFile(questionPath, 'utf8');

let questions;
try {
  questions = JSON.parse(raw);
} catch (error) {
  console.error(`Invalid JSON in ${questionPath}`);
  throw error;
}

if (!Array.isArray(questions)) {
  throw new Error('questions.json must export an array of questions.');
}

const requiredFields = ['id', 'section', 'sectionTitle', 'question', 'choices', 'answer', 'explanation'];
const answerLabels = ['A', 'B', 'C', 'D'];
const difficultyValues = ['easy', 'medium', 'hard'];
const sourceTypeValues = ['original', 'official-inspired', 'scenario-based'];
const scenarioTypeValues = ['single-step', 'multi-step', 'architecture', 'troubleshooting'];
const ids = new Set();
const errors = [];

const getLineNumber = (content, startIndex) => content.slice(0, startIndex).split('\n').length;
const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idLineHints = new Map();
const idPattern = /"id"\s*:\s*"([^"]+)"/g;

for (const match of raw.matchAll(idPattern)) {
  const [, id] = match;
  const line = getLineNumber(raw, match.index ?? 0);
  const lineHints = idLineHints.get(id) ?? [];
  lineHints.push(line);
  idLineHints.set(id, lineHints);
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

questions.forEach((question, index) => {
  const questionId = isPlainObject(question) && typeof question.id === 'string' ? question.id : null;
  let lineNumber;
  if (questionId) {
    const idLines = idLineHints.get(questionId);
    if (idLines && idLines.length > 0) {
      lineNumber = idLines.shift();
    } else {
      const idRegex = new RegExp(`"id"\\s*:\\s*"${escaped(questionId)}"`);
      const fallbackMatchIndex = raw.search(idRegex);
      if (fallbackMatchIndex >= 0) {
        lineNumber = getLineNumber(raw, fallbackMatchIndex);
      }
    }
  }
  const contextSegments = [`index ${index}`];
  if (questionId) {
    contextSegments.push(`id: ${questionId}`);
  }
  if (lineNumber !== undefined) {
    contextSegments.push(`line ${lineNumber}`);
  }
  const label = `Question (${contextSegments.join(', ')})`;

  if (!isPlainObject(question)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  requiredFields.forEach((field) => {
    if (!(field in question)) {
      errors.push(`${label} is missing required field: ${field}.`);
    }
  });

  if (!isNonEmptyString(question.id)) {
    errors.push(`${label} must have a non-empty string id.`);
  } else if (ids.has(question.id)) {
    errors.push(`${label} has a duplicate id: ${question.id}.`);
  } else {
    ids.add(question.id);
  }

  if (!isNonEmptyString(question.section)) {
    errors.push(`${label} must have a non-empty string section.`);
  }

  if (!isNonEmptyString(question.sectionTitle)) {
    errors.push(`${label} must have a non-empty string sectionTitle.`);
  }

  if (!isNonEmptyString(question.question)) {
    errors.push(`${label} must have a non-empty string question.`);
  }

  if (typeof question.explanation !== 'string') {
    errors.push(`${label} must have a string explanation.`);
  }

  if (!isPlainObject(question.choices)) {
    errors.push(`${label} must have a choices object.`);
  } else {
    const choiceKeys = Object.keys(question.choices).sort();
    if (choiceKeys.length !== answerLabels.length || !answerLabels.every((key) => choiceKeys.includes(key))) {
      errors.push(`${label} choices must contain exactly A/B/C/D.`);
    }

    answerLabels.forEach((choiceKey) => {
      if (!isNonEmptyString(question.choices[choiceKey])) {
        errors.push(`${label} choices.${choiceKey} must be a non-empty string.`);
      }
    });
  }

  if (!answerLabels.includes(question.answer)) {
    errors.push(`${label} answer must be one of A/B/C/D.`);
  }

  if ('references' in question && question.references !== undefined) {
    if (!Array.isArray(question.references)) {
      errors.push(`${label} references must be an array when present.`);
    } else {
      question.references.forEach((reference, referenceIndex) => {
        const referenceLabel = `${label} references[${referenceIndex}]`;
        if (!isPlainObject(reference)) {
          errors.push(`${referenceLabel} must be an object.`);
          return;
        }
        if (!isNonEmptyString(reference.title)) {
          errors.push(`${referenceLabel} must include a non-empty string title.`);
        }
        if (!isNonEmptyString(reference.url)) {
          errors.push(`${referenceLabel} must include a non-empty string url.`);
        }
      });
    }
  }

  if ('domain' in question && question.domain !== undefined && !isNonEmptyString(question.domain)) {
    errors.push(`${label} domain must be a non-empty string when present.`);
  }

  if ('tags' in question && question.tags !== undefined) {
    if (!Array.isArray(question.tags)) {
      errors.push(`${label} tags must be an array when present.`);
    } else {
      question.tags.forEach((tag, tagIndex) => {
        if (!isNonEmptyString(tag)) {
          errors.push(`${label} tags[${tagIndex}] must be a non-empty string.`);
        }
      });
    }
  }

  if ('difficulty' in question && question.difficulty !== undefined && !difficultyValues.includes(question.difficulty)) {
    errors.push(`${label} difficulty must be one of ${difficultyValues.join('/')}.`);
  }

  if ('sourceType' in question && question.sourceType !== undefined && !sourceTypeValues.includes(question.sourceType)) {
    errors.push(`${label} sourceType must be one of ${sourceTypeValues.join('/')}.`);
  }

  if ('whyWrong' in question && question.whyWrong !== undefined) {
    if (!isPlainObject(question.whyWrong)) {
      errors.push(`${label} whyWrong must be an object when present.`);
    } else {
      Object.entries(question.whyWrong).forEach(([choiceKey, reason]) => {
        if (!answerLabels.includes(choiceKey)) {
          errors.push(`${label} whyWrong key ${choiceKey} must be one of A/B/C/D.`);
        }
        if (choiceKey === question.answer) {
          errors.push(`${label} whyWrong must not define the correct answer ${choiceKey}.`);
        }
        if (!isNonEmptyString(reason)) {
          errors.push(`${label} whyWrong.${choiceKey} must be a non-empty string.`);
        }
      });
    }
  }

  if ('notes' in question && question.notes !== undefined && typeof question.notes !== 'string') {
    errors.push(`${label} notes must be a string when present.`);
  }

  if ('scenarioType' in question && question.scenarioType !== undefined && !scenarioTypeValues.includes(question.scenarioType)) {
    errors.push(`${label} scenarioType must be one of ${scenarioTypeValues.join('/')}.`);
  }

  if ('estimatedTimeSec' in question && question.estimatedTimeSec !== undefined) {
    if (!Number.isInteger(question.estimatedTimeSec) || question.estimatedTimeSec <= 0) {
      errors.push(`${label} estimatedTimeSec must be a positive integer when present.`);
    }
  }
});

if (errors.length > 0) {
  console.error(`${appName.toUpperCase()} question validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`${appName.toUpperCase()} question validation passed (${questions.length} questions checked).`);
}
