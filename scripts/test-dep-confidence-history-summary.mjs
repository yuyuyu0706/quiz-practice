import assert from 'node:assert/strict';
import {
  buildConfidenceHistorySummary,
  normalizeConfidenceHistoryQuery,
  selectConfidenceHistoryAttempts,
} from '../dep-quiz-app/confidence-history-summary.js';

function attempt(id, answeredAt, overrides = {}) {
  return {
    attemptId: `a-${id}`,
    questionId: `q-${id}`,
    section: 'A',
    result: 'correct',
    confidence: 'high',
    answeredAt,
    ...overrides,
  };
}

const asOf = '2026-08-01T12:00:00.000Z';

{
  const input = { period: '7d', sectionId: null, asOf };
  assert.deepEqual(normalizeConfidenceHistoryQuery(input), {
    ...input,
    from: '2026-07-25T12:00:00.000Z',
    to: asOf,
  });
  assert.deepEqual(input, { period: '7d', sectionId: null, asOf });
  assert.equal(
    normalizeConfidenceHistoryQuery({ ...input, period: '30d' }).from,
    '2026-07-02T12:00:00.000Z'
  );
  assert.equal(
    normalizeConfidenceHistoryQuery({ ...input, period: '90d' }).from,
    '2026-05-03T12:00:00.000Z'
  );
  assert.equal(normalizeConfidenceHistoryQuery({ ...input, period: 'all' }).from, null);
  assert.deepEqual(
    normalizeConfidenceHistoryQuery({
      period: 'all',
      sectionId: null,
      asOf: '2026-08-01T12:00:00Z',
    }),
    {
      period: 'all',
      sectionId: null,
      asOf: '2026-08-01T12:00:00Z',
      from: null,
      to: '2026-08-01T12:00:00Z',
    }
  );
  for (const query of [
    {},
    { ...input, period: 'week' },
    { ...input, sectionId: '' },
    { ...input, sectionId: ' A' },
    { ...input, sectionId: 1 },
    { ...input, asOf: '2026-08-01T12:00:00+00:00' },
    { ...input, asOf: '2026-02-30T12:00:00Z' },
  ]) {
    assert.throws(() => normalizeConfidenceHistoryQuery(query), TypeError);
  }
}

{
  const combinations = [
    ['correct_high', 'correct', 'high', 'advance', 1],
    ['correct_medium', 'correct', 'medium', 'review', 2],
    ['correct_low', 'correct', 'low', 'review', 3],
    ['wrong_high', 'wrong', 'high', 'review', 4],
    ['wrong_medium', 'wrong', 'medium', 'review', 5],
    ['wrong_low', 'wrong', 'low', 'review', 6],
  ];
  const attempts = combinations.flatMap(([, result, confidence, , count], combinationIndex) =>
    Array.from({ length: count }, (_, index) =>
      attempt(`${combinationIndex}-${index}`, asOf, { result, confidence })
    )
  );
  const history = { version: 1, attempts };
  const query = { period: 'all', sectionId: null, asOf };
  const snapshot = structuredClone(history);
  const firstResult = buildConfidenceHistorySummary(history, query);
  const secondResult = buildConfidenceHistorySummary(history, query);

  assert.deepEqual(
    firstResult.outcomes.map(({ id, attemptCount, ratio, ratioStatus, guidance }) => ({
      id,
      attemptCount,
      ratio,
      ratioStatus,
      guidance,
    })),
    combinations.map(([id, , , guidance, attemptCount]) => ({
      id,
      attemptCount,
      ratio: attemptCount / 21,
      ratioStatus: 'available',
      guidance,
    }))
  );
  assert.deepEqual(
    firstResult.confidenceLevels.map(
      ({ id, attemptCount, correctCount, wrongCount, accuracyRate, accuracyRateStatus }) => ({
        id,
        attemptCount,
        correctCount,
        wrongCount,
        accuracyRate,
        accuracyRateStatus,
      })
    ),
    [
      {
        id: 'high',
        attemptCount: 5,
        correctCount: 1,
        wrongCount: 4,
        accuracyRate: 1 / 5,
        accuracyRateStatus: 'available',
      },
      {
        id: 'medium',
        attemptCount: 7,
        correctCount: 2,
        wrongCount: 5,
        accuracyRate: 2 / 7,
        accuracyRateStatus: 'available',
      },
      {
        id: 'low',
        attemptCount: 9,
        correctCount: 3,
        wrongCount: 6,
        accuracyRate: 3 / 9,
        accuracyRateStatus: 'available',
      },
    ]
  );
  assert.deepEqual(firstResult.guidance, {
    advanceAttemptCount: 1,
    reviewAttemptCount: 20,
    advanceRatio: 1 / 21,
    reviewRatio: 20 / 21,
    ratioStatus: 'available',
  });
  assert.deepEqual(firstResult, secondResult);
  assert.deepEqual(history, snapshot);
  assert.deepEqual(query, { period: 'all', sectionId: null, asOf });
}

