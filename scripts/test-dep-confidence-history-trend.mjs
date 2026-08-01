import assert from 'node:assert/strict';
import { buildConfidenceHistoryTrend } from '../dep-quiz-app/confidence-history-trend.js';

const asOf = '2026-08-01T12:00:00.000Z';
const query = (overrides = {}) => ({ period: 'all', sectionId: null, asOf, ...overrides });
function attempt(attemptId, questionId, answeredAt, outcomeId, section = 'A') {
  const [result, confidence] = outcomeId.split('_');
  return { attemptId, questionId, section, result, confidence, answeredAt };
}
function history(...attempts) {
  return { version: 1, attempts };
}

{
  const expected = {
    trends: {
      analyzedQuestionCount: 0,
      transitionCount: 0,
      changedQuestionCount: 0,
      misconceptionCorrectedCount: 0,
      unstableCorrectnessStabilizedCount: 0,
      reviewToAdvanceCount: 0,
      continuedReviewQuestionCount: 0,
    },
    questionTrends: [],
    changeEvents: [],
  };
  assert.deepEqual(buildConfidenceHistoryTrend(null, query()), expected);
  assert.deepEqual(buildConfidenceHistoryTrend({ version: 1, attempts: 'bad' }, query()), expected);
  assert.throws(
    () => buildConfidenceHistoryTrend({ version: 2, attempts: [] }, query()),
    TypeError
  );
}

{
  const input = history(
    attempt('a1', 'q1', '2026-07-01T00:00:00.000Z', 'wrong_low'),
    attempt('a2', 'q1', '2026-07-20T00:00:00.000Z', 'wrong_high'),
    attempt('a3', 'q1', '2026-07-25T12:00:00.000Z', 'correct_high'),
    attempt('b1', 'q2', '2026-07-26T00:00:00.000Z', 'correct_low'),
    attempt('b2', 'q2', '2026-07-27T00:00:00.000Z', 'correct_high'),
    attempt('a4', 'q1', '2026-07-28T00:00:00.000Z', 'correct_medium')
  );
  const inputQuery = query({ period: '7d' });
  const snapshot = structuredClone(input);
  const querySnapshot = structuredClone(inputQuery);
  const result = buildConfidenceHistoryTrend(input, inputQuery);

  assert.deepEqual(result.trends, {
    analyzedQuestionCount: 2,
    transitionCount: 3,
    changedQuestionCount: 2,
    misconceptionCorrectedCount: 1,
    unstableCorrectnessStabilizedCount: 1,
    reviewToAdvanceCount: 2,
    continuedReviewQuestionCount: 0,
  });
  assert.deepEqual(result.questionTrends, [
    {
      questionId: 'q1',
      section: 'A',
      attemptCount: 2,
      firstOutcomeId: 'correct_high',
      latestOutcomeId: 'correct_medium',
      latestGuidance: 'review',
      reviewStreakCount: 1,
      latestAnsweredAt: '2026-07-28T00:00:00.000Z',
      changeTypes: ['misconception-corrected', 'review-to-advance'],
    },
    {
      questionId: 'q2',
      section: 'A',
      attemptCount: 2,
      firstOutcomeId: 'correct_low',
      latestOutcomeId: 'correct_high',
      latestGuidance: 'advance',
      reviewStreakCount: 0,
      latestAnsweredAt: '2026-07-27T00:00:00.000Z',
      changeTypes: ['unstable-correctness-stabilized', 'review-to-advance'],
    },
  ]);
  assert.deepEqual(
    result.changeEvents.map(({ fromAttemptId, toAttemptId, changeTypes }) => ({
      fromAttemptId,
      toAttemptId,
      changeTypes,
    })),
    [
      {
        fromAttemptId: 'a2',
        toAttemptId: 'a3',
        changeTypes: ['misconception-corrected', 'review-to-advance'],
      },
      {
        fromAttemptId: 'b1',
        toAttemptId: 'b2',
        changeTypes: ['unstable-correctness-stabilized', 'review-to-advance'],
      },
    ]
  );
  assert.deepEqual(input, snapshot);
  assert.deepEqual(inputQuery, querySnapshot);
  assert.deepEqual(buildConfidenceHistoryTrend(input, inputQuery), result);
  assert.notStrictEqual(
    buildConfidenceHistoryTrend(input, inputQuery).questionTrends,
    result.questionTrends
  );
}

{
  const input = history(
    attempt('a1', 'q1', '2026-07-20T00:00:00.000Z', 'wrong_high', 'A'),
    attempt('a2', 'q1', '2026-07-26T00:00:00.000Z', 'wrong_low', 'B'),
    attempt('a3', 'q1', '2026-07-27T00:00:00.000Z', 'correct_high', 'A'),
    attempt('b1', 'q2', '2026-07-24T00:00:00.000Z', 'wrong_low', 'A'),
    attempt('b2', 'q2', '2026-07-25T12:00:00.000Z', 'wrong_medium', 'A')
  );
  const result = buildConfidenceHistoryTrend(input, query({ period: '7d', sectionId: 'A' }));
  assert.equal(result.trends.transitionCount, 1);
  assert.equal(result.changeEvents.length, 0, 'filtered attempts must not be reconnected');
  assert.deepEqual(
    result.questionTrends.map(({ questionId, attemptCount, reviewStreakCount }) => ({
      questionId,
      attemptCount,
      reviewStreakCount,
    })),
    [
      { questionId: 'q2', attemptCount: 1, reviewStreakCount: 2 },
      { questionId: 'q1', attemptCount: 1, reviewStreakCount: 0 },
    ]
  );
  assert.equal(result.trends.continuedReviewQuestionCount, 1);
}

