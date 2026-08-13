import assert from 'node:assert/strict';
import {
  buildCatalogFilterOptions,
  buildQuestionCatalog,
  filterQuestionCatalog,
  reconcileSelectedQuestionId,
} from '../tools/dep-question-authoring/question-catalog.js';

const questions = [
  {
    id: 'Q-2',
    question: 'Second',
    section: 2,
    domain: 'Beta',
    tags: ['Cloud'],
    difficulty: 'Hard',
    sourceType: 'Lab',
    variantGroup: 'group-a',
    choices: { A: 'a' },
    answer: 'A',
  },
  {
    id: 'Q-1',
    question: 'First cloud',
    section: 1,
    sectionTitle: 'Basics',
    domain: 'Alpha',
    tags: ['IAM'],
    difficulty: 'Easy',
    sourceType: 'Book',
    followUp: { questionId: 'Q-2' },
  },
  { id: 'Q-3' },
];
const snapshot = JSON.stringify(questions);

const catalog = buildQuestionCatalog(questions);
assert.deepEqual(
  catalog.map(({ id }) => id),
  ['Q-2', 'Q-1', 'Q-3'],
  'input order is retained'
);
assert.equal(catalog[0].grouped, true);
assert.equal(catalog[1].followUpTargetId, 'Q-2');
assert.deepEqual(catalog[2].tags, [], 'missing metadata is normalized safely');
assert.deepEqual(buildCatalogFilterOptions(questions), {
  section: ['1', '2'],
  domain: ['Alpha', 'Beta'],
  difficulty: ['Easy', 'Hard'],
  sourceType: ['Book', 'Lab'],
});
assert.deepEqual(
  filterQuestionCatalog(questions, { keyword: '  CLOUD ' }).map(({ id }) => id),
  ['Q-2', 'Q-1']
);
assert.deepEqual(
  filterQuestionCatalog(questions, { keyword: 'cloud', section: '1', difficulty: 'Easy' }).map(
    ({ id }) => id
  ),
  ['Q-1']
);
assert.deepEqual(filterQuestionCatalog(questions, { domain: 'missing' }), []);
assert.equal(reconcileSelectedQuestionId(questions, 'Q-2'), 'Q-2');
assert.equal(reconcileSelectedQuestionId(questions, 'missing'), 'Q-2');
assert.equal(reconcileSelectedQuestionId([], 'Q-2'), null);
assert.equal(JSON.stringify(questions), snapshot, 'catalog helpers do not mutate source questions');

console.log('DEP question catalog tests passed.');
