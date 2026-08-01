import assert from 'node:assert/strict';

import {
  CONFIDENCE_HISTORY_VERSION,
  MAX_CONFIDENCE_ATTEMPTS,
  appendConfidenceAttempt,
  createConfidenceAttempt,
  createEmptyConfidenceHistory,
  normalizeConfidenceAttempt,
  normalizeConfidenceHistory,
} from '../dep-quiz-app/confidence-history.js';
import { normalizeUtcIsoDate } from '../dep-quiz-app/utc-iso-date.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function attempt(overrides = {}) {
  return {
    attemptId: 'attempt-1',
    questionId: 'Q001',
    section: '1',
    result: 'wrong',
    confidence: 'high',
    answeredAt: '2026-08-01T04:00:00.000Z',
    ...overrides,
  };
}

function indexedAttempt(index, overrides = {}) {
  return attempt({
    attemptId: `attempt-${index}`,
    answeredAt: new Date(Date.UTC(2020, 0, 1, 0, 0, index)).toISOString(),
    ...overrides,
  });
}

test('exports schema constants and creates independent empty histories', () => {
  assert.equal(CONFIDENCE_HISTORY_VERSION, 1);
  assert.equal(MAX_CONFIDENCE_ATTEMPTS, 5000);
  const first = createEmptyConfidenceHistory();
  const second = createEmptyConfidenceHistory();
  assert.deepEqual(first, { version: 1, attempts: [] });
  assert.notEqual(first, second);
  assert.notEqual(first.attempts, second.attempts);
});

test('creates all six result and confidence combinations as six-field values', () => {
  for (const result of ['correct', 'wrong']) {
    for (const confidence of ['high', 'medium', 'low']) {
      const input = attempt({ result, confidence, extra: 'discarded' });
      const created = createConfidenceAttempt(input);
      assert.deepEqual(Object.keys(created), [
        'attemptId',
        'questionId',
        'section',
        'result',
        'confidence',
        'answeredAt',
      ]);
      assert.equal(created.result, result);
      assert.equal(created.confidence, confidence);
      assert.equal(input.extra, 'discarded');
      assert.notEqual(created, input);
    }
  }
});

test('separates strict creation from tolerant normalization', () => {
  const invalidValues = [
    null,
    [],
    {},
    attempt({ attemptId: '' }),
    attempt({ attemptId: ' attempt-1' }),
    attempt({ questionId: 'Q001 ' }),
    attempt({ section: ' ' }),
    attempt({ result: 'incorrect' }),
    attempt({ confidence: 'HIGH' }),
    attempt({ answeredAt: '2026-08-01T04:00:00+00:00' }),
    attempt({ answeredAt: '2026-08-01T04:00:00' }),
    attempt({ answeredAt: '2026-02-31T04:00:00.000Z' }),
  ];
  for (const value of invalidValues) {
    assert.equal(normalizeConfidenceAttempt(value), null);
    assert.throws(() => createConfidenceAttempt(value), TypeError);
  }
});

test('shares the UTC ISO contract and preserves valid source strings', () => {
  for (const answeredAt of ['2026-08-01T04:00:00Z', '2026-08-01T04:00:00.123Z']) {
    assert.equal(normalizeUtcIsoDate(answeredAt), answeredAt);
    assert.equal(createConfidenceAttempt(attempt({ answeredAt })).answeredAt, answeredAt);
  }
  for (const invalid of [
    '2026-08-01T04:00:00',
    '2026-08-01T04:00:00+00:00',
    '2026-02-29T04:00:00.000Z',
    'not-a-date',
  ]) {
    assert.equal(normalizeUtcIsoDate(invalid), null);
  }
});

test('normalizes invalid roots to empty histories', () => {
  for (const value of [null, [], {}, { version: 2, attempts: [] }, { version: 1, attempts: {} }]) {
    assert.deepEqual(normalizeConfidenceHistory(value), { version: 1, attempts: [] });
  }
});

test('filters invalid attempts, keeps the first duplicate, and sorts stably', () => {
  const sameTime = '2026-08-01T03:00:00.000Z';
  const input = {
    version: 1,
    extra: true,
    attempts: [
      attempt({ attemptId: 'late', answeredAt: '2026-08-01T05:00:00.000Z' }),
      attempt({ attemptId: 'same-first', answeredAt: sameTime }),
      { invalid: true },
      attempt({ attemptId: 'same-second', answeredAt: sameTime }),
      attempt({ attemptId: 'late', result: 'correct', answeredAt: '2026-08-01T02:00:00.000Z' }),
    ],
  };
  const snapshot = structuredClone(input);
  const normalized = normalizeConfidenceHistory(input);

  assert.deepEqual(
    normalized.attempts.map(({ attemptId }) => attemptId),
    ['same-first', 'same-second', 'late']
  );
  assert.equal(normalized.attempts.at(-1).result, 'wrong');
  assert.deepEqual(input, snapshot);
  assert.notEqual(normalized.attempts[0], input.attempts[1]);
});