{
  const input = history(
    attempt('a1', 'q1', '2026-07-20T00:00:00.000Z', 'wrong_low'),
    attempt('a2', 'q1', '2026-07-24T00:00:00.000Z', 'wrong_medium'),
    attempt('a3', 'q1', '2026-07-26T00:00:00.000Z', 'correct_medium'),
    attempt('a4', 'q1', '2026-07-27T00:00:00.000Z', 'wrong_high')
  );
  const result = buildConfidenceHistoryTrend(input, query({ period: '7d' }));
  assert.equal(
    result.questionTrends[0].reviewStreakCount,
    3,
    'only one pre-period baseline counts'
  );
  assert.equal(result.trends.continuedReviewQuestionCount, 1);
}

{
  const input = history(
    attempt('z1', 'q-z', '2026-07-26T00:00:00.000Z', 'wrong_high', 'old'),
    attempt('a1', 'q-a', '2026-07-26T00:00:00.000Z', 'correct_medium'),
    attempt('z2', 'q-z', '2026-07-27T00:00:00.000Z', 'correct_high', 'new'),
    attempt('future', 'q-z', '2026-08-02T00:00:00.000Z', 'wrong_high', 'new')
  );
  const result = buildConfidenceHistoryTrend(input, query());
  assert.deepEqual(
    result.questionTrends.map(({ questionId }) => questionId),
    ['q-z', 'q-a']
  );
  assert.equal(result.changeEvents[0].section, 'new');
  assert.equal(result.changeEvents[0].changedAt, '2026-07-27T00:00:00.000Z');
  assert.equal(result.trends.transitionCount, 1);
}

{
  const answeredAt = '2026-07-26T00:00:00.000Z';
  const input = history(
    attempt('same-1', 'q-same', answeredAt, 'wrong_high'),
    attempt('same-2', 'q-same', answeredAt, 'correct_high'),
    attempt('same-3', 'q-same', answeredAt, 'correct_medium'),
    attempt('same-4', 'q-same', answeredAt, 'correct_high')
  );
  const result = buildConfidenceHistoryTrend(input, query());

  assert.equal(result.trends.changedQuestionCount, 1);
  assert.equal(result.trends.transitionCount, 3);
  assert.deepEqual(
    result.changeEvents.map(({ fromAttemptId, toAttemptId, changedAt, changeTypes }) => ({
      fromAttemptId,
      toAttemptId,
      changedAt,
      changeTypes,
    })),
    [
      {
        fromAttemptId: 'same-1',
        toAttemptId: 'same-2',
        changedAt: answeredAt,
        changeTypes: ['misconception-corrected', 'review-to-advance'],
      },
      {
        fromAttemptId: 'same-3',
        toAttemptId: 'same-4',
        changedAt: answeredAt,
        changeTypes: ['review-to-advance'],
      },
    ],
    'same-time events and their from/to pairs preserve canonical relative order'
  );
}

{
  const input = history(
    attempt('review-a1', 'q-review', '2026-07-26T00:00:00.000Z', 'wrong_low', 'A'),
    attempt('review-b', 'q-review', '2026-07-27T00:00:00.000Z', 'wrong_low', 'B'),
    attempt('review-a2', 'q-review', '2026-07-28T00:00:00.000Z', 'correct_medium', 'A')
  );
  const result = buildConfidenceHistoryTrend(input, query({ sectionId: 'A' }));

  assert.equal(result.questionTrends[0].attemptCount, 2);
  assert.equal(result.questionTrends[0].reviewStreakCount, 1);
  assert.equal(result.trends.transitionCount, 0);
}

{
  const input = history(
    attempt('isolated-1', 'q-isolated', '2026-07-26T00:00:00.000Z', 'correct_medium'),
    attempt('isolated-2', 'q-isolated', '2026-07-27T00:00:00.000Z', 'correct_high')
  );
  const result = buildConfidenceHistoryTrend(input, query());

  assert.deepEqual(result.changeEvents[0].changeTypes, ['review-to-advance']);
  assert.equal(result.trends.misconceptionCorrectedCount, 0);
  assert.equal(result.trends.unstableCorrectnessStabilizedCount, 0);
  assert.equal(result.trends.reviewToAdvanceCount, 1);
}

{
  const input = history(
    attempt('detached-1', 'q-detached', '2026-07-26T00:00:00.000Z', 'wrong_high'),
    attempt('detached-2', 'q-detached', '2026-07-27T00:00:00.000Z', 'correct_high')
  );
  const inputSnapshot = structuredClone(input);
  const pristine = buildConfidenceHistoryTrend(input, query());
  const mutated = buildConfidenceHistoryTrend(input, query());

  mutated.questionTrends[0].questionId = 'mutated-question';
  mutated.questionTrends[0].changeTypes.push('mutated-question-type');
  mutated.changeEvents[0].toAttemptId = 'mutated-attempt';
  mutated.changeEvents[0].changeTypes.push('mutated-event-type');
  mutated.questionTrends.push({ mutated: true });
  mutated.changeEvents.push({ mutated: true });

  assert.deepEqual(input, inputSnapshot);
  assert.deepEqual(buildConfidenceHistoryTrend(input, query()), pristine);
  assert.notStrictEqual(mutated.questionTrends, pristine.questionTrends);
  assert.notStrictEqual(mutated.changeEvents, pristine.changeEvents);
  assert.notStrictEqual(
    mutated.questionTrends[0].changeTypes,
    pristine.questionTrends[0].changeTypes
  );
  assert.notStrictEqual(mutated.changeEvents[0].changeTypes, pristine.changeEvents[0].changeTypes);
}

console.log('dep confidence history trend tests passed');
