import assert from 'node:assert/strict';

import { buildWeaknessReviewTargetPlan } from '../dep-quiz-app/weakness-review-targets.js';
import { WRONG_REASON_TAGS } from '../dep-quiz-app/notes.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const [conceptGap, termConfusion] = WRONG_REASON_TAGS.map((tag) => tag.id);

function question(id, section, overrides = {}) {
  return {
    id,
    section,
    sectionTitle: `Section ${section} title`,
    question: `Question ${id}`,
    ...overrides,
  };
}

function progressEntry(overrides = {}) {
  return {
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    bookmark: false,
    noteText: '',
    note: '',
    memo: '',
    wrongReasonTags: [],
    ...overrides,
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('section condition extracts matching questions in question definition order including unseen items', () => {
  const questions = [
    question('Q1', '1'),
    question('Q2', '2'),
    question('Q3', '2'),
    question('Q4', '3'),
  ];
  const progress = {
    Q3: progressEntry({ seenCount: 1, correctCount: 1 }),
    Q2: progressEntry(),
  };

  const result = buildWeaknessReviewTargetPlan({
    questions,
    progress,
    condition: { type: 'section', section: '2' },
  });

  assert.deepEqual(result.condition, {
    type: 'section',
    value: '2',
    label: 'Section 2：Section 2 title',
  });
  assert.deepEqual(
    result.items.map((item) => [item.id, item.status]),
    [
      ['Q2', 'unseen'],
      ['Q3', 'correct'],
    ]
  );
  assert.equal(result.targetCount, 2);
  assert.equal(result.emptyState, null);
});

test('wrong-reason-tag condition extracts current tagged questions in question definition order', () => {
  const questions = [
    question('Q1', '1'),
    question('Q2', '1'),
    question('Q3', '1'),
    question('Q4', '1'),
  ];
  const progress = {
    Q3: progressEntry({ wrongReasonTags: [conceptGap], wrongCount: 1 }),
    Q1: progressEntry({ wrongReasonTags: [termConfusion, conceptGap], wrongCount: 2 }),
    Q2: progressEntry({ wrongReasonTags: [termConfusion], wrongCount: 1 }),
  };

  const result = buildWeaknessReviewTargetPlan({
    questions,
    progress,
    condition: { type: 'wrongReasonTag', tag: conceptGap },
  });

  assert.deepEqual(result.condition, {
    type: 'wrongReasonTag',
    value: conceptGap,
    label: WRONG_REASON_TAGS[0].label,
  });
  assert.deepEqual(
    result.items.map((item) => item.id),
    ['Q1', 'Q3']
  );
  assert.equal(result.items[0].hasWrongReasonTags, true);
});

test('target item includes status and display helper fields', () => {
  const questions = [
    question('wrong', '1', { prompt: 'Prompt fallback' }),
    question('correct', '1'),
    question('answered', '1'),
    question('unseen', '1'),
  ];
  const progress = {
    wrong: progressEntry({
      wrongCount: 1,
      correctCount: 3,
      seenCount: 4,
      wrongReasonTags: [conceptGap],
      noteText: ' note ',
    }),
    correct: progressEntry({ correctCount: 1, seenCount: 1, bookmark: true }),
    answered: progressEntry({ seenCount: 1, note: '   ' }),
    unseen: progressEntry({ memo: 'memo text' }),
  };

  const result = buildWeaknessReviewTargetPlan({
    questions,
    progress,
    condition: { type: 'section', section: '1' },
  });

  assert.deepEqual(
    result.items.map(({ id, status, hasNote, bookmarked }) => ({
      id,
      status,
      hasNote,
      bookmarked,
    })),
    [
      { id: 'wrong', status: 'wrong', hasNote: true, bookmarked: false },
      { id: 'correct', status: 'correct', hasNote: false, bookmarked: true },
      { id: 'answered', status: 'answered', hasNote: false, bookmarked: false },
      { id: 'unseen', status: 'unseen', hasNote: true, bookmarked: false },
    ]
  );
  assert.deepEqual(result.items[0], {
    id: 'wrong',
    section: '1',
    sectionTitle: 'Section 1 title',
    questionText: 'Question wrong',
    status: 'wrong',
    seenCount: 4,
    correctCount: 3,
    wrongCount: 1,
    wrongReasonTags: [conceptGap],
    hasWrongReasonTags: true,
    hasNote: true,
    bookmarked: false,
  });
});

test('old progress ids are excluded from items and reported as unavailableProgressIds', () => {
  const result = buildWeaknessReviewTargetPlan({
    questions: [question('Q1', '1')],
    progress: { Q1: progressEntry(), OLD: progressEntry({ wrongReasonTags: [conceptGap] }) },
    condition: { type: 'wrongReasonTag', tag: conceptGap },
  });

  assert.deepEqual(result.items, []);
  assert.deepEqual(result.unavailableProgressIds, ['OLD']);
  assert.deepEqual(result.emptyState, { reasonCode: 'NO_MATCHING_QUESTIONS' });
  assert.equal(result.targetCount, 0);
});

test('does not mutate questions or progress input', () => {
  const questions = [question('Q1', '1')];
  const progress = { Q1: progressEntry({ wrongReasonTags: [conceptGap], noteText: 'note' }) };
  const originalQuestions = deepClone(questions);
  const originalProgress = deepClone(progress);

  buildWeaknessReviewTargetPlan({
    questions,
    progress,
    condition: { type: 'section', section: '1' },
  });

  assert.deepEqual(questions, originalQuestions);
  assert.deepEqual(progress, originalProgress);
});

test('unsupported condition type fails explicitly', () => {
  assert.throws(
    () =>
      buildWeaknessReviewTargetPlan({
        questions: [question('Q1', '1')],
        progress: {},
        condition: { type: 'unknown' },
      }),
    TypeError
  );
});
