import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildVariantComparison,
  buildVariantGroupIndex,
  findUngroupedVariantCandidates,
  getChoiceTextMultiset,
  getVariantGroupMembers,
  searchVariantAuthoringQuestions,
  searchVariantGroups,
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
const q293Groups = searchVariantGroups(source, 'q293');
assert.equal(q293Groups.length, 1);
assert.equal(q293Groups[0].id, 'auto-loader-state-locations');
assert.deepEqual(
  q293Groups[0].members.map((question) => question.id),
  ['DEP-Q292', 'DEP-Q293']
);
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

const candidateSource = [
  { id: 'seed', choices: { A: ' Alpha ', B: 'Beta', C: 'Alpha' } },
  { id: 'exact-1', choices: { C: 'Alpha', B: 'Alpha', A: 'Beta' } },
  { id: 'case-diff', choices: { A: 'alpha', B: 'Beta', C: 'Alpha' } },
  { id: 'punctuation-diff', choices: { A: 'Alpha!', B: 'Beta', C: 'Alpha' } },
  { id: 'space-diff', choices: { A: 'Al pha', B: 'Beta', C: 'Alpha' } },
  {
    id: 'grouped-exact',
    choices: { A: 'Alpha', B: 'Beta', C: 'Alpha' },
    variantGroup: 'existing',
  },
  { id: 'exact-2', choices: { A: 'Beta', B: ' Alpha', C: 'Alpha ' } },
];
const candidateSnapshot = JSON.stringify(candidateSource);
assert.deepEqual(
  findUngroupedVariantCandidates(candidateSource, 'seed').map((question) => question.id),
  ['exact-1', 'exact-2'],
  'candidates must preserve input order and exact duplicate-preserving multiset matching'
);
assert.throws(
  () => findUngroupedVariantCandidates(candidateSource, 'grouped-exact'),
  /already belongs/
);
assert.throws(() => findUngroupedVariantCandidates(candidateSource, 'missing'), /was not found/);
assert.equal(
  JSON.stringify(candidateSource),
  candidateSnapshot,
  'candidate lookup must be read-only'
);
console.log('dep question authoring tests passed');
