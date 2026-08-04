import assert from 'node:assert/strict';
import { getAppConfig, validateQuestions } from './question-validator.mjs';

function baseQuestion(overrides = {}) {
  return {
    id: 'fixture-1',
    section: 'Fixture Section',
    sectionTitle: 'Fixture Section Title',
    question: 'Which option is correct?',
    choices: {
      A: 'Correct option',
      B: 'Incorrect option B',
      C: 'Incorrect option C',
      D: 'Incorrect option D',
    },
    answer: 'A',
    explanation: 'A is correct.',
    references: [
      {
        title: 'Fixture reference',
        url: 'https://example.com/reference',
      },
    ],
    ...overrides,
  };
}

function validate(appName, question) {
  const normalizedQuestion =
    appName === 'dea-plus' && question.id === 'fixture-1'
      ? { ...question, id: 'DEA-PLUS-Q099' }
      : question;
  return validateQuestions([normalizedQuestion], getAppConfig(appName));
}

function validateMany(appName, questions, options) {
  return validateQuestions(questions, getAppConfig(appName), options);
}

function assertValid(appName, question, description) {
  assert.deepEqual(validate(appName, question), [], description);
}

function assertInvalid(appName, question, description) {
  assert.notDeepEqual(validate(appName, question), [], description);
}

assertValid('dea', baseQuestion(), 'DEA accepts legacy A-D single-answer questions.');
assertValid('dep', baseQuestion(), 'DEP accepts legacy A-D single-answer questions.');

