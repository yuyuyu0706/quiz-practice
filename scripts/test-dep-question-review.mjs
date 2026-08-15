import assert from 'node:assert/strict';
import {
  buildQuestionDiff,
  buildQuestionPreview,
  buildQuestionReviewModel,
  getQuestionRelatedValidationErrors,
} from '../tools/dep-question-authoring/question-review.js';

const base = {
  id: 'DEP-Q1',
  section: '1',
  sectionTitle: 'One',
  domain: 'domain',
  tags: ['first', 'second'],
  difficulty: 'medium',
  sourceType: 'original',
  scenarioType: 'single-step',
  estimatedTimeSec: 30,
  question: 'Question?',
  choices: { D: 'four', B: 'two', A: 'one', C: 'three' },
  answer: 'B',
  explanation: 'Because.',
  whyWrong: { A: 'no A', C: 'no C', D: 'no D' },
  references: [
    { title: 'First', url: 'https://example.test/1' },
    { title: 'Second', url: 'javascript:still-text' },
  ],
  notes: 'note',
  variantGroup: 'group-one',
  followUp: { questionId: 'DEP-Q3' },
};

const snapshot = JSON.stringify(base);
const preview = buildQuestionPreview(base);
assert.deepEqual(
  preview.choices.map(({ label }) => label),
  ['A', 'B', 'C', 'D'],
  'choices use fixed A-D order'
);
assert.equal(preview.choices.find(({ label }) => label === 'B').correct, true);
assert.deepEqual(
  preview.references.map(({ title }) => title),
  ['First', 'Second']
);
assert.equal(JSON.stringify(base), snapshot, 'preview does not mutate input');

const sparse = buildQuestionPreview({ id: 'DEP-QX', answer: 'Z' });
assert.equal(sparse.answerValid, false, 'invalid answers remain reviewable');
assert.deepEqual(sparse.metadata.tags, []);

assert.deepEqual(buildQuestionDiff(base, structuredClone(base)), {
  status: 'Unchanged',
  changedFields: [],
});
const modified = structuredClone(base);
modified.choices.B = 'changed';
modified.tags.reverse();
modified.references.reverse();
modified.followUp.questionId = 'DEP-Q4';
assert.deepEqual(buildQuestionDiff(base, modified), {
  status: 'Modified',
  changedFields: ['tags', 'choices.B', 'references', 'followUp.questionId'],
});
assert.equal(buildQuestionDiff(null, base).status, 'New');

const secondMember = { ...structuredClone(base), id: 'DEP-Q2' };
const errors = [
  'Question DEP-Q1 variantGroup group-one must use the same choice text multiset.',
  'Question DEP-Q9 question is required.',
  'Question DEP-Q2 answer must be one of A, B, C, or D.',
  'Question DEP-Q2 answer must be one of A, B, C, or D.',
];
assert.deepEqual(getQuestionRelatedValidationErrors(secondMember, [base, secondMember], errors), [
  errors[0],
  errors[2],
]);

const model = buildQuestionReviewModel({
  sourceQuestion: base,
  workingQuestion: secondMember,
  workingQuestions: [base, secondMember],
  validation: { valid: false, errors },
});
assert.equal(model.validation.valid, false);
assert.equal(model.validation.totalErrors, 4);
assert.equal(model.validation.relatedErrors.length, 2);
assert.equal(JSON.stringify(base), snapshot, 'all review helpers preserve input');

console.log('DEP Question Review tests passed.');
