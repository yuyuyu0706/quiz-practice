import assert from 'node:assert/strict';
import {
  SECTION_TITLES,
  createQuestion,
  createQuestionDraft,
  updateQuestion,
  validateQuestionDraft,
} from '../tools/dep-question-authoring/question-editing.js';

assert.deepEqual(SECTION_TITLES, {
  1: 'Developing Code for Data Processing using Python and SQL',
  2: 'Data Ingestion & Acquisition',
  3: 'Data Transformation, Cleansing, and Quality',
  4: 'Data Sharing and Federation',
  5: 'Monitoring and Alerting',
  6: 'Cost & Performance Optimisation',
  7: 'Ensuring Data Security and Compliance',
  8: 'Data Governance',
  9: 'Debugging and Deploying',
  10: 'Data Modelling',
});

const source = [
  {
    id: 'DEP-Q1',
    section: '1',
    sectionTitle: 'old',
    question: 'Old?',
    choices: { A: 'a', B: 'b', C: 'c', D: 'd' },
    answer: 'A',
    explanation: 'Old explanation',
    variantGroup: 'group-one',
    followUp: { questionId: 'DEP-Q2' },
    futureMetadata: { retained: true },
    whyWrong: { B: 'wrong B' },
    references: [{ title: 'Docs', url: 'https://example.com' }],
  },
];

const createDraft = createQuestionDraft();
Object.assign(createDraft, {
  id: 'DEP-Q2',
  section: '2',
  question: 'New?',
  explanation: 'New explanation',
  answer: 'B',
  domain: ' ',
  tags: 'one\n\ntwo',
  estimatedTimeSec: '60',
  notes: '',
});
createDraft.choices = { A: 'a', B: 'b', C: 'c', D: 'd' };
createDraft.whyWrong = { A: 'why A', B: 'must omit', C: '', D: '' };
createDraft.references = [{ title: '', url: '' }];
const created = createQuestion(source, createDraft);
assert.equal(created.length, 2);
assert.equal(created[1].sectionTitle, 'Data Ingestion & Acquisition');
assert.deepEqual(created[1].tags, ['one', 'two']);
assert.deepEqual(created[1].whyWrong, { A: 'why A' });
assert.equal(created[1].variantGroup, undefined);
assert.equal(created[1].domain, undefined);
assert.equal(created[1].references, undefined);
assert.notEqual(created[0], source[0]);
assert.deepEqual(source[0].futureMetadata, { retained: true });

assert.equal(validateQuestionDraft(createDraft, created).id, 'Question ID already exists.');
assert.throws(() => createQuestion(created, createDraft), /already exists/);
createDraft.estimatedTimeSec = '0';
assert.match(validateQuestionDraft(createDraft).estimatedTimeSec, /Positive integer/);

const editDraft = createQuestionDraft(source[0]);
Object.assign(editDraft, {
  id: 'RENAMED',
  section: '3',
  domain: '',
  tags: '',
  estimatedTimeSec: '',
  notes: '',
});
editDraft.answer = 'B';
editDraft.whyWrong.B = 'must be removed';
editDraft.references = [];
const updated = updateQuestion(source, 'DEP-Q1', editDraft);
assert.equal(updated[0].id, 'DEP-Q1');
assert.equal(updated[0].sectionTitle, 'Data Transformation, Cleansing, and Quality');
assert.equal(updated[0].variantGroup, 'group-one');
assert.deepEqual(updated[0].followUp, { questionId: 'DEP-Q2' });
assert.deepEqual(updated[0].futureMetadata, { retained: true });
assert.equal(updated[0].domain, undefined);
assert.equal(updated[0].references, undefined);
assert.equal(updated[0].whyWrong?.B, undefined);
assert.deepEqual(source[0].references, [{ title: 'Docs', url: 'https://example.com' }]);
assert.notEqual(updated[0].followUp, source[0].followUp);

console.log('DEP question editing tests passed.');
