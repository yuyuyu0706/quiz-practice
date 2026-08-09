import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  addQuestionToVariantGroup,
  cloneQuestions,
  createVariantGroup,
  removeQuestionFromVariantGroup,
  reconcileSelectedGroupId,
  renameVariantGroup,
  searchUngroupedQuestions,
} from '../tools/dep-question-authoring/variant-editing.js';
import {
  buildQuestionsExport,
  serializeQuestions,
  validateWorkingQuestions,
} from '../tools/dep-question-authoring/variant-validation.js';

const production = JSON.parse(
  await readFile(new URL('../dep-quiz-app/questions.json', import.meta.url))
);
const source = [
  { id: 'Q1', question: 'one', choices: { A: 'a' } },
  { id: 'Q2', question: 'two', choices: { A: 'a' } },
  { id: 'Q3', question: 'three', choices: { A: 'a' }, variantGroup: 'existing' },
  { id: 'Q4', question: 'four', choices: { A: 'a' }, variantGroup: 'existing' },
];
const snapshot = JSON.stringify(source);
const clone = cloneQuestions(source);
assert.notEqual(clone, source);
assert.notEqual(clone[0], source[0]);
assert.deepEqual(
  searchUngroupedQuestions(source, 'TWO').map((question) => question.id),
  ['Q2']
);
assert.deepEqual(
  searchUngroupedQuestions(source, 'q').map((question) => question.id),
  ['Q1', 'Q2']
);
assert.deepEqual(searchUngroupedQuestions(source, 'existing'), []);
assert.equal(reconcileSelectedGroupId(source, 'existing'), 'existing');
assert.equal(reconcileSelectedGroupId(source, 'removed-group'), 'existing');
assert.equal(reconcileSelectedGroupId(source.slice(0, 2), 'existing'), null);

const created = createVariantGroup(source, ['Q1', 'Q2'], 'new-group');
assert.deepEqual(
  created.slice(0, 2).map((q) => q.variantGroup),
  ['new-group', 'new-group']
);
assert.equal(JSON.stringify(source), snapshot);
assert.throws(() => createVariantGroup(source, ['Q1'], 'new'), /at least two/);
assert.throws(() => createVariantGroup(source, ['Q1', 'Q2'], ''), /non-empty/);
assert.throws(() => createVariantGroup(source, ['Q1', 'Q2'], ' new'), /whitespace/);
assert.throws(() => createVariantGroup(source, ['Q1', 'Q2'], 'existing'), /already exists/);
assert.throws(() => createVariantGroup(source, ['Q1', 'Q3'], 'new'), /already belongs/);

const added = addQuestionToVariantGroup(source, 'Q1', 'existing');
assert.equal(added[0].variantGroup, 'existing');
assert.throws(() => addQuestionToVariantGroup(source, 'Q3', 'existing'), /already belongs/);
const removed = removeQuestionFromVariantGroup(source, 'Q3');
assert.equal('variantGroup' in removed[2], false);
assert.equal(removed[3].variantGroup, 'existing', 'singleton groups must not be repaired');
const renamed = renameVariantGroup(source, 'existing', 'renamed');
assert.deepEqual(
  renamed.slice(2).map((q) => q.variantGroup),
  ['renamed', 'renamed']
);
assert.throws(() => renameVariantGroup(created, 'new-group', 'existing'), /already exists/);
assert.equal(JSON.stringify(source), snapshot);
for (const result of [created, added, removed, renamed]) {
  result.forEach((question, index) => {
    const { variantGroup: _before, ...before } = source[index];
    const { variantGroup: _after, ...after } = question;
    assert.deepEqual(after, before);
  });
}

const valid = validateWorkingQuestions(production);
assert.equal(valid.valid, true);
assert.equal(valid.raw, serializeQuestions(production));
const productionGroup = production.filter(
  (question) => question.variantGroup === 'auto-loader-state-locations'
);
const singleton = removeQuestionFromVariantGroup(production, productionGroup[1].id);
assert.equal(validateWorkingQuestions(singleton).valid, false);
const mismatch = cloneQuestions(production);
const mismatchMember = mismatch.find((question) => question.id === productionGroup[1].id);
mismatchMember.choices.A = 'definitely different';
assert.equal(validateWorkingQuestions(mismatch).valid, false);

const validExport = buildQuestionsExport(production);
assert.equal(validExport.ok, true);
assert.equal(validExport.filename, 'questions.json');
assert.equal(validExport.content, valid.raw);
assert.deepEqual(JSON.parse(validExport.content), production);
assert.equal('inspector' in JSON.parse(validExport.content), false);
assert.equal(buildQuestionsExport(singleton).ok, false);

console.log('dep question authoring editing tests passed');
