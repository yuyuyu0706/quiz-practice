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
  return validateQuestions([question], getAppConfig(appName));
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

assertValid('dea-plus', baseQuestion(), 'DEA Plus accepts A-D single-answer questions.');
assertValid(
  'dea-plus',
  baseQuestion({ choices: { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E' }, answer: 'E' }),
  'DEA Plus accepts choices.E for single-answer questions.'
);
assertValid(
  'dea-plus',
  baseQuestion({ answer: undefined, answers: ['A', 'C'] }),
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

console.log('Question validator unit tests passed.');
