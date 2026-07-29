import assert from 'node:assert/strict';

import { buildConfidenceAnalysis } from '../dep-quiz-app/confidence-analysis.js';
import { CONFIDENCE_LEVELS } from '../dep-quiz-app/confidence.js';
import { CONFIDENCE_OUTCOMES } from '../dep-quiz-app/confidence-outcome.js';

const answeredAt = '2026-07-29T00:00:00.000Z';

function answer(result, confidence, overrides = {}) {
  return {
    lastAnsweredAt: answeredAt,
    lastConfidenceAnswer: { result, confidence, answeredAt },
    ...overrides,
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('aggregates coverage, latest accuracy, outcomes, and review decisions', () => {
  const questions = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((id) => ({ id }));
  const progress = {
    Q1: answer('correct', 'high'),
    Q2: answer('wrong', 'high'),
    Q3: answer('correct', 'low'),
    Q4: answer('wrong', 'medium'),
  };
  const analysis = buildConfidenceAnalysis(questions, progress);

  assert.deepEqual(analysis.coverage, {
    totalQuestionCount: 5,
    classifiedQuestionCount: 4,
    unclassifiedQuestionCount: 1,
    invalidLatestAnswerCount: 0,
    status: 'partial',
    qualityStatus: 'clean',
  });
  assert.deepEqual(
    analysis.confidenceLevels.map(
      ({ id, questionCount, correctCount, wrongCount, accuracyRate }) => [
        id,
        questionCount,
        correctCount,
        wrongCount,
        accuracyRate,
      ]
    ),
    [
      ['high', 2, 1, 1, 0.5],
      ['medium', 1, 0, 1, 0],
      ['low', 1, 1, 0, 1],
    ]
  );
  assert.deepEqual(analysis.review, {
    advanceQuestionCount: 1,
    reviewQuestionCount: 3,
    highlightedQuestionCount: 2,
    highlightedOutcomes: [
      { outcomeId: 'wrong_high', questionCount: 1, reasonCode: 'misconception-risk' },
      { outcomeId: 'correct_low', questionCount: 1, reasonCode: 'unstable-correctness' },
    ],
  });
  assert.deepEqual(
    analysis.classifiedItems.map(({ questionId, outcomeId, guidance }) => [
      questionId,
      outcomeId,
      guidance,
    ]),
    [
      ['Q1', 'correct_high', 'advance'],
      ['Q2', 'wrong_high', 'review'],
      ['Q3', 'correct_low', 'review'],
      ['Q4', 'wrong_medium', 'review'],
    ]
  );
});

test('aggregates all six outcomes with their canonical guidance and review decisions', () => {
  const cases = [
    ['Q1', 'correct', 'high', 'correct_high', 'advance'],
    ['Q2', 'correct', 'medium', 'correct_medium', 'review'],
    ['Q3', 'correct', 'low', 'correct_low', 'review'],
    ['Q4', 'wrong', 'high', 'wrong_high', 'review'],
    ['Q5', 'wrong', 'medium', 'wrong_medium', 'review'],
    ['Q6', 'wrong', 'low', 'wrong_low', 'review'],
  ];
  const questions = cases.map(([questionId]) => ({ id: questionId }));
  const progress = Object.fromEntries(
    cases.map(([questionId, result, confidence]) => [questionId, answer(result, confidence)])
  );
  const analysis = buildConfidenceAnalysis(questions, progress);

  assert.deepEqual(
    analysis.classifiedItems.map(({ questionId, outcomeId, guidance }) => ({
      questionId,
      outcomeId,
      guidance,
    })),
    cases.map(([questionId, , , outcomeId, guidance]) => ({
      questionId,
      outcomeId,
      guidance,
    }))
  );
  assert.deepEqual(
    analysis.outcomes.map(({ id, questionCount }) => ({ id, questionCount })),
    cases.map(([, , , id]) => ({ id, questionCount: 1 }))
  );
  assert.equal(analysis.review.advanceQuestionCount, 1);
  assert.equal(analysis.review.reviewQuestionCount, 5);
  assert.deepEqual(
    analysis.review.highlightedOutcomes.map(({ outcomeId }) => outcomeId),
    ['wrong_high', 'correct_low']
  );
});

test('derives analysis only from the latest answer instead of cumulative counts', () => {
  const questions = [{ id: 'LATEST_CORRECT' }, { id: 'LATEST_WRONG' }];
  const progress = {
    LATEST_CORRECT: answer('correct', 'low', {
      correctCount: 0,
      wrongCount: 99,
    }),
    LATEST_WRONG: answer('wrong', 'high', {
      correctCount: 99,
      wrongCount: 0,
    }),
  };
  const analysis = buildConfidenceAnalysis(questions, progress);

  assert.deepEqual(
    analysis.classifiedItems.map(({ questionId, result, confidence, outcomeId }) => ({
      questionId,
      result,
      confidence,
      outcomeId,
    })),
    [
      {
        questionId: 'LATEST_CORRECT',
        result: 'correct',
        confidence: 'low',
        outcomeId: 'correct_low',
      },
      {
        questionId: 'LATEST_WRONG',
        result: 'wrong',
        confidence: 'high',
        outcomeId: 'wrong_high',
      },
    ]
  );
  assert.deepEqual(
    analysis.confidenceLevels.map(({ id, correctCount, wrongCount }) => ({
      id,
      correctCount,
      wrongCount,
    })),
    [
      { id: 'high', correctCount: 0, wrongCount: 1 },
      { id: 'medium', correctCount: 0, wrongCount: 0 },
      { id: 'low', correctCount: 1, wrongCount: 0 },
    ]
  );
});

test('preserves registry order and includes zero-count entries', () => {
  const analysis = buildConfidenceAnalysis([{ id: 'Q1' }], { Q1: answer('correct', 'high') });
  assert.deepEqual(
    analysis.confidenceLevels.map(({ id }) => id),
    CONFIDENCE_LEVELS.map(({ id }) => id)
  );
  assert.deepEqual(
    analysis.outcomes.map(({ id }) => id),
    CONFIDENCE_OUTCOMES.map(({ id }) => id)
  );
  assert.equal(analysis.outcomes.find(({ id }) => id === 'wrong_low').questionCount, 0);
  assert.deepEqual(
    analysis.confidenceLevels.find(({ id }) => id === 'medium'),
    {
      id: 'medium',
      label: '迷いあり',
      questionCount: 0,
      correctCount: 0,
      wrongCount: 0,
      accuracyRate: null,
      accuracyRateStatus: 'not-applicable',
    }
  );
});

test('excludes invalid, duplicate, and unknown data while distinguishing missing latest answers', () => {
  const questions = [
    { id: ' Q1 ' },
    null,
    {},
    { id: '' },
    { id: 'Q1' },
    { id: 'Q2' },
    { id: 'Q3' },
  ];
  const progress = {
    Q1: answer('correct', 'high'),
    Q2: { lastConfidenceAnswer: null },
    Q3: answer('wrong', 'bogus'),
    UNKNOWN: answer('wrong', 'high'),
  };
  const analysis = buildConfidenceAnalysis(questions, progress);

  assert.deepEqual(analysis.coverage, {
    totalQuestionCount: 3,
    classifiedQuestionCount: 1,
    unclassifiedQuestionCount: 2,
    invalidLatestAnswerCount: 1,
    status: 'partial',
    qualityStatus: 'invalid-data-excluded',
  });
  assert.deepEqual(
    analysis.classifiedItems.map(({ questionId }) => questionId),
    ['Q1']
  );
});

test('handles empty and legacy inputs without throwing', () => {
  for (const [questions, progress] of [
    [undefined, undefined],
    [null, []],
    [{ id: 'Q1' }, { Q1: { seenCount: 2 } }],
  ]) {
    assert.doesNotThrow(() => buildConfidenceAnalysis(questions, progress));
  }
  const empty = buildConfidenceAnalysis([], {});
  assert.equal(empty.coverage.status, 'none');
  assert.equal(empty.coverage.qualityStatus, 'clean');
  assert.equal(empty.coverage.totalQuestionCount, 0);
});

test('reports complete coverage and does not mutate any input or registry', () => {
  const questions = [{ id: 'Q2' }, { id: 'Q1' }];
  const progress = { Q1: answer('wrong', 'low'), Q2: answer('correct', 'medium') };
  const snapshots = [
    structuredClone(questions),
    structuredClone(progress),
    structuredClone(CONFIDENCE_OUTCOMES),
  ];
  const analysis = buildConfidenceAnalysis(questions, progress);

  assert.equal(analysis.coverage.status, 'complete');
  assert.deepEqual(
    analysis.classifiedItems.map(({ questionId }) => questionId),
    ['Q2', 'Q1']
  );
  assert.deepEqual(questions, snapshots[0]);
  assert.deepEqual(progress, snapshots[1]);
  assert.deepEqual(CONFIDENCE_OUTCOMES, snapshots[2]);
});

test('treats a latest answer inconsistent with lastAnsweredAt as invalid', () => {
  const progress = {
    Q1: answer('correct', 'high', { lastAnsweredAt: '2026-07-28T00:00:00.000Z' }),
  };
  const analysis = buildConfidenceAnalysis([{ id: 'Q1' }], progress);
  assert.equal(analysis.coverage.invalidLatestAnswerCount, 1);
  assert.equal(analysis.coverage.classifiedQuestionCount, 0);
  assert.equal(analysis.coverage.status, 'none');
});