assertInvalid('dea', baseQuestion({ answers: ['A', 'C'] }), 'DEA rejects answers arrays.');
assertInvalid(
  'dea',
  baseQuestion({ choices: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' } }),
  'DEA rejects choices.E.'
);

assertValid(
  'dea-plus',
  baseQuestion({ id: 'DEA-PLUS-Q001' }),
  'DEA Plus accepts A-D single-answer questions with DEA Plus IDs.'
);
assertInvalid('dea-plus', baseQuestion({ id: 'Q1' }), 'DEA Plus rejects legacy Q-number IDs.');
assertValid(
  'dea-plus',
  baseQuestion({
    id: 'DEA-PLUS-Q002',
    choices: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' },
    answer: 'E',
  }),
  'DEA Plus accepts choices.E for single-answer questions.'
);
assertValid(
  'dea-plus',
  baseQuestion({ id: 'DEA-PLUS-Q003', answer: undefined, answers: ['A', 'C'] }),
  'DEA Plus accepts answers arrays for multiple-answer questions.'
);

assertInvalid(
  'dea-plus',
  baseQuestion({ answers: ['A', 'C'] }),
  'DEA Plus rejects answer and answers together.'
);
assertInvalid(
  'dea-plus',
  baseQuestion({ answer: undefined, answers: [] }),
  'DEA Plus rejects empty answers arrays.'
);
assertInvalid(
  'dea-plus',
  baseQuestion({ answer: undefined, answers: ['A', 'A'] }),
  'DEA Plus rejects duplicate answers.'
);
assertInvalid(
  'dea-plus',
  baseQuestion({ answer: undefined, answers: ['A', 'E'] }),
  'DEA Plus rejects answers outside the available choices.'
);
assertInvalid(
  'dea-plus',
  baseQuestion({ whyWrong: { E: 'E is not a displayed option.' } }),
  'DEA Plus rejects whyWrong keys outside choices.'
);
assertInvalid(
  'dea-plus',
  baseQuestion({ whyWrong: { A: 'A is correct, not wrong.' } }),
  'DEA Plus rejects whyWrong for a single correct answer.'
);
assertInvalid(
  'dea-plus',
  baseQuestion({ answer: undefined, answers: ['A', 'C'], whyWrong: { C: 'C is correct.' } }),
  'DEA Plus rejects whyWrong for any multiple-answer correct key.'
);
assertInvalid(
  'dea-plus',
  baseQuestion({ whyWrong: { B: '   ' } }),
  'DEA Plus rejects empty whyWrong values.'
);
assertInvalid(
  'dea-plus',
  baseQuestion({ type: 'single' }),
  'DEA Plus rejects the initial Phase 2 type field.'
);

const variantChoices = {
  A: 'schemaLocation',
  B: 'checkpointLocation',
  C: 'badRecordsPath',
  D: 'maxFilesPerTrigger',
};
const reorderedVariantChoices = {
  A: 'maxFilesPerTrigger',
  B: 'badRecordsPath',
  C: 'checkpointLocation',
  D: ' schemaLocation ',
};

assert.deepEqual(
  validateMany('dep', [
    baseQuestion({ id: 'variant-1', choices: variantChoices, variantGroup: 'auto-loader' }),
    baseQuestion({
      id: 'variant-2',
      choices: reorderedVariantChoices,
      answer: 'C',
      variantGroup: 'auto-loader',
    }),
  ]),
  [],
  'DEP accepts variant groups whose trimmed choice text multisets match.'
);

assert.deepEqual(
  validateMany('dep', [
    baseQuestion({ id: 'source-1', followUp: { questionId: 'target' } }),
    baseQuestion({ id: 'source-2', followUp: { questionId: 'target' } }),
    baseQuestion({ id: 'target' }),
  ]),
  [],
  'DEP accepts multiple questions sharing a one-level follow-up target.'
);

assert.deepEqual(
  validateMany('dea', [baseQuestion({ variantGroup: 'unsupported' })]),
  ['Question (index 0, id: fixture-1) variantGroup is not supported for DEA.'],
  'DEA rejects DEP relation fields without applying their internal validation.'
);
assert.deepEqual(
  validateMany('dea-plus', [
    baseQuestion({ id: 'DEA-PLUS-Q001', followUp: { questionId: 'missing' } }),
  ]),
  ['Question (index 0, id: DEA-PLUS-Q001) followUp is not supported for DEA Plus.'],
  'DEA Plus rejects DEP relation fields without derived errors.'
);

[
  [42, 'variantGroup must be a non-empty string when present.'],
  ['', 'variantGroup must be a non-empty string when present.'],
  [' group', 'variantGroup must not have leading or trailing whitespace.'],
].forEach(([variantGroup, message]) => {
  assert.deepEqual(validateMany('dep', [baseQuestion({ variantGroup })]), [
    `Question (index 0, id: fixture-1) ${message}`,
  ]);
});

assert.deepEqual(validateMany('dep', [baseQuestion({ variantGroup: 'singleton' })]), [
  'Question (index 0, id: fixture-1) variantGroup singleton must contain at least two questions.',
]);
assert.deepEqual(
  validateMany('dep', [
    baseQuestion({ id: 'v1', choices: variantChoices, variantGroup: 'different' }),
    baseQuestion({
      id: 'v2',
      choices: { ...variantChoices, D: 'different text' },
      variantGroup: 'different',
    }),
  ]),
  ['Question (index 0, id: v1) variantGroup different must use the same choice text multiset.'],
  'Variant comparison preserves meaningful text differences.'
);
assert.deepEqual(
  validateMany('dep', [
    baseQuestion({
      id: 'v1',
      choices: { A: 'same', B: 'same', C: 'third', D: 'fourth' },
      variantGroup: 'duplicates',
    }),
    baseQuestion({
      id: 'v2',
      choices: { A: 'same', B: 'second', C: 'third', D: 'fourth' },
      variantGroup: 'duplicates',
    }),
  ]),
  ['Question (index 0, id: v1) variantGroup duplicates must use the same choice text multiset.'],
  'Variant comparison preserves duplicate counts.'
);

const followUpCases = [
  [null, 'followUp must be a plain object when present.'],
  [[], 'followUp must be a plain object when present.'],
  [{}, 'followUp is missing required field: questionId.'],
  [{ questionId: 4 }, 'followUp.questionId must be a non-empty string.'],
  [{ questionId: '' }, 'followUp.questionId must be a non-empty string.'],
  [{ questionId: ' target' }, 'followUp.questionId must not have leading or trailing whitespace.'],
  [{ questionId: 'fixture-1' }, 'followUp.questionId must not reference the same question.'],
  [
    { questionId: 'target', trigger: 'incorrect' },
    'followUp only supports questionId; found trigger.',
  ],
];
followUpCases.forEach(([followUp, message]) => {
  assert.deepEqual(validateMany('dep', [baseQuestion({ followUp })]), [
    `Question (index 0, id: fixture-1) ${message}`,
  ]);
});

assert.deepEqual(validateMany('dep', [baseQuestion({ followUp: { questionId: 'missing' } })]), [
  'Question (index 0, id: fixture-1) followUp references unknown question id: missing.',
]);
assert.deepEqual(
  validateMany('dep', [
    baseQuestion({ id: 'A', followUp: { questionId: 'B' } }),
    baseQuestion({ id: 'B', followUp: { questionId: 'C' } }),
    baseQuestion({ id: 'C' }),
  ]),
  ['Question (index 0, id: A) followUp target B must not define another followUp.']
);
assert.deepEqual(
  validateMany('dep', [
    baseQuestion({ id: 'A', followUp: { questionId: 'B' } }),
    baseQuestion({ id: 'B', followUp: { questionId: 'A' } }),
  ]),
  [
    'Question (index 0, id: A) followUp must not form a cycle with question B.',
    'Question (index 1, id: B) followUp must not form a cycle with question A.',
  ],
  'Cycle errors take precedence over chain errors in input order.'
);

const rawWithLines = `[
  {
    "id": "line-source"
  }
]`;
assert.deepEqual(
  validateMany('dep', [baseQuestion({ id: 'line-source', followUp: { questionId: 'missing' } })], {
    raw: rawWithLines,
  }),
  ['Question (index 0, id: line-source, line 3) followUp references unknown question id: missing.'],
  'Relation errors retain existing line context.'
);

assert.deepEqual(
  validateMany('dep', [
    baseQuestion({ id: 'duplicate', followUp: { questionId: 'duplicate-target' } }),
    baseQuestion({ id: 'duplicate' }),
    baseQuestion({ id: 'duplicate-target' }),
    baseQuestion({ id: 'duplicate-target' }),
  ]),
  [
    'Question (index 1, id: duplicate) has a duplicate id: duplicate.',
    'Question (index 3, id: duplicate-target) has a duplicate id: duplicate-target.',
  ],
  'Duplicate IDs suppress ambiguous relation-resolution errors.'
);

console.log('Question validator unit tests passed.');