test('keeps the latest 5,000 canonical attempts at FIFO boundaries', () => {
  for (const count of [4999, 5000, 5001]) {
    const attempts = Array.from({ length: count }, (_, index) => indexedAttempt(index));
    const normalized = normalizeConfidenceHistory({ version: 1, attempts: attempts.reverse() });
    assert.equal(normalized.attempts.length, Math.min(count, 5000));
    assert.equal(normalized.attempts[0].attemptId, `attempt-${Math.max(0, count - 5000)}`);
  }
});

test('appends in canonical order and reports duplicate metadata', () => {
  const existing = attempt({ attemptId: 'existing', answeredAt: '2026-08-02T04:00:00.000Z' });
  const history = { version: 1, attempts: [existing] };
  const older = attempt({ attemptId: 'older', answeredAt: '2026-07-31T04:00:00.000Z' });
  const snapshot = structuredClone(history);
  const added = appendConfidenceAttempt(history, older);

  assert.deepEqual(added, {
    nextHistory: { version: 1, attempts: [older, existing] },
    added: true,
    duplicate: false,
    trimmedCount: 0,
  });
  assert.deepEqual(history, snapshot);

  const duplicate = appendConfidenceAttempt(added.nextHistory, attempt({ attemptId: 'existing' }));
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.trimmedCount, 0);
  assert.notEqual(duplicate.nextHistory, added.nextHistory);
  assert.notEqual(duplicate.nextHistory.attempts, added.nextHistory.attempts);
});

test('reports trimming when appending beyond the limit', () => {
  const attempts = Array.from({ length: MAX_CONFIDENCE_ATTEMPTS }, (_, index) =>
    indexedAttempt(index)
  );
  const newest = indexedAttempt(MAX_CONFIDENCE_ATTEMPTS);
  const result = appendConfidenceAttempt({ version: 1, attempts }, newest);

  assert.equal(result.added, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.trimmedCount, 1);
  assert.equal(result.nextHistory.attempts.length, MAX_CONFIDENCE_ATTEMPTS);
  assert.equal(result.nextHistory.attempts[0].attemptId, 'attempt-1');
  assert.equal(result.nextHistory.attempts.at(-1).attemptId, newest.attemptId);
});

test('counts pre-normalization and post-append trimming without mutating inputs', () => {
  const attempts = Array.from({ length: MAX_CONFIDENCE_ATTEMPTS + 1 }, (_, index) =>
    indexedAttempt(index)
  );
  const history = { version: 1, attempts };
  const newest = indexedAttempt(MAX_CONFIDENCE_ATTEMPTS + 1);
  const historySnapshot = structuredClone(history);
  const attemptSnapshot = structuredClone(newest);

  const result = appendConfidenceAttempt(history, newest);

  assert.equal(result.trimmedCount, 2);
  assert.equal(result.nextHistory.attempts.length, MAX_CONFIDENCE_ATTEMPTS);
  assert.equal(result.nextHistory.attempts.at(-1).attemptId, newest.attemptId);
  assert.deepEqual(history, historySnapshot);
  assert.deepEqual(newest, attemptSnapshot);
});

test('reports pre-normalization trimming when appending a duplicate', () => {
  const attempts = Array.from({ length: MAX_CONFIDENCE_ATTEMPTS + 1 }, (_, index) =>
    indexedAttempt(index)
  );
  const history = { version: 1, attempts };
  const duplicate = { ...attempts.at(-1) };
  const historySnapshot = structuredClone(history);
  const attemptSnapshot = structuredClone(duplicate);

  const result = appendConfidenceAttempt(history, duplicate);

  assert.equal(result.added, false);
  assert.equal(result.duplicate, true);
  assert.equal(result.trimmedCount, 1);
  assert.equal(result.nextHistory.attempts.length, MAX_CONFIDENCE_ATTEMPTS);
  assert.equal(result.nextHistory.attempts.at(-1).attemptId, duplicate.attemptId);
  assert.deepEqual(history, historySnapshot);
  assert.deepEqual(duplicate, attemptSnapshot);
});
