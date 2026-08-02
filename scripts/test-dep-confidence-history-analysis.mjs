import assert from 'node:assert/strict';
import { buildConfidenceHistoryAnalysis } from '../dep-quiz-app/confidence-history-analysis.js';
import { buildConfidenceHistorySummary } from '../dep-quiz-app/confidence-history-summary.js';
import { buildConfidenceHistoryTrend } from '../dep-quiz-app/confidence-history-trend.js';

const asOf = '2026-08-01T12:00:00.000Z';
const query = (overrides = {}) => ({ period: 'all', sectionId: null, asOf, ...overrides });
const attempt = (attemptId, questionId, answeredAt, outcomeId, section = 'A') => {
  const [result, confidence] = outcomeId.split('_');
  return { attemptId, questionId, section, result, confidence, answeredAt };
};
const history = (...attempts) => ({ version: 1, attempts });

const input = history(
  attempt('q1-baseline', 'q1', '2026-07-20T00:00:00.000Z', 'wrong_high'),
  attempt('q1-change', 'q1', '2026-07-26T00:00:00.000Z', 'correct_high'),
  attempt('q1-review', 'q1', '2026-07-27T00:00:00.000Z', 'correct_medium'),
  attempt('q2-first', 'q2', '2026-07-26T00:00:00.000Z', 'correct_low'),
  attempt('q2-change', 'q2', '2026-07-28T00:00:00.000Z', 'correct_high'),
  attempt('q3-first', 'q3', '2026-07-29T00:00:00.000Z', 'wrong_low', 'B'),
  attempt('q3-review', 'q3', '2026-07-30T00:00:00.000Z', 'wrong_medium', 'B'),
  attempt('future', 'q4', '2026-08-02T00:00:00.000Z', 'correct_high')
);

{
  const inputQuery = query({ period: '7d' });
  const inputSnapshot = structuredClone(input);
  const querySnapshot = structuredClone(inputQuery);
  const result = buildConfidenceHistoryAnalysis(input, inputQuery);
  const summary = buildConfidenceHistorySummary(input, inputQuery);
  const trend = buildConfidenceHistoryTrend(input, {
    period: summary.query.period,
    sectionId: summary.query.sectionId,
    asOf: summary.query.asOf,
  });

  assert.deepEqual(Object.keys(result), [
    'query',
    'coverage',
    'quality',
    'retention',
    'summary',
    'confidenceLevels',
    'outcomes',
    'guidance',
    'sections',
    'attempts',
    'trends',
    'questionTrends',
    'changeEvents',
  ]);
  for (const key of [
    'query',
    'coverage',
    'quality',
    'retention',
    'summary',
    'confidenceLevels',
    'outcomes',
    'guidance',
    'sections',
    'attempts',
  ])
    assert.deepEqual(result[key], summary[key]);
  for (const key of ['trends', 'questionTrends', 'changeEvents']) {
    assert.deepEqual(result[key], trend[key]);
  }

  assert.equal(result.coverage.filteredAttemptCount, result.attempts.length);
  assert.equal(result.summary.attemptCount, result.attempts.length);
  assert.equal(result.coverage.uniqueQuestionCount, result.questionTrends.length);
  assert.equal(result.summary.uniqueQuestionCount, result.questionTrends.length);
  assert.equal(result.trends.analyzedQuestionCount, result.questionTrends.length);
  assert.equal(result.trends.analyzedQuestionCount, result.summary.uniqueQuestionCount);
  assert.equal(
    result.questionTrends.reduce((total, item) => total + item.attemptCount, 0),
    result.attempts.length
  );
  assert.ok(result.changeEvents.length <= result.trends.transitionCount);
  assert.ok(result.trends.changedQuestionCount <= result.trends.analyzedQuestionCount);
  assert.equal(
    result.trends.changedQuestionCount,
    new Set(result.changeEvents.map((event) => event.questionId)).size
  );
  for (const [type, countKey] of [
    ['misconception-corrected', 'misconceptionCorrectedCount'],
    ['unstable-correctness-stabilized', 'unstableCorrectnessStabilizedCount'],
    ['review-to-advance', 'reviewToAdvanceCount'],
  ]) {
    assert.equal(
      result.trends[countKey],
      result.changeEvents.filter((event) => event.changeTypes.includes(type)).length
    );
  }
  assert.equal(result.trends.continuedReviewQuestionCount, 1);

  const attemptIds = new Set(result.attempts.map((item) => item.attemptId));
  const attemptQuestionIds = new Set(result.attempts.map((item) => item.questionId));
  const questionIds = new Set(result.questionTrends.map((item) => item.questionId));
  for (const questionTrend of result.questionTrends) {
    assert.ok(attemptQuestionIds.has(questionTrend.questionId));
    assert.equal(
      questionTrend.attemptCount,
      result.attempts.filter((item) => item.questionId === questionTrend.questionId).length
    );
  }
  for (const event of result.changeEvents) {
    assert.ok(questionIds.has(event.questionId));
    assert.ok(attemptIds.has(event.toAttemptId));
    assert.equal(
      event.section,
      result.attempts.find((item) => item.attemptId === event.toAttemptId).section
    );
  }
  assert.ok(
    !attemptIds.has(result.changeEvents[0].fromAttemptId),
    'a pre-period baseline may be outside attempts'
  );
  assert.deepEqual(input, inputSnapshot);
  assert.deepEqual(inputQuery, querySnapshot);
  assert.deepEqual(buildConfidenceHistoryAnalysis(input, inputQuery), result);
}

