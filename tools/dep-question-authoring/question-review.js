const CHOICE_KEYS = ['A', 'B', 'C', 'D'];

const DIFF_PATHS = [
  'section',
  'sectionTitle',
  'domain',
  'tags',
  'difficulty',
  'sourceType',
  'scenarioType',
  'estimatedTimeSec',
  'question',
  ...CHOICE_KEYS.map((key) => `choices.${key}`),
  'answer',
  'explanation',
  ...CHOICE_KEYS.map((key) => `whyWrong.${key}`),
  'references',
  'notes',
  'variantGroup',
  'followUp.questionId',
];

function valueAt(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object);
}

function exactEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function text(value) {
  return value == null ? '' : String(value);
}

export function buildQuestionPreview(question = {}) {
  const answer = text(question.answer);
  return {
    id: text(question.id),
    question: text(question.question),
    choices: CHOICE_KEYS.map((label) => ({
      label,
      text: text(question.choices?.[label]),
      correct: label === answer,
    })),
    answer,
    answerValid: CHOICE_KEYS.includes(answer),
    explanation: text(question.explanation),
    whyWrong: CHOICE_KEYS.map((label) => ({ label, text: text(question.whyWrong?.[label]) })),
    metadata: {
      section: text(question.section),
      sectionTitle: text(question.sectionTitle),
      domain: text(question.domain),
      tags: Array.isArray(question.tags) ? question.tags.map(text) : [],
      difficulty: text(question.difficulty),
      sourceType: text(question.sourceType),
      scenarioType: text(question.scenarioType),
      estimatedTimeSec: text(question.estimatedTimeSec),
      notes: text(question.notes),
    },
    references: Array.isArray(question.references)
      ? question.references.map((reference) => ({
          title: text(reference?.title),
          url: text(reference?.url),
        }))
      : [],
    relations: {
      variantGroup: text(question.variantGroup),
      followUpQuestionId: text(question.followUp?.questionId),
    },
  };
}

export function buildQuestionDiff(sourceQuestion, workingQuestion = {}) {
  if (!sourceQuestion) return { status: 'New', changedFields: DIFF_PATHS.slice() };
  const changedFields = DIFF_PATHS.filter(
    (path) => !exactEqual(valueAt(sourceQuestion, path), valueAt(workingQuestion, path))
  );
  return { status: changedFields.length ? 'Modified' : 'Unchanged', changedFields };
}

export function getQuestionRelatedValidationErrors(
  question = {},
  _questions = [],
  validationErrors = []
) {
  const identifiers = new Set([text(question.id), text(question.variantGroup)].filter(Boolean));
  return [...new Set(validationErrors.map(text))].filter((error) =>
    [...identifiers].some((identifier) => error.includes(identifier))
  );
}

export function buildQuestionReviewModel({
  sourceQuestion,
  workingQuestion = {},
  workingQuestions = [],
  validation = { valid: true, errors: [] },
} = {}) {
  return {
    preview: buildQuestionPreview(workingQuestion),
    diff: buildQuestionDiff(sourceQuestion, workingQuestion),
    validation: {
      valid: Boolean(validation.valid),
      totalErrors: Array.isArray(validation.errors) ? validation.errors.length : 0,
      relatedErrors: getQuestionRelatedValidationErrors(
        workingQuestion,
        workingQuestions,
        validation.errors
      ),
    },
  };
}
