import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildVariantComparison,
  buildVariantGroupIndex,
  getChoiceTextMultiset,
  getVariantGroupMembers,
  searchVariantAuthoringQuestions,
} from '../tools/dep-question-authoring/variant-authoring.js';

const source = JSON.parse(
  await readFile(new URL('../dep-quiz-app/questions.json', import.meta.url))
);
const snapshot = JSON.stringify(source);
const groups = buildVariantGroupIndex(source);
const productionGroup = groups.find((group) => group.id === 'auto-loader-state-locations');
assert.deepEqual(
  productionGroup.members.map((item) => item.id),
  ['DEP-Q292', 'DEP-Q293']
);
assert.equal(
  groups.some((group) => group.id == null),
  false
);
assert.deepEqual(getVariantGroupMembers(source, productionGroup.id), productionGroup.members);
assert.equal(searchVariantAuthoringQuestions(source, 'q293')[0].id, 'DEP-Q293');
assert.equal(
  searchVariantAuthoringQuestions(source, 'auto-loader-state-locations').some(
    (q) => q.id === 'DEP-Q293'
  ),
  true
);
assert.deepEqual(
  getChoiceTextMultiset(productionGroup.members[0]),
  getChoiceTextMultiset(productionGroup.members[1])
);
assert.equal(buildVariantComparison(productionGroup.members)[0].followUpTargetId, 'DEP-Q294');
assert.equal(JSON.stringify(source), snapshot, 'read model must not mutate source questions');

const duplicates = { choices: { B: ' same ', A: 'same', C: 'Case' } };
assert.deepEqual(getChoiceTextMultiset(duplicates), ['Case', 'same', 'same']);
console.log('dep question authoring tests passed');
