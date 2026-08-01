import assert from 'node:assert/strict';

import { buildConfidenceAnswerCommitPlan } from '../dep-quiz-app/confidence-answer-commit.js';
import { MAX_CONFIDENCE_ATTEMPTS } from '../dep-quiz-app/confidence-history.js';
import { commitConfidenceAnswer, STORAGE_KEYS } from '../dep-quiz-app/storage.js';

const baseAttempt = {
  attemptId: 'attempt-1',
  questionId: 'Q001',
  section: '1',
  result: 'wrong',
  confidence: 'high',
  answeredAt: '2026-08-01T04:00:00.000Z',
};

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function captureError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  assert.fail('Expected function to throw');
}

function buildPlan(overrides = {}) {
  return buildConfidenceAnswerCommitPlan({
    progress: { Q002: { compatibilityFlag: 'keep' } },
    confidenceHistory: { version: 1, attempts: [] },
    ...baseAttempt,
    ...overrides,
  });
}

function createStorage(initial = {}, failures = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  return {
    calls,
    values,
    getItem(key) {
      calls.push(['getItem', key]);
      if (failures.getItem === key) throw new Error(`get ${key}`);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      calls.push(['setItem', key, value]);
      if (failures.setItem?.(key, calls)) throw new Error(`set ${key}`);
      values.set(key, value);
    },
    removeItem(key) {
      calls.push(['removeItem', key]);
      if (failures.removeItem === key) throw new Error(`remove ${key}`);
      values.delete(key);
    },
  };
}

test('builds an immutable canonical plan from one answer value set', () => {
  const progress = { Q002: { compatibilityFlag: 'keep' } };
  const confidenceHistory = { version: 1, attempts: [] };
  const inputs = { progress, confidenceHistory, ...baseAttempt };
  const snapshot = structuredClone(inputs);
  const plan = buildConfidenceAnswerCommitPlan(inputs);

  assert.deepEqual(inputs, snapshot);
  assert.deepEqual(plan.attempt, baseAttempt);
  assert.deepEqual(plan.nextHistory.attempts, [baseAttempt]);
  assert.deepEqual(plan.nextProgress.Q001.lastConfidenceAnswer, {
    result: baseAttempt.result,
    confidence: baseAttempt.confidence,
    answeredAt: baseAttempt.answeredAt,
  });
  assert.equal(plan.nextProgress.Q001.lastAnsweredAt, baseAttempt.answeredAt);
  assert.equal(plan.nextProgress.Q002.compatibilityFlag, 'keep');
  assert.equal(plan.trimmedCount, 0);
});

test('rejects duplicate and invalid attempts before producing progress', () => {
  assert.throws(
    () => buildPlan({ confidenceHistory: { version: 1, attempts: [{ ...baseAttempt }] } }),
    /not added/
  );
  for (const [key, value] of [
    ['attemptId', ''],
    ['questionId', ' Q001'],
    ['section', ''],
    ['result', 'incorrect'],
    ['confidence', 'HIGH'],
    ['answeredAt', 'invalid'],
  ]) {
    assert.throws(() => buildPlan({ [key]: value }), TypeError);
  }
});

test('delegates FIFO trimming to history append', () => {
  const attempts = Array.from({ length: MAX_CONFIDENCE_ATTEMPTS }, (_, index) => ({
    ...baseAttempt,
    attemptId: `old-${index}`,
    answeredAt: new Date(Date.UTC(2020, 0, 1, 0, 0, index)).toISOString(),
  }));
  const plan = buildPlan({ confidenceHistory: { version: 1, attempts } });
  assert.equal(plan.nextHistory.attempts.length, MAX_CONFIDENCE_ATTEMPTS);
  assert.equal(plan.nextHistory.attempts.at(-1).attemptId, baseAttempt.attemptId);
  assert.equal(plan.trimmedCount, 1);
});

test('validates before storage access and saves progress then history', () => {
  const storage = createStorage();
  assert.throws(() => commitConfidenceAnswer({}, { storage }), TypeError);
  assert.deepEqual(storage.calls, []);

  const plan = buildPlan();
  const result = commitConfidenceAnswer(plan, { storage });
  assert.deepEqual(
    storage.calls.map(([operation, key]) => [operation, key]),
    [
      ['getItem', STORAGE_KEYS.progress],
      ['getItem', STORAGE_KEYS.confidenceHistory],
      ['setItem', STORAGE_KEYS.progress],
      ['setItem', STORAGE_KEYS.confidenceHistory],
    ]
  );
  assert.deepEqual(result, plan);
  assert.notEqual(result, plan);
});

test('does not write when either raw snapshot fails', () => {
  for (const key of [STORAGE_KEYS.progress, STORAGE_KEYS.confidenceHistory]) {
    const storage = createStorage({}, { getItem: key });
    assert.throws(() => commitConfidenceAnswer(buildPlan(), { storage }), /get/);
    assert.equal(
      storage.calls.some(([operation]) => operation !== 'getItem'),
      false
    );
  }
});

test('rolls progress back without writing history when progress save fails', () => {
  const original = '{ "raw": "progress" }';
  let progressWrites = 0;
  const storage = createStorage(
    { [STORAGE_KEYS.progress]: original, [STORAGE_KEYS.confidenceHistory]: 'history' },
    {
      setItem: (key) => key === STORAGE_KEYS.progress && ++progressWrites === 1,
    }
  );
  const error = captureError(() => commitConfidenceAnswer(buildPlan(), { storage }));
  assert.equal(error.cause.message, `set ${STORAGE_KEYS.progress}`);
  assert.deepEqual(error.restoreFailures, []);
  assert.equal(storage.values.get(STORAGE_KEYS.progress), original);
  assert.equal(
    storage.calls.filter(
      ([operation, key]) => operation === 'setItem' && key === STORAGE_KEYS.confidenceHistory
    ).length,
    0
  );
});

test('rolls both raw values back when history save fails', () => {
  const initial = {
    [STORAGE_KEYS.progress]: ' raw progress ',
    [STORAGE_KEYS.confidenceHistory]: ' raw history ',
  };
  let historyWrites = 0;
  const storage = createStorage(initial, {
    setItem: (key) => key === STORAGE_KEYS.confidenceHistory && ++historyWrites === 1,
  });
  assert.throws(() => commitConfidenceAnswer(buildPlan(), { storage }));
  assert.deepEqual(Object.fromEntries(storage.values), initial);
});

test('restores absent keys with removeItem and reports rollback failures', () => {
  let historyWrites = 0;
  const storage = createStorage(
    {},
    {
      setItem: (key) => key === STORAGE_KEYS.confidenceHistory && ++historyWrites === 1,
      removeItem: STORAGE_KEYS.progress,
    }
  );
  const error = captureError(() => commitConfidenceAnswer(buildPlan(), { storage }));
  assert.equal(error.cause.message, `set ${STORAGE_KEYS.confidenceHistory}`);
  assert.deepEqual(
    error.restoreFailures.map(({ key }) => key),
    [STORAGE_KEYS.progress]
  );
  assert.equal(
    storage.calls.some(
      ([operation, key]) => operation === 'removeItem' && key === STORAGE_KEYS.confidenceHistory
    ),
    true
  );
  assert.equal(
    storage.calls.some(([, key]) => key === STORAGE_KEYS.settings || key === STORAGE_KEYS.session),
    false
  );
});
