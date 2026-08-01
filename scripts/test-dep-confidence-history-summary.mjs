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
  assert.ok(empty.confidenceLevels.every(({ accuracyRate }) => accuracyRate === null));
  assert.ok(empty.outcomes.every(({ ratio }) => ratio === null));
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
