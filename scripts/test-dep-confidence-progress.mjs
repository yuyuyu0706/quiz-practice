import assert from 'node:assert/strict';

import {
  ANSWER_RESULT_IDS,
  applyConfidenceAnswerResult,
  baseProgress,
  normalizeLastConfidenceAnswer,
  normalizeProgressEntry,
} from '../dep-quiz-app/progress.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const firstDate = '2026-07-25T10:00:00.000Z';
const secondDate = '2026-07-26T10:00:00.000Z';

test('base progress exposes an independent latest-evaluation default', () => {
  assert.equal(baseProgress().lastConfidenceAnswer, null);
  assert.deepEqual(ANSWER_RESULT_IDS, ['correct', 'wrong']);
  assert.notEqual(baseProgress(), baseProgress());
});

test('normalizes all result and confidence combinations without mutating input', () => {
  for (const result of ANSWER_RESULT_IDS) {
    for (const confidence of ['high', 'medium', 'low']) {
      const input = { result, confidence, answeredAt: firstDate, extra: true };
      assert.deepEqual(normalizeLastConfidenceAnswer(input), {
        result,
        confidence,
        answeredAt: firstDate,
      });
      assert.equal(input.extra, true);
    }
  }
});

test('rejects malformed latest evaluations while reading', () => {
  for (const value of [
    null,
    [],
    'answer',
    {},
    { result: 'incorrect', confidence: 'high', answeredAt: firstDate },
    { result: 'correct', confidence: 'HIGH', answeredAt: firstDate },
    { result: 'correct', confidence: ' high ', answeredAt: firstDate },
    { result: 'correct', confidence: 'high', answeredAt: '2026-07-25T10:00:00' },
  ]) {
    assert.equal(normalizeLastConfidenceAnswer(value), null);
  }
});

test('normalizes legacy entries and preserves compatible and unknown properties', () => {
  const input = {
    seenCount: '2',
    note: 'legacy note',
    memo: 'keep alias',
    futureField: { keep: true },
    lastConfidenceAnswer: { result: 'wrong', confidence: 'high', answeredAt: firstDate },
  };
  const normalized = normalizeProgressEntry(input);

  assert.equal(normalized.seenCount, 2);
  assert.equal(normalized.lastAnsweredAt, firstDate);
  assert.deepEqual(normalized.lastConfidenceAnswer, {
    result: 'wrong',
    confidence: 'high',
    answeredAt: firstDate,
  });
  assert.equal(normalized.noteText, 'legacy note');
  assert.equal(normalized.memo, 'keep alias');
  assert.deepEqual(normalized.futureField, { keep: true });
  assert.equal(input.lastAnsweredAt, undefined);
});

test('drops a latest evaluation whose date conflicts with lastAnsweredAt', () => {
  const normalized = normalizeProgressEntry({
    lastAnsweredAt: secondDate,
    lastConfidenceAnswer: { result: 'correct', confidence: 'low', answeredAt: firstDate },
  });
  assert.equal(normalized.lastAnsweredAt, secondDate);
  assert.equal(normalized.lastConfidenceAnswer, null);
});

test('atomically accumulates counts and replaces only the latest evaluation', () => {
  const progress = {
    Q1: {
      seenCount: 4,
      correctCount: 2,
      wrongCount: 2,
      bookmark: true,
      noteText: 'keep',
      futureField: ['keep'],
    },
    Q2: { untouched: true },
  };
  const first = applyConfidenceAnswerResult(progress, 'Q1', {
    result: 'wrong',
    confidence: 'high',
    answeredAt: firstDate,
  });
  const second = applyConfidenceAnswerResult(first, 'Q1', {
    result: 'correct',
    confidence: 'medium',
    answeredAt: secondDate,
  });

  assert.deepEqual([second.Q1.seenCount, second.Q1.correctCount, second.Q1.wrongCount], [6, 3, 3]);
  assert.equal(second.Q1.lastAnsweredAt, secondDate);
  assert.deepEqual(second.Q1.lastConfidenceAnswer, {
    result: 'correct',
    confidence: 'medium',
    answeredAt: secondDate,
  });
  assert.equal(second.Q1.bookmark, true);
  assert.equal(second.Q1.noteText, 'keep');
  assert.deepEqual(second.Q1.futureField, ['keep']);
  assert.equal(second.Q2, progress.Q2);
  assert.equal(progress.Q1.lastConfidenceAnswer, undefined);
});

test('creates safe progress from invalid roots and entries', () => {
  const result = applyConfidenceAnswerResult(null, 'Q1', {
    result: 'correct',
    confidence: 'low',
    answeredAt: firstDate,
  });
  assert.equal(result.Q1.seenCount, 1);
  assert.equal(
    applyConfidenceAnswerResult({ Q1: [] }, 'Q1', {
      result: 'wrong',
      confidence: 'low',
      answeredAt: firstDate,
    }).Q1.wrongCount,
    1
  );
});

test('rejects invalid write inputs', () => {
  const valid = { result: 'correct', confidence: 'high', answeredAt: firstDate };
  for (const questionId of ['', '   ', null]) {
    assert.throws(() => applyConfidenceAnswerResult({}, questionId, valid), TypeError);
  }
  assert.throws(
    () => applyConfidenceAnswerResult({}, 'Q1', { ...valid, result: 'invalid' }),
    TypeError
  );
  assert.throws(
    () => applyConfidenceAnswerResult({}, 'Q1', { ...valid, confidence: 'HIGH' }),
    TypeError
  );
  assert.throws(
    () => applyConfidenceAnswerResult({}, 'Q1', { ...valid, answeredAt: 'invalid' }),
    TypeError
  );
});