{
  const history = {
    version: 1,
    attempts: [
      attempt('old', '2026-07-25T11:59:59.999Z'),
      attempt('lower', '2026-07-25T12:00:00.000Z', { section: 'B', questionId: 'shared' }),
      attempt('middle', '2026-07-30T12:00:00.000Z', {
        result: 'wrong',
        confidence: 'medium',
        questionId: 'shared',
      }),
      attempt('upper', asOf, { confidence: 'low' }),
      attempt('future', '2026-08-01T12:00:00.001Z'),
    ],
  };
  const snapshot = structuredClone(history);
  const result = buildConfidenceHistorySummary(history, {
    period: '7d',
    sectionId: 'A',
    asOf,
  });
  assert.deepEqual(history, snapshot);
  assert.deepEqual(
    result.attempts.map(({ attemptId }) => attemptId),
    ['a-middle', 'a-upper']
  );
  assert.deepEqual(result.sections, [
    { id: 'B', attemptCount: 1, uniqueQuestionCount: 1 },
    { id: 'A', attemptCount: 2, uniqueQuestionCount: 2 },
  ]);
  assert.deepEqual(result.coverage, {
    sourceAttemptCount: 5,
    filteredAttemptCount: 2,
    uniqueQuestionCount: 2,
    futureAttemptCount: 1,
    excludedByPeriodCount: 1,
    excludedBySectionCount: 1,
    status: 'available',
    qualityStatus: 'clean',
  });
  assert.deepEqual(result.summary, {
    attemptCount: 2,
    uniqueQuestionCount: 2,
    correctCount: 1,
    wrongCount: 1,
    accuracyRate: 0.5,
    accuracyRateStatus: 'available',
  });
  assert.deepEqual(
    result.confidenceLevels.map(({ id, attemptCount }) => [id, attemptCount]),
    [
      ['high', 0],
      ['medium', 1],
      ['low', 1],
    ]
  );
  assert.equal(result.outcomes.length, 6);
  assert.equal(
    result.outcomes.reduce((sum, outcome) => sum + outcome.attemptCount, 0),
    2
  );
  assert.deepEqual(result.guidance, {
    advanceAttemptCount: 0,
    reviewAttemptCount: 2,
    advanceRatio: 0,
    reviewRatio: 1,
    ratioStatus: 'available',
  });
  result.attempts[0].section = 'changed';
  assert.deepEqual(history, snapshot);
}

