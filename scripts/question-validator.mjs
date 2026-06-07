export const appConfigs = {
  dea: {
    label: 'DEA',
    questionPath: 'dea-quiz-app/questions.json',
    allowedChoiceLabels: ['A', 'B', 'C', 'D'],
    exactChoiceLabels: ['A', 'B', 'C', 'D'],
    allowSchemaV2: false,
    allowMultipleAnswers: false,
  },
  dep: {
    label: 'DEP',
    questionPath: 'dep-quiz-app/questions.json',
    allowedChoiceLabels: ['A', 'B', 'C', 'D'],
    exactChoiceLabels: ['A', 'B', 'C', 'D'],
    allowSchemaV2: false,
    allowMultipleAnswers: false,
  },
  'dea-plus': {
    label: 'DEA Plus',
    questionPath: 'dea-quiz-app-plus/questions.json',
    allowedChoiceLabels: ['A', 'B', 'C', 'D', 'E'],
    minChoices: 2,
    maxChoices: 5,
    allowSchemaV2: true,
    allowMultipleAnswers: true,
  },
};

const requiredFields = ['id', 'section', 'sectionTitle', 'question', 'choices', 'explanation'];
const difficultyValues = ['easy', 'medium', 'hard'];
const sourceTypeValues = ['original', 'official-inspired', 'scenario-based'];
const scenarioTypeValues = ['single-step', 'multi-step', 'architecture', 'troubleshooting'];

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const formatLabels = (labels) => labels.join('/');

const getLineNumber = (content, startIndex) => content.slice(0, startIndex).split('\n').length;
const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildIdLineHints(raw) {
  const idLineHints = new Map();
  if (!raw) {
    return idLineHints;
  }

  const idPattern = /"id"\s*:\s*"([^"]+)"/g;
  for (const match of raw.matchAll(idPattern)) {
    const [, id] = match;
    const line = getLineNumber(raw, match.index ?? 0);
    const lineHints = idLineHints.get(id) ?? [];
    lineHints.push(line);
    idLineHints.set(id, lineHints);
  }
  return idLineHints;
}

