import assert from 'node:assert/strict';

import { buildWeaknessReviewTargetPlan } from '../dep-quiz-app/weakness-review-targets.js';
import { WRONG_REASON_TAGS } from '../dep-quiz-app/notes.js';
import { CONFIDENCE_OUTCOMES } from '../dep-quiz-app/confidence-outcome.js';

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

test('confidence outcome extracts only canonical classified items in question order', () => {
  const questions = [
    question('Q1', '1'),
    question('Q2', '2'),
    question('Q2', '9'),
    question('Q3', '3'),
  ];
  const progress = {
    Q1: progressEntry({ correctCount: 99, wrongCount: 0 }),
    Q2: progressEntry({ correctCount: 0, wrongCount: 99 }),
  };
  const confidenceAnalysis = {
    classifiedItems: [
      {
        questionId: 'Q2',
        result: 'correct',
        confidence: 'low',
        outcomeId: 'correct_low',
        guidance: 'review',
        answeredAt: '2026-01-02T00:00:00.000Z',
      },
      {
        questionId: 'OLD',
        result: 'correct',
        confidence: 'low',
        outcomeId: 'correct_low',
        guidance: 'review',
        answeredAt: '2026-01-01T00:00:00.000Z',
      },
      {
        questionId: 'Q1',
        result: 'wrong',
        confidence: 'high',
        outcomeId: 'wrong_high',
        guidance: 'review',
        answeredAt: '2026-01-03T00:00:00.000Z',
      },
      {
        questionId: 'Q3',
        result: 'wrong',
        confidence: 'low',
        outcomeId: 'correct_low',
        guidance: 'review',
        answeredAt: '2026-01-04T00:00:00.000Z',
      },
    ],
  };

  const result = buildWeaknessReviewTargetPlan({
    questions,
    progress,
    confidenceAnalysis,
    condition: { type: 'confidenceOutcome', value: 'correct_low' },
  });

  assert.deepEqual(result.condition, {
    type: 'confidenceOutcome',
    value: 'correct_low',
    label: '油断禁物。偶然の正解かもしれません',
  });
  assert.deepEqual(
    result.items.map(({ id }) => id),
    ['Q2']
  );
  assert.deepEqual(result.items[0].latestUnderstanding, {
    outcomeId: 'correct_low',
    title: '油断禁物。偶然の正解かもしれません',
    guidance: 'review',
    result: 'correct',
    confidence: 'low',
    confidenceLabel: '自信なし',
    answeredAt: '2026-01-02T00:00:00.000Z',
  });
});

test('all six confidence outcome conditions extract only matches in question definition order', () => {
  const questions = CONFIDENCE_OUTCOMES.flatMap((outcome, index) => [
    question(`${outcome.id}-first`, String(index + 1)),
    question(`${outcome.id}-second`, String(index + 1)),
  ]).reverse();
  const classifiedItems = CONFIDENCE_OUTCOMES.flatMap((outcome) => [
    {
      questionId: `${outcome.id}-second`,
      result: outcome.result,
      confidence: outcome.confidence,
      outcomeId: outcome.id,
      guidance: outcome.guidance,
      answeredAt: '2026-07-30T00:00:00.000Z',
    },
    {
      questionId: `${outcome.id}-first`,
      result: outcome.result,
      confidence: outcome.confidence,
      outcomeId: outcome.id,
      guidance: outcome.guidance,
      answeredAt: '2026-07-29T00:00:00.000Z',
    },
  ]);

  for (const outcome of CONFIDENCE_OUTCOMES) {
    const result = buildWeaknessReviewTargetPlan({
      questions,
      progress: {},
      confidenceAnalysis: { classifiedItems },
      condition: { type: 'confidenceOutcome', value: outcome.id },
    });
    const expectedIds = questions
      .filter((item) => item.id.startsWith(`${outcome.id}-`))
      .map((item) => item.id);

    assert.deepEqual(
      result.items.map((item) => item.id),
      expectedIds,
      outcome.id
    );
    assert.equal(result.targetCount, 2, outcome.id);
    assert.equal(result.emptyState, null, outcome.id);
    assert.deepEqual(result.condition, {
      type: 'confidenceOutcome',
      value: outcome.id,
      label: outcome.title,
    });
  }
});