{
  const empty = buildConfidenceHistorySummary(null, { period: 'all', sectionId: null, asOf });
  assert.equal(empty.coverage.qualityStatus, 'invalid-data-excluded');
  assert.equal(empty.summary.accuracyRate, null);
  assert.equal(empty.summary.accuracyRateStatus, 'not-applicable');
  assert.deepEqual(
    empty.confidenceLevels.map(
      ({ id, attemptCount, correctCount, wrongCount, accuracyRate, accuracyRateStatus }) => ({
        id,
        attemptCount,
        correctCount,
        wrongCount,
        accuracyRate,
        accuracyRateStatus,
      })
    ),
    ['high', 'medium', 'low'].map((id) => ({
      id,
      attemptCount: 0,
      correctCount: 0,
      wrongCount: 0,
      accuracyRate: null,
      accuracyRateStatus: 'not-applicable',
    }))
  );
  assert.deepEqual(
    empty.outcomes.map(({ id, attemptCount, ratio, ratioStatus, guidance }) => ({
      id,
      attemptCount,
      ratio,
      ratioStatus,
      guidance,
    })),
    [
      ['correct_high', 'advance'],
      ['correct_medium', 'review'],
      ['correct_low', 'review'],
      ['wrong_high', 'review'],
      ['wrong_medium', 'review'],
      ['wrong_low', 'review'],
    ].map(([id, guidance]) => ({
      id,
      attemptCount: 0,
      ratio: null,
      ratioStatus: 'not-applicable',
      guidance,
    }))
  );
  assert.equal(empty.guidance.ratioStatus, 'not-applicable');
  assert.throws(
    () =>
      buildConfidenceHistorySummary(
        { version: 2, attempts: [] },
        { period: 'all', sectionId: null, asOf }
      ),
    TypeError
  );
}

{
  const history = {
    version: 1,
    attempts: [
      attempt('upper-case', asOf, { section: 'Section-A' }),
      attempt('lower-case', asOf, { section: 'section-a' }),
    ],
  };
  const selected = selectConfidenceHistoryAttempts(history, {
    period: 'all',
    sectionId: 'Section-A',
    asOf,
  });
  assert.deepEqual(
    selected.attempts.map(({ attemptId }) => attemptId),
    ['a-upper-case']
  );
  assert.equal(selected.coverage.excludedBySectionCount, 1);
  assert.deepEqual(
    selected.sections.map(({ id }) => id),
    ['Section-A', 'section-a']
  );

  const invalidAttempts = buildConfidenceHistorySummary(
    { version: 1, attempts: {} },
    { period: 'all', sectionId: null, asOf }
  );
  assert.equal(invalidAttempts.summary.attemptCount, 0);
  assert.equal(invalidAttempts.coverage.qualityStatus, 'invalid-data-excluded');
}

{
  const duplicate = attempt('duplicate', asOf);
  const selection = selectConfidenceHistoryAttempts(
    { version: 1, attempts: [duplicate, { bad: true }, { ...duplicate, section: 'B' }] },
    { period: 'all', sectionId: null, asOf }
  );
  assert.deepEqual(selection.quality, {
    invalidAttemptCount: 1,
    duplicateAttemptCount: 1,
    trimmedAttemptCount: 0,
  });
  assert.equal(selection.coverage.qualityStatus, 'invalid-data-excluded');
}

{
  const attempts = Array.from({ length: 5001 }, (_, index) =>
    attempt(index, new Date(Date.parse(asOf) - (5000 - index)).toISOString())
  );
  for (const [attemptCount, expectedStatus] of [
    [4999, 'within-limit'],
    [5000, 'capacity-reached'],
  ]) {
    const exactSelection = selectConfidenceHistoryAttempts(
      { version: 1, attempts: attempts.slice(-attemptCount) },
      { period: 'all', sectionId: null, asOf }
    );
    assert.equal(exactSelection.retention.sourceAttemptCount, attemptCount);
    assert.equal(exactSelection.retention.status, expectedStatus);
    assert.equal(exactSelection.quality.trimmedAttemptCount, 0);
  }
  const selection = selectConfidenceHistoryAttempts(
    { version: 1, attempts },
    { period: 'all', sectionId: null, asOf }
  );
  assert.equal(selection.quality.trimmedAttemptCount, 1);
  assert.equal(selection.retention.sourceAttemptCount, 5000);
  assert.equal(selection.retention.status, 'capacity-reached');
  assert.equal(selection.attempts.length, 5000);
}

console.log('dep confidence history summary tests passed');