{
  const inputQuery = {
    period: '7d',
    sectionId: 'B',
    asOf: '2026-08-01T12:00:00Z',
    from: 'caller-value-must-not-be-used',
    to: 'caller-value-must-not-be-used',
  };
  const summary = buildConfidenceHistorySummary(input, inputQuery);
  const result = buildConfidenceHistoryAnalysis(input, inputQuery);
  const trendFromCanonicalQuery = buildConfidenceHistoryTrend(input, {
    period: summary.query.period,
    sectionId: summary.query.sectionId,
    asOf: summary.query.asOf,
  });

  assert.deepEqual(result.query, summary.query);
  assert.deepEqual(result.trends, trendFromCanonicalQuery.trends);
  assert.deepEqual(result.questionTrends, trendFromCanonicalQuery.questionTrends);
  assert.deepEqual(result.changeEvents, trendFromCanonicalQuery.changeEvents);
  assert.deepEqual(result.query, {
    period: '7d',
    sectionId: 'B',
    asOf: '2026-08-01T12:00:00Z',
    from: '2026-07-25T12:00:00.000Z',
    to: '2026-08-01T12:00:00Z',
  });
  assert.equal(result.summary.attemptCount, 2);
  assert.deepEqual(
    result.sections.map(({ id }) => id),
    ['A', 'B']
  );
  assert.equal(result.trends.continuedReviewQuestionCount, 1);
}

{
  const result = buildConfidenceHistoryAnalysis(input, query({ period: 'all', sectionId: null }));
  assert.equal(result.query.from, null);
  assert.equal(result.summary.attemptCount, 7);
  assert.equal(result.summary.uniqueQuestionCount, 3);
  assert.equal(result.trends.analyzedQuestionCount, 3);
  assert.deepEqual(
    result.sections.map(({ id }) => id),
    ['A', 'B']
  );
}

{
  const transitionInput = history(
    attempt('review-only-from', 'review-only', '2026-07-26T00:00:00.000Z', 'correct_medium'),
    attempt('review-only-to', 'review-only', '2026-07-27T00:00:00.000Z', 'correct_high'),
    attempt('no-change-to', 'review-only', '2026-07-28T00:00:00.000Z', 'correct_medium')
  );
  const result = buildConfidenceHistoryAnalysis(transitionInput, query());

  assert.equal(result.trends.transitionCount, 2);
  assert.equal(result.changeEvents.length, 1);
  assert.deepEqual(result.changeEvents[0].changeTypes, ['review-to-advance']);
  assert.equal(result.trends.misconceptionCorrectedCount, 0);
  assert.equal(result.trends.unstableCorrectnessStabilizedCount, 0);
  assert.equal(result.trends.reviewToAdvanceCount, 1);
}

{
  const answeredAt = '2026-07-26T00:00:00.000Z';
  const sameTimeInput = history(
    attempt('same-1', 'same-question', answeredAt, 'wrong_high'),
    attempt('same-2', 'same-question', answeredAt, 'correct_high'),
    attempt('same-3', 'same-question', answeredAt, 'correct_medium'),
    attempt('same-4', 'same-question', answeredAt, 'correct_high')
  );
  const result = buildConfidenceHistoryAnalysis(sameTimeInput, query());

  assert.deepEqual(
    result.attempts.map(({ attemptId }) => attemptId),
    ['same-1', 'same-2', 'same-3', 'same-4']
  );
  assert.equal(result.trends.transitionCount, 3);
  assert.deepEqual(
    result.changeEvents.map(({ fromAttemptId, toAttemptId }) => ({ fromAttemptId, toAttemptId })),
    [
      { fromAttemptId: 'same-1', toAttemptId: 'same-2' },
      { fromAttemptId: 'same-3', toAttemptId: 'same-4' },
    ]
  );
}

{
  const result = buildConfidenceHistoryAnalysis(null, query());
  assert.equal(Object.keys(result).length, 13);
  assert.equal(result.summary.attemptCount, 0);
  assert.deepEqual(result.attempts, []);
  assert.deepEqual(result.questionTrends, []);
  assert.deepEqual(result.changeEvents, []);
  assert.deepEqual(
    buildConfidenceHistoryAnalysis({ version: 1, attempts: 'bad' }, query()),
    result
  );
  assert.throws(
    () => buildConfidenceHistoryAnalysis({ version: 2, attempts: [] }, query()),
    TypeError
  );
  assert.throws(
    () => buildConfidenceHistoryAnalysis(null, { ...query(), period: 'bad' }),
    TypeError
  );
}

{
  const pristine = buildConfidenceHistoryAnalysis(input, query({ period: '7d' }));
  const mutated = buildConfidenceHistoryAnalysis(input, query({ period: '7d' }));
  mutated.attempts[0].questionId = 'mutated';
  mutated.confidenceLevels.push({ mutated: true });
  mutated.outcomes.push({ mutated: true });
  mutated.sections.push({ mutated: true });
  mutated.questionTrends[0].changeTypes.push('mutated');
  mutated.changeEvents[0].changeTypes.push('mutated');
  assert.deepEqual(buildConfidenceHistoryAnalysis(input, query({ period: '7d' })), pristine);
  assert.notStrictEqual(mutated.attempts, pristine.attempts);
  assert.notStrictEqual(mutated.confidenceLevels, pristine.confidenceLevels);
  assert.notStrictEqual(mutated.outcomes, pristine.outcomes);
  assert.notStrictEqual(mutated.sections, pristine.sections);
  assert.notStrictEqual(mutated.questionTrends, pristine.questionTrends);
  assert.notStrictEqual(mutated.changeEvents, pristine.changeEvents);
  assert.notStrictEqual(
    mutated.questionTrends[0].changeTypes,
    pristine.questionTrends[0].changeTypes
  );
  assert.notStrictEqual(mutated.changeEvents[0].changeTypes, pristine.changeEvents[0].changeTypes);
}

console.log('dep confidence history analysis tests passed');