test('review guidance derives all five review outcomes and excludes advance', () => {
  const outcomeIds = [
    'correct_high',
    'correct_medium',
    'correct_low',
    'wrong_high',
    'wrong_medium',
    'wrong_low',
  ];
  const pairs = [
    ['correct', 'high', 'advance'],
    ['correct', 'medium', 'review'],
    ['correct', 'low', 'review'],
    ['wrong', 'high', 'review'],
    ['wrong', 'medium', 'review'],
    ['wrong', 'low', 'review'],
  ];
  const questions = outcomeIds.map((id, index) => question(`Q${index}`, '1'));
  const confidenceAnalysis = {
    classifiedItems: outcomeIds.map((outcomeId, index) => ({
      questionId: `Q${index}`,
      outcomeId,
      result: pairs[index][0],
      confidence: pairs[index][1],
      guidance: pairs[index][2],
      answeredAt: '2026-01-01T00:00:00.000Z',
    })),
  };
  const original = deepClone(confidenceAnalysis);

  const result = buildWeaknessReviewTargetPlan({
    questions,
    progress: {},
    confidenceAnalysis,
    condition: { type: 'confidenceGuidance', guidance: 'review' },
  });
  assert.deepEqual(result.condition, {
    type: 'confidenceGuidance',
    value: 'review',
    label: '要確認（5分類）',
  });
  assert.deepEqual(
    result.items.map(({ id }) => id),
    ['Q1', 'Q2', 'Q3', 'Q4', 'Q5']
  );
  assert.deepEqual(confidenceAnalysis, original);
});

test('collapses section variants after eligibility and keeps the first group slot', () => {
  const questions = [
    question('seen', '1', { variantGroup: 'group' }),
    question('independent', '1'),
    question('winner', '1', { variantGroup: 'group' }),
    question('outside', '2', { variantGroup: 'group' }),
  ];
  const progress = {
    seen: progressEntry({ seenCount: 4 }),
    winner: progressEntry({ seenCount: 1 }),
    outside: progressEntry(),
  };

  const result = buildWeaknessReviewTargetPlan({
    questions,
    progress,
    condition: { type: 'section', section: '1' },
  });

  assert.deepEqual(
    result.items.map(({ id }) => id),
    ['winner', 'independent']
  );
  assert.equal(result.targetCount, 2);
  assert.equal(Object.hasOwn(result.items[0], 'variantGroup'), false);
  assert.deepEqual(result.unavailableProgressIds, []);
});

test('applies variant selection after tag and confidence eligibility', () => {
  const questions = [
    question('ineligible', '1', { variantGroup: 'group' }),
    question('eligible', '1', { variantGroup: 'group' }),
  ];
  const progress = {
    ineligible: progressEntry({ seenCount: 0 }),
    eligible: progressEntry({ seenCount: 5, wrongReasonTags: [conceptGap] }),
  };
  const tagResult = buildWeaknessReviewTargetPlan({
    questions,
    progress,
    condition: { type: 'wrongReasonTag', tag: conceptGap },
  });
  assert.deepEqual(
    tagResult.items.map(({ id }) => id),
    ['eligible']
  );

  const confidenceAnalysis = {
    classifiedItems: [
      {
        questionId: 'eligible',
        result: 'correct',
        confidence: 'low',
        outcomeId: 'correct_low',
        guidance: 'review',
      },
    ],
  };
  for (const condition of [
    { type: 'confidenceOutcome', value: 'correct_low' },
    { type: 'confidenceGuidance', value: 'review' },
  ]) {
    const result = buildWeaknessReviewTargetPlan({
      questions,
      progress,
      confidenceAnalysis,
      condition,
    });
    assert.deepEqual(
      result.items.map(({ id }) => id),
      ['eligible']
    );
  }
});

test('confidence conditions reject unknown values and return the shared empty state', () => {
  const options = {
    questions: [question('Q1', '1')],
    progress: {},
    confidenceAnalysis: { classifiedItems: [] },
  };
  const empty = buildWeaknessReviewTargetPlan({
    ...options,
    condition: { type: 'confidenceOutcome', outcome: 'wrong_low' },
  });
  assert.deepEqual(empty.emptyState, { reasonCode: 'NO_MATCHING_QUESTIONS' });
  assert.throws(
    () =>
      buildWeaknessReviewTargetPlan({
        ...options,
        condition: { type: 'confidenceOutcome', outcome: 'unknown' },
      }),
    /known outcome/
  );
  assert.throws(
    () =>
      buildWeaknessReviewTargetPlan({
        ...options,
        condition: { type: 'confidenceGuidance', guidance: 'advance' },
      }),
    /review guidance/
  );
});