function createQuestionLabel(question, index, raw, idLineHints) {
  const questionId =
    isPlainObject(question) && typeof question.id === 'string' ? question.id : null;
  let lineNumber;

  if (questionId && raw) {
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

  return `Question (${contextSegments.join(', ')})`;
}

function validateChoices(question, config, label, errors) {
  if (!isPlainObject(question.choices)) {
    errors.push(`${label} must have a choices object.`);
    return [];
  }

  const choiceKeys = Object.keys(question.choices).sort();
  const allowedChoiceLabels = config.allowedChoiceLabels;

  if (config.exactChoiceLabels) {
    if (
      choiceKeys.length !== config.exactChoiceLabels.length ||
      !config.exactChoiceLabels.every((key) => choiceKeys.includes(key))
    ) {
      errors.push(
        `${label} choices must contain exactly ${formatLabels(config.exactChoiceLabels)}.`
      );
    }
  } else {
    const invalidKeys = choiceKeys.filter((key) => !allowedChoiceLabels.includes(key));
    if (invalidKeys.length > 0) {
      errors.push(
        `${label} choices keys must be one of ${formatLabels(allowedChoiceLabels)}; found ${invalidKeys.join(', ')}.`
      );
    }
    if (choiceKeys.length < config.minChoices || choiceKeys.length > config.maxChoices) {
      errors.push(
        `${label} choices must contain between ${config.minChoices} and ${config.maxChoices} options.`
      );
    }
  }

  choiceKeys.forEach((choiceKey) => {
    if (!isNonEmptyString(question.choices[choiceKey])) {
      errors.push(`${label} choices.${choiceKey} must be a non-empty string.`);
    }
  });

  return choiceKeys;
}

function validateAnswers(question, config, label, choiceKeys, errors) {
  const hasAnswer = 'answer' in question && question.answer !== undefined;
  const hasAnswers = 'answers' in question && question.answers !== undefined;
  const choiceKeySet = new Set(choiceKeys);
  const correctLabels = new Set();

  if (!config.allowMultipleAnswers) {
    if (!hasAnswer) {
      errors.push(`${label} is missing required field: answer.`);
    } else if (typeof question.answer !== 'string') {
      errors.push(`${label} answer must be a string.`);
    } else if (!config.allowedChoiceLabels.includes(question.answer)) {
      errors.push(`${label} answer must be one of ${formatLabels(config.allowedChoiceLabels)}.`);
    } else if (!choiceKeySet.has(question.answer)) {
      errors.push(`${label} answer must reference an existing choice key.`);
    } else {
      correctLabels.add(question.answer);
    }

    if (hasAnswers) {
      errors.push(`${label} answers is only supported for DEA Plus schema v2 questions.`);
    }
    return correctLabels;
  }

  if (hasAnswer && hasAnswers) {
    errors.push(`${label} must not define both answer and answers.`);
  }
  if (!hasAnswer && !hasAnswers) {
    errors.push(`${label} must define exactly one of answer or answers.`);
  }

  if (hasAnswer) {
    if (typeof question.answer !== 'string') {
      errors.push(`${label} answer must be a string.`);
    } else if (!choiceKeySet.has(question.answer)) {
      errors.push(`${label} answer must reference an existing choice key.`);
    } else {
      correctLabels.add(question.answer);
    }
  }

  if (hasAnswers) {
    if (!Array.isArray(question.answers)) {
      errors.push(`${label} answers must be an array.`);
    } else if (question.answers.length === 0) {
      errors.push(`${label} answers must include at least one choice key.`);
    } else {
      const seenAnswers = new Set();
      question.answers.forEach((answer, answerIndex) => {
        if (typeof answer !== 'string') {
          errors.push(`${label} answers[${answerIndex}] must be a string.`);
          return;
        }
        if (seenAnswers.has(answer)) {
          errors.push(`${label} answers must not contain duplicate choice key ${answer}.`);
        }
        seenAnswers.add(answer);
        if (!choiceKeySet.has(answer)) {
          errors.push(`${label} answers[${answerIndex}] must reference an existing choice key.`);
        } else {
          correctLabels.add(answer);
        }
      });
    }
  }

  return correctLabels;
}

function validateWhyWrong(question, config, label, choiceKeys, correctLabels, errors) {
  if (!('whyWrong' in question) || question.whyWrong === undefined) {
    return;
  }

  if (!isPlainObject(question.whyWrong)) {
    errors.push(`${label} whyWrong must be an object when present.`);
    return;
  }

  const choiceKeySet = new Set(choiceKeys);
  Object.entries(question.whyWrong).forEach(([choiceKey, reason]) => {
    if (!choiceKeySet.has(choiceKey)) {
      errors.push(`${label} whyWrong key ${choiceKey} must reference an existing choice key.`);
    }
    if (correctLabels.has(choiceKey)) {
      errors.push(`${label} whyWrong must not define the correct answer ${choiceKey}.`);
    }
    if (!isNonEmptyString(reason)) {
      errors.push(`${label} whyWrong.${choiceKey} must be a non-empty string.`);
    }
  });
}

export function getAppConfig(appName) {
  return appConfigs[appName];
}

export function getSupportedAppNames() {
  return Object.keys(appConfigs);
}

export function validateQuestions(questions, config, options = {}) {
  const errors = [];
  const ids = new Set();
  const raw = options.raw ?? '';
  const idLineHints = buildIdLineHints(raw);

  if (!config) {
    throw new Error('validateQuestions requires an app config.');
  }

  if (!Array.isArray(questions)) {
    return ['questions.json must export an array of questions.'];
  }

  questions.forEach((question, index) => {
    const label = createQuestionLabel(question, index, raw, idLineHints);

    if (!isPlainObject(question)) {
      errors.push(`${label} must be an object.`);
      return;
    }

    requiredFields.forEach((field) => {
      if (!(field in question)) {
        errors.push(`${label} is missing required field: ${field}.`);
      }
    });

    if ('type' in question && question.type !== undefined) {
      errors.push(
        `${label} type is not supported in the initial Phase 2 schema. Use answer or answers.`
      );
    }

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

    const choiceKeys = validateChoices(question, config, label, errors);
    const correctLabels = validateAnswers(question, config, label, choiceKeys, errors);

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

    if (
      'domain' in question &&
      question.domain !== undefined &&
      !isNonEmptyString(question.domain)
    ) {
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

    if (
      'difficulty' in question &&
      question.difficulty !== undefined &&
      !difficultyValues.includes(question.difficulty)
    ) {
      errors.push(`${label} difficulty must be one of ${difficultyValues.join('/')}.`);
    }

    if (
      'sourceType' in question &&
      question.sourceType !== undefined &&
      !sourceTypeValues.includes(question.sourceType)
    ) {
      errors.push(`${label} sourceType must be one of ${sourceTypeValues.join('/')}.`);
    }

    validateWhyWrong(question, config, label, choiceKeys, correctLabels, errors);

    if ('notes' in question && question.notes !== undefined && typeof question.notes !== 'string') {
      errors.push(`${label} notes must be a string when present.`);
    }

    if (
      'scenarioType' in question &&
      question.scenarioType !== undefined &&
      !scenarioTypeValues.includes(question.scenarioType)
    ) {
      errors.push(`${label} scenarioType must be one of ${scenarioTypeValues.join('/')}.`);
    }

    if ('estimatedTimeSec' in question && question.estimatedTimeSec !== undefined) {
      if (!Number.isInteger(question.estimatedTimeSec) || question.estimatedTimeSec <= 0) {
        errors.push(`${label} estimatedTimeSec must be a positive integer when present.`);
      }
    }
  });

  return errors;
}
