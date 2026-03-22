import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const questionPath = resolve('dea-quiz-app/questions.json');
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
const ids = new Set();
const errors = [];

questions.forEach((question, index) => {
  const label = `Question at index ${index}`;

  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  requiredFields.forEach((field) => {
    if (!(field in question)) {
      errors.push(`${label} is missing required field: ${field}.`);
    }
  });

  if (typeof question.id !== 'string' || question.id.trim() === '') {
    errors.push(`${label} must have a non-empty string id.`);
  } else if (ids.has(question.id)) {
    errors.push(`${label} has a duplicate id: ${question.id}.`);
  } else {
    ids.add(question.id);
  }

  if (typeof question.section !== 'string' || question.section.trim() === '') {
    errors.push(`${label} must have a non-empty string section.`);
  }

  if (typeof question.sectionTitle !== 'string' || question.sectionTitle.trim() === '') {
    errors.push(`${label} must have a non-empty string sectionTitle.`);
  }

  if (typeof question.question !== 'string' || question.question.trim() === '') {
    errors.push(`${label} must have a non-empty string question.`);
  }

  if (typeof question.explanation !== 'string') {
    errors.push(`${label} must have a string explanation.`);
  }

  if (!question.choices || typeof question.choices !== 'object' || Array.isArray(question.choices)) {
    errors.push(`${label} must have a choices object.`);
  } else {
    const choiceKeys = Object.keys(question.choices).sort();
    if (choiceKeys.length !== answerLabels.length || !answerLabels.every((key) => choiceKeys.includes(key))) {
      errors.push(`${label} choices must contain exactly A/B/C/D.`);
    }

    answerLabels.forEach((choiceKey) => {
      if (typeof question.choices[choiceKey] !== 'string' || question.choices[choiceKey].trim() === '') {
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
        if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
          errors.push(`${referenceLabel} must be an object.`);
          return;
        }
        if (typeof reference.title !== 'string' || reference.title.trim() === '') {
          errors.push(`${referenceLabel} must include a non-empty string title.`);
        }
        if (typeof reference.url !== 'string' || reference.url.trim() === '') {
          errors.push(`${referenceLabel} must include a non-empty string url.`);
        }
      });
    }
  }
});

if (errors.length > 0) {
  console.error(`DEA question validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`DEA question validation passed (${questions.length} questions checked).`);
}
